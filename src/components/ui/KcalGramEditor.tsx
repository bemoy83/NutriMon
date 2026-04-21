import GramInput from './GramInput'

interface KcalGramEditorProps {
  kcal: number
  grams: number
  onGramsChange: (g: number) => void
}

export default function KcalGramEditor({ kcal, grams, onGramsChange }: KcalGramEditorProps) {
  return (
    <div className="flex flex-col items-center gap-6 px-8 py-6">
      <div className="text-center">
        <p className="text-6xl font-bold tabular-nums text-[var(--app-text-primary)] leading-none">
          {kcal}
        </p>
        <p className="mt-2 text-sm text-[var(--app-text-muted)]">kcal</p>
      </div>
      <GramInput grams={grams} onChange={onGramsChange} showSteppers />
    </div>
  )
}
