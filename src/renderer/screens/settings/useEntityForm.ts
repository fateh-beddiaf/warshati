import { useCallback, useState } from 'react'

/** State of an add/edit dialog for a simple named entity (brand, model, accessory, technician, category). */
export function useEntityForm<T extends { id: number; name: string }>(): {
  open: boolean
  editing: T | null
  name: string
  saving: boolean
  setName: (name: string) => void
  setSaving: (saving: boolean) => void
  openCreate: () => void
  openEdit: (item: T) => void
  /** Closes the dialog and resets the form (called after a save attempt) */
  finish: () => void
  onOpenChange: (open: boolean) => void
} {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const openCreate = useCallback(() => {
    setEditing(null)
    setName('')
    setOpen(true)
  }, [])

  const openEdit = useCallback((item: T) => {
    setEditing(item)
    setName(item.name)
    setOpen(true)
  }, [])

  const finish = useCallback(() => {
    setOpen(false)
    setEditing(null)
    setName('')
    setSaving(false)
  }, [])

  const onOpenChange = useCallback((next: boolean) => setOpen(next), [])

  return { open, editing, name, saving, setName, setSaving, openCreate, openEdit, finish, onOpenChange }
}
