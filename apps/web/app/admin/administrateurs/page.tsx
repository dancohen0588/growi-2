import Link from 'next/link'

import { demoteAdminAction, promoteAdminAction } from '@/app/actions/admin/admins'
import { ActionButton } from '@/components/admin/ActionButton'
import { DateCell, EmptyState, PageHeader, Pill } from '@/components/admin/bits'
import { PromoteAdminForm } from '@/components/admin/PromoteAdminForm'
import { requireAdmin } from '@/lib/admin/auth'
import { listAdminsWithPromotion } from '@/lib/admin/roles'
import { displayNameOf } from '@/lib/admin/serializers'

export const dynamic = 'force-dynamic'

export default async function AdminAdminsPage() {
  const me = await requireAdmin()
  const admins = await listAdminsWithPromotion()

  const isLast = admins.length <= 1

  return (
    <>
      <PageHeader
        title="Administrateurs"
        description="Les comptes qui accèdent à ce portail. Toute promotion et tout retrait sont journalisés."
      />

      <section className="mb-6 rounded-2xl border border-forest/10 bg-white p-6">
        <h2 className="mb-1 font-poppins text-base font-semibold text-forest">
          Ajouter un administrateur
        </h2>
        <p className="mb-4 text-sm text-forest/55">
          Le compte doit déjà exister : on promeut une personne inscrite, jamais une adresse.
        </p>
        <PromoteAdminForm action={promoteAdminAction} />
      </section>

      {admins.length === 0 ? (
        <div className="rounded-2xl border border-forest/10 bg-white p-10 text-center">
          <EmptyState
            title="Aucun administrateur"
            hint="Situation anormale : ce portail devrait être inaccessible."
          />
        </div>
      ) : (
        <ul className="space-y-4">
          {admins.map((admin) => {
            const isMe = admin.id === me.id

            return (
              <li
                key={admin.id}
                className="rounded-2xl border border-forest/10 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-poppins text-base font-semibold text-forest">
                      <Link
                        href={`/admin/utilisateurs/${admin.id}`}
                        className="hover:underline"
                      >
                        {displayNameOf(admin)}
                      </Link>
                      {isMe && <Pill tone="positive">Toi</Pill>}
                      {admin.disabledAt && <Pill tone="danger">Désactivé</Pill>}
                    </p>
                    <p className="truncate text-sm text-forest/55">{admin.email}</p>

                    <p className="mt-2 text-sm text-forest/55">
                      {admin.promotedAt ? (
                        <>
                          Promu le <DateCell value={admin.promotedAt} withTime />
                          {admin.promotedBy && <> par {admin.promotedBy.email}</>}
                        </>
                      ) : (
                        // Le modèle `User` ne garde qu'un rôle, sans mémoire de
                        // qui l'a posé : l'information vient du journal, qui ne
                        // couvre pas le script d'amorçage. On le dit.
                        <>Promu avant la mise en place du journal, ou par le script d’amorçage.</>
                      )}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {isMe ? (
                      <p className="text-sm text-forest/45">
                        Tu ne peux pas retirer tes propres droits.
                      </p>
                    ) : isLast ? (
                      <p className="text-sm text-forest/45">Dernier administrateur.</p>
                    ) : (
                      <ActionButton
                        label="Retirer les droits"
                        tone="danger"
                        action={demoteAdminAction.bind(null, admin.id)}
                        confirm={{
                          title: 'Retirer les droits d’administrateur ?',
                          body: `${admin.email} n’aura plus accès à ce portail. Son compte Growi et ses données restent intacts, et les droits peuvent être rendus à tout moment.`,
                          cta: 'Retirer',
                        }}
                      />
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-6 max-w-prose text-sm text-forest/55">
        On ne retire ni ses propres droits, ni ceux du dernier administrateur : le portail
        deviendrait inaccessible, et il faudrait un accès à la base de production pour en sortir.
        Le cas échéant, la commande <code>pnpm --filter web admin:promote &lt;email&gt;</code>
        reste la voie de secours.
      </p>
    </>
  )
}
