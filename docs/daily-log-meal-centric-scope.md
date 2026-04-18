# Daily Log: Meal-Centric Logging — Product Goal & Scope

> **Purpose:** Baseline for a **gap analysis** (what NutriMon already does vs. what must be designed, built, or migrated).
> **Status:** Draft product intent (not an implementation spec). **Implementation fork:** structural meal slots (**Option B**) — see §8 decision log. **Food model:** mass + piece/weight servings + composite foods — §4.4.
> **Related context:** High-level product direction lives in [PRODUCT_PRD.md](./PRODUCT_PRD.md). Current Daily Log implementation map: [daily-log-current-implementation.md](./daily-log-current-implementation.md). Gap matrix (requirements vs. as-built): [daily-log-meal-centric-gap-matrix.md](./daily-log-meal-centric-gap-matrix.md). **Technical spec (implementation):** [daily-log-meal-slots-technical-spec.md](./daily-log-meal-slots-technical-spec.md).

---

## 1. Problem statement

Today, logging often behaves like **repeated “add to log” events**, which surface as **multiple parallel cards for the same meal type** (for example, several “Lunch” blocks). In practice, users assemble one meal across **multiple weigh → log → add cycles**, so the UI **fragments a single real-world meal** into separate cards.

That fragmentation creates clear user pain:

- **No trustworthy meal-level totals** when a meal spans multiple cards (users must mentally sum).
- **Higher cognitive load** when reviewing or editing “what I ate for lunch.”
- **Category misalignment**: established trackers treat a meal as a **container** with **line items**, not as **one card per logging gesture**.

---

## 2. Product goal

**Users should be able to build a meal incrementally (many logging steps) while the daily log presents that meal as a single, coherent unit under one meal header—with accurate meal-level nutrition totals.**

NutriMon should **mimic the established pattern** seen in apps like **MyFitnessPal**:

- A **meal slot** (for example, Lunch) appears **once** as a **header / section** for a given day.
- **All foods logged to that meal** appear as **line items beneath that header**.
- **Multiple servings of the same food** are represented as **either**:
  - **one line with increased quantity / servings**, **or**
  - **multiple lines** (if we later decide that better fits edge cases),

  **but never** as **multiple parallel “Lunch” containers** created accidentally by normal logging.

### 2.1 User outcomes we optimize for

- **Scannable meals:** “What did I eat for lunch?” is answered in **one place**.
- **Correct meal math:** calories (and macros where shown) **subtotal per meal** match the sum of line items.
- **Low-friction multi-step logging:** weighing and adding in several steps should **not** punish the user with duplicate meal sections.
- **Clear per-food consumption:** users can answer “how much of *this item* did I have?” **without scanning duplicate rows**—**default direction is to merge compatible duplicates into quantity** (exact merge rules remain to be validated in usability testing).

---

## 3. Success criteria (product-level)

These are intended to be **testable in UX and QA**, independent of implementation:

1. **Single meal header:** For a standard day, each default meal type (Breakfast, Lunch, Dinner, Snacks—or NutriMon’s equivalent) appears **at most once** as a **top-level meal section** unless the user **explicitly** creates an additional meal instance (if we offer that at all).
2. **Incremental assembly:** A user can perform **N add actions** into Lunch and still see **one Lunch section** with **N line items** (or fewer if merged), not **N Lunch sections**.
3. **Meal subtotals:** Lunch shows **subtotals** that equal the sum of its line items (within normal rounding expectations).
4. **No regressive day totals:** Day-level totals remain consistent with the underlying logged nutrition (meal grouping is primarily **presentation + aggregation**, not “losing” intake).
5. **Editability:** Users can **edit, remove, or move** individual line items (and optionally entire meals) without breaking the mental model of “one lunch.”

---

## 4. Scope

### 4.1 In scope (for gap analysis coverage)

**Daily Log presentation**

- **Meal sections** with **line items**, **meal subtotals**, and a **day total** consistent with current product promises.
- **Elimination of accidental duplicate meal-type cards** caused by repeated adds during normal use.

**Logging workflow alignment**

- **Meal targeting:** logging flows should make it explicit or reliably inferred **which meal slot** an item is being added to, so items **append** to the correct meal container.
- **Composition-friendly flows:** patterns that support “add another item to this meal” without returning the user to a fragmented diary state between items (exact interaction model TBD).

**Duplicate line handling (directional)**

- **Default expectation:** compatible duplicate entries **merge into quantity** on one line to reduce scanning burden, pending validation in practice.
- Gap analysis should inventory whether duplicates are currently **possible**, **likely**, and how they are **keyed** (food identity, meal type, serving definition, timestamps, snapshots, etc.).

**Migration / compatibility mindset**

- How existing logged data maps to the new presentation (same-day history, edits, undo, repeats, snapshots) must be identified in gap analysis—even if the answer is “no migration needed” or “soft merge at render time.”

### 4.2 Out of scope (unless gap analysis reveals hard dependencies)

- **Net-new nutrition science**, new macro models, or new targets logic.
- **Social / sharing** of meals.
- **Full recipe-builder / meal-planning product** (shopping lists, weekly plans, social recipe feeds)—**not** the same as **composite food definition** in §4.4, which **is in scope** where it supports logging, reuse, and export/import.
- **Offline-first** architecture changes (unless required solely because current client assumptions block meal grouping).
- **Brand-new meal taxonomy** beyond what NutriMon already supports—unless required to resolve collisions (for example, two legitimate lunches in one day for shift workers).

### 4.3 Explicit non-goals (for this initiative)

- **Re-skinning** the daily log without changing the underlying **meal container** model.
- **Renaming buttons** alone (for example, “Add to log” → “Add”) if the data and UI still create parallel meal cards.

### 4.4 Composite foods, mass, and servings (locked product decisions)

These rules extend the meal-centric goal and apply to **simple and composite (“recipe”) foods**. They are intended to drive schema, logging UX, and export/import later.

**Mass**

- **Mass is the primary input** for ingredients and for calorie and nutrient derivation where the model ties nutrients to amount consumed.
- **All foods contribute mass** to the food’s (and, when logged, the meal’s) total mass basis for aggregation and for **per-100g** (or density-style) math, unless a future edge case is explicitly excluded in implementation (e.g. pure volume-only entries should still resolve to a mass basis for consistency).

**Servings at food creation**

- Each food is created with a **defined serving model**: **by weight** (relationship to total recipe / product mass) and/or **by pieces** (e.g. this pizza is **8 slices**; one sandwich is **1 unit**).

**Logging (two paths, both valid)**

1. **Discrete serving count** — e.g. **1 sandwich** = **1/1** of that food’s reference; **1 slice of pizza** = **1/8** of that food when the food was defined as 8 slices.
2. **Weigh an arbitrary portion** — e.g. a slice (if user weighs it), a plate, or a portion of spaghetti: **scale nutrition from that food’s totals using mass**, typically via **calories and nutrients per 100 g** (and the same basis for macros), derived from the food’s total nutrition and total mass at definition time.

**Composite foods and recipes**

- A composite food is built from **ingredients** (each ingredient has mass as primary input); rolled-up nutrition and total mass define the **single selectable food** (e.g. a specific pizza).
- **Changing ingredients updates the composite food definition for future use only.** Past log lines keep **snapshot** nutrition (and mass basis as stored on the line) so history does not rewrite when the recipe changes.

---

## 5. Competitive reference pattern (locked for this document)

NutriMon should align with the **MyFitnessPal-class pattern**:

- **Meal header once per meal slot**
- **Line items beneath**
- **Duplicate foods:** merged quantity **or** multiple lines **only when intentionally justified**, but **never** “multiple Lunch cards” as the default outcome of normal logging.

---

## 6. Gap analysis inventory checklist (what this document expects you to compare)

Use the sections below as **row headers** in a gap matrix: **Current behavior / data / UI / API / analytics / tests** vs **Required behavior**.

### 6.1 User journeys

- Add first item to Lunch
- Add second item to Lunch immediately after
- Add item via weigh flow, then another via search, then another via recents
- Edit quantity on a merged duplicate line
- Delete one line item vs delete entire meal
- Change meal assignment for a line item (if supported)
- Repeat meal / copy prior day patterns (if present)
- Undo flows (if present)
- **Composite food (§4.4):** create food from ingredients; log by **piece** (e.g. 1/8 slice) or by **weighed portion** (scale vs per-100g); edit recipe affects **future logs only** (snapshots on past lines)

### 6.2 Surfaces

- Daily Log page layout and grouping logic
- Meal logging sheet / modal / quick-add flows
- Any “add to log” affordances and their copy
- Empty states and single-meal states
- Finalized day presentation (if different from active day)

### 6.3 Data model & integrity

- What constitutes a **meal record** vs a **log line** today
- **Food / product** model: simple vs **composite** (ingredient list, total mass, per-100g and piece servings)—see §4.4
- Keys used for **duplicate detection** (if any)
- Snapshot behavior for historical rendering (if applicable); **composite definition changes do not rewrite past `meal_items` snapshots** (§4.4)
- Server contracts: inserts, updates, deletes, batching
- RLS and RPC assumptions impacted by grouping or new tables (if any)

### 6.4 Derived calculations

- Meal subtotals vs day totals
- Finalize-day / evaluation pipelines: inputs must remain correct if storage changes

### 6.5 Analytics & instrumentation (if applicable)

- Events tied to “meal created” vs “item added” may need redefinition after grouping

---

## 7. Product decisions (Q1–Q4) and remaining open items

### 7.1 Resolved — logging, slots, and diary UX (2026-04-18)

**Q1 — Duplicate lines vs. one summary (e.g. two glasses of milk at breakfast)**  
**Decision:** When the user logs the **same food twice** into the **same meal slot** in a way that is **nutritionally identical** (same catalog or user product and **compatible snapshots** per [technical spec](./daily-log-meal-slots-technical-spec.md) §8), **merge into one line** by **summing quantity**. That yields a **single “milk consumed” summary** on the diary (one row, combined servings). Intentionally different lines (e.g. two different milks, or same product with meaningfully different snapshots) stay **separate**. Composite foods treated as distinct products are **not** “duplicates” of their ingredients.

**Q2 — Multiple standard meals of the same type in one day (e.g. two lunches)**  
**Decision:** **v1:** follow structural-slot default — **no second `Lunch` row** for the same day. Users who need a second occasion use **`Snack`**, **`Other`**, or a **later product iteration** (user-defined meals / `slot_instance`) — explicitly **out of v1**.

**Q3 — Meal subtotals visibility**  
**Decision:** **Always show** meal-level **calories** and **macros (carbs, fat, protein)** for each meal section — **not** hidden behind expand-only affordances. (Implementation: e.g. header or summary strip always visible; line detail may still expand/collapse.)

**Q4 — How to choose which meal slot to log into**  
**Decision for v1:** **Time-of-day default**, same idea as today’s `getDefaultMealType` — suggested slot follows clock. **Refinement** (stronger auto-targeting, “continue last slot,” explicit picker emphasis) deferred until **usage-informed** iteration.

### 7.2 Remaining open (low blocking)

- **Analytics:** whether and how to emit “meal created” vs “item added” after append-style logging (see gap matrix A1).
- **Split line / un-merge:** if users need two visually separate milk lines with a roll-up summary, that is **not** v1 — v1 is **merge to one line** per Q1.

**Resolved elsewhere:** mass-first and piece/weight logging (**§4.4**); composite edits → future only (**§4.4**); implementation fork **Option B** (**§8**).

---

## 8. Document maintenance

When gap analysis findings land, add:

- **Decision log** (below), [technical spec](./daily-log-meal-slots-technical-spec.md), and links to tickets that supersede ambiguity.

### 8.1 Decision log

| Date | Decision | Notes |
| --- | --- | --- |
| 2026-04-18 | **Structural meal slots (Option B)** | Canonical **one container per meal slot per day** (details, second-lunch policy, migration: gap matrix + engineering spec). Supports reuse, export/import, and clear “append line to this lunch” semantics vs. accidental parallel same-type cards. |
| 2026-04-18 | **Food model: mass + servings + composites** | **§4.4**: all foods contribute mass; servings at create time (weight and/or pieces); log by count or by weigh; recipe edits update definition for **future logs only**; past lines stay on snapshots. |
| 2026-04-18 | **Q1–Q4** | **§7.1:** merge duplicate identical-food lines in-slot for one summary; v1 no second standard slot; meal P/C/F + kcal always visible; meal target default = time-of-day. |

---

## Revision history

| Date | Author | Notes |
| --- | --- | --- |
| 2026-04-18 | Product | Initial draft for gap analysis baseline |
| 2026-04-18 | Product | §4.4: mass, piece/weight servings, log paths, composite edits → future only |
| 2026-04-18 | Product | §4.2 clarified vs §4.4; §6 journeys/model bullets; §7 vs §4.4; §8.1 decision log (fork B) |
| 2026-04-18 | Product | Link [daily-log-meal-slots-technical-spec.md](./daily-log-meal-slots-technical-spec.md); §8 maintenance |
| 2026-04-18 | Product | §7: Q1–Q4 resolved (merge milk-style dupes; v1 slot policy; visible subtotals; time-of-day slot default) |
