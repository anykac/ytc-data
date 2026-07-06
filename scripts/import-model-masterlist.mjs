// One-off import of scripts/data/model-masterlist.json into Supabase.
// Populates per-customer (Meanwell/Martindale) stations, models, and
// model_station_config rows from the "Model Masterlist" sheet of
// "Process per model+ro.xlsx".
//
// Usage: node scripts/import-model-masterlist.mjs [--dry-run]
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (service role)
// in .env.local at the repo root.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const DRY_RUN = process.argv.includes('--dry-run')
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

// Old generic Meanwell stations that predate the real per-step masterlist.
// They stay in place (referenced by historical period_log rows) but are
// deactivated so they no longer show up as options for new entries.
const OLD_MEANWELL_STATION_NAMES = [
  'Insertion', 'Touch Up', 'Q1', 'Assembly', 'Q2', 'Q4', 'Laser', 'Packing Line',
]

function loadEnv() {
  const envPath = path.join(repoRoot, '.env.local')
  const lines = fs.readFileSync(envPath, 'utf8').trim().split(/\r?\n/)
  const env = {}
  for (const line of lines) {
    const i = line.indexOf('=')
    if (i === -1) continue
    env[line.slice(0, i)] = line.slice(i + 1)
  }
  return env
}

async function main() {
  const env = loadEnv()
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY)

  const masterlist = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'scripts/data/model-masterlist.json'), 'utf8')
  )

  const { data: customers, error: customersError } = await supabase
    .from('customers').select('id, name')
  if (customersError) throw customersError
  const customerId = {
    meanwell: customers.find((c) => c.name === 'Meanwell')?.id,
    martindale: customers.find((c) => c.name === 'Martindale')?.id,
  }
  if (!customerId.meanwell || !customerId.martindale) {
    throw new Error('Expected customers "Meanwell" and "Martindale" to already exist')
  }

  // ── Ensure the 14+14 real per-customer stations exist ──
  const { data: allStations, error: allStationsError } = await supabase
    .from('stations').select('id, name, sequence, customer_id')
  if (allStationsError) throw allStationsError

  const nextSeq = {
    [customerId.meanwell]: Math.max(0, ...allStations
      .filter((s) => s.customer_id === customerId.meanwell).map((s) => s.sequence)) + 1,
    [customerId.martindale]: Math.max(0, ...allStations
      .filter((s) => s.customer_id === customerId.martindale).map((s) => s.sequence)) + 1,
  }

  const stationId = { meanwell: {}, martindale: {} }
  const stationsToCreate = []
  const reusedStationIds = new Set()

  for (const [brand, steps] of [['meanwell', masterlist.meanwellSteps], ['martindale', masterlist.martindaleSteps]]) {
    const cid = customerId[brand]
    for (const stepName of steps) {
      const existing = allStations.find((s) => s.customer_id === cid && s.name === stepName)
      if (existing) {
        stationId[brand][stepName] = existing.id
        reusedStationIds.add(existing.id)
      } else {
        stationsToCreate.push({ brand, name: stepName, customer_id: cid, sequence: nextSeq[cid]++ })
      }
    }
  }

  // ── Deactivate old generic Meanwell stations, except any whose name exactly
  // matches a real step name above (those are reused as the canonical station
  // for that step, not superseded) — kept in place either way for historical
  // period_log FK references.
  const oldStations = allStations.filter(
    (s) => s.customer_id === customerId.meanwell && OLD_MEANWELL_STATION_NAMES.includes(s.name)
  )
  const toDeactivate = oldStations.filter((s) => !reusedStationIds.has(s.id))
  console.log(`Old Meanwell stations to deactivate: ${toDeactivate.length} (of ${oldStations.length}; ${oldStations.length - toDeactivate.length} reused as real steps)`)
  if (!DRY_RUN && toDeactivate.length > 0) {
    const { error } = await supabase
      .from('stations').update({ active: false })
      .in('id', toDeactivate.map((s) => s.id))
    if (error) throw error
  }

  console.log(`New stations to create: ${stationsToCreate.length}`)
  if (stationsToCreate.length > 0) {
    console.log(stationsToCreate.map((s) => `  [${s.brand}] ${s.name} (seq ${s.sequence})`).join('\n'))
  }
  if (!DRY_RUN && stationsToCreate.length > 0) {
    const { data: inserted, error } = await supabase
      .from('stations')
      .insert(stationsToCreate.map(({ brand, ...row }) => row))
      .select('id, name, customer_id')
    if (error) throw error
    for (const row of inserted) {
      const brand = row.customer_id === customerId.meanwell ? 'meanwell' : 'martindale'
      stationId[brand][row.name] = row.id
    }
  } else if (DRY_RUN) {
    // Fake ids so the rest of the dry run can still compute config counts.
    for (const s of stationsToCreate) stationId[s.brand][s.name] = `dry-run:${s.name}`
  }

  // ── Ensure all 243 models exist, scoped to the right customer ──
  const { data: allModels, error: allModelsError } = await supabase
    .from('models').select('id, name, customer_id')
  if (allModelsError) throw allModelsError

  const modelId = {}
  const modelsToCreate = []
  for (const m of masterlist.models) {
    const cid = customerId[m.brand]
    const existing = allModels.find((row) => row.customer_id === cid && row.name === m.name)
    if (existing) {
      modelId[m.name] = existing.id
    } else {
      modelsToCreate.push({ name: m.name, active: true, customer_id: cid })
    }
  }

  console.log(`Existing models reused: ${masterlist.models.length - modelsToCreate.length}`)
  console.log(`New models to create: ${modelsToCreate.length}`)
  if (!DRY_RUN && modelsToCreate.length > 0) {
    const CHUNK = 500
    for (let i = 0; i < modelsToCreate.length; i += CHUNK) {
      const chunk = modelsToCreate.slice(i, i + CHUNK)
      const { data: inserted, error } = await supabase
        .from('models').insert(chunk).select('id, name')
      if (error) throw error
      for (const row of inserted) modelId[row.name] = row.id
    }
  } else if (DRY_RUN) {
    for (const m of modelsToCreate) modelId[m.name] = `dry-run:${m.name}`
  }

  // ── Build model_station_config rows ──
  const configRows = []
  for (const m of masterlist.models) {
    const steps = m.brand === 'meanwell' ? masterlist.meanwellSteps : masterlist.martindaleSteps
    steps.forEach((stepName, i) => {
      if (!m.steps[i]) return
      configRows.push({
        model_id: modelId[m.name],
        station_id: stationId[m.brand][stepName],
        active: true,
      })
    })
  }

  console.log(`model_station_config rows to upsert: ${configRows.length}`)
  if (!DRY_RUN) {
    const CHUNK = 500
    for (let i = 0; i < configRows.length; i += CHUNK) {
      const chunk = configRows.slice(i, i + CHUNK)
      const { error } = await supabase
        .from('model_station_config')
        .upsert(chunk, { onConflict: 'model_id,station_id' })
      if (error) throw error
    }
  }

  console.log(DRY_RUN ? '\nDry run complete — no writes made.' : '\nImport complete.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
