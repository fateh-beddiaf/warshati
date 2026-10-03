import * as React from 'react'
import { useState } from 'react'
import { useI18n } from '../lib/i18n'
import {
  Wrench,
  ClipboardList,
  PlusCircle,
  TrendingUp,
  Database,
  Barcode,
  Search,
  Settings
} from 'lucide-react'
import { cn } from '../lib/utils'

interface LayoutProps {
  activeTab: 'tickets' | 'new-ticket' | 'reports' | 'settings'
  onTabChange: (tab: 'tickets' | 'new-ticket' | 'reports' | 'settings') => void
  onManualBarcodeScan?: (barcode: string) => void
  children: React.ReactNode
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 text-white flex flex-col justify-between shadow-xl">
        <div>
          {/* Logo & Brand */}
          <div className="p-5 border-b border-slate-800 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-wide text-white">{t.app.title}</h1>
              <p className="text-xs text-slate-400">{t.app.subtitle}</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <button
              type="button"
              data-testid="nav-tickets"
              onClick={() => onTabChange('tickets')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all',
                activeTab === 'tickets'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <ClipboardList className="h-5 w-5" />
              <span>{t.nav.ticketsList}</span>
            </button>

            <button
              type="button"
              data-testid="nav-new-ticket"
              onClick={() => onTabChange('new-ticket')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all',
                activeTab === 'new-ticket'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <PlusCircle className="h-5 w-5" />
              <span>{t.nav.newTicket}</span>
            </button>

            <button
              type="button"
              data-testid="nav-reports"
              onClick={() => onTabChange('reports')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all',
                activeTab === 'reports'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <TrendingUp className="h-5 w-5" />
              <span>{t.nav.reports}</span>
            </button>

            <button
              type="button"
              data-testid="nav-settings"
              onClick={() => onTabChange('settings')}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all',
                activeTab === 'settings'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Settings className="h-5 w-5" />
              <span>{t.nav.settings}</span>
            </button>
          </nav>
        </div>

        {/* Footer info in sidebar */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-400 space-y-2">
          {/* Scanner Live Status Badge */}
          <div className="flex items-center gap-2 bg-slate-800/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60">
            <Barcode className="h-4 w-4 text-emerald-400" />
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[11px] font-semibold text-slate-200">{t.scanner.readyBadge}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>{t.app.statusOnline}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-500">
              <Database className="h-3 w-3" />
              <span>SQLite</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Top bar for Barcode Quick Scan / Search simulation */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Barcode className="h-4 w-4 text-blue-600" />
            <span>{t.scanner.scanningPrompt}</span>
          </div>

          {/* Quick Barcode Scanner Simulation Input */}
          <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                data-barcode-input="true"
                data-testid="header-barcode-input"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder={t.scanner.simulateInputPlaceholder}
                className="w-64 h-8 ps-8 pe-3 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute start-2.5 top-2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            </div>
            <button
              type="submit"
              className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
            >
              {t.scanner.simulateButton}
            </button>
          </form>
        </header>

        {/* Scrollable Page Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  )
}

