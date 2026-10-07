import * as React from 'react'
import { Info, Undo2, User, UserRoundCog } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { Input } from '../../ui/Input'
import { Button } from '../../ui/Button'
import { Field } from '../../../screens/new-ticket/Field'
import { SectionCard } from '../../../screens/new-ticket/SectionCard'
import { CustomerSection } from '../../../screens/new-ticket/CustomerSection'
import type { TicketFullDetails } from '../../../../shared/types'
import type { TicketEditForm } from './useTicketEditForm'

/**
 * Customer part of the edit form. By default it edits the Customer record itself (the change shows on every ticket
 * of that customer, and the count says how many). If the ticket was simply given to the wrong customer, the user
 * switches to "attach to another customer": the New Ticket customer picker, with its matching rules.
 */
export function CustomerEditSection({
  form,
  details
}: {
  form: TicketEditForm
  details: TicketFullDetails
}): React.JSX.Element {
  const { t } = useI18n()
  const text = t.ui.editTicket

  if (form.customerMode === 'reassign') {
    return (
      <CustomerSection
        form={form.reassign}
        title={text.reassignTitle}
        description={text.reassignHint.replace('{name}', details.customer.name)}
      >
        <Button
          type="button"
          variant="ghost"
          size="sm"
          data-testid="edit-customer-cancel-reassign"
          onClick={form.cancelReassign}
          className="gap-1.5 text-xs"
        >
          <Undo2 className="h-3.5 w-3.5" />
          {text.backToEdit}
        </Button>
      </CustomerSection>
    )
  }

  const count = details.customerTicketCount
  const nameMissing = form.showErrors && !form.customerName.trim()
  const phoneMissing = form.showErrors && !form.customerPhone.trim()

  return (
    <SectionCard icon={<User />} title={t.newTicket.customerSection} description={text.customerEditHint}>
      <Field label={t.newTicket.customerName} required>
        <Input
          type="text"
          data-testid="edit-customer-name"
          value={form.customerName}
          onChange={(e) => form.setCustomerName(e.target.value)}
          error={nameMissing}
        />
      </Field>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={t.newTicket.customerPhone} required>
          <Input
            type="text"
            dir="ltr"
            data-testid="edit-customer-phone"
            value={form.customerPhone}
            onChange={(e) => form.setCustomerPhone(e.target.value)}
            error={phoneMissing}
            mono
            className="tabular text-start"
          />
        </Field>
        <Field label={t.newTicket.customerNotes}>
          <Input
            type="text"
            data-testid="edit-customer-notes"
            value={form.customerNotes}
            onChange={(e) => form.setCustomerNotes(e.target.value)}
            placeholder={t.newTicket.notesPlaceholder}
          />
        </Field>
      </div>

      <p
        data-testid="edit-customer-ticket-count"
        className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-2.5 text-xs font-medium text-muted-foreground"
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
        <span>{count > 1 ? text.ticketCountMany.replace('{count}', String(count)) : text.ticketCountOne}</span>
      </p>

      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="edit-customer-reassign"
        onClick={form.startReassign}
        className="gap-1.5 text-xs"
      >
        <UserRoundCog className="h-3.5 w-3.5" />
        {text.wrongCustomer}
      </Button>
    </SectionCard>
  )
}
