import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { useI18n } from '../../lib/i18n'
import type { AutocompleteOption } from '../../components/ui/Autocomplete'
import { generateShortLabel } from '../../../shared/device-utils'
import type { AppMetadata, Brand, Customer, CreateTicketDTO, Model, PaymentType } from '../../../shared/types'

/** Runs customer search ~250ms after the query stops changing; stale responses are dropped. */
function useDebouncedCustomerSearch(query: string, onResults: (customers: Customer[]) => void): void {
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(
      async () => {
        try {
          const res = await window.api.searchCustomers(query)
          if (!cancelled && res.success && res.data) onResults(res.data)
        } catch (err) {
          console.error('Customer search failed:', err)
        }
      },
      query ? 250 : 0
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // onResults is a state setter (stable)
  }, [query])
}

export interface TicketPrintData {
  barcode: string
  customerName: string
  customerPhone?: string
  shortLabel: string
  ticketId: number
}

/** State, validation and submit logic of the New Ticket screen (UI-free). */
export function useNewTicketForm() {
  const { t } = useI18n()
  const [metadata, setMetadata] = useState<AppMetadata | null>(null)

  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([])
  const [phoneCandidates, setPhoneCandidates] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const [successInfo, setSuccessInfo] = useState<{ barcode: string; ticketId: number } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // After a failed submit the missing required fields are highlighted
  const [showErrors, setShowErrors] = useState(false)

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
      } catch (err) {
        console.error('Failed to load initial data:', err)
      }
    }
    loadData()
  }, [])

  // Customer searches re-query while typing (debounced) so older customers can be found too:
  // the name field feeds the name autocomplete, the phone field feeds the phone-match suggestions.
  useDebouncedCustomerSearch(customerName.trim(), setExistingCustomers)
  const phoneQuery = customerPhone.replace(/\s+/g, '').length >= 4 ? customerPhone.trim() : ''
  useDebouncedCustomerSearch(phoneQuery, setPhoneCandidates)

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
  // A partial payment is always a debt (the backend enforces the same rule)
  const effectivePaymentType: PaymentType = calculatedRemaining > 0 ? 'credit' : paymentType

  // Option lists are memoised: Autocomplete re-syncs on every new `options` array, so rebuilding
  // them on each keystroke would re-run its effects for nothing. `id` gives each option a unique
  // React key (the same model name can exist under two brands).
  const brandOptions = useMemo<AutocompleteOption[]>(
    () => (metadata?.brands ?? []).map((b) => ({ id: `brand-${b.id}`, value: b.name, label: b.name, data: b })),
    [metadata]
  )

  const modelOptions = useMemo<AutocompleteOption[]>(
    () =>
      (metadata?.models ?? [])
        .filter((m) => (brandId === null ? true : m.brand_id === brandId))
        .map((m) => ({ id: `model-${m.id}`, value: m.name, label: m.name, data: m })),
    [metadata, brandId]
  )

  const customerOptions = useMemo<AutocompleteOption[]>(
    () =>
      existingCustomers.map((c) => ({
        id: `customer-${c.id}`,
        value: c.id,
        label: c.name,
        sublabel: c.phone,
        data: c
      })),
    [existingCustomers]
  )

  // Registered customers whose phone matches what is being typed (offered as a suggestion)
  const phoneMatches = useMemo<Customer[]>(() => {
    const digits = customerPhone.replace(/\s+/g, '')
    if (customerId !== undefined || digits.length < 4) return []
    return phoneCandidates.filter((c) => c.phone.replace(/\s+/g, '').includes(digits)).slice(0, 5)
  }, [phoneCandidates, customerPhone, customerId])

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

  const onNameChange = (val: string, option?: AutocompleteOption): void => {
    setCustomerName(val)
    handleCustomerSelect(val, option)
  }

  const onPhoneChange = (val: string): void => {
    setCustomerPhone(val)
    // The form no longer describes the previously selected customer
    setCustomerId(undefined)
  }

  const selectPhoneMatch = (c: Customer): void => {
    handleCustomerSelect(String(c.id), { id: `customer-${c.id}`, value: c.id, label: c.name, data: c })
  }

  const onBrandChange = (val: string, option?: AutocompleteOption): void => {
    setBrand(val)
    setBrandId(option ? (option.data as Brand).id : null)
    setModel('')
    setModelId(null)
  }

  const onModelChange = (val: string, option?: AutocompleteOption): void => {
    setModel(val)
    setModelId(option ? (option.data as Model).id : null)
  }

  const onShortLabelChange = (val: string): void => {
    setShortLabel(val)
    setIsShortLabelEdited(true)
  }

  const regenerateShortLabel = (): void => {
    setIsShortLabelEdited(false)
    setShortLabel(generateShortLabel(brand, model))
  }

  const toggleAccessory = (id: number): void => {
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
    setShowErrors(false)
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setErrorMessage(null)

    // Validation
    if (!customerName.trim() || !customerPhone.trim() || !brand.trim() || !model.trim() || !categoryId || !technicianId) {
      setShowErrors(true)
      setErrorMessage(t.newTicket.requiredFieldsError)
      return
    }
    setShowErrors(false)

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
        payment_type: effectivePaymentType,
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

  const printData: TicketPrintData | null = successInfo
    ? {
        barcode: successInfo.barcode,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        shortLabel: shortLabel.trim() || generateShortLabel(brand, model),
        ticketId: successInfo.ticketId
      }
    : null

  return {
    metadata,
    loading,
    successInfo,
    errorMessage,
    showErrors,
    printData,
    // customer
    customerId,
    customerName,
    customerPhone,
    customerNotes,
    setCustomerNotes,
    customerOptions,
    phoneMatches,
    onNameChange,
    onPhoneChange,
    selectPhoneMatch,
    // device
    brand,
    model,
    shortLabel,
    brandOptions,
    modelOptions,
    onBrandChange,
    onModelChange,
    onShortLabelChange,
    regenerateShortLabel,
    selectedAccessoryIds,
    toggleAccessory,
    // repair & payment
    categoryId,
    setCategoryId,
    technicianId,
    setTechnicianId,
    price,
    setPrice,
    amountPaid,
    setAmountPaid,
    setPaymentType,
    numPrice,
    numPaid,
    calculatedRemaining,
    effectivePaymentType,
    // actions
    handleSubmit,
    resetForm
  }
}

export type NewTicketForm = ReturnType<typeof useNewTicketForm>
