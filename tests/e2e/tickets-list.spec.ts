import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

// Tickets list screen: debounced search, one-shot overdue-threshold fetch, and a threshold
// input that is never clobbered by a refetch. Runs on the built app with a temp data dir.

test.describe.configure({ mode: 'serial' })

let app: ElectronApplication
let page: Page
let dataDir: string
const problems: string[] = []

const CUSTOMERS = [
  { name: 'Alpha Customer', phone: '0555000001', model: 'Galaxy A54' },
  { name: 'Beta Customer', phone: '0555000002', model: 'Redmi Note 12' },
  { name: 'Gamma Customer', phone: '0555000003', model: 'iPhone 13' }
]

type CallLog = { list: string[]; overdue: number }

/**
 * window.api is a frozen contextBridge object, so calls are counted where they land: the IPC
 * handlers in the main process are wrapped (once) and (re)set to an empty log on every call.
 */
async function resetCounters(): Promise<void> {
  await app.evaluate(({ ipcMain }) => {
    const g = globalThis as unknown as { __calls?: CallLog; __wrapped?: boolean }
    g.__calls = { list: [], overdue: 0 }
    if (g.__wrapped) return
    g.__wrapped = true
    type Handler = (e: unknown, ...a: unknown[]) => unknown
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, Handler> })._invokeHandlers
    const wrap = (channel: string, onCall: (args: unknown[]) => void): void => {
      const orig = handlers.get(channel)
      if (!orig) throw new Error(`no IPC handler for ${channel}`)
      handlers.set(channel, (e, ...args) => {
        onCall(args)
        return orig(e, ...args)
      })
    }
    wrap('tickets:list', (args) => g.__calls!.list.push(String(args[0] ?? '')))
    wrap('settings:getOverdueDays', () => g.__calls!.overdue++)
  })
}

async function calls(): Promise<CallLog> {
  return app.evaluate(() => (globalThis as unknown as { __calls: CallLog }).__calls)
}

async function openList(): Promise<void> {
  // Leave the tickets tab and come back so the screen mounts fresh (counters reset first).
  await page.getByTestId('nav-settings').click()
  // wait for the list screen to really unmount (exit animation) so the next visit remounts it
  await page.getByTestId('settings-tab-categories').waitFor()
  await resetCounters()
  await page.getByTestId('nav-tickets').click()
  await page.locator('tbody tr').first().waitFor()
}

test.beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), 'warshati-e2e-list-'))
  app = await electron.launch({
    args: [resolve('out/main/index.js')],
    env: { ...process.env, WARSHATI_DATA_DIR: dataDir }
  })
  page = await app.firstWindow()
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
  })
  await page.waitForSelector('[data-testid="nav-tickets"]')

  for (const c of CUSTOMERS) {
    const res = await page.evaluate(
      (c) =>
        (
          window as unknown as {
            api: { createTicket: (dto: unknown) => Promise<{ success: boolean }> }
          }
        ).api.createTicket({
          customer: { name: c.name, phone: c.phone },
          device: { brand: 'Test', model: c.model },
          ticket: {
            repair_category_id: 1,
            price: 3000,
            payment_type: 'cash',
            amount_paid: 3000,
            technician_id: 1
          }
        }),
      c
    )
    expect(res.success).toBe(true)
  }
})

test.afterAll(async () => {
  await app?.close()
  try {
    rmSync(dataDir, { recursive: true, force: true })
  } catch {
    // disposable
  }
})

test('fast typing is debounced into a single list query and shows the right rows', async () => {
  await openList()
  await expect(page.locator('tbody tr')).toHaveCount(3)

  const before = await calls()
  const search = page.getByTestId('tickets-search')
  // 14 keystrokes, no pause between them: must not produce 14 queries.
  await search.pressSequentially('Beta Customer', { delay: 0 })
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody tr').first()).toContainText('Beta Customer')

  const after = await calls()
  const listCalls = after.list.length - before.list.length
  expect(listCalls, `list calls while typing: ${after.list.slice(before.list.length)}`).toBeLessThanOrEqual(2)
  // the last query is the full text, i.e. the final state is what was fetched
  expect(after.list[after.list.length - 1]).toBe('Beta Customer')

  // clearing the box goes back to the full list
  await search.fill('')
  await expect(page.locator('tbody tr')).toHaveCount(3)
  expect(problems).toEqual([])
})

test('overdue threshold is fetched once and not refetched on search / filter changes', async () => {
  await openList()
  const search = page.getByTestId('tickets-search')
  await search.pressSequentially('Alpha', { delay: 20 })
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.getByTestId('filter-in_progress').click()
  await page.getByTestId('filter-all').click()
  await search.fill('')
  await expect(page.locator('tbody tr')).toHaveCount(3)
  const c = await calls()
  expect(c.overdue, 'getOverdueDays calls').toBe(1)
})

test('typing in the threshold input is not clobbered by a refetch, and saving works', async () => {
  await openList()
  await page.getByTitle('تعديل عتبة أيام التنبيه').click()
  const input = page.locator('input[type="number"][min="1"][max="30"]')
  await input.fill('7')

  // Refresh button refetches the list while the panel is open and the user is mid-edit.
  await page.getByTitle('تحديث القائمة').click()
  // Also run a search/filter change in the meantime.
  await page.getByTestId('tickets-search').fill('Gamma')
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await page.getByTestId('filter-all').click()
  await page.waitForTimeout(500)
  await expect(input).toHaveValue('7')

  // Saving persists and the button label reflects the new threshold
  await page.getByRole('button', { name: 'حفظ' }).click()
  await expect(page.getByText('تنبيه التأخر: 7 أيام')).toBeVisible()
  const saved = await page.evaluate(
    () =>
      (
        window as unknown as { api: { getOverdueDays: () => Promise<{ data: number }> } }
      ).api.getOverdueDays()
  )
  expect(saved.data).toBe(7)

  // Re-opening shows the saved value; an abandoned edit is discarded on close.
  await page.getByTitle('تعديل عتبة أيام التنبيه').click()
  await expect(input).toHaveValue('7')
  await input.fill('12')
  await page.getByTitle('تعديل عتبة أيام التنبيه').click()
  await page.getByTitle('تعديل عتبة أيام التنبيه').click()
  await expect(input).toHaveValue('7')
  expect(problems).toEqual([])
})
