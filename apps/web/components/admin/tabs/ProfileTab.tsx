import { NOTIFICATION_CHANNELS } from '@growi/shared'

import { updateUserProfileAction } from '@/app/actions/admin/users'
import { DateCell, Pill } from '@/components/admin/bits'
import { UserProfileForm } from '@/components/admin/UserProfileForm'
import type { AdminUserDetail } from '@/lib/services/admin-user-detail.service'
import { listUserPlans } from '@/lib/services/admin-user.service'

/** Comment ce compte se connecte — la question qu'on se pose au support. */
function SignInMethods({ user }: { user: AdminUserDetail }) {
  const methods: string[] = []
  if (user.hasPassword) methods.push('Mot de passe')
  for (const provider of user.providers) {
    methods.push(provider === 'apple' ? 'Apple' : provider === 'google' ? 'Google' : provider)
  }

  if (methods.length === 0) {
    // Ni mot de passe ni fournisseur : le compte existe mais personne ne peut
    // y entrer. C'est anormal, et ça se dit.
    return <span className="text-red-700">Aucun moyen de connexion</span>
  }

  return (
    <span className="flex flex-wrap gap-1.5">
      {methods.map((method) => (
        <Pill key={method}>{method}</Pill>
      ))}
    </span>
  )
}

export async function ProfileTab({ user }: { user: AdminUserDetail }) {
  const plans = await listUserPlans()
  const alerts = user.alertConfig

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-forest/10 bg-white p-6">
        <h2 className="mb-4 font-poppins text-lg font-semibold text-forest">Modifier le profil</h2>
        <UserProfileForm
          values={{
            firstName: user.firstName,
            lastName: user.lastName,
            name: user.name,
            email: user.email,
            address: user.address,
            city: user.city,
            gardenType: user.gardenType,
            latitude: user.latitude,
            longitude: user.longitude,
            plan: user.plan,
            timezone: user.timezone,
            onboarded: user.onboarded,
          }}
          plans={plans}
          // L'`userId` est lié **côté serveur** : le client n'envoie que le
          // formulaire, il n'a aucun moyen de désigner un autre compte.
          action={updateUserProfileAction.bind(null, user.id)}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-forest/10 bg-white p-6">
          <h2 className="mb-4 font-poppins text-lg font-semibold text-forest">Compte</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Connexion">
              <SignInMethods user={user} />
            </Row>
            <Row label="Email vérifié">
              <DateCell value={user.emailVerified} fallback="Non" />
            </Row>
            <Row label="Créé le">
              <DateCell value={user.createdAt} withTime />
            </Row>
            <Row label="Modifié le">
              <DateCell value={user.updatedAt} withTime />
            </Row>
            <Row label="Désactivé le">
              <DateCell value={user.disabledAt} withTime fallback="—" />
            </Row>
            <Row label="Identifiant">
              <code className="text-xs text-forest/60">{user.id}</code>
            </Row>
          </dl>
        </section>

        <section className="rounded-2xl border border-forest/10 bg-white p-6">
          <h2 className="mb-4 font-poppins text-lg font-semibold text-forest">
            Préférences d’alertes
          </h2>
          <dl className="space-y-3 text-sm">
            <Row label="Canal">
              <Pill tone={alerts.channel === 'none' ? 'danger' : 'positive'}>
                {NOTIFICATION_CHANNELS.includes(alerts.channel) ? alerts.channel : 'inconnu'}
              </Pill>
            </Row>
            <Row label="Fréquence">{alerts.frequency}</Row>
            <Row label="Heures calmes">
              {alerts.quietHoursEnabled
                ? `${alerts.quietHoursStart} → ${alerts.quietHoursEnd}`
                : 'Désactivées'}
            </Row>
            <Row label="Rappels d’entretien">
              <ReminderPills
                reminders={[
                  ['Arrosage', alerts.wateringReminder],
                  ['Rempotage', alerts.repottingReminder],
                  ['Taille', alerts.pruningReminder],
                  ['Semis', alerts.seedingAlerts],
                  ['Récolte', alerts.harvestAlerts],
                ]}
              />
            </Row>
            <Row label="Alertes météo">
              <ReminderPills
                reminders={[
                  ['Gel', alerts.frostAlert],
                  ['Canicule', alerts.heatAlert],
                  ['Pluie', alerts.rainAlert],
                  ['Vent', alerts.windAlert],
                ]}
              />
            </Row>
          </dl>
        </section>
      </div>
    </div>
  )
}

/**
 * Les rappels actifs. Quand aucun ne l'est, on le dit franchement : c'est la
 * première chose à regarder quand quelqu'un signale ne rien recevoir, et une
 * ligne vide se lit comme « rien à afficher » plutôt que « rien d'actif ».
 */
function ReminderPills({ reminders }: { reminders: [string, boolean][] }) {
  const active = reminders.filter(([, on]) => on)

  if (active.length === 0) {
    return <span className="text-red-700">Aucun — ce compte ne reçoit rien</span>
  }

  return (
    <span className="flex flex-wrap justify-end gap-1.5">
      {active.map(([label]) => (
        <Pill key={label}>{label}</Pill>
      ))}
    </span>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-forest/5 pb-2 last:border-0">
      <dt className="text-forest/55">{label}</dt>
      <dd className="text-right text-forest/85">{children}</dd>
    </div>
  )
}
