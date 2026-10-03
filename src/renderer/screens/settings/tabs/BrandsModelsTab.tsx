import * as React from 'react'
import { useMemo, useState } from 'react'
import { useI18n } from '../../../lib/i18n'
import type { Brand, Model } from '../../../../shared/types'
import type { SettingsTabProps } from '../types'
import { useEntityForm } from '../useEntityForm'
import { useDeleteFlow } from '../useDeleteFlow'
import { runSave } from '../runSave'
import { NameFormDialog } from '../shared/NameFormDialog'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { BrandsPanel } from './BrandsPanel'
import { ModelsPanel } from './ModelsPanel'

export function BrandsModelsTab({ data, loading, reload, notify }: SettingsTabProps): React.JSX.Element {
  const { t } = useI18n()
  const m = t.ui.settings.msg
  const brandForm = useEntityForm<Brand>()
  const modelForm = useEntityForm<Model>()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // Same behaviour as before: nothing selected yet (or the selection was deleted) -> first brand
  const effectiveId = selectedId ?? data.brands[0]?.id ?? null
  const selectedBrand = data.brands.find((b) => b.id === effectiveId) ?? null

  const modelCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const model of data.models) counts.set(model.brand_id, (counts.get(model.brand_id) ?? 0) + 1)
    return counts
  }, [data.models])

  const brandModels = useMemo(
    () => data.models.filter((model) => model.brand_id === effectiveId),
    [data.models, effectiveId]
  )

  const delBrand = useDeleteFlow<Brand>({
    checkUsage: window.api.checkBrandUsage,
    remove: window.api.deleteBrand,
    guardWarning: t.settings.brands.deleteGuardWarning,
    deletedMessage: m.brandDeleted,
    notify,
    onDeleted: (b) => {
      if (effectiveId === b.id) setSelectedId(null)
      return reload()
    }
  })

  const delModel = useDeleteFlow<Model>({
    checkUsage: window.api.checkModelUsage,
    remove: window.api.deleteModel,
    guardWarning: t.settings.models.deleteGuardWarning,
    deletedMessage: m.modelDeleted,
    notify,
    onDeleted: reload
  })

  const saveBrand = async (): Promise<void> => {
    const name = brandForm.name.trim()
    if (!name) return
    brandForm.setSaving(true)
    await runSave({
      isEditing: !!brandForm.editing,
      update: () => window.api.updateBrand(brandForm.editing!.id, name),
      add: () => window.api.addBrand(name),
      messages: {
        added: m.brandAdded,
        updated: m.brandUpdated,
        addFailed: m.brandAddFailed,
        updateFailed: m.brandUpdateFailed
      },
      unexpectedError: t.ui.settings.unexpectedError,
      notify,
      onAdded: (created) => {
        if (created) setSelectedId(created.id)
      },
      onSettled: () => {
        brandForm.finish()
        return reload()
      },
      onThrown: () => brandForm.setSaving(false)
    })
  }

  const saveModel = async (): Promise<void> => {
    const name = modelForm.name.trim()
    if (!name || !effectiveId) return
    modelForm.setSaving(true)
    await runSave({
      isEditing: !!modelForm.editing,
      update: () => window.api.updateModel(modelForm.editing!.id, name, effectiveId),
      add: () => window.api.addModel(effectiveId, name),
      messages: {
        added: m.modelAdded,
        updated: m.modelUpdated,
        addFailed: m.modelAddFailed,
        updateFailed: m.modelUpdateFailed
      },
      unexpectedError: t.ui.settings.unexpectedError,
      notify,
      onSettled: () => {
        modelForm.finish()
        return reload()
      },
      onThrown: () => modelForm.setSaving(false)
    })
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div className="md:col-span-1">
        <BrandsPanel
          brands={data.brands}
          modelCounts={modelCounts}
          selectedId={effectiveId}
          loading={loading}
          onSelect={setSelectedId}
          onAdd={brandForm.openCreate}
          onEdit={brandForm.openEdit}
          onDelete={delBrand.request}
        />
      </div>
      <div className="md:col-span-2">
        <ModelsPanel
          key={effectiveId ?? 'none'}
          brand={selectedBrand}
          models={brandModels}
          onAdd={modelForm.openCreate}
          onEdit={modelForm.openEdit}
          onDelete={delModel.request}
        />
      </div>

      <NameFormDialog
        open={brandForm.open}
        onOpenChange={brandForm.onOpenChange}
        title={brandForm.editing ? t.common.edit : t.settings.brands.addBrand}
        fieldLabel={t.settings.brands.brandName}
        placeholder={t.settings.brands.brandNamePlaceholder}
        name={brandForm.name}
        onNameChange={brandForm.setName}
        onSubmit={saveBrand}
        saving={brandForm.saving}
        testId="settings-brand-dialog"
      />

      <NameFormDialog
        open={modelForm.open}
        onOpenChange={modelForm.onOpenChange}
        title={
          modelForm.editing ? t.common.edit : t.settings.models.addModel.replace('{brand}', selectedBrand?.name || '')
        }
        fieldLabel={t.settings.models.modelName}
        placeholder={t.settings.models.modelNamePlaceholder}
        name={modelForm.name}
        onNameChange={modelForm.setName}
        onSubmit={saveModel}
        saving={modelForm.saving}
        testId="settings-model-dialog"
      />

      <DeleteConfirmDialog
        itemName={delBrand.pending?.name ?? null}
        busy={delBrand.deleting}
        onConfirm={delBrand.confirm}
        onCancel={delBrand.cancel}
      />
      <DeleteConfirmDialog
        itemName={delModel.pending?.name ?? null}
        busy={delModel.deleting}
        onConfirm={delModel.confirm}
        onCancel={delModel.cancel}
      />
    </div>
  )
}
