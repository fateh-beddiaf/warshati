import JsBarcode from 'jsbarcode'

/**
 * The barcode drawn on the 40x20mm label, built for 203 DPI thermal printers (Xprinter and the like).
 *
 * A thermal head prints whole dots: 203 DPI = 7.99 dots/mm, one dot = 0.1251mm. A Code128 module that is not a
 * whole number of dots is rounded differently from bar to bar (1.5 dots -> some bars 1 dot, others 2), which
 * breaks the width ratios the reader decodes. So:
 *  - every module is exactly MODULE_DOTS dots (3 = 0.3754mm preferred, 2 = 0.2503mm minimum), and the SVG's
 *    user unit IS one printer dot (viewBox in dots, width/height in mm): nothing may scale it afterwards;
 *  - QUIET_ZONE_MODULES white modules on each side are part of the drawing (Code128 needs >= 10: without them the
 *    reader does not find the start pattern);
 *  - shape-rendering="crispEdges": no anti-aliased grey edges.
 *
 * Width budget: Code128 = start (11) + 11 per symbol + check (11) + stop (13) modules, plus 2 x 10 quiet modules.
 * A ticket code is 8 digits = 4 set-C symbols: 11 + 44 + 11 + 13 + 20 = 99 modules x 3 dots = 297 dots = 37.16mm,
 * inside the 37.6mm between the label's 1.2mm side paddings.
 */
export const LABEL_DPI = 203
export const DOT_MM = 25.4 / LABEL_DPI
export const QUIET_ZONE_MODULES = 10
export const LABEL_WIDTH_MM = 40
/** Label width (40mm) minus the 1.2mm side padding of the printed page (printer.ts). */
export const LABEL_BARCODE_MAX_WIDTH_MM = 37.6
/** Bar height: 63 dots = 7.88mm, what the label's middle row has room for. */
export const BAR_HEIGHT_DOTS = 63
const MODULE_DOTS_CHOICES = [3, 2] as const

export interface LabelBarcode {
  /** SVG markup, width/height in mm, viewBox in printer dots */
  svg: string
  /** modules including both quiet zones */
  modules: number
  moduleDots: number
  widthMm: number
  heightMm: number
  /**
   * Where the printed page puts the SVG: centred on the 40mm label, rounded to a whole number of dots from the
   * paper's left edge. Then every bar edge falls exactly on a dot boundary; at half a dot, rounding could make one
   * module a dot wider than the others.
   */
  leftMm: number
}

/** The Code128 module pattern ('1' = bar) of `value`, or null when it cannot be encoded. */
export function encodeCode128(value: string): string | null {
  if (!value) return null
  const out: { encodings?: Array<{ data: string }> } = {}
  let valid = true
  try {
    JsBarcode(out, value, {
      // all-digit, even length: set C (2 digits per symbol); anything else: let JsBarcode pick the sets
      format: /^(\d\d)+$/.test(value) ? 'CODE128C' : 'CODE128',
      valid: (ok: boolean) => {
        if (!ok) valid = false
      }
    })
  } catch {
    return null
  }
  const bits = out.encodings?.map((e) => e.data).join('') ?? ''
  return valid && /^[01]+$/.test(bits) ? bits : null
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const round = (n: number): number => Math.round(n * 10000) / 10000

/**
 * The label barcode for `value`. Uses 3-dot modules when the code fits the label with its quiet zones, else 2-dot
 * modules; throws when it fits neither or cannot be encoded. `scale` only enlarges the on-screen zoomed preview.
 */
export function buildLabelBarcode(value: string, scale = 1): LabelBarcode {
  const bits = encodeCode128(value)
  if (!bits) throw new Error('invalid barcode')
  const modules = bits.length + 2 * QUIET_ZONE_MODULES
  const moduleDots = MODULE_DOTS_CHOICES.find((dots) => modules * dots * DOT_MM <= LABEL_BARCODE_MAX_WIDTH_MM)
  if (!moduleDots) throw new Error('barcode too long for the label')

  const widthDots = modules * moduleDots
  const bars: string[] = []
  for (let i = 0; i < bits.length;) {
    if (bits[i] !== '1') {
      i++
      continue
    }
    let end = i
    while (bits[end] === '1') end++
    const x = (QUIET_ZONE_MODULES + i) * moduleDots
    bars.push(`<rect x="${x}" y="0" width="${(end - i) * moduleDots}" height="${BAR_HEIGHT_DOTS}"/>`)
    i = end
  }

  const widthMm = round(widthDots * DOT_MM * scale)
  const heightMm = round(BAR_HEIGHT_DOTS * DOT_MM * scale)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" ` +
    `viewBox="0 0 ${widthDots} ${BAR_HEIGHT_DOTS}" shape-rendering="crispEdges" ` +
    `data-barcode="${escapeAttr(value)}" data-module-dots="${moduleDots}" data-modules="${modules}">` +
    `<rect x="0" y="0" width="${widthDots}" height="${BAR_HEIGHT_DOTS}" fill="#ffffff"/>` +
    `<g fill="#000000">${bars.join('')}</g></svg>`
  const leftDots = Math.floor((LABEL_WIDTH_MM / DOT_MM - widthDots) / 2)
  return { svg, modules, moduleDots, widthMm, heightMm, leftMm: round(leftDots * DOT_MM) }
}
