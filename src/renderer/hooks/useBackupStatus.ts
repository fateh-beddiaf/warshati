import { useCallback, useEffect, useRef, useState } from 'react'
import type { BackupStatus, BackupStatusEvent } from '../../shared/auto-backup'

/** The status is also re-read this often: the warning depends on time passing and on the folder being reachable */
const REFRESH_MS = 5 * 60 * 1000

/**
 * The automatic backup status from the main process: read on mount and whenever `refreshKey` changes (e.g. the
 * active screen), refreshed by the status the main process pushes after every backup run and periodic check.
 * `onEvent` receives every pushed event (runs included), e.g. to show a toast when an automatic backup fails.
 */
export function useBackupStatus(
  refreshKey?: unknown,
  onEvent?: (event: BackupStatusEvent) => void
): { status: BackupStatus | null; refresh: () => Promise<void>; setStatus: (status: BackupStatus) => void } {
  const [status, setStatusState] = useState<BackupStatus | null>(null)
  // The status is re-read on every screen switch: keep the same object when nothing changed, so the app does not
  // re-render in the middle of a screen transition for nothing
  const setStatus = useCallback((next: BackupStatus): void => {
    setStatusState((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
  }, [])
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const res = await window.api.getBackupStatus()
      if (res.success && res.data) setStatus(res.data)
    } catch (err) {
      console.warn('Failed to read the backup status:', err)
    }
  }, [setStatus])

  useEffect(() => {
    void refresh()
  }, [refresh, refreshKey])

  useEffect(() => {
    const timer = setInterval(() => void refresh(), REFRESH_MS)
    const unsubscribe = window.api.onBackupStatus((event) => {
      setStatus(event.status)
      onEventRef.current?.(event)
    })
    return () => {
      clearInterval(timer)
      unsubscribe()
    }
  }, [refresh, setStatus])

  return { status, refresh, setStatus }
}
