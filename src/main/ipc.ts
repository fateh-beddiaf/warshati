import { ipcMain } from 'electron'
import { dbService } from '../database'
import type { CreateTicketDTO, ReportFilterDTO } from '../database/types'

export function registerIpcHandlers(): void {
  // Tickets
  ipcMain.handle('tickets:create', async (_event, dto: CreateTicketDTO) => {
    try {
      const result = dbService.createTicket(dto)
      return { success: true, data: result }
    } catch (error: unknown) {
      console.error('Failed to create ticket:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown database error'
      }
    }
  })

  ipcMain.handle('tickets:updateStatus', async (_event, dto: import('../database/types').UpdateTicketStatusDTO) => {
    try {
      const result = dbService.updateTicketStatus(dto)
      return { success: true, data: result }
    } catch (error: unknown) {
      console.error('Failed to update ticket status:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update ticket status'
      }
    }
  })

  ipcMain.handle('tickets:list', async (_event, searchQuery?: string, statusFilter?: string) => {
    try {
      const tickets = dbService.getTicketsList(searchQuery, statusFilter)
      return { success: true, data: tickets }
    } catch (error: unknown) {
      console.error('Failed to list tickets:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve tickets'
      }
    }
  })

  ipcMain.handle('tickets:delete', async (_event, ticketId: number) => {
    try {
      const result = dbService.deleteTicket(ticketId)
      return { success: true, customerDeleted: result.customerDeleted }
    } catch (error: unknown) {
      console.error('Failed to delete ticket:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'فشل حذف التذكرة'
      }
    }
  })


  // Customers
  ipcMain.handle('customers:search', async (_event, query: string) => {
    try {
      const customers = dbService.searchCustomers(query)
      return { success: true, data: customers }
    } catch (error: unknown) {
      console.error('Failed to search customers:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search customers'
      }
    }
  })

  ipcMain.handle('customers:getById', async (_event, id: number) => {
    try {
      const customer = dbService.getCustomerById(id)
      return { success: true, data: customer }
    } catch (error: unknown) {
      console.error('Failed to get customer:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get customer'
      }
    }
  })

  // Metadata
  ipcMain.handle('metadata:get', async () => {
    try {
      const metadata = dbService.getAppMetadata()
      return { success: true, data: metadata }
    } catch (error: unknown) {
      console.error('Failed to get metadata:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get metadata'
      }
    }
  })

  ipcMain.handle('tickets:getById', async (_event, id: number) => {
    try {
      const ticket = dbService.getTicketById(id)
      return { success: true, data: ticket }
    } catch (error: unknown) {
      console.error('Failed to get ticket by id:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve ticket'
      }
    }
  })

  ipcMain.handle('tickets:getByBarcode', async (_event, barcode: string) => {
    try {
      const ticket = dbService.getTicketByBarcode(barcode)
      return { success: true, data: ticket }
    } catch (error: unknown) {
      console.error('Failed to get ticket by barcode:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve ticket'
      }
    }
  })

  // Printer
  ipcMain.handle('printer:getPrinters', async (event) => {
    try {
      const printers = await event.sender.getPrintersAsync()
      return { success: true, data: printers }
    } catch (error: unknown) {
      console.error('Failed to get printers:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve printers list'
      }
    }
  })

  ipcMain.handle('printer:printLabel', async (_event, labelData) => {
    try {
      const { printTicketLabel } = await import('./printer')
      const result = await printTicketLabel(labelData)
      return result
    } catch (error: unknown) {
      console.error('Failed to print label:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to print label'
      }
    }
  })

  // Settings
  ipcMain.handle('settings:get', async (_event, key: string, defaultValue?: string) => {
    try {
      const val = dbService.getSetting(key, defaultValue)
      return { success: true, data: val }
    } catch (error: unknown) {
      console.error('Failed to get setting:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get setting'
      }
    }
  })

  ipcMain.handle('settings:set', async (_event, key: string, value: string) => {
    try {
      dbService.setSetting(key, value)
      return { success: true }
    } catch (error: unknown) {
      console.error('Failed to set setting:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to set setting'
      }
    }
  })

  ipcMain.handle('settings:getOverdueDays', async () => {
    try {
      const days = dbService.getOverdueThresholdDays()
      return { success: true, data: days }
    } catch (error: unknown) {
      console.error('Failed to get overdue days:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get overdue days'
      }
    }
  })

  // Settings & Reference CRUD: Brands
  ipcMain.handle('settings:brands:get', async () => {
    try {
      const data = dbService.getBrands()
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get brands' }
    }
  })

  ipcMain.handle('settings:brands:add', async (_event, name: string) => {
    try {
      const data = dbService.addBrand(name)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add brand' }
    }
  })

  ipcMain.handle('settings:brands:update', async (_event, id: number, name: string) => {
    try {
      dbService.updateBrand(id, name)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update brand' }
    }
  })

  ipcMain.handle('settings:brands:checkUsage', async (_event, id: number) => {
    try {
      const data = dbService.checkBrandUsage(id)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to check brand usage' }
    }
  })

  ipcMain.handle('settings:brands:delete', async (_event, id: number) => {
    try {
      dbService.deleteBrand(id)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete brand' }
    }
  })

  // Settings & Reference CRUD: Models
  ipcMain.handle('settings:models:getByBrand', async (_event, brandId: number) => {
    try {
      const data = dbService.getModelsByBrand(brandId)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get models' }
    }
  })

  ipcMain.handle('settings:models:getAll', async () => {
    try {
      const data = dbService.getAllModels()
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get all models' }
    }
  })

  ipcMain.handle('settings:models:add', async (_event, brandId: number, name: string) => {
    try {
      const data = dbService.addModel(brandId, name)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add model' }
    }
  })

  ipcMain.handle('settings:models:update', async (_event, id: number, name: string, brandId?: number) => {
    try {
      dbService.updateModel(id, name, brandId)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update model' }
    }
  })

  ipcMain.handle('settings:models:checkUsage', async (_event, id: number) => {
    try {
      const data = dbService.checkModelUsage(id)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to check model usage' }
    }
  })

  ipcMain.handle('settings:models:delete', async (_event, id: number) => {
    try {
      dbService.deleteModel(id)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete model' }
    }
  })

  // Settings & Reference CRUD: Accessories
  ipcMain.handle('settings:accessories:get', async () => {
    try {
      const data = dbService.getAccessories()
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get accessories' }
    }
  })

  ipcMain.handle('settings:accessories:add', async (_event, name: string) => {
    try {
      const data = dbService.addAccessory(name)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add accessory' }
    }
  })

  ipcMain.handle('settings:accessories:update', async (_event, id: number, name: string) => {
    try {
      dbService.updateAccessory(id, name)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update accessory' }
    }
  })

  ipcMain.handle('settings:accessories:checkUsage', async (_event, id: number) => {
    try {
      const data = dbService.checkAccessoryUsage(id)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to check accessory usage' }
    }
  })

  ipcMain.handle('settings:accessories:delete', async (_event, id: number) => {
    try {
      dbService.deleteAccessory(id)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete accessory' }
    }
  })

  // Settings & Reference CRUD: Repair Categories
  ipcMain.handle('settings:categories:get', async () => {
    try {
      const data = dbService.getRepairCategories()
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get repair categories' }
    }
  })

  ipcMain.handle('settings:categories:add', async (_event, name: string, defaultSplitPercentage: number) => {
    try {
      const data = dbService.addRepairCategory(name, defaultSplitPercentage)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add repair category' }
    }
  })

  ipcMain.handle('settings:categories:update', async (_event, id: number, name: string, defaultSplitPercentage: number) => {
    try {
      dbService.updateRepairCategory(id, name, defaultSplitPercentage)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update repair category' }
    }
  })

  ipcMain.handle('settings:categories:checkUsage', async (_event, id: number) => {
    try {
      const data = dbService.checkRepairCategoryUsage(id)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to check category usage' }
    }
  })

  ipcMain.handle('settings:categories:delete', async (_event, id: number) => {
    try {
      dbService.deleteRepairCategory(id)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete repair category' }
    }
  })

  // Settings & Reference CRUD: Technicians
  ipcMain.handle('settings:technicians:get', async () => {
    try {
      const data = dbService.getTechnicians()
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get technicians' }
    }
  })

  ipcMain.handle('settings:technicians:add', async (_event, name: string) => {
    try {
      const data = dbService.addTechnician(name)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add technician' }
    }
  })

  ipcMain.handle('settings:technicians:update', async (_event, id: number, name: string) => {
    try {
      dbService.updateTechnician(id, name)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update technician' }
    }
  })

  ipcMain.handle('settings:technicians:checkUsage', async (_event, id: number) => {
    try {
      const data = dbService.checkTechnicianUsage(id)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to check technician usage' }
    }
  })

  ipcMain.handle('settings:technicians:delete', async (_event, id: number) => {
    try {
      dbService.deleteTechnician(id)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete technician' }
    }
  })

  // Backup & Restore
  ipcMain.handle('backup:getInfo', async () => {
    try {
      const { getDatabaseInfo } = await import('./backup')
      const info = getDatabaseInfo()
      return { success: true, data: info }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get database info' }
    }
  })

  ipcMain.handle('backup:export', async (event) => {
    try {
      const { exportDatabaseBackup } = await import('./backup')
      const { BrowserWindow } = await import('electron')
      const win = BrowserWindow.fromWebContents(event.sender)
      const res = await exportDatabaseBackup(win)
      return res
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to export backup' }
    }
  })

  ipcMain.handle('backup:import', async (event) => {
    try {
      const { importDatabaseBackup } = await import('./backup')
      const { BrowserWindow } = await import('electron')
      const win = BrowserWindow.fromWebContents(event.sender)
      const res = await importDatabaseBackup(win)
      return res
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to import backup' }
    }
  })

  // Reports
  ipcMain.handle('reports:getFinancialReport', async (_event, filter?: ReportFilterDTO) => {
    try {
      const report = dbService.getFinancialReport(filter)
      return { success: true, data: report }
    } catch (error: unknown) {
      console.error('Failed to get financial report:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'فشل إنشاء التقرير المالي'
      }
    }
  })
}


