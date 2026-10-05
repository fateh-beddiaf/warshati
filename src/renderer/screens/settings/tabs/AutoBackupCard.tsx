import * as React from 'react'
import { useEffect, useId, useState } from 'react'
import { AlertTriangle, CheckCircle2, FolderOpen, Info, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { formatDate } from '../../../lib/utils'
import { Button } from '../../../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input } from '../../../components/ui/Input'
import { Label } from '../../../components/ui/Label'
import { Switch } from '../../../components/ui/Switch'
import { Skeleton } from '../../../components/ui/Skeleton'
import { MAX_BACKUP_KEEP, MIN_BACKUP_KEEP, type BackupStatus } from '../../../../shared/auto-backup'
import { formatBytes } from '../../../../shared/format-bytes'
import type { Notify } from '../types'

interface AutoBackupCardProps {
  status: BackupStatus | null
  onStatus: (status: BackupStatus) => void
  notify: Notify
}

function Note({
  tone,
  icon,
  children,
  testId
}: {
  tone: 'warning' | 'danger'
  icon: React.ReactNode
  children: React.ReactNode
  testId?: string
}): React.JSX.Element {
  return (
    <div
      data-testid={testId}
      className={
        tone === 'warning'
          ? 'flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-soft p-2.5 text-xs font-semibold text-warning-soft-foreground [&_svg]:mt-0.5 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0'
          : 'flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-soft p-2.5 text-xs font-semibold text-danger-soft-foreground [&_svg]:mt-0.5 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0'
      }
    >
      {icon}
      <div className="min-w-0 [overflow-wrap:anywhere]">{children}</div>
    </div>
  )
}

/** Folder, on/off, how many to keep, "back up now", and the last success / last error. */
export function AutoBackupCard({ status, onStatus, notify }: AutoBackupCardProps): React.JSX.Element {
  const { t } = useI18n()
  const a = t.ui.settings.autoBackup
  const switchId = useId()
  const keepId = useId()
  const [busy, setBusy] = useState<'dir' | 'run' | null>(null)
  const [keepDraft, setKeepDraft] = useState('')

  // The field follows the saved value (not every status push, which would reset what is being typed)
  const savedKeep = status?.keep
  useEffect(() => {
    if (savedKeep !== undefined) setKeepDraft(String(savedKeep))
  }, [savedKeep])

  const apply = (res: { success: boolean; data?: BackupStatus; error?: string }, ok?: string): void => {
    if (!res.success) throw new Error(res.error || a.saveFailed)
    if (res.data) onStatus(res.data)
    if (ok) notify('success', ok)
  }

  const chooseFolder = async (): Promise<void> => {
    setBusy('dir')
    try {
      const res = await window.api.chooseBackupDir()
      if (!res.canceled) apply(res, a.folderSaved)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : a.saveFailed)
    } finally {
      setBusy(null)
    }
  }

  const toggle = async (enabled: boolean): Promise<void> => {
    try {
      apply(await window.api.setAutoBackupEnabled(enabled), enabled ? a.enabled : a.disabled)
    } catch (err) {
      notify('error', err instanceof Error ? err.message : a.saveFailed)
    }
  }

  const saveKeep = async (): Promise<void> => {
    const keep = Number(keepDraft)
    if (!status || !Number.isInteger(keep) || keep === status.keep) {
      if (status) setKeepDraft(String(status.keep))
      return
    }
    try {
      const res = await window.api.setBackupKeep(keep)
      apply(res, res.data ? a.keepSaved.replace('{count}', String(res.data.keep)) : undefined)
      if (res.data) setKeepDraft(String(res.data.keep))
    } catch (err) {
      notify('error', err instanceof Error ? err.message : a.saveFailed)
    }
  }

  const runNow = async (): Promise<void> => {
    setBusy('run')
    try {
      const res = await window.api.runBackupNow()
      if (!res.success || !res.data) throw new Error(res.error || a.saveFailed)
      onStatus(res.data.status)
      const r = res.data.result
      if (r.outcome === 'created') notify('success', a.created.replace('{path}', r.path))
      else if (r.outcome === 'unchanged') notify('success', a.unchanged.replace('{path}', r.path))
      else if (r.outcome === 'failed') notify('error', a.failed.replace('{error}', r.error))
    } catch (err) {
      notify('error', err instanceof Error ? err.message : a.saveFailed)
    } finally {
      setBusy(null)
    }
  }

  const hasDir = !!status?.dir
  return (
    <Card data-testid="auto-backup-card">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <CardTitle className="text-base">{a.title}</CardTitle>
            <CardDescription className="mt-1 text-xs leading-relaxed">{a.description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!status ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <>
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-muted-foreground">{a.folderLabel}</span>
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-muted/50 p-3">
                <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                {hasDir ? (
                  <span
                    dir="ltr"
                    data-testid="backup-dir"
                    className="min-w-0 flex-1 break-all text-start text-xs font-semibold text-foreground select-all"
                  >
                    {status.dir}
                  </span>
                ) : (
                  <span className="flex-1 text-xs text-muted-foreground" data-testid="backup-dir-empty">
                    {a.noFolder}
                  </span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant={hasDir ? 'outline' : 'default'}
                  onClick={chooseFolder}
                  disabled={busy === 'dir'}
                  data-testid="backup-choose-dir"
                >
                  <FolderOpen className="h-4 w-4" />
                  {hasDir ? a.changeFolder : a.chooseFolder}
                </Button>
              </div>
              {hasDir && !status.dirAvailable && (
                <Note tone="danger" icon={<XCircle />} testId="backup-dir-unavailable">
                  {a.folderUnavailable}
                </Note>
              )}
              {status.sameDriveAsDatabase && (
                <Note tone="warning" icon={<Info />} testId="backup-same-drive">
                  {a.sameDriveHint}
                </Note>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
                <div className="space-y-1">
                  <Label htmlFor={switchId} className="text-sm font-bold">
                    {a.autoLabel}
                  </Label>
                  <p className="text-xs text-muted-foreground">{hasDir ? a.autoHelp : a.autoNeedsFolder}</p>
                </div>
                <Switch
                  id={switchId}
                  checked={status.enabled}
                  disabled={!hasDir}
                  onCheckedChange={(v) => void toggle(v)}
                  data-testid="backup-auto-switch"
                />
              </div>
              <div className="space-y-1 rounded-xl border border-border p-3">
                <Label htmlFor={keepId} className="text-sm font-bold">
                  {a.keepLabel}
                </Label>
                <Input
                  id={keepId}
                  type="number"
                  min={MIN_BACKUP_KEEP}
                  max={MAX_BACKUP_KEEP}
                  step={1}
                  value={keepDraft}
                  onChange={(e) => setKeepDraft(e.target.value)}
                  onBlur={() => void saveKeep()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                  }}
                  className="h-9 w-28"
                  data-testid="backup-keep"
                />
                <p className="text-xs text-muted-foreground">{a.keepHelp}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-4 border-t border-border pt-4">
              <div className="min-w-0 flex-1 space-y-2 text-xs">
                <div className="flex items-start gap-2" data-testid="backup-last-success">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <div className="min-w-0">
                    <span className="font-semibold text-muted-foreground">{a.lastSuccess}: </span>
                    {status.lastSuccess ? (
                      <>
                        <span className="font-bold text-foreground">{formatDate(status.lastSuccess.at)}</span>
                        <span dir="ltr" className="ms-2 text-muted-foreground">
                          {formatBytes(status.lastSuccess.sizeBytes)}
                        </span>
                        <span dir="ltr" className="mt-0.5 block break-all text-start text-[11px] text-muted-foreground">
                          {status.lastSuccess.path}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">{a.never}</span>
                    )}
                  </div>
                </div>
                {status.lastError && (
                  <Note tone="danger" icon={<AlertTriangle />} testId="backup-last-error">
                    <span className="font-bold">
                      {a.lastError} ({formatDate(status.lastError.at)}):{' '}
                    </span>
                    {status.lastError.message}
                  </Note>
                )}
              </div>
              <Button
                type="button"
                onClick={runNow}
                disabled={!hasDir || busy === 'run' || status.running}
                data-testid="backup-run-now"
              >
                <RefreshCw className="h-4 w-4" />
                {busy === 'run' ? a.running : a.runNow}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
