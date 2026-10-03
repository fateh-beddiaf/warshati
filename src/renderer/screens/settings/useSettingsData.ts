import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../lib/i18n'
import { notify } from './notify'
import type { SettingsData } from './types'

const EMPTY: SettingsData = {
  brands: [],
  models: [],
  categories: [],
  accessories: [],
  technicians: [],
  dbInfo: null
}

/** Loads all reference data + database info + overdue threshold for the settings screen. */
export function useSettingsData(): {
  data: SettingsData
  loading: boolean
  reload: () => Promise<void>
  overdueDays: number
  setOverdueDays: (days: number) => void
} {
  const { t } = useI18n()
  const [data, setData] = useState<SettingsData>(EMPTY)
  const [overdueDays, setOverdueDays] = useState<number>(3)
  const [loading, setLoading] = useState(true)
  const loadFailed = t.ui.settings.loadFailed

  const reload = useCallback(async () => {
    try {
      const [metaRes, infoRes, daysRes] = await Promise.all([
        window.api.getMetadata(),
        window.api.getDatabaseInfo(),
        window.api.getOverdueDays()
      ])

      setData((prev) => {
        const next = { ...prev }
        if (metaRes.success && metaRes.data) {
          next.brands = metaRes.data.brands || []
          next.models = metaRes.data.models || []
          next.categories = metaRes.data.repairCategories || []
          next.accessories = metaRes.data.accessories || []
          next.technicians = metaRes.data.technicians || []
        }
        if (infoRes.success && infoRes.data) next.dbInfo = infoRes.data
        return next
      })
      if (daysRes.success && daysRes.data) setOverdueDays(daysRes.data)
    } catch (err) {
      console.error('Failed to load settings data:', err)
      notify('error', loadFailed)
    } finally {
      setLoading(false)
    }
  }, [loadFailed])

  useEffect(() => {
    void reload()
  }, [reload])

  return { data, loading, reload, overdueDays, setOverdueDays }
}
