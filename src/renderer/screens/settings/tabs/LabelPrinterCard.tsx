import * as React from 'react'
import { useEffect, useId, useState } from 'react'
import { Printer } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { Button } from '../../../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Label } from '../../../components/ui/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/Select'
import { LABEL_PRINTER_SETTING_KEY, type PrinterInfo } from '../../../../shared/types'
import type { Notify } from '../types'

const NONE = '__none__'

/**
 * The label printer preselected by the print dialog (setting LABEL_PRINTER_SETTING_KEY). The app also saves it after
 * every successful label print; here it can be chosen or cleared ('' = the system default printer).
 */
export function LabelPrinterCard({ notify }: { notify: Notify }): React.JSX.Element {
  const { t } = useI18n()
  const s = t.ui.settings.labelPrinter
  const selectId = useId()
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [saved, setSaved] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([window.api.getPrinters(), window.api.getSetting(LABEL_PRINTER_SETTING_KEY, '')])
      .then(([list, setting]) => {
        if (!alive) return
        if (list.success && list.data) setPrinters(list.data)
        if (setting.success && typeof setting.data === 'string') setSaved(setting.data)
      })
      .catch(console.error)
    return () => {
      alive = false
    }
  }, [])

  const save = async (name: string): Promise<void> => {
    try {
      const res = await window.api.setSetting(LABEL_PRINTER_SETTING_KEY, name)
      if (res && res.success === false) throw new Error(res.error || s.saveFailed)
      setSaved(name)
      notify('success', name ? s.saved : s.cleared)
    } catch (err: unknown) {
      notify('error', err instanceof Error ? err.message : s.saveFailed)
    }
  }

  const installed = saved === '' || printers.some((p) => p.name === saved)

  return (
    <Card data-testid="label-printer-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground [&_svg]:h-5 [&_svg]:w-5">
            <Printer />
          </span>
          <div>
            <CardTitle className="text-base">{s.title}</CardTitle>
            <CardDescription className="mt-1 text-xs">{s.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor={selectId}>{s.selectLabel}</Label>
        <div className="flex items-center gap-2">
          <Select value={saved || NONE} onValueChange={(v) => void save(v === NONE ? '' : v)}>
            <SelectTrigger id={selectId} data-testid="label-printer-select" className="flex-1 text-xs font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{s.none}</SelectItem>
              {printers
                .filter((p) => p.name !== '')
                .map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.displayName || p.name} {p.isDefault ? t.ui.details.defaultMark : ''}
                  </SelectItem>
                ))}
              {!installed && <SelectItem value={saved}>{s.notInstalled.replace('{name}', saved)}</SelectItem>}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="label-printer-clear"
            disabled={saved === ''}
            onClick={() => void save('')}
          >
            {s.clear}
          </Button>
        </div>
        {!installed && (
          <p data-testid="label-printer-missing" className="text-xs font-semibold text-warning">
            {s.notInstalledHelp}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
