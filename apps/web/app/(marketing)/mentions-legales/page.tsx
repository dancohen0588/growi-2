import type { Metadata } from 'next'
import Link from 'next/link'

import { LegalFacts, LegalPage, LegalSection } from '@/components/legal/LegalPage'
import { EDITOR, HOSTS } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Mentions légales — Growi',
  description:
    "Éditeur, directeur de publication, hébergeurs et propriété intellectuelle du site et de l'application Growi.",
}

export default function MentionsLegalesPage() {
  return (
    <LegalPage
      title="Mentions légales"
      intro="Qui édite Growi, qui l'héberge, et à qui s'adresser."
    >
      <LegalSection title="Éditeur">
        <LegalFacts
          facts={[
            { label: 'Dénomination', value: EDITOR.name },
            { label: 'Forme juridique', value: EDITOR.legalForm },
            { label: 'Adresse', value: EDITOR.address },
            { label: 'Immatriculation', value: EDITOR.registration },
            { label: 'TVA intracommunautaire', value: EDITOR.vat },
            { label: 'Contact', value: EDITOR.email },
          ]}
        />
      </LegalSection>

      <LegalSection title="Directeur de la publication">
        <p>{EDITOR.publisher}</p>
      </LegalSection>

      <LegalSection title="Hébergement">
        <p>
          Growi s&apos;appuie sur deux hébergeurs, l&apos;un pour le site et l&apos;API,
          l&apos;autre pour la base de données et les photos.
        </p>
        {HOSTS.map((host) => (
          <LegalFacts
            key={host.name}
            facts={[
              { label: host.role, value: host.name },
              { label: 'Adresse', value: host.address },
              { label: 'Site', value: host.site },
            ]}
          />
        ))}
      </LegalSection>

      <LegalSection title="Propriété intellectuelle">
        <p>
          Le site, l&apos;application, leur code, leurs textes et leur charte graphique sont
          protégés par le droit d&apos;auteur. Toute reproduction ou réutilisation, totale ou
          partielle, sans autorisation écrite de l&apos;éditeur est interdite.
        </p>
        <p>
          Les photographies de plantes du catalogue proviennent d&apos;iNaturalist et de
          Wikimedia Commons, sous licences ouvertes, et restent la propriété de leurs auteurs.
          Les photos que tu ajoutes restent les tiennes : Growi ne fait que les héberger pour
          te les afficher.
        </p>
      </LegalSection>

      <LegalSection title="Données personnelles">
        <p>
          Le traitement de tes données est décrit dans la{' '}
          <Link
            href="/confidentialite"
            className="text-forest underline underline-offset-2"
          >
            politique de confidentialité
          </Link>
          , qui précise ce qui est collecté, pourquoi, combien de temps, et comment exercer tes
          droits.
        </p>
      </LegalSection>

      <LegalSection title="Signaler un contenu">
        <p>
          Pour signaler un contenu illicite ou une erreur, écris à {EDITOR.email}. Nous
          répondons sous 48 heures ouvrées.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
