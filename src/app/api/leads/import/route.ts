import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClientUntyped as createSupabaseServiceClient } from '@/lib/supabase/server'

const REQUIRED_COLS = ['name', 'phone', 'business_name']
const OPTIONAL_COLS = ['email', 'budget', 'notes']

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row')
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))
  const rows = lines.slice(1).map(line => {
    // Simple CSV parser (handles quoted fields)
    const cols: string[] = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"' && !inQ) { inQ = true; continue }
      if (c === '"' && inQ) { inQ = false; continue }
      if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue }
      cur += c
    }
    cols.push(cur.trim())
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? '']))
  })
  return { headers, rows }
}

function validatePhone(phone: string): boolean {
  return /^[\+\d\s\-\(\)]{7,20}$/.test(phone.trim())
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    if (!file.name.endsWith('.csv')) return NextResponse.json({ error: 'Only CSV files are supported' }, { status: 400 })

    const text = await file.text()
    const { headers, rows } = parseCSV(text)

    // Validate required columns
    const missing = REQUIRED_COLS.filter(c => !headers.includes(c))
    if (missing.length > 0) {
      return NextResponse.json({
        error: `Missing required columns: ${missing.join(', ')}. Required: name, phone, business_name`
      }, { status: 422 })
    }

    const db = createSupabaseServiceClient()
    const errors: { row: number; error: string }[] = []
    const toInsert: object[] = []

    rows.forEach((row, idx) => {
      const rowNum = idx + 2 // +1 for header, +1 for 1-indexed
      if (!row.name?.trim()) { errors.push({ row: rowNum, error: 'Missing name' }); return }
      if (!row.phone?.trim()) { errors.push({ row: rowNum, error: 'Missing phone' }); return }
      if (!row.business_name?.trim()) { errors.push({ row: rowNum, error: 'Missing business_name' }); return }
      if (!validatePhone(row.phone)) { errors.push({ row: rowNum, error: `Invalid phone: ${row.phone}` }); return }

      const budget = row.budget ? parseFloat(row.budget) : null
      if (row.budget && isNaN(budget!)) { errors.push({ row: rowNum, error: `Invalid budget: ${row.budget}` }); return }

      toInsert.push({
        name: row.name.trim(),
        phone: row.phone.trim(),
        email: row.email?.trim() || null,
        budget: budget,
        notes: row.notes?.trim() ? `[${row.business_name.trim()}] ${row.notes.trim()}` : row.business_name.trim(),
        stage: 'new',
        ai_score: 50,
        source: 'csv_import',
        urgency: 'medium',
        confidence: 0.5,
        sentiment: 'neutral',
      })
    })

    let imported = 0
    const dbErrors: { row: number; error: string }[] = []
    const leadIds: string[] = []

    // Insert in batches of 50
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50)
      const { data, error } = await db.from('leads').insert(batch).select('id')
      if (error) {
        batch.forEach((_, batchIdx) => {
          dbErrors.push({ row: i + batchIdx + 2, error: error.message })
        })
      } else {
        imported += data?.length ?? 0
        data?.forEach((r: any) => r.id && leadIds.push(r.id))
      }
    }

    const allErrors = [...errors, ...dbErrors]
    return NextResponse.json({
      imported,
      failed: allErrors.length,
      total: rows.length,
      errors: allErrors.slice(0, 20), // Cap at 20 errors shown
      lead_ids: leadIds,              // Returned so the UI can auto-score imported leads
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}