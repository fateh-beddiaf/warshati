import * as React from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { tapFeedback } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { Field } from './Field'
import type { NewTicketForm } from './useNewTicketForm'

/** Toggle chips for the accessories received with the device. */
export function AccessoriesSection({ form }: { form: NewTicketForm }): React.JSX.Element {
  const { t } = useI18n()
  const accessories = form.metadata?.accessories ?? []

  return (
    <Field label={t.newTicket.accessoriesSection} hint={t.ui.newTicket.accessories.hint}>
      {accessories.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t.ui.newTicket.accessories.empty}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {accessories.map((acc) => {
            const isSelected = form.selectedAccessoryIds.includes(acc.id)
            return (
              <motion.button
                key={acc.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => form.toggleAccessory(acc.id)}
                {...tapFeedback}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isSelected
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-card text-foreground hover:bg-accent'
                )}
              >
                {isSelected && <Check className="h-3.5 w-3.5" />}
                {acc.name}
              </motion.button>
            )
          })}
        </div>
      )}
    </Field>
  )
}
