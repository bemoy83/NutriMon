import { supabase } from '@/lib/supabase'
import { PROFILE_FULL_SELECT } from '@/lib/supabaseSelect'
import type { ProfileRow } from '@/types/database'

export async function fetchProfile(userId: string): Promise<ProfileRow> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_FULL_SELECT)
    .eq('user_id', userId)
    .single()

  if (error) throw error
  return data as unknown as ProfileRow
}
