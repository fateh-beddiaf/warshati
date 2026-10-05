import * as React from 'react'
import { useState } from 'react'
import { History, RotateCcw } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { formatDate } from '../../../lib/utils'
import { Button } from '../../../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/Table'
import type { BackupFileInfo, BackupStatus } from '../../../../shared/auto-backup'
import { formatBytes } from '../../../../shared/format-bytes'
import type { Notify } from '../types'
import { ImportConfirmDialog } from './ImportConfirmDialog'

interface BackupListCardProps {
  status: BackupStatus | null
  notify: Notify
  /** after a successful restore: reload everything that shows data */
  onRestored: () => Promise<void>
}

/** The backups in the chosen folder, each restorable through the safe import (safety copy first). */
export function BackupListCard({ status, notify, onRestored }: BackupListCardProps): React.JSX.Element | null {
  const { t } = useI18n()
  const a = t.ui.settings.autoBackup
  const [pending, setPending] = useState<BackupFileInfo | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)

  if (!status?.dir) return null

  const restore = async (): Promise<void> => {
    const file = pending
    setPending(null)
    if (!file) return
    setRestoring(file.name)
    try {
      const res = await window.api.restoreBackup(file.name)
      if (!res.success) throw new Error(res.error || a.failed)
      let msg = a.restoreSuccess
      if (res.safetyBackupPath) {
        msg += ` (${t.settings.backup.safetyBackupNotice.replace('{path}', res.safetyBackupPath)})`
      }
      notify('success', msg)
      await onRestored()
    } catch (err) {
      notify('error', err instanceof Error ? err.message : a.failed)
    } finally {
      setRestoring(null)
    }
  }

  return (
    <Card data-testid="backup-list-card">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <History className="h-5 w-5" />
          </span>
          <div>
            <CardTitle className="text-base">{a.listTitle}</CardTitle>
            <CardDescription className="mt-1 text-xs">{a.listDescription}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!status.dirAvailable ? (
          <p className="text-xs text-muted-foreground">{a.listUnavailable}</p>
        ) : status.files.length === 0 ? (
          <EmptyState icon={<History />} title={a.listEmpty} className="py-8" data-testid="backup-list-empty" />
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
            <Table data-testid="backup-list">
              <TableHeader>
                <TableRow>
                  <TableHead>{a.colDate}</TableHead>
                  <TableHead>{a.colSize}</TableHead>
                  <TableHead className="text-end">{t.common.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {status.files.map((file) => (
                  <TableRow key={file.name} data-testid="backup-list-row" data-name={file.name}>
                    <TableCell className="text-xs font-semibold">{formatDate(file.createdAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <span dir="ltr">{formatBytes(file.sizeBytes)}</span>
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={restoring !== null}
                        onClick={() => setPending(file)}
                        data-testid="backup-restore"
                        className="border-warning/40 text-warning-soft-foreground hover:bg-warning-soft"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {restoring === file.name ? a.restoring : a.restore}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <ImportConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        onConfirm={() => void restore()}
        title={pending ? a.restoreTitle.replace('{date}', formatDate(pending.createdAt)) : undefined}
        description={a.restoreDesc}
        testId="backup-restore-dialog"
      />
    </Card>
  )
}
