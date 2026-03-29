# NutriMon - Product PRD

> **Status:** Current product source of truth.
> **Implementation source of truth:** `IMPLEMENTATION_PLAN.md`
> **Supersedes:** `nutrimon_master_prd_v2_0.md`, `nutrimon_master_prd_v1_9.md`, and earlier CalTrack-era PRDs

---

# 1. Product Identity

## Product Name
NutriMon

## Meaning
- Nutri -> Nutrition
- Mon -> Monitor / Companion

## Positioning
A behavior-driven nutrition system that helps users stay consistent through measurable progress and a companion-based feedback loop.

## Platform
Progressive Web App (PWA)
iOS + Android

## Tone & Personality
- Encouraging, not childish
- Supportive, not competitive
- Simple, not overwhelming
- Non-judgmental
- Subtle gamification, not game-first

---

# 2. Product Overview

## Vision
A behavior-driven health system that transforms daily habits into meaningful progression through a gamified companion system.

## Core Thesis
Users do not stay consistent because of tracking.
They stay consistent because progress becomes visible, meaningful, and rewarding.

## Target Users
- Individuals aiming for weight loss
- Couples/partners as a future expansion path, not MVP scope
- Users who want simplicity plus motivation

## Core Philosophy
- Track behavior
- Evaluate behavior
- Translate behavior into progression
- Reinforce behavior through feedback

NutriMon is not just a tracking app.

It is a behavior reinforcement system built on:
- fast, low-friction input
- clear behavioral feedback
- meaningful progression

All future product decisions should reinforce:
Consistency -> Feedback -> Progress -> Motivation

---

# 3. System Architecture

```text
Food Input -> Tracking -> Evaluation -> Behavior -> Creature -> Battle -> Experience
```

This sequence matters.
NutriMon is designed so that logging behavior becomes the foundation for feedback, progression, and later game systems.

---

# 4. Phase-Based Delivery

## Phase 1 - Core System (MVP)
- Food input system: user products, built-in catalog foods, meals, reuse
- Daily tracking
- Evaluation engine
- Habit metrics
- Behavior attributes
- Creature stats
- Weight tracking as optional reference only

## Phase 2 - Progression
- Creature evolution
- Progression map
- Readiness indicator

## Phase 3 - Game Layer
- PvE battle engine
- Opponents
- Battle outcome and progression systems

---

# 5. MVP Scope

The MVP must include:
- Product system with fast manual entry and reuse
- Shared built-in food catalog for direct logging
- Meal builder
- Daily logs
- Optional manual weight entry with graph view
- Evaluation engine
- Habit metrics
- Behavior attributes
- Creature stats display
- Supportive daily feedback

The MVP must not include:
- Battles
- Social or couple features
- Push notifications
- Offline sync
- OAuth

---

# 6. Food Input System

## Product
A reusable food item defined by calories per serving, with optional macro detail.

## Built-in Catalog Item
A read-only shared food entry provided by NutriMon for direct logging.
Built-in catalog items behave like loggable foods in search and quick add, but they are not user-managed products.

## Meal
A meal is a timestamped logged event made of one or more food items.
A meal may contain a mix of user products and built-in catalog items.

## Requirements
- Fast reuse through recent and frequent foods
- Unified search across user products and built-in catalog foods
- Quick-add interaction
- Less than 10-second repeat logging for common meals
- Support edit and delete of logged meals
- Support repeat-last-meal behavior

The food system should optimize for speed over exhaustiveness.
The user should not need to name meals or perform heavy data entry to succeed.
Profile-level product management remains scoped to user-created products only.

---

# 7. Tracking System

## Daily Log
Each day has a daily log that stores the running calorie total and whether the day is finalized.

## Weight Entry
Weight tracking is optional, informational, and intentionally minimal.

Requirements:
- Manual entry
- Graph view over time
- Optional notes

Weight is not used for scoring, streaks, creature progression, or battle calculations.

---

# 8. Evaluation System

## Goal
Translate calorie adherence into a simple daily score that supports behavior reinforcement.

## Daily Evaluation
Tracks:
- calorie target
- calories consumed
- adherence score
- adjusted adherence
- status

## Statuses
- `optimal`
- `acceptable`
- `poor`
- `no_data`

## Principles
- Staying on or under target should generally score well
- Extreme undereating should not create fake perfection
- Missing data should weaken momentum rather than act like a successful day

---

# 9. Habit Metrics

NutriMon tracks repeated consistency, not isolated perfect days.

Primary metrics:
- current streak
- longest streak
- days logged in rolling windows
- last logged date

Streaks represent consecutive qualifying days and act as a major motivational signal.

---

# 10. Behavior Attribute System

Daily behavior should be translated into a small set of understandable attributes:

- consistency
- stability
- momentum
- discipline

These attributes exist to convert nutrition behavior into progression signals that feel more meaningful than raw calorie totals.

Core principles:
- recent behavior matters more than old behavior
- steadiness matters, not only intensity
- missing data should reduce momentum

---

# 11. Creature System

The creature is the user's visible expression of progress.
It is a companion, not a separate game economy.

## Creature Stats
- strength
- resilience
- momentum
- vitality

## Product Role
The creature should:
- reflect progress clearly
- make behavior feel rewarding
- create anticipation for future evolution and battles

In Phase 1, the creature is display-only.

---

# 12. Progression System

Progression should remain simple early on.

Current intended path:
- `baby -> adult` at 7 qualifying streak days
- `adult -> champion` at 30 qualifying streak days

This may expand later, but early progression should be easy to understand and motivating.

Stage progression should feel earned through consistency, not through grinding abstract game tasks.

---

# 13. Battle System (Phase 3)

Battles are a later payoff layer, not the core reason the product works.

Principles:
- creature stats should influence battle readiness
- opponents should have simple readable archetypes
- battles should reinforce long-term consistency rather than daily perfectionism

Unlimited retries and low-friction engagement are acceptable if they help the system feel rewarding without punishing users.

---

# 14. Opponent System

Phase 3 opponents should be simple and recognizable.

Initial archetypes:
- Slime: easy
- Wolf: strength-focused
- Golem: resilience-focused
- Dragon: balanced, high-threat

Opponents are there to give creature stats meaning, not to dominate the core product experience.

---

# 15. Feedback System

Daily feedback is part of the core loop.

Each finalized day should produce:
- a simple status
- a short supportive message
- a practical recommendation

Feedback should:
- stay encouraging
- avoid shame or punishment
- promote fast recovery after bad or missing days

---

# 16. Logging UX Loop

The intended UX loop is:

1. Open app
2. See current progress and creature state
3. Log food quickly
4. See immediate updates
5. Receive supportive feedback
6. Build progression over time

The app should feel lightweight, repeatable, and forgiving.

---

# 17. Success Metrics

Primary success metrics:
- retention
- logging frequency
- product reuse rate
- streak growth

Phase-3-only metric:
- battle participation

The MVP should optimize for behavior retention and repeat logging, not feature breadth.

---

# FINAL NOTE

The product works only if the behavior loop stays clear:

Fast input -> Feedback -> Progress -> Motivation

If a future feature adds complexity without strengthening that loop, it should be deprioritized.
