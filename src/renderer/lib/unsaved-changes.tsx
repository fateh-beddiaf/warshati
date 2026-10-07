import * as React from 'react'
import { createContext, useContext, useEffect, useId, useMemo, useRef } from 'react'

/**
 * Forms with unsaved changes (the New Ticket form, the edit-ticket form) register here, so that something that would
 * replace them (a scanned label opening another ticket) can ask first instead of silently dropping what was typed.
 */
export interface UnsavedChangesRegistry {
  hasUnsavedChanges: () => boolean
  /** Throws away every registered form's changes (each form decides what "discard" means for it) */
  discardAll: () => void
}

interface RegistryWithSet extends UnsavedChangesRegistry {
  set: (id: string, discard: (() => void) | null) => void
}

const UnsavedChangesContext = createContext<RegistryWithSet | null>(null)

/** Wraps the app once: forms register here, the scan handler asks it. */
export function UnsavedChangesProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const entries = useRef(new Map<string, () => void>())
  const registry = useMemo<RegistryWithSet>(
    () => ({
      set: (id, discard) => {
        if (discard) entries.current.set(id, discard)
        else entries.current.delete(id)
      },
      hasUnsavedChanges: () => entries.current.size > 0,
      discardAll: () => {
        for (const discard of [...entries.current.values()]) discard()
        entries.current.clear()
      }
    }),
    []
  )
  return <UnsavedChangesContext.Provider value={registry}>{children}</UnsavedChangesContext.Provider>
}

/** For whatever would replace a form (the scan handler): are there unsaved changes, and throw them away. */
export function useUnsavedChangesRegistry(): UnsavedChangesRegistry {
  const registry = useContext(UnsavedChangesContext)
  if (!registry) throw new Error('useUnsavedChangesRegistry needs <UnsavedChangesProvider>')
  return registry
}

/** A form calls this with whether it holds unsaved changes and how to throw them away. */
export function useUnsavedChanges(dirty: boolean, discard: () => void): void {
  const registry = useContext(UnsavedChangesContext)
  const id = useId()
  const discardRef = useRef(discard)
  useEffect(() => {
    discardRef.current = discard
  })
  useEffect(() => {
    if (!registry || !dirty) return
    registry.set(id, () => discardRef.current())
    return () => registry.set(id, null)
  }, [registry, id, dirty])
}
