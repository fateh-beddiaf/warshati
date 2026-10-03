import { useState, useEffect } from 'react'

export interface OverdueThresholdState {
  threshold: number
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  input: string
  setInput: (value: string) => void
  /** Persists the typed value; calls `onSaved` after a valid save */
  save: (onSaved?: () => void) => Promise<void>
}

/**
 * The "ready but not picked up" threshold (days). It is a setting, not list data, so it is read
 * once on mount; the edit field is only re-synced while the panel is closed so a refetch can
 * never overwrite what the user is typing.
 */
export function useOverdueThreshold(): OverdueThresholdState {
  const [threshold, setThreshold] = useState<number>(3)
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('3')

  useEffect(() => {
    let cancelled = false
    window.api
      .getOverdueDays()
      .then((res) => {
        if (!cancelled && res.success && res.data !== undefined) setThreshold(res.data)
      })
      .catch((err) => console.error('Error fetching overdue threshold:', err))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isOpen) setInput(String(threshold))
  }, [threshold, isOpen])

  const save = async (onSaved?: () => void): Promise<void> => {
    const parsed = parseInt(input, 10)
    if (!isNaN(parsed) && parsed > 0) {
      await window.api.setSetting('overdue_ready_days', String(parsed))
      setThreshold(parsed)
      setIsOpen(false)
      onSaved?.()
    }
  }

  return { threshold, isOpen, setIsOpen, input, setInput, save }
}
