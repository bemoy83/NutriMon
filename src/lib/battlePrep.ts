import { supabase } from '@/lib/supabase'
import { addDays, getTodayInTimezone } from '@/lib/date'

/**
 * Ensures a battle-prep snapshot exists for `battleDate` by triggering the
 * finalize-day edge function for the previous day if no snapshot is found.
 * Safe to call multiple times — no-ops if the snapshot already exists.
 */
export async function ensureBattlePrepSnapshot(battleDate: string, timezone: string) {
  const today = getTodayInTimezone(timezone)
  if (battleDate > today) return

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return

  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return

  const { data: snapshotRow, error: snapshotError } = await supabase
    .from('creature_battle_snapshots')
    .select('id')
    .eq('user_id', userId)
    .eq('battle_date', battleDate)
    .maybeSingle()

  if (snapshotError) throw snapshotError
  if (snapshotRow?.id) return

  const prepDate = addDays(battleDate, -1)
  const { error: prepLogError } = await supabase
    .from('daily_logs')
    .select('is_finalized')
    .eq('user_id', userId)
    .eq('log_date', prepDate)
    .maybeSingle()

  if (prepLogError) throw prepLogError

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const resp = await fetch(`${supabaseUrl}/functions/v1/finalize-day`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ date: prepDate }),
  })

  if (!resp.ok) {
    const error = await resp.json().catch(() => ({ error: 'Unable to prepare battle snapshot' }))
    throw new Error(error.error ?? 'Unable to prepare battle snapshot')
  }
}
