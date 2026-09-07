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
            Aucun traceur publicitaire, aucun profilage : le seul cookie déposé sert à te garder
            connecté. La fréquentation du site est mesurée sans cookie et sans identifiant.
          </li>
          <li>
            Une personne de l&apos;équipe Growi peut consulter ton compte pour te dépanner ; ces
            accès sont tracés.
          </li>
          <li>
            La communauté est facultative. Tant que tu ne l&apos;as pas activée, rien de toi
            n&apos;est visible — et même activée, ton adresse n&apos;est jamais partagée.
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
            <strong>Consentement</strong> — localisation, accès à l&apos;appareil photo et
            notifications de rappel. Tu les autorises, et tu peux les retirer à tout moment
            depuis les réglages de ton téléphone ou ton profil.
          </li>
          <li>
            <strong>Intérêt légitime</strong> — sécurité des comptes, prévention des abus (dont
            le plafond de l&apos;identification sans compte), modération des contenus signalés,
            journaux techniques.
          </li>
          <li>
            <strong>Consentement, pour la communauté</strong> — le profil public et tout ce
            qu&apos;il rend visible reposent sur ton activation explicite. Le retirer désactive
            le profil et retire tes contenus de la vue.
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
        <p>
          L&apos;identification est aussi accessible <strong>sans compte</strong>, depuis la
          page{' '}
          <Link href="/identifier" className="text-forest underline underline-offset-2">
            Identifier une plante
          </Link>
          . Chaque analyse ayant un coût, le nombre d&apos;identifications quotidiennes y est
          plafonné. Pour le compter sans compte à quoi le rattacher, une <em>empreinte</em> de
          ton adresse IP est conservée avec un compteur : l&apos;adresse elle-même n&apos;est
          jamais enregistrée, et les compteurs de la veille sont effacés. Cette empreinte ne
          sert qu&apos;à ce plafond — ni à te reconnaître, ni à te suivre d&apos;une visite à
          l&apos;autre.
        </p>
      </LegalSection>

      <LegalSection title="La communauté, et ce qu’elle rend public">
        <p>
          La communauté est <strong>facultative et désactivée par défaut</strong>. Tant que tu
          n&apos;as pas choisi un pseudo et activé ton profil public, tu n&apos;y apparais pas :
          personne ne peut te trouver, et rien de toi n&apos;est publié.
        </p>
        <p>
          Une fois le profil activé, deviennent visibles de tous — y compris de personnes non
          inscrites et des moteurs de recherche : ton <strong>pseudo</strong>, ta présentation,
          ton avatar, la <strong>ville</strong> que tu as renseignée, tes compteurs
          d&apos;abonnés et de publications, et les publications, commentaires et annonces que
          tu choisis de faire.
        </p>
        <p>
          Restent privés, quoi qu&apos;il arrive : ton nom, ton prénom, ton adresse e-mail, ton
          adresse postale, tes jardins, tes plantes, ton journal d&apos;entretien et tes
          diagnostics.
        </p>
        <p>
          <strong>Ta position n&apos;est jamais publiée telle quelle.</strong> Growi en calcule
          une version volontairement imprécise : elle est arrondie sur une grille d&apos;environ
          un kilomètre, puis décalée d&apos;un écart qui t&apos;est propre. Cet écart est
          toujours le même pour toi — c&apos;est délibéré : s&apos;il changeait à chaque
          publication, il suffirait d&apos;en moyenner quelques-unes pour retrouver ton jardin.
          Cette position approchée n&apos;est jamais affichée sous forme de coordonnées : les
          autres ne lisent qu&apos;une distance arrondie, du type « à ~3 km ». Elle est
          recalculée si tu changes d&apos;adresse.
        </p>
        <p>
          Les photos que tu publies dans la communauté sont des <strong>copies</strong> : elles
          ne sont pas liées à la photo de ta plante, et supprimer la plante ne les efface pas.
          Supprimer la publication, si.
        </p>
        <p>
          Tu peux quitter la communauté à tout moment depuis tes réglages : ton profil et tes
          publications cessent d&apos;être visibles, sans rien perdre — tu peux revenir. Tu peux
          aussi supprimer chaque publication et chaque annonce individuellement, ce qui efface
          leurs photos du stockage.
        </p>
      </LegalSection>

      <LegalSection title="Signalement, blocage et modération">
        <p>
          Quand tu signales un contenu, nous conservons le motif choisi, la note que tu écris
          éventuellement, et la date. Le compte signalé n&apos;est <strong>pas</strong> informé
          de qui l&apos;a signalé.
        </p>
        <p>
          Un contenu signalé par plusieurs personnes distinctes est masqué automatiquement le
          temps d&apos;une vérification, et son auteur en est informé — sans savoir qui a
          signalé. Les décisions de modération prises par l&apos;équipe sont inscrites dans le
          journal interne évoqué plus bas.
        </p>
        <p>
          Bloquer un compte crée un enregistrement qui associe ton compte au sien, le temps que
          le blocage dure. Il disparaît si tu le retires.
        </p>
        <p>
          Les messages échangés au sujet d&apos;une annonce sont privés entre leurs deux
          participants. L&apos;équipe ne les lit pas : un message signalé arrive dans la file de
          modération avec son motif, mais son contenu n&apos;y est pas affiché — la décision
          porte alors sur le compte.
        </p>
      </LegalSection>

      <LegalSection title="Notifications">
        <p>
          Si tu actives les rappels dans l&apos;application mobile, ton téléphone remet un
          jeton de notification que nous conservons pour t&apos;écrire. Les rappels transitent
          par le service Expo Push, qui reçoit ce jeton et le texte du rappel — le nom de la
          plante et le geste à faire.
        </p>
        <p>
          Tu peux couper les rappels à tout moment, depuis ton profil ou les réglages de ton
          téléphone. Le jeton est alors supprimé, comme il l&apos;est à la déconnexion ou
          lorsque l&apos;appareil nous est signalé comme désinstallé.
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

      <LegalSection title="Cookies et mesure d’audience">
        <p>
          Growi dépose un seul cookie, strictement nécessaire : celui de ta session, qui te
          garde connecté d&apos;une page à l&apos;autre. Il disparaît à la déconnexion. Aucun
          cookie publicitaire, aucun traceur tiers.
        </p>
        <p>
          La fréquentation des pages est mesurée avec Vercel Web Analytics, qui{' '}
          <strong>ne dépose aucun cookie</strong>, ne crée aucun identifiant persistant et ne
          permet pas de te reconnaître d&apos;une visite à l&apos;autre. Il compte des pages
          vues, pas des personnes. C&apos;est pourquoi aucune bannière de consentement ne
          t&apos;est présentée.
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
          directement tes jardins, tes plantes, tes publications et tes annonces depuis
          l&apos;application — la suppression est immédiate et définitive, y compris pour les
          fichiers. Supprimer ton compte efface également les commentaires que tu as laissés
          sous les publications d&apos;autres jardiniers.
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

      <LegalSection title="Qui, chez Growi, accède à tes données">
        <p>
          Un nombre restreint de personnes de l&apos;équipe disposent d&apos;un accès
          d&apos;administration, réservé au support : répondre à un message, comprendre pourquoi
          un rappel ne part pas, corriger une donnée à ta demande.
        </p>
        <p>
          Cet accès permet de consulter ton profil, tes jardins, tes plantes, tes diagnostics,
          tes échanges avec l&apos;assistant et, si tu as rejoint la communauté, ton profil
          public, tes publications, tes annonces et les signalements qui les visent. Il ne
          donne <strong>jamais</strong> accès au contenu de tes messages privés, ni
          <strong> jamais</strong> accès à ton mot
          de passe, qui n&apos;est stocké que sous forme d&apos;empreinte et n&apos;est lisible
          par personne — pas même par nous.
        </p>
        <p>
          Chaque action d&apos;administration qui modifie un compte est inscrite dans un journal
          interne inaltérable : qui, quoi, quand. Un administrateur peut désactiver un compte,
          ce qui en bloque l&apos;accès sans rien supprimer. Pour demander la suppression de tes
          données, écris à {EDITOR.email}.
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
