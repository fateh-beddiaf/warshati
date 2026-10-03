import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { initializeSchema } from './schema'
import { seedInitialData } from './seed'
import * as ticketQueries from './queries/tickets'
import * as customerQueries from './queries/customers'
import * as metadataQueries from './queries/metadata'
import * as settingsQueries from './queries/settings'
import * as reportsQueries from './queries/reports'
import type {
  CreateTicketDTO,
  UpdateTicketStatusDTO,
  TicketListItem,
  Customer,
  AppMetadata,
  Model,
  Brand,
  TicketFullDetails,
  Ticket,
  ReportFilterDTO,
  FinancialReportResult
} from '../shared/types'

let dbInstance: Database.Database | null = null
let currentDbPath: string | null = null

export function getDatabasePath(customPath?: string): string {
  if (customPath) return customPath
  if (currentDbPath) return currentDbPath
  const baseDir = process.env.WARSHATI_DATA_DIR || process.cwd()
  return join(baseDir, 'data', 'warshati.db')
}

export function initDatabase(customPath?: string): Database.Database {
  if (dbInstance) {
    return dbInstance
  }

  const dbPath = getDatabasePath(customPath)
  currentDbPath = dbPath

  // Ensure target directory exists for any path (custom, dev, userData, or fallback)
  if (dbPath !== ':memory:') {
    const targetDir = dirname(dbPath)
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true })
    }
  }

  const db = new Database(dbPath)
  try {
    // Enable WAL mode for high performance and durability
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    // Run schema & seed
    initializeSchema(db)
    seedInitialData(db)
  } catch (err) {
    // Never leak an open handle (it would keep the file locked on Windows)
    try {
      db.close()
    } catch {
      // ignore
    }
    throw err
  }

  dbInstance = db
  return dbInstance
}

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    return initDatabase()
  }
  return dbInstance
}

export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.pragma('wal_checkpoint(TRUNCATE)')
    } catch {
      // ignore
    }
    dbInstance.close()
    dbInstance = null
  }
}

// Database Service API used by IPC Handlers
export const dbService = {
  // Tickets
  createTicket: (dto: CreateTicketDTO): { ticketId: number; barcode: string } => {
    return ticketQueries.createTicket(getDatabase(), dto)
  },
  updateTicketStatus: (dto: UpdateTicketStatusDTO): { success: boolean; ticket: Ticket } => {
    return ticketQueries.updateTicketStatus(getDatabase(), dto)
  },
  recordPayment: (ticketId: number, amount: number): Ticket => {
    return ticketQueries.recordPayment(getDatabase(), ticketId, amount)
  },
  getTicketsList: (searchQuery?: string, statusFilter?: string): TicketListItem[] => {
    return ticketQueries.getTicketsList(getDatabase(), searchQuery, statusFilter)
  },
  getTicketById: (ticketId: number): TicketFullDetails | null => {
    return ticketQueries.getTicketById(getDatabase(), ticketId)
  },
  getTicketByBarcode: (barcode: string): TicketFullDetails | null => {
    return ticketQueries.getTicketByBarcode(getDatabase(), barcode)
  },
  deleteTicket: (ticketId: number): { success: boolean; customerDeleted: boolean } => {
    return ticketQueries.deleteTicket(getDatabase(), ticketId)
  },

  // Customers
  searchCustomers: (query: string): Customer[] => {
    return customerQueries.searchCustomers(getDatabase(), query)
  },
  getCustomerById: (id: number): Customer | null => {
    return customerQueries.getCustomerById(getDatabase(), id)
  },

  // Metadata & Reference CRUD
  getAppMetadata: (): AppMetadata => {
    return metadataQueries.getAppMetadata(getDatabase())
  },
  getBrands: (): Brand[] => {
    return metadataQueries.getBrands(getDatabase())
  },
  addBrand: (name: string): Brand => {
    return metadataQueries.addBrand(getDatabase(), name)
  },
  updateBrand: (id: number, name: string): void => {
    metadataQueries.updateBrand(getDatabase(), id, name)
  },
  checkBrandUsage: (id: number) => {
    return metadataQueries.checkBrandUsage(getDatabase(), id)
  },
  deleteBrand: (id: number): void => {
    metadataQueries.deleteBrand(getDatabase(), id)
  },

  getModelsByBrand: (brandId: number): Model[] => {
    return metadataQueries.getModelsByBrand(getDatabase(), brandId)
  },
  getAllModels: (): Model[] => {
    return metadataQueries.getAllModels(getDatabase())
  },
  addModel: (brandId: number, name: string): Model => {
    return metadataQueries.addModel(getDatabase(), brandId, name)
  },
  updateModel: (id: number, name: string, brandId?: number): void => {
    metadataQueries.updateModel(getDatabase(), id, name, brandId)
  },
  checkModelUsage: (id: number) => {
    return metadataQueries.checkModelUsage(getDatabase(), id)
  },
  deleteModel: (id: number): void => {
    metadataQueries.deleteModel(getDatabase(), id)
  },

  getAccessories: (): import('../shared/types').Accessories[] => {
    return metadataQueries.getAccessories(getDatabase())
  },
  addAccessory: (name: string): import('../shared/types').Accessories => {
    return metadataQueries.addAccessory(getDatabase(), name)
  },
  updateAccessory: (id: number, name: string): void => {
    metadataQueries.updateAccessory(getDatabase(), id, name)
  },
  checkAccessoryUsage: (id: number) => {
    return metadataQueries.checkAccessoryUsage(getDatabase(), id)
  },
  deleteAccessory: (id: number): void => {
    metadataQueries.deleteAccessory(getDatabase(), id)
  },

  getRepairCategories: (): import('../shared/types').RepairCategory[] => {
    return metadataQueries.getRepairCategories(getDatabase())
  },
  addRepairCategory: (name: string, defaultSplitPercentage: number): import('../shared/types').RepairCategory => {
    return metadataQueries.addRepairCategory(getDatabase(), name, defaultSplitPercentage)
  },
  updateRepairCategory: (id: number, name: string, defaultSplitPercentage: number): void => {
    metadataQueries.updateRepairCategory(getDatabase(), id, name, defaultSplitPercentage)
  },
  checkRepairCategoryUsage: (id: number) => {
    return metadataQueries.checkRepairCategoryUsage(getDatabase(), id)
  },
  deleteRepairCategory: (id: number): void => {
    metadataQueries.deleteRepairCategory(getDatabase(), id)
  },

  getTechnicians: (): import('../shared/types').Technician[] => {
    return metadataQueries.getTechnicians(getDatabase())
  },
  addTechnician: (name: string): import('../shared/types').Technician => {
    return metadataQueries.addTechnician(getDatabase(), name)
  },
  updateTechnician: (id: number, name: string): void => {
    metadataQueries.updateTechnician(getDatabase(), id, name)
  },
  checkTechnicianUsage: (id: number) => {
    return metadataQueries.checkTechnicianUsage(getDatabase(), id)
  },
  deleteTechnician: (id: number): void => {
    metadataQueries.deleteTechnician(getDatabase(), id)
  },

  // Settings
  getSetting: (key: string, defaultValue?: string): string => {
    return settingsQueries.getSetting(getDatabase(), key, defaultValue)
  },
  setSetting: (key: string, value: string): void => {
    settingsQueries.setSetting(getDatabase(), key, value)
  },
  getOverdueThresholdDays: (): number => {
    return settingsQueries.getOverdueThresholdDays(getDatabase())
  },

  // Reports
  getFinancialReport: (filter?: ReportFilterDTO): FinancialReportResult => {
    return reportsQueries.getFinancialReport(getDatabase(), filter)
  }
}

export * from '../shared/types'

