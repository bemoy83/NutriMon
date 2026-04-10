# Sprite System

A guide to adding and registering sprites in NutriMon. All sprite metadata lives in
`src/lib/sprites.ts`; art files live under `public/`.

---

## Folder structure

```
public/
  sprites/
    player/               # Front-facing hub sprites (CreaturePage avatar)
    player_battle/        # Side-profile battle sprites (BattlePage, player corner)
    opponents/            # Opponent battle sprites + recovering variants
    effects/              # One-shot effect PNGs (e.g. hit_impact.png)
  terrain/                # Arena platform PNGs (must conform to the platform spec)
```

---

## Player sprites (hub)

Used on CreaturePage as the creature avatar. Key format: `{stage}_{condition}`.

**Naming:** `public/sprites/player/{stage}_{condition}.png`

**Examples**
```
public/sprites/player/baby_steady.png
public/sprites/player/baby_thriving.png
public/sprites/player/baby_recovering.png
public/sprites/player/adult_steady.png
```

**Register in `sprites.ts` → `PLAYER_SPRITES`:**
```ts
const PLAYER_SPRITES: Partial<Record<string, SpriteDescriptor>> = {
  'baby_steady': {
    url: s('/sprites/player/baby_steady.png'),
    nativeWidth: 256, nativeHeight: 256,
    facing: 'right',
    pixelArt: true,
  },
  // add more entries here
}
```

`getPlayerSpriteDescriptor(stage, condition)` first tries an exact match, then falls back to
`{stage}_steady` for the same stage.

---

## Player battle sprites

Side-profile sprites displayed in the bottom-left corner of the battle arena.
Key format: `{stage}_{condition}`.

**Naming:** `public/sprites/player_battle/{stage}_{condition}.png`

**Register in `sprites.ts` → `PLAYER_BATTLE_SPRITES`:**
```ts
const PLAYER_BATTLE_SPRITES: Partial<Record<string, SpriteDescriptor>> = {
  'baby_steady': {
    url: s('/sprites/player_battle/baby_steady.png'),
    nativeWidth: 256, nativeHeight: 256,
    facing: 'right',
    pixelArt: true,
  },
}
```

`getPlayerBattleSpriteDescriptor(stage, condition)` follows the same exact → steady fallback
logic as the hub sprites.

---

## Opponent sprites

Each opponent has a `battle` sprite (shown during combat) and an optional `recovering` sprite
(shown immediately after the opponent faints). Key is the slugified opponent name.

**Naming:**
```
public/sprites/opponents/{slug}.png           # battle sprite
public/sprites/opponents/{slug}_recovering.png  # post-faint sprite (optional)
```

**Slug format:** lowercase, spaces replaced with underscores.
```
"Pebble Pup"    → pebble_pup
"Cinder Finch"  → cinder_finch
"Mossback Ram"  → mossback_ram
```

**Register in `sprites.ts` → `OPPONENT_SPRITES`:**
```ts
const OPPONENT_SPRITES: Partial<Record<string, OpponentSpriteEntry>> = {
  'pebble_pup': {
    battle: {
      url: s('/sprites/opponents/pebble_pup.png'),
      nativeWidth: 256, nativeHeight: 256,
      facing: 'right', pixelArt: true,
    },
    recovering: {                               // optional — omit to skip recovery sprite
      url: s('/sprites/opponents/pebble_pup_recovering.png'),
      nativeWidth: 256, nativeHeight: 256,
      facing: 'right', pixelArt: true,
    },
  },
}
```

- `getOpponentSpriteDescriptor(name)` → `.battle`
- `getOpponentRecoverySpriteDescriptor(name)` → `.recovering ?? null`

---

## Hit impact effect

A single PNG displayed on the target sprite for ~350 ms when an attack lands.

**File:** `public/sprites/effects/hit_impact.png`

No registration needed — the path is hardcoded in `HIT_IMPACT_URL` at the top of `sprites.ts`.
To disable the effect entirely, set `HIT_IMPACT_URL` to `null`.

```ts
const HIT_IMPACT_URL: string | null = s('/sprites/effects/hit_impact.png')
```

---

## Terrain — arena platform PNGs

Each arena can have two platform images: one positioned under the player sprite and one under
the opponent sprite. Both images **must conform to the platform spec** so the automatic
positioning math works correctly.

### Platform image spec

| Property | Value |
|---|---|
| Canvas size | **512 × 240 px** with alpha channel |
| Oval center X | **297 px** from left (≈ 58%) |
| Oval walkable surface Y | **97 px** from top (≈ 40%) |

Export your platform PNG at exactly 512 × 240 px and place the walkable oval surface at those
coordinates. The compute functions handle the rest.

### Registering a new arena

Add an entry to `ARENA_TERRAIN` in `sprites.ts` keyed by the arena UUID:

```ts
const ARENA_TERRAIN: Partial<Record<string, TerrainDescriptor>> = {
  'ca277fd4-1dd0-4e6e-a50b-c95bbd878395': {
    playerPlatformUrl:     s('/terrain/arena_2_player_platform.png'),
    playerPlatformStyle:   computePlayerPlatformStyle(320),   // rendered width in px

    opponentPlatformUrl:   s('/terrain/arena_2_opponent_platform.png'),
    opponentPlatformStyle: computeOpponentPlatformStyle(224), // rendered width in px
  },
}
```

`computePlayerPlatformStyle(renderedWidth)` and `computeOpponentPlatformStyle(renderedWidth)`
automatically derive `left`/`right`/`top`/`bottom` CSS values from the spec constants — no
manual pixel tuning needed.

The `renderedWidth` values (e.g. 320 px player, 224 px opponent) control how large the platform
appears on screen. Adjust them to taste; the oval will stay centered under the corresponding
sprite regardless of the value chosen.

### Background gradient

`useTerrainBackground(playerPlatformUrl)` (used inside BattlePage) automatically samples the
grass/ground colours from the platform image via Canvas API and derives a matching 4-stop CSS
gradient for the arena background. No extra configuration required.

---

## SpriteDescriptor reference

```ts
interface SpriteDescriptor {
  url: string
  nativeWidth: number
  nativeHeight: number
  /** Direction the art faces in the source file */
  facing: 'right' | 'left'
  /** true = enable pixelated rendering (pixel art). false/omit = smooth. */
  pixelArt?: boolean
}
```

Set `pixelArt: true` for pixel art sprites so the browser uses nearest-neighbour scaling
instead of bilinear interpolation.

Set `facing` to match the direction the creature faces in the source file. `CreatureSprite`
uses this alongside the `flip` prop to decide whether to apply `scaleX(-1)`.

---

## Fallback behaviour

If a sprite is not registered (or the PNG has not been added yet), `CreatureSprite` renders an
SVG blob silhouette placeholder in `var(--app-surface-muted)`. No broken images, no 404s.
