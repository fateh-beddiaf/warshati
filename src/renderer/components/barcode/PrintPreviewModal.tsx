import * as React from 'react'
import { useState, useEffect, useRef, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useI18n } from '../../lib/i18n'
import { slideDown } from '../../lib/motion'
import { BarcodeLabel } from './BarcodeLabel'
import { buildPrintSvg, svgMatchesBarcode } from './barcode-svg'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Switch } from '../ui/Switch'
import { SegmentedControl } from '../ui/SegmentedControl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/Dialog'
import type { PrinterInfo } from '../../../preload/index.d'
import { Printer, CheckCircle2, AlertCircle, Eye, Maximize2, Tag, PhoneCall } from 'lucide-react'
import { Mono } from '../ui/Mono'

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

// Radix Select items need a non-empty value: "" (system default printer) is stored under this key.
const DEFAULT_PRINTER = '__default__'

export function PrintPreviewModal({
  isOpen,
  onClose,
  data,
  onPrintSuccess
}: PrintPreviewModalProps): React.JSX.Element {
  const { t } = useI18n()
  const [scaleMode, setScaleMode] = useState<'zoomed' | 'actual'>('zoomed')
  const [shortLabel, setShortLabel] = useState('')
  const [showPhone, setShowPhone] = useState(true)
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [selectedPrinter, setSelectedPrinter] = useState<string>('')

  // The SVG sent to the printer is derived synchronously from the CURRENT barcode (always with the
  // 'actual' size settings, independent of the zoom toggle), so it can never belong to another ticket.
  const barcodeValue = data?.barcode ?? ''
  const printSvg = useMemo<{ svg: string; ok: boolean }>(() => {
    if (!barcodeValue) return { svg: '', ok: false }
    try {
      const svg = buildPrintSvg(barcodeValue)
      return { svg, ok: svgMatchesBarcode(svg, barcodeValue) }
    } catch (err) {
      console.warn('Failed to generate print barcode:', err)
      return { svg: '', ok: false }
    }
  }, [barcodeValue])
  const [printing, setPrinting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Incremented whenever the modal opens/closes or the data changes, so the result of a print
  // started earlier (e.g. a job that timed out after the user closed the modal) is ignored.
  const printRequestRef = useRef(0)

  // Reset/sync local state whenever modal opens or data changes
  useEffect(() => {
    printRequestRef.current += 1
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

  // A barcode that cannot be drawn is an error the user must see; printing stays disabled.
  const shownMessage = statusMessage ?? (printSvg.ok ? null : { type: 'error' as const, text: t.print.barcodeError })

  const handlePrint = async (): Promise<void> => {
    if (!data) return
    if (!printSvg.ok || !svgMatchesBarcode(printSvg.svg, data.barcode)) {
      setStatusMessage({ type: 'error', text: t.print.barcodeError })
      return
    }
    const requestId = ++printRequestRef.current
    const isCurrent = (): boolean => printRequestRef.current === requestId
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
        svgContent: printSvg.svg
      })

      if (!isCurrent()) return
      if (res.success) {
        setStatusMessage({ type: 'success', text: t.print.printSuccess })
        if (onPrintSuccess) onPrintSuccess()
      } else {
        setStatusMessage({ type: 'error', text: res.error || t.print.printError })
      }
    } catch (err) {
      if (!isCurrent()) return
      setStatusMessage({
        type: 'error',
        text: err instanceof Error ? err.message : t.print.printError
      })
    } finally {
      if (isCurrent()) setPrinting(false)
    }
  }

  return (
    <Dialog open={isOpen && data !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-xl gap-5"
        closeTestId="print-close"
        closeLabel={t.ticketDetails.closeButton}
        onOpenAutoFocus={(e) => {
          // Keep focus off the Print button: a stray Enter must not send a job to the printer
          e.preventDefault()
          ;(e.currentTarget as HTMLElement).focus()
        }}
      >
        <DialogHeader className="pe-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-card">
              <Printer className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle>{t.print.modalTitle}</DialogTitle>
              <DialogDescription>{t.print.modalSubtitle}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {data && (
          <>
            {/* Preview stage: the label is always black on white, whatever the app theme */}
            <div className="relative flex min-h-[230px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted p-6 pt-14">
              <Mono className="absolute start-3 top-3 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-bold text-muted-foreground">
                {t.ui.details.labelSize}
              </Mono>
              <SegmentedControl
                layoutGroup="print-scale"
                ariaLabel={t.ui.details.scaleAria}
                className="absolute end-3 top-3 bg-card"
                value={scaleMode}
                onChange={setScaleMode}
                items={[
                  { value: 'zoomed', label: t.print.zoomedToggle, icon: <Eye /> },
                  { value: 'actual', label: t.print.actualSizeToggle, icon: <Maximize2 /> }
                ]}
              />

              <div className="transition-all duration-200">
                <BarcodeLabel
                  barcode={data.barcode}
                  customerName={data.customerName}
                  shortLabel={shortLabel}
                  customerPhone={showPhone ? data.customerPhone : undefined}
                  scaleMode={scaleMode}
                />
              </div>
              <p className="text-center text-[11px] text-muted-foreground">{t.ui.details.previewNote}</p>
            </div>

            <AnimatePresence initial={false}>
              {shownMessage && (
                <motion.div
                  key={shownMessage.type}
                  {...slideDown}
                  data-testid="print-status"
                  role={shownMessage.type === 'success' ? 'status' : 'alert'}
                  className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-sm font-semibold ${
                    shownMessage.type === 'success'
                      ? 'border-success/25 bg-success-soft text-success-soft-foreground'
                      : 'border-danger/25 bg-danger-soft text-danger-soft-foreground'
                  }`}
                >
                  {shownMessage.type === 'success' ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 shrink-0" />
                  )}
                  <span>{shownMessage.text}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="print-short-label" className="flex items-center gap-1.5 text-xs">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  {t.print.shortLabelLabel}
                </Label>
                <Input
                  id="print-short-label"
                  type="text"
                  value={shortLabel}
                  onChange={(e) => setShortLabel(e.target.value)}
                  placeholder={t.ui.details.shortLabelPlaceholder}
                  mono className="font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="print-printer" className="flex items-center gap-1.5 text-xs">
                  <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                  {t.print.selectPrinter}
                </Label>
                <Select
                  value={selectedPrinter || DEFAULT_PRINTER}
                  onValueChange={(v) => setSelectedPrinter(v === DEFAULT_PRINTER ? '' : v)}
                >
                  <SelectTrigger id="print-printer" data-testid="print-printer" className="text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_PRINTER}>{t.print.defaultPrinter}</SelectItem>
                    {printers
                      .filter((p) => p.name !== '')
                      .map((p) => (
                        <SelectItem key={p.name} value={p.name}>
                          {p.displayName || p.name} {p.isDefault ? t.ui.details.defaultMark : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {data.customerPhone && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <Switch id="print-show-phone" checked={showPhone} onCheckedChange={setShowPhone} />
                <Label htmlFor="print-show-phone" className="flex cursor-pointer items-center gap-1.5 text-xs">
                  <PhoneCall className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>
                    {t.print.showPhoneLabel} (<Mono>{data.customerPhone}</Mono>)
                  </span>
                </Label>
              </div>
            )}
          </>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" data-testid="print-close-footer" onClick={onClose}>
            {t.ticketDetails.closeButton}
          </Button>

          <Button
            type="button"
            size="lg"
            data-testid="print-submit"
            onClick={handlePrint}
            disabled={printing || !printSvg.ok}
            className="px-6"
          >
            <Printer className="h-4 w-4" />
            {printing ? t.print.printingButton : t.print.printButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
