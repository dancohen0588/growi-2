import * as React from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            'flex h-11 w-full appearance-none rounded-lg border border-forest/20 bg-white px-3 py-2 pr-10 font-raleway text-sm text-forest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:border-lime disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/50 pointer-events-none"
          aria-hidden
        />
      </div>
    )
  },
)
Select.displayName = 'Select'

export { Select }
