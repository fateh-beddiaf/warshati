import * as React from 'react'
import { useState, useCallback } from 'react'
import { Layout } from './components/Layout'
import { NewTicketScreen } from './screens/NewTicketScreen'
import { TicketsListScreen } from './screens/TicketsListScreen'
import { ReportsScreen } from './screens/ReportsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TicketDetailsModal } from './components/tickets/TicketDetailsModal'
import { PrintPreviewModal } from './components/barcode/PrintPreviewModal'
import { useBarcodeScanner } from './hooks/useBarcodeScanner'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { DirectionProvider } from '@radix-ui/react-direction'
import { I18nProvider, useI18n } from './lib/i18n'
import { ThemeProvider } from './lib/theme'
import { TooltipProvider } from './components/ui/Tooltip'
import { Toaster } from './components/ui/Sonner'
import type { TicketFullDetails, TicketListItem } from '../shared/types'
import { AlertCircle } from 'lucide-react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { pageTransition, slideDown } from './lib/motion'

function AppContent(): React.JSX.Element {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<'tickets' | 'new-ticket' | 'reports' | 'settings'>('tickets')

  // Modals state
  const [selectedTicketDetails, setSelectedTicketDetails] = useState<TicketFullDetails | null>(null)
  const [isTicketDetailsOpen, setIsTicketDetailsOpen] = useState(false)

  const [printModalData, setPrintModalData] = useState<{
    barcode: string
    customerName: string
    shortLabel: string
    customerPhone?: string
    ticketId?: number
  } | null>(null)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)

  const [scanAlert, setScanAlert] = useState<string | null>(null)

  // Fetch and open ticket by barcode
  const handleBarcodeScanned = useCallback(
    async (scannedBarcode: string): Promise<void> => {
      try {
        const res = await window.api.getTicketByBarcode(scannedBarcode)
        if (res.success && res.data) {
          setSelectedTicketDetails(res.data)
          setIsTicketDetailsOpen(true)
          setScanAlert(null)
        } else if (!res.success && res.error) {
          setScanAlert(res.error)
          setTimeout(() => setScanAlert(null), 4000)
        } else {
          setScanAlert(`${t.scanner.ticketNotFound}: ${scannedBarcode}`)
          setTimeout(() => setScanAlert(null), 4000)
        }
      } catch (err) {
        console.error('Failed to query ticket by barcode:', err)
        setScanAlert(`${t.scanner.ticketNotFound}: ${scannedBarcode}`)
        setTimeout(() => setScanAlert(null), 4000)
      }
    },
    [t]
  )

  // Mount Dual-Approach Global Keyboard Listener for Henex Scanner
  useBarcodeScanner({
    onScan: handleBarcodeScanned,
    maxIntervalMs: 60,
    minLength: 6,
    prefix: 'WSH'
  })

  // Open ticket details by ID
  const handleOpenTicketDetails = async (ticketId: number): Promise<void> => {
    try {
      const res = await window.api.getTicketById(ticketId)
      if (res.success && res.data) {
        setSelectedTicketDetails(res.data)
        setIsTicketDetailsOpen(true)
      } else if (!res.success && res.error) {
        setScanAlert(res.error)
        setTimeout(() => setScanAlert(null), 4000)
      }
    } catch (err) {
      console.error('Failed to open ticket details:', err)
    }
  }

  // Open print preview from list
  const handlePrintTicket = (ticket: TicketListItem): void => {
    setPrintModalData({
      barcode: ticket.barcode_code,
      customerName: ticket.customer_name,
      shortLabel: ticket.short_label,
      customerPhone: ticket.customer_phone,
      ticketId: ticket.id
    })
    setIsPrintModalOpen(true)
  }

  // Open print preview from details modal
  const handleReprintFromDetails = (details: TicketFullDetails): void => {
    setPrintModalData({
      barcode: details.ticket.barcode_code,
      customerName: details.customer.name,
      shortLabel: details.device.short_label,
      customerPhone: details.customer.phone,
      ticketId: details.ticket.id
    })
    setIsPrintModalOpen(true)
  }

  const [listRefreshKey, setListRefreshKey] = useState(0)

  // Reload selected ticket details after status update
  const handleTicketStatusUpdated = async (): Promise<void> => {
    if (selectedTicketDetails) {
      try {
        const res = await window.api.getTicketById(selectedTicketDetails.ticket.id)
        if (res.success && res.data) {
          setSelectedTicketDetails(res.data)
        }
      } catch (err) {
        console.error('Failed to reload ticket after status update:', err)
      }
    }
    setListRefreshKey((prev) => prev + 1)
  }

  const handleTicketCreated = (ticketId: number): void => {
    handleOpenTicketDetails(ticketId)
    setActiveTab('tickets')
  }

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab} onManualBarcodeScan={handleBarcodeScanned}>
      {/* Toast Notification when barcode not found */}
      <AnimatePresence>
        {scanAlert && (
          <motion.div
            {...slideDown}
            role="status"
            data-testid="scan-alert"
            className="mb-4 flex items-center gap-2 rounded-xl border border-warning/25 bg-warning-soft p-3 text-xs font-bold text-warning-soft-foreground shadow-soft"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{scanAlert}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen Views */}
      {/* resetKey: switching tabs clears a previous crash without remounting (keeps exit animations) */}
      <ErrorBoundary scope={`screen:${activeTab}`} resetKey={activeTab}>
        <AnimatePresence mode="wait">
          {activeTab === 'tickets' && (
            <motion.div key="tickets" {...pageTransition}>
              <TicketsListScreen
                onNewTicketClick={() => setActiveTab('new-ticket')}
                onOpenTicketDetails={handleOpenTicketDetails}
                onPrintTicket={handlePrintTicket}
                refreshKey={listRefreshKey}
              />
            </motion.div>
          )}

          {activeTab === 'new-ticket' && (
            <motion.div key="new-ticket" {...pageTransition}>
              <NewTicketScreen onTicketCreated={handleTicketCreated} />
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div key="reports" {...pageTransition}>
              <ReportsScreen onOpenTicketDetails={handleOpenTicketDetails} />
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div key="settings" {...pageTransition}>
              <SettingsScreen />
            </motion.div>
          )}
        </AnimatePresence>
      </ErrorBoundary>

      {/* Ticket Details Modal */}
      <ErrorBoundary scope="ticket-details" resetKey={selectedTicketDetails?.ticket.id}>
        <TicketDetailsModal
          isOpen={isTicketDetailsOpen}
          onClose={() => setIsTicketDetailsOpen(false)}
          ticketDetails={selectedTicketDetails}
          onReprintClick={handleReprintFromDetails}
          onStatusUpdated={handleTicketStatusUpdated}
        />
      </ErrorBoundary>

      {/* Print / Reprint Preview Modal */}
      <ErrorBoundary scope="print-preview" resetKey={printModalData?.barcode}>
        <PrintPreviewModal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} data={printModalData} />
      </ErrorBoundary>
    </Layout>
  )
}

function Providers({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { dir } = useI18n()
  return (
    <DirectionProvider dir={dir}>
      {/* reducedMotion="user": Framer transform animations are skipped when the OS asks for less motion */}
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={300}>
          {children}
          <Toaster />
        </TooltipProvider>
      </MotionConfig>
    </DirectionProvider>
  )
}

export function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <I18nProvider>
        <Providers>
          <AppContent />
        </Providers>
      </I18nProvider>
    </ThemeProvider>
  )
}
