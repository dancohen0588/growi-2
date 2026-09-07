import type { Metadata } from 'next'

import { LegalPage, LegalSection } from '@/components/legal/LegalPage'
import { EDITOR } from '@/lib/legal'

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation — Growi",
  description:
    "Les règles d'usage de Growi : compte, contenus, communauté, échanges entre jardiniers, prix, responsabilité et résiliation.",
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
          Growi propose également une <strong>communauté locale</strong> : un profil public
          facultatif, un fil des publications des jardiniers proches, et une bourse d&apos;échange
          de graines, plants, boutures, récoltes et matériel. Les sections 5 à 7 lui sont
          consacrées.
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

      {/* La rédaction d'origine affirmait « Nous ne les publions nulle part ».
          C'était vrai tant que Growi était strictement individuel ; la
          communauté l'a rendu faux, et une clause fausse ne protège personne.
          La distinction contenus privés / contenus publiés est désormais la
          charnière de cette section. */}
      <LegalSection title="4. Tes contenus">
        <p>
          Les photos, noms et notes que tu déposes restent ta propriété. Tu accordes à Growi le
          droit de les héberger et de les afficher, uniquement pour te rendre le service. Nous
          ne les cédons à personne et ne les utilisons pas pour entraîner un modèle.
        </p>
        <p>
          <strong>
            Tes jardins, tes plantes, ton journal d&apos;entretien et tes diagnostics sont
            privés.
          </strong>{' '}
          Ils ne sont visibles que de toi. Seuls sont rendus publics les contenus que tu publies
          délibérément dans la communauté — publications, commentaires, annonces — ainsi que ton
          profil public, et seulement si tu l&apos;as activé.
        </p>
        <p>
          Tu t&apos;engages à ne déposer que des contenus dont tu détiens les droits, et à ne
          pas y faire figurer de données personnelles de tiers — notamment le visage ou la
          propriété d&apos;un voisin sans son accord.
        </p>
      </LegalSection>

      <LegalSection title="5. Profil public et communauté">
        <p>
          La communauté est <strong>facultative</strong>. Tant que tu n&apos;as pas activé ton
          profil public, tu n&apos;y apparais pas, et personne ne peut te trouver.
        </p>
        <p>
          Une fois le profil activé, deviennent visibles de tous, y compris de personnes non
          inscrites et des moteurs de recherche : ton pseudo, ta présentation, ton avatar, la
          ville que tu as renseignée, tes compteurs d&apos;abonnés et de publications, et les
          publications que tu choisis de faire.
        </p>
        <p>
          <strong>Ton adresse n&apos;est jamais partagée.</strong> La communauté n&apos;utilise
          qu&apos;une position approchée, calculée à partir de la tienne et volontairement
          imprécise d&apos;environ un kilomètre. Elle n&apos;est jamais affichée sous forme de
          coordonnées : les autres ne voient qu&apos;une distance arrondie, du type « à ~3 km ».
          Ton nom, ton prénom et ton adresse e-mail restent privés.
        </p>
        <p>
          Tu peux quitter la communauté à tout moment depuis tes réglages : ton profil et tes
          publications cessent alors d&apos;être visibles. Rien n&apos;est supprimé — tu peux
          revenir — et tu peux par ailleurs supprimer chacune de tes publications
          individuellement.
        </p>
        <p>
          Les abonnements sont unilatéraux et ne demandent pas ton accord : un profil public est
          public. Si tu ne souhaites pas qu&apos;un compte te suive ou te voie, tu peux le
          bloquer (section 7).
        </p>
      </LegalSection>

      <LegalSection title="6. Échanges entre jardiniers">
        <p>
          La bourse permet de <strong>donner, échanger ou rechercher</strong> des graines,
          plants, boutures, récoltes et matériel de jardinage. Elle ne permet pas de vendre.
        </p>
        <p>
          <strong>Growi ne gère aucun paiement</strong> et n&apos;est partie à aucun échange.
          Les annonces sont publiées par leurs auteurs, sous leur seule responsabilité ; Growi
          ne vérifie ni l&apos;existence, ni l&apos;état, ni la conformité de ce qui est
          proposé. Aucune transaction financière ne doit être conclue par l&apos;intermédiaire
          du service : si un autre utilisateur te réclame de l&apos;argent, signale-le.
        </p>
        <p>Sont notamment interdits dans les annonces :</p>
        <ul>
          <li>toute contrepartie financière, sous quelque forme que ce soit ;</li>
          <li>
            les semences et plants d&apos;<strong>espèces protégées</strong> ou dont la cession
            est réglementée ;
          </li>
          <li>
            les <strong>espèces exotiques envahissantes</strong> dont l&apos;introduction, le
            transport ou la cession sont interdits ;
          </li>
          <li>
            les <strong>produits phytosanitaires</strong>, engrais réglementés, substances
            dangereuses et médicaments ;
          </li>
          <li>tout objet dont la cession entre particuliers est interdite ou réglementée.</li>
        </ul>
        <p>
          Il t&apos;appartient de vérifier que ce que tu proposes peut légalement être cédé. La
          cession gratuite de semences entre jardiniers amateurs est autorisée en France ; leur
          vente est encadrée.
        </p>
        <p>
          <strong>Les échanges se font en personne, à tes risques.</strong> Nous te
          recommandons de convenir d&apos;un rendez-vous dans un lieu public, de ne pas
          communiquer ton adresse tant que tu ne le souhaites pas, et de ne jamais te rendre
          seul à un rendez-vous si tu as le moindre doute. Growi n&apos;organise pas ces
          rencontres et ne peut en répondre.
        </p>
      </LegalSection>

      <LegalSection title="7. Règles de la communauté, signalement et modération">
        <p>Dans la communauté, il est interdit de publier :</p>
        <ul>
          <li>des propos injurieux, haineux, discriminatoires, menaçants ou harcelants ;</li>
          <li>des contenus à caractère sexuel, violent ou manifestement inappropriés ;</li>
          <li>de la publicité, du démarchage commercial ou du contenu répétitif ;</li>
          <li>
            les données personnelles d&apos;un tiers — adresse, téléphone, photo identifiable —
            sans son accord ;
          </li>
          <li>des contenus dont tu ne détiens pas les droits.</li>
        </ul>
        <p>
          <strong>Signaler.</strong> Chaque publication, commentaire, annonce et compte peut
          être signalé depuis l&apos;application, avec un motif. Un contenu signalé par
          plusieurs personnes distinctes est <strong>masqué automatiquement</strong> le temps
          d&apos;une vérification humaine ; son auteur en est informé. Un masquage automatique
          n&apos;est pas une sanction : il précède la revue et peut être levé.
        </p>
        <p>
          <strong>Bloquer.</strong> Tu peux bloquer un compte à tout moment. Le blocage est
          réciproque dans ses effets : vous cessez de voir vos contenus respectifs, vos
          abonnements sont rompus, et l&apos;autre ne peut plus t&apos;écrire.
        </p>
        <p>
          <strong>Modération.</strong> Les signalements sont examinés par l&apos;éditeur, qui
          peut masquer un contenu, le rétablir, ou suspendre un compte en cas de manquement
          grave ou répété. Certains mots sont par ailleurs refusés à la saisie. Les décisions
          de modération sont journalisées.
        </p>
        <p>
          Si tu contestes une décision, écris-nous à {EDITOR.email} : nous réexaminons et te
          répondons.
        </p>
      </LegalSection>

      <LegalSection title="8. Usage raisonnable">
        <p>
          L&apos;identification par photo et l&apos;envoi de photos sont limités à trente
          requêtes par heure et par compte : chaque analyse a un coût. La communauté est soumise
          à des plafonds du même ordre — nombre de publications par jour, de commentaires par
          heure, d&apos;annonces simultanées — destinés à contenir le spam ; un usage normal ne
          les atteint pas.
        </p>
        <p>
          Sont interdits l&apos;automatisation des appels à l&apos;API, la revente du service,
          la collecte automatisée des profils ou des annonces, et toute tentative de contourner
          ces limites ou d&apos;accéder aux données d&apos;autrui.
        </p>
      </LegalSection>

      {/* La section décrivait un abonnement, une facturation par les boutiques
          et un droit de rétractation. Rien de tout cela n'existe : il n'y a ni
          paiement, ni offre. Des conditions qui régissent une relation
          commerciale inexistante n'engagent personne et brouillent le reste. */}
      <LegalSection title="9. Prix">
        <p>
          Le service est gratuit pendant la bêta. Aucun moyen de paiement n&apos;est
          demandé, et aucune fonctionnalité n&apos;est réservée à une offre payante.
        </p>
        <p>
          Des offres payantes pourront être introduites par la suite. Elles feront
          l&apos;objet d&apos;une information préalable et de conditions mises à jour ;
          aucun paiement ne peut être déclenché sans ton accord exprès.
        </p>
      </LegalSection>

      <LegalSection title="10. Disponibilité">
        <p>
          Growi met tout en œuvre pour que le service reste accessible, sans garantir une
          disponibilité ininterrompue. Les maintenances, pannes d&apos;un hébergeur ou
          indisponibilités d&apos;un service tiers — météo, identification — peuvent
          l&apos;interrompre temporairement.
        </p>
      </LegalSection>

      <LegalSection title="11. Responsabilité">
        <p>
          La responsabilité de l&apos;éditeur ne saurait être engagée pour les dommages causés
          à des végétaux, des biens ou des personnes à la suite d&apos;un conseil du service,
          d&apos;une identification erronée, ou de l&apos;absence d&apos;un rappel.
        </p>
        <p>
          S&apos;agissant de la communauté, l&apos;éditeur héberge les contenus publiés par les
          utilisateurs sans les contrôler a priori. Il ne répond pas des propos, annonces,
          échanges et rencontres entre utilisateurs, ni de la qualité, de la légalité ou de
          l&apos;état de ce qui est cédé. Il intervient sur signalement, dans les conditions de
          la section 7.
        </p>
        <p>
          Aucune disposition n&apos;écarte la responsabilité en cas de faute lourde ou de
          dommage corporel.
        </p>
      </LegalSection>

      <LegalSection title="12. Résiliation">
        <p>
          Tu peux fermer ton compte à tout moment en écrivant à {EDITOR.email} : tes données,
          tes photos, tes publications et tes annonces sont alors supprimées. Les commentaires
          que tu as laissés sous les publications d&apos;autres jardiniers le sont également.
        </p>
        <p>
          L&apos;éditeur peut suspendre un compte en cas de manquement à ces conditions, après
          t&apos;en avoir informé sauf urgence ou manquement grave. Un compte suspendu ne peut
          plus se connecter et ses contenus publics cessent d&apos;être visibles ; ses données
          sont conservées le temps nécessaire au traitement du litige.
        </p>
      </LegalSection>

      <LegalSection title="13. Droit applicable">
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
