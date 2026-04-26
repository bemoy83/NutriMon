import { useAuth } from '@/app/providers/auth'
import { useState } from 'react'
import type { Product } from '@/types/domain'
import { userMessageForFailedRequest } from '@/lib/requestErrors'
import { SimpleFoodFormFields } from '@/features/foods/simpleFoodForm'
import {
  saveSimpleFoodProduct,
  type SimpleFoodFormData,
  type SimpleFoodFormPrefill,
  useSimpleFoodForm,
} from '@/features/foods/simpleFoodFormCore'

export type ProductFormPrefill = SimpleFoodFormPrefill

interface Props {
  initialProduct?: Product | null
  initialValues?: ProductFormPrefill
  onSave: (product: Product) => void
  onSaveAndAdd?: (product: Product) => void
}

export default function ProductForm({ initialProduct = null, initialValues, onSave, onSaveAndAdd }: Props) {
  const { user } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const isEditMode = !!initialProduct
  const { form, portionKcalPreview } = useSimpleFoodForm({ initialProduct, initialValues })
  const { handleSubmit, formState: { isSubmitting } } = form

  async function save(data: SimpleFoodFormData): Promise<Product | null> {
    if (!user) return null
    setServerError(null)

    try {
      return await saveSimpleFoodProduct({ data, initialProduct, userId: user.id })
    } catch (e) {
      setServerError(userMessageForFailedRequest(e))
      return null
    }
  }

  return (
    <form className="space-y-4 p-4">
      <SimpleFoodFormFields form={form} portionKcalPreview={portionKcalPreview} />
      {serverError && (
        <p className="text-[var(--app-danger)] text-sm">{serverError}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSubmit(async (data) => {
            const product = await save(data)
            if (product) onSave(product)
          })}
          className="app-button-primary flex-1 py-2.5"
        >
          {isEditMode ? 'Save changes' : 'Save'}
        </button>
        {onSaveAndAdd && !isEditMode && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit(async (data) => {
              const product = await save(data)
              if (product) onSaveAndAdd(product)
            })}
            className="app-button-primary flex-1 py-2.5"
          >
            Save & Add
          </button>
        )}
      </div>
    </form>
  )
}
