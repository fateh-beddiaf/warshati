import { useEffect, useState } from 'react'
import { toast } from '../../ui/Sonner'
import { useI18n } from '../../../lib/i18n'
import { isCostLoss, parseCostInput } from '../../../../shared/parts-cost'
import type { TicketFullDetails } from '../../../../shared/types'

interface Options {
  isOpen: boolean
  ticketDetails: TicketFullDetails | null
  /** Reloads the displayed ticket and the list (same flow as a status update) */
  onSaved?: () => void
}

/**
 * Add / edit / clear the parts cost of the displayed ticket (any status). The server recomputes the
 * shares of a delivered ticket with the percentage frozen at delivery; this hook only validates the
 * text, asks for a confirmation when the cost exceeds the price (a loss), and calls the API.
 */
export function usePartsCostEditor({ isOpen, ticketDetails, onSaved }: Options) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lossPending, setLossPending] = useState(false)

  const ticketId = ticketDetails?.ticket.id ?? null
  useEffect(() => {
    setOpen(false)
    setValue('')
    setSaving(false)
    setError(null)
    setLossPending(false)
  }, [isOpen, ticketId])

  const openEditor = (): void => {
    const current = ticketDetails?.ticket.parts_cost
    setValue(current === null || current === undefined ? '' : String(current))
    setError(null)
    setLossPending(false)
    setOpen(true)
  }
  const closeEditor = (): void => {
    setOpen(false)
    setError(null)
    setLossPending(false)
  }

  /** `cost` null clears the cost (back to "not entered yet"). */
  const persist = async (cost: number | null): Promise<void> => {
    if (!ticketDetails) return
    setSaving(true)
    setError(null)
    setLossPending(false)
    try {
      const res = await window.api.setPartsCost(ticketDetails.ticket.id, cost)
      if (res.success) {
        setOpen(false)
        toast.success(cost === null ? t.ui.partsCost.details.clearedToast : t.ui.partsCost.details.savedToast)
        onSaved?.()
      } else {
        setError(res.error || t.ui.partsCost.field.invalid)
      }
    } catch (err) {
      console.error('Failed to save the parts cost:', err)
      setError(err instanceof Error ? err.message : t.ui.partsCost.field.invalid)
    } finally {
      setSaving(false)
    }
  }

  const save = async (): Promise<void> => {
    if (!ticketDetails) return
    const parsed = parseCostInput(value)
    if (parsed.kind === 'invalid') {
      setError(t.ui.partsCost.field.invalid)
      return
    }
    if (parsed.kind === 'empty') {
      await persist(null)
      return
    }
    if (isCostLoss(parsed.value, ticketDetails.ticket.price)) {
      setLossPending(true)
      return
    }
    await persist(parsed.value)
  }

  const confirmLoss = async (): Promise<void> => {
    const parsed = parseCostInput(value)
    if (parsed.kind === 'ok') await persist(parsed.value)
  }

  return {
    open,
    value,
    setValue,
    saving,
    error,
    lossPending,
    cancelLoss: () => setLossPending(false),
    openEditor,
    closeEditor,
    save,
    clear: () => persist(null),
    confirmLoss
  }
}

export type PartsCostEditor = ReturnType<typeof usePartsCostEditor>
