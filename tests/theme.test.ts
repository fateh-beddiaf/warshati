import { normalizeThemePreference, resolveTheme, THEME_BACKGROUND, DEFAULT_THEME } from '../src/shared/theme'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ Assertion failed: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
  console.log(`✅ Passed: ${message}`)
}

console.log('--- Theme preference helpers ---')

assert(normalizeThemePreference('dark') === 'dark', 'dark is accepted')
assert(normalizeThemePreference('light') === 'light', 'light is accepted')
assert(normalizeThemePreference('system') === 'system', 'system is accepted')
assert(normalizeThemePreference('') === DEFAULT_THEME, 'empty value falls back to the default')
assert(normalizeThemePreference('blue') === DEFAULT_THEME, 'unknown value falls back to the default')
assert(normalizeThemePreference(undefined) === DEFAULT_THEME, 'undefined falls back to the default')
assert(DEFAULT_THEME === 'system', 'default follows the OS')

assert(resolveTheme('system', true) === 'dark', 'system + dark OS => dark')
assert(resolveTheme('system', false) === 'light', 'system + light OS => light')
assert(resolveTheme('light', true) === 'light', 'explicit light wins over a dark OS')
assert(resolveTheme('dark', false) === 'dark', 'explicit dark wins over a light OS')

assert(/^#[0-9a-f]{6}$/.test(THEME_BACKGROUND.light), 'light window background is a hex colour')
assert(/^#[0-9a-f]{6}$/.test(THEME_BACKGROUND.dark), 'dark window background is a hex colour')
assert(THEME_BACKGROUND.light !== THEME_BACKGROUND.dark, 'light and dark backgrounds differ')

process.exit(0)
