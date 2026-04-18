# Daily Log: Meal-Centric Logging — Product Goal & Scope

> **Purpose:** Baseline for a **gap analysis** (what NutriMon already does vs. what must be designed, built, or migrated).
> **Status:** Draft product intent (not an implementation spec).
> **Related context:** High-level product direction lives in [PRODUCT_PRD.md](./PRODUCT_PRD.md).

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
- **Recipe builders** or **meal planning** beyond what is required to support logging UX.
- **Offline-first** architecture changes (unless required solely because current client assumptions block meal grouping).
- **Brand-new meal taxonomy** beyond what NutriMon already supports—unless required to resolve collisions (for example, two legitimate lunches in one day for shift workers).

### 4.3 Explicit non-goals (for this initiative)

- **Re-skinning** the daily log without changing the underlying **meal container** model.
- **Renaming buttons** alone (for example, “Add to log” → “Add”) if the data and UI still create parallel meal cards.

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

### 6.2 Surfaces

- Daily Log page layout and grouping logic
- Meal logging sheet / modal / quick-add flows
- Any “add to log” affordances and their copy
- Empty states and single-meal states
- Finalized day presentation (if different from active day)

### 6.3 Data model & integrity

- What constitutes a **meal record** vs a **log line** today
- Keys used for **duplicate detection** (if any)
- Snapshot behavior for historical rendering (if applicable)
- Server contracts: inserts, updates, deletes, batching
- RLS and RPC assumptions impacted by grouping or new tables (if any)

### 6.4 Derived calculations

- Meal subtotals vs day totals
- Finalize-day / evaluation pipelines: inputs must remain correct if storage changes

### 6.5 Analytics & instrumentation (if applicable)

- Events tied to “meal created” vs “item added” may need redefinition after grouping

---

## 7. Open questions (intentionally deferred, but tracked for gap analysis)

These should **not block** documenting gaps; they should become **rows marked “decision pending.”**

- Exact rules for **when duplicates merge** vs remain separate lines (brand, preparation, notes, time, serving unit mismatches).
- Whether users can intentionally create **multiple instances** of the same meal type in a day (shift work), and how that appears in UI.
- Whether meal subtotals appear **collapsed** headers only, **always expanded**, or user preference.
- How aggressively to **auto-select meal context** vs require explicit selection.

---

## 8. Document maintenance

When gap analysis findings land, add:

- **Decision log** (dated): merge rules, multi-lunch policy, migration approach
- **Links** to engineering specs or tickets that supersede this document’s ambiguity

---

## Revision history

| Date | Author | Notes |
| --- | --- | --- |
| 2026-04-18 | Product | Initial draft for gap analysis baseline |
