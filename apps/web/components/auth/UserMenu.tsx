// growi-frontend/components/auth/UserMenu.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { LogOut, User, Settings } from 'lucide-react'
import { useUserProfile } from '@/hooks/useUserProfile'

export function UserMenu() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { profile } = useUserProfile()

  const avatarColor = profile?.avatarColor ?? '#B4DD7F'

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  const initials =
    profile?.firstName && profile?.lastName
      ? `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase()
      : profile?.firstName
      ? profile.firstName.slice(0, 2).toUpperCase()
      : session?.user?.firstName
      ? session.user.firstName.slice(0, 2).toUpperCase()
      : (session?.user?.email?.slice(0, 2).toUpperCase() ?? '?')

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu utilisateur"
        className="flex items-center justify-center h-9 w-9 rounded-full font-poppins font-bold text-sm text-forest hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
        style={{ backgroundColor: avatarColor }}
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-card-hover border border-forest/10 py-1 z-50"
        >
          <p className="px-4 py-2 text-xs font-raleway text-forest/50 truncate">
            {session?.user?.email}
          </p>
          <hr className="border-forest/10 my-1" />
          <Link
            href="/dashboard/compte"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2 font-raleway text-sm text-forest hover:bg-sand transition-colors"
            onClick={() => setOpen(false)}
          >
            <User size={16} aria-hidden />
            Mon compte
          </Link>
          <Link
            href="/dashboard/parametres"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2 font-raleway text-sm text-forest hover:bg-sand transition-colors"
            onClick={() => setOpen(false)}
          >
            <Settings size={16} aria-hidden />
            Paramètres
          </Link>
          <button
            role="menuitem"
            onClick={() => signOut({ callbackUrl: '/' })}
            className="flex w-full items-center gap-2 px-4 py-2 font-raleway text-sm text-forest hover:bg-sand transition-colors"
          >
            <LogOut size={16} aria-hidden />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}
