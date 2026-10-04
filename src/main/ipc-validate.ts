// Input guards for the IPC handlers. The renderer is typed, but the main process must not trust what crosses
// the IPC boundary: every argument is checked for its primitive type (and shape, for DTOs) before it reaches
// the database. The guards only check, they never coerce, so valid input reaches the database unchanged.
// A failed check throws; each handler's catch turns it into { success: false, error }.
import type {
  CreateTicketDTO,
  PaymentType,
  PrintLabelData,
  ReportFilterDTO,
  ReportPeriod,
  TicketStatus,
  UpdateTicketStatusDTO
} from '../shared/types'

/** Upper bound for free text (names, notes, search queries, setting values). */
export const MAX_TEXT_LENGTH = 10_000
/** The barcode SVG sent for printing is larger than any typed text. */
export const MAX_SVG_LENGTH = 500_000

const TICKET_STATUSES: readonly TicketStatus[] = ['in_progress', 'ready', 'delivered']
const PAYMENT_TYPES: readonly PaymentType[] = ['cash', 'credit']
const REPORT_PERIODS: readonly ReportPeriod[] = ['today', 'this_week', 'this_month', 'custom', 'all_time']

function fail(name: string, expected: string): never {
  throw new Error(`Invalid input: ${name} must be ${expected}`)
}

export function assertId(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) fail(name, 'a positive integer')
}

export function assertNumber(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(name, 'a finite number')
}

export function assertString(value: unknown, name: string, maxLength = MAX_TEXT_LENGTH): asserts value is string {
  if (typeof value !== 'string') fail(name, 'a string')
  if (value.length > maxLength) fail(name, `at most ${maxLength} characters`)
}

// "Optional" = may be undefined (an omitted argument or field). Only the parts cost uses null ("not entered").
export function assertOptionalId(value: unknown, name: string): asserts value is number | undefined {
  if (value !== undefined) assertId(value, name)
}

export function assertOptionalNumber(value: unknown, name: string): asserts value is number | undefined {
  if (value !== undefined) assertNumber(value, name)
}

export function assertNullableNumber(value: unknown, name: string): asserts value is number | null {
  if (value !== null) assertNumber(value, name)
}

export function assertOptionalString(
  value: unknown,
  name: string,
  maxLength = MAX_TEXT_LENGTH
): asserts value is string | undefined {
  if (value !== undefined) assertString(value, name, maxLength)
}

export function assertOptionalBoolean(value: unknown, name: string): asserts value is boolean | undefined {
  if (value !== undefined && typeof value !== 'boolean') fail(name, 'a boolean')
}

function assertOneOf<T extends string>(value: unknown, name: string, allowed: readonly T[]): asserts value is T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    fail(name, `one of ${allowed.join(', ')}`)
  }
}

function assertObject(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(name, 'an object')
}

export function assertCreateTicketDTO(dto: unknown): asserts dto is CreateTicketDTO {
  assertObject(dto, 'ticket')
  const { customer, device, ticket, accessory_ids } = dto

  assertObject(customer, 'customer')
  assertOptionalId(customer.id, 'customer.id')
  assertString(customer.name, 'customer.name')
  assertString(customer.phone, 'customer.phone')
  assertOptionalString(customer.notes, 'customer.notes')

  assertObject(device, 'device')
  assertString(device.brand, 'device.brand')
  assertString(device.model, 'device.model')
  assertOptionalId(device.brand_id, 'device.brand_id')
  assertOptionalId(device.model_id, 'device.model_id')
  assertOptionalString(device.short_label, 'device.short_label')

  assertObject(ticket, 'ticket')
  assertId(ticket.repair_category_id, 'ticket.repair_category_id')
  assertNumber(ticket.price, 'ticket.price')
  assertOneOf(ticket.payment_type, 'ticket.payment_type', PAYMENT_TYPES)
  assertNumber(ticket.amount_paid, 'ticket.amount_paid')
  assertId(ticket.technician_id, 'ticket.technician_id')
  if (ticket.parts_cost !== undefined) assertNullableNumber(ticket.parts_cost, 'ticket.parts_cost')

  if (accessory_ids !== undefined) {
    if (!Array.isArray(accessory_ids)) fail('accessory_ids', 'an array')
    accessory_ids.forEach((accessoryId, i) => assertId(accessoryId, `accessory_ids[${i}]`))
  }
}

export function assertUpdateTicketStatusDTO(dto: unknown): asserts dto is UpdateTicketStatusDTO {
  assertObject(dto, 'status update')
  assertId(dto.ticketId, 'ticketId')
  assertOneOf(dto.newStatus, 'newStatus', TICKET_STATUSES)
  if (dto.paymentUpdate !== undefined) {
    assertObject(dto.paymentUpdate, 'paymentUpdate')
    assertOptionalNumber(dto.paymentUpdate.amount_paid, 'paymentUpdate.amount_paid')
    if (dto.paymentUpdate.payment_type !== undefined) {
      assertOneOf(dto.paymentUpdate.payment_type, 'paymentUpdate.payment_type', PAYMENT_TYPES)
    }
  }
}

export function assertReportFilterDTO(filter: unknown): asserts filter is ReportFilterDTO | undefined {
  if (filter === undefined) return
  assertObject(filter, 'report filter')
  assertOneOf(filter.period, 'period', REPORT_PERIODS)
  assertOptionalString(filter.startDate, 'startDate')
  assertOptionalString(filter.endDate, 'endDate')
  assertOptionalString(filter.technicianFilter, 'technicianFilter')
  if (filter.categoryFilter !== undefined && filter.categoryFilter !== 'all') {
    assertId(filter.categoryFilter, 'categoryFilter')
  }
}

export function assertPrintLabelData(data: unknown): asserts data is PrintLabelData & { svgContent?: string } {
  assertObject(data, 'label')
  assertString(data.barcode, 'barcode')
  assertString(data.customerName, 'customerName')
  assertOptionalString(data.customerPhone, 'customerPhone')
  assertString(data.shortLabel, 'shortLabel')
  assertOptionalId(data.ticketId, 'ticketId')
  assertOptionalString(data.printerName, 'printerName')
  assertOptionalString(data.svgContent, 'svgContent', MAX_SVG_LENGTH)
}
