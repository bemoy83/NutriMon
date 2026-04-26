import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import BottomSheet from '@/components/ui/BottomSheet'
import { exportUserFoods } from '@/features/foods/foodExport'
import { importUserFoods } from '@/features/foods/foodImport'
import { queryKeys } from '@/lib/queryKeys'
import type { ImportResult } from '@/features/foods/foodImport'

interface Props {
  onClose: () => void
}

export default function ImportExportSheet({ onClose }: Props) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [exportState, setExportState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [importState, setImportState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  async function handleExport() {
    if (!user) return
    setExportState('loading')
    try {
      await exportUserFoods(user.id)
      setExportState('idle')
    } catch {
      setExportState('error')
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    e.target.value = ''

    setImportState('loading')
    setImportResult(null)
    setImportError(null)

    try {
      const result = await importUserFoods(file, user.id)
      setImportResult(result)
      setImportState('done')
      qc.invalidateQueries({ queryKey: queryKeys.myFood.prefix() })
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed.')
      setImportState('error')
    }
  }

  return (
    <BottomSheet title="Import / Export" onClose={onClose}>
      <div className="overflow-y-auto px-4 py-4 space-y-6">

        {/* Export */}
        <section>
          <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--app-text-primary)' }}>Export</h4>
          <p className="text-xs mb-3" style={{ color: 'var(--app-text-muted)' }}>
            Download your entire food library as a JSON file. You can use it as a backup or import it into another account.
          </p>
          {exportState === 'error' && (
            <p className="text-xs mb-2" style={{ color: 'var(--app-danger)' }}>Export failed. Please try again.</p>
          )}
          <button
            type="button"
            disabled={exportState === 'loading'}
            onClick={handleExport}
            className="app-button-primary w-full py-2.5 text-sm"
          >
            {exportState === 'loading' ? 'Exporting…' : 'Export foods'}
          </button>
        </section>

        <div className="h-px" style={{ background: 'var(--app-border-muted)' }} aria-hidden="true" />

        {/* Import */}
        <section>
          <h4 className="text-sm font-semibold mb-1" style={{ color: 'var(--app-text-primary)' }}>Import</h4>
          <p className="text-xs mb-3" style={{ color: 'var(--app-text-muted)' }}>
            Import foods from a NutriMon export file. Foods with the same name as an existing food are skipped.
          </p>

          {importState === 'done' && importResult && (
            <div className="mb-3 rounded-lg px-3 py-2.5 text-xs space-y-1" style={{ background: 'var(--app-surface-elevated)' }}>
              <p style={{ color: 'var(--app-text-primary)' }}>
                <span className="font-semibold">{importResult.created}</span> food{importResult.created === 1 ? '' : 's'} imported
                {importResult.skipped > 0 && <>, <span className="font-semibold">{importResult.skipped}</span> skipped</>}
              </p>
              {importResult.errors.length > 0 && (
                <ul className="space-y-0.5 mt-1" style={{ color: 'var(--app-danger)' }}>
                  {importResult.errors.map((e, i) => (
                    <li key={i}>"{e.name}": {e.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {importState === 'error' && importError && (
            <p className="text-xs mb-2" style={{ color: 'var(--app-danger)' }}>{importError}</p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={handleFileChange}
          />
          <button
            type="button"
            disabled={importState === 'loading'}
            onClick={() => fileInputRef.current?.click()}
            className="app-button-secondary w-full py-2.5 text-sm"
          >
            {importState === 'loading' ? 'Importing…' : 'Choose file to import'}
          </button>
        </section>
      </div>
    </BottomSheet>
  )
}
