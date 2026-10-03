import * as React from 'react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '../../lib/i18n'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/Card'
import { Input } from '../ui/Input'
import { formatCurrency, formatDate } from '../../lib/utils'
import { calculateProfitSplit } from '../../../shared/profit'
import type { TicketFullDetails, TicketStatus, PaymentType, UpdateTicketStatusDTO } from '../../../shared/types'
import {
  X,
  Printer,
  User,
  Phone,
  Smartphone,
  Clock,
  CheckCircle,
  PackageCheck,
  Coins,
  History,
  FileText,
  AlertTriangle,
  ArrowRightLeft,
  RotateCcw,
  Check,
  CreditCard,
  PieChart,
  Sparkles,
  Trash2
} from 'lucide-react'

export interface TicketDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  ticketDetails: TicketFullDetails | null
  onReprintClick: (ticket: TicketFullDetails) => void
  onStatusUpdated?: () => void
}

export function TicketDetailsModal({
  isOpen,
  onClose,
  ticketDetails,
  onReprintClick,
  onStatusUpdated
}: TicketDetailsModalProps): React.JSX.Element | null {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Delivery / Settlement Dialog State
  const [isDeliveryDialogOpen, setIsDeliveryDialogOpen] = useState(false)
  const [settlementType, setSettlementType] = useState<'full' | 'credit' | 'partial'>('full')
  const [customAdditionalPaid, setCustomAdditionalPaid] = useState<string>('')

  // 3-Step Delete Ticket Dialog State
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteStep, setDeleteStep] = useState<1 | 2 | 3>(1)
  const [confirmBarcode, setConfirmBarcode] = useState('')
  const [deleting, setDeleting] = useState(false)

  const openDeleteDialog = (): void => {
    setDeleteStep(1)
    setConfirmBarcode('')
    setErrorMessage(null)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteTicket = async (): Promise<void> => {
    if (!ticketDetails) return
    setDeleting(true)
    setErrorMessage(null)
    try {
      const res = await window.api.deleteTicket(ticketDetails.ticket.id)
      if (res.success) {
        setIsDeleteDialogOpen(false)
        onClose()
        onStatusUpdated?.()
      } else {
        setErrorMessage(res.error || t.deleteTicket.deleteError)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t.deleteTicket.deleteError)
    } finally {
      setDeleting(false)
    }
  }

  // Calculate live or stored profit split
  const profitSplit = React.useMemo(() => {
    if (!ticketDetails) {
      return {
        myShare: 0,
        partnerShare: 0,
        myPercentage: 0,
        partnerPercentage: 0,
        isPartnerExclusive: false
      }
    }
    const { ticket, category } = ticketDetails
    if (ticket.status === 'delivered' && ticket.my_share !== null && ticket.my_share !== undefined && ticket.partner_share !== null && ticket.partner_share !== undefined) {
      const isPartner = Boolean(ticket.technician_is_partner)
      return {
        myShare: ticket.my_share,
        partnerShare: ticket.partner_share,
        myPercentage: isPartner ? 0 : (category?.default_split_percentage ?? 50),
        partnerPercentage: isPartner ? 100 : Math.round((100 - (category?.default_split_percentage ?? 50)) * 100) / 100,
        isPartnerExclusive: isPartner
      }
    }
    return calculateProfitSplit({
      price: ticket.price,
      isPartner: Boolean(ticket.technician_is_partner),
      categorySplitPercentage: category?.default_split_percentage ?? 50.0
    })
  }, [ticketDetails])

  if (!isOpen || !ticketDetails) return null

  const { ticket, customer, device, category, accessories, statusLogs } = ticketDetails


  const getStatusBadge = (status: TicketStatus): React.JSX.Element => {
    switch (status) {
      case 'in_progress':
        return (
          <Badge variant="warning" className="gap-1 font-bold">
            <Clock className="h-3 w-3" />
            {t.status.in_progress}
          </Badge>
        )
      case 'ready':
        return (
          <Badge variant="success" className="gap-1 font-bold">
            <CheckCircle className="h-3 w-3" />
            {t.status.ready}
          </Badge>
        )
      case 'delivered':
        return (
          <Badge variant="secondary" className="gap-1">
            <PackageCheck className="h-3 w-3" />
            {t.status.delivered}
          </Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const handleUpdateStatus = async (newStatus: TicketStatus, paymentUpdate?: { amount_paid?: number; payment_type?: PaymentType }): Promise<void> => {
    setLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const dto: UpdateTicketStatusDTO = {
        ticketId: ticket.id,
        newStatus,
        paymentUpdate
      }

      const res = await window.api.updateTicketStatus(dto)
      if (res.success) {
        setSuccessMessage(t.lifecycle.statusUpdateSuccess)
        setIsDeliveryDialogOpen(false)
        if (onStatusUpdated) {
          onStatusUpdated()
        }
      } else {
        setErrorMessage(res.error || 'فشل في تحديث الحالة')
      }
    } catch (err) {
      console.error('Failed to update status:', err)
      setErrorMessage(err instanceof Error ? err.message : 'حدث خطأ أثناء تحديث الحالة')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmDelivery = async (): Promise<void> => {
    let paymentUpdate: { amount_paid?: number; payment_type?: PaymentType } | undefined = undefined

    if (ticket.amount_remaining > 0) {
      if (settlementType === 'full') {
        paymentUpdate = {
          amount_paid: ticket.price,
          payment_type: 'cash'
        }
      } else if (settlementType === 'credit') {
        paymentUpdate = {
          amount_paid: ticket.amount_paid,
          payment_type: 'credit'
        }
      } else if (settlementType === 'partial') {
        const additional = Number(customAdditionalPaid) || 0
        const newTotalPaid = Math.min(ticket.price, ticket.amount_paid + additional)
        paymentUpdate = {
          amount_paid: newTotalPaid,
          payment_type: newTotalPaid >= ticket.price ? 'cash' : 'credit'
        }
      }
    }

    await handleUpdateStatus('delivered', paymentUpdate)
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-full max-w-2xl max-h-[90vh] flex flex-col"
        >
          <Card className="shadow-2xl border-slate-300 bg-white overflow-hidden flex flex-col max-h-full">
            {/* Header */}
            <CardHeader className="bg-slate-50 border-b border-slate-200 pb-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-bold text-slate-900">
                        {t.ticketDetails.title} #{ticket.id}
                      </CardTitle>
                      {getStatusBadge(ticket.status)}
                    </div>
                    <CardDescription className="text-xs text-slate-500 font-mono mt-0.5">
                      {t.ticketDetails.ticketCode} <strong className="text-slate-800">{ticket.barcode_code}</strong>
                    </CardDescription>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>

            {/* Scrollable Body */}
            <CardContent className="space-y-5 pt-5 overflow-y-auto flex-1">
              {/* Error or Success alerts */}
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
              {successMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Overdue Alert Banner for Ready Tickets */}
              {ticket.status === 'ready' && ticketDetails.is_overdue && (
                <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-900 shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-sm text-amber-950">
                      {t.lifecycle.overdueWarningTitle}
                    </h4>
                    <p className="text-xs text-amber-800 mt-0.5">
                      {t.lifecycle.overdueWarningDesc.replace('{days}', String(ticketDetails.overdue_days || 0))}
                    </p>
                  </div>
                </div>
              )}

              {/* Lifecycle Actions Bar */}
              <div className="bg-slate-900 p-4 rounded-xl text-white shadow-md space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="h-4 w-4 text-indigo-400" />
                    <span>{t.lifecycle.statusActionTitle}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">الحالة: {t.status[ticket.status]}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* If in_progress -> Move to Ready */}
                  {ticket.status === 'in_progress' && (
                    <Button
                      type="button"
                      disabled={loading}
                      data-testid="status-to-ready"
                      onClick={() => handleUpdateStatus('ready')}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm flex-1"
                    >
                      <Check className="h-4 w-4 me-1.5" />
                      {t.lifecycle.markReady}
                    </Button>
                  )}

                  {/* If ready -> Move to Delivered */}
                  {ticket.status === 'ready' && (
                    <>
                      <Button
                        type="button"
                        disabled={loading}
                        data-testid="open-delivery"
                        onClick={() => setIsDeliveryDialogOpen(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-sm flex-1"
                      >
                        <PackageCheck className="h-4 w-4 me-1.5" />
                        {t.lifecycle.markDelivered}
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        disabled={loading}
                        data-testid="status-to-in-progress"
                        onClick={() => handleUpdateStatus('in_progress')}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs"
                        title={t.lifecycle.revertToInProgress}
                      >
                        <RotateCcw className="h-3.5 w-3.5 me-1" />
                        {t.lifecycle.revertToInProgress}
                      </Button>
                    </>
                  )}

                  {/* If delivered -> Revert to Ready if needed */}
                  {ticket.status === 'delivered' && (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                        <CheckCircle className="h-4 w-4" />
                        تم تسليم الجهاز وتوثيق توزيع الأرباح بنجاح.
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={loading}
                        data-testid="status-back-to-ready"
                        onClick={() => handleUpdateStatus('ready')}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5 me-1" />
                        {t.lifecycle.revertToReady}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Delivery & Payment Settlement Sub-Dialog WITH PROFIT SPLIT PREVIEW */}
              {isDeliveryDialogOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="bg-gradient-to-br from-blue-50/90 to-indigo-50/90 border-2 border-blue-300 p-5 rounded-2xl space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-blue-950 flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-blue-700" />
                      {t.lifecycle.confirmDeliveryTitle}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsDeliveryDialogOpen(false)}
                      className="text-slate-400 hover:text-slate-700 text-xs font-bold"
                    >
                      إلغاء
                    </button>
                  </div>

                  {/* PROMINENT PROFIT SPLIT BREAKDOWN (Rule 4 / Frontend Design Rule) */}
                  <div className="bg-white p-4 rounded-xl border border-indigo-200 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                        <PieChart className="h-4 w-4 text-indigo-600" />
                        <span>{t.profit.splitBreakdownTitle}</span>
                      </div>
                      {profitSplit.isPartnerExclusive ? (
                        <span className="text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-amber-600" />
                          {t.profit.partnerExclusiveBadge}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-500">
                          {t.profit.categorySplitNote
                            .replace('{mySplit}', String(profitSplit.myPercentage))
                            .replace('{partnerSplit}', String(profitSplit.partnerPercentage))}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      {/* My Share Card */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-700">{t.profit.ownerShareLabel}</span>
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-mono">
                            {profitSplit.myPercentage}%
                          </span>
                        </div>
                        <p className="text-base font-extrabold text-blue-700 font-mono">
                          {formatCurrency(profitSplit.myShare)}
                        </p>
                      </div>

                      {/* Partner Share Card */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-700">{t.profit.partnerShareLabel}</span>
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded font-mono">
                            {profitSplit.partnerPercentage}%
                          </span>
                        </div>
                        <p className="text-base font-extrabold text-purple-700 font-mono">
                          {formatCurrency(profitSplit.partnerShare)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Settlement Options */}
                  {ticket.amount_remaining > 0 ? (
                    <div className="space-y-3">
                      <div className="p-2.5 bg-white rounded-lg border border-blue-200 text-xs text-slate-800 flex items-center justify-between">
                        <span>{t.lifecycle.deliveryRemainingNotice}</span>
                        <strong className="text-amber-700 text-sm font-extrabold font-mono">
                          {formatCurrency(ticket.amount_remaining)}
                        </strong>
                      </div>

                      <div className="space-y-2">
                        {/* Option 1: Full Payment */}
                        <label className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                          <input
                            type="radio"
                            name="settlement"
                            checked={settlementType === 'full'}
                            onChange={() => setSettlementType('full')}
                            className="h-4 w-4 text-blue-600"
                          />
                          <div className="text-xs">
                            <span className="font-bold text-slate-900 block">{t.lifecycle.settleFullChoice}</span>
                            <span className="text-slate-500 text-[11px]">
                              دفع {formatCurrency(ticket.amount_remaining)} نقداً ليصبح المتبقي 0 د.ج
                            </span>
                          </div>
                        </label>

                        {/* Option 2: Credit / Debt */}
                        <label className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                          <input
                            type="radio"
                            name="settlement"
                            checked={settlementType === 'credit'}
                            onChange={() => setSettlementType('credit')}
                            className="h-4 w-4 text-blue-600"
                          />
                          <div className="text-xs">
                            <span className="font-bold text-slate-900 block">{t.lifecycle.creditChoice}</span>
                            <span className="text-slate-500 text-[11px]">
                              تسجيل باقي المبلغ ({formatCurrency(ticket.amount_remaining)}) كدين على الزبون
                            </span>
                          </div>
                        </label>

                        {/* Option 3: Partial */}
                        <label className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                          <input
                            type="radio"
                            name="settlement"
                            checked={settlementType === 'partial'}
                            onChange={() => setSettlementType('partial')}
                            className="h-4 w-4 text-blue-600"
                          />
                          <div className="text-xs flex-1">
                            <span className="font-bold text-slate-900 block">{t.lifecycle.settlePartialChoice}</span>
                            {settlementType === 'partial' && (
                              <div className="mt-2 flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max={ticket.amount_remaining}
                                  step="100"
                                  value={customAdditionalPaid}
                                  onChange={(e) => setCustomAdditionalPaid(e.target.value)}
                                  placeholder="أدخل المبلغ الإضافي المدفوع..."
                                  className="h-8 text-xs font-bold"
                                />
                                <span className="text-xs text-slate-600 whitespace-nowrap">د.ج</span>
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-100/60 rounded-lg text-xs text-emerald-900 font-semibold flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-700 flex-shrink-0" />
                      <span>الحساب مسدد بالكامل (خالص). هل تود تأكيد تسليم الجهاز وحفظ توزيع الأرباح؟</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsDeliveryDialogOpen(false)}
                      className="text-xs"
                    >
                      إلغاء
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={loading}
                      data-testid="confirm-delivery"
                      onClick={handleConfirmDelivery}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20"
                    >
                      {loading ? t.lifecycle.updatingStatus : t.lifecycle.confirmDeliveryButton}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Grid 1: Customer & Device */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-1">
                    <User className="h-4 w-4 text-blue-600" />
                    <span>{t.ticketDetails.customerInfo}</span>
                  </div>
                  <p className="text-sm font-extrabold text-slate-900">{customer.name}</p>
                  <p className="text-xs font-mono text-slate-600 flex items-center gap-1.5" dir="ltr">
                    <Phone className="h-3 w-3 text-slate-400" />
                    <span>{customer.phone}</span>
                  </p>
                  {customer.notes && (
                    <p className="text-xs text-slate-500 bg-white p-2 rounded-lg border border-slate-200 mt-2">
                      {customer.notes}
                    </p>
                  )}
                </div>

                {/* Device */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600 mb-1">
                    <Smartphone className="h-4 w-4 text-indigo-600" />
                    <span>{t.ticketDetails.deviceInfo}</span>
                  </div>
                  <p className="text-sm font-extrabold text-slate-900">
                    {device.brand} {device.model}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500 font-semibold">{t.ticketDetails.shortLabel}</span>
                    <span className="text-xs font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                      {device.short_label}
                    </span>
                  </div>
                  {/* Accessories */}
                  <div className="pt-1">
                    <span className="text-xs text-slate-500 block mb-1 font-semibold">{t.ticketDetails.accessories}</span>
                    {accessories.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {accessories.map((acc) => (
                          <span key={acc.id} className="text-[11px] bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold px-2 py-0.5 rounded">
                            {acc.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">{t.ticketDetails.noAccessories}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Grid 2: Repair & Financials */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Coins className="h-4 w-4 text-emerald-600" />
                    <span>{t.ticketDetails.repairInfo}</span>
                  </div>
                  {ticket.status === 'delivered' && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      الأرباح موثقة تاريخياً
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-start">
                  <div>
                    <span className="text-xs text-slate-500 block">{t.ticketDetails.category}</span>
                    <span className="text-xs font-bold text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 inline-block mt-0.5">
                      {category?.name || 'عام'}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block">{t.ticketDetails.technician}</span>
                    <span className="text-xs font-bold text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 inline-block mt-0.5">
                      {ticket.technician}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block">{t.ticketDetails.price}</span>
                    <span className="text-sm font-extrabold text-slate-900 block mt-0.5">
                      {formatCurrency(ticket.price)}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block">{t.ticketDetails.amountRemaining}</span>
                    <span className={`text-sm font-extrabold block mt-0.5 ${ticket.amount_remaining > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {ticket.amount_remaining > 0 ? formatCurrency(ticket.amount_remaining) : 'خالص'}
                    </span>
                  </div>
                </div>

                {/* Profit Split Row */}
                <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 font-semibold">{t.profit.ownerShareLabel}:</span>
                    <strong className="text-xs font-bold text-blue-700 font-mono">
                      {formatCurrency(profitSplit.myShare)} ({profitSplit.myPercentage}%)
                    </strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600 font-semibold">{t.profit.partnerShareLabel}:</span>
                    <strong className="text-xs font-bold text-purple-700 font-mono">
                      {formatCurrency(profitSplit.partnerShare)} ({profitSplit.partnerPercentage}%)
                    </strong>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-200 pt-2 font-medium">
                  <span>{t.ticketDetails.paymentType} <strong>{ticket.payment_type === 'cash' ? 'نقداً' : 'دين / آجل'}</strong></span>
                  <span>{t.ticketDetails.amountPaid} <strong>{formatCurrency(ticket.amount_paid)}</strong></span>
                  <span>{t.ticketDetails.createdAt} <strong>{formatDate(ticket.created_at)}</strong></span>
                </div>
              </div>

              {/* Status Timeline */}
              {statusLogs && statusLogs.length > 0 && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <History className="h-4 w-4 text-purple-600" />
                    <span>{t.ticketDetails.statusHistory}</span>
                  </div>
                  <div className="relative border-s-2 border-slate-200 ms-3 ps-4 space-y-3.5 py-1">
                    {statusLogs.map((log, index) => (
                      <div key={log.id || index} className="relative group">
                        <div className="absolute -start-[23px] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-600 shadow-sm" />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                          <div className="flex items-center gap-2 font-bold text-slate-800">
                            {log.old_status ? (
                              <>
                                <span className="text-slate-500 font-normal">{t.status[log.old_status] || log.old_status}</span>
                                <span className="text-slate-400">←</span>
                              </>
                            ) : null}
                            <span className="text-blue-700">
                              {t.status[log.new_status] || log.new_status}
                            </span>
                          </div>
                          <span className="text-slate-400 font-mono text-[11px]" dir="ltr">
                            {formatDate(log.timestamp)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>

            {/* Footer Actions */}
            <CardFooter className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  data-testid="details-close"
                  onClick={onClose}
                >
                  {t.ticketDetails.closeButton}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={openDeleteDialog}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 hover:border-red-300 font-semibold"
                >
                  <Trash2 className="h-4 w-4 me-1.5" />
                  {t.deleteTicket.buttonLabel}
                </Button>
              </div>

              <Button
                type="button"
                data-testid="details-reprint"
                onClick={() => onReprintClick(ticketDetails)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20"
              >
                <Printer className="h-4 w-4 me-2" />
                {t.ticketDetails.printLabelButton}
              </Button>
            </CardFooter>
          </Card>
        </motion.div>

        {/* 3-Step Delete Ticket Confirmation Modal */}
        <AnimatePresence>
          {isDeleteDialogOpen && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 15 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-lg"
              >
                <Card className="shadow-2xl border-red-200 bg-white overflow-hidden">
                  <CardHeader className="bg-red-50 border-b border-red-100 pb-3.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-xs">
                          <Trash2 className="h-5 w-5" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold text-red-950">
                            {t.deleteTicket.modalTitle}
                          </CardTitle>
                          <CardDescription className="text-xs text-red-700 font-semibold">
                            {deleteStep === 1 && t.deleteTicket.step1Title}
                            {deleteStep === 2 && t.deleteTicket.step2Title}
                            {deleteStep === 3 && t.deleteTicket.step3Title}
                          </CardDescription>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={deleting}
                        onClick={() => setIsDeleteDialogOpen(false)}
                        className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-red-100/50 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 space-y-4 text-start">
                    {/* Step Progress Dots */}
                    <div className="flex items-center justify-center gap-2 pb-1">
                      <div className={`h-2.5 rounded-full transition-all duration-200 ${deleteStep === 1 ? 'w-8 bg-red-600' : 'w-2.5 bg-slate-200'}`} />
                      <div className={`h-2.5 rounded-full transition-all duration-200 ${deleteStep === 2 ? 'w-8 bg-red-600' : 'w-2.5 bg-slate-200'}`} />
                      <div className={`h-2.5 rounded-full transition-all duration-200 ${deleteStep === 3 ? 'w-8 bg-red-600' : 'w-2.5 bg-slate-200'}`} />
                    </div>

                    {/* STEP 1: Details Review */}
                    {deleteStep === 1 && (
                      <div className="space-y-3.5">
                        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2.5">
                          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <span>{t.deleteTicket.step1Warning}</span>
                        </div>

                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-2">
                          <div className="font-bold text-slate-800 pb-1 border-b border-slate-200">
                            {t.deleteTicket.step1DetailsTitle}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-slate-600">
                            <div>
                              <span className="text-slate-400 block">{t.deleteTicket.step1Barcode}</span>
                              <span className="font-mono font-bold text-slate-800" dir="ltr">{ticket.barcode_code}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">{t.deleteTicket.step1Customer}</span>
                              <span className="font-bold text-slate-800">{customer.name}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">{t.deleteTicket.step1Device}</span>
                              <span className="font-bold text-slate-800">{device.brand} {device.model}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 block">{t.deleteTicket.step1Price}</span>
                              <span className="font-extrabold text-slate-900">{formatCurrency(ticket.price)}</span>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          {t.deleteTicket.step1Notice}
                        </p>
                      </div>
                    )}

                    {/* STEP 2: Financial Impact */}
                    {deleteStep === 2 && (
                      <div className="space-y-3.5">
                        <div className="p-3.5 bg-red-50 border-2 border-red-200 text-red-950 rounded-xl text-xs space-y-2">
                          <div className="flex items-center gap-2 font-bold text-red-800">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <span>{t.deleteTicket.step2WarningBadge}</span>
                          </div>
                          <p className="text-red-900 leading-relaxed">
                            {t.deleteTicket.step2FinancialNotice}
                          </p>
                        </div>

                        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs leading-relaxed">
                          {t.deleteTicket.step2CustomerCleanupNotice}
                        </div>

                        <p className="text-xs font-bold text-red-700">
                          {t.deleteTicket.step2IrreversibleNotice}
                        </p>
                      </div>
                    )}

                    {/* STEP 3: Type Confirmation */}
                    {deleteStep === 3 && (
                      <div className="space-y-3.5">
                        <p className="text-xs text-slate-700 font-medium">
                          {t.deleteTicket.step3Instruction}
                        </p>

                        <div className="p-2.5 bg-slate-100 rounded-lg text-center font-mono font-bold text-sm text-slate-900 border border-slate-300" dir="ltr">
                          {ticket.barcode_code}
                        </div>

                        <div className="space-y-1.5">
                          <Input
                            type="text"
                            dir="ltr"
                            value={confirmBarcode}
                            onChange={(e) => setConfirmBarcode(e.target.value)}
                            placeholder={t.deleteTicket.step3Placeholder}
                            className="font-mono text-center font-bold tracking-wider"
                            autoFocus
                          />
                          {confirmBarcode && confirmBarcode.trim() !== ticket.barcode_code.trim() && (
                            <span className="text-[11px] text-red-600 font-semibold block text-center">
                              {t.deleteTicket.step3BarcodeMismatch}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>

                  <CardFooter className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={deleting}
                      onClick={() => {
                        if (deleteStep > 1) {
                          setDeleteStep((prev) => (prev - 1) as 1 | 2 | 3)
                        } else {
                          setIsDeleteDialogOpen(false)
                        }
                      }}
                    >
                      {deleteStep === 1 ? t.deleteTicket.cancel : 'رجوع'}
                    </Button>

                    {deleteStep < 3 ? (
                      <Button
                        type="button"
                        onClick={() => setDeleteStep((prev) => (prev + 1) as 1 | 2 | 3)}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold"
                      >
                        {deleteStep === 1 ? t.deleteTicket.nextToStep2 : t.deleteTicket.nextToStep3}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        disabled={deleting || confirmBarcode.trim() !== ticket.barcode_code.trim()}
                        onClick={handleDeleteTicket}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-md shadow-red-500/20"
                      >
                        {deleting ? t.deleteTicket.deletingButton : t.deleteTicket.confirmDeleteButton}
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </AnimatePresence>
  )
}

