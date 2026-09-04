import {
  disableUserAction,
  enableUserAction,
  resetAdviceAction,
  revokeMobileSessionsAction,
} from '@/app/actions/admin/users'
import { ActionButton } from '@/components/admin/ActionButton'
import type { AdminUserDetail } from '@/lib/services/admin-user-detail.service'

/**
 * Les gestes d'administration sur un compte.
 *
 * Ils sont rangés du plus anodin au plus destructeur, et chacun dit ce qu'il
 * fait **avant** de le faire. Les trois niveaux de réinitialisation ne
 * s'emboîtent pas : le niveau 3 ne purge pas les tâches du niveau 2.
 */
export function ActionsTab({ user }: { user: AdminUserDetail }) {
  return (
    <div className="space-y-6">
      <Group
        title="Recommandations"
        hint="À utiliser quand quelqu’un signale un planning qui ne se met pas à jour."
      >
        <ActionButton
          label="Recalculer les conseils"
          description="Vide le cache des jardins. Rien n’est perdu."
          action={resetAdviceAction.bind(null, user.id, 1)}
        />

        <ActionButton
          label="Purger les tâches planifiées"
          description="Supprime les tâches ouvertes ; celles déjà faites restent."
          tone="danger"
          action={resetAdviceAction.bind(null, user.id, 2)}
          confirm={{
            title: 'Purger les tâches ouvertes ?',
            body: "Les tâches non terminées de ce compte seront supprimées. Les tâches déjà faites sont conservées : ce sont des faits. L'action est irréversible.",
            cta: 'Purger',
          }}
        />

        <ActionButton
          label="Remettre à zéro le suivi d’entretien"
          description="Efface les dates de dernier arrosage, taille, fertilisation… sur toutes les plantes."
          tone="danger"
          action={resetAdviceAction.bind(null, user.id, 3)}
          confirmPhrase="RESET"
          confirm={{
            title: 'Remettre à zéro le suivi d’entretien ?',
            body: `Les dates de dernier geste seront effacées sur les ${user.counts.plants} plante(s) de ce compte. Les gestes notés au journal sont conservés — seul ce que le moteur en avait retenu est remis à zéro. L'action est irréversible.`,
            cta: 'Remettre à zéro',
          }}
        />
      </Group>

      <Group
        title="Sessions"
        hint="Après un téléphone perdu, ou pour forcer une reconnexion."
      >
        <ActionButton
          label="Révoquer les sessions mobiles"
          description="L’utilisateur devra se reconnecter sur ses appareils."
          action={revokeMobileSessionsAction.bind(null, user.id)}
          confirm={{
            title: 'Révoquer les sessions mobiles ?',
            body: 'Toutes les sessions de l’app seront coupées. L’utilisateur se reconnectera avec ses identifiants habituels.',
            cta: 'Révoquer',
          }}
        />
      </Group>

      <Group
        title="Accès au compte"
        hint="La désactivation conserve toutes les données ; elle ferme seulement la porte."
      >
        {user.disabledAt ? (
          <ActionButton
            label="Réactiver le compte"
            description="L’utilisateur pourra se reconnecter."
            action={enableUserAction.bind(null, user.id)}
            confirm={{
              title: 'Réactiver ce compte ?',
              body: 'La connexion sera de nouveau possible. Les sessions révoquées ne reviennent pas : l’utilisateur se reconnectera.',
              cta: 'Réactiver',
            }}
          />
        ) : (
          <ActionButton
            label="Désactiver le compte"
            description="Connexion refusée, sessions coupées, notifications débranchées. Données conservées."
            tone="danger"
            action={disableUserAction.bind(null, user.id)}
            confirmPhrase={user.email}
            confirm={{
              title: 'Désactiver ce compte ?',
              body: "L'utilisateur ne pourra plus se connecter, ses sessions mobiles seront coupées et ses appareils ne recevront plus de notifications. Aucune donnée n'est supprimée, et l'action se défait.",
              cta: 'Désactiver',
            }}
          />
        )}
      </Group>
    </div>
  )
}

function Group({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-2xl border border-forest/10 bg-white p-6">
      <h2 className="font-poppins text-lg font-semibold text-forest">{title}</h2>
      <p className="mb-4 text-sm text-forest/55">{hint}</p>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
