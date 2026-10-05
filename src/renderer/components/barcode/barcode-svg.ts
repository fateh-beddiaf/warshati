import { buildLabelBarcode } from '../../../shared/label-barcode'

export type BarcodeScaleMode = 'actual' | 'zoomed'

/** The zoomed on-screen preview is the same drawing, enlarged to fit its card (the printed label is always 'actual'). */
export const ZOOMED_PREVIEW_SCALE = 1.8

/**
 * Draws `barcode` into an existing <svg> with the exact printed geometry (see shared/label-barcode.ts):
 * 'actual' is the real size in mm, 'zoomed' the same drawing scaled up. Throws if the value cannot be encoded.
 */
export function drawBarcode(svg: SVGSVGElement, barcode: string, mode: BarcodeScaleMode): void {
  const { svg: markup } = buildLabelBarcode(barcode, mode === 'zoomed' ? ZOOMED_PREVIEW_SCALE : 1)
  const drawn = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement
  if (drawn.nodeName !== 'svg') throw new Error('invalid barcode svg')
  for (const name of svg.getAttributeNames()) {
    if (name !== 'class' && name !== 'data-testid') svg.removeAttribute(name)
  }
  for (const attr of Array.from(drawn.attributes)) svg.setAttribute(attr.name, attr.value)
  svg.replaceChildren(...Array.from(drawn.childNodes).map((node) => document.importNode(node, true)))
}

/**
 * The SVG markup sent to the printer: always the 'actual' geometry, whatever the on-screen zoom. Throws if
 * generation fails; the result carries a data-barcode attribute so a stale SVG can be detected.
 */
export function buildPrintSvg(barcode: string): string {
  if (!barcode) throw new Error('empty barcode')
  return buildLabelBarcode(barcode).svg
}

/** True when `svg` markup was generated for exactly this barcode value. */
export function svgMatchesBarcode(svg: string, barcode: string): boolean {
  const escaped = barcode.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return svg.includes(`data-barcode="${escaped}"`)
}
