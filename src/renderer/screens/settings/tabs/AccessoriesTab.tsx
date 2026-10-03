import * as React from 'react'
import { motion } from 'framer-motion'
import { Layers } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { Card, CardContent } from '../../../components/ui/Card'
import { EmptyState } from '../../../components/ui/EmptyState'
import { listContainer, listItemProps } from '../../../lib/motion'
import type { Accessories } from '../../../../shared/types'
import type { SettingsTabProps } from '../types'
import { useEntityForm } from '../useEntityForm'
import { useDeleteFlow } from '../useDeleteFlow'
import { runSave } from '../runSave'
import { SectionHeader } from '../shared/SectionHeader'
import { NameFormDialog } from '../shared/NameFormDialog'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { ListSkeleton } from '../shared/ListSkeleton'
import { RowActions } from '../shared/RowActions'

export function AccessoriesTab({ data, loading, reload, notify }: SettingsTabProps): React.JSX.Element {
  const { t } = useI18n()
  const form = useEntityForm<Accessories>()
  const m = t.ui.settings.msg

  const del = useDeleteFlow<Accessories>({
    checkUsage: window.api.checkAccessoryUsage,
    remove: window.api.deleteAccessory,
    guardWarning: t.settings.accessories.deleteGuardWarning,
    deletedMessage: m.accessoryDeleted,
    notify,
    onDeleted: reload
  })

  const handleSave = async (): Promise<void> => {
    const name = form.name.trim()
    if (!name) return
    form.setSaving(true)
    await runSave({
      isEditing: !!form.editing,
      update: () => window.api.updateAccessory(form.editing!.id, name),
      add: () => window.api.addAccessory(name),
      messages: {
        added: m.accessoryAdded,
        updated: m.accessoryUpdated,
        addFailed: m.accessoryAddFailed,
        updateFailed: m.accessoryUpdateFailed
      },
      unexpectedError: t.ui.settings.unexpectedError,
      notify,
      onSettled: () => {
        form.finish()
        return reload()
      },
      onThrown: () => form.setSaving(false)
    })
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title={t.settings.accessories.title}
        description={t.settings.accessories.description}
        addLabel={t.settings.accessories.addAccessory}
        onAdd={form.openCreate}
        addTestId="settings-accessory-add"
      />

      {loading ? (
        <ListSkeleton count={6} itemClassName="h-16" className="md:grid-cols-3" />
      ) : data.accessories.length === 0 ? (
        <EmptyState
          icon={<Layers />}
          title={t.ui.settings.accessories.emptyTitle}
          description={t.ui.settings.accessories.emptyDescription}
        />
      ) : (
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {data.accessories.map((acc, i) => (
            <motion.div key={acc.id} {...listItemProps(i)} data-testid="settings-accessory-row">
              <Card className="transition-shadow hover:shadow-pop">
                <CardContent className="flex items-center justify-between gap-2 p-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <Layers className="h-4 w-4" />
                    </span>
                    <span className="truncate text-sm font-bold text-foreground">{acc.name}</span>
                  </div>
                  <RowActions
                    onEdit={() => form.openEdit(acc)}
                    onDelete={() => del.request(acc)}
                    testIdPrefix="settings-accessory"
                  />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      <NameFormDialog
        open={form.open}
        onOpenChange={form.onOpenChange}
        title={form.editing ? t.common.edit : t.settings.accessories.addAccessory}
        fieldLabel={t.settings.accessories.accessoryName}
        placeholder={t.settings.accessories.accessoryNamePlaceholder}
        name={form.name}
        onNameChange={form.setName}
        onSubmit={handleSave}
        saving={form.saving}
        testId="settings-accessory-dialog"
      />

      <DeleteConfirmDialog
        itemName={del.pending?.name ?? null}
        busy={del.deleting}
        onConfirm={del.confirm}
        onCancel={del.cancel}
      />
    </div>
  )
}
