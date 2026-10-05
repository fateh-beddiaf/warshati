import * as React from 'react'
import { useEffect, useRef } from 'react'
import { drawBarcode } from './barcode-svg'

export interface BarcodeLabelProps {
  barcode: string
  customerName: string
  shortLabel: string
  customerPhone?: string
  scaleMode?: 'actual' | 'zoomed'
  className?: string
}

export function BarcodeLabel({
  barcode,
  customerName,
  shortLabel,
  customerPhone,
  scaleMode = 'zoomed',
  className = ''
}: BarcodeLabelProps): React.JSX.Element {
  const svgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    // Never leave the previous ticket's bars on screen if drawing fails or there is no value
    svg.replaceChildren()
    svg.removeAttribute('data-barcode')
    if (!barcode) return
    try {
      drawBarcode(svg, barcode, scaleMode)
    } catch (err) {
      svg.replaceChildren()
      svg.removeAttribute('data-barcode')
      console.warn('Failed to render barcode:', err)
    }
  }, [barcode, scaleMode])

  if (scaleMode === 'actual') {
    // Exact 40mm x 20mm physical millimeter dimensions
    return (
      <div
        dir="rtl"
        style={{ width: '40mm', height: '20mm', minWidth: '40mm', minHeight: '20mm' }}
        className={`bg-white text-black border border-slate-400 p-[1mm] flex flex-col justify-between shadow-sm overflow-hidden select-none box-border ${className}`}
      >
        {/* Header: Customer Name & Short Label */}
        <div className="flex items-center justify-between border-b border-black pb-[0.3mm] leading-none">
          <span className="font-extrabold text-[8px] truncate max-w-[24mm] text-black">{customerName || 'زبون'}</span>
          <span className="font-mono font-black text-[7.5px] bg-black text-white px-1 py-[0.5px] rounded-[1px] tracking-tight">
            {shortLabel || 'جهاز'}
          </span>
        </div>

        {/* Center: Barcode & Code */}
        <div className="flex flex-col items-center justify-center my-[0.2mm] flex-1">
          {/* Real size in mm from drawBarcode: never stretched (see shared/label-barcode.ts) */}
          <svg ref={svgRef} data-testid="barcode-svg" className="block flex-none" />
          <span className="font-mono font-bold text-[6px] tracking-wider text-black mt-[0.2mm] leading-none">
            {barcode}
          </span>
        </div>

        {/* Footer: Shop Name & Phone */}
        <div className="flex items-center justify-between text-[5.5px] font-bold text-black border-t border-dashed border-neutral-400 pt-[0.2mm] leading-none">
          <span>ورشتي</span>
          {customerPhone && (
            <span dir="ltr" className="font-mono text-[5.5px]">
              {customerPhone}
            </span>
          )}
        </div>
      </div>
    )
  }

  // Zoomed Mode (320px x 160px, 2:1 ratio for comfortable screen inspection)
  return (
    <div
      dir="rtl"
      style={{ width: '320px', height: '160px' }}
      className={`bg-white text-black border-2 border-slate-800 rounded-lg p-3 flex flex-col justify-between shadow-md select-none box-border ${className}`}
    >
      {/* Header: Customer Name & Short Label */}
      <div className="flex items-center justify-between border-b-2 border-black pb-1">
        <span className="font-extrabold text-sm truncate max-w-[200px] text-black">{customerName || 'اسم الزبون'}</span>
        <span className="font-mono font-black text-xs bg-black text-white px-2 py-0.5 rounded tracking-wide shadow-sm">
          {shortLabel || 'SA A54'}
        </span>
      </div>

      {/* Center: Barcode & Code */}
      <div className="flex flex-col items-center justify-center my-1 flex-1">
        <svg ref={svgRef} data-testid="barcode-svg" className="block flex-none" />
        <span className="font-mono font-black text-xs tracking-widest text-black mt-1">{barcode}</span>
      </div>

      {/* Footer: Shop Identity & Phone */}
      <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-800 border-t border-dashed border-slate-300 pt-1">
        <span className="text-slate-600 font-bold">ورشتي — صيانة الهواتف</span>
        {customerPhone && (
          <span dir="ltr" className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
            {customerPhone}
          </span>
        )}
      </div>
    </div>
  )
}
