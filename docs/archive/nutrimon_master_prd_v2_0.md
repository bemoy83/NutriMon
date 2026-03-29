# Superseded

Do not use this document for current product or implementation decisions.

Current active product spec: `PRODUCT_PRD.md`
Current implementation handoff spec: `IMPLEMENTATION_PLAN.md`

---

# NutriMon – Master PRD (v2.0 Consolidated)

---

# 1. Product Identity

## Product Name
NutriMon

## Positioning
A behavior-driven nutrition system that helps users stay consistent through measurable progress and a companion-based feedback loop.

## Tone
- Encouraging
- Simple
- Non-judgmental
- Subtle gamification

---

# 2. System Architecture

Food Input → Tracking → Evaluation → Behavior → Creature → Battle → Experience

---

# 3. MVP Scope (Phase 1)

- Product system (manual entry + reuse)
- Meal builder
- Daily logs
- Weight tracking (reference only)
- Evaluation engine
- Habit metrics
- Behavior attributes
- Creature stats (no battles)

---

# 4. Food Input System

## Product
- id
- user_id
- name
- calories
- protein (optional)
- carbs (optional)
- fat (optional)
- created_at

## Meal
- id
- user_id
- timestamp
- items [{product_id, quantity}]
- total_calories

## Requirements
- Fast reuse (recent + frequent)
- <10s logging
- Quick-add UX

---

# 5. Tracking System

## DailyLog
- id
- user_id
- date
- total_calories
- is_finalized

## WeightEntry
- date
- weight

NOTE: Weight is informational only (not used in scoring or progression)

---

# 6. Evaluation System

## DailyEvaluation
- adherence_score (0–100)
- status

## Logic
difference = calories - target

<=0 → 100  
<=200 → 80–99  
<=500 → 50–79  
>500 → 0–49  

---

# 7. Habit Metrics

- current_streak
- longest_streak

Streak = adherence ≥70

---

# 8. Behavior Attributes

consistency = avg(last 7 days)  
discipline = % days adherence ≥70  
stability = 100 - stddev(last 7 days)  
momentum = avg(last 3 days)

---

# 9. Creature Stats

strength = consistency  
resilience = stability  
momentum = momentum  
vitality = 50 + streak*5  

---

# 10. Evolution System

Stage progression based on:

- streak thresholds
- discipline score
- consistency score

Example:
Stage 1→2: streak ≥3  
Stage 2→3: discipline ≥70 & streak ≥5  
Stage 3→4: consistency ≥75 & stability ≥65  

---

# 11. Battle System (Phase 3)

damage = max(1, strength*0.7 - resilience*0.3)

turn order = momentum

---

# 12. Opponent System

Archetypes:
- Slime (easy)
- Wolf (strength)
- Golem (resilience)
- Dragon (balanced)

Difficulty ratios:
Stage1: 0.80  
Stage2: 0.93  
Stage3: 0.94  
Stage4: 0.92  

---

# 13. Logging UX

- One-tap reuse
- Quick add
- Instant feedback
- Undo/edit support

---

# 14. Success Metrics

- Retention
- Logging frequency
- Reuse rate
- Streak growth

---

# FINAL NOTE

This PRD is self-contained and build-ready.
All systems prioritize behavior-driven progression and low-friction input.
