import { contextBridge, ipcRenderer } from 'electron'
import type { CreateTicketDTO, ReportFilterDTO } from '../shared/types'
import { THEME_ARG_RESOLVED, type ResolvedTheme } from '../shared/theme'

// Apply the saved theme to <html> before the first paint (no white flash in dark mode).
// Main passes the already-resolved theme as a process argument so this stays synchronous.
function applyBootTheme(): void {
  const arg = process.argv.find((a) => a.startsWith(THEME_ARG_RESOLVED))
  const resolved: ResolvedTheme = arg?.slice(THEME_ARG_RESOLVED.length) === 'dark' ? 'dark' : 'light'
  const apply = (): boolean => {
    const root = document.documentElement
    if (!root) return false
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
    root.setAttribute('data-theme-boot', resolved)
    return true
  }
  if (apply()) return
  // documentElement can still be null when the preload runs this early: wait for it
  const observer = new MutationObserver(() => {
    if (apply()) observer.disconnect()
  })
  observer.observe(document, { childList: true })
}
applyBootTheme()

// Custom APIs for renderer
const api = {
  // Tickets
  createTicket: (dto: CreateTicketDTO) => ipcRenderer.invoke('tickets:create', dto),
  recordPayment: (ticketId: number, amount: number) =>
    ipcRenderer.invoke('tickets:recordPayment', ticketId, amount),
  setPartsCost: (ticketId: number, cost: number | null) =>
    ipcRenderer.invoke('tickets:setPartsCost', ticketId, cost),
  updateTicketStatus: (dto: import('../shared/types').UpdateTicketStatusDTO) =>
    ipcRenderer.invoke('tickets:updateStatus', dto),
  getTicketsList: (searchQuery?: string, statusFilter?: string) =>
    ipcRenderer.invoke('tickets:list', searchQuery, statusFilter),
  getTicketById: (id: number) => ipcRenderer.invoke('tickets:getById', id),
  getTicketByBarcode: (barcode: string) => ipcRenderer.invoke('tickets:getByBarcode', barcode),
  deleteTicket: (id: number) => ipcRenderer.invoke('tickets:delete', id),

  // Customers
  searchCustomers: (query: string) => ipcRenderer.invoke('customers:search', query),
  getCustomerById: (id: number) => ipcRenderer.invoke('customers:getById', id),

  // Metadata
  getMetadata: () => ipcRenderer.invoke('metadata:get'),

  // Settings
  getSetting: (key: string, defaultValue?: string) => ipcRenderer.invoke('settings:get', key, defaultValue),
  setSetting: (key: string, value: string) => ipcRenderer.invoke('settings:set', key, value),
  getOverdueDays: () => ipcRenderer.invoke('settings:getOverdueDays'),

  // Settings & Reference CRUD: Brands
  getBrands: () => ipcRenderer.invoke('settings:brands:get'),
  addBrand: (name: string) => ipcRenderer.invoke('settings:brands:add', name),
  updateBrand: (id: number, name: string) => ipcRenderer.invoke('settings:brands:update', id, name),
  checkBrandUsage: (id: number) => ipcRenderer.invoke('settings:brands:checkUsage', id),
  deleteBrand: (id: number) => ipcRenderer.invoke('settings:brands:delete', id),

  // Settings & Reference CRUD: Models
  getModelsByBrand: (brandId: number) => ipcRenderer.invoke('settings:models:getByBrand', brandId),
  getAllModels: () => ipcRenderer.invoke('settings:models:getAll'),
  addModel: (brandId: number, name: string) => ipcRenderer.invoke('settings:models:add', brandId, name),
  updateModel: (id: number, name: string, brandId?: number) =>
    ipcRenderer.invoke('settings:models:update', id, name, brandId),
  checkModelUsage: (id: number) => ipcRenderer.invoke('settings:models:checkUsage', id),
  deleteModel: (id: number) => ipcRenderer.invoke('settings:models:delete', id),

  // Settings & Reference CRUD: Accessories
  getAccessories: () => ipcRenderer.invoke('settings:accessories:get'),
  addAccessory: (name: string) => ipcRenderer.invoke('settings:accessories:add', name),
  updateAccessory: (id: number, name: string) => ipcRenderer.invoke('settings:accessories:update', id, name),
  checkAccessoryUsage: (id: number) => ipcRenderer.invoke('settings:accessories:checkUsage', id),
  deleteAccessory: (id: number) => ipcRenderer.invoke('settings:accessories:delete', id),

  // Settings & Reference CRUD: Repair Categories
  getRepairCategories: () => ipcRenderer.invoke('settings:categories:get'),
  addRepairCategory: (name: string, defaultSplitPercentage: number, requiresPartsCost?: boolean) =>
    ipcRenderer.invoke('settings:categories:add', name, defaultSplitPercentage, requiresPartsCost),
  updateRepairCategory: (id: number, name: string, defaultSplitPercentage: number, requiresPartsCost?: boolean) =>
    ipcRenderer.invoke('settings:categories:update', id, name, defaultSplitPercentage, requiresPartsCost),
  checkRepairCategoryUsage: (id: number) => ipcRenderer.invoke('settings:categories:checkUsage', id),
  deleteRepairCategory: (id: number) => ipcRenderer.invoke('settings:categories:delete', id),

  // Settings & Reference CRUD: Technicians
  getTechnicians: () => ipcRenderer.invoke('settings:technicians:get'),
  addTechnician: (name: string) => ipcRenderer.invoke('settings:technicians:add', name),
  updateTechnician: (id: number, name: string) => ipcRenderer.invoke('settings:technicians:update', id, name),
  checkTechnicianUsage: (id: number) => ipcRenderer.invoke('settings:technicians:checkUsage', id),
  deleteTechnician: (id: number) => ipcRenderer.invoke('settings:technicians:delete', id),

  // Theme (persisted in the Setting table by the main process)
  getTheme: () => ipcRenderer.invoke('theme:get'),
  setTheme: (preference: string) => ipcRenderer.invoke('theme:set', preference),

  // Backup & Restore
  getDatabaseInfo: () => ipcRenderer.invoke('backup:getInfo'),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import'),

  // Printer
  getPrinters: () => ipcRenderer.invoke('printer:getPrinters'),
  printLabel: (labelData: import('../shared/types').PrintLabelData & { svgContent?: string }) =>
    ipcRenderer.invoke('printer:printLabel', labelData),

  // Reports
  getFinancialReport: (filter?: ReportFilterDTO) => ipcRenderer.invoke('reports:getFinancialReport', filter)
}

// Use `contextBridge` to expose the API to the renderer process
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose context bridge:', error)
  }
} else {
  // @ts-ignore (define in window)
  window.api = api
}

