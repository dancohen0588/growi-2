import Link from 'next/link'
import type { ReactNode } from 'react'
import type { CommunityUser } from '@growi/shared'

import { cn } from '@/lib/utils'

/**
 * Éléments d'affichage partagés par les écrans web de la communauté.
 *
 * Server Components : tout ce qui n'a pas besoin d'interactivité en reste un,
 * et seuls les gestes — aimer, suivre, commenter — passent par un composant
 * client.
 */

/** Avatar, ou initiale du pseudo sur la couleur du compte. */
export function Avatar({
  user,
  size = 40,
}: {
  user: Pick<CommunityUser, 'handle' | 'avatarUrl' | 'avatarColor'>
  size?: number
}) {
  if (user.avatarUrl) {
    return (
      // `<img>` et non `next/image` : ces photos viennent du bucket Supabase,
      // dont le domaine n'est pas déclaré dans la config d'images.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-poppins font-semibold text-forest"
      style={{ width: size, height: size, backgroundColor: user.avatarColor ?? '#B4DD7F' }}
    >
      {user.handle.slice(0, 1).toUpperCase()}
    </span>
  )
}

/**
 * L'auteur d'un contenu : avatar, pseudo, et ce qui le situe.
 *
 * Le pseudo mène toujours au profil public — c'est la seule porte d'entrée
 * vers quelqu'un, et elle doit être la même partout.
 */
export function AuthorLine({
  user,
  suffix,
  size = 40,
}: {
  user: CommunityUser
  /** Date, statut… ce qui s'ajoute à la distance. */
  suffix?: ReactNode
  size?: number
}) {
  return (
    <div className="flex items-center gap-3">
      <Link href={`/u/${user.handle}`} aria-label={`Profil de ${user.handle}`}>
        <Avatar user={user} size={size} />
      </Link>
      <div className="min-w-0">
        <Link
          href={`/u/${user.handle}`}
          className="block truncate font-raleway font-medium text-forest hover:underline"
        >
          {user.handle}
        </Link>
        <p className="truncate font-raleway text-xs text-forest/50">
          {[user.distanceLabel ?? user.city, suffix].filter(Boolean).map((part, index) => (
            <span key={index}>
              {index > 0 && ' · '}
              {part}
            </span>
          ))}
        </p>
      </div>
    </div>
  )
}

const TONES = {
  neutral: 'bg-forest/5 text-forest/70',
  lime: 'bg-lime/30 text-forest',
  sun: 'bg-sun/30 text-forest',
  danger: 'bg-red-50 text-red-700',
} as const

export function Tag({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: keyof typeof TONES
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-raleway text-xs font-medium',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Vide, mais pas muet : un état vide oriente toujours vers l'action suivante. */
export function CommunityEmpty({
  emoji,
  title,
  hint,
  action,
}: {
  emoji: string
  title: string
  hint: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-dashed border-forest/15 bg-white px-6 py-12 text-center">
      <p className="text-4xl" aria-hidden>
        {emoji}
      </p>
      <h2 className="mt-3 font-poppins text-lg font-semibold text-forest">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm font-raleway text-sm text-forest/60">{hint}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

/**
 * Invitation affichée à qui n'a pas encore de profil public.
 *
 * Le web ne porte pas l'écran d'activation — il vit dans « Mon compte », et
 * c'est là qu'on renvoie plutôt que de dupliquer un formulaire.
 */
export function CommunityDisabled() {
  return (
    <CommunityEmpty
      emoji="🌱"
      title="Rejoins la communauté"
      hint="Choisis un pseudo pour voir ce que publient les jardiniers autour de toi. Ton nom et ton adresse restent privés."
      action={
        <Link
          href="/dashboard/compte#communaute"
          className="rounded-lg bg-lime px-5 py-2.5 font-raleway text-sm font-semibold text-forest hover:bg-lime/80"
        >
          Activer mon profil public
        </Link>
      }
    />
  )
}

/** Le lien « page suivante » des listes paginées par curseur. */
export function MoreLink({ href }: { href: string }) {
  return (
    <div className="flex justify-center pt-2">
      <Link
        href={href}
        className="rounded-lg border border-forest/15 bg-white px-5 py-2.5 font-raleway text-sm text-forest hover:bg-sand"
      >
        Voir la suite
      </Link>
    </div>
  )
}
