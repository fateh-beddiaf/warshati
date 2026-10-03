import * as React from 'react'
import { BellRing, Globe, Palette } from 'lucide-react'
import { useI18n } from '../../../lib/i18n'
import { Button } from '../../../components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/Card'
import { Input } from '../../../components/ui/Input'
import { Label } from '../../../components/ui/Label'
import { SegmentedControl } from '../../../components/ui/SegmentedControl'
import { ThemeSelector } from '../../../components/ThemeSelector'
import type { Language } from '../../../lib/i18n'
import type { Notify } from '../types'

interface PreferencesTabProps {
  overdueDays: number
  setOverdueDays: (days: number) => void
  notify: Notify
}

function CardTitleRow({
  icon,
  title,
  description
}: {
  icon: React.ReactNode
  title: string
  description: string
}): React.JSX.Element {
  return (
    <CardHeader>
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </span>
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="mt-1 text-xs">{description}</CardDescription>
        </div>
      </div>
    </CardHeader>
  )
}

/** "General" tab: appearance (theme), language and the overdue-ticket threshold. */
export function PreferencesTab({ overdueDays, setOverdueDays, notify }: PreferencesTabProps): React.JSX.Element {
  const { t, language, setLanguage } = useI18n()
  const overdueId = React.useId()

  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    try {
      await window.api.setSetting('overdue_ready_days', String(overdueDays))
      notify('success', t.settings.preferences.preferencesSaved)
    } catch (err: unknown) {
      notify('error', err instanceof Error ? err.message : t.ui.settings.msg.preferencesFailed)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card data-testid="settings-appearance-card">
        <CardTitleRow icon={<Palette />} title={t.theme.label} description={t.theme.description} />
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>

      <Card>
        <CardTitleRow
          icon={<Globe />}
          title={t.ui.settings.preferences.languageCardTitle}
          description={t.ui.settings.preferences.languageCardDescription}
        />
        <CardContent>
          <SegmentedControl<Language>
            layoutGroup="settings-language"
            ariaLabel={t.settings.preferences.languageLabel}
            value={language}
            onChange={setLanguage}
            items={[
              { value: 'ar', label: t.settings.preferences.languageArabic, testId: 'lang-ar' },
              { value: 'en', label: t.settings.preferences.languageEnglish, testId: 'lang-en' }
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardTitleRow
          icon={<BellRing />}
          title={t.ui.settings.preferences.overdueCardTitle}
          description={t.ui.settings.preferences.overdueCardDescription}
        />
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={overdueId}>{t.settings.preferences.overdueThresholdLabel}</Label>
              <div className="flex items-center gap-3">
                <Input
                  id={overdueId}
                  data-testid="settings-overdue-days"
                  type="number"
                  min={1}
                  max={30}
                  value={overdueDays}
                  onChange={(e) => setOverdueDays(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 text-center text-base font-bold tabular-nums"
                />
                <span className="text-sm text-muted-foreground">{t.common.days}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t.settings.preferences.overdueThresholdHelp}</p>
            </div>
            <Button type="submit" data-testid="settings-prefs-save">
              {t.settings.preferences.savePreferences}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
