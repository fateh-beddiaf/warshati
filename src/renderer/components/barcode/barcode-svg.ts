import JsBarcode from 'jsbarcode'

export type BarcodeScaleMode = 'actual' | 'zoomed'

/** JsBarcode settings per preview mode. 'actual' is what the 40x20mm label is printed with. */
export function barcodeOptions(mode: BarcodeScaleMode): {
  format: string
  displayValue: boolean
  width: number
  height: number
  margin: number
  background: string
  lineColor: string
} {
  return {
    format: 'CODE128',
    displayValue: false, // custom high-contrast text is rendered below the bars
    width: mode === 'actual' ? 1.05 : 1.6,
    height: mode === 'actual' ? 20 : 34,
    margin: 0,
    background: '#ffffff',
    lineColor: '#000000'
  }
}

/** Draws `barcode` into an existing <svg>; throws if the value cannot be encoded. */
export function drawBarcode(svg: SVGSVGElement, barcode: string, mode: BarcodeScaleMode): void {
  JsBarcode(svg, barcode, {
    ...barcodeOptions(mode),
    valid: (ok: boolean) => {
      if (!ok) throw new Error('invalid barcode')
    }
  })
  svg.setAttribute('data-barcode', barcode)
}

/**
 * Builds the SVG markup sent to the printer. Always uses the 'actual' size settings
 * (independent of the on-screen zoom toggle). Throws if generation fails, and the result
 * always carries a data-barcode attribute so a stale SVG can be detected.
 */
export function buildPrintSvg(barcode: string): string {
  if (!barcode) throw new Error('empty barcode')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  drawBarcode(svg, barcode, 'actual')
  const out = new XMLSerializer().serializeToString(svg)
  if (!out || (!out.includes('<rect') && !out.includes('<path'))) throw new Error('empty barcode svg')
  return out
}

/** True when `svg` markup was generated for exactly this barcode value. */
export function svgMatchesBarcode(svg: string, barcode: string): boolean {
  const escaped = barcode.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  return svg.includes(`data-barcode="${escaped}"`)
}
