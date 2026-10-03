import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export type UiLanguage = 'ar' | 'en'

// Set synchronously by I18nProvider while it renders, so every formatter called in the same
// render already sees the new language (an effect or <html lang> would be one render late).
let uiLanguage: UiLanguage = 'ar'

export function setUiLanguage(language: UiLanguage): void {
  uiLanguage = language
}

const numberLocale = (): string => (uiLanguage === 'en' ? 'en-US' : 'ar-DZ')
const dateLocale = (language: UiLanguage = uiLanguage): string => (language === 'en' ? 'en-GB' : 'ar-DZ')

/** Plain amount without the currency: `1.500` (ar) / `1,500` (en). */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: 0 }).format(amount)
}

/** Amount with the currency following the UI language: `1.500 د.ج` (ar) / `1,500 DZD` (en). Display only. */
export function formatCurrency(amount: number): string {
  return uiLanguage === 'en' ? `${formatAmount(amount)} DZD` : `${formatAmount(amount)} د.ج`
}

/** Short date + time on two lines for dense tables; follows the UI language. */
export function formatDateParts(dateString: string, language: UiLanguage = uiLanguage): { date: string; time: string } {
  try {
    const date = new Date(dateString)
    const locale = dateLocale(language)
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
    return new Intl.DateTimeFormat(dateLocale(), {
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
