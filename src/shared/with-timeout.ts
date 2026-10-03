/**
 * Races `promise` against a timer. If `ms` elapses first, `onTimeout()` runs (use it to
 * clean up, e.g. destroy a hidden window) and its return value becomes the result.
 * The timer is always cleared once the promise settles, and a late settlement after a
 * timeout is ignored. Rejections of `promise` are passed through unchanged.
 * Pure: no Electron/DOM dependency, so it can be unit-tested with tiny fake timeouts.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      try {
        resolve(onTimeout())
      } catch (err) {
        reject(err)
      }
    }, ms)

    promise.then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}
