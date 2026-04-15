# Handoff: QuickAddSheet — Cart Footer Redesign

## Problem

The "Add meal" sheet (`QuickAddSheet`) shows a **pending items tray** inline inside
the scrollable content area. Every selected item adds ~52px of height to the tray,
compressing the food list from above. By 3–4 selections the list is effectively
unusable. The sheet is fixed at `85vh` on mobile — there is no room to grow.

The fix: **remove the tray from the content column entirely**. Selection state lives
in a cart bar attached to the existing footer, never touching the food list height.

---

## Files to Modify

| File | Role |
|---|---|
| `src/features/logging/QuickAddSheet.tsx` | All logic and layout changes live here |
| `src/components/ui/BottomSheet.tsx` | Read-only reference — do not modify |
| `src/components/ui/GramInput.tsx` | Read-only reference — reuse as-is |

No new files are required. Do not modify BottomSheet.tsx.

---

## Current Layout (what to remove)

In `QuickAddSheet.tsx`, lines 188–236 render the pending items tray:

```tsx
{/* Pending items tray — DELETE THIS ENTIRE BLOCK */}
{pendingItems.length > 0 && (
  <div className="px-4 py-2" style={{ background: mealTheme?.bg ?? '...' }}>
    ...{pendingItems.map(...GramInput rows)}...
  </div>
)}
```

This block sits between `<MealTypeSelector>` and `<SegmentedTabs>` in the children
passed to `<BottomSheet>`. Removing it is the first step.

---

## New Layout

### 1. Food list — no changes

`activeProducts` list, `ProductRow`, selected/unselected toggle button — all
unchanged. The `isAdded` check (line 319) already provides visual feedback in the
list itself (filled checkmark vs. `+` button). That is sufficient.

### 2. Cart bar in the footer

Replace the current `footer` prop (lines 163–182) with a new structure:

```
[ footer area — rendered by BottomSheet in a sticky white panel ]
  ┌─────────────────────────────────────────────────────┐
  │  [cart bar — visible only when pendingItems > 0]    │
  │    "3 items · 740 kcal"          [chevron-up icon]  │
  ├─────────────────────────────────────────────────────┤
  │  [error line — if addError]                         │
  │  [primary CTA button]                               │
  └─────────────────────────────────────────────────────┘
```

The cart bar is a single-row button. Tapping it toggles `cartOpen` state (see §3).

**Cart bar spec:**
- Left side: `"{n} item{s} · {totalKcal} kcal"` — same calorie formula as the
  removed tray (line 204–209)
- Right side: chevron-up icon (rotates to chevron-down when cart is open)
- Background: `mealTheme.bg` (same theming as the old tray used)
- Text color: `mealTheme.text`
- Only renders when `pendingItems.length > 0`

### 3. Cart editor — inline expansion above the footer

Add a new boolean state: `const [cartOpen, setCartOpen] = useState(false)`.

When `cartOpen` is true, render a panel **above** the footer (but outside
`BottomSheet`'s footer slot — see implementation note below). This panel shows
the `GramInput` rows, identical to what the old tray showed.

**Cart editor spec:**
- Position: fixed, sits just above the footer panel, full width, max-width matches
  the sheet (`sm:max-w-lg`)
- Z-index: `z-50` (same as the sheet)
- Background: same frosted glass as the sheet —
  `bg-[rgb(255_255_255/0.92)] backdrop-blur-xl`
- Top border: `border-t border-[var(--app-border)]`
- Content: same `{pendingItems.map(...)}` rows with `GramInput` and remove button
  as the old tray. Reuse the identical JSX.
- Max-height: `max-h-48 overflow-y-auto` — prevents the editor from covering the
  entire sheet on large selections
- Auto-close: when `pendingItems` drops to 0, set `cartOpen` to false

**Implementation note — positioning:**

The BottomSheet `footer` slot renders inside the sheet's flex column. There is no
clean slot for "above the footer but outside the scroll area." The simplest
approach: render the cart editor as a **sibling of `<BottomSheet>`** in
`QuickAddSheet`'s return, positioned fixed/absolute and aligned to bottom of
viewport (or sm: centered modal). Use the same responsive classes the sheet itself
uses:

```tsx
return (
  <>
    <BottomSheet ...footer={cartBar + errorLine + ctaButton}>
      {/* content — no tray */}
    </BottomSheet>

    {cartOpen && pendingItems.length > 0 && (
      <div className="fixed inset-x-0 bottom-[footer-height] z-[51] sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2 ...">
        {/* GramInput rows */}
      </div>
    )}
  </>
)
```

The footer height is approximately `80px` (padding + button height). Use
`bottom-20` as a safe approximation, or measure via a ref if precision is needed.

Alternatively: promote the cart editor into the `footer` prop above the cart bar
using a conditional — both approaches are acceptable. Choose whichever keeps the
JSX cleaner.

---

## State changes

| State var | Change |
|---|---|
| `pendingItems` | No change |
| `adding` | No change |
| `addError` | No change |
| `mealType` / `mealTheme` | No change |
| `cartOpen` | **New** — `boolean`, default `false` |

Side effect: when `pendingItems` transitions from `n > 0` to `0`, reset
`cartOpen` to `false`. A `useEffect` watching `pendingItems.length` is the
cleanest way.

---

## Behavior rules

| Trigger | Result |
|---|---|
| User selects first food item | Cart bar appears in footer |
| User taps cart bar | `cartOpen` toggles |
| User removes item in cart editor | GramInput row disappears; if last item, cart editor + bar both disappear |
| User taps `+` on already-added item in list | Removes from `pendingItems` (existing behavior via `onRemove`) |
| User taps outside cart editor (backdrop) | No change — cart editor has no backdrop; it closes only via the cart bar button |
| `pendingItems` drops to 0 from anywhere | `cartOpen` → `false`, cart bar disappears, footer returns to hint text |
| `addError` | Error line appears above CTA button as before |

---

## Footer copy (unchanged logic, new conditions)

```
pendingItems.length === 0  →  "Tap a food to add it" hint + disabled "Add to log" button
pendingItems.length > 0    →  cart bar + (no hint) + "Add {n} item{s} to log" button
adding                     →  button text "Adding…", disabled
```

---

## What NOT to change

- `ProductRow` component — no changes
- `TemplateRow` component — no changes
- `BottomSheet` component — do not touch
- `GramInput` component — reuse as-is
- `handleConfirm`, `handleLogTemplate`, `handleDeleteTemplate` — no changes
- Calorie formula — copy from line 204–209 verbatim
- `MealTypeSelector` position — stays at top of content, unchanged

---

## Acceptance criteria

1. Selecting 1–10 food items does not reduce the visible height of the food list
   at all.
2. Cart bar appears in the footer when ≥ 1 item is selected, showing correct
   item count and calorie total.
3. Tapping the cart bar opens the editor showing all pending items with working
   GramInput controls.
4. Removing all items via the cart editor collapses the editor and the cart bar.
5. Removing an item via the list's checkmark button (toggling off) also updates
   the cart editor correctly.
6. On mobile (< sm breakpoint): cart editor sits above the footer, scrollable
   if > 4 items.
7. On desktop (≥ sm breakpoint): layout is consistent — cart editor sits above
   the footer within the modal bounds.
8. No regressions on the Saved templates tab or Create tab flows.
