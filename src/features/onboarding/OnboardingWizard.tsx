import { useState, type ReactNode } from 'react'
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

const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
const creatureMarkUrl = `${base}/sprites/player_battle/baby_steady.png`

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
    <div className="app-page flex min-h-screen items-start justify-center px-4 py-6 pb-24">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-3 px-1">
          <img
            src={creatureMarkUrl}
            alt=""
            className="sprite-pixel-art h-12 w-12 flex-none"
            style={{ imageRendering: 'pixelated' }}
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)]">
              Setup
            </p>
            <h1 className="text-xl font-bold leading-tight text-[var(--app-text-primary)]">
              Build your baseline
            </h1>
          </div>
        </div>

        <ProgressIndicator step={step} />

        {/* Step 1: Profile input */}
        {step === 1 && (
          <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="app-card space-y-5 p-4">
            <StepHeading
              title="Tell us about yourself"
              subtitle="This helps estimate your daily energy needs."
            />

            {/* Sex */}
            <FormField label="Biological sex (for TDEE)">
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
                      className={`rounded-[var(--app-radius-lg)] px-3 py-2 text-center text-sm font-medium transition-[background-color,color,box-shadow] ${
                        sexForTDEE === s
                          ? 'bg-white text-[var(--app-brand)] shadow-[0_1px_8px_rgb(124_58_237/0.16),0_0_0_1px_var(--app-brand-ring)]'
                          : 'bg-[var(--app-input-bg)] text-[var(--app-text-muted)] hover:bg-[var(--app-input-bg-focus)] hover:text-[var(--app-text-secondary)]'
                      }`}
                    >
                      {s === 'male' ? 'Male' : 'Female'}
                    </div>
                  </label>
                ))}
              </div>
              {step1Form.formState.errors.sexForTDEE && (
                <ErrorText>
                  {step1Form.formState.errors.sexForTDEE.message}
                </ErrorText>
              )}
            </FormField>

            {/* Age */}
            <FormField label="Age" htmlFor="age">
              <input
                id="age"
                type="number"
                {...step1Form.register('ageYears', { valueAsNumber: true })}
                className="app-input px-3 py-2"
                placeholder="30"
              />
              {step1Form.formState.errors.ageYears && (
                <ErrorText>
                  {step1Form.formState.errors.ageYears.message}
                </ErrorText>
              )}
            </FormField>

            {/* Height */}
            <FormField
              label="Height"
              trailing={
                <div className="flex rounded-[var(--app-radius-lg)] bg-[var(--app-input-bg)] p-1 text-xs">
                  {(['cm', 'ft'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => step1Form.setValue('heightUnit', u)}
                      className={`rounded-[var(--app-radius-md)] px-2.5 py-1 font-medium transition-colors ${
                        heightUnit === u
                          ? 'bg-white text-[var(--app-brand)] shadow-[0_1px_8px_rgb(124_58_237/0.10)]'
                          : 'text-[var(--app-input-placeholder)] hover:text-[var(--app-text-secondary)]'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              }
            >
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
            </FormField>

            {/* Weight */}
            <FormField
              label="Current weight"
              trailing={
                <div className="flex rounded-[var(--app-radius-lg)] bg-[var(--app-input-bg)] p-1 text-xs">
                  {(['kg', 'lb'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => step1Form.setValue('weightUnit', u)}
                      className={`rounded-[var(--app-radius-md)] px-2.5 py-1 font-medium transition-colors ${
                        weightUnit === u
                          ? 'bg-white text-[var(--app-brand)] shadow-[0_1px_8px_rgb(124_58_237/0.10)]'
                          : 'text-[var(--app-input-placeholder)] hover:text-[var(--app-text-secondary)]'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              }
            >
              <input
                type="number"
                step="0.1"
                {...step1Form.register('weightValue', { valueAsNumber: true })}
                className="app-input px-3 py-2"
                placeholder={weightUnit === 'kg' ? '80' : '176'}
              />
              {step1Form.formState.errors.weightValue && (
                <ErrorText>
                  {step1Form.formState.errors.weightValue.message}
                </ErrorText>
              )}
            </FormField>

            {/* Activity Level */}
            <FormField label="Activity level">
              <div className="space-y-2">
                {(Object.entries(ACTIVITY_LABELS) as [ActivityLevel, string][]).map(
                  ([value, label]) => (
                    <label
                      key={value}
                      className="flex cursor-pointer items-center gap-3 rounded-[var(--app-radius-lg)] bg-[var(--app-input-bg)] px-3 py-2.5 text-sm text-[var(--app-text-secondary)] transition-colors hover:bg-[var(--app-input-bg-focus)]"
                    >
                      <input
                        type="radio"
                        value={value}
                        {...step1Form.register('activityLevel')}
                        className="accent-[var(--app-brand)]"
                      />
                      <span>{label}</span>
                    </label>
                  ),
                )}
              </div>
              {step1Form.formState.errors.activityLevel && (
                <ErrorText>
                  {step1Form.formState.errors.activityLevel.message}
                </ErrorText>
              )}
            </FormField>

            {/* Timezone */}
            <FormField label="Timezone" htmlFor="timezone">
              <input
                id="timezone"
                type="text"
                {...step1Form.register('timezone')}
                className="app-input px-3 py-2"
                placeholder="America/New_York"
              />
              {step1Form.formState.errors.timezone && (
                <ErrorText>
                  {step1Form.formState.errors.timezone.message}
                </ErrorText>
              )}
            </FormField>

            {/* Goal weight (optional) */}
            <FormField label="Goal weight" helper="Optional">
              <input
                type="number"
                step="0.1"
                {...step1Form.register('goalWeightValue', { valueAsNumber: true })}
                className="app-input px-3 py-2"
                placeholder={weightUnit === 'kg' ? '72' : '158'}
              />
            </FormField>

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
          <div className="app-card space-y-5 p-4">
            <StepHeading
              title="Your estimated needs"
              subtitle="A starting point based on your profile."
            />

            <div className="space-y-3">
              <MetricPanel label="Total Daily Energy Expenditure">
                <p className="mt-1 text-3xl font-bold text-[var(--app-text-primary)]">
                  {tdee.toLocaleString()}{' '}
                  <span className="text-sm font-normal text-[var(--app-text-muted)]">kcal/day</span>
                </p>
              </MetricPanel>
              <MetricPanel label="Suggested daily target">
                <p className="mt-1 text-2xl font-semibold text-[var(--app-brand)]">
                  {suggestedTarget.toLocaleString()}{' '}
                  <span className="text-sm font-normal text-[var(--app-text-muted)]">kcal/day</span>
                </p>
              </MetricPanel>
            </div>

            <p className="rounded-[var(--app-radius-lg)] bg-[var(--app-brand-soft)] px-3 py-2.5 text-sm leading-relaxed text-[var(--app-surface-purple-text)]">
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
          <form onSubmit={step3Form.handleSubmit(handleStep3Submit)} className="app-card space-y-5 p-4">
            <StepHeading
              title="Confirm your daily target"
              subtitle="Adjust if needed. You can change this anytime from your profile."
            />

            <FormField label="Daily calorie target" htmlFor="calorieTarget">
              <input
                id="calorieTarget"
                type="number"
                {...step3Form.register('calorieTarget', { valueAsNumber: true })}
                className="app-input px-3 py-2 text-lg font-semibold"
              />
              {step3Form.formState.errors.calorieTarget && (
                <ErrorText>
                  {step3Form.formState.errors.calorieTarget.message}
                </ErrorText>
              )}
              <p className="mt-1 text-xs text-[var(--app-text-muted)]">
                Range: {CALORIE_TARGET_MIN}–{CALORIE_TARGET_MAX} kcal
              </p>
            </FormField>

            {saveError && (
              <p className="text-sm text-[var(--app-danger)]">{saveError}</p>
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
          <div className="app-card space-y-6 p-4 text-center">
            <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-[var(--app-brand-soft)]">
              <img
                src={creatureMarkUrl}
                alt=""
                className="sprite-pixel-art h-24 w-24"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--app-text-primary)]">Meet your companion</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--app-text-muted)]">
                Your creature grows stronger as you build consistency. Log your meals each day to
                watch it evolve.
              </p>
            </div>

            <div className="space-y-2 text-left">
              <ChecklistItem>Log meals daily to build streaks</ChecklistItem>
              <ChecklistItem>Stay within target to gain strength</ChecklistItem>
              <ChecklistItem>7-day streak unlocks the first evolution</ChecklistItem>
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

function ProgressIndicator({ step }: { step: number }) {
  return (
    <div className="mb-5 rounded-[var(--app-radius-xl)] bg-white/65 p-2">
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-[var(--app-brand)]' : 'bg-[var(--app-ring-track)]'
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-xs font-medium text-[var(--app-text-muted)]">
        Step {step} of 4
      </p>
    </div>
  )
}

function StepHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--app-text-primary)]">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-[var(--app-text-muted)]">{subtitle}</p>
    </div>
  )
}

function FormField({
  label,
  htmlFor,
  helper,
  trailing,
  children,
}: {
  label: string
  htmlFor?: string
  helper?: string
  trailing?: ReactNode
  children: ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex min-h-7 items-center justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm text-[var(--app-text-secondary)]">
          {label}
          {helper ? <span className="ml-1 text-[var(--app-text-muted)]">({helper})</span> : null}
        </label>
        {trailing}
      </div>
      {children}
    </div>
  )
}

function ErrorText({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs text-[var(--app-danger)]">{children}</p>
}

function MetricPanel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[var(--app-radius-lg)] bg-[var(--app-input-bg)] p-4">
      <p className="text-sm text-[var(--app-text-muted)]">{label}</p>
      {children}
    </div>
  )
}

function ChecklistItem({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--app-radius-lg)] bg-[var(--app-input-bg)] px-3 py-2.5">
      <span className="h-2 w-2 flex-none rounded-full bg-[var(--app-brand)]" />
      <span className="text-sm text-[var(--app-text-secondary)]">{children}</span>
    </div>
  )
}
