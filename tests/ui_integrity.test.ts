import Database from 'better-sqlite3'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import { createTicket, getTicketById } from '../src/database/queries/tickets'
import {
  getBrands,
  getModelsByBrand,
  getAccessories,
  getRepairCategories,
  getTechnicians
} from '../src/database/queries/metadata'
import { getSetting, setSetting } from '../src/database/queries/settings'
import { calculateProfitSplit } from '../src/shared/profit'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`✅ Passed: ${message}`)
}

console.log('🧪 Running Comprehensive UI Integrity & Tab Interaction Test Suite...\n')

const db = new Database(':memory:')
db.pragma('foreign_keys = ON')
initializeSchema(db)
seedInitialData(db)

// 1. Tab: Categories Simulation
console.log('--- Testing Tab 1: Categories Logic & Preview ---')
const initialCategories = getRepairCategories(db)
assert(initialCategories.length >= 3, `Found ${initialCategories.length} default categories`)

for (const cat of initialCategories) {
  const split = cat.default_split_percentage
  const profit = calculateProfitSplit({
    price: 10000,
    isPartner: false,
    categorySplitPercentage: split
  })
  assert(profit.myShare + profit.partnerShare === 10000, `Category ${cat.name}: shares sum exactly to 10000 DZD`)
}

// 2. Tab: Brands & Models Simulation
console.log('\n--- Testing Tab 2: Brands & Cascading Models ---')
const allBrands = getBrands(db)
assert(allBrands.length > 0, `Found ${allBrands.length} brands`)

for (const b of allBrands) {
  const models = getModelsByBrand(db, b.id)
  assert(Array.isArray(models), `Brand ${b.name} has valid models array (count: ${models.length})`)
}

// 3. Tab: Accessories Simulation
console.log('\n--- Testing Tab 3: Accessories ---')
const accList = getAccessories(db)
assert(accList.length > 0, `Found ${accList.length} accessories`)

// 4. Tab: Technicians Simulation
console.log('\n--- Testing Tab 4: Technicians ---')
const techs = getTechnicians(db)
assert(
  techs.some((t) => t.name === 'أنا'),
  'Technician "أنا" exists'
)
assert(
  techs.some((t) => t.name === 'الشريك'),
  'Technician "الشريك" exists'
)

// 5. Tab: Preferences & Settings
console.log('\n--- Testing Tab 5: Preferences & Settings ---')
setSetting(db, 'app_language', 'ar')
assert(getSetting(db, 'app_language', 'en') === 'ar', 'Saved Arabic language setting')

setSetting(db, 'app_language', 'en')
assert(getSetting(db, 'app_language', 'ar') === 'en', 'Switched to English language setting')

setSetting(db, 'overdue_ready_days', '5')
assert(getSetting(db, 'overdue_ready_days', '3') === '5', 'Saved overdue threshold (5 days)')

// 6. Ticket Card Click & Details Modal Simulation
console.log('\n--- Testing Ticket Details Modal Data Binding & Profit Flow ---')
const ticketRes = createTicket(db, {
  customer: { name: 'فاروق الاختبار', phone: '0555123456' },
  device: { brand: 'Apple', model: 'iPhone 14 Pro', short_label: 'IP 14 Pro' },
  ticket: {
    repair_category_id: 1,
    price: 8000,
    payment_type: 'cash',
    amount_paid: 5000,
    technician_id: 1
  },
  accessory_ids: [1, 2]
})

const details = getTicketById(db, ticketRes.ticketId)
assert(details !== null, 'Ticket details retrieved successfully for modal')
assert(details?.customer.name === 'فاروق الاختبار', 'Customer name matches')
assert(details?.device.brand === 'Apple', 'Device brand matches')
assert(details?.accessories.length === 2, 'Accessories array length is 2')
assert(details?.statusLogs.length === 1, 'Initial StatusLog is present')

// Compute profit split as TicketDetailsModal does
const modalProfit = calculateProfitSplit({
  price: details!.ticket.price,
  isPartner: Boolean(details!.ticket.technician_is_partner),
  categorySplitPercentage: details!.category?.default_split_percentage ?? 50
})
assert(modalProfit.myShare > 0, `Modal computed myShare: ${modalProfit.myShare}`)
assert(modalProfit.partnerShare > 0, `Modal computed partnerShare: ${modalProfit.partnerShare}`)

console.log('\n🎉 ALL UI & TAB LOGIC INTEGRITY TESTS PASSED! 🎉\n')
process.exit(0)
