import { useEffect, useImperativeHandle, useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { useAuth } from '@/app/providers/auth'
import type { Product } from '@/types/domain'
import type { SaveHandle } from './RecipeEditor'
import { userMessageForFailedRequest } from '@/lib/requestErrors'
import { SimpleFoodFormFields } from './simpleFoodForm'
import {
  saveSimpleFoodProduct,
  type SimpleFoodFormData,
  useSimpleFoodForm,
} from './simpleFoodFormCore'

interface SimpleFoodEditorProps {
  initialProduct: Product | null
  onSaved: () => void
  saveRef: Ref<SaveHandle>
  onCanSaveChange: (canSave: boolean) => void
  dangerZone?: ReactNode
}

export default function SimpleFoodEditor({
  initialProduct,
  onSaved,
  saveRef,
  onCanSaveChange,
  dangerZone,
}: SimpleFoodEditorProps) {
  const { user } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const { form, watchedName, portionKcalPreview } = useSimpleFoodForm({ initialProduct })
  const { handleSubmit, formState: { isSubmitting } } = form

  const canSave = (watchedName?.trim().length ?? 0) > 0 && !isSubmitting

  useEffect(() => {
    onCanSaveChange(canSave)
  }, [canSave, onCanSaveChange])

  async function doSave(data: SimpleFoodFormData): Promise<void> {
    if (!user) return
    setServerError(null)

    try {
      await saveSimpleFoodProduct({ data, initialProduct, userId: user.id })
      onSaved()
    } catch (e) {
      setServerError(userMessageForFailedRequest(e))
      throw e
    }
  }

  useImperativeHandle(saveRef, () => ({
    save: () => new Promise<void>((resolve, reject) => {
      handleSubmit(
        async (data) => { try { await doSave(data); resolve() } catch (e) { reject(e) } },
        () => reject(new Error('Validation failed')),
      )()
    }),
  }))

  return (
    <div className="flex-1 overflow-y-auto">
      <form className="space-y-4 px-4 py-4">
        <SimpleFoodFormFields form={form} portionKcalPreview={portionKcalPreview} idPrefix="sfe" />
        {serverError && (
          <p className="text-[var(--app-danger)] text-sm">{serverError}</p>
        )}
        {dangerZone}
      </form>
    </div>
  )
}
