// Theme preference shared by main, preload and renderer. Pure (no Electron/DOM) so it is unit-testable.

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_SETTING_KEY = 'theme'
export const DEFAULT_THEME: ThemePreference = 'system'

/**
 * BrowserWindow background while the renderer boots. Must equal `--background`
 * in renderer/index.css (hsl(220 24% 96.5%) / hsl(226 24% 9%)) so there is no flash.
 */
export const THEME_BACKGROUND: Record<ResolvedTheme, string> = {
  light: '#f4f5f8',
  dark: '#11141c'
}

/** Argument names passed from main to the preload (via webPreferences.additionalArguments). */
export const THEME_ARG_PREFERENCE = '--warshati-theme-pref='
export const THEME_ARG_RESOLVED = '--warshati-theme-resolved='

export function normalizeThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT_THEME
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}
