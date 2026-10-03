import * as React from 'react'
import { useState } from 'react'
import { Download, HardDrive, Upload } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { Button } from '../../../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Skeleton } from '../../../components/ui/Skeleton'
import type { SettingsTabProps } from '../types'
import { ImportConfirmDialog } from './ImportConfirmDialog'
import { Mono } from '../../../components/ui/Mono'

function InfoCell({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-muted/50 p-3">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function BackupTab({ data, loading, reload, notify }: SettingsTabProps): React.JSX.Element {
  const { t } = useI18n()
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const m = t.ui.settings.msg
  const { dbInfo } = data

  const handleExport = async (): Promise<void> => {
    setExporting(true)
    try {
      const res = await window.api.exportBackup()
      if (res.success && res.filePath) {
        notify('success', t.settings.backup.exportSuccess.replace('{path}', res.filePath))
      } else if (!res.canceled) {
        notify('error', res.error || m.exportFailed)
      }
    } catch (err: unknown) {
      notify('error', err instanceof Error ? err.message : m.exportError)
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (): Promise<void> => {
    setConfirmOpen(false)
    setImporting(true)
    try {
      const res = await window.api.importBackup()
      if (res.success) {
        let msg = t.settings.backup.importSuccess
        if (res.safetyBackupPath) {
          msg += ` (${t.settings.backup.safetyBackupNotice.replace('{path}', res.safetyBackupPath)})`
        }
        notify('success', msg)
        await reload()
      } else if (!res.canceled) {
        notify('error', res.error || m.importFailed)
      }
    } catch (err: unknown) {
      notify('error', err instanceof Error ? err.message : m.importError)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-header">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary text-primary-foreground">
              <HardDrive className="h-5 w-5" />
            </span>
            <div>
              <CardTitle className="text-base">{t.settings.backup.databaseInfoTitle}</CardTitle>
              <CardDescription className="mt-1 text-xs">{t.settings.backup.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3" data-testid="settings-db-info">
            <InfoCell label={t.settings.backup.databasePath}>
              {loading && !dbInfo ? (
                <Skeleton className="h-4 w-full" />
              ) : (
                <Mono className="block break-all text-start text-[11px] text-foreground select-all">
                  {dbInfo?.filePath || '...'}
                </Mono>
              )}
            </InfoCell>
            <InfoCell label={t.settings.backup.databaseSize}>
              {loading && !dbInfo ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <span dir="ltr" className="block text-start text-sm font-bold tabular-nums text-success-soft-foreground">
                  {dbInfo?.fileSizeFormatted || '...'}
                </span>
              )}
            </InfoCell>
            <InfoCell label={t.settings.backup.lastModified}>
              {loading && !dbInfo ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <span dir="ltr" className="block text-start text-xs font-semibold tabular-nums text-foreground">
                  {dbInfo?.lastModified ? new Date(dbInfo.lastModified).toLocaleString() : '...'}
                </span>
              )}
            </InfoCell>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="transition-shadow hover:shadow-pop">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Download className="h-5 w-5" />
              </span>
              <div>
                <CardTitle className="text-base">{t.settings.backup.exportButton}</CardTitle>
                <CardDescription className="mt-1 text-xs">{t.settings.backup.exportHelp}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={handleExport}
              disabled={exporting}
              size="lg"
              className="w-full"
              data-testid="settings-export"
            >
              <Download className="h-4 w-4" />
              <span>{exporting ? t.ui.settings.backup.exporting : t.settings.backup.exportButton}</span>
            </Button>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-pop">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-soft text-warning-soft-foreground">
                <Upload className="h-5 w-5" />
              </span>
              <div>
                <CardTitle className="text-base">{t.settings.backup.importButton}</CardTitle>
                <CardDescription className="mt-1 text-xs">{t.settings.backup.importHelp}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={importing}
              variant="outline"
              size="lg"
              className="w-full border-warning/40 text-warning-soft-foreground hover:bg-warning-soft"
              data-testid="settings-import"
            >
              <Upload className="h-4 w-4" />
              <span>{importing ? t.ui.settings.backup.importing : t.settings.backup.importButton}</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      <ImportConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} onConfirm={handleImport} />
    </div>
  )
}
