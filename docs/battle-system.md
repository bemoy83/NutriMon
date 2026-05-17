# Battle System

## Architecture Overview

Turn-based PvE combat. All game logic lives in PostgreSQL (via Supabase RPC); the frontend is display and animation only.

**Turn flow per round:**
1. Player submits action (`attack` / `defend` / `focus` / `skill`)
2. Enemy action selected by `battle_pick_enemy_action()` — 6 reactive rules + pre-empt for special actions
3. Initiative roll determines order (momentum ± 5 jitter; player wins ties)
4. Both actors resolve in initiative order via a single actor loop
5. Battle log entry appended; HP updated; battle completed if either combatant reaches 0 HP

**State persistence:** `battle_runs` row — immutable append-only `battle_log` JSONB, live HP columns, buff columns, pip columns, last-action columns.

**Determinism:** All randomness seeded by `hashtext(battle_run_id || round || phase)` — same battle always replays identically.

---

## Key Files

| Layer | File | Purpose |
|-------|------|---------|
| Combat logic | `supabase/migrations/027_enemy_ai_improvements.sql` | `submit_battle_action()` + `battle_pick_enemy_action()` |
| Skill system | `supabase/migrations/055_focus_pip_skill_system.sql` | Focus pip columns, skill action dispatch, Anti-Skill AI rule |
| Damage formula | `supabase/migrations/017_combat_rebalance.sql` | `battle_compute_damage()` — all coefficients documented |
| Special action handler | `supabase/migrations/029_special_action_handler.sql` | `damage_boost` + `multi_hit` enemy special handling |
| Special action column | `supabase/migrations/028_special_action_column.sql` | `battle_opponents.special_action` JSONB column |
| Shared logic | `supabase/functions/_shared/battleSystem.ts` | Leveling formula, stage bonus, readiness |
| Skill catalog | `src/lib/battleSkills.ts` | Pip costs, unlock levels, skill definitions |
| Types | `src/types/domain.ts` | `BattleOpponent`, `BattleLogEntry`, `BattleRunSession` |
| DB types | `src/types/database.ts` | `BattleOpponentRow`, `SpecialActionDefinition` |
| Mapper | `src/lib/domainMappers.ts` | DB row → domain type conversion |
| Animation config | `src/lib/battleAnimationConfig.ts` | All battle animation timings + skill animation catalog |
| Animation orchestration | `src/hooks/useBattleLogReveal.ts` | Sequences sprite + effects animations from battle log |
| Battle page | `src/pages/app/BattlePage.tsx` | Main battle screen — ref wiring, HP tracking, action submission |

---

## Focus Pip System

Implemented in `055_focus_pip_skill_system.sql`. Columns on `battle_runs`:

- `player_focus_pips integer default 0` — tracks current pip count (0–3)
- `enemy_focus_pips integer default 0` — reserved; enemy skills not yet implemented

**Pip rules:**
- `focus` action: `player_focus_pips = min(3, pips + 1)` per use
- `skill` action: `player_focus_pips = pips - skill_pip_cost` on activation
- `charge_strike` spends all current pips (minimum 2); all others spend a fixed cost
- Pip count is exposed on `BattleRunSession.playerFocusPips` for the HUD

---

## Player Skills

Six skills defined in `src/lib/battleSkills.ts`. All are player-only.

| Skill | Pip cost | Unlock level | Behaviour |
|-------|----------|-------------|-----------|
| `triple_hit` | 1 | 1 | 3 hits × 75% base damage; each hit crits independently |
| `power_strike` | 1 | 4 | 1 hit at 200% base damage |
| `regen` | 2 | 8 | Restore 30% of max HP |
| `charge_strike` | 2 (all pips) | 15 | Spends all pips; damage = `pips × 120%` base (min 2 pips required) |
| `counter_stance` | 1 | 18 | 50% damage reduction this turn; 80% chance to fire a counter hit if attacked |
| `overdrive` | 3 | 20 | 5 hits × 60% base damage; each hit crits independently |

Crit cap for focused multi-hit skills: 35% per hit (`FOCUSED_CRIT_CAP = 3500`).

---

## Enemy AI — 6 Reactive Rules

Implemented in `battle_pick_enemy_action()` (027 + updated in 055). Rules evaluated in priority order; Rule 6 is a secondary modifier that stacks.

| # | Name | Condition | Effect | Tuning |
|---|------|-----------|--------|--------|
| 1 | Desperation | HP ≤ 25% | Force 100/0/0 | Threshold: 0.20–0.33 |
| 2 | Spend Buff | `enemy_nab > 0` | Force 95/5/0 | Weights: 80–98/remainder/0 |
| 3 | Caution Band | HP 25–50% | Shift 20% atk → def | Shift: 0.15–0.30 |
| 4 | Anti-Skill | `player_focus_pips ≥ 1` | Shift 20% atk → def | Shift: 0.15–0.35 |
| 5 | Counter-Read | Player defended last turn | Shift 35% atk → foc | Shift: 0.25–0.50 |
| 6 | Aggression Cooldown | Enemy focused last turn | Redirect 40% foc → atk | Factor: 0.30–0.60 |

Rule 4 was originally "Anti-Focus" (reacted to `player_nab > 0`); updated in 055 to react to pip count instead.

---

## Special Actions

Stored as `battle_opponents.special_action JSONB`. Handler wired in migration 029.

**Triggering (pre-empt):** Before AI rules, roll 0–99. If `roll < special_action.weight` → enemy uses special action that turn instead of a normal action.

**Supported types:**

| Type | Params | Behaviour |
|------|--------|-----------|
| `damage_boost` | `{ multiplier: number }` | Base damage × multiplier. Tuning range 1.3–3.0. |
| `multi_hit` | `{ hits: number, damage_fraction: number }` | N hits of `damage_fraction` × base damage each. Each hit crits independently (seeded by hit index). |

`status_apply` is a valid type in `SpecialActionDefinition` but the combat handler is not wired — no-op if triggered.

**`SpecialActionDefinition` shape:**
```typescript
{
  type: 'damage_boost' | 'status_apply' | 'multi_hit'
  label: string        // display name shown in battle log
  description: string  // flavour text / tooltip
  weight: number       // 0–100 pre-empt probability per turn
  params: Record<string, unknown>
}
```

**Active boss special actions** (seeded in migrations 030, 050, 053):

| Opponent | Label | Type | Params | Weight |
|----------|-------|------|--------|--------|
| Sunscale Drake | Scorch Breath | `damage_boost` | multiplier 1.6 | 20 |
| Pyrestone Colossus | Magma Surge | `multi_hit` | 2 hits × 0.70 | 22 |
| The Vault Guardian | Ancient Wrath | `damage_boost` | multiplier 1.85 | 25 |

---

## Damage Formula

```
final_damage = max(1,
  (strength × 0.20 + momentum × (1 + boost) × 0.13 + level × 0.5)
  × variance(0.90–1.10)
  × crit_multiplier(1.0 or 1.5)
  × stage_multiplier(baby=1.0, adult=1.15, champion=1.35)
  × (1.0 + next_attack_bonus)
  × max(0.60, 1.0 − resilience × 0.004)
)
```

Crit chance = `momentum × 15 / 10000` (max ~15% at momentum=100).
All coefficients are annotated with tuning ranges in `017_combat_rebalance.sql`.

---

## Reward System

- **Battle XP:** `10 + opponent.recommended_level × 4` — first win per opponent only, per battle date
- **Arena progress:** +1 on first win, gates next opponent unlock
- **Daily XP:** `40 + (adherence ≥ 70 ? 30 : 0)` from `finalizeDay` — range 40–70 XP
- **Leveling:** `floor(∛total_xp) + 1` (cubic curve — `getLevelFromXp` in `battleSystem.ts`, implemented in migration 063)

---

## Foundations Laid — Follow-Up Required

These features were intentionally scoped out. The DB columns, types, or data structures were added so future work is logic + UI only, not schema changes.

---

### 1. Player Special Move
**Foundation:** `SpecialActionDefinition` type and `specialAction` field on `BattleOpponent` domain type exist. Architectural decision: player special lives on `creature_battle_snapshots` (frozen at prep time), not on `battle_opponents`.

**What's missing:**
- `special_action` column on `creature_battle_snapshots`
- Player special authored and assigned per creature stage or species
- Actor loop player branch handling `'special'` action
- `BattleCommandBar` button gated on a triggering condition (TBD — pip-based, turn-based, or meter-based)

---

### 2. Status Effects (`status_apply`)
**Foundation:** `status_apply` is a valid `SpecialActionDefinition` type in `database.ts`. The type is defined but the combat handler is not wired.

**What's missing:**
- `active_status_effects` column on `battle_runs` (JSONB array: `[{ type, remaining_rounds }]`)
- Per-turn effect application in the actor loop (burn = flat damage per round, slow = initiative penalty)
- Status effect display in battle HUD
- Status clear logic when `remaining_rounds` reaches 0

**Agreed scope:** Defer until after Phase 3 initial ship.

---

### 3. Arena Progression Display
**Foundation:** `arena_progress_awarded` is tracked and persisted in `battle_runs` on every first win.

**What's missing:**
- Progress counter UI in the arena hub (`X/5 opponents defeated`)
- Visual indicator on the progression map

---

### 4. Performance XP
**Foundation:** `remaining_hp_pct` is stored on every completed `battle_run`.

**What's missing:**
- Bonus XP tier in `submit_battle_action` reward block — e.g. `+5 XP if remaining_hp_pct > 50`
- UI callout in `BattleOutcomeModal` showing bonus XP earned

---

### 5. Per-Hit Visual Feedback for `multi_hit`
**Foundation:** Multi-hit damage is logged as a single `BattleLogEntry` with a breakdown message (e.g. `"3 hits: 12, 17 (CRIT!), 11 = 40 damage!"`). The total drives the existing hurt animation and damage number.

**What's missing:**
- Sequential per-hit damage numbers floating up (one per hit with individual crit badges)
- Requires splitting multi-hit into N log sub-entries or a new `hit_breakdown` field on `BattleLogEntry`

---

### 6. Battle Replay
**Foundation:** All randomness is deterministically seeded by `battle_run_id + round`. Any past battle can be replayed by re-running the same action sequence against the same seeds.

**What's missing:**
- Replay RPC that accepts a `battle_run_id` and returns a simulated log
- Replay UI (step-through or auto-play)

No schema changes needed to support this.
