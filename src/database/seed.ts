import type Database from 'better-sqlite3'
import { CORE_ACCESSORIES_V1, CORE_BRANDS_V1, CORE_CATEGORIES_V1, CORE_TECHNICIANS_V1 } from './catalog/core'
import { BRAND_CATALOG_V2, type CatalogBrand } from './catalog/brands'

/**
 * Versioned seed.
 *
 * Each pack is applied at most once in the lifetime of a database (tracked by the `seed_version`
 * key in the Setting table), so items the user deletes never come back on the next launch.
 * Packs are additive only: they never delete or rename anything, and brand/model names are
 * compared case-insensitively to avoid duplicates ("samsung" = "Samsung").
 *
 * A database that already contains data but has no `seed_version` (created before versioning
 * existed) is treated as having pack 1 applied. Later packs never bring back a brand that pack 1
 * seeded and that is no longer in such a database: the user deleted it on purpose.
 */
export const SEED_VERSION_KEY = 'seed_version'

interface SeedPack {
  version: number
  /** `previousVersion` is the pack version the database was at before this run (0 = brand new) */
  apply: (db: Database.Database, previousVersion: number) => void
}

function ensureBrandId(db: Database.Database, name: string): number {
  const existing = db.prepare(`SELECT id FROM Brand WHERE lower(name) = lower(?)`).get(name) as
    { id: number } | undefined
  if (existing) return existing.id
  return Number(db.prepare(`INSERT INTO Brand (name) VALUES (?)`).run(name).lastInsertRowid)
}

function addModels(db: Database.Database, brandId: number, models: string[]): void {
  const exists = db.prepare(`SELECT 1 FROM Model WHERE brand_id = ? AND lower(name) = lower(?)`)
  const insert = db.prepare(`INSERT INTO Model (brand_id, name) VALUES (?, ?)`)
  for (const model of models) {
    if (!exists.get(brandId, model)) insert.run(brandId, model)
  }
}

function addCatalog(db: Database.Database, catalog: CatalogBrand[], skipBrands: Set<string> = new Set()): void {
  const brandExists = db.prepare(`SELECT 1 FROM Brand WHERE lower(name) = lower(?)`)
  for (const brand of catalog) {
    if (skipBrands.has(brand.name.toLowerCase()) && !brandExists.get(brand.name)) continue
    const brandId = ensureBrandId(db, brand.name)
    if (brand.models) addModels(db, brandId, brand.models)
  }
}

const SEED_PACKS: SeedPack[] = [
  {
    // Original first-run data: technicians, repair categories, accessories, a few brands
    version: 1,
    apply: (db) => {
      const insertTechnician = db.prepare(`INSERT OR IGNORE INTO Technician (name, is_partner) VALUES (?, ?)`)
      for (const tech of CORE_TECHNICIANS_V1) insertTechnician.run(tech.name, tech.isPartner)

      const insertCategory = db.prepare(
        `INSERT OR IGNORE INTO RepairCategory (name, default_split_percentage) VALUES (?, ?)`
      )
      for (const cat of CORE_CATEGORIES_V1) insertCategory.run(cat.name, cat.split)

      const insertAccessory = db.prepare(`INSERT OR IGNORE INTO Accessories (name) VALUES (?)`)
      for (const acc of CORE_ACCESSORIES_V1) insertAccessory.run(acc)

      addCatalog(
        db,
        Object.entries(CORE_BRANDS_V1).map(([name, models]) => ({ name, models }))
      )
    }
  },
  {
    // Well-known phone brand catalog (+ models for the major brands)
    version: 2,
    apply: (db, previousVersion) => {
      // Pack 1 already ran on this database: a pack-1 brand that is missing now was deleted by
      // the user, so it is not re-added (its missing models are still filled in if it exists).
      const deletedByUser =
        previousVersion >= 1 ? new Set(Object.keys(CORE_BRANDS_V1).map((n) => n.toLowerCase())) : new Set<string>()
      addCatalog(db, BRAND_CATALOG_V2, deletedByUser)
    }
  }
]

export const LATEST_SEED_VERSION = SEED_PACKS[SEED_PACKS.length - 1].version

function readSeedVersion(db: Database.Database): number {
  const row = db.prepare(`SELECT value FROM Setting WHERE key = ?`).get(SEED_VERSION_KEY) as
    { value: string } | undefined
  if (row) {
    const parsed = parseInt(row.value, 10)
    if (!isNaN(parsed)) return parsed
  }

  // No version recorded: a database that already holds data predates versioning,
  // so pack 1 was effectively applied (and may have been customised by the user since).
  const hasData = ['Technician', 'RepairCategory', 'Accessories', 'Brand', 'Ticket'].some(
    (table) => db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get() !== undefined
  )
  return hasData ? 1 : 0
}

export function seedInitialData(db: Database.Database): void {
  const run = db.transaction(() => {
    const current = readSeedVersion(db)
    const setVersion = db.prepare(`
      INSERT INTO Setting (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)

    for (const pack of SEED_PACKS) {
      if (pack.version > current) pack.apply(db, current)
    }
    // Record the version even when nothing ran, so a legacy database is "stamped" once
    setVersion.run(SEED_VERSION_KEY, String(Math.max(current, LATEST_SEED_VERSION)))
  })

  run()
}
