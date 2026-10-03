import type { Brand, Model, RepairCategory, Accessories, Technician, DatabaseInfo } from '../../../shared/types'

export type SettingsTabId = 'categories' | 'brandsModels' | 'accessories' | 'technicians' | 'backup' | 'preferences'

export type NotifyType = 'success' | 'error' | 'warning'
export type Notify = (type: NotifyType, message: string) => void

export interface SettingsData {
  brands: Brand[]
  models: Model[]
  categories: RepairCategory[]
  accessories: Accessories[]
  technicians: Technician[]
  dbInfo: DatabaseInfo | null
}

/** Props every settings tab receives from the screen. */
export interface SettingsTabProps {
  data: SettingsData
  /** True until the first load finished: tabs render skeletons instead of an empty state */
  loading: boolean
  reload: () => Promise<void>
  notify: Notify
}
