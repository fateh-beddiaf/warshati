import { ipcMain } from 'electron'
import { dbService } from '../database'
import {
  assertCreateTicketDTO,
  assertId,
  assertNumber,
  assertOptionalBoolean,
  assertOptionalId,
  assertNullableNumber,
  assertOptionalString,
  assertPrintLabelData,
  assertReportFilterDTO,
  assertString,
  assertUpdateTicketStatusDTO
} from './ipc-validate'
import { listPrinters } from './printers'
import { LABEL_PRINTER_SETTING_KEY } from '../shared/types'
import { BACKUP_SETTING_PREFIX } from '../shared/auto-backup'

export function registerIpcHandlers(): void {
  // Tickets
  ipcMain.handle('tickets:create', async (_event, dto: unknown) => {
    try {
      assertCreateTicketDTO(dto)
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

  ipcMain.handle('tickets:recordPayment', async (_event, ticketId: unknown, amount: unknown) => {
    try {
      assertId(ticketId, 'ticketId')
      assertNumber(amount, 'amount')
      return { success: true, data: dbService.recordPayment(ticketId, amount) }
    } catch (error: unknown) {
      console.error('Failed to record payment:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to record payment' }
    }
  })

  ipcMain.handle('tickets:setPartsCost', async (_event, ticketId: unknown, cost: unknown) => {
    try {
      assertId(ticketId, 'ticketId')
      assertNullableNumber(cost, 'cost')
      return { success: true, data: dbService.setPartsCost(ticketId, cost) }
    } catch (error: unknown) {
      console.error('Failed to set parts cost:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to set parts cost' }
    }
  })

  ipcMain.handle('tickets:updateStatus', async (_event, dto: unknown) => {
    try {
      assertUpdateTicketStatusDTO(dto)
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

  ipcMain.handle('tickets:list', async (_event, searchQuery: unknown, statusFilter: unknown) => {
    try {
      assertOptionalString(searchQuery, 'searchQuery')
      assertOptionalString(statusFilter, 'statusFilter')
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

  ipcMain.handle('tickets:delete', async (_event, ticketId: unknown) => {
    try {
      assertId(ticketId, 'ticketId')
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
  ipcMain.handle('customers:search', async (_event, query: unknown) => {
    try {
      assertString(query, 'query')
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

  ipcMain.handle('customers:getById', async (_event, id: unknown) => {
    try {
      assertId(id, 'id')
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

  ipcMain.handle('tickets:getById', async (_event, id: unknown) => {
    try {
      assertId(id, 'id')
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

  ipcMain.handle('tickets:getByBarcode', async (_event, barcode: unknown) => {
    try {
      assertString(barcode, 'barcode')
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
      const labelPrinter = dbService.getSetting(LABEL_PRINTER_SETTING_KEY, '')
      return { success: true, data: await listPrinters(event.sender, labelPrinter) }
    } catch (error: unknown) {
      console.error('Failed to get printers:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve printers list'
      }
    }
  })

  ipcMain.handle('printer:printLabel', async (_event, labelData: unknown) => {
    try {
      assertPrintLabelData(labelData)
      const { printTicketLabel } = await import('./printer')
      const result = await printTicketLabel(labelData)
      // Remember the printer a label actually printed on: the next print dialog preselects it (the OS default is
      // often the receipt printer, not the label printer)
      if (result.success && labelData.printerName) {
        dbService.setSetting(LABEL_PRINTER_SETTING_KEY, labelData.printerName)
      }
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
  ipcMain.handle('settings:get', async (_event, key: unknown, defaultValue: unknown) => {
    try {
      assertString(key, 'key')
      assertOptionalString(defaultValue, 'defaultValue')
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

  ipcMain.handle('settings:set', async (_event, key: unknown, value: unknown) => {
    try {
      assertString(key, 'key')
      assertString(value, 'value')
      // The backup folder and status are only written by the main process (auto-backup.ts), never by the renderer
      if (key.startsWith(BACKUP_SETTING_PREFIX)) throw new Error(`Invalid input: ${key} is managed by the app`)
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

  ipcMain.handle('settings:brands:add', async (_event, name: unknown) => {
    try {
      assertString(name, 'name')
      const data = dbService.addBrand(name)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add brand' }
    }
  })

  ipcMain.handle('settings:brands:update', async (_event, id: unknown, name: unknown) => {
    try {
      assertId(id, 'id')
      assertString(name, 'name')
      dbService.updateBrand(id, name)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update brand' }
    }
  })

  ipcMain.handle('settings:brands:checkUsage', async (_event, id: unknown) => {
    try {
      assertId(id, 'id')
      const data = dbService.checkBrandUsage(id)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to check brand usage' }
    }
  })

  ipcMain.handle('settings:brands:delete', async (_event, id: unknown) => {
    try {
      assertId(id, 'id')
      dbService.deleteBrand(id)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete brand' }
    }
  })

  // Settings & Reference CRUD: Models
  ipcMain.handle('settings:models:getByBrand', async (_event, brandId: unknown) => {
    try {
      assertId(brandId, 'brandId')
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

  ipcMain.handle('settings:models:add', async (_event, brandId: unknown, name: unknown) => {
    try {
      assertId(brandId, 'brandId')
      assertString(name, 'name')
      const data = dbService.addModel(brandId, name)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add model' }
    }
  })

  ipcMain.handle('settings:models:update', async (_event, id: unknown, name: unknown, brandId: unknown) => {
    try {
      assertId(id, 'id')
      assertString(name, 'name')
      assertOptionalId(brandId, 'brandId')
      dbService.updateModel(id, name, brandId)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update model' }
    }
  })

  ipcMain.handle('settings:models:checkUsage', async (_event, id: unknown) => {
    try {
      assertId(id, 'id')
      const data = dbService.checkModelUsage(id)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to check model usage' }
    }
  })

  ipcMain.handle('settings:models:delete', async (_event, id: unknown) => {
    try {
      assertId(id, 'id')
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

  ipcMain.handle('settings:accessories:add', async (_event, name: unknown) => {
    try {
      assertString(name, 'name')
      const data = dbService.addAccessory(name)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add accessory' }
    }
  })

  ipcMain.handle('settings:accessories:update', async (_event, id: unknown, name: unknown) => {
    try {
      assertId(id, 'id')
      assertString(name, 'name')
      dbService.updateAccessory(id, name)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update accessory' }
    }
  })

  ipcMain.handle('settings:accessories:checkUsage', async (_event, id: unknown) => {
    try {
      assertId(id, 'id')
      const data = dbService.checkAccessoryUsage(id)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to check accessory usage' }
    }
  })

  ipcMain.handle('settings:accessories:delete', async (_event, id: unknown) => {
    try {
      assertId(id, 'id')
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

  ipcMain.handle(
    'settings:categories:add',
    async (_event, name: unknown, defaultSplitPercentage: unknown, requiresPartsCost: unknown) => {
      try {
        assertString(name, 'name')
        assertNumber(defaultSplitPercentage, 'defaultSplitPercentage')
        assertOptionalBoolean(requiresPartsCost, 'requiresPartsCost')
        const data = dbService.addRepairCategory(name, defaultSplitPercentage, requiresPartsCost)
        return { success: true, data }
      } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to add repair category' }
      }
    }
  )

  ipcMain.handle(
    'settings:categories:update',
    async (_event, id: unknown, name: unknown, defaultSplitPercentage: unknown, requiresPartsCost: unknown) => {
      try {
        assertId(id, 'id')
        assertString(name, 'name')
        assertNumber(defaultSplitPercentage, 'defaultSplitPercentage')
        assertOptionalBoolean(requiresPartsCost, 'requiresPartsCost')
        dbService.updateRepairCategory(id, name, defaultSplitPercentage, requiresPartsCost)
        return { success: true }
      } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to update repair category' }
      }
    }
  )

  ipcMain.handle('settings:categories:checkUsage', async (_event, id: unknown) => {
    try {
      assertId(id, 'id')
      const data = dbService.checkRepairCategoryUsage(id)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to check category usage' }
    }
  })

  ipcMain.handle('settings:categories:delete', async (_event, id: unknown) => {
    try {
      assertId(id, 'id')
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

  ipcMain.handle('settings:technicians:add', async (_event, name: unknown) => {
    try {
      assertString(name, 'name')
      const data = dbService.addTechnician(name)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add technician' }
    }
  })

  ipcMain.handle('settings:technicians:update', async (_event, id: unknown, name: unknown) => {
    try {
      assertId(id, 'id')
      assertString(name, 'name')
      dbService.updateTechnician(id, name)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update technician' }
    }
  })

  ipcMain.handle('settings:technicians:checkUsage', async (_event, id: unknown) => {
    try {
      assertId(id, 'id')
      const data = dbService.checkTechnicianUsage(id)
      return { success: true, data }
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to check technician usage' }
    }
  })

  ipcMain.handle('settings:technicians:delete', async (_event, id: unknown) => {
    try {
      assertId(id, 'id')
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
      const { importKeepingBackupSettings } = await import('./auto-backup')
      const { BrowserWindow } = await import('electron')
      const win = BrowserWindow.fromWebContents(event.sender)
      // Opens in the backup folder, and keeps the backup settings across the replaced database
      return await importKeepingBackupSettings(win)
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to import backup' }
    }
  })

  // Reports
  ipcMain.handle('reports:getFinancialReport', async (_event, filter: unknown) => {
    try {
      assertReportFilterDTO(filter)
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
