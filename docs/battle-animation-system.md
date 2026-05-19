# Battle Animation System

> **Scope:** Frontend animation pipeline only. For game logic (damage formula, enemy AI, skill pip costs) see [`battle-system.md`](battle-system.md) and [`src/lib/battleSkills.ts`](../src/lib/battleSkills.ts).

---

## Architecture — Five Layers

```
BattleLogEntry[]  (Supabase RPC — immutable game facts, no animation knowledge)
        ↓
battleAnimationPlan.ts     conductor — converts log entries into a timed event list
        ↓
SKILL_ANIMATION_CATALOG    recipes — per-skill behavior + visuals + extra effects
        ↓
useBattleLogReveal.ts      executor — typed switch dispatches events to effect handles
        ↓
EffectsLayer.tsx + battle-effects/*   primitives — reusable visual building blocks
```

**The pipeline is unidirectional.** Game facts flow down; no layer talks back up. The conductor reads the catalog; the executor reads nothing but the event it receives.

---

## Sprite Idle Animation System

> This system runs **parallel to and independently of** the battle log pipeline above. It is always-on ambient animation driven by static config, not by game events.

### Overview

Creatures in the battle arena breathe and sway using CSS-only transforms applied to dedicated wrapper divs inside `CreatureSprite`. No sprite sheet frames are needed — the illusion of life comes entirely from CSS `transform` animations tuned per size class and optionally per individual creature.

### DOM layer structure inside `CreatureSprite`

```
div[containerStyle]                     — lunge / recoil / anticipation (battle pipeline)
  div.animate-sprite-sway               — rotateZ pendulum (large) OR
  div.animate-sprite-weight-shift       — translateX rock (small/medium) — transform-origin: bottom center
    div.animate-sprite-breathe          — scaleY + scaleX swell, transform-origin: bottom center
      div[glowWrapperStyle]             — charge / heal / focus filter glow (battle pipeline)
        img
  [hit flashes]                         — siblings, NOT children — don't inherit idle transforms
  [faint overlay]                       — siblings, NOT children
```

Each animation layer owns exactly one CSS `transform` property. Nesting prevents conflicts between `scaleX`/`scaleY` and the sway transform without needing `animation` property juggling on a shared element. Platform images are never affected — they live in a separate sibling div outside `CreatureSprite`.

The contact shadow ellipse in `SpriteStage` pulses in sync with the sprite's breath via CSS custom properties set on the `SpriteStage` root div (shadow is a sibling of `CreatureSprite`, not a descendant of the breathe wrapper — CSS var inheritance bridges the gap).

### CSS custom properties

All timing and magnitude values are controlled via CSS custom properties set as inline styles on the wrapper divs. The keyframes themselves never need to change to produce a new variant.

| Property | Default | Controls |
|----------|---------|---------|
| `--idle-breathe-duration` | `4s` | Period of one inhale + exhale cycle |
| `--idle-breathe-scale` | `1.018` | Peak scaleY at inhale apex |
| `--idle-breathe-scale-x` | `1` | Peak scaleX at inhale apex (barrel-chest expansion) |
| `--idle-breathe-compress` | `0.988` | Exhale scaleY compression (distress only) |
| `--idle-breathe-compress-x` | `1` | Exhale scaleX compression (distress only) |
| `--idle-sway-duration` | `5s` | Period of one full left → right → left cycle |
| `--idle-sway-angle` | `0.8` | Peak rotation in degrees (unitless — applied via `calc(... * 1deg)`); `rotate` style only |
| `--idle-sway-shift` | `2` | Peak translateX offset in px (unitless — applied via `calc(... * 1px)`); `shift` style only |
| `--idle-sway-delay` | `0s` | Phase offset; set to `1.4s` on opponent so sprites don't mirror each other |
| `--shadow-breathe-duration` | `4s` | Set on `SpriteStage` root; inherited by shadow div |
| `--shadow-breathe-scale-x` | `1` | Peak scaleX of shadow ellipse; matches sprite's breathe scaleX |

### Key files

| File | Role |
|------|------|
| [`src/index.css`](../src/index.css) | Animation library section: `sprite-breathe`, `sprite-breathe-distress`, `sprite-sway`, `sprite-weight-shift`, `shadow-breathe`, `shadow-breathe-distress` keyframes + classes |
| [`src/lib/battleAnimationConfig.ts`](../src/lib/battleAnimationConfig.ts) | `IDLE_ANIM` token table — size-class defaults for all tunable values |
| [`src/lib/spriteIdleConfig.ts`](../src/lib/spriteIdleConfig.ts) | `SpriteIdleOverride` type, `ResolvedIdleConfig` type, `resolveIdleConfig()` merge function |
| [`src/lib/sprites.ts`](../src/lib/sprites.ts) | `OpponentSpriteEntry.idleOverride` field; `getOpponentEntry(name)` helper |
| [`src/components/ui/CreatureSprite.tsx`](../src/components/ui/CreatureSprite.tsx) | `idleConfig?: ResolvedIdleConfig` prop; sway + breathe wrappers |
| [`src/components/ui/SpriteStage.tsx`](../src/components/ui/SpriteStage.tsx) | `idleConfig?: ResolvedIdleConfig` prop; sets shadow CSS vars; applies shadow breathe class |
| [`src/pages/app/BattlePage.tsx`](../src/pages/app/BattlePage.tsx) | Calls `resolveIdleConfig()` for player and opponent; passes result to both `CreatureSprite` and `SpriteStage` |

### Size-class defaults

Larger creatures have more mass — they breathe slower and sway less. All values live in `IDLE_ANIM` in `battleAnimationConfig.ts`.

| | small | medium | large |
|---|---|---|---|
| Breathe duration | 3.5s | 4.0s | 4.8s |
| Breathe scaleY | 1.022 | 1.018 | 1.012 |
| Breathe scaleX | 1.010 | 1.008 | 1.005 |
| Sway duration | 2.8s | 3.0s | 4.0s |
| Sway style | shift | shift | rotate |
| Sway angle (°) | 1.2 | 0.8 | 0.5 |
| Sway shift (px) | 2.5 | 1.8 | 1.2 |

### HP distress state

When `hpRatio ≤ 0.30`, `resolveIdleConfig()` switches the breathe class to `animate-sprite-breathe-distress` and applies faster duration / more exaggerated scale from the `distress*` fields in `IDLE_ANIM`. No class swap logic is needed in `BattlePage` — the resolved config handles it.

### Per-sprite overrides

Add `idleOverride` to any `OpponentSpriteEntry` in `sprites.ts`. Only specify fields you want to change — everything else falls back to size-class defaults:

```ts
// src/lib/sprites.ts
'thunderox': {
  battle: { url: s('/sprites/opponents/thunderox.png'), ... },
  footOffsetY: 12,
  idleOverride: {
    swayAngleDeg: 0.3,    // barely sways — very heavy creature
    breatheDurationS: 6,  // extremely slow breath
  },
},

// Force rotateZ sway for a small creature with an upright posture
'marsh_toad': {
  battle: { ... },
  idleOverride: { swayStyle: 'rotate', swayAngleDeg: 2.0 },
},

// Completely rigid creature — no idle animation at all
'iron_golem': {
  battle: { ... },
  idleOverride: { disableSway: true, disableBreathe: true },
},
```

### Adding a new idle animation

1. Add `@keyframes` + `.animate-sprite-*` class to the **Sprite idle animation library** section of `src/index.css`. Document its CSS custom properties in the class comment.
2. Add default values for each size class to `IDLE_ANIM` in `battleAnimationConfig.ts`.
3. Add optional override fields to `SpriteIdleOverride` and resolved fields to `ResolvedIdleConfig` in `spriteIdleConfig.ts`. Wire them in `resolveIdleConfig()`.
4. Add a new wrapper div inside `CreatureSprite` following the existing sway → breathe nesting pattern. Apply the class and inline CSS var style.

No changes to `BattlePage` are needed unless the new animation requires a new data input (e.g. a value not already available in `ResolvedIdleConfig`).

---

## Files at a Glance

| File | Role |
|------|------|
| [`src/lib/battleAnimationConfig.ts`](../src/lib/battleAnimationConfig.ts) | Single source of truth: `BATTLE_ANIM` timing constants, `SKILL_ANIMATION_CATALOG`, all visual types |
| [`src/hooks/battleAnimationPlan.ts`](../src/hooks/battleAnimationPlan.ts) | Conductor — produces `ScheduledBattleAnimationEvent[]` from log entries; zero per-skill branches |
| [`src/hooks/useBattleLogReveal.ts`](../src/hooks/useBattleLogReveal.ts) | Executor — `setTimeout` fan-out + typed `switch` on `event.kind`; no skill knowledge |
| [`src/components/ui/EffectsLayer.tsx`](../src/components/ui/EffectsLayer.tsx) | Imperative handle exposed via `useImperativeHandle`; ~12 methods; owns all effect state |
| [`src/components/ui/battle-effects/`](../src/components/ui/battle-effects/) | Individual effect components (DamageNumber, Impact, Shockwave, Guard, Regen, FocusCharge) |
| [`src/lib/battleSkills.ts`](../src/lib/battleSkills.ts) | Pip costs, unlock levels — game data only, no animation config |
| [`src/index.css`](../src/index.css) | CSS `@keyframes` — durations **must** stay in sync with `BATTLE_ANIM` constants |

---

## Adding a New Skill — The Only File You Need

**If a skill exists in `battleSkills.ts` and deals damage or provides a support buff, add one entry to `SKILL_ANIMATION_CATALOG` in [`battleAnimationConfig.ts`](../src/lib/battleAnimationConfig.ts). No other files need to change.**

```ts
// src/lib/battleAnimationConfig.ts
export const SKILL_ANIMATION_CATALOG: Partial<Record<string, SkillAnimationEntry>> = {

  // Example: a new heavy single-hit damage skill
  magma_surge: {
    // --- Behavioral ---
    kind: 'single_hit',
    anticipationMs: BATTLE_ANIM.HEAVY_SKILL_ANTICIPATION_MS, // longer wind-up
    heavy: true,          // adds ground shockwave + heavy arena shake
    // --- Visual ---
    impact: {
      stroke: '#f97316',
      glowFilter: 'drop-shadow(0 0 8px rgba(249,115,22,0.95)) drop-shadow(0 0 15px rgba(234,88,12,0.65))',
    },
    flash: 'rgba(249,115,22,0.28)', // full-screen wash at lunge start (player only)
    shockwave: {
      stroke: 'rgba(249,115,22,0.92)',
      glow:   'rgba(249,115,22,0.72)',
      deepGlow: 'rgba(194,65,12,0.46)',
    },
  },

  // Example: a new multi-hit skill
  flurry: {
    kind: 'multi_hit',
    hitCount: 4,
    hitSpacingMs: BATTLE_ANIM.FOCUSED_HIT_SPACING_MS,
    impactVariant: 'arc',   // 'slash' | 'arc' | 'burst' | 'cut'
    impact: BRIGHT_AMBER_HIT_IMPACT,  // use a shared constant or inline
    flash: 'rgba(251,191,36,0.22)',
  },

  // Example: a new support-buff skill
  iron_wall: {
    kind: 'support_guard',  // raises persistent guard ring on player
    impact: BRIGHT_AMBER_HIT_IMPACT,
    flash: 'rgba(14,165,233,0.22)',
  },

}
```

### `kind` determines the conductor path

| `kind` | What the conductor does |
|--------|------------------------|
| `single_hit` | Lunge → `heavy_impact` event → optional ground shockwave (if `heavy: true`) |
| `multi_hit` | Lunge → `focused_impact` event with N hit beats; optional per-hit streaks via `hasStreaks` |
| `support_guard` | Short anticipation → `persistent_guard` effect (looping shield ring) |
| `support_heal` | Short anticipation → `regen` effect (green particle orbit + heal number) |

### Composing extra effects with `extraEffects`

Any damage skill can layer additional one-shot primitives on top at contact time without touching the conductor:

```ts
my_skill: {
  kind: 'single_hit',
  extraEffects: ['persistent_guard'],  // also raises the guard ring on hit
  impact: AMBER_HIT_IMPACT,
  flash: 'rgba(139,92,246,0.28)',
},
```

Currently dispatchable primitives: `'overdrive_streak'`, `'persistent_guard'`, `'ground_shockwave'`.

`extraEffects` fires **once at contact time**. It is distinct from `hasStreaks`, which fires one `overdrive_streak` per hit beat for multi-hit skills.

---

## `SkillAnimationEntry` Field Reference

All fields live in `src/lib/battleAnimationConfig.ts`.

### Behavioral fields

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `kind` | `SkillAnimationKind` | required | Selects conductor path — see table above |
| `anticipationMs` | `number` | `BATTLE_ANIM.ATTACK_ANTICIPATION_MS` (140ms) | Pre-lunge wind-up. Use `HEAVY_SKILL_ANTICIPATION_MS` (240ms) or `POWER_STRIKE_ANTICIPATION_MS` (400ms) for more drama |
| `heavy` | `boolean` | `false` | Heavy anticipation pose + ground shockwave + heavy arena shake/flash |
| `hasChargeGlow` | `boolean` | `false` | Golden charge aura plays on attacker before lunge. Adds `CHARGE_GLOW_MS` (300ms) before lunge start |
| `hitCount` | `number` | `3` | `multi_hit` only — number of hit beats |
| `hitSpacingMs` | `number` | `FOCUSED_HIT_SPACING_MS` (180ms) | `multi_hit` only — gap between hit beats |
| `impactVariant` | `ImpactVariant` | `'arc'` | `multi_hit` only — impact graphic shape: `'slash'` `'arc'` `'burst'` `'cut'` |
| `hasStreaks` | `boolean` | `false` | `multi_hit` only — fires `overdrive_streak` once per hit beat |
| `streakRequiresPipCheck` | `boolean` | `false` | Only fire streaks when player had enough pips to activate the skill |
| `resolveDelayMs` | `number` | `0` | `support_*` only — extra wait after anticipation before entry resolves |
| `extraEffects` | `EffectPrimitive[]` | `[]` | One-shot primitives fired at contact time after the base impact |

### Visual fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `impact` | `SkillImpactVisual` | yes | SVG stroke color + CSS drop-shadow filter for hit impact graphic |
| `flash` | `string` | yes | `rgba(...)` full-screen wash at lunge start (player-only; opponent skills skip flash) |
| `shockwave` | `SkillShockwaveVisual` | no | Three-layer ellipse shockwave colors. Omit for no shockwave (independent of `heavy`) |
| `streak` | `SkillStreakVisual` | no | Gradient background for overdrive-style streaks. Required if `hasStreaks: true` |

### Shared visual constants

```ts
// Defined at the top of battleAnimationConfig.ts — reuse these
AMBER_HIT_IMPACT        // standard amber/gold impact
BRIGHT_AMBER_HIT_IMPACT // brighter yellow-amber variant
DEFAULT_AMBER_SHOCKWAVE // default yellow shockwave
```

---

## Adding a Brand New Visual Primitive

If no existing effect covers what you need, adding a primitive currently costs 4 file changes. Do all four together.

**Step 1 — Component** [`src/components/ui/battle-effects/`](../src/components/ui/battle-effects/)

Add a new `*.tsx` file. Follow the pattern of `ShockwaveEffects.tsx` or `ImpactEffects.tsx` — export a typed state item shape and a component that renders a list of them from state.

**Step 2 — Handle method** [`src/components/ui/EffectsLayer.tsx`](../src/components/ui/EffectsLayer.tsx)

Add a method to `EffectsLayerHandle` interface and wire it in `useImperativeHandle`. The method adds to a state array and schedules removal via `addTimedEffect`.

**Step 3 — Event variant** [`src/hooks/battleAnimationPlan.ts`](../src/hooks/battleAnimationPlan.ts)

Add a new discriminated variant to `BattleAnimationEvent`:
```ts
| { type: 'effect'; kind: 'my_primitive'; target: BattleAnimationTarget; /* params */ }
```

Emit it from the conductor at the right point in the skill sequence (usually `contactAtMs`).

**Step 4 — Executor case** [`src/hooks/useBattleLogReveal.ts`](../src/hooks/useBattleLogReveal.ts)

Add a `case 'my_primitive':` to the `switch (event.kind)` block that calls the new `EffectsLayerHandle` method.

After these four steps, reference `'my_primitive'` in `extraEffects` for any skill that needs it — no further conductor or executor changes required.

---

## Event Kind Reference

All effect events are dispatched through the `switch (event.kind)` in `useBattleLogReveal.ts`. Each `kind` maps to one or more `EffectsLayerHandle` calls.

| `kind` | Executor action | Triggered by |
|--------|-----------------|-------------|
| `defend_guard` | `fx.showDefendGuard()` | Player's `defend` action |
| `guard_impact` | `fx.showGuardImpact(intensity)` | Defended hit — normal or heavy intensity |
| `focus_charge` | `fx.showFocusCharge()` + sprite `triggerFocusGlow()` | Player's `focus` action |
| `charge_glow` | sprite `triggerChargeGlow()` | Skills with `hasChargeGlow: true` |
| `persistent_guard` | `playerFx.showPersistentGuard()` | `support_guard` skills; also in `extraEffects` |
| `hide_persistent_guard` | `playerFx.hidePersistentGuard()` | Counter payoff hit; `finish_animation` |
| `regen` | `playerFx.showRegenOrbitEffect(healAmount)` + sprite `triggerHealGlow()` | `support_heal` skills |
| `flash` | `specialFlash.triggerFlash(color)` | Player skill lunge start (color from `entry.flash`) |
| `basic_impact` | `fx.showAttackImpact()` + `showDamageNumber()` | Player/opponent `attack` |
| `heavy_impact` | `fx.showHeavyAttackImpact(tint)` + `showGroundShockwave()` + `showDamageNumber()` | `single_hit` skills |
| `focused_impact` | `fx.showFocusedAttackImpact(hitCount, spacing, variant, tint)` + deferred `showDamageNumber()` | `multi_hit` skills |
| `overdrive_streak` | `fx.showOverdriveStreak(color)` | Per-hit from `hasStreaks`; also in `extraEffects` |
| `ground_shockwave` | `fx.showGroundShockwave(wide, color)` | `extraEffects` on any skill; color from `recipe.shockwave` |
| `counter_impact` | `fx.showDamageNumber()` + `fx.showAttackImpact(tint)` | Counter payoff hit |

Non-effect events (`sprite_anticipation`, `sprite_attack`, `sprite_hurt`, `sprite_faint`, `arena_shake`, `arena_flash`, `finish_animation`) are handled before the `effect` block in the executor.

---

## `EffectsLayerHandle` Method Reference

Methods are called on `playerEffectsRef.current` or `opponentEffectsRef.current` depending on `event.target`.

| Method | Effect | Duration constant |
|--------|--------|-------------------|
| `showDamageNumber(value, isCrit)` | Float-up number; color is side-aware (red player / white opponent / amber crit) | `DAMAGE_NUMBER_MS` (1000ms) |
| `showAttackImpact(isCrit?, color?)` | Slash/burst impact graphic | `HIT_IMPACT_MS` (350ms) |
| `showHeavyAttackImpact(isCrit?, color?)` | Larger burst impact | `HIT_IMPACT_MS + HIT_STOP_MS` |
| `showFocusedAttackImpact(isCrit?, hitCount?, spacingMs?, variant?, color?, opts?)` | N staggered impact graphics | `HIT_IMPACT_MS` per hit |
| `showGroundShockwave(wide?, color?)` | Ellipse ring expands from ground | `GROUND_SHOCKWAVE_MS` (420ms) |
| `showDefendGuard(durationMs?)` | Blue dome shield ring | `DEFEND_GUARD_MS` (900ms) |
| `showGuardImpact(intensity?)` | Shield contact flash | `GUARD_IMPACT_MS` (360ms) |
| `showFocusCharge()` | Gold mote orbit inward | `FOCUS_CHARGE_MS` (860ms) |
| `showOverdriveStreak(color?)` | Horizontal speed-blur streak | 280ms |
| `showRegenOrbitEffect(healAmount)` | Green motes orbit + heal number | `HEAL_EFFECT_MS` (1300ms) |
| `showPersistentGuard()` | Looping shield ring (persists) | until `hidePersistentGuard()` |
| `hidePersistentGuard()` | Dismisses persistent guard ring | 400ms fade-out |

---

## Timing Constants

All timing lives in `BATTLE_ANIM` in [`battleAnimationConfig.ts`](../src/lib/battleAnimationConfig.ts). **If you change a constant, the matching CSS `@keyframes` in [`src/index.css`](../src/index.css) must also change, and vice versa.**

Critical links:

| Constant | CSS keyframe |
|----------|-------------|
| `HURT_MS` (500ms) | `hit-flash` |
| `HURT_CRIT_MS` (550ms) | `hit-flash-crit` |
| `FAINT_BLINK_MS` (400ms) | `faint-blink`; also `begin="0.4s"` in `CreatureSprite.tsx` SMIL |
| `FAINT_MS` (1400ms) | includes `faint-blink` + SVG noise dissolve |
| `DAMAGE_NUMBER_MS` (1000ms) | `float-up` / `crit-float-up` |
| `HIT_IMPACT_MS` (350ms) | `hit-impact` |
| `DEFEND_GUARD_MS` (900ms) | `shield-dome-in` |
| `GROUND_SHOCKWAVE_MS` (420ms) | `ground-shockwave` |
| `CHARGE_GLOW_MS` (300ms) | `charge-glow` |
| `HEAL_GLOW_MS` (950ms) | `heal-glow` |
| `LUNGE_MS` (320ms) | `battle-lunge-right` / `battle-lunge-left` |
| `SPECIAL_FLASH_MS` (450ms) | `special-flash` |

---

## Hard Rules

**Do not add `if (skillId === '...')` branches** to `battleAnimationPlan.ts` or `useBattleLogReveal.ts`. The entire refactor exists to eliminate these. All per-skill behavior belongs in `SKILL_ANIMATION_CATALOG`.

**Do not add animation logic to `BattleLogEntry` or Supabase.** Game facts and animation config are strictly separated. The conductor reads `entry.damage`, `entry.target`, `entry.skillId`, `entry.crit`, `entry.defended` — that is the complete interface.

**Timing constants are the single source of truth.** Never hardcode a millisecond value in component code or in test assertions. Import from `BATTLE_ANIM`.

**`EffectsLayer` is purely additive.** Methods only start effects; they never cancel in-progress ones. Overlapping calls are expected and intentional.

**Player vs. opponent asymmetry:**
- Flash (`event.kind === 'flash'`) fires for player skills only — the conductor skips it when `entry.actor === 'opponent'`
- `persistent_guard` always targets `playerEffectsRef` — it is a player-only effect
- `showDamageNumber` color is driven by the `side` prop on `EffectsLayer` (`'player'` → red, `'opponent'` → white, crit → amber on both)
- All other effects use `fx(event.target)` which routes to the correct side

---

## Test Coverage

`src/hooks/__tests__/battleAnimationPlan.test.ts` — 10 tests covering conductor timing. Run with:

```sh
npm test -- --run
```

When adding a new skill to `SKILL_ANIMATION_CATALOG`, no test changes are needed unless the skill introduces a new behavioral variant. When adding a new effect primitive (the 4-step procedure), add a conductor test for the new event emission timing.
