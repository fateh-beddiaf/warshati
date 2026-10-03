import * as React from 'react'
import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { Card, CardContent } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { EmptyState } from '../../../components/ui/EmptyState'
import { listContainer, listItemProps } from '../../../lib/motion'
import type { Technician } from '../../../../shared/types'
import type { SettingsTabProps } from '../types'
import { useEntityForm } from '../useEntityForm'
import { useDeleteFlow } from '../useDeleteFlow'
import { runSave } from '../runSave'
import { SectionHeader } from '../shared/SectionHeader'
import { NameFormDialog } from '../shared/NameFormDialog'
import { DeleteConfirmDialog } from '../shared/DeleteConfirmDialog'
import { ListSkeleton } from '../shared/ListSkeleton'
import { RowActions } from '../shared/RowActions'

export function TechniciansTab({ data, loading, reload, notify }: SettingsTabProps): React.JSX.Element {
  const { t } = useI18n()
  const form = useEntityForm<Technician>()
  const m = t.ui.settings.msg

  const del = useDeleteFlow<Technician>({
    checkUsage: window.api.checkTechnicianUsage,
    remove: window.api.deleteTechnician,
    guardWarning: t.settings.technicians.deleteGuardWarning,
    deletedMessage: m.technicianDeleted,
    notify,
    onDeleted: reload
  })

  const handleSave = async (): Promise<void> => {
    const name = form.name.trim()
    if (!name) return
    form.setSaving(true)
    await runSave({
      isEditing: !!form.editing,
      update: () => window.api.updateTechnician(form.editing!.id, name),
      add: () => window.api.addTechnician(name),
      messages: {
        added: m.technicianAdded,
        updated: m.technicianUpdated,
        addFailed: m.technicianAddFailed,
        updateFailed: m.technicianUpdateFailed
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
        title={t.settings.technicians.title}
        description={t.settings.technicians.description}
        addLabel={t.settings.technicians.addTechnician}
        onAdd={form.openCreate}
        addTestId="settings-technician-add"
      />

      {loading ? (
        <ListSkeleton count={2} itemClassName="h-20" />
      ) : data.technicians.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={t.ui.settings.technicians.emptyTitle}
          description={t.ui.settings.technicians.emptyDescription}
        />
      ) : (
        <motion.div
          variants={listContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {data.technicians.map((tech, i) => (
            <motion.div key={tech.id} {...listItemProps(i)} data-testid="settings-technician-row">
              <Card className="transition-shadow hover:shadow-pop">
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-accent text-accent-foreground">
                      <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="truncate text-sm font-bold text-foreground">{tech.name}</h4>
                      {tech.is_partner ? (
                        <Badge variant="success" className="mt-1">
                          {t.profit.partnerExclusiveBadge}
                        </Badge>
                      ) : (
                        <p className="mt-0.5 text-xs text-muted-foreground">{t.ui.settings.technicians.certified}</p>
                      )}
                    </div>
                  </div>
                  <RowActions
                    onEdit={() => form.openEdit(tech)}
                    onDelete={() => del.request(tech)}
                    testIdPrefix="settings-technician"
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
        title={form.editing ? t.common.edit : t.settings.technicians.addTechnician}
        fieldLabel={t.settings.technicians.technicianName}
        placeholder={t.settings.technicians.technicianNamePlaceholder}
        name={form.name}
        onNameChange={form.setName}
        onSubmit={handleSave}
        saving={form.saving}
        testId="settings-technician-dialog"
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
