import { ACTIVITY_SURFACE_LABELS, type ActivitySurface } from '@growi/shared'

import { DateCell, EmptyState, Pill } from '@/components/admin/bits'
import {
  ACTIVITY_WINDOW_DAYS,
  getUserActivity,
} from '@/lib/services/admin-user-detail.service'
import { cn } from '@/lib/utils'

/** Jours de la fenêtre, du plus ancien au plus récent, en UTC comme la table. */
function windowDays(days: number): string[] {
  const today = Date.now()
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today - (days - 1 - index) * 24 * 60 * 60 * 1000)
    return date.toISOString().slice(0, 10)
  })
}

const SURFACE_CLASSES: Record<string, string> = {
  web: 'bg-lime',
  mobile: 'bg-forest',
  both: 'bg-sun',
}

export async function ActivityTab({ userId }: { userId: string }) {
  const { activity, sessions, pushTokens } = await getUserActivity(userId)

  const bySurface = new Map(activity.map((day) => [day.day, day.surfaces]))
  const days = windowDays(ACTIVITY_WINDOW_DAYS)

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-forest/10 bg-white p-6">
        <h2 className="mb-1 font-poppins text-lg font-semibold text-forest">
          {ACTIVITY_WINDOW_DAYS} derniers jours
        </h2>
        <p className="mb-4 text-sm text-forest/55">
          Un carré par jour UTC. L’historique ne remonte pas avant la mise en place de la trace
          d’activité — un compte ancien peut paraître inactif alors qu’il ne l’était pas.
        </p>

        <div className="flex flex-wrap gap-1">
          {days.map((day) => {
            const surfaces = bySurface.get(day)
            const key = !surfaces ? 'none' : surfaces.length > 1 ? 'both' : surfaces[0]

            return (
              <span
                key={day}
                title={
                  surfaces
                    ? `${day} — ${surfaces
                        .map((s) => ACTIVITY_SURFACE_LABELS[s as ActivitySurface] ?? s)
                        .join(' et ')}`
                    : `${day} — aucune activité`
                }
                className={cn(
                  'size-3.5 rounded-sm',
                  SURFACE_CLASSES[key] ?? 'bg-forest/10',
                )}
              />
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-forest/55">
          <Legend className="bg-lime">Site web</Legend>
          <Legend className="bg-forest">Application mobile</Legend>
          <Legend className="bg-sun">Les deux</Legend>
          <Legend className="bg-forest/10">Aucune activité</Legend>
        </div>
      </section>

      <section className="rounded-2xl border border-forest/10 bg-white p-6">
        <h2 className="mb-4 font-poppins text-lg font-semibold text-forest">Sessions mobiles</h2>
        {sessions.length === 0 ? (
          <EmptyState title="Aucune session mobile active" />
        ) : (
          <ul className="space-y-2 text-sm">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-baseline justify-between gap-3 border-b border-forest/5 pb-2 last:border-0"
              >
                <span className="text-forest/85">{session.deviceInfo ?? 'Appareil inconnu'}</span>
                <span className="text-forest/55">
                  Ouverte le <DateCell value={session.createdAt} withTime /> · expire le{' '}
                  <DateCell value={session.expiresAt} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-forest/10 bg-white p-6">
        <h2 className="mb-4 font-poppins text-lg font-semibold text-forest">
          Appareils enregistrés pour les notifications
        </h2>
        {pushTokens.length === 0 ? (
          <EmptyState
            title="Aucun appareil"
            hint="Les notifications ne fonctionnent pas dans Expo Go : un compte de test peut n’en avoir aucun."
          />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {pushTokens.map((token) => (
              <li key={token.id}>
                <Pill>
                  {token.platform} · <DateCell value={token.createdAt} />
                </Pill>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Legend({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('size-3 rounded-sm', className)} aria-hidden />
      {children}
    </span>
  )
}
