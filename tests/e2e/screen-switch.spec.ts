import { test, expect } from '@playwright/test'
import { launchApp, shutdownApp, type Launched } from './helpers'

// Rapid tab switching: whatever the click sequence, the screen shown is the active tab's, alone, within a second.
// With real mouse clicks a click could be lost: the sidebar's active "pill" glides to the newly active item over
// the other items and caught the click (it belongs to the previously clicked button), so the old screen stayed up.

const TABS = ['tickets', 'new-ticket', 'reports', 'settings'] as const

let l: Launched

test.beforeAll(async () => {
  l = await launchApp('screen-switch')
})
test.afterAll(async () => {
  await shutdownApp(l)
})
test.afterEach(() => {
  expect(l.problems, 'renderer errors').toEqual([])
})

/** The screens currently in the DOM, and the tab the sidebar marks active. */
async function shown(): Promise<{ screens: string[]; active: string | null }> {
  return l.page.evaluate(() => ({
    screens: [...document.querySelectorAll('[data-testid^="screen-"]')].map((el) =>
      (el.getAttribute('data-testid') ?? '').replace('screen-', '')
    ),
    active:
      document
        .querySelector('[data-testid^="nav-"][aria-current="page"]')
        ?.getAttribute('data-testid')
        ?.replace('nav-', '') ?? null
  }))
}

test('20 rapid clicks: only the active screen is shown within 1 second (5 rounds)', async () => {
  let seed = 7
  const next = (): number => (seed = (seed * 1103515245 + 12345) % 2 ** 31)
  for (let round = 0; round < 5; round++) {
    let last: (typeof TABS)[number] = 'tickets'
    for (let i = 0; i < 20; i++) {
      const candidates = TABS.filter((t) => t !== last)
      last = candidates[next() % candidates.length]
      // dispatched in-page: no waiting for animations between clicks, like a quick user
      await l.page.evaluate(
        (tab) => (document.querySelector(`[data-testid="nav-${tab}"]`) as HTMLElement).click(),
        last
      )
      if (next() % 3 === 0) await l.page.waitForTimeout(next() % 120)
    }
    const started = Date.now()
    await expect.poll(shown, { timeout: 1000, intervals: [50] }).toEqual({ screens: [last], active: last })
    console.log(`round ${round}: settled on ${last} in ${Date.now() - started}ms`)
  }
})

test('20 rapid real mouse clicks: only the active screen is shown within 1 second (5 rounds)', async () => {
  let seed = 11
  const next = (): number => (seed = (seed * 1103515245 + 12345) % 2 ** 31)
  for (let round = 0; round < 5; round++) {
    let last: (typeof TABS)[number] = 'tickets'
    for (let i = 0; i < 20; i++) {
      const candidates = TABS.filter((t) => t !== last)
      last = candidates[next() % candidates.length]
      // a real pointer click (pointerdown/up: the buttons have a tap animation), not waiting for the screen
      const box = await l.page.getByTestId(`nav-${last}`).boundingBox()
      await l.page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2)
    }
    const started = Date.now()
    await expect.poll(shown, { timeout: 1000, intervals: [50] }).toEqual({ screens: [last], active: last })
    console.log(`mouse round ${round}: settled on ${last} in ${Date.now() - started}ms`)
  }
})

test('a new screen starts at the top of the page, not where the previous one was scrolled to', async () => {
  const body = l.page.getByTestId('page-body')
  const go = async (tab: (typeof TABS)[number]): Promise<void> => {
    await l.page.getByTestId(`nav-${tab}`).click()
    await expect.poll(shown).toEqual({ screens: [tab], active: tab })
    await expect(l.page.getByTestId(`screen-${tab}`)).toHaveCSS('opacity', '1')
  }
  /** Scrolls the page body to the bottom of the current screen; returns how far that is. */
  const scrollToBottom = (): Promise<number> =>
    body.evaluate((el) => {
      el.scrollTop = el.scrollHeight
      return el.scrollTop
    })

  // Both screens are taller than the window: the body keeps a non-zero scroll position unless it is reset
  await go('new-ticket')
  expect(await scrollToBottom()).toBeGreaterThan(100)
  await go('reports')
  expect(await body.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(100)
  expect(await body.evaluate((el) => el.scrollTop)).toBe(0)

  expect(await scrollToBottom()).toBeGreaterThan(100)
  await go('new-ticket')
  expect(await body.evaluate((el) => el.scrollTop)).toBe(0)
})

test('a Settings section starts at the top of the page, not where the previous section was scrolled to', async () => {
  const body = l.page.getByTestId('page-body')
  const section = async (id: string): Promise<void> => {
    await l.page.getByTestId(`settings-tab-${id}`).click()
    await expect(l.page.getByTestId(`settings-tab-${id}`)).toHaveAttribute('data-state', 'active')
  }
  /**
   * Scrolls the page body until the section tabs sit at the top of the window, the page title out of view: the
   * tabs stay clickable where they are (a click on something out of view would scroll it back into view first).
   */
  const scrollTabsToTop = (): Promise<number> =>
    body.evaluate((el) => {
      const tabs = el.querySelector('[role="tablist"]')
      if (!tabs) throw new Error('no section tabs')
      el.scrollTop += tabs.getBoundingClientRect().top - el.getBoundingClientRect().top
      return el.scrollTop
    })
  const scrollRoom = (): Promise<number> => body.evaluate((el) => el.scrollHeight - el.clientHeight)

  await l.page.getByTestId('nav-settings').click()
  await expect.poll(shown).toEqual({ screens: ['settings'], active: 'settings' })
  // Both sections are much taller than the window: the body keeps its scroll position unless it is reset
  await section('preferences')
  await expect.poll(scrollRoom).toBeGreaterThan(300)
  expect(await scrollTabsToTop()).toBeGreaterThan(50)
  await section('backup')
  await expect.poll(scrollRoom).toBeGreaterThan(300)
  expect(await body.evaluate((el) => el.scrollTop)).toBe(0)

  expect(await scrollTabsToTop()).toBeGreaterThan(50)
  await section('preferences')
  expect(await body.evaluate((el) => el.scrollTop)).toBe(0)
})
