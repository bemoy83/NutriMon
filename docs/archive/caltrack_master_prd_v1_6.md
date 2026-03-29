# Superseded

Do not use this document for current product or implementation decisions.

Historical note:
This document predates the NutriMon rename and contains some details that were selectively merged into `PRODUCT_PRD.md` and `IMPLEMENTATION_PLAN.md`.

Current active product spec: `PRODUCT_PRD.md`
Current implementation handoff spec: `IMPLEMENTATION_PLAN.md`

---

# CalTrack – Master PRD (v1.6)

---

# 1. Product Overview

## Product Name

CalTrack

## Platform

Progressive Web App (PWA)
iOS + Android

---

## Vision

A behavior-driven health system that transforms daily habits into meaningful progression through a gamified creature system.

---

## Core Thesis

Users don’t stay consistent because of tracking.
They stay consistent because progress becomes visible, meaningful, and rewarding.

---

## Target Users

- Individuals aiming for weight loss
- Couples/partners
- Users who want simplicity + motivation

---

## Core Philosophy

- Track behavior
- Evaluate behavior
- Translate behavior into progression
- Reinforce behavior through feedback

---

# 2. System Architecture

```text
Tracking Layer
→ Evaluation Layer
→ Behavior Attribute Layer
→ Creature Layer
→ Battle Layer
→ Experience Layer
```

---

# 3. Phase-Based Delivery

## Phase 1 – Core System (MVP)

- Tracking
- EvaluationEngine
- HabitMetrics
- BehaviorAttributeEngine
- CreatureStats (no battles)

## Phase 2 – Progression

- Creature progression map
- Readiness indicator

## Phase 3 – Game Layer

- BattleEngine (PvE)

---

# 4. Tracking System

## Entities

### Meal

```yaml
- id
- user_id
- timestamp
- total_calories
```

### DailyLog

```yaml
- id
- user_id
- date
- total_calories
- is_finalized
```

### WeightEntry

```yaml
- date
- weight
```

---

# 5. Evaluation System

### DailyEvaluation

```yaml
- user_id
- date
- calorie_target
- calories_consumed
- deficit
- adherence_score (0–100)
- status (optimal | acceptable | poor | no_data)
- calculation_version
- finalized_at
```

### Scoring Logic

```text
difference = calories_consumed - calorie_target

if difference <= 0:
	score = 100
elif difference <= 200:
	score = 80–99
elif difference <= 500:
	score = 50–79
else:
	score = 0–49
```

---

# 6. Habit Metrics

```yaml
HabitMetrics
- user_id
- current_streak
- longest_streak
- days_logged_last_7
- last_log_date
```

### Streak Definition

```text
Streak = consecutive days with adherence_score ≥ 70
```

---

# 7. Behavior Attribute System

### BehaviorAttributes

```yaml
- user_id
- date
- consistency_score
- stability_score
- momentum_score
- discipline_score
- calculation_version
- calculated_at
```

### Adjusted Adherence

```text
if calories < (target - 500):
	penalty = (target - calories) / target
	adjusted_adherence = adherence_score * (1 - penalty)
else:
	adjusted_adherence = adherence_score
```

### Attribute Formulas

```text
consistency_score = avg(last 7 days)
stability_score   = clamp(100 - stddev(last 7 days), 20, 100)
momentum_score    = avg(last 3 days)
discipline_score  = avg(last 7 days)
```

---

# 8. Creature System

### CreatureStats

```yaml
- strength
- resilience
- momentum
- vitality
```

### Mapping

```text
strength   = consistency_score
resilience = stability_score
momentum   = momentum_score
vitality   = base_hp + (streak * streak_multiplier)
```

---

# 9. Opponent System

## Baseline Player Stats

```yaml
Stage 1: {55, 65, 55, 55}
Stage 2: {65, 80, 65, 65}
Stage 3: {75, 95, 75, 75}
Stage 4: {85, 110, 85, 85}
```

---

## Difficulty Ratios

| Stage | Ratio |
| ----- | ----- |
| 1     | 0.80  |
| 2     | 0.93  |
| 3     | 0.94  |
| 4     | 0.92  |

---

## Archetype Modifiers

### Wolf

```text
strength × 1.25
```

### Golem

```text
resilience × 1.20
```

### Dragon

```text
strength × 1.10
vitality × 1.10
resilience × 1.05
momentum × 1.05
```

---

# 10. Readiness System

### Ratios

```text
stat_ratio = player_stat / opponent_stat
```

### Formula

```text
readiness =
  strength_ratio   * 0.30 +
  vitality_ratio   * 0.30 +
  resilience_ratio * 0.20 +
  momentum_ratio   * 0.20
```

### Output

```text
> 0.70 → Likely Win
0.50–0.70 → Competitive
< 0.50 → Not Ready
```

---

# 11. Battle System

### Damage

```text
damage = max(1, strength * 0.6 - resilience * 0.4)
```

### Turn Order

```text
higher momentum goes first
```

### Rules

- Max turns: 10
- Winner = 0 HP OR higher remaining HP %

---

# 12. Attempt Rules

- Unlimited retries
- No cooldown

---

# 13. Stat Constraints

| Stat       | Range  |
| ---------- | ------ |
| Strength   | 0–100  |
| Resilience | 20–100 |
| Momentum   | 0–100  |
| Vitality   | 50–150 |

---

# 14. Data Flow

```text
Logs → Evaluation → Attributes → Creature → Battle → Progression
```

---

# 15. API

```
/auth
/logs
/meals
/weight
/evaluation
/attributes
/creature
/day/finalize
```

---

# 16. Configuration

```yaml
- base_hp = 50
- streak_multiplier = 5
- penalty_threshold = 500
- damage_weights = (0.6, 0.4)
```

---

# 17. Edge Cases

```text
No data → last values * 0.9
Partial → use available data
```

---

# 18. Feedback System

```yaml
DailyFeedback
- score
- status
- message
- recommendation
```

---

# 19. UX Loop

1. Open app
2. View stats
3. Log food
4. See updates
5. Receive feedback
6. Progress

---

# 20. Success Metrics

- Retention (D7, D30)
- Logging frequency
- Streak growth
- Battle participation

---

# 21. Future Extensions

- PvP
- Multiple creatures
- Evolution paths
- Seasonal systems

---

# FINAL NOTE

System is **build-plan ready**.
Only tuning should change post-launch — not structure.
