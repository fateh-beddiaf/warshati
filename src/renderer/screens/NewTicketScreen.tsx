import * as React from 'react'
import { useState } from 'react'
import { Loader2, PlusCircle, Save } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { Button } from '../components/ui/Button'
import { Skeleton } from '../components/ui/Skeleton'
import { PageHeader } from '../components/PageHeader'
import { PrintPreviewModal } from '../components/barcode/PrintPreviewModal'
import { useNewTicketForm } from './new-ticket/useNewTicketForm'
import { CustomerSection } from './new-ticket/CustomerSection'
import { DeviceSection } from './new-ticket/DeviceSection'
import { RepairSection } from './new-ticket/RepairSection'
import { PaymentSection } from './new-ticket/PaymentSection'
import { SuccessBanner, ErrorBanner } from './new-ticket/SuccessBanner'

interface NewTicketScreenProps {
  onTicketCreated: (ticketId: number) => void
}

function FormSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-52 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  )
}

export function NewTicketScreen({ onTicketCreated }: NewTicketScreenProps): React.JSX.Element {
  const { t } = useI18n()
  const form = useNewTicketForm()
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)

  return (
    <div className="space-y-6 pb-12">
      <PageHeader title={t.newTicket.title} subtitle={t.newTicket.subtitle} icon={<PlusCircle />} />

      {form.successInfo && (
        <SuccessBanner
          barcode={form.successInfo.barcode}
          onPrint={() => setIsPrintModalOpen(true)}
          onAnother={form.resetForm}
          onView={() => onTicketCreated(form.successInfo!.ticketId)}
        />
      )}

      {form.errorMessage && <ErrorBanner message={form.errorMessage} />}

      <form data-testid="new-ticket-form" onSubmit={form.handleSubmit} className="space-y-6">
        {form.metadata === null ? (
          <FormSkeleton />
        ) : (
          <>
            <CustomerSection form={form} />
            <DeviceSection form={form} />
            <RepairSection form={form} />
            <PaymentSection form={form} />
          </>
        )}

        <div className="flex justify-end pt-2">
          <Button type="submit" size="lg" disabled={form.loading || form.metadata === null} className="w-full min-w-[200px] md:w-auto">
            {form.loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            {form.loading ? t.newTicket.submittingButton : t.newTicket.submitButton}
          </Button>
        </div>
      </form>

      {form.printData && (
        <PrintPreviewModal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} data={form.printData} />
      )}
    </div>
  )
}
