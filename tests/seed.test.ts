import Database from 'better-sqlite3'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData, SEED_VERSION_KEY, LATEST_SEED_VERSION } from '../src/database/seed'
import { BRAND_CATALOG_V2 } from '../src/database/catalog/brands'
import { BRAND_CODE_MAP, BRAND_CODE_ALIASES } from '../src/shared/device-utils'

console.log('--- Running Versioned Seed & Brand Catalog Tests ---')

let passed = true
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`✅ ${name}`)
  else {
    console.error(`❌ ${name} ${detail}`)
    passed = false
  }
}

const ALLOWED_BRANDS = [
  'Samsung',
  'Xiaomi',
  'Redmi',
  'Poco',
  'Oppo',
  'Realme',
  'Infinix',
  'Tecno',
  'Itel',
  'Huawei',
  'Honor',
  'OnePlus',
  'Motorola',
  'Nokia',
  'Google Pixel',
  'Sony',
  'LG',
  'HTC',
  'Asus',
  'Lenovo',
  'Alcatel',
  'TCL',
  'ZTE',
  'Nothing',
  'Meizu'
]
const REMOVED_BRANDS = [
  'Apple',
  'Vivo',
  'Condor',
  'IRIS',
  'KXD',
  'Stream System',
  'Brandt',
  'Evertek',
  'Wiko',
  'Doogee',
  'iQOO',
  'Nubia',
  'BlackBerry',
  'Fairphone'
].concat([
  'Vsmart',
  'Walton',
  'Hisense',
  'Black Shark',
  'RedMagic',
  'AGM',
  'Cat',
  'Sharp',
  'Panasonic',
  'Philips',
  'BLU'
])

const count = (db: Database.Database, sql: string, ...params: unknown[]): number =>
  (db.prepare(sql).get(...params) as { c: number }).c

function freshDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  initializeSchema(db)
  return db
}

// 1. Fresh database gets every pack once
{
  const db = freshDb()
  seedInitialData(db)
  const version = (db.prepare(`SELECT value FROM Setting WHERE key = ?`).get(SEED_VERSION_KEY) as { value: string })
    .value
  check('fresh DB is stamped with the latest seed_version', version === String(LATEST_SEED_VERSION), version)
  const brands = count(db, `SELECT COUNT(*) c FROM Brand`)
  const models = count(db, `SELECT COUNT(*) c FROM Model`)
  check(`catalog has exactly the 25 known brands (got ${brands})`, brands === 25 && brands === BRAND_CATALOG_V2.length)
  check(`catalog has 200+ models (got ${models})`, models >= 200)
  check(
    'core data seeded (2 technicians, 4 categories, 5 accessories)',
    count(db, `SELECT COUNT(*) c FROM Technician`) === 2 &&
      count(db, `SELECT COUNT(*) c FROM RepairCategory`) === 4 &&
      count(db, `SELECT COUNT(*) c FROM Accessories`) === 5
  )
  const dupBrands = count(db, `SELECT COUNT(*) c FROM (SELECT lower(name) n FROM Brand GROUP BY n HAVING COUNT(*) > 1)`)
  const dupModels = count(
    db,
    `SELECT COUNT(*) c FROM (SELECT brand_id, lower(name) n FROM Model GROUP BY brand_id, n HAVING COUNT(*) > 1)`
  )
  check('no case-insensitive duplicate brands or models', dupBrands === 0 && dupModels === 0)
  for (const name of ALLOWED_BRANDS) {
    check(`brand present: ${name}`, count(db, `SELECT COUNT(*) c FROM Brand WHERE name = ?`, name) === 1)
  }
  for (const name of REMOVED_BRANDS) {
    check(`brand absent: ${name}`, count(db, `SELECT COUNT(*) c FROM Brand WHERE lower(name) = lower(?)`, name) === 0)
  }
  check('no Apple/iPhone models seeded', count(db, `SELECT COUNT(*) c FROM Model WHERE name LIKE 'iPhone%'`) === 0)

  // idempotent
  seedInitialData(db)
  check(
    'running seed again changes nothing',
    count(db, `SELECT COUNT(*) c FROM Brand`) === brands && count(db, `SELECT COUNT(*) c FROM Model`) === models
  )

  // 2. Deleted items do NOT come back (the original bug)
  db.prepare(`DELETE FROM Brand WHERE name = 'Tecno'`).run()
  db.prepare(`DELETE FROM Brand WHERE name = 'Meizu'`).run()
  db.prepare(`DELETE FROM Model WHERE name = 'Galaxy A54'`).run()
  db.prepare(`DELETE FROM RepairCategory WHERE name = 'تغيير شاشة'`).run()
  db.prepare(`DELETE FROM Accessories WHERE name = 'شاحن'`).run()
  db.prepare(`DELETE FROM Technician WHERE name = 'الشريك'`).run()
  initializeSchema(db) // what initDatabase does on every launch
  seedInitialData(db)
  check(
    'deleted brands stay deleted after re-init',
    count(db, `SELECT COUNT(*) c FROM Brand WHERE name IN ('Tecno','Meizu')`) === 0
  )
  check('deleted model stays deleted', count(db, `SELECT COUNT(*) c FROM Model WHERE name = 'Galaxy A54'`) === 0)
  check(
    'deleted category/accessory/technician stay deleted',
    count(db, `SELECT COUNT(*) c FROM RepairCategory WHERE name = 'تغيير شاشة'`) === 0 &&
      count(db, `SELECT COUNT(*) c FROM Accessories WHERE name = 'شاحن'`) === 0 &&
      count(db, `SELECT COUNT(*) c FROM Technician WHERE name = 'الشريك'`) === 0
  )
  db.close()
}

// 3. Legacy database (data, no seed_version): only the new pack is applied, nothing lost or duplicated
{
  const db = freshDb()
  db.prepare(`INSERT INTO Technician (name, is_partner) VALUES ('أنا', 0)`).run()
  db.prepare(`INSERT INTO RepairCategory (name, default_split_percentage) VALUES ('صيانة خاصة', 55)`).run()
  db.prepare(`INSERT INTO Brand (name) VALUES ('samsung')`).run() // the user's own casing
  db.prepare(`INSERT INTO Brand (name) VALUES ('My Local Brand')`).run()
  const samsungId = (db.prepare(`SELECT id FROM Brand WHERE name = 'samsung'`).get() as { id: number }).id
  db.prepare(`INSERT INTO Model (brand_id, name) VALUES (?, 'galaxy a15')`).run(samsungId) // same as catalog, other case
  check(
    'legacy fixture has no seed_version',
    count(db, `SELECT COUNT(*) c FROM Setting WHERE key = ?`, SEED_VERSION_KEY) === 0
  )

  seedInitialData(db)

  check(
    'legacy DB: pack 1 not re-applied (no default categories/accessories/partner re-added)',
    count(db, `SELECT COUNT(*) c FROM RepairCategory`) === 1 &&
      count(db, `SELECT COUNT(*) c FROM Accessories`) === 0 &&
      count(db, `SELECT COUNT(*) c FROM Technician`) === 1
  )
  check(
    'legacy DB: no duplicate of the user samsung brand',
    count(db, `SELECT COUNT(*) c FROM Brand WHERE lower(name) = 'samsung'`) === 1
  )
  check(
    'legacy DB: user brand kept with original casing',
    count(db, `SELECT COUNT(*) c FROM Brand WHERE name = 'samsung'`) === 1
  )
  check(
    'legacy DB: custom brand untouched',
    count(db, `SELECT COUNT(*) c FROM Brand WHERE name = 'My Local Brand'`) === 1
  )
  check(
    'legacy DB: no duplicate Galaxy A15 model',
    count(db, `SELECT COUNT(*) c FROM Model WHERE brand_id = ? AND lower(name) = 'galaxy a15'`, samsungId) === 1
  )
  check(
    'legacy DB: new catalog brands added',
    count(db, `SELECT COUNT(*) c FROM Brand WHERE name = 'Meizu'`) === 1 &&
      count(db, `SELECT COUNT(*) c FROM Brand`) === 19 // 25 catalog - 7 absent pack-1 brands + 'My Local Brand'
  )
  check(
    'legacy DB: new models attach to the existing brand',
    count(db, `SELECT COUNT(*) c FROM Model WHERE brand_id = ?`, samsungId) > 20
  )
  db.close()
}

// 3b. Legacy database where the user deliberately deleted Honor (a pack-1 brand): never brought back
{
  const db = freshDb()
  db.prepare(`INSERT INTO Technician (name, is_partner) VALUES ('أنا', 0)`).run()
  db.prepare(`INSERT INTO Brand (name) VALUES ('Samsung')`).run() // pack-1 brand the user kept
  db.prepare(`INSERT INTO Brand (name) VALUES ('Apple')`).run() // pack-1 brand of the old app: left untouched
  // Honor, Xiaomi, ... (the other pack-1 brands) were deleted on purpose
  seedInitialData(db)
  check(
    'legacy DB: deleted Honor stays deleted after the upgrade',
    count(db, `SELECT COUNT(*) c FROM Brand WHERE lower(name) = 'honor'`) === 0
  )
  check(
    'legacy DB: every deleted pack-1 brand stays deleted',
    count(
      db,
      `SELECT COUNT(*) c FROM Brand WHERE name IN ('Xiaomi','Huawei','Oppo','Realme','Infinix','Tecno','Honor')`
    ) === 0
  )
  check(
    'legacy DB: kept pack-1 brand still gets the new models',
    count(db, `SELECT COUNT(*) c FROM Model m JOIN Brand b ON b.id = m.brand_id WHERE b.name = 'Samsung'`) > 20
  )
  check(
    'legacy DB: brands that were never in pack 1 are added',
    count(db, `SELECT COUNT(*) c FROM Brand WHERE name IN ('Redmi','Poco','Itel','Sony','Meizu')`) === 5
  )
  check(
    'legacy DB: existing Apple brand is never deleted',
    count(db, `SELECT COUNT(*) c FROM Brand WHERE name = 'Apple'`) === 1
  )
  db.close()
}

// 3c. Same guarantee on a database stamped with seed_version = 1
{
  const db = freshDb()
  db.prepare(`INSERT INTO Setting (key, value) VALUES (?, '1')`).run(SEED_VERSION_KEY)
  db.prepare(`INSERT INTO Brand (name) VALUES ('Samsung')`).run()
  seedInitialData(db)
  check(
    'seed_version=1 DB: deleted pack-1 brand stays deleted',
    count(db, `SELECT COUNT(*) c FROM Brand WHERE name = 'Honor'`) === 0
  )
  db.close()
}

// 4. Catalog data sanity
{
  const names = BRAND_CATALOG_V2.map((b) => b.name.toLowerCase())
  check('catalog brand names are unique (case-insensitive)', new Set(names).size === names.length)
  check(
    'catalog has no blank names',
    BRAND_CATALOG_V2.every((b) => b.name.trim() && (b.models ?? []).every((m) => m.trim()))
  )
  check(
    'catalog holds exactly the allowed brands',
    JSON.stringify([...names].sort()) === JSON.stringify(ALLOWED_BRANDS.map((n) => n.toLowerCase()).sort())
  )
  const withModels = BRAND_CATALOG_V2.filter((b) => b.models && b.models.length > 0).map((b) => b.name)
  for (const must of [
    'Samsung',
    'Xiaomi',
    'Redmi',
    'Poco',
    'Oppo',
    'Realme',
    'Infinix',
    'Tecno',
    'Itel',
    'Huawei',
    'Honor'
  ]) {
    check(`major brand has models: ${must}`, withModels.includes(must))
  }
}

// 5. Brand code map: each two-letter code belongs to one brand family
{
  const byCode = new Map<string, string[]>()
  for (const [brand, code] of Object.entries(BRAND_CODE_MAP)) {
    byCode.set(code, [...(byCode.get(code) ?? []), brand])
  }
  const clashes = [...byCode.entries()].filter(([, brands]) => {
    if (brands.length < 2) return false
    return !BRAND_CODE_ALIASES.some((family) => brands.every((b) => family.includes(b)))
  })
  check('brand codes are unique (except documented aliases)', clashes.length === 0, JSON.stringify(clashes))
}

if (!passed) process.exit(1)
console.log('\n🎉 ALL SEED & CATALOG TESTS PASSED! 🎉')
process.exit(0)
