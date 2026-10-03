import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('ar-DZ', {
    maximumFractionDigits: 0
  }).format(amount)
  return `${formatted} د.ج`
}

/** Short date + time on two lines for dense tables; follows the UI language. */
export function formatDateParts(dateString: string, language: 'ar' | 'en'): { date: string; time: string } {
  try {
    const date = new Date(dateString)
    const locale = language === 'ar' ? 'ar-DZ' : 'en-GB'
    return {
      date: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date),
      time: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date)
    }
  } catch {
    return { date: dateString, time: '' }
  }
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    // <html lang> is kept in sync with the UI language by I18nProvider
    const locale = typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en-GB' : 'ar-DZ'
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  } catch {
    return dateString
  }
}
