import type { Metadata } from 'next'
import Link from 'next/link'

import { LegalPage, LegalSection } from '@/components/legal/LegalPage'
import { DATA_COLLECTED, EDITOR, PROCESSORS } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Growi',
  description:
    "Ce que Growi collecte, pourquoi, combien de temps, avec qui c'est partagé, et comment exercer tes droits.",
}

export default function ConfidentialitePage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      intro="Ce que Growi sait de toi, pourquoi, et ce que tu peux en faire. Sans jargon inutile."
    >
      <LegalSection title="En résumé">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>Growi ne vend aucune donnée et n&apos;affiche aucune publicité.</li>
          <li>
            Aucun traceur publicitaire, aucun outil de mesure d&apos;audience tiers : le seul
            cookie déposé sert à te garder connecté.
          </li>
          <li>
            Tes données de jardin vivent dans l&apos;Union européenne (Irlande). Quelques
            prestataires, listés plus bas, sont établis aux États-Unis.
          </li>
          <li>
            Tu peux consulter, corriger, exporter ou supprimer tes données à tout moment en
            écrivant à {EDITOR.email}.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Responsable du traitement">
        <p>
          {EDITOR.name}, éditeur de Growi, dont les coordonnées figurent dans les{' '}
          <Link
            href="/mentions-legales"
            className="text-forest underline underline-offset-2"
          >
            mentions légales
          </Link>
          . Pour toute question relative à tes données : {EDITOR.email}.
        </p>
      </LegalSection>

      <LegalSection title="Ce que nous collectons, et pourquoi">
        <p>
          Rien n&apos;est collecté « au cas où » : chaque donnée ci-dessous sert une
          fonctionnalité que tu utilises.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-forest/15">
                <th className="py-2 pr-4 font-poppins text-sm font-semibold text-forest">
                  Catégorie
                </th>
                <th className="py-2 pr-4 font-poppins text-sm font-semibold text-forest">
                  Données
                </th>
                <th className="py-2 pr-4 font-poppins text-sm font-semibold text-forest">
                  Finalité
                </th>
                <th className="py-2 font-poppins text-sm font-semibold text-forest">
                  Conservation
                </th>
              </tr>
            </thead>
            <tbody>
              {DATA_COLLECTED.map((row) => (
                <tr key={row.category} className="border-b border-forest/10 align-top">
                  <td className="py-3 pr-4 font-raleway text-sm font-semibold text-forest">
                    {row.category}
                  </td>
                  <td className="py-3 pr-4 font-raleway text-sm text-forest/80">{row.items}</td>
                  <td className="py-3 pr-4 font-raleway text-sm text-forest/80">{row.why}</td>
                  <td className="py-3 font-raleway text-sm text-forest/60">{row.retention}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </LegalSection>

      <LegalSection title="Bases légales">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Exécution du contrat</strong> — compte, jardins, plantes, rappels
            d&apos;entretien : sans ces données, le service ne peut pas fonctionner.
          </li>
          <li>
            <strong>Consentement</strong> — localisation, accès à l&apos;appareil photo et,
            à venir, notifications. Tu les autorises, et tu peux les retirer à tout moment
            depuis les réglages de ton téléphone ou ton profil.
          </li>
          <li>
            <strong>Intérêt légitime</strong> — sécurité des comptes, prévention des abus,
            journaux techniques.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Photos et identification">
        <p>
          Quand tu demandes l&apos;identification d&apos;une plante, la photo est transmise à
          l&apos;API Gemini de Google, qui la traite pour reconnaître l&apos;espèce. Elle part
          seule : ni ton nom, ni ton adresse e-mail, ni ta position ne l&apos;accompagnent.
        </p>
        <p>
          Les photos que tu conserves sur tes plantes sont hébergées chez Supabase, dans un
          espace dont les adresses ne sont pas devinables. Elles sont supprimées lorsque tu
          supprimes la plante, le geste associé, ou lorsque tu les remplaces.
        </p>
      </LegalSection>

      <LegalSection title="Prestataires">
        <p>
          Growi s&apos;appuie sur les prestataires suivants, qui n&apos;utilisent tes données
          que pour la prestation décrite.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-forest/15">
                <th className="py-2 pr-4 font-poppins text-sm font-semibold text-forest">
                  Prestataire
                </th>
                <th className="py-2 pr-4 font-poppins text-sm font-semibold text-forest">
                  Rôle
                </th>
                <th className="py-2 pr-4 font-poppins text-sm font-semibold text-forest">
                  Données concernées
                </th>
                <th className="py-2 font-poppins text-sm font-semibold text-forest">Lieu</th>
              </tr>
            </thead>
            <tbody>
              {PROCESSORS.map((row) => (
                <tr key={row.name} className="border-b border-forest/10 align-top">
                  <td className="py-3 pr-4 font-raleway text-sm font-semibold text-forest">
                    {row.name}
                  </td>
                  <td className="py-3 pr-4 font-raleway text-sm text-forest/80">{row.role}</td>
                  <td className="py-3 pr-4 font-raleway text-sm text-forest/80">{row.data}</td>
                  <td className="py-3 font-raleway text-sm text-forest/60">{row.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p>
          Les transferts hors Union européenne s&apos;appuient sur les clauses contractuelles
          types de la Commission européenne, prévues aux contrats de ces prestataires.
        </p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Growi dépose un seul cookie, strictement nécessaire : celui de ta session, qui te
          garde connecté d&apos;une page à l&apos;autre. Il n&apos;alimente aucune mesure
          d&apos;audience et disparaît à la déconnexion. Aucun cookie publicitaire, aucun
          traceur tiers — c&apos;est pourquoi aucune bannière de consentement ne t&apos;est
          présentée.
        </p>
        <p>
          Dans l&apos;application mobile, la session est conservée dans le trousseau sécurisé
          de ton téléphone, et non dans un cookie.
        </p>
      </LegalSection>

      <LegalSection title="Tes droits">
        <p>
          Le règlement européen te donne le droit d&apos;accéder à tes données, de les
          rectifier, de les effacer, d&apos;en limiter le traitement, de t&apos;y opposer et
          d&apos;en demander une copie portable.
        </p>
        <p>
          Écris à {EDITOR.email} : nous répondons sous un mois. Tu peux aussi supprimer
          directement tes jardins, tes plantes et leurs photos depuis l&apos;application — la
          suppression est immédiate et définitive, y compris pour les fichiers.
        </p>
        <p>
          Si notre réponse ne te convient pas, tu peux saisir la CNIL (
          <a
            href="https://www.cnil.fr"
            className="text-forest underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            cnil.fr
          </a>
          ).
        </p>
      </LegalSection>

      <LegalSection title="Sécurité">
        <p>
          Les mots de passe sont stockés sous forme d&apos;empreinte bcrypt, jamais en clair.
          Les jetons de connexion mobile ne sont pas conservés : seule leur empreinte l&apos;est,
          et présenter un jeton déjà utilisé révoque toutes les sessions du compte. Les échanges
          passent exclusivement par HTTPS.
        </p>
      </LegalSection>

      <LegalSection title="Enfants">
        <p>
          Growi n&apos;est pas destiné aux moins de 15 ans et ne collecte pas sciemment leurs
          données. Si tu constates le contraire, signale-le à {EDITOR.email} : le compte sera
          supprimé.
        </p>
      </LegalSection>

      <LegalSection title="Évolutions">
        <p>
          Cette politique peut évoluer avec le service. Tout changement notable te sera signalé
          dans l&apos;application ou par e-mail avant son entrée en vigueur.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
