import { useCallback, useState } from 'react'
import type { Notify } from './types'

interface UsageCheck {
  success: boolean
  data?: { canDelete: boolean; message?: string }
}

interface DeleteFlowOptions<T extends { id: number }> {
  checkUsage: (id: number) => Promise<UsageCheck>
  remove: (id: number) => Promise<{ success: boolean; error?: string }>
  /** Shown when the item is in use (or the delete failed with no message) */
  guardWarning: string
  deletedMessage: string
  notify: Notify
  /** Called after a successful delete (reload data, clear selection...) */
  onDeleted: (item: T) => void | Promise<void>
}

/**
 * Delete with usage check: the usage check runs first (an item referenced by tickets is
 * refused with a warning, no dialog). Only deletable items open the confirmation dialog.
 */
export function useDeleteFlow<T extends { id: number }>(
  options: DeleteFlowOptions<T>
): {
  pending: T | null
  deleting: boolean
  request: (item: T) => Promise<void>
  confirm: () => Promise<void>
  cancel: () => void
} {
  const { checkUsage, remove, guardWarning, deletedMessage, notify, onDeleted } = options
  const [pending, setPending] = useState<T | null>(null)
  const [deleting, setDeleting] = useState(false)

  const request = useCallback(
    async (item: T) => {
      try {
        const checkRes = await checkUsage(item.id)
        if (checkRes.success && checkRes.data && !checkRes.data.canDelete) {
          notify('warning', checkRes.data.message || guardWarning)
          return
        }
        setPending(item)
      } catch (err: unknown) {
        notify('warning', err instanceof Error ? err.message : guardWarning)
      }
    },
    [checkUsage, notify, guardWarning]
  )

  const confirm = useCallback(async () => {
    if (!pending) return
    const item = pending
    setDeleting(true)
    try {
      const res = await remove(item.id)
      if (res.success) {
        notify('success', deletedMessage)
        await onDeleted(item)
      } else {
        notify('warning', res.error || guardWarning)
      }
    } catch (err: unknown) {
      notify('warning', err instanceof Error ? err.message : guardWarning)
    } finally {
      setDeleting(false)
      setPending(null)
    }
  }, [pending, remove, notify, deletedMessage, guardWarning, onDeleted])

  const cancel = useCallback(() => setPending(null), [])

  return { pending, deleting, request, confirm, cancel }
}
