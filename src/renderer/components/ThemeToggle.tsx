import * as React from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { useTheme } from '../lib/theme'
import { Button } from './ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from './ui/DropdownMenu'
import type { ThemePreference } from '@shared/theme'

/** Quick light/dark/system switch for the app header. */
export function ThemeToggle(): React.JSX.Element {
  const { t } = useI18n()
  const { preference, resolvedTheme, setPreference } = useTheme()
  const Icon = resolvedTheme === 'dark' ? Moon : Sun

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={t.theme.toggle}
          title={t.theme.toggle}
          data-testid="theme-toggle"
        >
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={preference} onValueChange={(v) => setPreference(v as ThemePreference)}>
          <DropdownMenuRadioItem value="light" data-testid="theme-menu-light">
            <Sun />
            {t.theme.light}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" data-testid="theme-menu-dark">
            <Moon />
            {t.theme.dark}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" data-testid="theme-menu-system">
            <Monitor />
            {t.theme.system}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
