import type Database from 'better-sqlite3'
import type {
  AppMetadata,
  Brand,
  Model,
  RepairCategory,
  Accessories,
  Technician,
  DeleteReferenceCheckResult
} from '../../shared/types'

function mapTechnician(row: { id: number; name: string; is_partner: number | boolean }): Technician {
  return { ...row, is_partner: Boolean(row.is_partner) }
}

// ==========================================
// 1. Metadata Aggregation
// ==========================================
export function getAppMetadata(db: Database.Database): AppMetadata {
  const brands = db.prepare(`SELECT * FROM Brand ORDER BY name ASC`).all() as Brand[]
  const models = db.prepare(`SELECT * FROM Model ORDER BY name ASC`).all() as Model[]
  const repairCategories = db
    .prepare(`SELECT * FROM RepairCategory ORDER BY id ASC`)
    .all() as RepairCategory[]
  const accessories = db.prepare(`SELECT * FROM Accessories ORDER BY id ASC`).all() as Accessories[]
  const technicians = (db.prepare(`SELECT * FROM Technician ORDER BY id ASC`).all() as { id: number; name: string; is_partner: number | boolean }[])
    .map(mapTechnician)

  return {
    brands,
    models,
    repairCategories,
    accessories,
    technicians
  }
}

// ==========================================
// 2. Brands CRUD & Guard
// ==========================================
export function getBrands(db: Database.Database): Brand[] {
  return db.prepare(`SELECT * FROM Brand ORDER BY name ASC`).all() as Brand[]
}

export function addBrand(db: Database.Database, name: string): Brand {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('اسم الماركة مطلوب')
  const stmt = db.prepare(`INSERT INTO Brand (name) VALUES (?)`)
  const result = stmt.run(trimmedName)
  return { id: Number(result.lastInsertRowid), name: trimmedName }
}

export function updateBrand(db: Database.Database, id: number, name: string): void {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('اسم الماركة مطلوب')
  db.prepare(`UPDATE Brand SET name = ? WHERE id = ?`).run(trimmedName, id)
}

export function checkBrandUsage(db: Database.Database, id: number): DeleteReferenceCheckResult {
  const brand = db.prepare(`SELECT name FROM Brand WHERE id = ?`).get(id) as Brand | undefined
  if (!brand) return { canDelete: true, usedCount: 0 }

  // Check ticket snapshots through the stable brand ID, not the editable display name.
  const ticketCountRow = db
    .prepare(`SELECT COUNT(DISTINCT ticket_id) as count FROM TicketDevice WHERE brand_id = ?`)
    .get(id) as { count: number }

  if (ticketCountRow.count > 0) {
    return {
      canDelete: false,
      usedCount: ticketCountRow.count,
      message: `لا يمكن الحذف، هذا العنصر مستخدم في ${ticketCountRow.count} تذكرة`
    }
  }

  // Check if brand has models
  const modelCountRow = db
    .prepare(`SELECT COUNT(*) as count FROM Model WHERE brand_id = ?`)
    .get(id) as { count: number }

  if (modelCountRow.count > 0) {
    return {
      canDelete: false,
      usedCount: modelCountRow.count,
      message: `لا يمكن الحذف، توجد ${modelCountRow.count} موديلات مرتبطة بهذه الماركة. احذف الموديلات أولاً.`
    }
  }

  return { canDelete: true, usedCount: 0 }
}

export function deleteBrand(db: Database.Database, id: number): void {
  const check = checkBrandUsage(db, id)
  if (!check.canDelete) {
    throw new Error(check.message || `لا يمكن الحذف، العنصر مستخدم حالياً`)
  }
  db.prepare(`DELETE FROM Brand WHERE id = ?`).run(id)
}

// ==========================================
// 3. Models CRUD & Guard
// ==========================================
export function getModelsByBrand(db: Database.Database, brandId: number): Model[] {
  return db.prepare(`SELECT * FROM Model WHERE brand_id = ? ORDER BY name ASC`).all(brandId) as Model[]
}

export function getAllModels(db: Database.Database): Model[] {
  return db.prepare(`SELECT * FROM Model ORDER BY name ASC`).all() as Model[]
}

export function addModel(db: Database.Database, brandId: number, name: string): Model {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('اسم الموديل مطلوب')
  const stmt = db.prepare(`INSERT INTO Model (brand_id, name) VALUES (?, ?)`)
  const result = stmt.run(brandId, trimmedName)
  return { id: Number(result.lastInsertRowid), brand_id: brandId, name: trimmedName }
}

export function updateModel(db: Database.Database, id: number, name: string, brandId?: number): void {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('اسم الموديل مطلوب')
  if (brandId) {
    db.prepare(`UPDATE Model SET name = ?, brand_id = ? WHERE id = ?`).run(trimmedName, brandId, id)
  } else {
    db.prepare(`UPDATE Model SET name = ? WHERE id = ?`).run(trimmedName, id)
  }
}

export function checkModelUsage(db: Database.Database, id: number): DeleteReferenceCheckResult {
  const ticketCountRow = db
    .prepare(`SELECT COUNT(DISTINCT ticket_id) as count FROM TicketDevice WHERE model_id = ?`)
    .get(id) as { count: number }

  if (ticketCountRow.count > 0) {
    return {
      canDelete: false,
      usedCount: ticketCountRow.count,
      message: `لا يمكن الحذف، هذا العنصر مستخدم في ${ticketCountRow.count} تذكرة`
    }
  }

  return { canDelete: true, usedCount: 0 }
}

export function deleteModel(db: Database.Database, id: number): void {
  const check = checkModelUsage(db, id)
  if (!check.canDelete) {
    throw new Error(check.message || `لا يمكن الحذف، العنصر مستخدم حالياً`)
  }
  db.prepare(`DELETE FROM Model WHERE id = ?`).run(id)
}

// ==========================================
// 4. Accessories CRUD & Guard
// ==========================================
export function getAccessories(db: Database.Database): Accessories[] {
  return db.prepare(`SELECT * FROM Accessories ORDER BY id ASC`).all() as Accessories[]
}

export function addAccessory(db: Database.Database, name: string): Accessories {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('اسم الملحق مطلوب')
  const stmt = db.prepare(`INSERT INTO Accessories (name) VALUES (?)`)
  const result = stmt.run(trimmedName)
  return { id: Number(result.lastInsertRowid), name: trimmedName }
}

export function updateAccessory(db: Database.Database, id: number, name: string): void {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('اسم الملحق مطلوب')
  db.prepare(`UPDATE Accessories SET name = ? WHERE id = ?`).run(trimmedName, id)
}

export function checkAccessoryUsage(db: Database.Database, id: number): DeleteReferenceCheckResult {
  const ticketCountRow = db
    .prepare(`SELECT COUNT(DISTINCT ticket_id) as count FROM TicketAccessories WHERE accessory_id = ?`)
    .get(id) as { count: number }

  if (ticketCountRow.count > 0) {
    return {
      canDelete: false,
      usedCount: ticketCountRow.count,
      message: `لا يمكن الحذف، هذا العنصر مستخدم في ${ticketCountRow.count} تذكرة`
    }
  }

  return { canDelete: true, usedCount: 0 }
}

export function deleteAccessory(db: Database.Database, id: number): void {
  const check = checkAccessoryUsage(db, id)
  if (!check.canDelete) {
    throw new Error(check.message || `لا يمكن الحذف، العنصر مستخدم حالياً`)
  }
  db.prepare(`DELETE FROM Accessories WHERE id = ?`).run(id)
}

// ==========================================
// 5. Repair Categories CRUD & Guard
// ==========================================
export function getRepairCategories(db: Database.Database): RepairCategory[] {
  return db.prepare(`SELECT * FROM RepairCategory ORDER BY id ASC`).all() as RepairCategory[]
}

export function addRepairCategory(
  db: Database.Database,
  name: string,
  defaultSplitPercentage: number
): RepairCategory {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('اسم تصنيف العطل مطلوب')
  const split = Math.max(0, Math.min(100, defaultSplitPercentage))
  const stmt = db.prepare(`INSERT INTO RepairCategory (name, default_split_percentage) VALUES (?, ?)`)
  const result = stmt.run(trimmedName, split)
  return { id: Number(result.lastInsertRowid), name: trimmedName, default_split_percentage: split }
}

export function updateRepairCategory(
  db: Database.Database,
  id: number,
  name: string,
  defaultSplitPercentage: number
): void {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('اسم تصنيف العطل مطلوب')
  const split = Math.max(0, Math.min(100, defaultSplitPercentage))
  db.prepare(`UPDATE RepairCategory SET name = ?, default_split_percentage = ? WHERE id = ?`).run(
    trimmedName,
    split,
    id
  )
}

export function checkRepairCategoryUsage(db: Database.Database, id: number): DeleteReferenceCheckResult {
  const ticketCountRow = db
    .prepare(`SELECT COUNT(*) as count FROM Ticket WHERE repair_category_id = ?`)
    .get(id) as { count: number }

  if (ticketCountRow.count > 0) {
    return {
      canDelete: false,
      usedCount: ticketCountRow.count,
      message: `لا يمكن الحذف، هذا العنصر مستخدم في ${ticketCountRow.count} تذكرة`
    }
  }

  return { canDelete: true, usedCount: 0 }
}

export function deleteRepairCategory(db: Database.Database, id: number): void {
  const check = checkRepairCategoryUsage(db, id)
  if (!check.canDelete) {
    throw new Error(check.message || `لا يمكن الحذف، العنصر مستخدم حالياً`)
  }
  db.prepare(`DELETE FROM RepairCategory WHERE id = ?`).run(id)
}

// ==========================================
// 6. Technicians CRUD & Guard
// ==========================================
export function getTechnicians(db: Database.Database): Technician[] {
  return (db.prepare(`SELECT * FROM Technician ORDER BY id ASC`).all() as { id: number; name: string; is_partner: number | boolean }[])
    .map(mapTechnician)
}

export function addTechnician(db: Database.Database, name: string): Technician {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('اسم الفني مطلوب')
  const stmt = db.prepare(`INSERT INTO Technician (name) VALUES (?)`)
  const result = stmt.run(trimmedName)
  return { id: Number(result.lastInsertRowid), name: trimmedName, is_partner: false }
}

export function updateTechnician(db: Database.Database, id: number, name: string): void {
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error('اسم الفني مطلوب')
  db.prepare(`UPDATE Technician SET name = ? WHERE id = ?`).run(trimmedName, id)
}

export function checkTechnicianUsage(db: Database.Database, id: number): DeleteReferenceCheckResult {
  const ticketCountRow = db
    .prepare(`SELECT COUNT(*) as count FROM Ticket WHERE technician_id = ?`)
    .get(id) as { count: number }

  if (ticketCountRow.count > 0) {
    return {
      canDelete: false,
      usedCount: ticketCountRow.count,
      message: `لا يمكن الحذف، هذا العنصر مستخدم في ${ticketCountRow.count} تذكرة`
    }
  }

  return { canDelete: true, usedCount: 0 }
}

export function deleteTechnician(db: Database.Database, id: number): void {
  const check = checkTechnicianUsage(db, id)
  if (!check.canDelete) {
    throw new Error(check.message || `لا يمكن الحذف، العنصر مستخدم حالياً`)
  }
  db.prepare(`DELETE FROM Technician WHERE id = ?`).run(id)
}
