import type {
  CreateTicketDTO,
  UpdateTicketStatusDTO,
  TicketListItem,
  Customer,
  AppMetadata,
  TicketFullDetails,
  PrintLabelData,
  Ticket,
  ReportFilterDTO,
  FinancialReportResult
} from '../shared/types'

export interface PrinterInfo {
  name: string
  displayName?: string
  description?: string
  status?: number
  isDefault?: boolean
}

export interface IElectronAPI {
  createTicket: (dto: CreateTicketDTO) => Promise<{ success: boolean; data?: { ticketId: number; barcode: string }; error?: string }>
  recordPayment: (ticketId: number, amount: number) => Promise<{ success: boolean; data?: Ticket; error?: string }>
  updateTicketStatus: (dto: UpdateTicketStatusDTO) => Promise<{ success: boolean; data?: { success: boolean; ticket: Ticket }; error?: string }>
  getTicketsList: (searchQuery?: string, statusFilter?: string) => Promise<{ success: boolean; data?: TicketListItem[]; error?: string }>
  getTicketById: (id: number) => Promise<{ success: boolean; data?: TicketFullDetails | null; error?: string }>
  getTicketByBarcode: (barcode: string) => Promise<{ success: boolean; data?: TicketFullDetails | null; error?: string }>
  deleteTicket: (id: number) => Promise<{ success: boolean; customerDeleted?: boolean; error?: string }>
  searchCustomers: (query: string) => Promise<{ success: boolean; data?: Customer[]; error?: string }>
  getCustomerById: (id: number) => Promise<{ success: boolean; data?: Customer | null; error?: string }>
  getMetadata: () => Promise<{ success: boolean; data?: AppMetadata; error?: string }>
  getSetting: (key: string, defaultValue?: string) => Promise<{ success: boolean; data?: string; error?: string }>
  setSetting: (key: string, value: string) => Promise<{ success: boolean; error?: string }>
  getOverdueDays: () => Promise<{ success: boolean; data?: number; error?: string }>
  // Settings & Reference CRUD: Brands
  getBrands: () => Promise<{ success: boolean; data?: import('../shared/types').Brand[]; error?: string }>
  addBrand: (name: string) => Promise<{ success: boolean; data?: import('../shared/types').Brand; error?: string }>
  updateBrand: (id: number, name: string) => Promise<{ success: boolean; error?: string }>
  checkBrandUsage: (id: number) => Promise<{ success: boolean; data?: import('../shared/types').DeleteReferenceCheckResult; error?: string }>
  deleteBrand: (id: number) => Promise<{ success: boolean; error?: string }>

  // Settings & Reference CRUD: Models
  getModelsByBrand: (brandId: number) => Promise<{ success: boolean; data?: import('../shared/types').Model[]; error?: string }>
  getAllModels: () => Promise<{ success: boolean; data?: import('../shared/types').Model[]; error?: string }>
  addModel: (brandId: number, name: string) => Promise<{ success: boolean; data?: import('../shared/types').Model; error?: string }>
  updateModel: (id: number, name: string, brandId?: number) => Promise<{ success: boolean; error?: string }>
  checkModelUsage: (id: number) => Promise<{ success: boolean; data?: import('../shared/types').DeleteReferenceCheckResult; error?: string }>
  deleteModel: (id: number) => Promise<{ success: boolean; error?: string }>

  // Settings & Reference CRUD: Accessories
  getAccessories: () => Promise<{ success: boolean; data?: import('../shared/types').Accessories[]; error?: string }>
  addAccessory: (name: string) => Promise<{ success: boolean; data?: import('../shared/types').Accessories; error?: string }>
  updateAccessory: (id: number, name: string) => Promise<{ success: boolean; error?: string }>
  checkAccessoryUsage: (id: number) => Promise<{ success: boolean; data?: import('../shared/types').DeleteReferenceCheckResult; error?: string }>
  deleteAccessory: (id: number) => Promise<{ success: boolean; error?: string }>

  // Settings & Reference CRUD: Repair Categories
  getRepairCategories: () => Promise<{ success: boolean; data?: import('../shared/types').RepairCategory[]; error?: string }>
  addRepairCategory: (name: string, defaultSplitPercentage: number) => Promise<{ success: boolean; data?: import('../shared/types').RepairCategory; error?: string }>
  updateRepairCategory: (id: number, name: string, defaultSplitPercentage: number) => Promise<{ success: boolean; error?: string }>
  checkRepairCategoryUsage: (id: number) => Promise<{ success: boolean; data?: import('../shared/types').DeleteReferenceCheckResult; error?: string }>
  deleteRepairCategory: (id: number) => Promise<{ success: boolean; error?: string }>

  // Settings & Reference CRUD: Technicians
  getTechnicians: () => Promise<{ success: boolean; data?: import('../shared/types').Technician[]; error?: string }>
  addTechnician: (name: string) => Promise<{ success: boolean; data?: import('../shared/types').Technician; error?: string }>
  updateTechnician: (id: number, name: string) => Promise<{ success: boolean; error?: string }>
  checkTechnicianUsage: (id: number) => Promise<{ success: boolean; data?: import('../shared/types').DeleteReferenceCheckResult; error?: string }>
  deleteTechnician: (id: number) => Promise<{ success: boolean; error?: string }>

  // Backup & Restore
  getDatabaseInfo: () => Promise<{ success: boolean; data?: import('../shared/types').DatabaseInfo; error?: string }>
  exportBackup: () => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>
  importBackup: () => Promise<{ success: boolean; filePath?: string; safetyBackupPath?: string; canceled?: boolean; error?: string }>

  // Printer
  getPrinters: () => Promise<{ success: boolean; data?: PrinterInfo[]; error?: string }>
  printLabel: (labelData: PrintLabelData & { svgContent?: string }) => Promise<{ success: boolean; error?: string }>

  // Reports
  getFinancialReport: (filter?: ReportFilterDTO) => Promise<{ success: boolean; data?: FinancialReportResult; error?: string }>
}

declare global {
  interface Window {
    api: IElectronAPI
  }
}

