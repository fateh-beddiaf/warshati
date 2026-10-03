import * as React from 'react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { Search, ChevronDown, Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useI18n } from '../../lib/i18n'
import { Input } from './Input'
import { Popover, PopoverAnchor, PopoverContent } from './Popover'
import { Command, CommandList, CommandItem, CommandEmpty } from './Command'

export interface AutocompleteOption {
  /** Unique React key (values can repeat, e.g. the same model name under two brands) */
  id?: string | number
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

// Rendering hundreds of rows on every keystroke is wasteful: show the first N and let typing narrow the list
const MAX_VISIBLE_OPTIONS = 100

/**
 * Combobox: a plain in-place text field (typing and barcode scanning keep working) plus a
 * shadcn Command list in a Popover portal. Filtering/capping is done here (`shouldFilter={false}`).
 * The popover never takes focus; Arrow keys / Enter are forwarded from the input.
 */
export function Autocomplete({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  allowCustomInput = true,
  error = false
}: AutocompleteProps): React.JSX.Element {
  const { t } = useI18n()
  const text = t.ui.newTicket.autocomplete
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  // Keyboard/hover navigation state: the highlight is only drawn (and Enter only picks it) once the user navigates
  const [touched, setTouched] = useState(false)
  const [activeKey, setActiveKey] = useState<string | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

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

  const { visible, total } = useMemo(() => {
    const q = query.toLowerCase()
    const matches = query
      ? options.filter(
          (opt) =>
            opt.label.toLowerCase().includes(q) || (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
        )
      : options
    return { visible: matches.slice(0, MAX_VISIBLE_OPTIONS), total: matches.length }
  }, [options, query])

  const keys = useMemo(
    () => visible.map((opt, index) => String(opt.id ?? `${String(opt.value)}-${index}`)),
    [visible]
  )
  const currentKey = activeKey !== undefined && keys.includes(activeKey) ? activeKey : keys[0]

  const showList = isOpen && !disabled && (visible.length > 0 || query.trim() !== '')

  // Keep the keyboard-highlighted row in view
  useEffect(() => {
    if (!showList || !touched) return
    const frame = requestAnimationFrame(() => {
      listRef.current?.querySelector('[cmdk-item][aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
    })
    return () => cancelAnimationFrame(frame)
  }, [showList, touched, currentKey])

  const resetNavigation = (): void => {
    setTouched(false)
    setActiveKey(undefined)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const val = e.target.value
    setQuery(val)
    setIsOpen(true)
    resetNavigation()
    if (allowCustomInput) {
      onChange(val)
    }
  }

  const handleSelect = (option: AutocompleteOption): void => {
    setQuery(option.label)
    onChange(String(option.value), option)
    setIsOpen(false)
    resetNavigation()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (disabled || e.nativeEvent.isComposing) return
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      if (keys.length === 0) return
      const down = e.key === 'ArrowDown'
      let next: number
      if (!touched) {
        next = down ? 0 : keys.length - 1
      } else {
        const index = Math.max(0, keys.indexOf(currentKey))
        next = (index + (down ? 1 : -1) + keys.length) % keys.length
      }
      setTouched(true)
      setActiveKey(keys[next])
    } else if (e.key === 'Enter' && showList && visible.length > 0) {
      // Enter only picks a suggestion the user navigated to, or one that exactly matches the typed text;
      // otherwise it keeps the typed value (and the form's normal Enter behaviour).
      const typed = query.trim().toLowerCase()
      const index = touched
        ? keys.indexOf(currentKey)
        : visible.findIndex((opt) => opt.label.toLowerCase() === typed)
      if (index >= 0) {
        e.preventDefault()
        handleSelect(visible[index])
      } else {
        setIsOpen(false)
      }
    } else if (e.key === 'Escape' && isOpen) {
      setIsOpen(false)
    }
  }

  return (
    <Popover open={showList} onOpenChange={setIsOpen}>
      <PopoverAnchor asChild>
        <div ref={containerRef} className={cn('relative w-full', className)}>
          <Input
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-autocomplete="list"
            autoComplete="off"
            value={query}
            onChange={handleInputChange}
            onFocus={() => !disabled && setIsOpen(true)}
            onClick={() => !disabled && setIsOpen(true)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder ?? text.placeholder}
            error={error}
            className="ps-9 pe-9"
          />
          <Search className="pointer-events-none absolute start-2.5 top-3 h-4 w-4 text-muted-foreground" />
          <button
            type="button"
            tabIndex={-1}
            aria-label={text.toggle}
            disabled={disabled}
            onClick={() => setIsOpen(!isOpen)}
            className="absolute end-2 top-3 text-muted-foreground transition-colors hover:text-foreground focus:outline-none disabled:opacity-50"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform duration-150', showList && 'rotate-180')} />
          </button>
        </div>
      </PopoverAnchor>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        // The text field lives outside the portal: interacting with it must not dismiss the list
        onInteractOutside={(e) => {
          if (containerRef.current?.contains(e.target as Node)) e.preventDefault()
        }}
        // Keep focus in the text field when clicking a row
        onMouseDown={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false} value={currentKey ?? ''} onValueChange={setActiveKey} label={placeholder ?? text.placeholder}>
          <CommandList ref={listRef} onPointerMoveCapture={() => !touched && setTouched(true)}>
            {visible.length === 0 && (
              <CommandEmpty>
                {allowCustomInput ? `${text.useTyped} "${query}"` : text.noResults}
              </CommandEmpty>
            )}
            {visible.map((opt, index) => {
              const isSelected = opt.value === value || opt.label === query
              return (
                <CommandItem
                  key={keys[index]}
                  value={keys[index]}
                  onSelect={() => handleSelect(opt)}
                  className={cn(
                    'gap-2',
                    isSelected && 'font-semibold text-primary',
                    !touched && 'data-[selected=true]:bg-transparent'
                  )}
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="tabular text-xs font-normal text-muted-foreground" dir="ltr">
                        {opt.sublabel}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </CommandItem>
              )
            })}
            {total > MAX_VISIBLE_OPTIONS && (
              <div className="border-t border-border/60 px-3 py-2 text-center text-xs text-muted-foreground">
                {text.narrow}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
