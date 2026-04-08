'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  onChange: (value: string) => void
}

const TabsContext = React.createContext<TabsContextValue>({ value: '', onChange: () => {} })

interface TabsProps {
  defaultValue: string
  value?: string
  onValueChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function Tabs({ defaultValue, value, onValueChange, children, className }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue)
  const controlled = value !== undefined
  const current = controlled ? value! : internal

  const onChange = React.useCallback((v: string) => {
    if (!controlled) setInternal(v)
    onValueChange?.(v)
  }, [controlled, onValueChange])

  return (
    <TabsContext.Provider value={{ value: current, onChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center border-b border-forest/10 bg-white',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface TabsTriggerProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { value: current, onChange } = React.useContext(TabsContext)
  const active = current === value

  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={() => onChange(value)}
      className={cn(
        'flex-1 py-2 font-raleway text-xs font-semibold transition-colors border-b-2 -mb-px',
        active
          ? 'border-forest text-forest'
          : 'border-transparent text-forest/50 hover:text-forest/80',
        className,
      )}
    >
      {children}
    </button>
  )
}

interface TabsContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { value: current } = React.useContext(TabsContext)
  if (current !== value) return null
  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  )
}
