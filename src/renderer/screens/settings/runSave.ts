import type { Notify } from './types'

interface ApiResult<D> {
  success: boolean
  data?: D
  error?: string
}

interface RunSaveOptions<D> {
  isEditing: boolean
  update: () => Promise<ApiResult<D>>
  add: () => Promise<ApiResult<D>>
  messages: { added: string; updated: string; addFailed: string; updateFailed: string }
  unexpectedError: string
  notify: Notify
  /** Called when a NEW record was created successfully (e.g. to select the new brand) */
  onAdded?: (data: D | undefined) => void
  /** Called after the attempt (success or API failure): close the dialog and reload the lists */
  onSettled: () => void | Promise<void>
  /** Called when the call itself threw: the dialog stays open */
  onThrown?: () => void
}

/**
 * Shared add-or-update flow of every settings dialog:
 * call the API, report success / the API error, then close and reload.
 * An exception shows the error but keeps the dialog open.
 */
export async function runSave<D>(options: RunSaveOptions<D>): Promise<void> {
  const { isEditing, update, add, messages, unexpectedError, notify, onAdded, onSettled, onThrown } = options
  try {
    if (isEditing) {
      const res = await update()
      if (res.success) notify('success', messages.updated)
      else notify('error', res.error || messages.updateFailed)
    } else {
      const res = await add()
      if (res.success) {
        notify('success', messages.added)
        onAdded?.(res.data)
      } else {
        notify('error', res.error || messages.addFailed)
      }
    }
    await onSettled()
  } catch (err: unknown) {
    notify('error', err instanceof Error ? err.message : unexpectedError)
    onThrown?.()
  }
}
