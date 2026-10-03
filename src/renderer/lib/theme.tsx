import * as React from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_THEME,
  normalizeThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference
} from '@shared/theme'

interface ThemeContextType {
  /** What the user chose: light / dark / system */
  preference: ThemePreference
  /** What is actually shown right now (system is resolved against the OS) */
  resolvedTheme: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

const ThemeContext = createContext<ThemeContextType>({
  preference: DEFAULT_THEME,
  resolvedTheme: 'light',
  setPreference: () => {}
})

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** The preload already set the class from the saved setting before the first paint; read it back. */
function initialResolvedTheme(): ResolvedTheme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function applyToDocument(resolved: ResolvedTheme): void {
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_THEME)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(initialResolvedTheme)

  // Load the saved preference (persisted in the Setting table by the main process)
  useEffect(() => {
    let cancelled = false
    window.api
      ?.getTheme?.()
      .then((res) => {
        if (cancelled || !res.success || !res.data) return
        setPreferenceState(normalizeThemePreference(res.data.preference))
        setResolvedTheme(res.data.resolved)
      })
      .catch((err) => console.warn('Failed to load theme preference:', err))
    return () => {
      cancelled = true
    }
  }, [])

  // In "system" mode follow the OS live (main also points nativeTheme at the preference,
  // so this media query already reflects light/dark choices)
  useEffect(() => {
    if (preference !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (): void => setResolvedTheme(resolveTheme('system', media.matches))
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [preference])

  useEffect(() => {
    applyToDocument(resolvedTheme)
  }, [resolvedTheme])

  const setPreference = useCallback((next: ThemePreference): void => {
    setPreferenceState(next)
    // Optimistic: flip immediately, main then confirms/persists
    setResolvedTheme(resolveTheme(next, systemPrefersDark()))
    window.api
      ?.setTheme?.(next)
      .then((res) => {
        if (res.success && res.data) setResolvedTheme(res.data.resolved)
      })
      .catch((err) => console.warn('Failed to save theme preference:', err))
  }, [])

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme, setPreference]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext)
}
