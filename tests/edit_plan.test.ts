import { buildEditPlan, PRINTED_FIELDS, type EditFormValues } from '../src/renderer/components/tickets/edit/editPatch'
import type { AppMetadata, TicketFullDetails } from '../src/shared/types'

// The edit form's plan (what to send, what to show for review): only what differs is sent, and the review flags
// (recalculation, lowered payment, loss, customer record) follow the same rules as the backend.

let failures = 0
function eq<T>(actual: T, expected: T, message: string): void {
  if (Object.is(actual, expected) || JSON.stringify(actual) === JSON.stringify(expected)) {
    console.log(`✅ ${message}`)
  } else {
    failures++
    console.error(`❌ ${message}\n   expected: ${JSON.stringify(expected)}\n   actual:   ${JSON.stringify(actual)}`)
  }
}

const metadata: AppMetadata = {
  brands: [{ id: 1, name: 'Samsung' }],
  models: [{ id: 10, brand_id: 1, name: 'Galaxy A54' }],
  repairCategories: [
    { id: 1, name: 'شاشات', default_split_percentage: 50, requires_parts_cost: true },
    { id: 2, name: 'بورد', default_split_percentage: 70, requires_parts_cost: false }
  ],
  accessories: [
    { id: 1, name: 'شاحن' },
    { id: 2, name: 'شريحة SIM' }
  ],
  technicians: [
    { id: 1, name: 'أنا', is_partner: false },
    { id: 2, name: 'الشريك', is_partner: true }
  ]
}

function details(status: 'in_progress' | 'delivered' = 'in_progress'): TicketFullDetails {
  return {
    ticket: {
      id: 7,
      barcode_code: '21234567',
      customer_id: 3,
      created_at: '2026-10-01T10:00:00.000Z',
      technician: 'أنا',
      technician_id: 1,
      repair_category_id: 1,
      price: 4000,
      payment_type: 'cash',
      amount_paid: 4000,
      amount_remaining: 0,
      status,
      parts_cost: 2600
    },
    customer: { id: 3, name: 'Ali', phone: '0555', notes: null },
    device: {
      id: 1,
      ticket_id: 7,
      brand: 'Samsung',
      model: 'Galaxy A54',
      brand_id: 1,
      model_id: 10,
      short_label: 'SA A54'
    },
    category: metadata.repairCategories[0],
    accessories: [metadata.accessories[0]],
    statusLogs: [],
    editLogs: [],
    customerTicketCount: 2
  }
}

/** The form exactly as it opens on `details()` */
function unchanged(): EditFormValues {
  return {
    customerMode: 'edit',
    customer: { name: 'Ali', phone: '0555', notes: '' },
    reassign: { name: '', phone: '', notes: '' },
    device: { brand: 'Samsung', brandId: 1, model: 'Galaxy A54', modelId: 10, shortLabel: 'SA A54' },
    accessoryIds: [1],
    categoryId: 1,
    technicianId: 1,
    price: 4000,
    amountPaid: 4000,
    partsCost: 2600
  }
}

{
  const plan = buildEditPlan(details(), unchanged(), metadata)
  eq(plan.patch, {}, 'the form as opened: nothing to send')
  eq(plan.changes, [], 'and nothing to review')
}
{
  const form = unchanged()
  form.customer = { name: '  Ali   Ben ', phone: '0555', notes: '' }
  const plan = buildEditPlan(details(), form, metadata)
  eq(plan.patch, { customer: { name: 'Ali Ben', phone: '0555', notes: '' } }, 'customer record: cleaned name sent')
  eq(plan.changes, [{ field: 'customer_name', from: 'Ali', to: 'Ali Ben' }], 'only the name is listed')
  eq(plan.customerEdited, true, 'flagged as a customer record edit')
  eq(PRINTED_FIELDS.includes('customer_name'), true, 'the name is a printed field (reprint prompt)')
}
{
  const form = unchanged()
  form.customerMode = 'reassign'
  form.reassign = { id: 3, name: 'Ali', phone: '0555', notes: '' }
  eq(buildEditPlan(details(), form, metadata).patch, {}, 'reattaching to the same customer = nothing')
  form.reassign = { id: 9, name: 'Sara', phone: '0666', notes: '' }
  const plan = buildEditPlan(details(), form, metadata)
  eq(plan.patch, { reassign_customer: { id: 9, name: 'Sara', phone: '0666' } }, 'reattach: id + name + phone')
  eq(plan.changes, [{ field: 'customer', from: 'Ali · 0555', to: 'Sara · 0666' }], 'reattach shown as name · phone')
  eq(plan.customerEdited, false, 'reattaching does not edit the customer record')
}
{
  const form = unchanged()
  form.device = { brand: 'Realme', brandId: null, model: 'C51', modelId: null, shortLabel: '' }
  const plan = buildEditPlan(details(), form, metadata)
  eq(
    plan.patch,
    { device: { brand: 'Realme', model: 'C51', short_label: 'RL C51' } },
    'typed device: no ids, empty label regenerated'
  )
  eq(
    plan.changes.map((c) => c.field),
    ['brand', 'model', 'short_label'],
    'device lines'
  )
}
{
  const form = unchanged()
  form.accessoryIds = [2, 1]
  const plan = buildEditPlan(details(), form, metadata)
  eq(plan.patch, { accessory_ids: [2, 1] }, 'accessory added')
  eq(plan.changes, [{ field: 'accessories', from: 'شاحن', to: 'شاحن, شريحة SIM' }], 'accessories in the Settings order')
}
{
  // Not delivered: price / cost / technician / category never flag a recalculation
  const form = unchanged()
  form.price = 5000
  form.technicianId = 2
  form.categoryId = 2
  const open = buildEditPlan(details('in_progress'), form, metadata)
  eq(open.profitChanged, false, 'not delivered: no recalculation')
  const delivered = buildEditPlan(details('delivered'), form, metadata)
  eq(delivered.profitChanged, true, 'delivered: recalculation')
  eq(
    delivered.changes,
    [
      { field: 'repair_category', from: 'شاشات', to: 'بورد' },
      { field: 'technician', from: 'أنا', to: 'الشريك' },
      { field: 'price', from: '4000', to: '5000' },
      { field: 'payment_type', from: 'cash', to: 'credit' }
    ],
    'category / technician by name, price as a number, the type that follows the new remaining amount'
  )
  const accessoriesOnly = unchanged()
  accessoriesOnly.accessoryIds = []
  eq(
    buildEditPlan(details('delivered'), accessoriesOnly, metadata).profitChanged,
    false,
    'delivered, accessories only: no recalculation'
  )
}
{
  const form = unchanged()
  form.amountPaid = 1000
  const plan = buildEditPlan(details(), form, metadata)
  eq(plan.paidLowered, true, 'paid lowered is flagged')
  eq(plan.patch, { amount_paid: 1000 }, 'only the amount is sent (the backend derives the type)')
  eq(
    plan.changes,
    [
      { field: 'amount_paid', from: '4000', to: '1000' },
      { field: 'payment_type', from: 'cash', to: 'credit' }
    ],
    'the review shows the type the backend will write'
  )
}
{
  const form = unchanged()
  form.price = 5000
  form.amountPaid = 5000
  const plan = buildEditPlan(details(), form, metadata)
  eq(plan.patch, { price: 5000, amount_paid: 5000 }, 'fully paid at a new price: amounts only')
  eq(
    plan.changes.map((c) => c.field),
    ['price', 'amount_paid'],
    'still cash: no type line'
  )
}
{
  const form = unchanged()
  form.partsCost = null
  eq(buildEditPlan(details(), form, metadata).patch, { parts_cost: null }, 'cost cleared = null')
  form.partsCost = 4500
  const plan = buildEditPlan(details(), form, metadata)
  eq(plan.loss, true, 'cost above the price = loss')
  eq(plan.changes, [{ field: 'parts_cost', from: '2600', to: '4500' }], 'cost line (masked in the UI)')
}

if (failures > 0) {
  console.error(`\n❌ ${failures} check(s) failed`)
  process.exit(1)
}
console.log('\n✅ edit plan: all checks passed')
