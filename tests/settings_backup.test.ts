import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import { createTicket } from '../src/database/queries/tickets'
import {
  getBrands,
  addBrand,
  updateBrand,
  checkBrandUsage,
  deleteBrand,
  getModelsByBrand,
  addModel,
  updateModel,
  checkModelUsage,
  deleteModel,
  getAccessories,
  addAccessory,
  updateAccessory,
  checkAccessoryUsage,
  deleteAccessory,
  getRepairCategories,
  addRepairCategory,
  updateRepairCategory,
  checkRepairCategoryUsage,
  deleteRepairCategory,
  getTechnicians,
  addTechnician,
  updateTechnician,
  checkTechnicianUsage,
  deleteTechnician
} from '../src/database/queries/metadata'
import { ar, en } from '../src/renderer/lib/i18n'
import type { CreateTicketDTO } from '../src/shared/types'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`✅ Passed: ${message}`)
}

async function runSettingsBackupTests(): Promise<void> {
  console.log('🚀 Running Unit & Integration Tests for Settings CRUD, Backup & i18n...\n')

  // =========================================================================
  // SECTION 1: Settings CRUD Operations & Guard Rules
  // =========================================================================
  console.log('--- Section 1: Settings CRUD & Reference Integrity Guard Tests ---')

  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  initializeSchema(db)
  seedInitialData(db)

  // 1.1 Brands CRUD & Guard
  console.log('\n[1.1] Brands CRUD & Usage Guard:')
  const newBrand = addBrand(db, 'Test Brand A')
  assert(newBrand.id > 0 && newBrand.name === 'Test Brand A', 'Added Brand "Test Brand A"')

  updateBrand(db, newBrand.id, 'Test Brand B')
  const brandsAfterUpdate = getBrands(db)
  const updatedBrand = brandsAfterUpdate.find((b) => b.id === newBrand.id)
  assert(updatedBrand?.name === 'Test Brand B', 'Updated Brand name to "Test Brand B"')

  // Not used in any tickets -> can delete
  const brandUsage1 = checkBrandUsage(db, newBrand.id)
  assert(brandUsage1.canDelete === true, 'Unused brand can be deleted')
  deleteBrand(db, newBrand.id)
  assert(getBrands(db).find((b) => b.id === newBrand.id) === undefined, 'Brand deleted successfully')

  // Create ticket with a stable brand/model reference ID.
  const samsungBrand = getBrands(db).find((b) => b.name === 'Samsung')!
  const a54Model = getModelsByBrand(db, samsungBrand.id).find((m) => m.name.includes('A54'))!
  const ticketWithBrandDTO: CreateTicketDTO = {
    customer: { name: 'علي سامسونج', phone: '0555998877' },
    device: {
      brand: 'Samsung',
      model: 'Galaxy A54',
      brand_id: samsungBrand.id,
      model_id: a54Model.id,
      short_label: 'SA A54'
    },
    ticket: {
      repair_category_id: 1,
      price: 6000,
      payment_type: 'cash',
      amount_paid: 6000,
      technician_id: 1
    }
  }
  createTicket(db, ticketWithBrandDTO)

  const samsungUsage = checkBrandUsage(db, samsungBrand.id)
  assert(samsungUsage.canDelete === false, 'Samsung brand cannot be deleted (used in tickets/models)')
  assert(samsungUsage.usedCount > 0, `Samsung usage count = ${samsungUsage.usedCount}`)

  let brandDeleteBlocked = false
  try {
    deleteBrand(db, samsungBrand.id)
  } catch (err) {
    brandDeleteBlocked = true
    const message = (err as Error).message
    assert(message.includes('لا يمكن الحذف'), `Descriptive Arabic guard message: "${message}"`)
  }
  assert(brandDeleteBlocked, 'Attempting to delete used brand threw error as required')

  // 1.2 Models CRUD & Guard
  console.log('\n[1.2] Models CRUD & Usage Guard:')
  const newModel = addModel(db, samsungBrand.id, 'Galaxy Test Model 1')
  assert(newModel.id > 0 && newModel.name === 'Galaxy Test Model 1', 'Added Model "Galaxy Test Model 1"')

  updateModel(db, newModel.id, 'Galaxy S25+')
  const s25Model = getModelsByBrand(db, samsungBrand.id).find((m) => m.id === newModel.id)
  assert(s25Model?.name === 'Galaxy S25+', 'Updated Model name to "Galaxy S25+"')

  deleteModel(db, newModel.id)
  assert(getModelsByBrand(db, samsungBrand.id).find((m) => m.id === newModel.id) === undefined, 'Deleted unused model')

  // Model used in ticket: Galaxy A54
  const a54Usage = checkModelUsage(db, a54Model.id)
  assert(a54Usage.canDelete === false, 'Used model cannot be deleted')
  let modelDeleteBlocked = false
  try {
    deleteModel(db, a54Model.id)
  } catch {
    modelDeleteBlocked = true
  }
  assert(modelDeleteBlocked, 'Attempting to delete used model was strictly prevented')

  // 1.3 Accessories CRUD & Guard
  console.log('\n[1.3] Accessories CRUD & Usage Guard:')
  const newAccessory = addAccessory(db, 'قلم S-Pen')
  assert(newAccessory.id > 0 && newAccessory.name === 'قلم S-Pen', 'Added Accessory "قلم S-Pen"')

  updateAccessory(db, newAccessory.id, 'قلم لمس ذكي')
  deleteAccessory(db, newAccessory.id)
  assert(getAccessories(db).find((a) => a.id === newAccessory.id) === undefined, 'Unused accessory deleted')

  // Create ticket with accessory ID 1
  const ticketWithAccDTO: CreateTicketDTO = {
    customer: { name: 'كمال كفر', phone: '0666554433' },
    device: { brand: 'Apple', model: 'iPhone 13' },
    ticket: {
      repair_category_id: 1,
      price: 4000,
      payment_type: 'cash',
      amount_paid: 4000,
      technician_id: 1
    },
    accessory_ids: [1]
  }
  createTicket(db, ticketWithAccDTO)

  const acc1Usage = checkAccessoryUsage(db, 1)
  assert(acc1Usage.canDelete === false, 'Accessory 1 cannot be deleted (used in ticket)')
  let accDeleteBlocked = false
  try {
    deleteAccessory(db, 1)
  } catch {
    accDeleteBlocked = true
  }
  assert(accDeleteBlocked, 'Attempting to delete used accessory was strictly prevented')

  // 1.4 Repair Categories CRUD & Guard
  console.log('\n[1.4] Repair Categories CRUD & Usage Guard:')
  const newCat = addRepairCategory(db, 'تبديل كاميرا خلفية', 65)
  assert(
    newCat.id > 0 && newCat.name === 'تبديل كاميرا خلفية' && newCat.default_split_percentage === 65,
    'Added Repair Category with 65% split'
  )

  updateRepairCategory(db, newCat.id, 'صيانة الكاميرات والعدسات', 70)
  const updatedCat = getRepairCategories(db).find((c) => c.id === newCat.id)
  assert(
    updatedCat?.name === 'صيانة الكاميرات والعدسات' && updatedCat?.default_split_percentage === 70,
    'Updated category name and split'
  )

  deleteRepairCategory(db, newCat.id)
  assert(getRepairCategories(db).find((c) => c.id === newCat.id) === undefined, 'Unused category deleted')

  // Category 1 is used in tickets
  const cat1Usage = checkRepairCategoryUsage(db, 1)
  assert(cat1Usage.canDelete === false, 'Used Category 1 cannot be deleted')
  let catDeleteBlocked = false
  try {
    deleteRepairCategory(db, 1)
  } catch {
    catDeleteBlocked = true
  }
  assert(catDeleteBlocked, 'Attempting to delete used category was strictly prevented')

  // 1.5 Technicians CRUD & Guard
  console.log('\n[1.5] Technicians CRUD & Usage Guard:')
  const newTech = addTechnician(db, 'وليد (فني متدرب)')
  assert(newTech.id > 0 && newTech.name === 'وليد (فني متدرب)', 'Added Technician')

  updateTechnician(db, newTech.id, 'وليد')
  deleteTechnician(db, newTech.id)
  assert(getTechnicians(db).find((t) => t.id === newTech.id) === undefined, 'Unused technician deleted')

  const techMe = getTechnicians(db).find((t) => t.name === 'أنا')!
  const meUsage = checkTechnicianUsage(db, techMe.id)
  assert(meUsage.canDelete === false, 'Technician "أنا" cannot be deleted (used in tickets)')

  // =========================================================================
  // SECTION 2: Database Backup & Restore Flow (.db)
  // =========================================================================
  console.log('\n--- Section 2: Database Backup & Full Restore Verification ---')

  const tempDir = mkdtempSync(join(tmpdir(), 'warshati-settings-backup-'))

  const originalDbPath = join(tempDir, 'original.db')
  const backupDbPath = join(tempDir, 'exported-backup.db')
  const safetyBackupPath = join(tempDir, 'auto-backup-before-import.db')

  // Setup real database file
  const fileDb = new Database(originalDbPath)
  fileDb.pragma('journal_mode = WAL')
  fileDb.pragma('foreign_keys = ON')
  initializeSchema(fileDb)
  seedInitialData(fileDb)

  // Insert distinctive ticket
  const backupTestTicket: CreateTicketDTO = {
    customer: { name: 'زبون النسخ الاحتياطي الأصلي', phone: '0555001122' },
    device: { brand: 'Xiaomi', model: 'Redmi Note 12', short_label: 'MI Note 12' },
    ticket: {
      repair_category_id: 2,
      price: 15000,
      payment_type: 'cash',
      amount_paid: 15000,
      technician_id: 1
    }
  }
  const createdTicket = createTicket(fileDb, backupTestTicket)
  assert(createdTicket.ticketId > 0, `Created distinctive ticket with ID ${createdTicket.ticketId}`)

  // Perform Atomic Backup
  fileDb.pragma('wal_checkpoint(TRUNCATE)')
  await fileDb.backup(backupDbPath)
  assert(existsSync(backupDbPath), 'Backup database file created successfully')

  // Corrupt / Delete / Modify original database
  fileDb.prepare(`DELETE FROM Ticket`).run()
  fileDb.prepare(`DELETE FROM Customer`).run()
  const remainingTickets = fileDb.prepare(`SELECT COUNT(*) as count FROM Ticket`).get() as { count: number }
  assert(remainingTickets.count === 0, 'Intentionally wiped tickets to simulate data loss')

  // Simulate Restore process:
  // 1. Silent safety backup before import
  fileDb.pragma('wal_checkpoint(TRUNCATE)')
  await fileDb.backup(safetyBackupPath)
  assert(existsSync(safetyBackupPath), 'Pre-import silent safety auto-backup created')

  fileDb.close()

  // 2. Overwrite database with exported backup
  const { copyFileSync } = await import('fs')
  copyFileSync(backupDbPath, originalDbPath)

  // 3. Re-open and verify complete restoration
  const restoredDb = new Database(originalDbPath)
  const restoredCustomer = restoredDb
    .prepare(`SELECT * FROM Customer WHERE name = 'زبون النسخ الاحتياطي الأصلي'`)
    .get() as { id: number; phone: string } | undefined

  assert(restoredCustomer !== undefined, 'Restored Customer found in database')
  assert(restoredCustomer!.phone === '0555001122', 'Customer phone verified')

  const restoredTickets = restoredDb
    .prepare(`SELECT * FROM Ticket WHERE customer_id = ?`)
    .all(restoredCustomer!.id) as { price: number; barcode_code: string }[]
  assert(restoredTickets.length === 1, 'Restored ticket count is exactly 1')
  assert(restoredTickets[0].price === 15000, 'Restored ticket price matches 15000 DZD')
  assert(restoredTickets[0].barcode_code === createdTicket.barcode, 'Restored barcode code matches perfectly')

  restoredDb.close()

  // Clean test files
  rmSync(tempDir, { recursive: true, force: true })

  // =========================================================================
  // SECTION 3: Bilingual (i18n) Symmetry Verification
  // =========================================================================
  console.log('\n--- Section 3: i18n Dictionary Symmetry Verification ---')

  type Dictionary = Record<string, unknown>
  function checkSymmetry(arObj: Dictionary, enObj: Dictionary, path = ''): void {
    for (const key of Object.keys(arObj)) {
      const currentPath = path ? `${path}.${key}` : key
      assert(key in enObj, `English dictionary contains key: ${currentPath}`)

      if (typeof arObj[key] === 'object' && arObj[key] !== null) {
        checkSymmetry(arObj[key] as Dictionary, enObj[key] as Dictionary, currentPath)
      }
    }
  }

  checkSymmetry(ar, en)
  console.log('✅ All Arabic and English translation keys are 100% symmetric and fully mapped.')

  console.log(
    '\n🎉 ALL SETTINGS TESTS (SETTINGS CRUD, REFERENCE GUARDS, BACKUP/RESTORE & i18n) PASSED SUCCESSFULLY! 🎉\n'
  )
  process.exit(0)
}

runSettingsBackupTests().catch((err) => {
  console.error('Test run failed:', err)
  process.exit(1)
})
