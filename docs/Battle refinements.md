# NutriMon Battle UX Handoff

## Recent Work Completed
- Implemented Regen Effect V3 (motes-rise + expanding rings):
  - Visual language flipped from convergence (attack feel) to outward radiation (heal feel), matching the reference Pokémon VFX system.
  - 12 motes now float upward from sprite body center with random horizontal scatter (`--fx` CSS var) and staggered delays 0–380ms. Replaces the old 6-particle inward-orbit.
  - Three concentric elliptical rings expand from sprite center at 0/180/380ms offsets, each scaling 0.32×→2.3× before dissolving. Rings are slightly flattened (60% height) to read as a ground-plane ripple.
  - Soft `regen-body-bloom` radial glow replaces the stepped `battle-focus-aura` reuse.
  - `+HP` number delayed 250ms so the first ring expands before the number appears. Number now has a green glow text-shadow.
  - `HEAL_EFFECT_MS` bumped 900→1300ms to cover the staggered ring tail.
  - `RegenOrbitEffect` state now carries pre-computed `motes[]` (fxPx, delayMs, sizePx) so mote positions are stable across re-renders.
  - Old `regen-orbit-in` keyframe removed; new: `regen-mote-rise`, `regen-ring-expand`, `regen-body-bloom`.
- Implemented Effects & Animation Polish Pass V1:
  - Skill-tinted impact graphics: `SKILL_IMPACT_COLOR` map in `battleAnimationConfig.ts` drives per-skill hit spark color/glow. `triple_hit` → sky blue cut marks, `overdrive` → fuchsia arcs, `power_strike` → orange burst, `charge_strike` → amber burst, `counter_stance` payoff hit → sky blue slash. Crits always flash white for maximum pop regardless of skill.
  - `ImpactGraphic` now accepts `impactColor?: { stroke, glowFilter }` prop; crit overrides to `#ffffff` + white glow.
  - `EffectsLayerHandle` methods `showAttackImpact`, `showHeavyAttackImpact`, `showFocusedAttackImpact` all accept an optional `impactColor` trailing param (backward compatible).
  - Crit damage number bounce: new `crit-float-up` CSS keyframe — pops in at 1.3× scale then floats 56px up (vs 40px for normal). Crit numbers are white + warm-gold text-glow shadow instead of amber.
  - Danger heartbeat: `battle-danger-pulse` keyframe restructured to a double-beat "lub-dub" rhythm (7% peak → 16% rest → 25% peak → silence) at 1.4s cycle instead of single 1.6s wave.

- Implemented Skill Identity Pass V2:
  - `triple_hit`: directional slash impacts (±38°/+36°/−14°) instead of arcs.
  - `power_strike`: 400ms anticipation (`POWER_STRIKE_ANTICIPATION_MS`), always-heavy arena shake, wider 90% shockwave with thicker border.
  - `regen`: 6 green particles orbit inward to sprite center (CSS var `--dx`/`--dy` per particle) before +HP number appears.
  - `charge_strike`: pips converge into sprite center (`showChargeStrikeSpend`) using `battle-focus-converge` keyframe instead of floating up.
  - `counter_stance`: persistent looping shield ring (`showPersistentGuard`) replaces one-shot guard; cleared when counter fires or animation ends.
  - `overdrive`: fuchsia horizontal streak (`showOverdriveStreak`) fires per hit beat alongside the arc impacts.
- Implemented Arena Layer Competition Pass V1:
  - Split biome particles into back and front depth layers.
  - Constrained foreground particles away from fixed top HUD and bottom command bar zones.
  - Added BattleParticles tests for depth layers and foreground safe zones.
- Fixed compressed-height battle depth ordering:
  - Root cause: Tailwind emitted `z-[1]`, `z-[2]`, and `z-[3]` in the built CSS, but not the player wrapper's `z-[4]`.
  - Moved opponent/player wrapper depth values to inline `zIndex` styles so the player remains foreground when sprites/platforms overlap.
- Implemented Battle Action Readability V1:
  - Added action anticipation before attacks/support actions resolve.
  - Added `triggerAnticipation(direction, durationMs, heavy?)` to `CreatureSpriteHandle`.
  - Added resolved-log state so HP/FP updates land on contact/support timing while dialogue reveals immediately.
- Implemented Skill Identity Pass V1:
  - `triple_hit`: 3-hit staggered impact.
  - `overdrive`: 5-hit faster staggered impact.
  - `power_strike` / `charge_strike`: heavy burst impact and shockwave.
  - Skills show FP spend pips collapsing into actor.
  - `counter_stance` uses longer guard duration.
- Implemented HP/FP HUD feedback:
  - HP shows transient `-N` / `+N`.
  - FP shows transient `+N FP` / `-N FP`.
  - User disliked badge containers, so deltas are now numbers only with dark stroke/shadow/glow.

## Important Files
- `src/hooks/useBattleLogReveal.ts`
- `src/components/ui/CreatureSprite.tsx`
- `src/components/ui/EffectsLayer.tsx`
- `src/components/battle/BattleHudCard.tsx`
- `src/components/battle/BattleParticles.tsx`
- `src/components/battle/BattleArenaDressing.tsx`
- `src/lib/battleAnimationConfig.ts`
- `src/index.css`
- `src/pages/app/BattlePage.tsx`

## Tests Added/Updated
- `src/hooks/__tests__/useBattleLogReveal.test.ts`
- `src/components/ui/__tests__/EffectsLayer.test.tsx`
- `src/components/battle/__tests__/BattleHudCard.test.tsx`
- `src/components/battle/__tests__/BattleParticles.test.tsx`

## Verification Passed
- `npm test -- useBattleLogReveal`
- `npm test -- EffectsLayer`
- `npm test -- BattleHudCard`
- `npm run build`

## Current User Preference
- Prefers lighter, game-feel visual feedback over boxed UI badges.
- Specifically asked for HP/FP feedback to be “numbers only” but still readable.

## Suggested Next Work
- Visual polish pass in-browser:
  - Check HP/FP delta placement against HUD and sprites on mobile/desktop.
  - Tune text stroke/shadow if deltas look too thick.
  - Tune battle action hold durations now that anticipation and skill VFX add more time.
- Possible next gameplay/UX passes:
  - Resolution clarity: better explain crit/block/counter in UI without pretending player can react mid-turn.
  - Pacing tuning: likely reduce `ENTRY_DELAY_ACTION_HIT_MS` from `2600` toward `2200-2400`.

  ## Additional Requested Future Work

### ~~Skill Identity Pass V2~~ — Implemented May 2026

### Layer Battle Particles With Depth
The user also wants biome particles split into depth layers.

Current state:
- `src/components/battle/BattleParticles.tsx` maps arena UUIDs to one particle layer.
- All biome particles render in a single `absolute inset-0` layer with `zIndex: 5`.

Requested direction:
- Split particles into background and foreground layers.
- Use different opacity, speed, scale, and blur per depth layer.
- Keep foreground particle counts lower so HUD and command bar stay readable.
- Avoid adding visual clutter over the bottom command bar.
- Preserve existing biome identities:
  - leaf
  - firefly
  - ash
  - snow
  - ember

Possible implementation:
- Add `depth: 'back' | 'front'` or separate presets per biome.
- Render two containers:
  - back layer behind sprites/platforms, subtle and slower
  - front layer above arena dressing/particles but still pointer-events none
- Consider constraining front particles to the arena center/top rather than full `inset-0`.
