import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { addDays, finalizeDay, formatDate, getLocalTime, shouldProcessLocalTime } from '../_shared/finalizeDay.ts'
import { getCronAuthError } from '../_shared/cronAuth.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProfileWindowRow {
  user_id: string
  timezone: string
  onboarding_completed_at: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const authError = getCronAuthError(req.headers, Deno.env.get('CRON_SHARED_SECRET'))
    if (authError) {
      return new Response(JSON.stringify({ error: authError }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: profilesData, error: profilesErr } = await supabase
      .from('profiles')
      .select('user_id, timezone, onboarding_completed_at')
      .not('onboarding_completed_at', 'is', null)
      .not('timezone', 'is', null)

    if (profilesErr) throw new Error(profilesErr.message)

    const profiles = (profilesData ?? []) as ProfileWindowRow[]
    if (profiles.length === 0) {
      return new Response(JSON.stringify({ processed: 0, processedIds: [], errors: [] }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date()
    const processed: string[] = []
    const errors: Array<{ userId: string; error: string }> = []

    for (const profile of profiles) {
      try {
        const localTime = getLocalTime(now, profile.timezone)
        if (!shouldProcessLocalTime(localTime)) continue

        const previousLocalDate = addDays(formatDate(localTime), -1)
        const { data: latestFinalizedData, error: latestFinalizedErr } = await supabase
          .from('daily_logs')
          .select('log_date')
          .eq('user_id', profile.user_id)
          .eq('is_finalized', true)
          .order('log_date', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latestFinalizedErr) throw new Error(latestFinalizedErr.message)

        const onboardingDate = formatDate(new Date(profile.onboarding_completed_at))
        const dayAfterLatest = latestFinalizedData?.log_date
          ? addDays(latestFinalizedData.log_date as string, 1)
          : null
        const windowStart = dayAfterLatest && dayAfterLatest > onboardingDate
          ? dayAfterLatest
          : onboardingDate

        const datesToFinalize: string[] = []
        let current = windowStart
        while (current <= previousLocalDate) {
          datesToFinalize.push(current)
          current = addDays(current, 1)
        }

        for (const date of datesToFinalize) {
          const { error: logUpsertErr } = await supabase
            .from('daily_logs')
            .upsert(
              { user_id: profile.user_id, log_date: date },
              { onConflict: 'user_id,log_date', ignoreDuplicates: true },
            )
          if (logUpsertErr) throw new Error(logUpsertErr.message)

          await finalizeDay(supabase, profile.user_id, date)
          processed.push(`${profile.user_id}:${date}`)
        }
      } catch (error) {
        errors.push({
          userId: profile.user_id,
          error: error instanceof Error ? error.message : 'unknown',
        })
      }
    }

    return new Response(
      JSON.stringify({ processed: processed.length, processedIds: processed, errors }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
