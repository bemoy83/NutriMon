# NutriMon Creature Gamification Direction

> Purpose: define the Phase 2 creature system before implementation.
> Scope: product direction, feature definition, and system design boundaries.
> Context sources: `PRODUCT_PRD.md`, `IMPLEMENTATION_PLAN.md`, current MVP code.

---

## 1. Why This Exists

The MVP proves the behavior loop:

`log -> finalize -> feedback -> streak -> visible stats`

The current creature implementation is intentionally minimal:

- fixed `baby` stage
- four derived stats
- one streak teaser
- no persistent identity
- no progression memory beyond raw streak metrics

That is enough for MVP validation, but not enough to make the companion feel meaningful over time.

Phase 2 should deepen attachment and motivation without turning NutriMon into a separate game.

The creature system must make progress feel:

- visible
- emotionally legible
- persistent
- connected to behavior

It must not create chores, punishment loops, or a second economy.

---

## 2. Product Direction

### Core Position

The creature is not a minigame.
It is the primary visual translation layer between nutrition behavior and motivation.

### What The Creature Must Do

- give users a reason to care about consistency beyond calorie totals
- create visible movement between major evolution milestones
- preserve a sense of earned progress even when a streak breaks
- preview future battle readiness without requiring battles yet
- make daily finalization feel rewarding

### What The Creature Must Not Do

- require separate maintenance actions such as feeding, tapping, or chores
- regress evolutions after missed days
- shame the user through “injured”, “dying”, or similar punitive states
- depend on weight logging
- introduce currencies, inventories, or grind systems in Phase 2

---

## 3. Key Product Decisions

### 3.1 Evolution Is Permanent

Recommended rule:

- `baby` unlocks on first completed creature state
- `adult` unlocks permanently when the user first achieves a 7-day qualifying streak
- `champion` unlocks permanently when the user first achieves a 30-day qualifying streak

Why:

- permanent unlocks preserve accomplishment
- losing an evolved form due to one bad week is too punitive
- stage permanence is emotionally stronger than pure streak mirroring

Short-term setbacks should change the creature’s condition, readiness, and next-goal progress, not erase identity.

### 3.2 Keep One Core Companion

Phase 2 should keep one canonical companion per user.

Do not add:

- multiple creatures
- team composition
- creature swapping
- player archetype selection

Why:

- one companion concentrates attachment
- it keeps product language simple
- it avoids locking in battle balance decisions before the battle system exists

### 3.3 Add Persistent Identity

The creature needs a stable identity layer, not just daily stat snapshots.

Minimum identity features:

- user-chosen or generated creature name
- hatched date
- current permanent stage
- evolution timestamps
- current visual form key

Why:

- users attach to named companions
- identity makes evolution feel like continuity, not just a UI card refresh

### 3.4 Separate Long-Term Progress From Short-Term Condition

The current MVP mixes all meaning into four stats.

Phase 2 should split creature state into:

- long-term progression: permanent stage and milestone history
- short-term condition: how the creature is doing right now
- numeric capability: current stats derived from behavior

This avoids overloading the raw stat bars with every kind of meaning.

---

## 4. Recommended Creature Model

The creature should have four layers of meaning.

### 4.1 Identity Layer

Stable companion identity.

Fields:

- name
- stage
- hatched_at
- evolved_to_adult_at
- evolved_to_champion_at
- visual_form_key

### 4.2 Progression Layer

Shows where the user is in the evolution journey.

Fields:

- next_evolution_target
- next_evolution_streak_requirement
- current_streak_progress
- current_stage_progress_pct
- lifetime_milestone_count

Important:

- evolution progress toward the next stage can reset with streak loss
- unlocked stages do not regress

### 4.3 Condition Layer

The creature’s current emotional and readiness expression.

Recommended states:

- `thriving`
- `steady`
- `recovering`
- `quiet`

Meaning:

- `thriving`: recent behavior is strong and streak is healthy
- `steady`: acceptable consistency, no strong negative signal
- `recovering`: recent drift, but still active and recoverable
- `quiet`: missing recent logs or very low momentum

Why this works:

- supportive and readable
- expressive without punishment framing
- useful for UI art states and copy tone

### 4.4 Capability Layer

Keep the four existing creature stats as the core numeric system:

- strength
- resilience
- momentum
- vitality

These remain the bridge to future readiness and battle systems.

---

## 5. Recommended Phase 2 Features

### 5.1 Evolution Track

Add a persistent evolution track on the creature page:

- `baby -> adult -> champion`
- highlight unlocked stages
- show current stage
- show exact next requirement
- if the next stage is streak-gated, show current run progress explicitly

Why:

- the user always understands what the system is asking for
- the gap between 7 and 30 days becomes more legible

### 5.2 Growth Between Evolutions

Users need movement before major stage unlocks.

Add intra-stage growth signals:

- progress bar toward next evolution
- evolving copy based on current streak
- visual form variations or pose intensity inside a stage

Do not add extra stage labels.
Keep the permanent stage model as `baby | adult | champion`.

Why:

- it creates motion without expanding the formal stage taxonomy
- it respects the implementation decision to avoid multi-stage complexity

### 5.3 Creature Naming

Allow the user to name the companion.

Rules:

- optional but surfaced clearly
- default generated fallback if skipped
- editable later from creature/profile

Why:

- very high attachment value
- low engineering complexity

### 5.4 Daily Creature Reaction

Daily finalization should return a creature reaction payload, not only generic feedback.

The user should see:

- today’s status
- stat deltas or “held steady”
- streak change
- whether readiness improved or dropped
- distance to next evolution

Why:

- this directly connects logging behavior to creature payoff
- the reward should happen at the end of the action loop, not only on a separate screen

### 5.5 Condition + Readiness

Add a lightweight readiness layer now, even before battles.

Recommended outputs:

- readiness score `0..100`
- readiness band:
  - `recovering`
  - `building`
  - `ready`
  - `peak`

Why:

- it gives the stats a combined meaning
- it creates anticipation for future battle systems
- it gives the creature page a simple headline metric beyond raw bars

### 5.6 Creature Journal

Add a chronological milestone timeline.

Initial event types:

- first hatch
- first qualifying day
- longest streak updated
- evolved to adult
- evolved to champion
- 7-day logged week
- comeback after quiet period

Why:

- users remember stories better than numbers
- event history preserves progress memory even when streaks reset

This should be an append-only event log, not recomputed UI text only.

---

## 6. What Should Drive The Creature

The creature should continue to be driven exclusively by nutrition behavior inputs already in scope:

- finalized daily evaluation
- adjusted adherence
- streak metrics
- rolling behavior attributes

The creature should not depend on:

- weight entries
- manual care actions
- micro-interactions
- arbitrary experience points disconnected from behavior

This preserves the product thesis.

---

## 7. Recommended Calculation Direction

The current stat mapping is good enough to keep:

- strength <- consistency
- resilience <- stability
- momentum <- short-window momentum
- vitality <- streak-derived vitality

Phase 2 should add two new derived outputs.

### 7.1 Condition

Condition is for communication and art state, not balance precision.

Recommended directional logic:

- `thriving` when recent status is strong and current streak is building
- `steady` when recent behavior is acceptable and not declining meaningfully
- `recovering` when recent behavior dipped but logging is still active
- `quiet` when recent logging is missing or momentum is weak

This logic can start simple and be tuned later.

### 7.2 Readiness

Readiness should be a composite of existing stats, normalized to `0..100`.

Recommended formula direction:

```text
normalized_vitality = clamp((vitality - 50), 0, 100)

readiness_score =
  strength   * 0.30 +
  resilience * 0.20 +
  momentum   * 0.20 +
  normalized_vitality * 0.30
```

Recommended bands:

- `peak` >= 90
- `ready` 75-89
- `building` 50-74
- `recovering` < 50

Notes:

- this is not yet opponent-specific readiness
- opponent matchup readiness can be added later on top of this baseline

---

## 8. UX Direction

### 8.1 Creature Page Should Become A Status Hub

Recommended sections:

1. Companion hero
2. readiness + condition summary
3. evolution track
4. stat bars
5. recent creature journal

The hero section should show:

- creature art
- name
- permanent stage
- condition label
- current streak
- next evolution target

### 8.2 Daily Log Should Surface The Creature More Often

The creature should not live only on `/app/creature`.

Recommended additions:

- compact creature presence in the daily log header or finalize state
- post-finalize summary card with creature impact
- explicit progress language such as “2 more qualifying days to evolve”

### 8.3 Feedback Copy Should Be Creature-Aware

Daily feedback should remain supportive, but Phase 2 copy should reference the creature state when appropriate.

Examples of supported message types:

- progress reinforcement
- recovery encouragement
- evolution proximity
- readiness improvement

Do not turn feedback into fantasy roleplay.
The product tone must stay grounded and subtle.

---

## 9. System Design Direction

### 9.1 Keep `creature_stats` As Daily Snapshots

The existing `creature_stats` table is useful and should remain the historical numeric record.

Do not overload it with all persistent identity and progression state.

### 9.2 Add A Persistent Companion Table

Recommended new table:

`creature_companions`

Suggested fields:

- `user_id` primary key / unique
- `name`
- `stage`
- `visual_form_key`
- `condition`
- `readiness_score`
- `readiness_band`
- `hatched_at`
- `evolved_to_adult_at`
- `evolved_to_champion_at`
- `last_snapshot_date`
- `created_at`
- `updated_at`

Why:

- one row expresses the current canonical creature state
- stage permanence belongs here, not in daily snapshots
- it simplifies UI reads for the latest creature overview

### 9.3 Add A Creature Event Log

Recommended new table:

`creature_events`

Suggested fields:

- `id`
- `user_id`
- `event_date`
- `event_type`
- `title`
- `body`
- `metadata jsonb`
- `created_at`

Initial event types:

- `hatched`
- `streak_started`
- `longest_streak`
- `condition_changed`
- `evolved_adult`
- `evolved_champion`
- `comeback`

Why:

- supports timeline UI
- preserves history
- avoids brittle reconstruction from derived snapshots later

### 9.4 Prefer Server-Side Creature State Updates

All creature progression logic should continue to run in trusted backend logic.

Recommended ownership:

- `finalize-day` remains the primary mutation boundary
- it computes evaluation, habit metrics, behavior attributes, daily creature stats
- then updates `creature_companions`
- then appends any `creature_events`

Do not move evolution logic into the client.

### 9.5 Return A Unified Creature Overview Contract

The frontend will outgrow separate ad hoc queries for latest stats and metrics.

Recommended read contract:

`get_creature_overview(user_id)` via RPC or a view-backed query

Should return:

- companion identity
- latest stats snapshot
- latest habit metrics
- readiness and condition
- next evolution target
- recent events

Why:

- fewer round trips
- one backend-owned interpretation of creature state
- easier UI consistency across pages

---

## 10. Recommended Rollout Sequence

### Phase 2A: Attachment + Readability

Build first:

- persistent companion record
- naming
- permanent evolution unlocks
- evolution track UI
- condition state
- post-finalize creature reaction summary

This is the highest-value product layer.

### Phase 2B: Memory + Retention

Build next:

- creature event journal
- milestone cards
- more expressive stage/condition visuals

This deepens emotional continuity.

### Phase 2C: Battle Preparation Hooks

Build after the above:

- readiness score and readiness band
- readiness copy and “not ready / building / ready” framing
- API shapes that can later plug into opponent comparison

This prepares for Phase 3 without forcing battle implementation early.

---

## 11. Risks To Avoid

### Risk: Treating Streak As The Only Form Of Progress

If all visible progression resets emotionally with a broken streak, the system becomes demotivating.

Mitigation:

- permanent stage unlocks
- event history
- supportive recovery state

### Risk: Over-Gamifying The Experience

If the creature demands actions outside logging, the product loop becomes noisy.

Mitigation:

- no chores
- no separate energy economy
- no consumables

### Risk: Premature Creature Archetypes

If user creature classes are introduced before battle design is stable, the product may inherit bad balance constraints.

Mitigation:

- defer player archetypes
- keep one core companion now

### Risk: Too Many Hidden Formulas

If the user cannot understand why the creature changed, the system loses trust.

Mitigation:

- show clear progress explanations after daily finalization
- use readable labels for readiness and condition
- keep raw stat meanings visible

---

## 12. Final Recommendation

The next version of the creature system should be built around this principle:

**The companion must become a persistent, expressive record of consistency, not just a daily stat card.**

The most important decisions are:

1. make evolution permanent
2. add persistent creature identity
3. separate long-term stage from short-term condition
4. show creature impact immediately after daily finalization
5. preserve server-side ownership of progression logic

If Phase 2 does those five things well, NutriMon gains a much stronger motivational system without compromising the product’s behavior-first foundation.
