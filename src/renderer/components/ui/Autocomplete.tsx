import * as React from 'react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { Search, ChevronDown, Check } from 'lucide-react'

export interface AutocompleteOption {
  value: string | number
  label: string
  sublabel?: string
  data?: unknown
}

interface AutocompleteProps {
  options: AutocompleteOption[]
  value?: string | number
  onChange: (value: string, selectedOption?: AutocompleteOption) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  allowCustomInput?: boolean
  error?: boolean
}

export function Autocomplete({
  options,
  value,
  onChange,
  placeholder = 'اختر أو اكتب...',
  disabled = false,
  className,
  allowCustomInput = true,
  error = false
}: AutocompleteProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync display text with value prop
  useEffect(() => {
    if (value !== undefined && value !== null) {
      const match = options.find((o) => o.value === value || o.label === value)
      if (match) {
        setQuery(match.label)
      } else if (typeof value === 'string') {
        setQuery(value)
      }
    } else {
      setQuery('')
    }
  }, [value, options])

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = query
    ? options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(query.toLowerCase()) ||
          (opt.sublabel && opt.sublabel.toLowerCase().includes(query.toLowerCase()))
      )
    : options

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value
    setQuery(val)
    setIsOpen(true)
    if (allowCustomInput) {
      onChange(val)
    }
  }

  const handleSelect = (option: AutocompleteOption): void => {
    setQuery(option.label)
    onChange(String(option.value), option)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => !disabled && setIsOpen(true)}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            'flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 ps-9 pe-8 text-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 text-slate-800 transition-colors',
            error && 'border-red-500 focus-visible:ring-red-500'
          )}
        />
        <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className="absolute end-2 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => {
              const isSelected = opt.value === value || opt.label === query
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-start transition-colors',
                    isSelected
                      ? 'bg-blue-50 text-blue-900 font-semibold'
                      : 'hover:bg-slate-100 text-slate-800'
                  )}
                >
                  <div className="flex flex-col">
                    <span>{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-xs text-slate-500 font-normal">{opt.sublabel}</span>
                    )}
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-blue-600 ms-2 flex-shrink-0" />}
                </button>
              )
            })
          ) : (
            <div className="px-3 py-2 text-xs text-slate-500 text-center">
              {allowCustomInput ? `استخدام القيمة المكتوبة: "${query}"` : 'لا توجد نتائج مطابقة'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
