import * as React from 'react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Wrench,
  ClipboardList,
  PlusCircle,
  TrendingUp,
  Database,
  Barcode,
  Search,
  Settings,
  type LucideIcon
} from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { cn } from '../lib/utils'
import { LAYOUT_IDS, transitions } from '../lib/motion'
import { ThemeToggle } from './ThemeToggle'
import { Input } from './ui/Input'
import { Button } from './ui/Button'

type TabId = 'tickets' | 'new-ticket' | 'reports' | 'settings'

interface LayoutProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onManualBarcodeScan?: (barcode: string) => void
  children: React.ReactNode
}

interface NavItemProps {
  testId: string
  icon: LucideIcon
  label: string
  active: boolean
  onClick: () => void
}

/** Sidebar entry: the active pill glides between items (shared layoutId). */
function NavItem({ testId, icon: Icon, label, active, onClick }: NavItemProps): React.JSX.Element {
  return (
    <motion.button
      type="button"
      data-testid={testId}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={transitions.fast}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'text-primary-foreground'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
      )}
    >
      {active && (
        <motion.span
          layoutId={`${LAYOUT_IDS.navPill}-sidebar`}
          transition={transitions.spring}
          className="absolute inset-0 rounded-lg bg-gradient-primary shadow-card"
        />
      )}
      <Icon className="relative h-5 w-5 shrink-0 transition-transform duration-150 group-hover:scale-110" />
      <span className="relative">{label}</span>
    </motion.button>
  )
}

export function Layout({
  activeTab,
  onTabChange,
  onManualBarcodeScan,
  children
}: LayoutProps): React.JSX.Element {
  const { t } = useI18n()
  const [barcodeInput, setBarcodeInput] = useState('')

  const handleBarcodeSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (barcodeInput.trim() && onManualBarcodeScan) {
      onManualBarcodeScan(barcodeInput.trim())
      setBarcodeInput('')
    }
  }

  const navItems: Array<{ id: TabId; testId: string; icon: LucideIcon; label: string }> = [
    { id: 'tickets', testId: 'nav-tickets', icon: ClipboardList, label: t.nav.ticketsList },
    { id: 'new-ticket', testId: 'nav-new-ticket', icon: PlusCircle, label: t.nav.newTicket },
    { id: 'reports', testId: 'nav-reports', icon: TrendingUp, label: t.nav.reports },
    { id: 'settings', testId: 'nav-settings', icon: Settings, label: t.nav.settings }
  ]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar: always dark, whatever the theme */}
      <aside className="flex w-56 flex-shrink-0 flex-col justify-between bg-sidebar text-sidebar-foreground shadow-pop">
        <div>
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 border-b border-sidebar-border p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-card">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight text-sidebar-foreground">
                {t.app.title}
              </h1>
              <p className="text-xs text-sidebar-muted">{t.app.subtitle}</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav aria-label={t.ui.layout.navAria} className="space-y-1 p-3">
            {navItems.map((item) => (
              <NavItem
                key={item.id}
                testId={item.testId}
                icon={item.icon}
                label={item.label}
                active={activeTab === item.id}
                onClick={() => onTabChange(item.id)}
              />
            ))}
          </nav>
        </div>

        {/* Footer info in sidebar */}
        <div className="space-y-2 border-t border-sidebar-border p-4 text-xs text-sidebar-muted">
          {/* Scanner status badge: static dot, no looping animation */}
          <div
            role="status"
            aria-label={t.ui.layout.scannerStatusAria}
            className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent px-2.5 py-1.5"
          >
            <Barcode className="h-4 w-4 text-success" />
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="text-[11px] font-semibold text-sidebar-foreground">
                {t.scanner.readyBadge}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span>{t.app.statusOnline}</span>
            </div>
            <div className="flex items-center gap-1">
              <Database className="h-3 w-3" />
              <span>SQLite</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {/* Top bar: scanner hint, theme toggle and manual barcode entry */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-card px-6 shadow-soft">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Barcode className="h-4 w-4 text-primary" />
            <span>{t.scanner.scanningPrompt}</span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {/* Quick barcode entry (simulates a scanner) */}
            <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2">
              <div className="relative">
                <Input
                  mono
                  type="text"
                  data-barcode-input="true"
                  data-testid="header-barcode-input"
                  aria-label={t.ui.layout.scanInputAria}
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder={t.scanner.simulateInputPlaceholder}
                  className="h-8 w-64 bg-muted ps-8 pe-3 text-xs font-semibold focus-visible:bg-card"
                />
                <Search className="pointer-events-none absolute start-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <Button type="submit" size="sm" className="font-bold">
                {t.scanner.simulateButton}
              </Button>
            </form>
          </div>
        </header>

        {/* Scrollable Page Body */}
        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </div>
      </main>
    </div>
  )
}
