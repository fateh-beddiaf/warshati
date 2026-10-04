import * as React from 'react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Database, Globe, Layers, Smartphone, Sliders, Users, Wrench } from 'lucide-react'
import { useI18n } from '../../lib/i18n'
import { PageHeader } from '../../components/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'
import { pageTransition, transitions } from '../../lib/motion'
import type { SettingsTabId, SettingsTabProps } from './types'
import { notify } from './notify'
import { useSettingsData } from './useSettingsData'
import { CategoriesTab } from './tabs/CategoriesTab'
import { BrandsModelsTab } from './tabs/BrandsModelsTab'
import { AccessoriesTab } from './tabs/AccessoriesTab'
import { TechniciansTab } from './tabs/TechniciansTab'
import { BackupTab } from './tabs/BackupTab'
import { PreferencesTab } from './tabs/PreferencesTab'

const TAB_ICONS: Record<SettingsTabId, React.ReactNode> = {
  categories: <Wrench />,
  brandsModels: <Smartphone />,
  accessories: <Layers />,
  technicians: <Users />,
  backup: <Database />,
  preferences: <Globe />
}

const TAB_ORDER: SettingsTabId[] = ['categories', 'brandsModels', 'accessories', 'technicians', 'backup', 'preferences']

/** Short fade + slide when switching sections (the previous content is unmounted by Radix). */
function TabPanel({ value, children }: { value: SettingsTabId; children: React.ReactNode }): React.JSX.Element {
  return (
    <TabsContent value={value}>
      <motion.div initial={pageTransition.initial} animate={pageTransition.animate} transition={transitions.base}>
        {children}
      </motion.div>
    </TabsContent>
  )
}

export function SettingsScreen(): React.JSX.Element {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<SettingsTabId>('categories')
  const { data, loading, reload, overdueDays, setOverdueDays } = useSettingsData()

  const tabProps: SettingsTabProps = { data, loading, reload, notify }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader title={t.settings.title} subtitle={t.settings.subtitle} icon={<Sliders />} />

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SettingsTabId)}>
        <TabsList
          aria-label={t.ui.settings.tabsLabel}
          className="flex h-auto w-full flex-wrap justify-start gap-1 p-1.5"
        >
          {TAB_ORDER.map((id) => (
            <TabsTrigger
              key={id}
              value={id}
              data-testid={`settings-tab-${id}`}
              className="px-4 py-2.5 text-xs font-bold"
            >
              {activeTab === id && (
                <motion.span
                  layoutId="settings-tab-pill"
                  transition={transitions.spring}
                  className="absolute inset-0 rounded-md bg-card shadow-soft"
                />
              )}
              <span className="relative [&_svg]:h-4 [&_svg]:w-4">{TAB_ICONS[id]}</span>
              <span className="relative">{t.settings.tabs[id]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabPanel value="categories">
          <CategoriesTab {...tabProps} />
        </TabPanel>
        <TabPanel value="brandsModels">
          <BrandsModelsTab {...tabProps} />
        </TabPanel>
        <TabPanel value="accessories">
          <AccessoriesTab {...tabProps} />
        </TabPanel>
        <TabPanel value="technicians">
          <TechniciansTab {...tabProps} />
        </TabPanel>
        <TabPanel value="backup">
          <BackupTab {...tabProps} />
        </TabPanel>
        <TabPanel value="preferences">
          <PreferencesTab overdueDays={overdueDays} setOverdueDays={setOverdueDays} notify={notify} />
        </TabPanel>
      </Tabs>
    </div>
  )
}
