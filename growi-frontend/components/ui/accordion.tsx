'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AccordionContextValue {
  openItems: Set<string>
  toggle: (value: string) => void
  type: 'single' | 'multiple'
}

const AccordionContext = React.createContext<AccordionContextValue>({
  openItems: new Set(),
  toggle: () => {},
  type: 'single',
})

interface AccordionProps {
  type: 'single' | 'multiple'
  defaultValue?: string | string[]
  children: React.ReactNode
  className?: string
}

function Accordion({ type, defaultValue, children, className }: AccordionProps) {
  const initial = defaultValue
    ? type === 'multiple'
      ? new Set(Array.isArray(defaultValue) ? defaultValue : [defaultValue])
      : new Set([Array.isArray(defaultValue) ? defaultValue[0] : defaultValue])
    : new Set<string>()

  const [openItems, setOpenItems] = React.useState<Set<string>>(initial)

  function toggle(value: string) {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(value)) {
        next.delete(value)
      } else {
        if (type === 'single') next.clear()
        next.add(value)
      }
      return next
    })
  }

  return (
    <AccordionContext.Provider value={{ openItems, toggle, type }}>
      <div className={cn('divide-y divide-forest/10', className)}>{children}</div>
    </AccordionContext.Provider>
  )
}

interface AccordionItemProps {
  value: string
  children: React.ReactNode
  className?: string
}

function AccordionItem({ value, children, className }: AccordionItemProps) {
  return (
    <AccordionItemContext.Provider value={value}>
      <div className={cn('py-1', className)}>{children}</div>
    </AccordionItemContext.Provider>
  )
}

const AccordionItemContext = React.createContext<string>('')

interface AccordionTriggerProps {
  children: React.ReactNode
  className?: string
}

function AccordionTrigger({ children, className }: AccordionTriggerProps) {
  const { openItems, toggle } = React.useContext(AccordionContext)
  const value = React.useContext(AccordionItemContext)
  const isOpen = openItems.has(value)

  return (
    <button
      type="button"
      onClick={() => toggle(value)}
      aria-expanded={isOpen}
      className={cn(
        'flex w-full items-center justify-between py-3 font-raleway text-sm font-semibold text-forest hover:text-forest/80 transition-colors text-left',
        className,
      )}
    >
      {children}
      <ChevronDown
        size={16}
        className={cn('shrink-0 transition-transform duration-200', isOpen && 'rotate-180')}
        aria-hidden
      />
    </button>
  )
}

interface AccordionContentProps {
  children: React.ReactNode
  className?: string
}

function AccordionContent({ children, className }: AccordionContentProps) {
  const { openItems } = React.useContext(AccordionContext)
  const value = React.useContext(AccordionItemContext)
  const isOpen = openItems.has(value)

  if (!isOpen) return null

  return (
    <div className={cn('pb-3 text-forest/70 font-raleway text-sm leading-relaxed', className)}>
      {children}
    </div>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
