import * as React from 'react'
import { RefreshCw, Smartphone } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { Autocomplete } from '../../components/ui/Autocomplete'
import { Field } from './Field'
import { SectionCard } from './SectionCard'
import { AccessoriesSection } from './AccessoriesSection'
import type { NewTicketForm } from './useNewTicketForm'

export function DeviceSection({ form }: { form: NewTicketForm }): React.JSX.Element {
  const { t } = useI18n()
  const brandMissing = form.showErrors && !form.brand.trim()
  const modelMissing = form.showErrors && !form.model.trim()

  return (
    <SectionCard
      icon={<Smartphone />}
      tone="progress"
      title={t.newTicket.deviceSection}
      description={t.ui.newTicket.device.hint}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={t.newTicket.brand} required>
          <Autocomplete
            options={form.brandOptions}
            value={form.brand}
            onChange={form.onBrandChange}
            placeholder={t.newTicket.selectBrand}
            allowCustomInput={true}
            error={brandMissing}
          />
        </Field>

        <Field label={t.newTicket.model} required>
          <Autocomplete
            options={form.modelOptions}
            value={form.model}
            onChange={form.onModelChange}
            placeholder={t.newTicket.selectModel}
            allowCustomInput={true}
            error={modelMissing}
          />
        </Field>
      </div>

      <Field label={t.newTicket.shortLabel} hint={t.newTicket.shortLabelHint}>
        <div className="flex gap-2">
          <Input
            type="text"
            value={form.shortLabel}
            onChange={(e) => form.onShortLabelChange(e.target.value)}
            placeholder={t.newTicket.shortLabelPlaceholder}
            className="font-semibold"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            title={t.ui.newTicket.actions.regenerateLabel}
            aria-label={t.ui.newTicket.actions.regenerateLabel}
            onClick={form.regenerateShortLabel}
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </Field>

      <AccessoriesSection form={form} />
    </SectionCard>
  )
}
