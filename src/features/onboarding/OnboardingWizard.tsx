import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'
import { calculateBMR, calculateTDEE, suggestCalorieTarget, lbToKg, inchesToCm } from '@/lib/tdee'
import { guessTimezone } from '@/lib/date'
import type { SexForTDEE, ActivityLevel } from '@/types/domain'
import { CALORIE_TARGET_MIN, CALORIE_TARGET_MAX } from '@/lib/constants'

// ─── Step 1 schema ──────────────────────────────────────────────────────────
const step1Schema = z.object({
  heightUnit: z.enum(['cm', 'ft']),
  heightCm: z.number().optional(),
  heightFt: z.number().optional(),
  heightIn: z.number().optional(),
  weightUnit: z.enum(['kg', 'lb']),
  weightValue: z.number().positive('Enter your weight'),
  ageYears: z
    .number({ error: 'Enter your age' })
    .int()
    .min(13, 'Must be at least 13')
    .max(120, 'Enter a valid age'),
  sexForTDEE: z.enum(['male', 'female'] as const, { error: 'Select sex' }),
  activityLevel: z.enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active'] as const, {
    error: 'Select activity level',
  }),
  timezone: z.string().min(1, 'Timezone required'),
  goalWeightValue: z.number().optional(),
  goalWeightUnit: z.enum(['kg', 'lb']).optional(),
})

type Step1Data = z.infer<typeof step1Schema>

// ─── Step 3 schema ──────────────────────────────────────────────────────────
const step3Schema = z.object({
  calorieTarget: z
    .number({ error: 'Enter a calorie target' })
    .int()
    .min(CALORIE_TARGET_MIN, `Minimum is ${CALORIE_TARGET_MIN}`)
    .max(CALORIE_TARGET_MAX, `Maximum is ${CALORIE_TARGET_MAX}`),
})

type Step3Data = z.infer<typeof step3Schema>

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (little/no exercise)',
  lightly_active: 'Lightly active (1–3 days/week)',
  moderately_active: 'Moderately active (3–5 days/week)',
  very_active: 'Very active (6–7 days/week)',
}

export default function OnboardingWizard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null)
  const [tdee, setTDEE] = useState<number>(0)
  const [suggestedTarget, setSuggestedTarget] = useState<number>(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ── Step 1 form
  const step1Form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      heightUnit: 'cm',
      weightUnit: 'kg',
      timezone: guessTimezone(),
      goalWeightUnit: 'kg',
    },
  })
  const heightUnit = useWatch({ control: step1Form.control, name: 'heightUnit' })
  const weightUnit = useWatch({ control: step1Form.control, name: 'weightUnit' })
  const sexForTDEE = useWatch({ control: step1Form.control, name: 'sexForTDEE' })

  // ── Step 3 form
  const step3Form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
  })

  // ── Step 1 submit
  function handleStep1Submit(data: Step1Data) {
    setStep1Data(data)

    const weightKg = data.weightUnit === 'lb' ? lbToKg(data.weightValue) : data.weightValue
    const heightCm =
      data.heightUnit === 'ft'
        ? inchesToCm((data.heightFt ?? 0) * 12 + (data.heightIn ?? 0))
        : (data.heightCm ?? 170)
    const bmr = calculateBMR(data.sexForTDEE as SexForTDEE, weightKg, heightCm, data.ageYears)
    const computedTDEE = calculateTDEE(bmr, data.activityLevel as ActivityLevel)
    const suggested = suggestCalorieTarget(computedTDEE)

    setTDEE(Math.round(computedTDEE))
    setSuggestedTarget(suggested)
    step3Form.setValue('calorieTarget', suggested)
    setStep(2)
  }

  // ── Step 3 submit → save profile → go to step 4
  async function handleStep3Submit(data: Step3Data) {
    if (!user || !step1Data) return
    setSaving(true)
    setSaveError(null)

    const weightKg =
      step1Data.weightUnit === 'lb' ? lbToKg(step1Data.weightValue) : step1Data.weightValue
    const heightCm =
      step1Data.heightUnit === 'ft'
        ? inchesToCm((step1Data.heightFt ?? 0) * 12 + (step1Data.heightIn ?? 0))
        : (step1Data.heightCm ?? 170)
    const goalWeightKg = step1Data.goalWeightValue
      ? step1Data.goalWeightUnit === 'lb'
        ? lbToKg(step1Data.goalWeightValue)
        : step1Data.goalWeightValue
      : null

    const { error } = await supabase
      .from('profiles')
      .update({
        height_cm: heightCm,
        starting_weight_kg: weightKg,
        age_years: step1Data.ageYears,
        sex_for_tdee: step1Data.sexForTDEE,
        activity_level: step1Data.activityLevel,
        timezone: step1Data.timezone,
        calorie_target: data.calorieTarget,
        goal_weight_kg: goalWeightKg,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    setSaving(false)
    if (error) {
      setSaveError(error.message)
      return
    }
    setStep(4)
  }

  return (
    <div className="app-page flex min-h-screen items-start justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-indigo-500' : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Profile input */}
        {step === 1 && (
          <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-5">
            <h2 className="text-xl font-semibold text-white">Tell us about yourself</h2>

            {/* Sex */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">Biological sex (for TDEE)</label>
              <div className="flex gap-3">
                {(['male', 'female'] as SexForTDEE[]).map((s) => (
                  <label key={s} className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      value={s}
                      {...step1Form.register('sexForTDEE')}
                      className="sr-only"
                    />
                    <div
                      className={`py-2 text-center rounded-lg border text-sm transition-colors ${
                        sexForTDEE === s
                          ? 'border-indigo-500 bg-indigo-950 text-white'
                          : 'border-slate-700 text-slate-400'
                      }`}
                    >
                      {s === 'male' ? 'Male' : 'Female'}
                    </div>
                  </label>
                ))}
              </div>
              {step1Form.formState.errors.sexForTDEE && (
                <p className="text-red-400 text-xs mt-1">
                  {step1Form.formState.errors.sexForTDEE.message}
                </p>
              )}
            </div>

            {/* Age */}
            <div>
              <label htmlFor="age" className="block text-sm text-slate-300 mb-1">
                Age
              </label>
              <input
                id="age"
                type="number"
                {...step1Form.register('ageYears', { valueAsNumber: true })}
                className="app-input px-3 py-2"
                placeholder="30"
              />
              {step1Form.formState.errors.ageYears && (
                <p className="text-red-400 text-xs mt-1">
                  {step1Form.formState.errors.ageYears.message}
                </p>
              )}
            </div>

            {/* Height */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-slate-300">Height</label>
                <div className="flex gap-2 text-xs">
                  {(['cm', 'ft'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => step1Form.setValue('heightUnit', u)}
                      className={`px-2 py-0.5 rounded ${
                        heightUnit === u
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              {heightUnit === 'cm' ? (
                <input
                  type="number"
                  {...step1Form.register('heightCm', { valueAsNumber: true })}
                  className="app-input px-3 py-2"
                  placeholder="175"
                />
              ) : (
                <div className="flex gap-2">
                  <input
                    type="number"
                    {...step1Form.register('heightFt', { valueAsNumber: true })}
                    className="app-input px-3 py-2"
                    placeholder="5 ft"
                  />
                  <input
                    type="number"
                    {...step1Form.register('heightIn', { valueAsNumber: true })}
                    className="app-input px-3 py-2"
                    placeholder="9 in"
                  />
                </div>
              )}
            </div>

            {/* Weight */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-slate-300">Current weight</label>
                <div className="flex gap-2 text-xs">
                  {(['kg', 'lb'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => step1Form.setValue('weightUnit', u)}
                      className={`px-2 py-0.5 rounded ${
                        weightUnit === u
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                step="0.1"
                {...step1Form.register('weightValue', { valueAsNumber: true })}
                className="app-input px-3 py-2"
                placeholder={weightUnit === 'kg' ? '80' : '176'}
              />
              {step1Form.formState.errors.weightValue && (
                <p className="text-red-400 text-xs mt-1">
                  {step1Form.formState.errors.weightValue.message}
                </p>
              )}
            </div>

            {/* Activity Level */}
            <div>
              <label className="block text-sm text-slate-300 mb-2">Activity level</label>
              <div className="space-y-2">
                {(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(
                  ([value, label]) => (
                    <label key={value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        value={value}
                        {...step1Form.register('activityLevel')}
                        className="accent-indigo-500"
                      />
                      <span className="text-sm text-slate-300">{label}</span>
                    </label>
                  ),
                )}
              </div>
              {step1Form.formState.errors.activityLevel && (
                <p className="text-red-400 text-xs mt-1">
                  {step1Form.formState.errors.activityLevel.message}
                </p>
              )}
            </div>

            {/* Timezone */}
            <div>
              <label htmlFor="timezone" className="block text-sm text-slate-300 mb-1">
                Timezone
              </label>
              <input
                id="timezone"
                type="text"
                {...step1Form.register('timezone')}
                className="app-input px-3 py-2"
                placeholder="America/New_York"
              />
              {step1Form.formState.errors.timezone && (
                <p className="text-red-400 text-xs mt-1">
                  {step1Form.formState.errors.timezone.message}
                </p>
              )}
            </div>

            {/* Goal weight (optional) */}
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Goal weight{' '}
                <span className="text-slate-500">(optional)</span>
              </label>
              <input
                type="number"
                step="0.1"
                {...step1Form.register('goalWeightValue', { valueAsNumber: true })}
                className="app-input px-3 py-2"
                placeholder={weightUnit === 'kg' ? '72' : '158'}
              />
            </div>

            <button
              type="submit"
              className="app-button-primary w-full py-2.5"
            >
              Calculate my TDEE
            </button>
          </form>
        )}

        {/* Step 2: TDEE result */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-white">Your estimated needs</h2>

            <div className="app-card space-y-4 p-5">
              <div>
                <p className="text-slate-400 text-sm">Total Daily Energy Expenditure</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {tdee.toLocaleString()}{' '}
                  <span className="text-sm font-normal text-slate-400">kcal/day</span>
                </p>
              </div>
              <div className="border-t border-slate-700 pt-4">
                <p className="text-slate-400 text-sm">Suggested daily target (500 kcal deficit)</p>
                <p className="text-2xl font-semibold text-indigo-400 mt-1">
                  {suggestedTarget.toLocaleString()}{' '}
                  <span className="text-sm font-normal text-slate-400">kcal/day</span>
                </p>
              </div>
            </div>

            <p className="text-slate-400 text-sm">
              This creates a moderate deficit aimed at sustainable fat loss. You can adjust this on
              the next screen.
            </p>

            <button
              onClick={() => setStep(3)}
              className="app-button-primary w-full py-2.5"
            >
              Set my target
            </button>
          </div>
        )}

        {/* Step 3: Target confirmation */}
        {step === 3 && (
          <form onSubmit={step3Form.handleSubmit(handleStep3Submit)} className="space-y-5">
            <h2 className="text-xl font-semibold text-white">Confirm your daily target</h2>
            <p className="text-slate-400 text-sm">
              Adjust if needed. You can change this anytime from your profile.
            </p>

            <div>
              <label htmlFor="calorieTarget" className="block text-sm text-slate-300 mb-1">
                Daily calorie target
              </label>
              <input
                id="calorieTarget"
                type="number"
                {...step3Form.register('calorieTarget', { valueAsNumber: true })}
                className="app-input px-3 py-2 text-lg font-semibold"
              />
              {step3Form.formState.errors.calorieTarget && (
                <p className="text-red-400 text-xs mt-1">
                  {step3Form.formState.errors.calorieTarget.message}
                </p>
              )}
              <p className="text-slate-500 text-xs mt-1">
                Range: {CALORIE_TARGET_MIN}–{CALORIE_TARGET_MAX} kcal
              </p>
            </div>

            {saveError && (
              <p className="text-red-400 text-sm">{saveError}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="app-button-secondary flex-1 py-2.5"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={saving}
                className="app-button-primary flex-1 py-2.5"
              >
                {saving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </form>
        )}

        {/* Step 4: Creature intro */}
        {step === 4 && (
          <div className="text-center space-y-6">
            <div className="w-32 h-32 mx-auto bg-slate-800 rounded-full flex items-center justify-center">
              <span className="text-6xl">🥚</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Meet your companion</h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Your creature grows stronger as you build consistency. Log your meals each day to
                watch it evolve.
              </p>
            </div>

            <div className="app-card space-y-2 p-4 text-left">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span className="text-slate-300 text-sm">Log meals daily to build streaks</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span className="text-slate-300 text-sm">
                  Stay within target to gain strength
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span className="text-slate-300 text-sm">
                  7-day streak unlocks the first evolution
                </span>
              </div>
            </div>

            <button
              onClick={() => navigate('/app')}
              className="app-button-primary w-full py-2.5"
            >
              Start logging
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
