import type { SecretPlanche } from '@growi/shared'

/** Planches du lot 3, validées dans Claude Design. */
export const PLANCHES_LOT3: Readonly<Record<string, SecretPlanche>> = {
  "bicarbonate": {
    "panels": [
      {
        "art": "bicarbonate/1",
        "caption": "Dissous 5 g de bicarbonate de soude (une cuillère à café rase) dans 1 litre d’eau.",
        "emphasis": "5 g de bicarbonate de soude"
      },
      {
        "art": "bicarbonate/2",
        "caption": "Ajoute une goutte de savon noir pour que le mélange accroche.",
        "emphasis": "une goutte de savon noir"
      },
      {
        "art": "bicarbonate/3",
        "caption": "Pulvérise le feuillage en fin de journée.",
        "emphasis": "en fin de journée"
      }
    ],
    "caution": {
      "art": "bicarbonate/caution",
      "title": "Pas plus d’une fois tous les dix jours.",
      "text": "Le sodium s’accumule dans le sol.",
      "tone": "warning"
    }
  },
  "bouteille-oya": {
    "panels": [
      {
        "art": "bouteille-oya/1",
        "caption": "Perce 3 ou 4 petits trous dans le bouchon d’une bouteille en plastique.",
        "emphasis": "3 ou 4 petits trous"
      },
      {
        "art": "bouteille-oya/2",
        "caption": "Coupe le fond, enterre la bouteille goulot en bas, près des racines.",
        "emphasis": "goulot en bas"
      },
      {
        "art": "bouteille-oya/3",
        "caption": "Remplis par le haut : elle se vide en un à trois jours.",
        "emphasis": "en un à trois jours"
      }
    ],
    "caution": {
      "art": "bouteille-oya/caution",
      "title": "Essaie avant de partir pour régler le débit.",
      "text": "Trop de trous, et la bouteille se vide en une heure.",
      "tone": "warning"
    }
  },
  "capucines": {
    "panels": [
      {
        "art": "capucines/1",
        "caption": "Sème 3 ou 4 graines de capucine en bordure du potager, à 2 cm de profondeur.",
        "emphasis": "3 ou 4 graines"
      },
      {
        "art": "capucines/2",
        "caption": "Arrose légèrement jusqu’à la levée.",
        "emphasis": "jusqu’à la levée"
      },
      {
        "art": "capucines/3",
        "caption": "Surveille-les : quand les pucerons s’y regroupent, coupe et jette les tiges les plus envahies.",
        "emphasis": "coupe et jette"
      }
    ],
    "caution": {
      "art": "capucines/caution",
      "title": "Garde un œil sur la plante piège.",
      "text": "Sans surveillance, elle devient un foyer qui essaime : les pucerons repartent vers tes légumes.",
      "tone": "warning"
    }
  },
  "clous-hortensia": {
    "panels": [
      {
        "art": "clous-hortensia/1",
        "caption": "On dit… qu’enterrer des clous rouillés au pied d’un hortensia le rend bleu.",
        "emphasis": "On dit…"
      },
      {
        "art": "clous-hortensia/2",
        "caption": "En vrai… c’est l’aluminium qui bleuit, pas le fer, et seulement en sol acide. Les clous ne font que rouiller.",
        "emphasis": "En vrai…"
      },
      {
        "art": "clous-hortensia/3",
        "caption": "Ce qui marche : eau de pluie et terre de bruyère au printemps, plus un engrais « hortensias bleus ». Sur sol calcaire, il reste rose.",
        "emphasis": "Ce qui marche :"
      }
    ],
    "caution": null
  },
  "eau-banane": {
    "panels": [
      {
        "art": "eau-banane/1",
        "caption": "Coupe 2 ou 3 peaux de banane en morceaux.",
        "emphasis": "2 ou 3 peaux de banane"
      },
      {
        "art": "eau-banane/2",
        "caption": "Plonge-les dans 1 litre d’eau, dans un bocal fermé, à l’ombre.",
        "emphasis": "1 litre d’eau"
      },
      {
        "art": "eau-banane/3",
        "caption": "Laisse macérer 3 jours, pas plus.",
        "emphasis": "3 jours, pas plus"
      },
      {
        "art": "eau-banane/4",
        "caption": "Filtre, dilue de moitié avec de l’eau, et arrose au pied.",
        "emphasis": "dilue de moitié"
      }
    ],
    "caution": {
      "art": "eau-banane/caution",
      "title": "L’apport réel est faible.",
      "text": "Au-delà de quelques jours, l’eau sent mauvais et attire les moucherons. Enterrer simplement la peau au pied marche aussi bien.",
      "tone": "note"
    }
  },
  "lait-oidium": {
    "panels": [
      {
        "art": "lait-oidium/1",
        "caption": "Mélange 1 volume de lait (demi-écrémé convient) pour 9 volumes d’eau.",
        "emphasis": "1 volume de lait"
      },
      {
        "art": "lait-oidium/2",
        "caption": "Pulvérise les deux faces des feuilles, un matin ensoleillé.",
        "emphasis": "les deux faces des feuilles"
      },
      {
        "art": "lait-oidium/3",
        "caption": "Recommence une fois par semaine tant qu’il fait chaud.",
        "emphasis": "une fois par semaine"
      }
    ],
    "caution": {
      "art": "lait-oidium/caution",
      "title": "Essaie d’abord sur une feuille.",
      "text": "Si une odeur aigre apparaît, rince à l’eau claire.",
      "tone": "warning"
    }
  },
  "lune": {
    "panels": [
      {
        "art": "lune/1",
        "caption": "Regarde le bandeau lunaire de ton planning : il te dit le type du jour.",
        "emphasis": "le bandeau lunaire"
      },
      {
        "art": "lune/2",
        "caption": "Jour racine : carottes, radis, poireaux. Jour feuille : salades, épinards.",
        "emphasis": "Jour racine"
      },
      {
        "art": "lune/3",
        "caption": "Jour fleur : fleurs et bulbes. Jour fruit : tomates, haricots, fraisiers.",
        "emphasis": "Jour fleur"
      },
      {
        "art": "lune/4",
        "caption": "Sème ou repique ce qui correspond, et note ce que tu observes.",
        "emphasis": "note ce que tu observes"
      }
    ],
    "caution": {
      "art": "lune/caution",
      "title": "Aucune preuve scientifique.",
      "text": "100 % tradition, 100 % plaisir.",
      "tone": "note"
    }
  },
  "marc-hortensia": {
    "panels": [
      {
        "art": "marc-hortensia/1",
        "caption": "On dit… que le marc de café rend la terre acide, idéal pour les hortensias.",
        "emphasis": "On dit…"
      },
      {
        "art": "marc-hortensia/2",
        "caption": "En vrai… l’acidité part dans ta tasse : le marc usé est presque neutre. Mets-le plutôt au compost.",
        "emphasis": "En vrai…"
      },
      {
        "art": "marc-hortensia/3",
        "caption": "Ce qui marche : de l’eau de pluie plutôt que du robinet, souvent calcaire, et de la terre de bruyère au printemps.",
        "emphasis": "Ce qui marche :"
      }
    ],
    "caution": null
  },
  "oeillets-inde": {
    "panels": [
      {
        "art": "oeillets-inde/1",
        "caption": "Plante un œillet d’Inde tous les deux ou trois pieds de tomate.",
        "emphasis": "tous les deux ou trois pieds de tomate"
      },
      {
        "art": "oeillets-inde/2",
        "caption": "Arrose-les en même temps que les tomates.",
        "emphasis": "en même temps"
      },
      {
        "art": "oeillets-inde/3",
        "caption": "Laisse-les en place toute la saison.",
        "emphasis": "toute la saison"
      }
    ],
    "caution": null
  },
  "piege-biere": {
    "panels": [
      {
        "art": "piege-biere/1",
        "caption": "Enterre un gobelet près des plantes attaquées, le rebord à 1 cm au-dessus du sol.",
        "emphasis": "le rebord à 1 cm au-dessus du sol"
      },
      {
        "art": "piege-biere/2",
        "caption": "Remplis-le à moitié de bière, même bon marché.",
        "emphasis": "à moitié de bière"
      },
      {
        "art": "piege-biere/3",
        "caption": "Vide et remplis de nouveau tous les deux ou trois jours.",
        "emphasis": "tous les deux ou trois jours"
      }
    ],
    "caution": {
      "art": "piege-biere/caution",
      "title": "Garde le rebord au-dessus du sol.",
      "text": "Il épargne les carabes, ces coléoptères qui mangent les limaces : ce sont tes alliés.",
      "tone": "warning"
    }
  },
  "saule-bouture": {
    "panels": [
      {
        "art": "saule-bouture/1",
        "caption": "Coupe une poignée de jeunes rameaux de saule, en morceaux de 5 cm.",
        "emphasis": "en morceaux de 5 cm"
      },
      {
        "art": "saule-bouture/2",
        "caption": "Fais-les tremper 24 heures dans un verre d’eau.",
        "emphasis": "24 heures"
      },
      {
        "art": "saule-bouture/3",
        "caption": "Le lendemain, prélève tes boutures et laisse leur pied tremper quelques heures dans cette eau.",
        "emphasis": "quelques heures"
      },
      {
        "art": "saule-bouture/4",
        "caption": "Plante-les dans un mélange de terreau et de sable, à l’ombre légère.",
        "emphasis": "terreau et de sable"
      }
    ],
    "caution": null
  }
}
