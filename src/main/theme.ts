import { BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { dbService } from '../database'
import {
  THEME_BACKGROUND,
  THEME_SETTING_KEY,
  normalizeThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference
} from '../shared/theme'

export function loadThemePreference(): ThemePreference {
  try {
    return normalizeThemePreference(dbService.getSetting(THEME_SETTING_KEY, ''))
  } catch {
    return normalizeThemePreference(undefined)
  }
}

export function currentResolvedTheme(preference: ThemePreference): ResolvedTheme {
  return resolveTheme(preference, nativeTheme.shouldUseDarkColors)
}

let activePreference: ThemePreference = 'system'

function syncWindowBackgrounds(): void {
  const resolved = currentResolvedTheme(activePreference)
  for (const win of BrowserWindow.getAllWindows()) {
    win.setBackgroundColor(THEME_BACKGROUND[resolved])
  }
}

/**
 * Pointing nativeTheme.themeSource at the preference makes the renderer's
 * `prefers-color-scheme` media query follow it too (and "system" tracks the OS live).
 */
export function applyThemePreference(preference: ThemePreference): ResolvedTheme {
  activePreference = preference
  nativeTheme.themeSource = preference
  syncWindowBackgrounds()
  return currentResolvedTheme(preference)
}

export function registerThemeHandlers(): void {
  nativeTheme.on('updated', syncWindowBackgrounds)

  ipcMain.handle('theme:get', async () => {
    return {
      success: true,
      data: { preference: activePreference, resolved: currentResolvedTheme(activePreference) }
    }
  })

  ipcMain.handle('theme:set', async (_event, value: unknown) => {
    try {
      const preference = normalizeThemePreference(value)
      dbService.setSetting(THEME_SETTING_KEY, preference)
      const resolved = applyThemePreference(preference)
      return { success: true, data: { preference, resolved } }
    } catch (error: unknown) {
      console.error('Failed to set theme:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Failed to set theme' }
    }
  })
}
