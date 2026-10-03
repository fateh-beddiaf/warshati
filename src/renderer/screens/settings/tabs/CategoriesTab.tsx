import * as React from 'react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Wrench } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { EmptyState } from '../../../components/ui/EmptyState'
import { listContainer } from '../../../lib/motion'
import type { RepairCategory } from '../../../../shared/types'
import type { SettingsTabProps } from '../types'
import { useEntityForm } from '../useEntityForm'
import { useDeleteFlow } from '../useDeleteFlow'
import { runSave } from '../runSave'
import { SectionHeader } from '../shared/SectionHeader'
import { NameFormDialog } from '../shared/NameFormDialog'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { ListSkeleton } from '../shared/ListSkeleton'
import { CategoryCard } from './CategoryCard'
import { CategorySplitField } from './CategorySplitField'

const DEFAULT_SPLIT = 50

export function CategoriesTab({ data, loading, reload, notify }: SettingsTabProps): React.JSX.Element {
  const { t } = useI18n()
  const form = useEntityForm<RepairCategory>()
  const [split, setSplit] = useState<number>(DEFAULT_SPLIT)
  const m = t.ui.settings.msg

  const del = useDeleteFlow<RepairCategory>({
    checkUsage: window.api.checkRepairCategoryUsage,
    remove: window.api.deleteRepairCategory,
    guardWarning: t.settings.categories.deleteGuardWarning,
    deletedMessage: m.categoryDeleted,
    notify,
    onDeleted: reload
  })

  const openCreate = (): void => {
    form.openCreate()
    setSplit(DEFAULT_SPLIT)
  }
  const openEdit = (cat: RepairCategory): void => {
    form.openEdit(cat)
    setSplit(cat.default_split_percentage)
  }

  const handleSave = async (): Promise<void> => {
    const name = form.name.trim()
    if (!name) return
    form.setSaving(true)
    await runSave({
      isEditing: !!form.editing,
      update: () => window.api.updateRepairCategory(form.editing!.id, name, split),
      add: () => window.api.addRepairCategory(name, split),
      messages: {
        added: m.categoryAdded,
        updated: m.categoryUpdated,
        addFailed: m.categoryAddFailed,
        updateFailed: m.categoryUpdateFailed
      },
      unexpectedError: t.ui.settings.unexpectedError,
      notify,
      onSettled: () => {
        form.finish()
        setSplit(DEFAULT_SPLIT)
        return reload()
      },
      onThrown: () => form.setSaving(false)
    })
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title={t.settings.categories.title}
        description={t.settings.categories.description}
        addLabel={t.settings.categories.addCategory}
        onAdd={openCreate}
        addTestId="settings-category-add"
      />

      {loading ? (
        <ListSkeleton count={4} itemClassName="h-36" />
      ) : data.categories.length === 0 ? (
        <EmptyState
          icon={<Wrench />}
          title={t.ui.settings.categories.emptyTitle}
          description={t.ui.settings.categories.emptyDescription}
        />
      ) : (
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {data.categories.map((cat, i) => (
            <CategoryCard key={cat.id} category={cat} index={i} onEdit={openEdit} onDelete={del.request} />
          ))}
        </motion.div>
      )}

      <NameFormDialog
        wide
        open={form.open}
        onOpenChange={form.onOpenChange}
        title={form.editing ? t.common.edit : t.settings.categories.addCategory}
        fieldLabel={t.settings.categories.categoryName}
        placeholder={t.settings.categories.categoryNamePlaceholder}
        name={form.name}
        onNameChange={form.setName}
        onSubmit={handleSave}
        saving={form.saving}
        testId="settings-category-dialog"
      >
        <CategorySplitField value={split} onChange={setSplit} />
      </NameFormDialog>

      <DeleteConfirmDialog
        itemName={del.pending?.name ?? null}
        busy={del.deleting}
        onConfirm={del.confirm}
        onCancel={del.cancel}
      />
    </div>
  )
}
