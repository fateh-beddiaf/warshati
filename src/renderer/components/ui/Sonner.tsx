import * as React from 'react'
import { Toaster as SonnerToaster, toast } from 'sonner'
import { useTheme } from '../../lib/theme'
import { useI18n } from '../../lib/i18n'

/** App-wide toast host, styled with the design tokens and following the resolved theme. */
export function Toaster(): React.JSX.Element {
  const { resolvedTheme } = useTheme()
  const { dir } = useI18n()
  return (
    <SonnerToaster
      theme={resolvedTheme}
      dir={dir}
      position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'}
      closeButton
      toastOptions={{
        classNames: {
          toast: 'group !rounded-xl !border !border-border !bg-popover !text-popover-foreground !shadow-pop !font-sans',
          description: '!text-muted-foreground',
          success: '!border-success/40',
          error: '!border-danger/40',
          warning: '!border-warning/40'
        }
      }}
    />
  )
}

export { toast }
