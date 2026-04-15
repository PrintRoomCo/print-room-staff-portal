/**
 * Quote Builder Data Reconciliation Script
 *
 * Reads CSV files from business-logic/ and reconciles the Supabase database.
 * Each step is idempotent (safe to re-run).
 *
 * Usage: npx tsx scripts/reconcile-quote-data.ts
 *
 * Env vars required (from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── Config ──────────────────────────────────────────────────────────────────

const CSV_DIR = resolve(__dirname, '../../business-logic')

// Load .env.local manually (avoid dotenv dependency)
const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.*)$/)
  if (match) process.env[match[1]] = match[2].trim()
}

const supabase: SupabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Helpers ─────────────────────────────────────────────────────────────────

function readCSV<T>(filename: string): T[] {
  const content = readFileSync(resolve(CSV_DIR, filename), 'utf-8')
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as T[]
}

function toArray(s: string | undefined): string[] {
  if (!s || !s.trim()) return []
  return s
    .trim()
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
}

function toBool(s: string | undefined): boolean {
  return s?.trim().toLowerCase() === 'true'
}

const log = {
  added: 0,
  updated: 0,
  skipped: 0,
  errors: [] as string[],
}

function resetLog() {
  log.added = 0
  log.updated = 0
  log.skipped = 0
  log.errors = []
}

function printLog(step: string) {
  console.log(
    `  ${step}: +${log.added} added, ~${log.updated} updated, =${log.skipped} skipped` +
      (log.errors.length ? `, ${log.errors.length} errors` : '')
  )
  for (const e of log.errors) console.log(`    ERROR: ${e}`)
  resetLog()
}

// ── Category name mapping (CSV lowercase → DB title case) ───────────────

const CATEGORY_MAP: Record<string, string> = {
  't-shirts': 'T-Shirt',
  hoodies: 'Hoodie',
  'crew fleece': 'Crew Fleece',
  polo: 'Polo',
  jackets: 'Jacket',
  'cap/hat': 'Headwear',
  longsleeves: 'Long Sleeve T-Shirt',
  pants: 'Pants',
  socks: 'Socks',
  'tea towel': 'Tea Towel',
  bags: 'Tote Bag',
  accessories: 'Accessories',
  active: 'Active',
  beanie: 'Beanie',
  belts: 'Belts',
  denim: 'Denim',
  dresses: 'Dresses',
  fleece: 'Fleece',
  gadgets: 'Gadgets',
  merino: 'Merino',
  overalls: 'Overalls',
  pullover: 'Pullover',
  rugbys: 'Rugbys',
  shirts: 'Shirts',
  shorts: 'Shorts',
  'singlets / tanks': 'Singlets / Tanks',
  sweatshirts: 'Sweatshirts',
  trackpants: 'Trackpants',
  underwear: 'Underwear',
  'zip fleece': 'Zip Fleece',
}

// ── Step 1: Price Tiers ─────────────────────────────────────────────────────

async function step1_priceTiers() {
  console.log('\nStep 1: Price Tiers')
  resetLog()

  interface PriceTierCSV {
    tierId: string
    tierName: string
    discount: string
  }
  const rows = readCSV<PriceTierCSV>('01_price_tiers.csv')

  for (const r of rows) {
    const { data: existing } = await supabase
      .from('price_tiers')
      .select('tier_id')
      .eq('tier_id', r.tierId)
      .maybeSingle()

    if (existing) {
      log.skipped++
      continue
    }

    const { error } = await supabase.from('price_tiers').insert({
      tier_id: r.tierId,
      tier_name: r.tierName,
      discount: r.discount === '' ? null : parseFloat(r.discount),
    })

    if (error) log.errors.push(`${r.tierId}: ${error.message}`)
    else log.added++
  }

  printLog('price_tiers')
}

// ── Step 3: Categories ──────────────────────────────────────────────────────

async function step3_categories() {
  console.log('\nStep 3: Categories')
  resetLog()

  const csvCategories = new Set(Object.values(CATEGORY_MAP))

  const { data: existing } = await supabase
    .from('categories')
    .select('name')

  const existingNames = new Set(existing?.map((c) => c.name) || [])

  for (const name of csvCategories) {
    if (existingNames.has(name)) {
      log.skipped++
      continue
    }

    const { error } = await supabase.from('categories').insert({
      name,
      category_type: ['Belts', 'Gadgets', 'Accessories'].includes(name)
        ? 'accessory'
        : 'product',
      platform: 'print-room',
    })

    if (error) log.errors.push(`${name}: ${error.message}`)
    else log.added++
  }

  printLog('categories')
}

// ── Step 4: Brands ──────────────────────────────────────────────────────────

async function step4_brands() {
  console.log('\nStep 4: Brands')
  resetLog()

  interface BrandCSV {
    name: string
  }
  const rows = readCSV<BrandCSV>('02_brands.csv')

  const { data: existing } = await supabase.from('brands').select('name')
  const existingNames = new Set(existing?.map((b) => b.name) || [])

  for (const r of rows) {
    const name = r.name.trim()
    if (existingNames.has(name)) {
      log.skipped++
      continue
    }

    const { error } = await supabase.from('brands').insert({
      name,
      platform: 'print-room',
    })

    if (error) log.errors.push(`${name}: ${error.message}`)
    else log.added++
  }

  printLog('brands')
}

// ── Step 2: Products ────────────────────────────────────────────────────────

async function step2_products() {
  console.log('\nStep 2: Products')
  resetLog()

  interface ProductCSV {
    id: string
    sourcingType: string
    sku: string
    brand: string
    name: string
    category: string
    baseCost: string
    active: string
    imageUrl: string
    productUrl: string
    notes: string
    sourcing: string
  }
  const rows = readCSV<ProductCSV>('03_products.csv')

  // Deduplicate by SKU (keep last)
  const deduped = new Map<string, ProductCSV>()
  for (const r of rows) {
    if (!r.category.startsWith('http')) {
      deduped.set(r.sku.trim(), r)
    }
  }

  // Load brand and category lookups
  const { data: brands } = await supabase.from('brands').select('id, name')
  const brandMap = new Map(brands?.map((b) => [b.name, b.id]) || [])

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
  const catMap = new Map(categories?.map((c) => [c.name, c.id]) || [])

  // Load existing products by SKU
  const { data: existingProducts } = await supabase
    .from('products')
    .select('id, sku, is_active, base_cost')
    .eq('platform', 'print-room')
    .not('sku', 'is', null)
  const existingSKUs = new Map(
    existingProducts?.map((p) => [p.sku, p]) || []
  )

  let batchInserts: Record<string, unknown>[] = []

  for (const [sku, r] of deduped) {
    const existing = existingSKUs.get(sku)

    if (existing) {
      // Update existing: activate + update base_cost
      const active = toBool(r.active)
      if (!existing.is_active && active) {
        await supabase
          .from('products')
          .update({
            is_active: true,
            base_cost: parseFloat(r.baseCost),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
        log.updated++
      } else {
        log.skipped++
      }
      continue
    }

    // Insert new product
    const brandId = brandMap.get(r.brand.trim())
    const dbCatName = CATEGORY_MAP[r.category.trim()]
    const categoryId = dbCatName ? catMap.get(dbCatName) : null

    if (!brandId) {
      log.errors.push(`Brand not found: "${r.brand}" (SKU: ${sku})`)
      continue
    }
    if (!categoryId) {
      log.errors.push(`Category not found: "${r.category}" → "${dbCatName}" (SKU: ${sku})`)
      continue
    }

    batchInserts.push({
      name: r.name.trim(),
      sku: sku,
      brand_id: brandId,
      category_id: categoryId,
      base_cost: parseFloat(r.baseCost),
      is_active: toBool(r.active),
      image_url: r.imageUrl?.trim() || null,
      platform: 'print-room',
      garment_family: r.category.trim(),
      specs: {
        csv_id: r.id,
        sourcing_type: r.sourcingType,
        sourcing: r.sourcing || 'off-the-shelf',
        notes: r.notes,
        product_url: r.productUrl,
      },
    })

    // Batch insert every 100
    if (batchInserts.length >= 100) {
      const { error } = await supabase.from('products').insert(batchInserts)
      if (error) log.errors.push(`Batch insert: ${error.message}`)
      else log.added += batchInserts.length
      batchInserts = []
    }
  }

  // Insert remaining
  if (batchInserts.length > 0) {
    const { error } = await supabase.from('products').insert(batchInserts)
    if (error) log.errors.push(`Batch insert: ${error.message}`)
    else log.added += batchInserts.length
  }

  printLog('products')
}

// ── Step 5: Product Pricing Tiers ───────────────────────────────────────────

async function step5_pricingTiers() {
  console.log('\nStep 5: Product Pricing Tiers')
  resetLog()

  interface MultiplierCSV {
    sourcingType: string
    category: string
    minQty: string
    maxQty: string
    multiplier: string
    shipping: string
  }
  const multipliers = readCSV<MultiplierCSV>('05_multipliers.csv')

  // Group multipliers by category
  const multByCategory = new Map<string, MultiplierCSV[]>()
  for (const m of multipliers) {
    if (m.sourcingType.trim() !== 'NZ APPAREL') continue
    const cat = m.category.trim()
    if (!multByCategory.has(cat)) multByCategory.set(cat, [])
    multByCategory.get(cat)!.push(m)
  }

  // Find active products missing pricing tiers
  const { data: products } = await supabase
    .from('products')
    .select('id, sku, base_cost, garment_family')
    .eq('platform', 'print-room')
    .eq('is_active', true)

  if (!products) return

  // Get existing tier product IDs
  const { data: existingTiers } = await supabase
    .from('product_pricing_tiers')
    .select('product_id')
  const hassTiers = new Set(existingTiers?.map((t) => t.product_id) || [])

  const missing = products.filter((p) => !hassTiers.has(p.id))
  console.log(`  ${missing.length} products missing pricing tiers`)

  let batchInserts: Record<string, unknown>[] = []

  for (const p of missing) {
    const mults = multByCategory.get(p.garment_family)
    if (!mults) {
      log.errors.push(
        `No multipliers for category "${p.garment_family}" (SKU: ${p.sku})`
      )
      continue
    }

    for (let i = 0; i < mults.length; i++) {
      const m = mults[i]
      const unitPrice =
        parseFloat(String(p.base_cost)) * parseFloat(m.multiplier) +
        parseFloat(m.shipping)

      batchInserts.push({
        product_id: p.id,
        min_quantity: parseInt(m.minQty),
        max_quantity: parseInt(m.maxQty),
        unit_price: Math.round(unitPrice * 100) / 100,
        sku: p.sku,
        tier_level: i + 1,
        is_active: true,
      })
    }

    log.added += mults.length

    // Batch insert every 500
    if (batchInserts.length >= 500) {
      const { error } = await supabase
        .from('product_pricing_tiers')
        .insert(batchInserts)
      if (error) log.errors.push(`Batch insert: ${error.message}`)
      batchInserts = []
    }
  }

  if (batchInserts.length > 0) {
    const { error } = await supabase
      .from('product_pricing_tiers')
      .insert(batchInserts)
    if (error) log.errors.push(`Batch insert: ${error.message}`)
  }

  printLog('product_pricing_tiers')
}

// ── Step 6: Category Shipping ───────────────────────────────────────────────

async function step6_categoryShipping() {
  console.log('\nStep 6: Category Shipping')
  resetLog()

  interface MultiplierCSV {
    sourcingType: string
    category: string
    shipping: string
  }
  const multipliers = readCSV<MultiplierCSV>('05_multipliers.csv')

  // Get distinct shipping per category
  const shippingByCategory = new Map<string, number>()
  for (const m of multipliers) {
    if (m.sourcingType.trim() === 'NZ APPAREL') {
      shippingByCategory.set(m.category.trim(), parseFloat(m.shipping))
    }
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name')
  const catMap = new Map(categories?.map((c) => [c.name, c.id]) || [])

  const { data: existing } = await supabase
    .from('category_shipping')
    .select('category_id')
  const existingIds = new Set(existing?.map((c) => c.category_id) || [])

  for (const [csvCat, shipping] of shippingByCategory) {
    const dbCatName = CATEGORY_MAP[csvCat]
    const categoryId = dbCatName ? catMap.get(dbCatName) : null

    if (!categoryId) {
      log.errors.push(`Category not found: "${csvCat}"`)
      continue
    }

    if (existingIds.has(categoryId)) {
      log.skipped++
      continue
    }

    const { error } = await supabase.from('category_shipping').insert({
      category_id: categoryId,
      shipping_per_unit: shipping,
    })

    if (error) log.errors.push(`${csvCat}: ${error.message}`)
    else log.added++
  }

  printLog('category_shipping')
}

// ── Step 8: Finishes ────────────────────────────────────────────────────────

async function step8_finishes() {
  console.log('\nStep 8: Finishes')
  resetLog()

  interface FinishCSV {
    finishType: string
    sourcingType: string
    applicableProductTypes: string
    notApplicableProductTypes: string
    minQty: string
    maxQty: string
    price: string
    notes: string
    active: string
    pricingStructure: string
  }
  const rows = readCSV<FinishCSV>('09_finishes.csv')

  const { count } = await supabase
    .from('finishes')
    .select('*', { count: 'exact', head: true })

  if (count && count > 0) {
    console.log(`  finishes: already has ${count} rows, skipping`)
    return
  }

  const data = rows.map((r) => ({
    finish_type: r.finishType.trim(),
    sourcing_type: r.sourcingType.trim(),
    applicable_product_types: toArray(r.applicableProductTypes),
    not_applicable_product_types: toArray(r.notApplicableProductTypes),
    min_qty: parseInt(r.minQty),
    max_qty: parseInt(r.maxQty),
    price: parseFloat(r.price),
    notes: r.notes?.trim() || '',
    is_active: toBool(r.active),
    pricing_structure: r.pricingStructure?.trim() || '',
  }))

  const { error } = await supabase.from('finishes').insert(data)
  if (error) log.errors.push(error.message)
  else log.added = data.length

  printLog('finishes')
}

// ── Step 9: Decoration Locations ────────────────────────────────────────────

async function step9_decorationLocations() {
  console.log('\nStep 9: Decoration Locations')
  resetLog()

  const { count } = await supabase
    .from('decoration_locations')
    .select('*', { count: 'exact', head: true })

  if (count && count > 0) {
    console.log(`  decoration_locations: already has ${count} rows, skipping`)
    return
  }

  interface LocationCSV {
    sourcingType: string
    location: string
    active: string
  }
  const rows = readCSV<LocationCSV>('07_locations.csv')

  const placementMap: Record<string, string> = {
    'Left Chest': 'front',
    'Right Chest': 'front',
    'Centre Front': 'front',
    'Bottom Front': 'front',
    Shoulders: 'front',
    'Centre Back': 'back',
    'Bottom Back': 'back',
    'Left Upper Sleeve': 'sleeve',
    'Left Lower Sleeve': 'sleeve',
    'Right Upper Sleeve': 'sleeve',
    'Right Lower Sleeve': 'sleeve',
    Cuff: 'sleeve',
    'Left Side': 'front',
    'Right Side': 'front',
  }

  const data = rows.map((r, i) => ({
    sourcing_type: r.sourcingType.trim(),
    location: r.location.trim(),
    placement_key: placementMap[r.location.trim()] || 'front',
    is_active: toBool(r.active),
    sort_order: i + 1,
  }))

  const { error } = await supabase.from('decoration_locations').insert(data)
  if (error) log.errors.push(error.message)
  else log.added = data.length

  printLog('decoration_locations')
}

// ── Step 10: Vinyl Pricing ──────────────────────────────────────────────────

async function step10_vinylPricing() {
  console.log('\nStep 10: Vinyl Pricing')
  resetLog()

  interface DecorationCSV {
    sourcingType: string
    decorationType: string
    decorationDetail: string
    minQty: string
    maxQty: string
    price: string
    setupFee: string
  }
  const rows = readCSV<DecorationCSV>('06_decorations.csv')
  const vinylRows = rows.filter(
    (r) => r.decorationType?.trim().toLowerCase().startsWith('vinyl')
  )

  // Check existing
  const { data: existing } = await supabase
    .from('service_pricing_rules')
    .select('method_key')
    .like('method_key', 'vinyl_%')
  const existingKeys = new Set(existing?.map((r) => r.method_key) || [])

  for (const r of vinylRows) {
    const detail = r.decorationDetail.trim()
    const methodKey = detail
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')

    const fullKey = `vinyl_${methodKey}`
    if (existingKeys.has(fullKey)) {
      log.skipped++
      continue
    }

    const { error } = await supabase.from('service_pricing_rules').insert({
      method_key: fullKey,
      display_name: detail,
      min_qty: parseInt(r.minQty),
      max_qty: parseInt(r.maxQty),
      unit_price: parseFloat(r.price),
    })

    if (error) log.errors.push(`${detail}: ${error.message}`)
    else log.added++
  }

  printLog('service_pricing_rules (vinyl)')
}

// ── Step 11: Order Extras ───────────────────────────────────────────────────

async function step11_orderExtras() {
  console.log('\nStep 11: Order Extras')
  resetLog()

  const { count } = await supabase
    .from('order_extras')
    .select('*', { count: 'exact', head: true })

  if (count && count > 0) {
    console.log(`  order_extras: already has ${count} rows, skipping`)
    return
  }

  interface ExtraCSV {
    name: string
    sourcingType: string
    appliesTo: string
    minQty: string
    maxQty: string
    price: string
    pricingStructure: string
    category: string
  }
  const rows = readCSV<ExtraCSV>('08_extras.csv')
  const orderExtras = rows.filter(
    (r) => r.category?.trim().toLowerCase() === 'order'
  )

  const data = orderExtras.map((r, i) => ({
    name: r.name.trim(),
    applies_to: r.appliesTo.trim(),
    price: r.price.trim(),
    pricing_structure: r.pricingStructure?.trim() || '',
    min_qty: parseInt(r.minQty),
    max_qty: parseInt(r.maxQty),
    sort_order: i + 1,
  }))

  const { error } = await supabase.from('order_extras').insert(data)
  if (error) log.errors.push(error.message)
  else log.added = data.length

  printLog('order_extras')
}

// ── Step 13: Quote Templates ────────────────────────────────────────────────

async function step13_quoteTemplates() {
  console.log('\nStep 13: Quote Templates')
  resetLog()

  interface TemplateCSV {
    id: string
    name: string
    filename: string
  }
  const rows = readCSV<TemplateCSV>('10_templates.csv')

  for (const r of rows) {
    const { data: existing } = await supabase
      .from('quote_templates')
      .select('id')
      .eq('id', r.id.trim())
      .maybeSingle()

    if (existing) {
      log.skipped++
      continue
    }

    const { error } = await supabase.from('quote_templates').insert({
      id: r.id.trim(),
      name: r.name.trim(),
      filename: r.filename.trim(),
    })

    if (error) log.errors.push(`${r.id}: ${error.message}`)
    else log.added++
  }

  printLog('quote_templates')
}

// ── Verification ────────────────────────────────────────────────────────────

async function verify() {
  console.log('\n── Verification ──')

  const checks = [
    { table: 'price_tiers', expected: 4 },
    { table: 'categories', expected: 30, op: '>=' as const },
    { table: 'brands', expected: 37, op: '>=' as const },
    { table: 'finishes', expected: 57 },
    { table: 'decoration_locations', expected: 10, op: '>=' as const },
    { table: 'order_extras', expected: 6, op: '>=' as const },
    { table: 'quote_history', expected: 0 },
    { table: 'quote_templates', expected: 1 },
    { table: 'category_shipping', expected: 30 },
  ]

  for (const c of checks) {
    const { count } = await supabase
      .from(c.table)
      .select('*', { count: 'exact', head: true })

    const ok =
      c.op === '>=' ? (count ?? 0) >= c.expected : count === c.expected
    const icon = ok ? 'OK' : 'MISMATCH'
    console.log(
      `  ${icon} ${c.table}: ${count} rows (expected ${c.op === '>=' ? '>=' : ''}${c.expected})`
    )
  }

  // Active print-room products
  const { count: activeProducts } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('platform', 'print-room')
    .eq('is_active', true)

  console.log(`  ${(activeProducts ?? 0) >= 1200 ? 'OK' : 'MISMATCH'} active print-room products: ${activeProducts} (expected >=1200)`)

  // Pricing tiers coverage
  const { count: totalTiers } = await supabase
    .from('product_pricing_tiers')
    .select('*', { count: 'exact', head: true })

  console.log(`  ${(totalTiers ?? 0) >= 7000 ? 'OK' : 'MISMATCH'} product_pricing_tiers: ${totalTiers} rows (expected >=7000)`)

  // Vinyl rules
  const { data: vinylRules } = await supabase
    .from('service_pricing_rules')
    .select('method_key')
    .like('method_key', 'vinyl_%')

  console.log(`  ${(vinylRules?.length ?? 0) >= 4 ? 'OK' : 'MISMATCH'} vinyl pricing rules: ${vinylRules?.length} (expected >=4)`)
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Quote Builder Data Reconciliation')
  console.log('=' .repeat(50))
  console.log(`CSV source: ${CSV_DIR}`)

  await step1_priceTiers()
  await step3_categories()
  await step4_brands()
  await step2_products()
  await step5_pricingTiers()
  await step6_categoryShipping()

  // Step 7 (MTO) is handled in step2 if MTO SKUs are in CSV
  console.log('\nStep 7: MTO products — handled via Supabase MCP migration')

  await step8_finishes()
  await step9_decorationLocations()
  await step10_vinylPricing()
  await step11_orderExtras()

  console.log('\nStep 12: quote_history — table created via migration (0 rows, audit trail)')

  await step13_quoteTemplates()
  await verify()

  console.log('\nDone!')
}

main().catch(console.error)
