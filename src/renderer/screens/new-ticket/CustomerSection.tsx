import * as React from 'react'
import { User } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Autocomplete } from '../../components/ui/Autocomplete'
import { Field } from './Field'
import { SectionCard } from './SectionCard'
import type { NewTicketForm } from './useNewTicketForm'
import { Mono } from '../../components/ui/Mono'

export function CustomerSection({ form }: { form: NewTicketForm }): React.JSX.Element {
  const { t } = useI18n()
  const nameMissing = form.showErrors && !form.customerName.trim()
  const phoneMissing = form.showErrors && !form.customerPhone.trim()

  return (
    <SectionCard
      icon={<User />}
      title={t.newTicket.customerSection}
      description={t.ui.newTicket.customer.hint}
      aside={
        form.customerId ? (
          <Badge variant="success">{t.newTicket.existingCustomerBadge}</Badge>
        ) : (
          <Badge variant="secondary">{t.newTicket.newCustomerBadge}</Badge>
        )
      }
    >
      <Field label={t.newTicket.customerName} required>
        <Autocomplete
          options={form.customerOptions}
          value={form.customerName}
          onChange={form.onNameChange}
          placeholder={t.newTicket.namePlaceholder}
          allowCustomInput={true}
          error={nameMissing}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={t.newTicket.customerPhone} required>
          <Input
            type="text"
            dir="ltr"
            value={form.customerPhone}
            onChange={(e) => form.onPhoneChange(e.target.value)}
            placeholder={t.newTicket.phonePlaceholder}
            error={phoneMissing}
            mono className="tabular text-start"
          />
          {form.phoneMatches.length > 0 && (
            <div className="mt-2 space-y-1" data-testid="phone-matches">
              <p className="text-[11px] font-semibold text-muted-foreground">{t.newTicket.phoneMatches}</p>
              {form.phoneMatches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  data-testid="phone-match"
                  onClick={() => form.selectPhoneMatch(c)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-start text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="font-semibold text-foreground">{c.name}</span>
                  <Mono className="text-muted-foreground">
                    {c.phone}
                  </Mono>
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field label={t.newTicket.customerNotes}>
          <Input
            type="text"
            value={form.customerNotes}
            onChange={(e) => form.setCustomerNotes(e.target.value)}
            placeholder={t.newTicket.notesPlaceholder}
          />
        </Field>
      </div>
    </SectionCard>
  )
}
