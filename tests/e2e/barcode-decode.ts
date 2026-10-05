import { readFileSync } from 'fs'
import { resolve } from 'path'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'

// Test-only barcode reader: zxing-cpp compiled to WebAssembly, loaded from node_modules (never from the network).

let ready: Promise<unknown> | null = null

/** Every Code128 text zxing finds in a PNG, read the strict way (no rotation, no inversion, no "try harder"). */
export async function readCode128(png: Uint8Array): Promise<string[]> {
  ready ??= prepareZXingModule({
    overrides: { wasmBinary: readFileSync(resolve('node_modules/zxing-wasm/dist/reader/zxing_reader.wasm')).buffer },
    fireImmediately: true
  })
  await ready
  const results = await readBarcodes(png, {
    formats: ['Code128'],
    tryHarder: false,
    tryRotate: false,
    tryInvert: false,
    tryDownscale: false,
    maxNumberOfSymbols: 4
  })
  return results.filter((r) => r.isValid).map((r) => r.text)
}

export interface BarRuns {
  /** widths (px) of alternating bar / space runs, starting with a bar, from the first to the last bar */
  runs: number[]
  /** white px before the first bar and after the last bar, up to the label edge */
  quietLeft: number
  quietRight: number
}

/**
 * Bar and space widths along one horizontal line of a BGRA bitmap (as NativeImage.toBitmap() returns it),
 * thresholded at 50% grey. `y` should cross the bars.
 */
export function measureBars(bgra: Uint8Array, width: number, y: number, x0 = 0, x1 = width): BarRuns {
  const dark: boolean[] = []
  for (let x = x0; x < x1; x++) {
    const i = (y * width + x) * 4
    const lum = 0.114 * bgra[i] + 0.587 * bgra[i + 1] + 0.299 * bgra[i + 2]
    dark.push(lum < 128)
  }
  const first = dark.indexOf(true)
  const last = dark.lastIndexOf(true)
  if (first < 0) return { runs: [], quietLeft: dark.length, quietRight: 0 }
  const runs: number[] = []
  let run = 1
  for (let x = first + 1; x <= last; x++) {
    if (dark[x] === dark[x - 1]) run++
    else {
      runs.push(run)
      run = 1
    }
  }
  runs.push(run)
  return { runs, quietLeft: first, quietRight: dark.length - 1 - last }
}
