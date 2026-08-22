import type { Metadata } from 'next'
import Link from 'next/link'

import { LegalPage, LegalSection } from '@/components/legal/LegalPage'
import { EDITOR } from '@/lib/legal'

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation — Growi",
  description:
    "Les règles d'usage de Growi : compte, contenus, abonnement, responsabilité et résiliation.",
}

export default function CguPage() {
  return (
    <LegalPage
      title="Conditions générales d'utilisation"
      intro="Ce que Growi s'engage à faire, ce qu'on attend de toi, et ce qui se passe si ça se passe mal."
    >
      <LegalSection title="1. Objet">
        <p>
          Ces conditions régissent l&apos;usage du site et de l&apos;application Growi, édités
          par {EDITOR.name}. Créer un compte vaut acceptation.
        </p>
      </LegalSection>

      <LegalSection title="2. Le service">
        <p>
          Growi aide à entretenir un jardin : cartographie des zones, suivi des plantes,
          rappels d&apos;arrosage calés sur la météo locale, identification d&apos;espèces par
          photo et journal d&apos;entretien.
        </p>
        <p>
          Les conseils sont générés automatiquement à partir de la météo, du catalogue
          d&apos;espèces et de ce que tu renseignes. Ce sont des indications, pas un avis
          d&apos;expert : une plante peut avoir des besoins que le service ignore, et
          l&apos;identification par photo peut se tromper. Tu restes seul juge de ce que tu
          fais de ton jardin — a fortiori pour une plante toxique, une espèce protégée ou un
          traitement phytosanitaire.
        </p>
      </LegalSection>

      <LegalSection title="3. Compte">
        <p>
          La création d&apos;un compte demande une adresse e-mail valide et un mot de passe. Tu
          es responsable de sa confidentialité et des actions menées depuis ton compte. En cas
          de soupçon d&apos;accès frauduleux, préviens-nous à {EDITOR.email} : nous pouvons
          révoquer toutes les sessions.
        </p>
        <p>Le service est réservé aux personnes de 15 ans et plus.</p>
      </LegalSection>

      <LegalSection title="4. Tes contenus">
        <p>
          Les photos, noms et notes que tu déposes restent ta propriété. Tu accordes à Growi le
          droit de les héberger et de les afficher, uniquement pour te rendre le service. Nous
          ne les publions nulle part, ne les cédons à personne et ne les utilisons pas pour
          entraîner un modèle.
        </p>
        <p>
          Tu t&apos;engages à ne déposer que des contenus dont tu détiens les droits, et à ne
          pas y faire figurer de données personnelles de tiers.
        </p>
      </LegalSection>

      <LegalSection title="5. Usage raisonnable">
        <p>
          L&apos;identification par photo et l&apos;envoi de photos sont limités à trente
          requêtes par heure et par compte : chaque analyse a un coût. Sont interdits
          l&apos;automatisation des appels à l&apos;API, la revente du service, et toute
          tentative de contourner ces limites ou d&apos;accéder aux données d&apos;autrui.
        </p>
      </LegalSection>

      <LegalSection title="6. Abonnement">
        <p>
          Growi propose une offre gratuite et, à terme, une offre payante dont les
          fonctionnalités et le prix seront détaillés sur la page{' '}
          <Link href="/tarifs" className="text-forest underline underline-offset-2">
            Tarifs
          </Link>
          . Un abonnement souscrit depuis l&apos;App Store ou Google Play est facturé et résilié
          selon les règles de la boutique concernée.
        </p>
        <p>
          Le droit de rétractation de quatorze jours s&apos;applique aux consommateurs, sauf
          renoncement exprès au début de l&apos;exécution du service.
        </p>
      </LegalSection>

      <LegalSection title="7. Disponibilité">
        <p>
          Growi met tout en œuvre pour que le service reste accessible, sans garantir une
          disponibilité ininterrompue. Les maintenances, pannes d&apos;un hébergeur ou
          indisponibilités d&apos;un service tiers — météo, identification — peuvent
          l&apos;interrompre temporairement.
        </p>
      </LegalSection>

      <LegalSection title="8. Responsabilité">
        <p>
          La responsabilité de l&apos;éditeur ne saurait être engagée pour les dommages causés
          à des végétaux, des biens ou des personnes à la suite d&apos;un conseil du service,
          d&apos;une identification erronée, ou de l&apos;absence d&apos;un rappel. Aucune
          disposition n&apos;écarte la responsabilité en cas de faute lourde ou de dommage
          corporel.
        </p>
      </LegalSection>

      <LegalSection title="9. Résiliation">
        <p>
          Tu peux fermer ton compte à tout moment en écrivant à {EDITOR.email} : tes données et
          tes photos sont alors supprimées. L&apos;éditeur peut suspendre un compte en cas de
          manquement à ces conditions, après t&apos;en avoir informé sauf urgence.
        </p>
      </LegalSection>

      <LegalSection title="10. Droit applicable">
        <p>
          Ces conditions sont soumises au droit français. En cas de litige, une solution
          amiable sera recherchée avant toute action ; à défaut, les tribunaux français sont
          compétents. Les consommateurs peuvent recourir gratuitement à un médiateur de la
          consommation.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
