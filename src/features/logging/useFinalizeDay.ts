import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'

interface UseFinalizeDayOptions {
  logDate: string
  onSuccess: () => void
}

export function useFinalizeDay({ logDate, onSuccess }: UseFinalizeDayOptions) {
  const { user } = useAuth()
  const [finalizing, setFinalizing] = useState(false)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)

  async function finalizeDay() {
    if (!user) return
    setFinalizing(true)
    setFinalizeError(null)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      setFinalizeError('Not authenticated')
      setFinalizing(false)
      return
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const resp = await fetch(`${supabaseUrl}/functions/v1/finalize-day`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ date: logDate }),
    })

    setFinalizing(false)
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: 'Unknown error' }))
      setFinalizeError(err.error ?? 'Finalization failed')
      return
    }

    onSuccess()
  }

  return {
    finalizing,
    finalizeError,
    finalizeDay,
  }
}
