import type { SecretPlanche } from '@growi/shared'

/** Planches du lot 2, validées dans Claude Design. */
export const PLANCHES_LOT2: Readonly<Record<string, SecretPlanche>> = {
  "ail-decoction": {
    "panels": [
      {
        "art": "ail-decoction/1",
        "caption": "Écrase 5 gousses d’ail dans 1 litre d’eau.",
        "emphasis": "5 gousses d’ail"
      },
      {
        "art": "ail-decoction/2",
        "caption": "Porte à ébullition, puis laisse infuser à couvert jusqu’à refroidissement.",
        "emphasis": "à couvert"
      },
      {
        "art": "ail-decoction/3",
        "caption": "Filtre et pulvérise sur les pousses attaquées.",
        "emphasis": "les pousses attaquées"
      }
    ],
    "caution": {
      "art": "ail-decoction/caution",
      "title": "L’effet ne dure que quelques jours.",
      "text": "Recommence après une pluie.",
      "tone": "note"
    }
  },
  "cannelle-semis": {
    "panels": [
      {
        "art": "cannelle-semis/1",
        "caption": "Après le semis, saupoudre une très fine pellicule de cannelle en poudre sur le terreau.",
        "emphasis": "très fine pellicule"
      },
      {
        "art": "cannelle-semis/2",
        "caption": "Arrose par le dessous, en remplissant la soucoupe.",
        "emphasis": "par le dessous"
      },
      {
        "art": "cannelle-semis/3",
        "caption": "Aère la mini-serre chaque jour.",
        "emphasis": "chaque jour"
      }
    ],
    "caution": {
      "art": "cannelle-semis/caution",
      "title": "La meilleure protection reste ailleurs.",
      "text": "Un terreau propre, un arrosage modéré et de l’air.",
      "tone": "note"
    }
  },
  "coquilles-godets": {
    "panels": [
      {
        "art": "coquilles-godets/1",
        "caption": "Rince des demi-coquilles bien entières, puis perce le fond d’un petit trou avec une aiguille.",
        "emphasis": "perce le fond"
      },
      {
        "art": "coquilles-godets/2",
        "caption": "Remplis de terreau à semis, sème une ou deux graines, tasse du doigt, puis cale la boîte à œufs près d’une fenêtre lumineuse.",
        "emphasis": "une ou deux graines"
      },
      {
        "art": "coquilles-godets/3",
        "caption": "Au repiquage, écrase légèrement la coquille et plante le tout.",
        "emphasis": "écrase légèrement la coquille"
      }
    ],
    "caution": {
      "art": "coquilles-godets/caution",
      "title": "Rince bien les coquilles.",
      "text": "Un reste de blanc moisit vite au chaud.",
      "tone": "warning"
    }
  },
  "prele": {
    "panels": [
      {
        "art": "prele/1",
        "caption": "Fais tremper 100 g de prêle séchée dans 1 litre d’eau pendant 24 heures.",
        "emphasis": "24 heures"
      },
      {
        "art": "prele/2",
        "caption": "Le lendemain, fais bouillir doucement une heure, à couvert. Laisse refroidir, filtre.",
        "emphasis": "une heure, à couvert"
      },
      {
        "art": "prele/3",
        "caption": "Dilue à 20 % (un volume pour quatre d’eau) et pulvérise sur le feuillage, par temps sec.",
        "emphasis": "Dilue à 20 %"
      }
    ],
    "caution": {
      "art": "prele/caution",
      "title": "Un geste de prévention.",
      "text": "Sur une maladie déjà installée, il ne suffit pas.",
      "tone": "note"
    }
  },
  "purin-ortie": {
    "panels": [
      {
        "art": "purin-ortie/1",
        "caption": "Cueille 1 kg d’orties avant la floraison, avec des gants.",
        "emphasis": "1 kg d’orties"
      },
      {
        "art": "purin-ortie/2",
        "caption": "Hache-les grossièrement et plonge-les dans 10 litres d’eau de pluie, dans un seau non métallique.",
        "emphasis": "10 litres d’eau de pluie"
      },
      {
        "art": "purin-ortie/3",
        "caption": "Couvre sans fermer et remue chaque jour, jusqu’à ce qu’il ne se forme plus de bulles (10 à 15 jours).",
        "emphasis": "10 à 15 jours"
      },
      {
        "art": "purin-ortie/4",
        "caption": "Filtre, puis dilue à 10 % (un litre de purin pour neuf litres d’eau) et arrose au pied.",
        "emphasis": "dilue à 10 %"
      }
    ],
    "caution": {
      "art": "purin-ortie/caution",
      "title": "Jamais pur, ni sur des semis ou une plante malade.",
      "text": "Odeur très forte : prépare-le loin de la maison. Garde un pied sans purin pour comparer.",
      "tone": "warning"
    }
  },
  "savon-noir": {
    "panels": [
      {
        "art": "savon-noir/1",
        "caption": "Dilue 15 à 30 g de savon noir liquide (une à deux cuillères à soupe) dans 1 litre d’eau tiède.",
        "emphasis": "15 à 30 g"
      },
      {
        "art": "savon-noir/2",
        "caption": "Pulvérise surtout le dessous des feuilles et les jeunes pousses.",
        "emphasis": "le dessous des feuilles"
      },
      {
        "art": "savon-noir/3",
        "caption": "Recommence trois jours plus tard si des pucerons restent.",
        "emphasis": "trois jours plus tard"
      }
    ],
    "caution": {
      "art": "savon-noir/caution",
      "title": "Jamais en plein soleil.",
      "text": "Prends du vrai savon noir, sans additif. Rince à l’eau claire les feuilles fragiles le lendemain.",
      "tone": "warning"
    }
  }
}
