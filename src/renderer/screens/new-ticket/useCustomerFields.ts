import { useState, useEffect, useMemo } from 'react'
import type { AutocompleteOption } from '../../components/ui/Autocomplete'
import type { Customer } from '../../../shared/types'

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
    // onResults is a state setter (stable): listing it would not change when the effect runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])
}

/**
 * Customer picker state shared by the New Ticket form and "attach this ticket to another customer" in the edit form:
 * type a name (existing customers are suggested), a phone (registered customers with that phone are offered), notes.
 * Picking a suggestion fills the id; typing over the phone clears it. The backend applies the matching rules.
 */
export function useCustomerFields() {
  const [existingCustomers, setExistingCustomers] = useState<Customer[]>([])
  const [phoneCandidates, setPhoneCandidates] = useState<Customer[]>([])
  const [customerId, setCustomerId] = useState<number | undefined>(undefined)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerNotes, setCustomerNotes] = useState('')

  // Customer searches re-query while typing (debounced) so older customers can be found too:
  // the name field feeds the name autocomplete, the phone field feeds the phone-match suggestions.
  useDebouncedCustomerSearch(customerName.trim(), setExistingCustomers)
  const phoneQuery = customerPhone.replace(/\s+/g, '').length >= 4 ? customerPhone.trim() : ''
  useDebouncedCustomerSearch(phoneQuery, setPhoneCandidates)

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

  const resetCustomer = (): void => {
    setCustomerId(undefined)
    setCustomerName('')
    setCustomerPhone('')
    setCustomerNotes('')
  }

  return {
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
    resetCustomer
  }
}

export type CustomerFields = ReturnType<typeof useCustomerFields>
