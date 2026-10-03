# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> new ticket form survives regex metacharacters in brand/model
- Location: tests\e2e\smoke.spec.ts:186:5

# Error details

```
Error: #root is empty after: brand "C++" (white screen)

expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

# Test source

```ts
  1   | import { test, expect, _electron as electron } from '@playwright/test'
  2   | import type { ElectronApplication, Page } from '@playwright/test'
  3   | import { mkdtempSync, rmSync } from 'fs'
  4   | import { tmpdir } from 'os'
  5   | import { join, resolve } from 'path'
  6   | 
  7   | // Smoke test for the renderer: walks through every screen and fails on any
  8   | // page error, console.error or an empty #root (the "white screen" symptom).
  9   | // Runs on the built app (out/main/index.js) with a throw-away data directory,
  10  | // so it can never touch real shop data.
  11  | 
  12  | test.describe.configure({ mode: 'serial' })
  13  | 
  14  | let app: ElectronApplication
  15  | let page: Page
  16  | let dataDir: string
  17  | const problems: string[] = []
  18  | 
  19  | const SETTINGS_TABS = [
  20  |   'categories',
  21  |   'brandsModels',
  22  |   'accessories',
  23  |   'technicians',
  24  |   'backup',
  25  |   'preferences'
  26  | ]
  27  | 
  28  | async function assertAlive(label: string): Promise<void> {
  29  |   // Give React a moment to commit the next render, then check the tree is alive.
  30  |   await page.waitForTimeout(250)
  31  |   const rootChildren = await page.evaluate(
  32  |     () => document.getElementById('root')?.childElementCount ?? 0
  33  |   )
> 34  |   expect(rootChildren, `#root is empty after: ${label} (white screen)`).toBeGreaterThan(0)
      |                                                                         ^ Error: #root is empty after: brand "C++" (white screen)
  35  |   expect(problems, `renderer errors after: ${label}`).toEqual([])
  36  | }
  37  | 
  38  | async function go(tab: 'tickets' | 'new-ticket' | 'reports' | 'settings'): Promise<void> {
  39  |   await page.getByTestId(`nav-${tab}`).click()
  40  |   await assertAlive(`nav ${tab}`)
  41  | }
  42  | 
  43  | test.beforeAll(async () => {
  44  |   dataDir = mkdtempSync(join(tmpdir(), 'warshati-e2e-'))
  45  |   app = await electron.launch({
  46  |     args: [resolve('out/main/index.js')],
  47  |     env: { ...process.env, WARSHATI_DATA_DIR: dataDir }
  48  |   })
  49  |   page = await app.firstWindow()
  50  |   page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`))
  51  |   page.on('console', (msg) => {
  52  |     if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`)
  53  |   })
  54  |   await page.waitForSelector('[data-testid="nav-tickets"]')
  55  |   await assertAlive('boot')
  56  | })
  57  | 
  58  | test.afterAll(async () => {
  59  |   await app?.close()
  60  |   try {
  61  |     rmSync(dataDir, { recursive: true, force: true })
  62  |   } catch {
  63  |     // WAL files may still be released a moment later; the temp dir is disposable
  64  |   }
  65  | })
  66  | 
  67  | test('every sidebar tab renders', async () => {
  68  |   for (const tab of ['tickets', 'new-ticket', 'reports', 'settings', 'tickets'] as const) {
  69  |     await go(tab)
  70  |   }
  71  | })
  72  | 
  73  | test('every settings sub-tab renders', async () => {
  74  |   await go('settings')
  75  |   for (const id of SETTINGS_TABS) {
  76  |     await page.getByTestId(`settings-tab-${id}`).click()
  77  |     await assertAlive(`settings tab ${id}`)
  78  |   }
  79  | })
  80  | 
  81  | test('create tickets (cash + credit) and open details', async () => {
  82  |   for (const kind of ['cash', 'credit'] as const) {
  83  |     await go('new-ticket')
  84  |     const textInputs = page.locator('[data-testid="new-ticket-form"] input[type="text"]')
  85  |     // order: customer name (autocomplete), phone, notes, brand, model, short label
  86  |     await textInputs.nth(0).fill(kind === 'cash' ? 'زبون اختبار' : 'Test Customer')
  87  |     await textInputs.nth(1).fill(kind === 'cash' ? '0555123456' : '0666000111')
  88  |     await textInputs.nth(3).fill('Samsung')
  89  |     await textInputs.nth(4).fill('Galaxy A54')
  90  |     await page.locator('[data-testid="new-ticket-form"] input[type="number"]').nth(0).fill('5000')
  91  |     await page.locator('[data-testid="new-ticket-form"] input[type="number"]').nth(1).fill(kind === 'cash' ? '5000' : '2000')
  92  |     await page.locator(`[data-testid="new-ticket-form"] input[name="paymentType"][value="${kind}"]`).check()
  93  |     await page.locator('[data-testid="new-ticket-form"] button[type="submit"]').click()
  94  |     await page.waitForSelector('.bg-emerald-50')
  95  |     await assertAlive(`create ${kind} ticket`)
  96  |   }
  97  |   await go('tickets')
  98  |   await page.locator('tbody tr').first().waitFor()
  99  |   await page.locator('tbody tr').first().click()
  100 |   await page.getByTestId('details-close').waitFor()
  101 |   await assertAlive('open ticket details')
  102 | })
  103 | 
  104 | test('ticket lifecycle in details modal', async () => {
  105 |   // Modal is open on the latest ticket (in_progress)
  106 |   await page.getByTestId('status-to-ready').click()
  107 |   await assertAlive('mark ready')
  108 |   await page.getByTestId('open-delivery').click()
  109 |   await assertAlive('open delivery dialog')
  110 |   await page.getByTestId('confirm-delivery').click()
  111 |   await assertAlive('confirm delivery')
  112 |   await page.getByTestId('status-back-to-ready').click()
  113 |   await assertAlive('revert to ready')
  114 |   await page.getByTestId('status-to-in-progress').click()
  115 |   await assertAlive('revert to in_progress')
  116 |   await page.getByTestId('details-reprint').click()
  117 |   await assertAlive('print preview from details')
  118 |   await page.getByTestId('print-close').click()
  119 |   await assertAlive('close print preview')
  120 |   await page.getByTestId('details-close').click()
  121 |   await assertAlive('close details')
  122 | })
  123 | 
  124 | test('print preview from list and filters', async () => {
  125 |   await go('tickets')
  126 |   for (const f of ['all', 'in_progress', 'ready', 'overdue', 'delivered', 'all']) {
  127 |     await page.getByTestId(`filter-${f}`).click()
  128 |     await assertAlive(`filter ${f}`)
  129 |   }
  130 |   await page.getByTestId('row-print').first().click()
  131 |   await assertAlive('print preview from list')
  132 |   await page.getByTestId('print-close').click()
  133 |   await assertAlive('close print preview from list')
  134 | })
```