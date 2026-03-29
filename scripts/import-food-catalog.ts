import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

interface ImportRecord {
  id: string
  source: string
  source_item_id: string
  name: string
  calories: number
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  default_serving_amount: number
  default_serving_unit: string
  edible_portion_percent: number | null
}

function loadLocalEnv() {
  for (const fileName of ['.env.local', '.env']) {
    const fullPath = path.join(process.cwd(), fileName)
    try {
      const contents = readFileSync(fullPath, 'utf8')
      for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const separatorIndex = trimmed.indexOf('=')
        if (separatorIndex === -1) continue
        const key = trimmed.slice(0, separatorIndex).trim()
        const value = trimmed.slice(separatorIndex + 1).trim()
        if (!(key in process.env)) {
          process.env[key] = value
        }
      }
    } catch {
      // ignore missing local env files
    }
  }
}

async function main() {
  loadLocalEnv()

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const artifactPath = process.argv[2] ?? path.join(process.cwd(), 'data', 'food_catalog_items.matvaretabellen_2026.json')
  const batchSize = 500

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL or VITE_SUPABASE_URL')
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }

  const payload = JSON.parse(readFileSync(artifactPath, 'utf8')) as ImportRecord[]
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  for (let index = 0; index < payload.length; index += batchSize) {
    const batch = payload.slice(index, index + batchSize)
    const { error } = await supabase
      .from('food_catalog_items')
      .upsert(batch, { onConflict: 'id' })

    if (error) {
      throw error
    }

    console.log(`Imported ${Math.min(index + batch.length, payload.length)} / ${payload.length}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
