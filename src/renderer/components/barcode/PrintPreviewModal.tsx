import * as React from 'react'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '../../lib/i18n'
import { BarcodeLabel } from './BarcodeLabel'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/Card'
import type { PrinterInfo } from '../../../preload/index.d'
import {
  Printer,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  Maximize2,
  Check,
  Tag,
  PhoneCall
} from 'lucide-react'

export interface PrintPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  data: {
    barcode: string
    customerName: string
    shortLabel: string
    customerPhone?: string
    ticketId?: number
  } | null
  onPrintSuccess?: () => void
}

export function PrintPreviewModal({
  isOpen,
  onClose,
  data,
  onPrintSuccess
}: PrintPreviewModalProps): React.JSX.Element | null {
  const { t } = useI18n()
  const [scaleMode, setScaleMode] = useState<'zoomed' | 'actual'>('zoomed')
  const [shortLabel, setShortLabel] = useState('')
  const [showPhone, setShowPhone] = useState(true)
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string>('')

  const [svgContent, setSvgContent] = useState<string>('')
  const [printing, setPrinting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Reset/sync local state whenever modal opens or data changes
  useEffect(() => {
    if (data) {
      setShortLabel(data.shortLabel || '')
      setShowPhone(!!data.customerPhone)
      setStatusMessage(null)
      setPrinting(false)
    }
  }, [data, isOpen])

  // Load system printers list
  useEffect(() => {
    if (isOpen) {
      window.api.getPrinters().then((res) => {
        if (res.success && res.data) {
          setPrinters(res.data)
          const defaultP = res.data.find((p) => p.isDefault)
          if (defaultP) {
            setSelectedPrinter(defaultP.name)
          }
        }
      }).catch(console.error)
    }
  }, [isOpen])

  if (!isOpen || !data) return null

  const handlePrint = async (): Promise<void> => {
    setPrinting(true)
    setStatusMessage(null)

    try {
      const res = await window.api.printLabel({
        barcode: data.barcode,
        customerName: data.customerName,
        customerPhone: showPhone ? data.customerPhone : undefined,
        shortLabel: shortLabel.trim() || data.shortLabel,
        ticketId: data.ticketId,
        printerName: selectedPrinter || undefined,
        svgContent: svgContent || undefined
      })

      if (res.success) {
        setStatusMessage({ type: 'success', text: t.print.printSuccess })
        if (onPrintSuccess) onPrintSuccess()
      } else {
        setStatusMessage({ type: 'error', text: res.error || t.print.printError })
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : t.print.printError
      })
    } finally {
      setPrinting(false)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-xl"
        >
          <Card className="shadow-2xl border-slate-300 bg-white overflow-hidden">
            {/* Header */}
            <CardHeader className="bg-slate-50 border-b border-slate-200 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                    <Printer className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-900">
                      {t.print.modalTitle}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      {t.print.modalSubtitle}
                    </CardDescription>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              {/* Preview Stage */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-100/90 rounded-2xl border border-slate-200 relative min-h-[220px]">
                {/* Scale mode toggle pills */}
                <div className="absolute top-3 end-3 flex items-center bg-white p-0.5 rounded-lg border border-slate-200 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setScaleMode('zoomed')}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                      scaleMode === 'zoomed'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Eye className="h-3 w-3" />
                    {t.print.zoomedToggle}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScaleMode('actual')}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                      scaleMode === 'actual'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Maximize2 className="h-3 w-3" />
                    {t.print.actualSizeToggle}
                  </button>
                </div>

                <div className="absolute top-3 start-3">
                  <span className="text-[10px] font-mono font-bold text-slate-500 bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                    40 × 20 mm
                  </span>
                </div>

                {/* The Label Rendered */}
                <div className="mt-6 transition-all duration-200">
                  <BarcodeLabel
                    barcode={data.barcode}
                    customerName={data.customerName}
                    shortLabel={shortLabel}
                    customerPhone={showPhone ? data.customerPhone : undefined}
                    scaleMode={scaleMode}
                    onSvgGenerated={setSvgContent}
                  />
                </div>
              </div>

              {/* Status Message */}
              {statusMessage && (
                <div
                  className={`p-3.5 rounded-xl border text-sm flex items-center gap-2.5 font-semibold ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                      : 'bg-red-50 text-red-900 border-red-200'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Settings Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Short Label Editor */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-slate-500" />
                    {t.print.shortLabelLabel}
                  </label>
                  <Input
                    type="text"
                    value={shortLabel}
                    onChange={(e) => setShortLabel(e.target.value)}
                    placeholder="SA A54..."
                    className="font-mono font-bold"
                  />
                </div>

                {/* Printer Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Printer className="h-3.5 w-3.5 text-slate-500" />
                    {t.print.selectPrinter}
                  </label>
                  <select
                    value={selectedPrinter}
                    onChange={(e) => setSelectedPrinter(e.target.value)}
                    className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <option value="">{t.print.defaultPrinter}</option>
                    {printers.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.displayName || p.name} {p.isDefault ? '(الافتراضية)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Checkbox Options */}
              {data.customerPhone && (
                <div className="flex items-center gap-2 pt-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showPhone}
                      onChange={(e) => setShowPhone(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <PhoneCall className="h-3.5 w-3.5 text-slate-500" />
                    <span>{t.print.showPhoneLabel} ({data.customerPhone})</span>
                  </label>
                </div>
              )}
            </CardContent>

            {/* Footer */}
            <CardFooter className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={printing}
              >
                {t.ticketDetails.closeButton}
              </Button>

              <Button
                type="button"
                onClick={handlePrint}
                disabled={printing}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 px-6"
              >
                <Printer className="h-4 w-4 me-2" />
                {printing ? t.print.printingButton : t.print.printButton}
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
