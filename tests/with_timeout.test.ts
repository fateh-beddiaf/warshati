import { withTimeout } from '../src/shared/with-timeout'

console.log('--- Running withTimeout Tests (print job timeout helper) ---')

let passed = true
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`✅ ${name}`)
  else {
    console.error(`❌ ${name} ${detail}`)
    passed = false
  }
}
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

async function main(): Promise<void> {
  // 1. resolves in time -> value passes through, onTimeout never called
  {
    let called = false
    const v = await withTimeout(sleep(5).then(() => 'ok'), 100, () => {
      called = true
      return 'timeout'
    })
    check('resolves with the promise value when fast enough', v === 'ok')
    await sleep(150)
    check('onTimeout is not called after a timely resolve (timer cleared)', !called)
  }

  // 2. never settles -> onTimeout result is returned and the cleanup hook runs once
  {
    let calls = 0
    const start = Date.now()
    const v = await withTimeout(new Promise<{ success: boolean; error?: string }>(() => {}), 30, () => {
      calls++
      return { success: false, error: 'انتهت مهلة الطباعة' }
    })
    check('timeout result returned', v.success === false && v.error === 'انتهت مهلة الطباعة')
    check('cleanup ran exactly once', calls === 1)
    check('timeout fired reasonably early', Date.now() - start < 500)
  }

  // 3. promise settles late (after the timeout) -> ignored, no throw
  {
    const v = await withTimeout(sleep(60).then(() => 'late'), 10, () => 'timeout')
    check('late settlement does not override the timeout result', v === 'timeout')
    await sleep(80)
  }

  // 4. rejection passes through
  {
    let msg = ''
    try {
      await withTimeout(Promise.reject(new Error('boom')), 100, () => 'timeout')
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e)
    }
    check('rejection is propagated', msg === 'boom')
  }

  // 5. throwing onTimeout rejects instead of hanging
  {
    let msg = ''
    try {
      await withTimeout(new Promise<string>(() => {}), 10, () => {
        throw new Error('cleanup failed')
      })
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e)
    }
    check('throwing onTimeout rejects', msg === 'cleanup failed')
  }

  if (!passed) process.exit(1)
  console.log('\n🎉 ALL WITH-TIMEOUT TESTS PASSED! 🎉')
  process.exit(0)
}

main()
