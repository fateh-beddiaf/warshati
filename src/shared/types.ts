export interface Customer {
  id: number
  name: string
  phone: string
  notes: string | null
}

export type TechnicianName = 'أنا' | 'الشريك' | string
export type PaymentType = 'cash' | 'credit'
export type TicketStatus = 'in_progress' | 'ready' | 'delivered'

export interface Ticket {
  id: number
  barcode_code: string
  customer_id: number
  created_at: string
  technician: TechnicianName
  technician_id: number
  technician_is_partner?: boolean
  repair_category_id: number
  price: number
  payment_type: PaymentType
  amount_paid: number
  amount_remaining: number
  status: TicketStatus
  /** NULL = not entered yet; 0 = explicitly no cost. Shown to the owner only (never printed). */
  parts_cost?: number | null
  /** My percentage frozen at delivery (non-partner tickets); NULL before delivery / for the partner */
  split_percentage_applied?: number | null
  /**
   * Snapshot of the category's "requires a parts cost" switch, taken at creation (and again when the ticket's
   * category is edited): 1 = this ticket needs a cost
   */
  parts_cost_required?: number | boolean
  my_share?: number | null
  partner_share?: number | null
  /** The code the ticket had before the scannable ticket-code format (old WSH labels): still searchable */
  legacy_barcode_code?: string | null
}

export interface TicketDevice {
  id: number
  ticket_id: number
  brand: string
  model: string
  brand_id: number | null
  model_id: number | null
  short_label: string
}

export interface Accessories {
  id: number
  name: string
}

export interface TicketAccessories {
  ticket_id: number
  accessory_id: number
}

export interface RepairCategory {
  id: number
  name: string
  default_split_percentage: number
  /** Tickets of this category should have a parts cost (the user decides in Settings) */
  requires_parts_cost: boolean
}

export interface StatusLog {
  id: number
  ticket_id: number
  old_status: TicketStatus | null
  new_status: TicketStatus
  timestamp: string
}

/** Fields a ticket edit records in TicketEditLog (one row per changed field). */
export type TicketEditField =
  | 'customer'
  | 'customer_name'
  | 'customer_phone'
  | 'customer_notes'
  | 'brand'
  | 'model'
  | 'short_label'
  | 'accessories'
  | 'repair_category'
  | 'technician'
  | 'price'
  | 'amount_paid'
  | 'payment_type'
  | 'parts_cost'

/**
 * One changed field of one ticket edit. Values are readable text snapshots taken at the time of the edit
 * (names, not ids, so renaming a category later does not rewrite history); NULL = empty / not entered.
 * Money is stored as a plain number ("4000"); payment_type as 'cash' | 'credit'; accessories as names joined by ", ";
 * customer (attached to another customer) as "name · phone". All rows of one edit share the same timestamp.
 * parts_cost values are owner-only: the UI masks them like every other cost.
 */
export interface TicketEditLog {
  id: number
  ticket_id: number
  field: TicketEditField
  old_value: string | null
  new_value: string | null
  timestamp: string
}

/**
 * The editable parts of a ticket (updateTicket). Every key is optional: only what is sent is checked and compared,
 * and only what actually differs is changed and logged. Barcode, created_at, status and StatusLog are never editable.
 */
export interface UpdateTicketPatch {
  /** Edits the Customer record itself: the change shows on EVERY ticket of this customer */
  customer?: { name: string; phone: string; notes?: string }
  /** Moves this ticket to another customer, found or created with the New Ticket matching rules (never renames one) */
  reassign_customer?: { id?: number; name: string; phone: string; notes?: string }
  /** The whole device: brand, model (with their reference ids when picked from the lists) and the short label */
  device?: { brand: string; model: string; brand_id?: number; model_id?: number; short_label?: string }
  accessory_ids?: number[]
  repair_category_id?: number
  technician_id?: number
  price?: number
  amount_paid?: number
  /** null = not entered */
  parts_cost?: number | null
  /** Required to edit a delivered ticket: its profit split may be recalculated */
  confirm_delivered?: boolean
  /** Required to lower amount_paid: it creates or increases a debt */
  confirm_paid_lowered?: boolean
}

export interface UpdateTicketResult {
  details: TicketFullDetails
  /** The fields that changed (as logged). Empty = nothing differed, nothing was written. */
  changedFields: TicketEditField[]
}

export interface Brand {
  id: number
  name: string
}

export interface Model {
  id: number
  brand_id: number
  name: string
}

export interface Technician {
  id: number
  name: string
  is_partner: boolean
}

export interface Setting {
  key: string
  value: string
}

// DTOs and aggregated views for IPC & UI
export interface CreateTicketDTO {
  customer: {
    id?: number
    name: string
    phone: string
    notes?: string
  }
  device: {
    brand: string
    model: string
    brand_id?: number
    model_id?: number
    short_label?: string
  }
  ticket: {
    repair_category_id: number
    price: number
    /** Not used: the stored type always follows the remaining amount (shared/payment.ts). Kept for older callers. */
    payment_type?: PaymentType
    amount_paid: number
    technician_id: number
    /** Parts cost; omitted/null = not entered yet */
    parts_cost?: number | null
  }
  accessory_ids?: number[]
}

export interface UpdateTicketStatusDTO {
  ticketId: number
  newStatus: TicketStatus
  paymentUpdate?: {
    amount_paid?: number
    /** Not used: the stored type always follows the remaining amount (shared/payment.ts). Kept for older callers. */
    payment_type?: PaymentType
  }
}

export interface TicketListItem {
  id: number
  barcode_code: string
  customer_id: number
  customer_name: string
  customer_phone: string
  brand: string
  model: string
  short_label: string
  category_name: string
  repair_category_id: number
  price: number
  payment_type: PaymentType
  amount_paid: number
  amount_remaining: number
  status: TicketStatus
  technician: TechnicianName
  technician_id: number
  technician_is_partner?: boolean
  created_at: string
  my_share?: number | null
  partner_share?: number | null
  /** The category requires a parts cost and none was entered yet (the amount itself is never in lists) */
  parts_cost_missing?: boolean
  /** Net profit (price - cost); only filled by the financial report */
  net_profit?: number
  /** Report only: delivered with a cost still missing (profits not final) */
  is_provisional?: boolean
  /** Report only: cost exceeds the price */
  is_loss?: boolean
  accessories?: string[]
  ready_at?: string | null
  is_overdue?: boolean
  overdue_days?: number
}

export interface AppMetadata {
  brands: Brand[]
  models: Model[]
  repairCategories: RepairCategory[]
  accessories: Accessories[]
  technicians: Technician[]
}

export interface TicketFullDetails {
  ticket: Ticket
  customer: Customer
  device: TicketDevice
  category: RepairCategory | null
  accessories: Accessories[]
  statusLogs: StatusLog[]
  /** Field edits, oldest first (TicketEditLog) */
  editLogs: TicketEditLog[]
  /** How many tickets this ticket's customer has (editing the customer changes all of them) */
  customerTicketCount: number
  ready_at?: string | null
  is_overdue?: boolean
  overdue_days?: number
}

export interface PrintLabelData {
  barcode: string
  customerName: string
  customerPhone?: string
  shortLabel: string
  ticketId?: number
  printerName?: string
}

/** A printer as the print dialog lists it (see main/printers.ts). */
export interface PrinterInfo {
  name: string
  displayName: string
  description: string
  /** The OS default printer: preselected in the print dialog when no label printer is remembered */
  isDefault: boolean
  /** The remembered label printer (last one a label printed on, or chosen in Settings): preselected first */
  isLabelPrinter: boolean
}

/** Setting holding the label printer's name ('' = none: the OS default is used) */
export const LABEL_PRINTER_SETTING_KEY = 'label_printer'

// Report Data Types
export type ReportPeriod = 'today' | 'this_week' | 'this_month' | 'custom' | 'all_time'

export interface ReportFilterDTO {
  period: ReportPeriod
  startDate?: string
  endDate?: string
  technicianFilter?: string
  categoryFilter?: number | 'all'
}

export interface TechnicianReportSummary {
  technicianId: number
  technician: string
  isPartner: boolean
  ticketsCount: number
  totalRevenue: number
  partsCost: number
  netProfit: number
  myShare: number
  partnerShare: number
}

export interface CategoryReportSummary {
  categoryId: number
  categoryName: string
  splitPercentage: number
  ticketsCount: number
  totalRevenue: number
  partsCost: number
  netProfit: number
  myShare: number
  partnerShare: number
}

export interface FinancialReportResult {
  period: ReportPeriod
  startDate: string
  endDate: string
  totalRevenue: number
  /** Sum of the parts costs of the delivered tickets in the period */
  totalPartsCost: number
  /** Revenue minus parts costs: the amount actually shared (myShare + partnerShare) */
  totalNetProfit: number
  totalMyShare: number
  totalPartnerShare: number
  totalPaid: number
  totalOutstandingDebt: number
  completedTicketsCount: number
  /** Delivered tickets whose category requires a cost that was not entered: profits not final */
  provisionalTicketsCount: number
  /** Delivered tickets sold at a loss (cost > price) */
  lossTicketsCount: number
  inProgressTicketsCount: number
  readyTicketsCount: number
  technicianBreakdown: TechnicianReportSummary[]
  categoryBreakdown: CategoryReportSummary[]
  tickets: TicketListItem[]
}

export interface DatabaseInfo {
  filePath: string
  fileSizeBytes: number
  fileSizeFormatted: string
  lastModified: string
}

export interface DeleteReferenceCheckResult {
  canDelete: boolean
  usedCount: number
  message?: string
}
