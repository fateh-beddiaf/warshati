import * as React from 'react'
import { useState, useEffect } from 'react'
import { useI18n } from '../lib/i18n'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Autocomplete, type AutocompleteOption } from '../components/ui/Autocomplete'
import { generateShortLabel } from '../../shared/device-utils'
import type { AppMetadata, Brand, Customer, CreateTicketDTO, Model, PaymentType } from '../../database/types'
import {
  User,
  Smartphone,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  Coins,
  Printer
} from 'lucide-react'
import { PrintPreviewModal } from '../components/barcode/PrintPreviewModal'

interface NewTicketScreenProps {
  onTicketCreated: (ticketId: number) => void
}

export function NewTicketScreen({ onTicketCreated }: NewTicketScreenProps): React.JSX.Element {
  const { t } = useI18n()
  const [metadata, setMetadata] = useState<AppMetadata | null>(null)

  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [successInfo, setSuccessInfo] = useState<{ barcode: string; ticketId: number } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)

  // Form State
  const [customerId, setCustomerId] = useState<number | undefined>(undefined)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')

  const [brand, setBrand] = useState('')
  const [brandId, setBrandId] = useState<number | null>(null)
  const [model, setModel] = useState('')
  const [modelId, setModelId] = useState<number | null>(null)
  const [shortLabel, setShortLabel] = useState('')
  const [isShortLabelEdited, setIsShortLabelEdited] = useState(false)

  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [price, setPrice] = useState<string>('')
  const [amountPaid, setAmountPaid] = useState<string>('')
  const [paymentType, setPaymentType] = useState<PaymentType>('cash')
  const [technicianId, setTechnicianId] = useState<number | null>(null)
  const [selectedAccessoryIds, setSelectedAccessoryIds] = useState<number[]>([])

  // Load initial metadata and customers list
  useEffect(() => {
    async function loadData(): Promise<void> {
      try {
        const metaRes = await window.api.getMetadata()
        if (metaRes.success && metaRes.data) {
          setMetadata(metaRes.data)
          if (metaRes.data.repairCategories.length > 0) {
            setCategoryId(metaRes.data.repairCategories[0].id)
          }
          if (metaRes.data.technicians.length > 0) {
            setTechnicianId(metaRes.data.technicians[0].id)
          }
        }

        const custRes = await window.api.searchCustomers('')
        if (custRes.success && custRes.data) {
          setExistingCustomers(custRes.data)
        }
      } catch (err) {
        console.error('Failed to load initial data:', err)
      }
    }
    loadData()
  }, [])

  // Auto-generate short_label when brand or model changes if not manually overridden
  useEffect(() => {
    if (!isShortLabelEdited) {
      const generated = generateShortLabel(brand, model)
      setShortLabel(generated)
    }
  }, [brand, model, isShortLabelEdited])

  // Compute remaining amount
  const numPrice = Number(price) || 0
  const numPaid = Number(amountPaid) || 0
  const calculatedRemaining = Math.max(0, numPrice - numPaid)

  // Filtered models based on selected brand
  const selectedBrandObj = metadata?.brands.find((b) => b.id === brandId)
  const availableModels = metadata?.models.filter((m) =>
    selectedBrandObj ? m.brand_id === selectedBrandObj.id : true
  ) || []

  // Customer options for search
  const customerOptions: AutocompleteOption[] = existingCustomers.map((c) => ({
    value: c.id,
    label: c.name,
    sublabel: c.phone,
    data: c
  }))

  const brandOptions: AutocompleteOption[] = (metadata?.brands || []).map((b) => ({
    value: b.name,
    label: b.name,
    data: b
  }))

  const modelOptions: AutocompleteOption[] = availableModels.map((m) => ({
    value: m.name,
    label: m.name,
    data: m
  }))

  const handleCustomerSelect = (_val: string, option?: AutocompleteOption): void => {
    if (option && option.data) {
      const c = option.data as Customer
      setCustomerId(c.id)
      setCustomerName(c.name)
      setCustomerPhone(c.phone)
      setCustomerNotes(c.notes || '')
    } else {
      setCustomerId(undefined)
    }
  }

  const handleAccessoryToggle = (id: number): void => {
    setSelectedAccessoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const resetForm = (): void => {
    setCustomerId(undefined)
    setCustomerName('')
    setCustomerPhone('')
    setCustomerNotes('')
    setBrand('')
    setBrandId(null)
    setModel('')
    setModelId(null)
    setShortLabel('')
    setIsShortLabelEdited(false)
    setPrice('')
    setAmountPaid('')
    setPaymentType('cash')
    setSelectedAccessoryIds([])
    setSuccessInfo(null)
    setErrorMessage(null)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setErrorMessage(null)

    // Validation
    if (!customerName.trim() || !customerPhone.trim() || !brand.trim() || !model.trim() || !categoryId || !technicianId) {
      setErrorMessage(t.newTicket.requiredFieldsError)
      return
    }

    setLoading(true)

    const dto: CreateTicketDTO = {
      customer: {
        id: customerId,
        name: customerName.trim(),
        phone: customerPhone.trim(),
        notes: customerNotes.trim() || undefined
      },
      device: {
        brand: brand.trim(),
        model: model.trim(),
        brand_id: brandId ?? undefined,
        model_id: modelId ?? undefined,
        short_label: shortLabel.trim() || undefined
      },
      ticket: {
        repair_category_id: Number(categoryId),
        price: numPrice,
        payment_type: paymentType,
        amount_paid: numPaid,
        technician_id: technicianId
      },
      accessory_ids: selectedAccessoryIds
    }

    try {
      const res = await window.api.createTicket(dto)
      if (res.success && res.data) {
        setSuccessInfo({
          barcode: res.data.barcode,
          ticketId: res.data.ticketId
        })
      } else {
        setErrorMessage(res.error || t.newTicket.errorTitle)
      }
    } catch (err) {
      console.error('Error creating ticket:', err)
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {t.newTicket.title}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">{t.newTicket.subtitle}</p>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successInfo && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-900 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-7 w-7 text-emerald-600 flex-shrink-0" />
            <div>
              <h4 className="font-bold text-base">{t.newTicket.successTitle}</h4>
              <p className="text-sm text-emerald-700">
                {t.newTicket.successBarcode}{' '}
                <span className="font-mono font-bold bg-emerald-200/80 px-2 py-0.5 rounded text-emerald-900">
                  {successInfo.barcode}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-bold"
            >
              <Printer className="h-4 w-4 me-1.5" />
              طباعة الملصق
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="bg-white border border-emerald-200 text-emerald-900 hover:bg-emerald-100"
              onClick={resetForm}
            >
              <Plus className="h-4 w-4 me-1.5" />
              تذكرة أخرى
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-emerald-300 text-emerald-800 hover:bg-emerald-100"
              onClick={() => onTicketCreated(successInfo.ticketId)}
            >
              عرض في القائمة
            </Button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 flex items-center gap-3 shadow-sm">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <p className="text-sm font-semibold">{errorMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Customer Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
                <CardTitle>{t.newTicket.customerSection}</CardTitle>
              </div>
              {customerId ? (
                <Badge variant="success">{t.newTicket.existingCustomerBadge}</Badge>
              ) : (
                <Badge variant="secondary">{t.newTicket.newCustomerBadge}</Badge>
              )}
            </div>
            <CardDescription>{t.newTicket.searchCustomerPlaceholder}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t.newTicket.customerName} <span className="text-red-500">*</span>
              </label>
              <Autocomplete
                options={customerOptions}
                value={customerName}
                onChange={(val, opt) => {
                  setCustomerName(val)
                  handleCustomerSelect(val, opt)
                }}
                placeholder={t.newTicket.namePlaceholder}
                allowCustomInput={true}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.newTicket.customerPhone} <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  dir="ltr"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder={t.newTicket.phonePlaceholder}
                  className="text-start font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.newTicket.customerNotes}
                </label>
                <Input
                  type="text"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder={t.newTicket.notesPlaceholder}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Device Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <Smartphone className="h-4 w-4" />
              </div>
              <CardTitle>{t.newTicket.deviceSection}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.newTicket.brand} <span className="text-red-500">*</span>
                </label>
                <Autocomplete
                  options={brandOptions}
                  value={brand}
                  onChange={(val, option) => {
                    setBrand(val)
                    setBrandId(option ? (option.data as Brand).id : null)
                    setModel('')
                    setModelId(null)
                  }}
                  placeholder={t.newTicket.selectBrand}
                  allowCustomInput={true}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.newTicket.model} <span className="text-red-500">*</span>
                </label>
                <Autocomplete
                  options={modelOptions}
                  value={model}
                  onChange={(val, option) => {
                    setModel(val)
                    setModelId(option ? (option.data as Model).id : null)
                  }}
                  placeholder={t.newTicket.selectModel}
                  allowCustomInput={true}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {t.newTicket.shortLabel}
                </label>
                <span className="text-xs text-slate-400">{t.newTicket.shortLabelHint}</span>
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={shortLabel}
                  onChange={(e) => {
                    setShortLabel(e.target.value)
                    setIsShortLabelEdited(true)
                  }}
                  placeholder={t.newTicket.shortLabelPlaceholder}
                  className="font-semibold text-slate-800"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="إعادة توليد المسمى التلقائي"
                  onClick={() => {
                    setIsShortLabelEdited(false)
                    setShortLabel(generateShortLabel(brand, model))
                  }}
                >
                  <RefreshCw className="h-4 w-4 text-slate-600" />
                </Button>
              </div>
            </div>

            {/* Accessories Chips */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                {t.newTicket.accessoriesSection}
              </label>
              <div className="flex flex-wrap gap-2">
                {(metadata?.accessories || []).map((acc) => {
                  const isSelected = selectedAccessoryIds.includes(acc.id)
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleAccessoryToggle(acc.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {acc.name}
                    </button>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Repair & Financial Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Wrench className="h-4 w-4" />
              </div>
              <CardTitle>{t.newTicket.repairSection}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.newTicket.repairCategory} <span className="text-red-500">*</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(Number(e.target.value))}
                  className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {(metadata?.repairCategories || []).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} (نسبة الحصة: {cat.default_split_percentage}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.newTicket.technician}
                </label>
                <div className="flex gap-2">
                  {(metadata?.technicians || []).map((tech) => (
                    <button
                      key={tech.id}
                      type="button"
                      onClick={() => setTechnicianId(tech.id)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${
                        technicianId === tech.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {tech.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.newTicket.price}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0"
                  className="font-bold text-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.newTicket.amountPaid}
                </label>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0"
                  className="font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.newTicket.amountRemaining}
                </label>
                <div className="flex h-10 w-full items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-lg font-bold text-slate-900">
                  <Coins className="h-4 w-4 text-amber-600 me-2" />
                  <span className={calculatedRemaining > 0 ? 'text-amber-700' : 'text-emerald-700'}>
                    {calculatedRemaining.toLocaleString('ar-DZ')} د.ج
                  </span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {t.newTicket.paymentType}
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-800">
                  <input
                    type="radio"
                    name="paymentType"
                    value="cash"
                    checked={paymentType === 'cash'}
                    onChange={() => setPaymentType('cash')}
                    className="h-4 w-4 text-blue-600"
                  />
                  {t.newTicket.paymentCash}
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-800">
                  <input
                    type="radio"
                    name="paymentType"
                    value="credit"
                    checked={paymentType === 'credit'}
                    onChange={() => setPaymentType('credit')}
                    className="h-4 w-4 text-blue-600"
                  />
                  {t.newTicket.paymentCredit}
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Action */}
        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full md:w-auto min-w-[200px] shadow-lg shadow-blue-500/20"
          >
            {loading ? t.newTicket.submittingButton : t.newTicket.submitButton}
          </Button>
        </div>
      </form>

      {/* Print Preview Modal */}
      {successInfo && (
        <PrintPreviewModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          data={{
            barcode: successInfo.barcode,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim() || undefined,
            shortLabel: shortLabel.trim() || generateShortLabel(brand, model),
            ticketId: successInfo.ticketId
          }}
        />
      )}
    </div>
  )
}
