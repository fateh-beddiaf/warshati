import Database from 'better-sqlite3'
import { calculateProfitSplit } from '../src/shared/profit'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import { createTicket, updateTicketStatus, getTicketById } from '../src/database/queries/tickets'
import { getFinancialReport } from '../src/database/queries/reports'
import type { CreateTicketDTO } from '../src/shared/types'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`✅ Passed: ${message}`)
}

console.log('🚀 Running Unit & Integration Tests for Milestone 4: Profit Logic & Reporting...\n')

// =========================================================================
// SECTION 1: Pure Unit Tests for calculateProfitSplit
// =========================================================================
console.log('--- Section 1: Pure Profit Calculation Tests ---')

// 1.1 Partner Rule (100% Partner, 0% Owner) regardless of category split
const partnerTest1 = calculateProfitSplit({
  price: 10000,
  isPartner: true,
  categorySplitPercentage: 70
})
assert(partnerTest1.myShare === 0, 'Partner rule: Owner share is 0')
assert(partnerTest1.partnerShare === 10000, 'Partner rule: Partner share is 10000 (100%)')
assert(partnerTest1.myPercentage === 0, 'Partner rule: Owner percentage is 0%')
assert(partnerTest1.partnerPercentage === 100, 'Partner rule: Partner percentage is 100%')
assert(partnerTest1.isPartnerExclusive === true, 'Partner rule: isPartnerExclusive is true')

// 1.2 Owner with 50/50 Category Split
const owner50Test = calculateProfitSplit({
  price: 5000,
  isPartner: false,
  categorySplitPercentage: 50
})
assert(owner50Test.myShare === 2500, '50/50 Split: Owner share is 2500')
assert(owner50Test.partnerShare === 2500, '50/50 Split: Partner share is 2500')
assert(owner50Test.myPercentage === 50, '50/50 Split: Owner percentage is 50%')
assert(owner50Test.partnerPercentage === 50, '50/50 Split: Partner percentage is 50%')
assert(owner50Test.isPartnerExclusive === false, '50/50 Split: isPartnerExclusive is false')

// 1.3 Owner with 70/30 Category Split (e.g. Board & Software)
const owner70Test = calculateProfitSplit({
  price: 10000,
  isPartner: false,
  categorySplitPercentage: 70
})
assert(owner70Test.myShare === 7000, '70/30 Split: Owner share is 7000')
assert(owner70Test.partnerShare === 3000, '70/30 Split: Partner share is 3000')
assert(owner70Test.myPercentage === 70, '70/30 Split: Owner percentage is 70%')
assert(owner70Test.partnerPercentage === 30, '70/30 Split: Partner percentage is 30%')

// 1.4 Owner with 40/60 Category Split (e.g. Screen Replacement)
const owner40Test = calculateProfitSplit({
  price: 8000,
  isPartner: false,
  categorySplitPercentage: 40
})
assert(owner40Test.myShare === 3200, '40/60 Split: Owner share is 3200')
assert(owner40Test.partnerShare === 4800, '40/60 Split: Partner share is 4800')
assert(owner40Test.myPercentage === 40, '40/60 Split: Owner percentage is 40%')
assert(owner40Test.partnerPercentage === 60, '40/60 Split: Partner percentage is 60%')

// 1.5 Edge Cases: Zero, Negative, Fractional Prices, Missing Split
const zeroTest = calculateProfitSplit({ price: 0, isPartner: false, categorySplitPercentage: 70 })
assert(zeroTest.myShare === 0 && zeroTest.partnerShare === 0, 'Zero price produces 0 shares')

const negTest = calculateProfitSplit({ price: -100, isPartner: false, categorySplitPercentage: 70 })
assert(negTest.myShare === 0 && negTest.partnerShare === 0, 'Negative price produces 0 shares')

const defaultSplitTest = calculateProfitSplit({ price: 2000, isPartner: false, categorySplitPercentage: null })
assert(
  defaultSplitTest.myShare === 1000 && defaultSplitTest.partnerShare === 1000,
  'Null category split defaults to 50%'
)

// Fractional precision test (e.g. 1255.50 at 70%)
const fracTest = calculateProfitSplit({ price: 1255.5, isPartner: false, categorySplitPercentage: 70 })
assert(fracTest.myShare === 878.85, 'Fractional price myShare = 878.85')
assert(fracTest.partnerShare === 376.65, 'Fractional price partnerShare = 376.65')
assert(
  Math.round((fracTest.myShare + fracTest.partnerShare) * 100) / 100 === 1255.5,
  'Fractional shares sum exactly to total price'
)

// =========================================================================
// SECTION 2: Database Integration, Freezing Shares, & Reports
// =========================================================================
console.log('\n--- Section 2: Database Storage & Reports Integration ---')

const db = new Database(':memory:')
db.pragma('foreign_keys = ON')
initializeSchema(db)
seedInitialData(db)

// Categories in seed:
// 1: 'تغيير شاشة' -> split 40%
// 2: 'بطارية ومنفذ شحن' -> split 50%
// 3: 'صيانة بورد وسوفتوير' -> split 70%
// 4: 'صيانة عامة وأخرى' -> split 50%

// Ticket 1: Partner ticket (Price: 10000, Category 3 [70%])
const t1DTO: CreateTicketDTO = {
  customer: { name: 'زبون الشريك', phone: '0555000001' },
  device: { brand: 'Samsung', model: 'Galaxy A54' },
  ticket: {
    repair_category_id: 3,
    price: 10000,
    payment_type: 'cash',
    amount_paid: 10000,
    technician_id: 2
  }
}
const t1 = createTicket(db, t1DTO)
updateTicketStatus(db, { ticketId: t1.ticketId, newStatus: 'ready' })
updateTicketStatus(db, { ticketId: t1.ticketId, newStatus: 'delivered' })

const t1Details = getTicketById(db, t1.ticketId)
assert(t1Details!.ticket.my_share === 0, 'Database stored t1 my_share = 0')
assert(t1Details!.ticket.partner_share === 10000, 'Database stored t1 partner_share = 10000')

// Ticket 2: Owner ticket with 70% Category (Price: 10000, Category 3 [70%])
const t2DTO: CreateTicketDTO = {
  customer: { name: 'زبون سوفتوير', phone: '0555000002' },
  device: { brand: 'Apple', model: 'iPhone 13' },
  ticket: {
    repair_category_id: 3,
    price: 10000,
    payment_type: 'cash',
    amount_paid: 10000,
    technician_id: 1
  }
}
const t2 = createTicket(db, t2DTO)
updateTicketStatus(db, { ticketId: t2.ticketId, newStatus: 'ready' })
updateTicketStatus(db, { ticketId: t2.ticketId, newStatus: 'delivered' })

const t2Details = getTicketById(db, t2.ticketId)
assert(t2Details!.ticket.my_share === 7000, 'Database stored t2 my_share = 7000')
assert(t2Details!.ticket.partner_share === 3000, 'Database stored t2 partner_share = 3000')

// Ticket 3: Owner ticket with 40% Category (Price: 8000, Category 1 [40%])
const t3DTO: CreateTicketDTO = {
  customer: { name: 'زبون شاشة', phone: '0555000003' },
  device: { brand: 'Xiaomi', model: 'Redmi Note 12' },
  ticket: {
    repair_category_id: 1,
    price: 8000,
    payment_type: 'credit',
    amount_paid: 3000,
    technician_id: 1
  }
}
const t3 = createTicket(db, t3DTO)
updateTicketStatus(db, { ticketId: t3.ticketId, newStatus: 'ready' })
updateTicketStatus(db, { ticketId: t3.ticketId, newStatus: 'delivered' })

const t3Details = getTicketById(db, t3.ticketId)
assert(t3Details!.ticket.my_share === 3200, 'Database stored t3 my_share = 3200')
assert(t3Details!.ticket.partner_share === 4800, 'Database stored t3 partner_share = 4800')

// =========================================================================
// SECTION 3: Historical Immutability Test
// =========================================================================
console.log('\n--- Section 3: Historical Immutability (Category Split Change) ---')

// Modify Category 3's default_split_percentage from 70% to 90%
db.prepare(`UPDATE RepairCategory SET default_split_percentage = 90.0 WHERE id = 3`).run()

// Generate financial report and verify that Ticket 2's stored shares did NOT change
const report = getFinancialReport(db, { period: 'all_time' })

assert(report.totalRevenue === 28000, `Total Revenue is 28000 (got ${report.totalRevenue})`)
assert(report.totalMyShare === 10200, `Total My Share is 10200 (7000 + 3200) (got ${report.totalMyShare})`)
assert(
  report.totalPartnerShare === 17800,
  `Total Partner Share is 17800 (10000 + 3000 + 4800) (got ${report.totalPartnerShare})`
)
assert(
  report.totalMyShare + report.totalPartnerShare === report.totalRevenue,
  'Sum of shares strictly equals total revenue'
)
assert(report.totalOutstandingDebt === 5000, `Total Outstanding Debt is 5000 (got ${report.totalOutstandingDebt})`)
assert(report.completedTicketsCount === 3, `Completed tickets count is 3`)

// Verify Technician Breakdown
const meTech = report.technicianBreakdown.find((t) => t.technician === 'أنا')
assert(meTech !== undefined, 'Found technician summary for "أنا"')
assert(meTech!.ticketsCount === 2, 'Technician "أنا" completed 2 tickets')
assert(meTech!.totalRevenue === 18000, 'Technician "أنا" total revenue is 18000')
assert(meTech!.myShare === 10200, 'Technician "أنا" owner share is 10200')
assert(meTech!.partnerShare === 7800, 'Technician "أنا" partner share is 7800')

const partnerTech = report.technicianBreakdown.find((t) => t.technician === 'الشريك')
assert(partnerTech !== undefined, 'Found technician summary for "الشريك"')
assert(partnerTech!.ticketsCount === 1, 'Technician "الشريك" completed 1 ticket')
assert(partnerTech!.totalRevenue === 10000, 'Technician "الشريك" total revenue is 10000')
assert(partnerTech!.myShare === 0, 'Technician "الشريك" owner share is 0')
assert(partnerTech!.partnerShare === 10000, 'Technician "الشريك" partner share is 10000 (100%)')

console.log('\n🎉 ALL PROFIT LOGIC, STORAGE IMMUTABILITY & REPORT TESTS PASSED! 🎉\n')
process.exit(0)
