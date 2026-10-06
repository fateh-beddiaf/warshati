import { test, expect } from '@playwright/test'
import { launchApp, shutdownApp, type Launched } from './helpers'

// Overlays (select, popover, tooltip) reopened right after they close. An exit animation keeps closed Radix content
// mounted for a moment; a press (or hover) in that window must open the overlay again and keep it open, not have it
// dismissed by the content that is still on its way out.

test.describe.configure({ mode: 'serial' })

let l: Launched

test.beforeAll(async () => {
  l = await launchApp('overlay-reopen')
})
test.afterAll(async () => {
  await shutdownApp(l)
})
test.afterEach(() => {
  expect(l.problems, 'renderer errors').toEqual([])
})

/** Switches screen and waits until it is the only one shown and its enter animation has finished. */
async function go(tab: 'tickets' | 'new-ticket'): Promise<void> {
  await l.page.getByTestId(`nav-${tab}`).click()
  const screen = l.page.getByTestId(`screen-${tab}`)
  await expect(screen).toBeVisible()
  await expect(l.page.locator('[data-testid^="screen-"]')).toHaveCount(1)
  await expect(screen).toHaveCSS('opacity', '1')
}

test('a select reopens right after a choice and stays open', async () => {
  await go('new-ticket')
  const trigger = l.page.getByTestId('repair-category')
  await expect(trigger).toHaveAttribute('data-state', 'closed')

  const states = await l.page.evaluate(async () => {
    const trigger = document.querySelector<HTMLElement>('[data-testid="repair-category"]')!
    const press = (): void => {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }))
    }
    const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))
    press()
    await frame()
    const options = document.querySelectorAll<HTMLElement>('[role="option"]')
    const picked = options[1].textContent ?? ''
    options[1].click()
    await frame()
    const afterChoice = trigger.dataset.state
    press()
    // Watch for longer than any open/close animation: the list must stay open the whole time
    const seen: string[] = []
    const watch = new MutationObserver(() => seen.push(trigger.dataset.state ?? ''))
    watch.observe(trigger, { attributes: true, attributeFilter: ['data-state'] })
    await new Promise((r) => setTimeout(r, 500))
    watch.disconnect()
    return {
      afterChoice,
      closedAgain: seen.includes('closed'),
      now: trigger.dataset.state,
      listboxes: document.querySelectorAll('[role="listbox"]').length,
      chosen: (trigger.textContent ?? '').includes(picked)
    }
  })
  expect(states).toEqual({ afterChoice: 'closed', closedAgain: false, now: 'open', listboxes: 1, chosen: true })

  await l.page.keyboard.press('Escape')
  await expect(trigger).toHaveAttribute('data-state', 'closed')
  await expect(l.page.getByRole('listbox')).toHaveCount(0)
})

test('the autocomplete list reopens right after a choice and stays open', async () => {
  await go('tickets')
  await go('new-ticket')

  const states = await l.page.evaluate(async () => {
    // order: customer name, phone, notes, brand, model, short label
    const brand = document.querySelectorAll<HTMLInputElement>('[data-testid="new-ticket-form"] input[type="text"]')[3]
    const frame = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))
    const press = (): void => {
      const init = { bubbles: true, cancelable: true, button: 0 }
      brand.dispatchEvent(new PointerEvent('pointerdown', { ...init, pointerType: 'mouse' }))
      brand.dispatchEvent(new MouseEvent('mousedown', init))
      brand.dispatchEvent(new PointerEvent('pointerup', { ...init, pointerType: 'mouse' }))
      brand.dispatchEvent(new MouseEvent('mouseup', init))
      brand.click()
    }
    const lists = (): number => document.querySelectorAll('[role="dialog"][data-state="open"] [cmdk-list]').length
    brand.focus()
    press()
    await frame()
    const openedFirst = brand.getAttribute('aria-expanded') === 'true' && lists() === 1
    document.querySelector<HTMLElement>('[cmdk-item]')!.click()
    await frame()
    const afterChoice = brand.getAttribute('aria-expanded')
    press()
    const seen: string[] = []
    const watch = new MutationObserver(() => seen.push(brand.getAttribute('aria-expanded') ?? ''))
    watch.observe(brand, { attributes: true, attributeFilter: ['aria-expanded'] })
    await new Promise((r) => setTimeout(r, 500))
    watch.disconnect()
    return {
      openedFirst,
      afterChoice,
      closedAgain: seen.includes('false'),
      now: brand.getAttribute('aria-expanded'),
      lists: lists(),
      value: brand.value !== ''
    }
  })
  expect(states).toEqual({
    openedFirst: true,
    afterChoice: 'false',
    closedAgain: false,
    now: 'true',
    lists: 1,
    value: true
  })

  await l.page.keyboard.press('Escape')
  await expect(l.page.locator('[cmdk-list]')).toHaveCount(0)
})

test('a tooltip shown again right after it hid stays shown', async () => {
  // A ticket whose category requires a parts cost, without one: its row carries the icon with the tooltip
  await l.page.evaluate(async () => {
    const category = await window.api.addRepairCategory('Tooltip check', 50, true)
    if (!category.success || !category.data) throw new Error(category.error ?? 'category not created')
    const created = await window.api.createTicket({
      customer: { name: 'Tooltip Customer', phone: '0550000001' },
      device: { brand: 'Test', model: 'T1' },
      ticket: {
        repair_category_id: category.data.id,
        price: 2000,
        payment_type: 'cash',
        amount_paid: 2000,
        technician_id: 1
      }
    })
    if (!created.success) throw new Error(created.error ?? 'ticket not created')
  })
  await go('new-ticket')
  await go('tickets')
  const icon = l.page.getByTestId('row-missing-cost')
  await expect(icon).toHaveCount(1)
  const box = (await icon.boundingBox())!
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

  await l.page.mouse.move(center.x, center.y)
  await expect(icon).toHaveAttribute('data-state', /open/)
  await expect(l.page.getByRole('tooltip')).toHaveCount(1)

  // Record every state the icon goes through from here on
  await l.page.evaluate(() => {
    const icon = document.querySelector<HTMLElement>('[data-testid="row-missing-cost"]')!
    const seen: string[] = []
    ;(window as unknown as { tooltipStates: string[] }).tooltipStates = seen
    new MutationObserver(() => seen.push(icon.dataset.state ?? '')).observe(icon, {
      attributes: true,
      attributeFilter: ['data-state']
    })
  })
  // Away (the tooltip hides), wait for the hide to render, then straight back while it may still be on screen
  await l.page.mouse.move(box.x - 300, center.y, { steps: 5 })
  await l.page.waitForFunction(
    () => document.querySelector<HTMLElement>('[data-testid="row-missing-cost"]')!.dataset.state === 'closed',
    undefined,
    { polling: 'raf' }
  )
  await l.page.mouse.move(center.x, center.y)
  await l.page.waitForTimeout(500)

  const result = await l.page.evaluate(() => {
    const icon = document.querySelector<HTMLElement>('[data-testid="row-missing-cost"]')!
    return {
      seen: (window as unknown as { tooltipStates: string[] }).tooltipStates,
      now: icon.dataset.state,
      tooltips: document.querySelectorAll('[role="tooltip"]').length
    }
  })
  // closed once (moving away), opened again at once (within the skip delay), never closed again
  expect(result).toEqual({ seen: ['closed', 'instant-open'], now: 'instant-open', tooltips: 1 })

  await l.page.mouse.move(box.x - 300, center.y, { steps: 5 })
  await expect(icon).toHaveAttribute('data-state', 'closed')
})
