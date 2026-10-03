import * as React from 'react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useI18n } from '../lib/i18n'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wrench,
  Smartphone,
  Layers,
  Users,
  Database,
  Globe,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HardDrive,
  Search,
  Sliders
} from 'lucide-react'
import type {
  Brand,
  Model,
  RepairCategory,
  Accessories,
  Technician,
  DatabaseInfo
} from '../../shared/types'

type SettingsTab = 'categories' | 'brandsModels' | 'accessories' | 'technicians' | 'backup' | 'preferences'

export function SettingsScreen(): React.JSX.Element {
  const { t, language, setLanguage } = useI18n()
  const [activeTab, setActiveTab] = useState<SettingsTab>('categories')

  // Notification Banner
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null)

  const alertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showAlert = useCallback((type: 'success' | 'error' | 'warning', message: string) => {
    // Clear the previous timer so an older alert can't dismiss a newer one early
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current)
    setAlert({ type, message })
    alertTimerRef.current = setTimeout(() => setAlert(null), 5000)
  }, [])

  useEffect(() => {
    return () => {
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current)
    }
  }, [])

  // Data States
  const [brands, setBrands] = useState<Brand[]>([])
  const [models, setModels] = useState<Model[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null)
  const [categories, setCategories] = useState<RepairCategory[]>([])
  const [accessories, setAccessories] = useState<Accessories[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [dbInfo, setDbInfo] = useState<DatabaseInfo | null>(null)
  const [overdueDays, setOverdueDays] = useState<number>(3)

  // Modals & Form States
  // Category Form
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<RepairCategory | null>(null)
  const [categoryName, setCategoryName] = useState('')
  const [categorySplit, setCategorySplit] = useState<number>(50)

  // Brand Form
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null)
  const [brandName, setBrandName] = useState('')

  // Model Form
  const [isModelModalOpen, setIsModelModalOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)
  const [modelName, setModelName] = useState('')
  const [modelSearchQuery, setModelSearchQuery] = useState('')

  // Accessory Form
  const [isAccessoryModalOpen, setIsAccessoryModalOpen] = useState(false)
  const [editingAccessory, setEditingAccessory] = useState<Accessories | null>(null)
  const [accessoryName, setAccessoryName] = useState('')

  // Technician Form
  const [isTechnicianModalOpen, setIsTechnicianModalOpen] = useState(false)
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null)
  const [technicianName, setTechnicianName] = useState('')

  // Import Confirmation Dialog
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Fetch all settings data
  const loadAllData = useCallback(async () => {
    try {
      const [metaRes, infoRes, daysRes] = await Promise.all([
        window.api.getMetadata(),
        window.api.getDatabaseInfo(),
        window.api.getOverdueDays()
      ])

      if (metaRes.success && metaRes.data) {
        setBrands(metaRes.data.brands || [])
        setModels(metaRes.data.models || [])
        setCategories(metaRes.data.repairCategories || [])
        setAccessories(metaRes.data.accessories || [])
        setTechnicians(metaRes.data.technicians || [])
        // Functional update: keeps loadAllData stable so selecting a brand doesn't reload everything
        setSelectedBrandId((prev) => prev ?? metaRes.data?.brands?.[0]?.id ?? null)
      }

      if (infoRes.success && infoRes.data) {
        setDbInfo(infoRes.data)
      }

      if (daysRes.success && daysRes.data) {
        setOverdueDays(daysRes.data)
      }
    } catch (err) {
      console.error('Failed to load settings data:', err)
      showAlert('error', 'فشل في تحميل بيانات الإعدادات')
    }
  }, [showAlert])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // ==========================================
  // Categories Actions
  // ==========================================
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!categoryName.trim()) return

    try {
      if (editingCategory) {
        const res = await window.api.updateRepairCategory(editingCategory.id, categoryName.trim(), categorySplit)
        if (res.success) {
          showAlert('success', 'تم تعديل تصنيف العطل ونسبة الأرباح بنجاح')
        } else {
          showAlert('error', res.error || 'فشل التعديل')
        }
      } else {
        const res = await window.api.addRepairCategory(categoryName.trim(), categorySplit)
        if (res.success) {
          showAlert('success', 'تمت إضافة تصنيف العطل بنجاح')
        } else {
          showAlert('error', res.error || 'فشل الإضافة')
        }
      }
      setIsCategoryModalOpen(false)
      setEditingCategory(null)
      setCategoryName('')
      setCategorySplit(50)
      loadAllData()
    } catch (err: unknown) {
      showAlert('error', err instanceof Error ? err.message : 'خطأ غير متوقع')
    }
  }

  const handleDeleteCategory = async (cat: RepairCategory) => {
    try {
      const checkRes = await window.api.checkRepairCategoryUsage(cat.id)
      if (checkRes.success && checkRes.data && !checkRes.data.canDelete) {
        showAlert('warning', checkRes.data.message || t.settings.categories.deleteGuardWarning)
        return
      }

      const res = await window.api.deleteRepairCategory(cat.id)
      if (res.success) {
        showAlert('success', 'تم حذف التصنيف بنجاح')
        loadAllData()
      } else {
        showAlert('warning', res.error || t.settings.categories.deleteGuardWarning)
      }
    } catch (err: unknown) {
      showAlert('warning', err instanceof Error ? err.message : t.settings.categories.deleteGuardWarning)
    }
  }

  // ==========================================
  // Brands & Models Actions
  // ==========================================
  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!brandName.trim()) return

    try {
      if (editingBrand) {
        const res = await window.api.updateBrand(editingBrand.id, brandName.trim())
        if (res.success) {
          showAlert('success', 'تم تعديل اسم الماركة بنجاح')
        } else {
          showAlert('error', res.error || 'فشل تعديل الماركة')
        }
      } else {
        const res = await window.api.addBrand(brandName.trim())
        if (res.success && res.data) {
          showAlert('success', 'تمت إضافة الماركة بنجاح')
          setSelectedBrandId(res.data.id)
        } else {
          showAlert('error', res.error || 'فشل إضافة الماركة')
        }
      }
      setIsBrandModalOpen(false)
      setEditingBrand(null)
      setBrandName('')
      loadAllData()
    } catch (err: unknown) {
      showAlert('error', err instanceof Error ? err.message : 'خطأ غير متوقع')
    }
  }

  const handleDeleteBrand = async (b: Brand) => {
    try {
      const checkRes = await window.api.checkBrandUsage(b.id)
      if (checkRes.success && checkRes.data && !checkRes.data.canDelete) {
        showAlert('warning', checkRes.data.message || t.settings.brands.deleteGuardWarning)
        return
      }

      const res = await window.api.deleteBrand(b.id)
      if (res.success) {
        showAlert('success', 'تم حذف الماركة بنجاح')
        if (selectedBrandId === b.id) {
          setSelectedBrandId(null)
        }
        loadAllData()
      } else {
        showAlert('warning', res.error || t.settings.brands.deleteGuardWarning)
      }
    } catch (err: unknown) {
      showAlert('warning', err instanceof Error ? err.message : t.settings.brands.deleteGuardWarning)
    }
  }

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modelName.trim() || !selectedBrandId) return

    try {
      if (editingModel) {
        const res = await window.api.updateModel(editingModel.id, modelName.trim(), selectedBrandId)
        if (res.success) {
          showAlert('success', 'تم تعديل الموديل بنجاح')
        } else {
          showAlert('error', res.error || 'فشل تعديل الموديل')
        }
      } else {
        const res = await window.api.addModel(selectedBrandId, modelName.trim())
        if (res.success) {
          showAlert('success', 'تمت إضافة الموديل بنجاح')
        } else {
          showAlert('error', res.error || 'فشل إضافة الموديل')
        }
      }
      setIsModelModalOpen(false)
      setEditingModel(null)
      setModelName('')
      loadAllData()
    } catch (err: unknown) {
      showAlert('error', err instanceof Error ? err.message : 'خطأ غير متوقع')
    }
  }

  const handleDeleteModel = async (m: Model) => {
    try {
      const checkRes = await window.api.checkModelUsage(m.id)
      if (checkRes.success && checkRes.data && !checkRes.data.canDelete) {
        showAlert('warning', checkRes.data.message || t.settings.models.deleteGuardWarning)
        return
      }

      const res = await window.api.deleteModel(m.id)
      if (res.success) {
        showAlert('success', 'تم حذف الموديل بنجاح')
        loadAllData()
      } else {
        showAlert('warning', res.error || t.settings.models.deleteGuardWarning)
      }
    } catch (err: unknown) {
      showAlert('warning', err instanceof Error ? err.message : t.settings.models.deleteGuardWarning)
    }
  }

  // ==========================================
  // Accessories Actions
  // ==========================================
  const handleSaveAccessory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accessoryName.trim()) return

    try {
      if (editingAccessory) {
        const res = await window.api.updateAccessory(editingAccessory.id, accessoryName.trim())
        if (res.success) {
          showAlert('success', 'تم تعديل الملحق بنجاح')
        } else {
          showAlert('error', res.error || 'فشل تعديل الملحق')
        }
      } else {
        const res = await window.api.addAccessory(accessoryName.trim())
        if (res.success) {
          showAlert('success', 'تمت إضافة الملحق بنجاح')
        } else {
          showAlert('error', res.error || 'فشل إضافة الملحق')
        }
      }
      setIsAccessoryModalOpen(false)
      setEditingAccessory(null)
      setAccessoryName('')
      loadAllData()
    } catch (err: unknown) {
      showAlert('error', err instanceof Error ? err.message : 'خطأ غير متوقع')
    }
  }

  const handleDeleteAccessory = async (acc: Accessories) => {
    try {
      const checkRes = await window.api.checkAccessoryUsage(acc.id)
      if (checkRes.success && checkRes.data && !checkRes.data.canDelete) {
        showAlert('warning', checkRes.data.message || t.settings.accessories.deleteGuardWarning)
        return
      }

      const res = await window.api.deleteAccessory(acc.id)
      if (res.success) {
        showAlert('success', 'تم حذف الملحق بنجاح')
        loadAllData()
      } else {
        showAlert('warning', res.error || t.settings.accessories.deleteGuardWarning)
      }
    } catch (err: unknown) {
      showAlert('warning', err instanceof Error ? err.message : t.settings.accessories.deleteGuardWarning)
    }
  }

  // ==========================================
  // Technicians Actions
  // ==========================================
  const handleSaveTechnician = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!technicianName.trim()) return

    try {
      if (editingTechnician) {
        const res = await window.api.updateTechnician(editingTechnician.id, technicianName.trim())
        if (res.success) {
          showAlert('success', 'تم تعديل اسم الفني بنجاح')
        } else {
          showAlert('error', res.error || 'فشل تعديل الفني')
        }
      } else {
        const res = await window.api.addTechnician(technicianName.trim())
        if (res.success) {
          showAlert('success', 'تمت إضافة الفني بنجاح')
        } else {
          showAlert('error', res.error || 'فشل إضافة الفني')
        }
      }
      setIsTechnicianModalOpen(false)
      setEditingTechnician(null)
      setTechnicianName('')
      loadAllData()
    } catch (err: unknown) {
      showAlert('error', err instanceof Error ? err.message : 'خطأ غير متوقع')
    }
  }

  const handleDeleteTechnician = async (tech: Technician) => {
    try {
      const checkRes = await window.api.checkTechnicianUsage(tech.id)
      if (checkRes.success && checkRes.data && !checkRes.data.canDelete) {
        showAlert('warning', checkRes.data.message || t.settings.technicians.deleteGuardWarning)
        return
      }

      const res = await window.api.deleteTechnician(tech.id)
      if (res.success) {
        showAlert('success', 'تم حذف الفني بنجاح')
        loadAllData()
      } else {
        showAlert('warning', res.error || t.settings.technicians.deleteGuardWarning)
      }
    } catch (err: unknown) {
      showAlert('warning', err instanceof Error ? err.message : t.settings.technicians.deleteGuardWarning)
    }
  }

  // ==========================================
  // Backup & Restore Actions
  // ==========================================
  const handleExportBackup = async () => {
    setExporting(true)
    try {
      const res = await window.api.exportBackup()
      if (res.success && res.filePath) {
        showAlert(
          'success',
          t.settings.backup.exportSuccess.replace('{path}', res.filePath)
        )
      } else if (!res.canceled) {
        showAlert('error', res.error || 'فشل تصدير النسخة الاحتياطية')
      }
    } catch (err: unknown) {
      showAlert('error', err instanceof Error ? err.message : 'فشل التصدير')
    } finally {
      setExporting(false)
    }
  }

  const handleImportBackup = async () => {
    setIsImportConfirmOpen(false)
    setImporting(true)
    try {
      const res = await window.api.importBackup()
      if (res.success) {
        let msg = t.settings.backup.importSuccess
        if (res.safetyBackupPath) {
          msg += ` (${t.settings.backup.safetyBackupNotice.replace('{path}', res.safetyBackupPath)})`
        }
        showAlert('success', msg)
        await loadAllData()
      } else if (!res.canceled) {
        showAlert('error', res.error || 'فشل استيراد قاعدة البيانات')
      }
    } catch (err: unknown) {
      showAlert('error', err instanceof Error ? err.message : 'فشل الاستيراد')
    } finally {
      setImporting(false)
    }
  }

  // ==========================================
  // Preferences Actions
  // ==========================================
  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await window.api.setSetting('overdue_ready_days', String(overdueDays))
      showAlert('success', t.settings.preferences.preferencesSaved)
    } catch (err: unknown) {
      showAlert('error', err instanceof Error ? err.message : 'فشل حفظ التفضيلات')
    }
  }

  const selectedBrand = brands.find((b) => b.id === selectedBrandId)
  const modelsForSelectedBrand = models.filter((m) => m.brand_id === selectedBrandId)
  const filteredModels = modelsForSelectedBrand.filter((m) =>
    m.name.toLowerCase().includes(modelSearchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl text-white shadow-xl">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
            <Sliders className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t.settings.title}</h1>
            <p className="text-sm text-slate-300 mt-0.5">{t.settings.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Alert Banner */}
      <AnimatePresence>
        {alert && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
            className={`p-4 rounded-xl border flex items-center gap-3 shadow-md ${
              alert.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : alert.type === 'warning'
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            {alert.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />}
            {alert.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />}
            {alert.type === 'error' && <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0" />}
            <span className="text-xs md:text-sm font-semibold">{alert.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-200/80 rounded-xl border border-slate-300/60 shadow-inner">
        <button
          type="button"
          data-testid="settings-tab-categories"
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'categories'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <Wrench className="h-4 w-4" />
          <span>{t.settings.tabs.categories}</span>
        </button>

        <button
          type="button"
          data-testid="settings-tab-brandsModels"
          onClick={() => setActiveTab('brandsModels')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'brandsModels'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <Smartphone className="h-4 w-4" />
          <span>{t.settings.tabs.brandsModels}</span>
        </button>

        <button
          type="button"
          data-testid="settings-tab-accessories"
          onClick={() => setActiveTab('accessories')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'accessories'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>{t.settings.tabs.accessories}</span>
        </button>

        <button
          type="button"
          data-testid="settings-tab-technicians"
          onClick={() => setActiveTab('technicians')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'technicians'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>{t.settings.tabs.technicians}</span>
        </button>

        <button
          type="button"
          data-testid="settings-tab-backup"
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'backup'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <Database className="h-4 w-4" />
          <span>{t.settings.tabs.backup}</span>
        </button>

        <button
          type="button"
          data-testid="settings-tab-preferences"
          onClick={() => setActiveTab('preferences')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'preferences'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <Globe className="h-4 w-4" />
          <span>{t.settings.tabs.preferences}</span>
        </button>
      </div>

      {/* Tab 1: Repair Categories & Splits */}
      {activeTab === 'categories' && (
        <motion.div
          key="categories"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{t.settings.categories.title}</h2>
              <p className="text-xs text-slate-500">{t.settings.categories.description}</p>
            </div>
            <Button
              onClick={() => {
                setEditingCategory(null)
                setCategoryName('')
                setCategorySplit(50)
                setIsCategoryModalOpen(true)
              }}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4" />
              <span>{t.settings.categories.addCategory}</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((cat) => {
              const myPercentage = cat.default_split_percentage
              const partnerPercentage = 100 - myPercentage
              return (
                <Card key={cat.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-base text-slate-900">{cat.name}</h3>
                        <div className="flex items-center gap-2 mt-2 text-xs">
                          <Badge variant="default" className="font-semibold">
                            {t.settings.categories.ownerShare.replace('{percent}', String(myPercentage))}
                          </Badge>
                          <Badge variant="success" className="font-semibold">
                            {t.settings.categories.partnerShare.replace('{percent}', String(partnerPercentage))}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(cat)
                            setCategoryName(cat.name)
                            setCategorySplit(cat.default_split_percentage)
                            setIsCategoryModalOpen(true)
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                          title={t.common.edit}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(cat)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                          title={t.common.delete}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Visual Percentage Bar */}
                    <div className="mt-4 space-y-1.5">
                      <div className="h-2.5 w-full rounded-full bg-slate-100 flex overflow-hidden border border-slate-200">
                        <div
                          style={{ width: `${myPercentage}%` }}
                          className="bg-blue-600 transition-all duration-300"
                        />
                        <div
                          style={{ width: `${partnerPercentage}%` }}
                          className="bg-emerald-500 transition-all duration-300"
                        />
                      </div>
                      <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                        <span>{t.profit.ownerShareLabel}: {myPercentage}%</span>
                        <span>{t.profit.partnerShareLabel}: {partnerPercentage}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Tab 2: Brands & Models */}
      {activeTab === 'brandsModels' && (
        <motion.div
          key="brandsModels"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Brands Left Column */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">{t.settings.brands.title}</h2>
              <Button
                size="sm"
                onClick={() => {
                  setEditingBrand(null)
                  setBrandName('')
                  setIsBrandModalOpen(true)
                }}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>{t.common.add}</span>
              </Button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {brands.map((b) => {
                const count = models.filter((m) => m.brand_id === b.id).length
                const isSelected = selectedBrandId === b.id
                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBrandId(b.id)}
                    className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50/80 text-blue-900 font-bold' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{b.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                        {count}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingBrand(b)
                          setBrandName(b.name)
                          setIsBrandModalOpen(true)
                        }}
                        className="p-1 rounded text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteBrand(b)
                        }}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Models Right Column */}
          <div className="space-y-4 md:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-800">
                  {selectedBrand
                    ? t.settings.models.title.replace('{brand}', selectedBrand.name)
                    : t.settings.models.selectBrandPrompt}
                </h2>
              </div>
              {selectedBrand && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingModel(null)
                    setModelName('')
                    setIsModelModalOpen(true)
                  }}
                  className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs self-start"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t.settings.models.addModel.replace('{brand}', selectedBrand.name)}</span>
                </Button>
              )}
            </div>

            {selectedBrand ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                {/* Search Bar for Models */}
                <div className="relative">
                  <Input
                    value={modelSearchQuery}
                    onChange={(e) => setModelSearchQuery(e.target.value)}
                    placeholder={t.common.search}
                    className="ps-9 h-9 text-xs"
                  />
                  <Search className="absolute start-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto">
                  {filteredModels.map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-center justify-between hover:bg-slate-100/70 transition-colors"
                    >
                      <span className="text-xs font-semibold text-slate-800">{m.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingModel(m)
                            setModelName(m.name)
                            setIsModelModalOpen(true)
                          }}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteModel(m)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {filteredModels.length === 0 && (
                    <div className="col-span-full py-8 text-center text-xs text-slate-400">
                      لا توجد موديلات مطابقة
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-sm">
                {t.settings.models.selectBrandPrompt}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Tab 3: Accessories */}
      {activeTab === 'accessories' && (
        <motion.div
          key="accessories"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{t.settings.accessories.title}</h2>
              <p className="text-xs text-slate-500">{t.settings.accessories.description}</p>
            </div>
            <Button
              onClick={() => {
                setEditingAccessory(null)
                setAccessoryName('')
                setIsAccessoryModalOpen(true)
              }}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4" />
              <span>{t.settings.accessories.addAccessory}</span>
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {accessories.map((acc) => (
              <Card key={acc.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-600" />
                    <span className="font-bold text-xs text-slate-800">{acc.name}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAccessory(acc)
                        setAccessoryName(acc.name)
                        setIsAccessoryModalOpen(true)
                      }}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAccessory(acc)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Tab 4: Technicians */}
      {activeTab === 'technicians' && (
        <motion.div
          key="technicians"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{t.settings.technicians.title}</h2>
              <p className="text-xs text-slate-500">{t.settings.technicians.description}</p>
            </div>
            <Button
              onClick={() => {
                setEditingTechnician(null)
                setTechnicianName('')
                setIsTechnicianModalOpen(true)
              }}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4" />
              <span>{t.settings.technicians.addTechnician}</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {technicians.map((tech) => (
              <Card key={tech.id} className="border-slate-200 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{tech.name}</h3>
                      <p className="text-[11px] text-slate-500">
                        {tech.is_partner ? t.profit.partnerExclusiveBadge : 'فني معتمد'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTechnician(tech)
                        setTechnicianName(tech.name)
                        setIsTechnicianModalOpen(true)
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTechnician(tech)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      )}

      {/* Tab 5: Backup & Restore */}
      {activeTab === 'backup' && (
        <motion.div
          key="backup"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="space-y-6"
        >
          {/* Database Info Card */}
          <Card className="border-slate-200 bg-gradient-to-br from-slate-900 to-indigo-950 text-white shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <HardDrive className="h-5 w-5 text-indigo-400" />
                <CardTitle className="text-base font-bold text-white">
                  {t.settings.backup.databaseInfoTitle}
                </CardTitle>
              </div>
              <CardDescription className="text-slate-300 text-xs">
                {t.settings.backup.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                  <span className="text-slate-400 block mb-1">{t.settings.backup.databasePath}</span>
                  <span className="font-mono text-[11px] text-indigo-200 break-all select-all">
                    {dbInfo?.filePath || '...'}
                  </span>
                </div>

                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                  <span className="text-slate-400 block mb-1">{t.settings.backup.databaseSize}</span>
                  <span className="font-bold text-sm text-emerald-300">{dbInfo?.fileSizeFormatted || '...'}</span>
                </div>

                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                  <span className="text-slate-400 block mb-1">{t.settings.backup.lastModified}</span>
                  <span className="font-semibold text-xs text-slate-200">
                    {dbInfo?.lastModified ? new Date(dbInfo.lastModified).toLocaleString() : '...'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export Card */}
            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      {t.settings.backup.exportButton}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      {t.settings.backup.exportHelp}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  onClick={handleExportBackup}
                  disabled={exporting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 py-5"
                >
                  <Download className="h-4 w-4" />
                  <span>{exporting ? 'جاري التصدير...' : t.settings.backup.exportButton}</span>
                </Button>
              </CardContent>
            </Card>

            {/* Import Card */}
            <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-900">
                      {t.settings.backup.importButton}
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      {t.settings.backup.importHelp}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  onClick={() => setIsImportConfirmOpen(true)}
                  disabled={importing}
                  variant="outline"
                  className="w-full border-amber-300 text-amber-900 hover:bg-amber-50 font-bold gap-2 py-5"
                >
                  <Upload className="h-4 w-4 text-amber-600" />
                  <span>{importing ? 'جاري الاستيراد...' : t.settings.backup.importButton}</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Tab 6: Preferences & Language */}
      {activeTab === 'preferences' && (
        <motion.div
          key="preferences"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="max-w-2xl space-y-6"
        >
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-900">
                {t.settings.preferences.title}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                {t.settings.preferences.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-0">
              <form onSubmit={handleSavePreferences} className="space-y-6">
                {/* Language Switcher */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    {t.settings.preferences.languageLabel}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      data-testid="lang-ar"
                      onClick={() => setLanguage('ar')}
                      className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                        language === 'ar'
                          ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>{t.settings.preferences.languageArabic}</span>
                      {language === 'ar' && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                    </button>

                    <button
                      type="button"
                      data-testid="lang-en"
                      onClick={() => setLanguage('en')}
                      className={`p-3.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all ${
                        language === 'en'
                          ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <span>{t.settings.preferences.languageEnglish}</span>
                      {language === 'en' && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                    </button>
                  </div>
                </div>

                {/* Overdue Threshold */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">
                    {t.settings.preferences.overdueThresholdLabel}
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={overdueDays}
                      onChange={(e) => setOverdueDays(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 text-center font-bold text-base"
                    />
                    <span className="text-xs text-slate-500">{t.common.days}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {t.settings.preferences.overdueThresholdHelp}
                  </p>
                </div>

                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                  {t.settings.preferences.savePreferences}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Modal: Category Form */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-base text-slate-900">
                  {editingCategory ? t.common.edit : t.settings.categories.addCategory}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveCategory} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">{t.settings.categories.categoryName}</label>
                  <Input
                    required
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder={t.settings.categories.categoryNamePlaceholder}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span>{t.settings.categories.splitPercentage}</span>
                    <span className="text-blue-600 text-sm">{categorySplit}% لي / {100 - categorySplit}% للشريك</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={categorySplit}
                    onChange={(e) => setCategorySplit(parseInt(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <span className="font-bold text-slate-600 block">{t.settings.categories.preview}</span>
                    <div className="flex justify-between font-mono font-bold text-slate-800">
                      <span className="text-blue-600">حصتي: {(10000 * (categorySplit / 100)).toLocaleString()} د.ج</span>
                      <span className="text-emerald-600">حصة الشريك: {(10000 * ((100 - categorySplit) / 100)).toLocaleString()} د.ج</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCategoryModalOpen(false)}
                  >
                    {t.common.cancel}
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    {t.common.save}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Brand Form */}
      <AnimatePresence>
        {isBrandModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-base text-slate-900">
                  {editingBrand ? t.common.edit : t.settings.brands.addBrand}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsBrandModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveBrand} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">{t.settings.brands.brandName}</label>
                  <Input
                    required
                    autoFocus
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder={t.settings.brands.brandNamePlaceholder}
                    className="text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsBrandModalOpen(false)}
                  >
                    {t.common.cancel}
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    {t.common.save}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Model Form */}
      <AnimatePresence>
        {isModelModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-base text-slate-900">
                  {editingModel ? t.common.edit : t.settings.models.addModel.replace('{brand}', selectedBrand?.name || '')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModelModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveModel} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">{t.settings.models.modelName}</label>
                  <Input
                    required
                    autoFocus
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder={t.settings.models.modelNamePlaceholder}
                    className="text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModelModalOpen(false)}
                  >
                    {t.common.cancel}
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    {t.common.save}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Accessory Form */}
      <AnimatePresence>
        {isAccessoryModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-base text-slate-900">
                  {editingAccessory ? t.common.edit : t.settings.accessories.addAccessory}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAccessoryModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveAccessory} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">{t.settings.accessories.accessoryName}</label>
                  <Input
                    required
                    autoFocus
                    value={accessoryName}
                    onChange={(e) => setAccessoryName(e.target.value)}
                    placeholder={t.settings.accessories.accessoryNamePlaceholder}
                    className="text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAccessoryModalOpen(false)}
                  >
                    {t.common.cancel}
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    {t.common.save}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Technician Form */}
      <AnimatePresence>
        {isTechnicianModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-base text-slate-900">
                  {editingTechnician ? t.common.edit : t.settings.technicians.addTechnician}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsTechnicianModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveTechnician} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">{t.settings.technicians.technicianName}</label>
                  <Input
                    required
                    autoFocus
                    value={technicianName}
                    onChange={(e) => setTechnicianName(e.target.value)}
                    placeholder={t.settings.technicians.technicianNamePlaceholder}
                    className="text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsTechnicianModalOpen(false)}
                  >
                    {t.common.cancel}
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    {t.common.save}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Import Confirmation Dialog */}
      <AnimatePresence>
        {isImportConfirmOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-2xl border border-amber-200 max-w-md w-full p-6 space-y-5"
            >
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {t.settings.backup.importConfirmTitle}
                  </h3>
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {t.settings.backup.importConfirmDesc}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsImportConfirmOpen(false)}
                >
                  {t.common.cancel}
                </Button>
                <Button
                  type="button"
                  onClick={handleImportBackup}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  {t.common.confirm}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
