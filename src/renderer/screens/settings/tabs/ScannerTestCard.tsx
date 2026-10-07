import * as React from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { ScanBarcode } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input } from '../../../components/ui/Input'
import { Label } from '../../../components/ui/Label'
import { Mono } from '../../../components/ui/Mono'
import { cn } from '../../../lib/utils'
import {
  SCAN_MAX_INTERVAL_MS,
  SCAN_MIN_LENGTH,
  classifyKey,
  diagnoseScan,
  keyTime,
  type RawKey,
  type ScanDiagnosis
} from '../../../../shared/scanner'

/** A burst with no suffix is shown after this much silence (the reader may not be sending Enter at all). */
const IDLE_FINISH_MS = 400

/**
 * "Test the reader": shows exactly what the last scan sent (characters, physical key codes, speed, suffix) and
 * what the app makes of it, so the shop owner can check a reader's configuration without a developer.
 * The field is a barcode field (data-barcode-input): the global listener never takes a scan away from it.
 */
export function ScannerTestCard(): React.JSX.Element {
  const { t } = useI18n()
  const s = t.ui.settings.scannerTest
  const inputId = useId()
  const [value, setValue] = useState('')
  const [result, setResult] = useState<ScanDiagnosis | null>(null)
  const keysRef = useRef<RawKey[]>([])
  const idleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => void (idleRef.current && clearTimeout(idleRef.current)), [])

  const finish = (suffix: ScanDiagnosis['suffix']): void => {
    if (idleRef.current) clearTimeout(idleRef.current)
    idleRef.current = null
    const keys = keysRef.current
    keysRef.current = []
    if (keys.length > 0) setResult(diagnoseScan(keys, suffix))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    const k = classifyKey(e)
    if (k.kind === 'modifier') return
    if (k.kind === 'suffix') {
      // Keep focus here and do not submit anything: this field only observes
      e.preventDefault()
      finish(k.key)
      return
    }
    // Keys accumulate until a suffix or a pause (IDLE_FINISH_MS), even when slower than a scan: then the result
    // says "too slow" instead of showing a fragment. A new burst replaces the previous one in the field.
    if (keysRef.current.length === 0) setValue('')
    keysRef.current.push({ key: e.key, code: e.code, time: keyTime(e, () => performance.now()) })
    if (idleRef.current) clearTimeout(idleRef.current)
    idleRef.current = setTimeout(() => finish(null), IDLE_FINISH_MS)
  }

  const verdictText = (d: ScanDiagnosis): string =>
    d.verdict === 'ok'
      ? s.verdictOk
      : d.verdict === 'no-suffix'
        ? s.verdictNoSuffix
        : d.verdict === 'short'
          ? s.verdictShort.replace('{min}', String(SCAN_MIN_LENGTH))
          : s.verdictSlow.replace('{max}', String(SCAN_MAX_INTERVAL_MS))

  return (
    <Card data-testid="scanner-test-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground [&_svg]:h-5 [&_svg]:w-5">
            <ScanBarcode />
          </span>
          <div>
            <CardTitle className="text-base">{s.title}</CardTitle>
            <CardDescription className="mt-1 text-xs">{s.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={inputId}>{s.inputLabel}</Label>
          <Input
            id={inputId}
            mono
            dir="ltr"
            data-barcode-input="true"
            data-testid="scanner-test-input"
            autoComplete="off"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={s.inputPlaceholder}
          />
        </div>

        {result === null ? (
          <p className="text-xs text-muted-foreground">{s.waiting}</p>
        ) : (
          <dl
            data-testid="scanner-test-result"
            data-verdict={result.verdict}
            className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/40 p-3 text-xs"
          >
            <dt className="font-semibold text-muted-foreground">{s.chars}</dt>
            <dd>
              <Mono data-testid="scanner-test-chars" className="break-all">
                {result.chars}
              </Mono>
            </dd>
            <dt className="font-semibold text-muted-foreground">{s.readAs}</dt>
            <dd>
              <Mono data-testid="scanner-test-read-as" className="break-all font-bold">
                {result.readAs}
              </Mono>
            </dd>
            <dt className="font-semibold text-muted-foreground">{s.keyCodes}</dt>
            <dd>
              <Mono className="break-all text-[11px]">{result.codes.join(' ')}</Mono>
            </dd>
            <dt className="font-semibold text-muted-foreground">{s.interval}</dt>
            <dd data-testid="scanner-test-interval">
              {result.avgIntervalMs === null
                ? '—'
                : s.intervalValue
                    .replace('{ms}', result.avgIntervalMs.toFixed(1))
                    .replace('{count}', String(result.keyCount))}
            </dd>
            <dt className="font-semibold text-muted-foreground">{s.suffix}</dt>
            <dd data-testid="scanner-test-suffix">
              <Mono>{result.suffix ?? s.noSuffix}</Mono>
            </dd>
            <dt className="font-semibold text-muted-foreground">{s.verdict}</dt>
            <dd className="space-y-1">
              <p
                data-testid="scanner-test-verdict"
                className={cn('font-bold', result.verdict === 'ok' ? 'text-success' : 'text-destructive')}
              >
                {verdictText(result)}
              </p>
              {result.verdict === 'ok' && (
                <p data-testid="scanner-test-kind" className="text-muted-foreground">
                  {result.isTicketCode ? s.ticketCode : s.otherCode}
                </p>
              )}
            </dd>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
