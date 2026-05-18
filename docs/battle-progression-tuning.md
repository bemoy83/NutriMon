# Battle Progression Tuning

This document captures the current leveling, skill, perk, and opponent-level
scaling rules used for battle tuning.

## Leveling And XP

Player level is derived from total XP with the cubic curve:

```text
level = floor(cbrt(totalXp)) + 1
xp floor for level N = (N - 1)^3
```

Key floors:

| Level | XP Floor |
|---:|---:|
| 4 | 27 |
| 8 | 343 |
| 10 | 729 |
| 12 | 1,331 |
| 15 | 2,744 |
| 18 | 4,913 |
| 20 | 6,859 |

XP sources:

| Source | XP |
|---|---:|
| Finalize a day with meals logged | 40 |
| Daily adherence >= 70 | +30 |
| No meals logged | 0 |
| First rewarded win for a node on a battle date | `10 + opponent.recommended_level * 4` |
| Repeat win for the same node on the same battle date | 0 |

Authoritative total XP is:

```text
sum(creature_battle_snapshots.xp_gained)
+ sum(battle_runs.xp_awarded where reward_claimed = true)
```

`creature_companions.xp` and `creature_companions.level` are cached values
derived from this authoritative total. Migration 078 adds database guardrails so
direct stale writes to companion XP or level are corrected from XP.

`creature_battle_snapshots.level` is also derived, but from XP available through
that snapshot's `battle_date`. It is frozen battle-day combat context, not the
authority for permanent progression.

Dev level testing uses a synthetic battle snapshot at `2099-01-01` /
`2099-01-02`. The current normalization pins that dev override to level 20
unless `dev_set_level(target)` is called with a different target.

## Skill And Perk Ladder

Skill and focus perks are permanent companion milestones. The frontend gates
the skill picker by live `companion.level`, and migrations 076/077 removed
snapshot-level gating for skill unlocks, pip cap, and focus gain. The backend
still validates that the skill ID is known and that the player has enough focus
pips.

| Level | Skill | Cost | Notes |
|---:|---|---:|---|
| 1 | Triple Hit | 1 pip | 3 hits at 75% power each |
| 4 | Power Strike | 1 pip | 1 hit at 200% power |
| 8 | Regen | 2 pips | Restore 30% max HP |
| 15 | Charge Strike | all pips, min 2 | `pips * 120%` power |
| 18 | Counter Stance | 1 pip | 50% reduction + 80% counter if attacked |
| 20 | Overdrive | 3 pips | 5 hits at 60% power each |

Perks use live `creature_companions.level` in both client and server battle
resolution. A same-day level-up can immediately grant the companion's newly
earned skill and focus perk milestones.

Battle stat scaling, including player HP, player damage level bonus, and player
defender-level mitigation, still uses the prepared battle snapshot level. That
snapshot level is derived from historical XP through the battle date and should
not be used as permanent progression authority.

| Companion Level | Perk |
|---:|---|
| 1 | Focus pip cap 3, Focus gives +1 pip |
| 10 | Focus pip cap 4 |
| 12 | Focus gives +2 pips |
| 20 | Focus pip cap 5 |

## Opponent Recommended Level Scaling

`battle_opponents.recommended_level` is a campaign-scaling knob. It does not
derive the authored opponent stats, but it contributes to multiple systems:

| System | Effect |
|---|---|
| Opponent power estimate | `recommended_level * 2` |
| Opponent damage | `recommended_level * 0.5` in base damage |
| Defensive mitigation | defender level is used in level mitigation |
| XP reward | `10 + recommended_level * 4` |
| UI and likely-outcome labels | shown as opponent level and used in power comparisons |

These fields are authored independently and should be tuned for fight identity:

```text
strength, resilience, momentum, vitality, action_weights, special_action
```

Opponent HP is not level-scaled:

```text
opponent_max_hp = round(opponent.vitality * 0.7)
```

## Current Recommended Level Curve

The current curve is tuned for cubic leveling and a final boss around level 20.

| Arena | Opponent | Recommended Level |
|---|---|---:|
| Verdantroot Forest | Bramblin | 3 |
| Verdantroot Forest | Mushbob | 4 |
| Verdantroot Forest | Mossboar | 5 |
| Verdantroot Forest | Thornfang | 6 |
| Verdantroot Forest | Elderhorn | 7 |
| Murkmire Wetlands | Boglet | 7 |
| Murkmire Wetlands | Mudmaul | 8 |
| Murkmire Wetlands | Reedstalker | 9 |
| Murkmire Wetlands | Mirewidow | 10 |
| Murkmire Wetlands | Leviamire | 11 |
| Ashrock Highlands | Pebblit | 10 |
| Ashrock Highlands | Screechmite | 11 |
| Ashrock Highlands | Flintor | 12 |
| Ashrock Highlands | Shockmantis | 14 |
| Ashrock Highlands | Thunderox | 15 |
| Frostveil Peaks | Frostscarab | 14 |
| Frostveil Peaks | Glaciowyrm | 15 |
| Frostveil Peaks | Glaciermaw | 16 |
| Frostveil Peaks | Frostwraith | 18 |
| Frostveil Peaks | Tuskraal | 19 |
| Sunforge Summit | Pyrobeetle | 16 |
| Sunforge Summit | Magmacrab | 17 |
| Sunforge Summit | Ashraptor | 18 |
| Sunforge Summit | Cindershell | 19 |
| Sunforge Summit | Solgryth | 20 |

Boss checkpoints:

| Boss | Recommended Level |
|---|---:|
| Elderhorn | 7 |
| Leviamire | 11 |
| Thunderox | 15 |
| Tuskraal | 19 |
| Solgryth | 20 |

## Pacing Targets

Current tuning assumptions:

| Path | Expected Outcome |
|---|---|
| Perfect logging + one new node per day | Ends below level 20, around level 15 |
| Perfect logging + one new node per day + roughly 3 distinct rewarded rematches per day | Reaches level 20 before Solgryth |
| Poor logging / weak readiness | Should struggle even if node levels are available |

The final boss is level 20 so a strongly engaged player can have Overdrive and
the 5-pip cap for the finale. If bosses become too easy, prefer tuning authored
stats or boss specials before raising recommended levels above the real player
pacing curve.
