# NutriMon Battle UX Handoff

## Recent Work Completed
- Implemented Arena Layer Competition Pass V1:
  - Split biome particles into back and front depth layers.
  - Constrained foreground particles away from fixed top HUD and bottom command bar zones.
  - Added combat-active dimming for particles and ambient arena dressing while actions resolve.
  - Added BattleParticles tests for depth layers, foreground safe zones, and combat dimming.
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

### Skill Identity Pass V2
The user wants stronger per-skill signatures beyond the V1 pass. Current V1 improved timing and differentiated some effects, but the requested direction is more specific:

- `triple_hit`
  - Three directional slashes.
  - Prefer separate damage ticks if the battle log/model can support it visually.
- `power_strike`
  - Larger pause before impact.
  - Heavier shake.
  - Wider ground shockwave.
- `regen`
  - Green particles orbit inward before the heal number appears.
- `charge_strike`
  - Focus pips visibly fly into the player before impact.
- `counter_stance`
  - Shield should persist until the counter triggers, not just flash briefly.
  - Likely needs persistent stance state derived from revealed/resolved log or battle session flags.
- `overdrive`
  - Five fast afterimages/streaks.
  - One combined damage total.

Implementation note:
- Keep the shared battle animation system.
- Avoid combat math changes unless needed for visual state only.
- Current relevant files:
  - `src/hooks/useBattleLogReveal.ts`
  - `src/components/ui/EffectsLayer.tsx`
  - `src/components/ui/CreatureSprite.tsx`
  - `src/lib/battleAnimationConfig.ts`
  - `src/index.css`

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
