import * as React from 'react'
import { Wrench } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { MaskedAmountInput } from '../../components/parts-cost/MaskedAmountInput'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/Select'
import { Field } from './Field'
import { SectionCard } from './SectionCard'
import type { NewTicketForm } from './useNewTicketForm'

export type RepairSectionForm = Pick<
  NewTicketForm,
  | 'metadata'
  | 'categoryId'
  | 'setCategoryId'
  | 'technicianId'
  | 'setTechnicianId'
  | 'showPartsCost'
  | 'partsCost'
  | 'setPartsCost'
  | 'showErrors'
  | 'costInvalid'
>

/**
 * Repair category + responsible technician (+ the masked parts cost when `showPartsCost`).
 * `layoutGroup` keeps the technician toggle's moving highlight apart from another mounted form.
 */
export function RepairSection({
  form,
  layoutGroup = 'new-ticket-technician',
  costTestId = 'parts-cost-input'
}: {
  form: RepairSectionForm
  layoutGroup?: string
  /** data-testid of the masked cost box (two forms can be mounted at once) */
  costTestId?: string
}): React.JSX.Element {
  const { t } = useI18n()
  const categories = form.metadata?.repairCategories ?? []
  const technicians = form.metadata?.technicians ?? []

  return (
    <SectionCard
      icon={<Wrench />}
      tone="warning"
      title={t.newTicket.repairSection}
      description={t.ui.newTicket.repair.hint}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={t.newTicket.repairCategory} required>
          <Select
            value={form.categoryId === '' ? '' : String(form.categoryId)}
            onValueChange={(v) => form.setCategoryId(Number(v))}
          >
            <SelectTrigger data-testid="repair-category" aria-label={t.newTicket.repairCategory}>
              <SelectValue placeholder={t.newTicket.selectCategory} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={String(cat.id)}>
                  {cat.name} ({t.ui.newTicket.repair.categoryShare}: {cat.default_split_percentage}%)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t.newTicket.technician}>
          <SegmentedControl
            layoutGroup={layoutGroup}
            ariaLabel={t.newTicket.technician}
            className="w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:py-2 [&>button]:text-sm"
            items={technicians.map((tech) => ({
              value: String(tech.id),
              label: tech.name,
              testId: `technician-${tech.id}`
            }))}
            value={form.technicianId === null ? '' : String(form.technicianId)}
            onChange={(v) => form.setTechnicianId(Number(v))}
          />
        </Field>

        {/* New ticket: only for categories that require a parts cost. Masked: the customer may see the screen. */}
        {form.showPartsCost && (
          <Field
            label={t.ui.partsCost.newTicket.label}
            hint={t.ui.partsCost.newTicket.optional}
            className="md:col-span-1"
          >
            <MaskedAmountInput
              testId={costTestId}
              ariaLabel={t.ui.partsCost.newTicket.label}
              placeholder={t.ui.partsCost.newTicket.placeholder}
              value={form.partsCost}
              onChange={form.setPartsCost}
              error={form.showErrors && form.costInvalid}
            />
          </Field>
        )}
      </div>
    </SectionCard>
  )
}
