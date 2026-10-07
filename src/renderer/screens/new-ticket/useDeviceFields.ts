import { useState, useEffect, useMemo } from 'react'
import type { AutocompleteOption } from '../../components/ui/Autocomplete'
import { generateShortLabel } from '../../../shared/device-utils'
import type { AppMetadata, Brand, Model } from '../../../shared/types'

export interface DeviceInitial {
  brand: string
  brandId: number | null
  model: string
  modelId: number | null
  shortLabel: string
}

/**
 * Device state shared by the New Ticket form and the edit form: brand / model type-ahead (with their reference ids
 * when picked from the lists) and the short label, regenerated from brand + model until the user types their own.
 * `initial` (edit form) starts from a saved device: a label that differs from the generated one counts as typed.
 */
export function useDeviceFields(metadata: AppMetadata | null, initial?: DeviceInitial) {
  const [brand, setBrand] = useState(initial?.brand ?? '')
  const [brandId, setBrandId] = useState<number | null>(initial?.brandId ?? null)
  const [model, setModel] = useState(initial?.model ?? '')
  const [modelId, setModelId] = useState<number | null>(initial?.modelId ?? null)
  const [shortLabel, setShortLabel] = useState(initial?.shortLabel ?? '')
  const [isShortLabelEdited, setIsShortLabelEdited] = useState(
    initial ? initial.shortLabel !== generateShortLabel(initial.brand, initial.model) : false
  )

  // Auto-generate short_label when brand or model changes if not manually overridden
  useEffect(() => {
    if (!isShortLabelEdited) {
      const generated = generateShortLabel(brand, model)
      setShortLabel(generated)
    }
  }, [brand, model, isShortLabelEdited])

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

  const resetDevice = (): void => {
    setBrand('')
    setBrandId(null)
    setModel('')
    setModelId(null)
    setShortLabel('')
    setIsShortLabelEdited(false)
  }

  return {
    brand,
    brandId,
    model,
    modelId,
    shortLabel,
    brandOptions,
    modelOptions,
    onBrandChange,
    onModelChange,
    onShortLabelChange,
    regenerateShortLabel,
    resetDevice
  }
}

export type DeviceFields = ReturnType<typeof useDeviceFields>
