// growi-frontend/components/dashboard/FeatureCard.tsx
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FeatureCardProps {
  href: string
  title: string
  description: string
  icon: LucideIcon
  badge?: string
  className?: string
}

export function FeatureCard({
  href,
  title,
  description,
  icon: Icon,
  badge,
  className,
}: FeatureCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-card hover:shadow-card-hover transition-all duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0',
        className,
      )}
    >
      {badge && (
        <span className="absolute top-4 right-4 rounded-full bg-lime/20 px-2 py-0.5 font-poppins text-[10px] font-semibold text-forest uppercase tracking-wide">
          {badge}
        </span>
      )}
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-lime/15 text-forest group-hover:bg-lime/30 transition-colors">
        <Icon size={22} aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-poppins font-semibold text-sm text-forest">{title}</h3>
        <p className="font-raleway text-xs text-forest/60 leading-relaxed">{description}</p>
      </div>
    </Link>
  )
}
