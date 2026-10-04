import Database from 'better-sqlite3'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import { createTicket, deleteTicket, getTicketById, updateTicketStatus } from '../src/database/queries/tickets'
import { getFinancialReport } from '../src/database/queries/reports'
import { getBrands, getModelsByBrand, getTechnicians } from '../src/database/queries/metadata'
import type { CreateTicketDTO } from '../src/shared/types'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Assertion failed: ${message}`)
  console.log(`✅ ${message}`)
}

function assertThrows(action: () => void, messageFragment: string, message: string): void {
  try {
    action()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    assert(errorMessage.includes(messageFragment), `${message} (رسالة واضحة)`)
    return
  }
  throw new Error(`Assertion failed: ${message}`)
}

function createSeededMemoryDatabase(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  initializeSchema(db)
  seedInitialData(db)
  return db
}

function createSampleTicketDto(
  db: Database.Database,
  overrides: {
    customerName?: string
    customerPhone?: string
    price?: number
    amountPaid?: number
    technicianId?: number
  } = {}
): CreateTicketDTO {
  const brand = getBrands(db).find((b) => b.name === 'Samsung')!
  const model = getModelsByBrand(db, brand.id).find((m) => m.name === 'Galaxy A54')!
  const technician = getTechnicians(db)[0]

  return {
    customer: {
      name: overrides.customerName || 'عميل تجريبي',
      phone: overrides.customerPhone || '0555112233'
    },
    device: {
      brand: brand.name,
      model: model.name,
      brand_id: brand.id,
      model_id: model.id
    },
    ticket: {
      repair_category_id: 1,
      price: overrides.price ?? 8000,
      payment_type: 'cash',
      amount_paid: overrides.amountPaid ?? 8000,
      technician_id: overrides.technicianId ?? technician.id
    },
    accessory_ids: [1, 2]
  }
}

function testTicketDeletionAndCascade(): void {
  console.log('\n--- 1. اختبار حذف التذكرة وحذف السجلات التابعة (Device, Accessories, StatusLog) ---')
  const db = createSeededMemoryDatabase()

  const { ticketId } = createTicket(db, createSampleTicketDto(db))
  assert(getTicketById(db, ticketId) !== null, 'تم إنشاء التذكرة بنجاح')

  // Verify dependent records exist
  assert(
    (db.prepare('SELECT COUNT(*) AS c FROM TicketDevice WHERE ticket_id = ?').get(ticketId) as { c: number }).c === 1,
    'TicketDevice موجود'
  )
  assert(
    (db.prepare('SELECT COUNT(*) AS c FROM TicketAccessories WHERE ticket_id = ?').get(ticketId) as { c: number }).c ===
      2,
    'TicketAccessories موجودة'
  )
  assert(
    (db.prepare('SELECT COUNT(*) AS c FROM StatusLog WHERE ticket_id = ?').get(ticketId) as { c: number }).c === 1,
    'StatusLog موجود'
  )

  const result = deleteTicket(db, ticketId)
  assert(result.success === true, 'تم حذف التذكرة بنجاح')

  // Verify all records are deleted
  assert(getTicketById(db, ticketId) === null, 'التذكرة لم تعد موجودة')
  assert(
    (db.prepare('SELECT COUNT(*) AS c FROM TicketDevice WHERE ticket_id = ?').get(ticketId) as { c: number }).c === 0,
    'TicketDevice تم حذفه'
  )
  assert(
    (db.prepare('SELECT COUNT(*) AS c FROM TicketAccessories WHERE ticket_id = ?').get(ticketId) as { c: number }).c ===
      0,
    'TicketAccessories تم حذفها'
  )
  assert(
    (db.prepare('SELECT COUNT(*) AS c FROM StatusLog WHERE ticket_id = ?').get(ticketId) as { c: number }).c === 0,
    'StatusLog تم حذفه'
  )

  assertThrows(() => deleteTicket(db, 99999), 'غير موجودة', 'محاولة حذف تذكرة غير موجودة تطلق استثناءً واضحاً')

  db.close()
}

function testCustomerOrphanCleanup(): void {
  console.log('\n--- 2. اختبار التنظيف التلقائي للزبون (Cascade Orphan Cleanup) ---')
  const db = createSeededMemoryDatabase()

  // Case A: Customer with single ticket -> customer is deleted when ticket is deleted
  const { ticketId: singleCustTicketId } = createTicket(
    db,
    createSampleTicketDto(db, { customerName: 'زبون تذكرة واحدة', customerPhone: '0555000001' })
  )
  const singleCustomer = db.prepare('SELECT id FROM Customer WHERE phone = ?').get('0555000001') as { id: number }
  assert(singleCustomer !== undefined, 'الزبون الأول موجود في قاعدة البيانات')

  const resSingle = deleteTicket(db, singleCustTicketId)
  assert(resSingle.customerDeleted === true, 'تم الإبلاغ عن حذف الزبون لعدم وجود تذاكر أخرى له')
  const checkSingleCustomer = db.prepare('SELECT id FROM Customer WHERE id = ?').get(singleCustomer.id)
  assert(checkSingleCustomer === undefined, 'سجل الزبون حُذف تلقائياً وبصمت من جدول Customer')

  // Case B: Customer with multiple tickets -> customer is retained until all tickets are deleted
  const t1 = createTicket(
    db,
    createSampleTicketDto(db, { customerName: 'زبون متعدد التذاكر', customerPhone: '0555000002' })
  )
  const multiCustomer = db.prepare('SELECT id FROM Customer WHERE phone = ?').get('0555000002') as { id: number }

  const t2 = createTicket(
    db,
    createSampleTicketDto(db, { customerName: 'زبون متعدد التذاكر', customerPhone: '0555000002' })
  )

  // Delete first ticket of multiCustomer
  const resMulti1 = deleteTicket(db, t1.ticketId)
  assert(resMulti1.customerDeleted === false, 'الزبون لم يُحذف لأن لديه تذكرة ثانية متبقية')
  const checkMultiCustomer1 = db.prepare('SELECT id FROM Customer WHERE id = ?').get(multiCustomer.id)
  assert(checkMultiCustomer1 !== undefined, 'سجل الزبون ما زال موجوداً')

  // Delete second ticket of multiCustomer
  const resMulti2 = deleteTicket(db, t2.ticketId)
  assert(resMulti2.customerDeleted === true, 'الزبون حُذف بعد حذف آخر تذكرة له')
  const checkMultiCustomer2 = db.prepare('SELECT id FROM Customer WHERE id = ?').get(multiCustomer.id)
  assert(checkMultiCustomer2 === undefined, 'سجل الزبون حُذف الآن بعد أن أصبحت تذاكره المتبقية = 0')

  db.close()
}

function testFinancialReportAdjustmentsOnTicketDeletion(): void {
  console.log('\n--- 3. اختبار شطب المبالغ وحصص الأرباح والديون من التقارير المالية عند حذف التذكرة ---')
  const db = createSeededMemoryDatabase()

  // 1. Create Delivered Ticket 1: 10,000 DZD (5,000 owner / 5,000 partner)
  const t1 = createTicket(db, createSampleTicketDto(db, { price: 10000, amountPaid: 10000 }))
  updateTicketStatus(db, { ticketId: t1.ticketId, newStatus: 'ready' })
  updateTicketStatus(db, { ticketId: t1.ticketId, newStatus: 'delivered' })

  // 2. Create Delivered Ticket 2 (on credit): 6,000 DZD (paid: 2000, debt: 4000)
  const t2 = createTicket(db, createSampleTicketDto(db, { price: 6000, amountPaid: 2000, customerPhone: '0555999999' }))
  updateTicketStatus(db, { ticketId: t2.ticketId, newStatus: 'ready' })
  updateTicketStatus(db, {
    ticketId: t2.ticketId,
    newStatus: 'delivered',
    paymentUpdate: { amount_paid: 2000, payment_type: 'credit' }
  })

  // Initial report check
  const initialReport = getFinancialReport(db, { period: 'all_time' })
  assert(initialReport.completedTicketsCount === 2, 'التقرير الأولي يحسب تذكرتين مسلّمتين')
  assert(initialReport.totalRevenue === 16000, 'إجمالي الإيرادات الأولية 16000 د.ج')
  assert(initialReport.totalOutstandingDebt === 4000, 'إجمالي الديون الأولية 4000 د.ج')
  assert(initialReport.totalMyShare === 6400, 'إجمالي حصتي الأولية 6400 د.ج (4000 + 2400 حسب نسبة التصنيف 40%)')
  assert(initialReport.totalPartnerShare === 9600, 'إجمالي حصة الشريك الأولية 9600 د.ج (6000 + 3600)')

  // Delete delivered ticket 2 (which had 4000 debt and 6000 revenue)
  const delRes = deleteTicket(db, t2.ticketId)
  assert(delRes.success === true, 'تم حذف التذكرة المسلّمة 2')

  // Subsequent report check
  const updatedReport = getFinancialReport(db, { period: 'all_time' })
  assert(updatedReport.completedTicketsCount === 1, 'التقرير بعد الحذف يحسب تذكرة مسلّمة واحدة فقط')
  assert(updatedReport.totalRevenue === 10000, 'إجمالي الإيرادات انخفض بدقة إلى 10000 د.ج')
  assert(updatedReport.totalMyShare === 4000, 'إجمالي حصتي بعد الحذف 4000 د.ج')
  assert(updatedReport.totalPartnerShare === 6000, 'إجمالي حصة الشريك بعد الحذف 6000 د.ج')
  assert(updatedReport.totalOutstandingDebt === 0, 'شُطبت الديون المرتبطة بالتذكرة المحذوفة وأصبحت 0 د.ج')
  assert(
    updatedReport.totalRevenue === updatedReport.totalMyShare + updatedReport.totalPartnerShare,
    'مجموع الحصص يطابق تماماً إجمالي الإيرادات بعد الحذف'
  )
  assert(
    updatedReport.tickets.some((t) => t.id === t2.ticketId) === false,
    'التذكرة المحذوفة اختفت تماماً من سجل التذاكر في التقرير'
  )

  db.close()
}

function runAllTests(): void {
  console.log('🧪 بدء اختبارات حذف التذكرة، التنظيف التلقائي، والأثر المالي...')
  testTicketDeletionAndCascade()
  testCustomerOrphanCleanup()
  testFinancialReportAdjustmentsOnTicketDeletion()
  console.log('\n🎉 ALL TICKET DELETION & FINANCIAL ADJUSTMENT TESTS PASSED! 🎉\n')
  process.exit(0)
}

runAllTests()
