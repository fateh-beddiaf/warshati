import Database from 'better-sqlite3'
import { initializeSchema } from '../src/database/schema'
import { seedInitialData } from '../src/database/seed'
import {
  createTicket,
  updateTicketStatus,
  setPartsCost,
  getTicketById,
  getTicketsList,
  recordPayment
} from '../src/database/queries/tickets'
import { getFinancialReport } from '../src/database/queries/reports'
import {
  addRepairCategory,
  updateRepairCategory,
  getRepairCategories,
  getAppMetadata
} from '../src/database/queries/metadata'
import type { CreateTicketDTO } from '../src/shared/types'

// Parts cost on the database side: category switch, ticket cost, delivery on the net profit,
// setPartsCost (delivered / not delivered / partner / loss / invalid), reports and list flags.

let failures = 0
function eq<T>(actual: T, expected: T, message: string): void {
  if (Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`✅ ${message}`)
  } else {
    failures++
    console.error(`❌ ${message}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`)
  }
}
function throwsMessage(fn: () => unknown): string | null {
  try {
    fn()
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

const db = new Database(':memory:')
db.pragma('foreign_keys = ON')
initializeSchema(db)
seedInitialData(db)

const techs = db.prepare(`SELECT id, is_partner FROM Technician ORDER BY id`).all() as {
  id: number
  is_partner: number
}[]
const ME = techs.find((t) => !t.is_partner)!.id
const PARTNER = techs.find((t) => t.is_partner)!.id

// Categories used below
const screen = addRepairCategory(db, 'شاشات (اختبار)', 50, true) // requires a cost, 50%
const flash = addRepairCategory(db, 'فلاش (اختبار)', 50, false) // does not require a cost
const board70 = addRepairCategory(db, 'بورد 70 (اختبار)', 70, true)

let phone = 550000000
function mk(o: { price: number; paid?: number; cat: number; tech?: number; cost?: number | null }): number {
  const dto: CreateTicketDTO = {
    customer: { name: `Customer ${phone}`, phone: `0${phone++}` },
    device: { brand: 'Realme', model: 'C51' },
    ticket: {
      repair_category_id: o.cat,
      price: o.price,
      payment_type: (o.paid ?? o.price) >= o.price ? 'cash' : 'credit',
      amount_paid: o.paid ?? o.price,
      technician_id: o.tech ?? ME,
      ...(o.cost !== undefined ? { parts_cost: o.cost } : {})
    }
  }
  return createTicket(db, dto).ticketId
}
const toReady = (id: number): void => void updateTicketStatus(db, { ticketId: id, newStatus: 'ready' })
const toDelivered = (id: number): void => void updateTicketStatus(db, { ticketId: id, newStatus: 'delivered' })
const row = (id: number): Record<string, unknown> =>
  db.prepare(`SELECT * FROM Ticket WHERE id = ?`).get(id) as Record<string, unknown>
const logCount = (id: number): number =>
  (db.prepare(`SELECT COUNT(*) c FROM StatusLog WHERE ticket_id = ?`).get(id) as { c: number }).c

console.log('--- Section 1: the category switch ---')
{
  const seeded = getRepairCategories(db).filter((c) => !c.name.includes('اختبار'))
  eq(
    seeded.length > 0 && seeded.every((c) => c.requires_parts_cost === false),
    true,
    'every seeded category defaults to NOT requiring a cost'
  )
  eq(screen.requires_parts_cost, true, 'addRepairCategory(..., true) requires a cost')
  eq(flash.requires_parts_cost, false, 'addRepairCategory without the flag does not')
  eq(
    getAppMetadata(db).repairCategories.find((c) => c.id === screen.id)!.requires_parts_cost,
    true,
    'metadata exposes a real boolean (true)'
  )
  eq(
    getAppMetadata(db).repairCategories.find((c) => c.id === flash.id)!.requires_parts_cost,
    false,
    'metadata exposes a real boolean (false)'
  )
  eq(
    typeof getAppMetadata(db).repairCategories[0].requires_parts_cost,
    'boolean',
    'requires_parts_cost is boolean, not 0/1'
  )

  updateRepairCategory(db, flash.id, 'فلاش (اختبار)', 50, true)
  eq(
    getRepairCategories(db).find((c) => c.id === flash.id)!.requires_parts_cost,
    true,
    'updateRepairCategory can turn the switch on'
  )
  updateRepairCategory(db, flash.id, 'فلاش (اختبار)', 55) // flag omitted: unchanged
  const afterOmit = getRepairCategories(db).find((c) => c.id === flash.id)!
  eq(
    [afterOmit.requires_parts_cost, afterOmit.default_split_percentage],
    [true, 55],
    'omitting the flag keeps it (only name / split change)'
  )
  updateRepairCategory(db, flash.id, 'فلاش (اختبار)', 50, false)
  eq(
    getRepairCategories(db).find((c) => c.id === flash.id)!.requires_parts_cost,
    false,
    'updateRepairCategory can turn it back off'
  )

  eq(
    throwsMessage(() => updateRepairCategory(db, flash.id, 'x', 50, 'yes' as unknown as boolean)) !== null,
    true,
    'a non-boolean flag is rejected'
  )
  eq(
    throwsMessage(() => addRepairCategory(db, 'y', 50, 2 as unknown as boolean)) !== null,
    true,
    'an out-of-range flag is rejected on add'
  )
  eq(
    getRepairCategories(db).find((c) => c.id === flash.id)!.requires_parts_cost,
    false,
    'a rejected update changed nothing'
  )
}

console.log('\n--- Section 2: creating tickets with / without a cost ---')
{
  const withCost = mk({ price: 4000, cat: screen.id, cost: 2600 })
  eq(row(withCost).parts_cost, 2600, 'cost entered at creation is stored')
  const without = mk({ price: 4000, cat: screen.id })
  eq(row(without).parts_cost, null, 'cost left empty is stored as NULL (not 0)')
  const explicitNull = mk({ price: 4000, cat: screen.id, cost: null })
  eq(row(explicitNull).parts_cost, null, 'explicit null is NULL')
  const zero = mk({ price: 4000, cat: screen.id, cost: 0 })
  eq(row(zero).parts_cost, 0, 'an explicit 0 is stored as 0 ("no cost", distinct from NULL)')
  const fractional = mk({ price: 4000, cat: screen.id, cost: 1234.567 })
  eq(row(fractional).parts_cost, 1234.57, 'fractional costs are rounded to 2 decimals')

  const bad: [string, unknown][] = [
    ['negative', -1],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['text', 'abc'],
    ['object', {}]
  ]
  for (const [label, value] of bad) {
    const before = (db.prepare(`SELECT COUNT(*) c FROM Ticket`).get() as { c: number }).c
    const msg = throwsMessage(() => mk({ price: 4000, cat: screen.id, cost: value as number }))
    const after = (db.prepare(`SELECT COUNT(*) c FROM Ticket`).get() as { c: number }).c
    eq(msg !== null && /[؀-ۿ]/.test(msg), true, `invalid cost (${label}) is rejected with an Arabic message`)
    eq(after, before, `invalid cost (${label}) creates no ticket (transaction rolled back)`)
  }
  eq(row(withCost).amount_remaining, 0, 'the cost never touches amount_remaining (customer pays the price)')
  eq(row(withCost).status, 'in_progress', 'a new ticket is in progress')
  eq(row(withCost).my_share, null, 'no shares before delivery')
  eq(row(withCost).split_percentage_applied, null, 'no frozen percentage before delivery')
}

console.log('\n--- Section 3: delivery on the net profit ---')
{
  // 4000 - 2600 at 50% => 700 / 700 ; the percentage is frozen
  const a = mk({ price: 4000, cat: screen.id, cost: 2600 })
  toReady(a)
  eq(row(a).my_share, null, 'ready: still no shares')
  toDelivered(a)
  eq([row(a).my_share, row(a).partner_share], [700, 700], 'Realme C51: 4000 / 2600 / 50% => 700 / 700')
  eq(row(a).split_percentage_applied, 50, 'delivery freezes my percentage (50)')
  eq([row(a).amount_paid, row(a).amount_remaining], [4000, 0], 'payments untouched by the cost')

  // Partner technician: 100% of the net profit
  const b = mk({ price: 4000, cat: screen.id, cost: 2600, tech: PARTNER })
  toReady(b)
  toDelivered(b)
  eq([row(b).my_share, row(b).partner_share], [0, 1400], 'partner technician: 0 / 1400 (net, not 4000)')
  eq(row(b).split_percentage_applied, null, 'partner ticket: no percentage frozen (NULL)')

  // Loss: delivery is accepted by the server; shares are negative
  const c = mk({ price: 3000, cat: screen.id, cost: 3500 })
  toReady(c)
  toDelivered(c)
  eq([row(c).my_share, row(c).partner_share], [-250, -250], 'loss 3000/3500 at 50% => -250 / -250')
  const d = mk({ price: 3000, cat: screen.id, cost: 3500, tech: PARTNER })
  toReady(d)
  toDelivered(d)
  eq([row(d).my_share, row(d).partner_share], [0, -500], 'loss with the partner => 0 / -500')

  // 70% with fractions
  const e = mk({ price: 1255.5, cat: board70.id, cost: 100.25 })
  toReady(e)
  toDelivered(e)
  eq([row(e).my_share, row(e).partner_share], [808.68, 346.57], '70% with fractions: 808.68 / 346.57')
  eq(
    Math.round((Number(row(e).my_share) + Number(row(e).partner_share)) * 100),
    115525,
    'stored shares sum to the net exactly (cents)'
  )
  eq(row(e).split_percentage_applied, 70, '70 frozen')

  // Explicit zero cost: full price shared, not provisional
  const f = mk({ price: 4000, cat: screen.id, cost: 0 })
  toReady(f)
  toDelivered(f)
  eq([row(f).my_share, row(f).partner_share], [2000, 2000], 'explicit 0 cost: 2000 / 2000')

  // Category that does not require a cost and has none: shares on the full price
  const g = mk({ price: 4000, cat: flash.id })
  toReady(g)
  toDelivered(g)
  eq([row(g).my_share, row(g).partner_share], [2000, 2000], 'category not requiring a cost: shares on the price')

  // Delivery without the cost on a category that requires it: allowed, shares computed as if cost = 0
  const h = mk({ price: 4000, cat: screen.id })
  toReady(h)
  toDelivered(h)
  eq(
    [row(h).my_share, row(h).partner_share],
    [2000, 2000],
    'delivery without a cost is allowed (provisional: computed as if 0)'
  )
  eq(row(h).status, 'delivered', 'status is delivered')
  eq(row(h).split_percentage_applied, 50, 'the percentage is frozen even for a provisional delivery')
}

console.log('\n--- Section 4: setPartsCost on a DELIVERED ticket ---')
{
  // Delivered without a cost, then the cost arrives: 4000/2600 => 700/700
  const t = mk({ price: 4000, cat: screen.id })
  toReady(t)
  toDelivered(t)
  const logsBefore = logCount(t)
  const paidBefore = [row(t).amount_paid, row(t).amount_remaining, row(t).payment_type]
  const reportBefore = getFinancialReport(db, { period: 'all_time' })
  eq(
    reportBefore.tickets.find((x) => x.id === t)!.is_provisional,
    true,
    'before: the ticket is provisional in the report'
  )

  const updated = setPartsCost(db, t, 2600)
  eq(updated.parts_cost, 2600, 'setPartsCost returns the updated ticket')
  eq([row(t).my_share, row(t).partner_share], [700, 700], 'adding the cost later recomputes 700 / 700')
  eq(row(t).status, 'delivered', 'status unchanged')
  eq(logCount(t), logsBefore, 'no StatusLog row added')
  eq([row(t).amount_paid, row(t).amount_remaining, row(t).payment_type], paidBefore, 'payments unchanged')
  eq(row(t).split_percentage_applied, 50, 'frozen percentage unchanged')

  // The category percentage changes afterwards: editing the cost still uses the frozen 50
  db.prepare(`UPDATE RepairCategory SET default_split_percentage = 90 WHERE id = ?`).run(screen.id)
  setPartsCost(db, t, 2000)
  eq(
    [row(t).my_share, row(t).partner_share],
    [1000, 1000],
    'cost edit after a category change keeps the frozen 50% (2000 net => 1000 / 1000)'
  )
  db.prepare(`UPDATE RepairCategory SET default_split_percentage = 50 WHERE id = ?`).run(screen.id)

  const reportAfter = getFinancialReport(db, { period: 'all_time' })
  const entry = reportAfter.tickets.find((x) => x.id === t)!
  eq(
    [entry.is_provisional, entry.parts_cost_missing, entry.net_profit],
    [false, false, 2000],
    'report: no longer provisional, net 2000'
  )
  eq(
    reportAfter.provisionalTicketsCount,
    reportBefore.provisionalTicketsCount - 1,
    'report: provisional count dropped by one'
  )

  // Removing the cost (null) returns to provisional and to the price-based shares
  setPartsCost(db, t, null)
  eq(row(t).parts_cost, null, 'null clears the cost')
  eq([row(t).my_share, row(t).partner_share], [2000, 2000], 'cleared cost: shares back to the price')
  eq(
    getFinancialReport(db, { period: 'all_time' }).tickets.find((x) => x.id === t)!.is_provisional,
    true,
    'cleared cost: provisional again'
  )

  // Zero is an answer, null is not
  setPartsCost(db, t, 0)
  eq(row(t).parts_cost, 0, 'explicit zero stored')
  eq(
    getFinancialReport(db, { period: 'all_time' }).tickets.find((x) => x.id === t)!.is_provisional,
    false,
    'explicit zero: not provisional'
  )

  // Loss through setPartsCost: the server accepts (UI confirms)
  setPartsCost(db, t, 4500)
  eq(
    [row(t).my_share, row(t).partner_share],
    [-250, -250],
    'cost above the price: loss -250 / -250 (accepted by the server)'
  )
  const lossEntry = getFinancialReport(db, { period: 'all_time' }).tickets.find((x) => x.id === t)!
  eq([lossEntry.is_loss, lossEntry.net_profit], [true, -500], 'report flags the loss and the net')

  // Partner delivered ticket: 100% of the net
  const p = mk({ price: 4000, cat: screen.id, tech: PARTNER })
  toReady(p)
  toDelivered(p)
  eq([row(p).my_share, row(p).partner_share], [0, 4000], 'partner delivered without cost: 0 / 4000 (provisional)')
  setPartsCost(db, p, 2600)
  eq([row(p).my_share, row(p).partner_share], [0, 1400], 'partner: adding the cost later => 0 / 1400')
  setPartsCost(db, p, 4600)
  eq([row(p).my_share, row(p).partner_share], [0, -600], 'partner: loss => 0 / -600')
  eq(row(p).split_percentage_applied, null, 'partner: still no percentage')

  // Payments recorded later are independent of the cost
  const q = mk({ price: 4000, paid: 1000, cat: screen.id, cost: 2600 })
  toReady(q)
  toDelivered(q)
  eq(row(q).amount_remaining, 3000, 'debt after delivery (credit)')
  recordPayment(db, q, 500)
  setPartsCost(db, q, 100)
  eq([row(q).amount_paid, row(q).amount_remaining], [1500, 2500], 'cost edits never touch paid / remaining')
}

console.log('\n--- Section 5: setPartsCost on NOT delivered tickets ---')
{
  const t = mk({ price: 4000, cat: screen.id })
  const logsBefore = logCount(t)
  setPartsCost(db, t, 2600)
  eq(row(t).parts_cost, 2600, 'in progress: cost saved')
  eq(
    [row(t).status, row(t).my_share, row(t).partner_share, row(t).split_percentage_applied],
    ['in_progress', null, null, null],
    'in progress: status and shares untouched'
  )
  toReady(t)
  setPartsCost(db, t, 2700)
  eq(row(t).parts_cost, 2700, 'ready: cost saved')
  eq([row(t).status, row(t).my_share], ['ready', null], 'ready: status untouched, still no shares')
  eq(logCount(t), logsBefore + 1, 'only the real status change is logged (the ready transition)')
  toDelivered(t)
  eq(
    [row(t).my_share, row(t).partner_share],
    [650, 650],
    'the cost saved before delivery is used at delivery (4000 - 2700 => 650 / 650)'
  )

  // Revert from delivered: shares and frozen percentage are cleared, the cost stays
  updateTicketStatus(db, { ticketId: t, newStatus: 'ready' })
  eq(
    [row(t).my_share, row(t).partner_share, row(t).split_percentage_applied],
    [null, null, null],
    'revert from delivered clears shares and the frozen percentage'
  )
  eq(row(t).parts_cost, 2700, 'revert keeps the entered cost')
  setPartsCost(db, t, 1000)
  eq([row(t).my_share, row(t).partner_share], [null, null], 'cost edit while reverted does not create shares')
  // Re-delivery freezes the CURRENT category percentage
  db.prepare(`UPDATE RepairCategory SET default_split_percentage = 60 WHERE id = ?`).run(screen.id)
  toDelivered(t)
  eq(
    [row(t).my_share, row(t).partner_share, row(t).split_percentage_applied],
    [1800, 1200, 60],
    "re-delivery freezes the category's current 60% (net 3000 => 1800 / 1200)"
  )
  db.prepare(`UPDATE RepairCategory SET default_split_percentage = 50 WHERE id = ?`).run(screen.id)
}

console.log('\n--- Section 6: setPartsCost validation ---')
{
  const t = mk({ price: 4000, cat: screen.id, cost: 1000 })
  toReady(t)
  toDelivered(t)
  const snapshot = JSON.stringify(row(t))
  const bad: [string, unknown][] = [
    ['negative', -0.01],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
    ['text', 'abc'],
    ['boolean', true],
    ['object', {}],
    ['array', [5]]
  ]
  for (const [label, value] of bad) {
    const msg = throwsMessage(() => setPartsCost(db, t, value))
    eq(msg !== null && /[؀-ۿ]/.test(msg), true, `invalid value (${label}) is rejected with an Arabic message`)
  }
  eq(JSON.stringify(row(t)), snapshot, 'every rejected call left the ticket byte-for-byte unchanged')
  eq(throwsMessage(() => setPartsCost(db, 999999, 10)) !== null, true, 'unknown ticket id is rejected')
  eq(row(t).parts_cost, 1000, 'the stored cost survived the rejected calls')

  // accepted spellings
  setPartsCost(db, t, '1500' as unknown as number)
  eq(row(t).parts_cost, 1500, 'a numeric string is accepted')
  setPartsCost(db, t, '' as unknown as number)
  eq(row(t).parts_cost, null, 'an empty string means "not entered" (NULL)')
  setPartsCost(db, t, undefined as unknown as number)
  eq(row(t).parts_cost, null, 'undefined means "not entered" (NULL)')
  setPartsCost(db, t, 12.345)
  eq(row(t).parts_cost, 12.35, 'rounded to 2 decimals (12.345 => 12.35)')
  eq(
    throwsMessage(() => db.prepare(`UPDATE Ticket SET parts_cost = -5 WHERE id = ?`).run(t)) !== null,
    true,
    'the database itself refuses a negative cost (CHECK constraint)'
  )
  eq(
    throwsMessage(() => db.prepare(`UPDATE RepairCategory SET requires_parts_cost = 2 WHERE id = ?`).run(screen.id)) !==
      null,
    true,
    'the database itself refuses requires_parts_cost outside 0/1'
  )
}

console.log('\n--- Section 7: reports on the net profit ---')
{
  const rdb = new Database(':memory:')
  rdb.pragma('foreign_keys = ON')
  initializeSchema(rdb)
  seedInitialData(rdb)
  const cat = addRepairCategory(rdb, 'شاشات', 50, true)
  const cat2 = addRepairCategory(rdb, 'فلاش', 70, false)
  const mk2 = (price: number, cost: number | null | undefined, tech: number, category: number): number => {
    const id = createTicket(rdb, {
      customer: { name: `R ${phone}`, phone: `0${phone++}` },
      device: { brand: 'Realme', model: 'C51' },
      ticket: {
        repair_category_id: category,
        price,
        payment_type: 'cash',
        amount_paid: price,
        technician_id: tech,
        ...(cost !== undefined ? { parts_cost: cost } : {})
      }
    }).ticketId
    updateTicketStatus(rdb, { ticketId: id, newStatus: 'ready' })
    updateTicketStatus(rdb, { ticketId: id, newStatus: 'delivered' })
    return id
  }
  mk2(4000, 2600, ME, cat.id) //  net 1400 -> 700 / 700
  mk2(4000, 2600, PARTNER, cat.id) //  net 1400 -> 0 / 1400
  mk2(3000, 3500, ME, cat.id) //  net -500 -> -250 / -250
  mk2(2000, undefined, ME, cat.id) //  provisional: net 2000 -> 1000 / 1000
  mk2(1000, undefined, ME, cat2.id) //  70%, not required: net 1000 -> 700 / 300
  mk2(500, 0, ME, cat.id) //  explicit zero: net 500 -> 250 / 250

  const rep = getFinancialReport(rdb, { period: 'all_time' })
  eq(rep.totalRevenue, 14500, 'report: revenue is the sum of prices')
  eq(rep.totalPartsCost, 8700, 'report: total parts cost 2600 + 2600 + 3500 + 0')
  eq(rep.totalNetProfit, 5800, 'report: total net profit = revenue - costs')
  eq(rep.totalMyShare, 700 + 0 - 250 + 1000 + 700 + 250, 'report: my total on the net')
  eq(rep.totalPartnerShare, 700 + 1400 - 250 + 1000 + 300 + 250, 'report: partner total on the net')
  eq(
    Math.round((rep.totalMyShare + rep.totalPartnerShare) * 100),
    Math.round(rep.totalNetProfit * 100),
    'report: my + partner = net profit exactly'
  )
  eq(rep.provisionalTicketsCount, 1, 'report: exactly one provisional ticket (the one missing its cost)')
  eq(rep.lossTicketsCount, 1, 'report: exactly one loss ticket')
  eq(rep.completedTicketsCount, 6, 'report: six delivered tickets')
  eq(rep.totalPaid, 14500, 'report: payments are on the price (unaffected by costs)')
  eq(rep.totalOutstandingDebt, 0, 'report: no debt created by costs')

  const meBreak = rep.technicianBreakdown.find((x) => x.technicianId === ME)!
  const partnerBreak = rep.technicianBreakdown.find((x) => x.technicianId === PARTNER)!
  eq(
    [meBreak.totalRevenue, meBreak.partsCost, meBreak.netProfit],
    [10500, 6100, 4400],
    'technician "me": revenue / cost / net'
  )
  eq(
    [
      partnerBreak.totalRevenue,
      partnerBreak.partsCost,
      partnerBreak.netProfit,
      partnerBreak.partnerShare,
      partnerBreak.myShare
    ],
    [4000, 2600, 1400, 1400, 0],
    'partner technician: net 1400 all to the partner'
  )
  eq(
    Math.round((meBreak.myShare + meBreak.partnerShare) * 100),
    Math.round(meBreak.netProfit * 100),
    'technician "me": shares sum to the net'
  )
  const screens = rep.categoryBreakdown.find((x) => x.categoryId === cat.id)!
  eq(
    [screens.totalRevenue, screens.partsCost, screens.netProfit],
    [13500, 8700, 4800],
    'category breakdown: revenue / cost / net'
  )
  eq(
    Math.round((screens.myShare + screens.partnerShare) * 100),
    Math.round(screens.netProfit * 100),
    'category: shares sum to the net'
  )

  // The list payload never carries the amount of the cost
  eq(
    rep.tickets.every((x) => !('parts_cost' in x) && !('split_percentage_applied' in x)),
    true,
    'report tickets do not carry the raw cost / frozen percentage'
  )
  eq(
    rep.tickets.every((x) => typeof x.net_profit === 'number'),
    true,
    'report tickets carry net_profit'
  )

  // Filters keep working with the new fields
  const onlyPartner = getFinancialReport(rdb, { period: 'all_time', technicianFilter: String(PARTNER) })
  eq(
    [onlyPartner.totalPartsCost, onlyPartner.totalNetProfit, onlyPartner.provisionalTicketsCount],
    [2600, 1400, 0],
    'technician filter: costs and net follow the filter'
  )
  const onlyCat2 = getFinancialReport(rdb, { period: 'all_time', categoryFilter: cat2.id })
  eq(
    [onlyCat2.totalPartsCost, onlyCat2.totalNetProfit, onlyCat2.provisionalTicketsCount, onlyCat2.lossTicketsCount],
    [0, 1000, 0, 0],
    'category filter: a not-required category with no cost is not provisional'
  )

  // Empty report
  const empty = getFinancialReport(rdb, { period: 'custom', startDate: '2001-01-01', endDate: '2001-01-02' })
  eq(
    [empty.totalPartsCost, empty.totalNetProfit, empty.provisionalTicketsCount, empty.lossTicketsCount],
    [0, 0, 0, 0],
    'empty report: zeros'
  )

  // Legacy delivered ticket (no frozen shares) with a cost: computed on the net with the category percentage
  const legacy = mk2(4000, 2600, ME, cat.id)
  rdb
    .prepare(`UPDATE Ticket SET my_share = NULL, partner_share = NULL, split_percentage_applied = NULL WHERE id = ?`)
    .run(legacy)
  const legacyEntry = getFinancialReport(rdb, { period: 'all_time' }).tickets.find((x) => x.id === legacy)!
  eq(
    [legacyEntry.my_share, legacyEntry.partner_share],
    [700, 700],
    'report fallback for tickets without frozen shares uses the net'
  )
  rdb.prepare(`UPDATE Ticket SET split_percentage_applied = 80 WHERE id = ?`).run(legacy)
  const legacyFrozen = getFinancialReport(rdb, { period: 'all_time' }).tickets.find((x) => x.id === legacy)!
  eq(
    [legacyFrozen.my_share, legacyFrozen.partner_share],
    [1120, 280],
    "report fallback prefers the frozen percentage over the category's"
  )
  rdb.close()
}

console.log('\n--- Section 8: ticket list and details ---')
{
  const list = getTicketsList(db)
  eq(
    list.every((x) => !('parts_cost' in x)),
    true,
    'the tickets list never carries the cost amount'
  )
  const missing = list.filter((x) => x.parts_cost_missing)
  eq(missing.length > 0, true, 'some tickets are flagged as missing a cost')
  const flagged = missing.every((x) => x.category_name === 'شاشات (اختبار)' || x.category_name === 'بورد 70 (اختبار)')
  eq(flagged, true, 'only tickets of cost-requiring categories are flagged')
  const idMissing = mk({ price: 100, cat: screen.id })
  const idZero = mk({ price: 100, cat: screen.id, cost: 0 })
  const idFlash = mk({ price: 100, cat: flash.id })
  const byId = new Map(getTicketsList(db).map((x) => [x.id, x]))
  eq(byId.get(idMissing)!.parts_cost_missing, true, 'required category + NULL cost => flagged')
  eq(byId.get(idZero)!.parts_cost_missing, false, 'explicit 0 => not flagged')
  eq(byId.get(idFlash)!.parts_cost_missing, false, 'category not requiring a cost => not flagged')
  eq(typeof byId.get(idMissing)!.parts_cost_missing, 'boolean', 'the flag is a boolean')
  setPartsCost(db, idMissing, 80)
  eq(getTicketsList(db).find((x) => x.id === idMissing)!.parts_cost_missing, false, 'entering the cost clears the flag')
  // the flag follows the ticket's own snapshot, not the category's current switch
  const probe = mk({ price: 100, cat: screen.id })
  updateRepairCategory(db, screen.id, 'شاشات (اختبار)', 50, false)
  eq(
    getTicketsList(db).find((x) => x.id === probe)!.parts_cost_missing,
    true,
    'turning the category switch off does NOT change an existing ticket (snapshot)'
  )
  updateRepairCategory(db, screen.id, 'شاشات (اختبار)', 50, true)
  eq(
    getTicketsList(db).find((x) => x.id === probe)!.parts_cost_missing,
    true,
    'turning it back on changes nothing either'
  )

  const details = getTicketById(db, idZero)!
  eq(details.ticket.parts_cost, 0, 'details carry the ticket cost (owner screen)')
  eq(details.category!.requires_parts_cost, true, 'details carry the category switch as a boolean')
  eq(getTicketById(db, probe)!.ticket.parts_cost, null, 'details: NULL when not entered')
}

if (failures > 0) {
  console.error(`\n💥 ${failures} assertion(s) failed`)
  process.exit(1)
}
console.log('\n🎉 ALL PARTS-COST DATABASE TESTS PASSED! 🎉')
process.exit(0)
