"""
ÉTAPE 2 — Enrichissement des espèces via Wikipedia FR et Wikidata SPARQL.

Pour chaque espèce dans species_raw.json :
  - Wikipedia FR  → descriptionShort, descriptionLong, commonName FR, imageUrl
  - Wikidata      → commonName FR, edible, toxic, indoor/outdoor, tags complémentaires

Sortie : species_enriched.json
"""

import httpx
import json
import time
import re
from pathlib import Path

IN_FILE = Path("species_raw.json")
OUT_FILE = Path("species_enriched.json")

WIKIPEDIA_REST = "https://fr.wikipedia.org/api/rest_v1/page/summary"
WIKIPEDIA_API  = "https://fr.wikipedia.org/w/api.php"
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"


# ─── Helpers Wikipedia ───────────────────────────────────────────────────────

def fetch_wikipedia_summary(scientific_name: str) -> dict:
    """
    Tente de récupérer le résumé Wikipedia FR par nom scientifique,
    puis par recherche plein texte en fallback.
    """
    # Essai 1 : titre direct (nom scientifique)
    slug = scientific_name.replace(" ", "_")
    try:
        resp = httpx.get(f"{WIKIPEDIA_REST}/{slug}", timeout=10)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass

    # Essai 2 : recherche full-text
    try:
        params = {
            "action": "query",
            "list": "search",
            "srsearch": scientific_name,
            "srlimit": 1,
            "format": "json",
            "origin": "*",
        }
        resp = httpx.get(WIKIPEDIA_API, params=params, timeout=10)
        results = resp.json().get("query", {}).get("search", [])
        if results:
            title = results[0]["title"]
            resp2 = httpx.get(f"{WIKIPEDIA_REST}/{title.replace(' ', '_')}", timeout=10)
            if resp2.status_code == 200:
                return resp2.json()
    except Exception:
        pass

    return {}


def extract_wiki_data(wiki: dict, scientific_name: str) -> dict:
    """Extrait les champs utiles du résumé Wikipedia."""
    description_long = wiki.get("extract", "")
    # Supprime les balises HTML résiduelles
    description_long = re.sub(r"<[^>]+>", "", description_long).strip()

    # descriptionShort = première phrase du résumé
    first_sentence = ""
    if description_long:
        match = re.match(r"^([^.!?]*[.!?])", description_long)
        first_sentence = match.group(1).strip() if match else description_long[:200]

    image_url = (
        wiki.get("thumbnail", {}).get("source")
        or wiki.get("originalimage", {}).get("source")
        or None
    )

    # Nom commun depuis le titre Wikipedia (souvent meilleur que le nom sci)
    wiki_title = wiki.get("title", "")
    common_name_wiki = wiki_title if wiki_title != scientific_name else ""

    return {
        "description_short_wiki": first_sentence,
        "description_long_wiki": description_long[:2000] if description_long else "",
        "image_url_wiki": image_url,
        "common_name_wiki": common_name_wiki,
        "wikipedia_url": wiki.get("content_urls", {}).get("desktop", {}).get("page", ""),
    }


# ─── Helpers Wikidata ─────────────────────────────────────────────────────────

WIKIDATA_QUERY_TEMPLATE = """
SELECT DISTINCT
  ?item
  ?commonNameFR
  ?edible
  ?toxic
  ?lifeForm
  ?floweringMonth
WHERE {{
  ?item wdt:P225 "{scientific_name}" .
  OPTIONAL {{ ?item wdt:P1843 ?commonNameFR . FILTER(LANG(?commonNameFR) = "fr") }}
  OPTIONAL {{ ?item wdt:P704 ?edible }}
  OPTIONAL {{ ?item wdt:P2840 ?toxic }}
  OPTIONAL {{ ?item wdt:P2419 ?lifeForm }}
  OPTIONAL {{ ?item wdt:P2138 ?floweringMonth }}
}}
LIMIT 1
"""


def fetch_wikidata(scientific_name: str) -> dict:
    """Interroge Wikidata via SPARQL pour récupérer des propriétés structurées."""
    query = WIKIDATA_QUERY_TEMPLATE.format(scientific_name=scientific_name)
    headers = {"Accept": "application/sparql-results+json", "User-Agent": "GrowiPlantBot/1.0"}

    try:
        resp = httpx.get(
            WIKIDATA_SPARQL,
            params={"query": query, "format": "json"},
            headers=headers,
            timeout=15,
        )
        if resp.status_code != 200:
            return {}
        bindings = resp.json().get("results", {}).get("bindings", [])
        if not bindings:
            return {}

        row = bindings[0]
        return {
            "common_name_wikidata": row.get("commonNameFR", {}).get("value", ""),
            "wikidata_url": row.get("item", {}).get("value", ""),
        }
    except Exception as e:
        print(f"    ⚠️  Wikidata erreur ({scientific_name}): {e}")
        return {}


# ─── Inférence des champs de care ─────────────────────────────────────────────

# Règles heuristiques basées sur la famille botanique
FAMILY_RULES: dict[str, dict] = {
    # Arbres forestiers communs
    "Fagaceae":     {"category": "TREE",    "sun": "FULL_SUN",  "watering": 21, "difficulty": "EASY",   "outdoor": True,  "indoor": False},
    "Betulaceae":   {"category": "TREE",    "sun": "FULL_SUN",  "watering": 14, "difficulty": "EASY",   "outdoor": True,  "indoor": False},
    "Pinaceae":     {"category": "TREE",    "sun": "FULL_SUN",  "watering": 21, "difficulty": "EASY",   "outdoor": True,  "indoor": False},
    "Salicaceae":   {"category": "TREE",    "sun": "FULL_SUN",  "watering": 10, "difficulty": "EASY",   "outdoor": True,  "indoor": False},
    "Rosaceae":     {"category": "SHRUB",   "sun": "FULL_SUN",  "watering": 7,  "difficulty": "MEDIUM", "outdoor": True,  "indoor": False, "edible": True},
    "Asteraceae":   {"category": "FLOWER",  "sun": "FULL_SUN",  "watering": 7,  "difficulty": "EASY",   "outdoor": True,  "indoor": False},
    "Poaceae":      {"category": "GRASS",   "sun": "FULL_SUN",  "watering": 7,  "difficulty": "EASY",   "outdoor": True,  "indoor": False},
    "Fabaceae":     {"category": "SHRUB",   "sun": "FULL_SUN",  "watering": 10, "difficulty": "EASY",   "outdoor": True,  "indoor": False},
    "Lamiaceae":    {"category": "HERB",    "sun": "FULL_SUN",  "watering": 7,  "difficulty": "EASY",   "outdoor": True,  "indoor": True,  "edible": True},
    "Apiaceae":     {"category": "HERB",    "sun": "PARTIAL",   "watering": 7,  "difficulty": "EASY",   "outdoor": True,  "indoor": False, "edible": True},
    "Ranunculaceae":{"category": "FLOWER",  "sun": "PARTIAL",   "watering": 7,  "difficulty": "MEDIUM", "outdoor": True,  "indoor": False},
    "Orchidaceae":  {"category": "INDOOR",  "sun": "PARTIAL",   "watering": 10, "difficulty": "MEDIUM", "outdoor": False, "indoor": True},
    "Crassulaceae": {"category": "SUCCULENTS","sun":"FULL_SUN", "watering": 21, "difficulty": "EASY",   "outdoor": True,  "indoor": True},
    "Cactaceae":    {"category": "SUCCULENTS","sun":"FULL_SUN", "watering": 21, "difficulty": "EASY",   "outdoor": False, "indoor": True},
    "Araceae":      {"category": "INDOOR",  "sun": "PARTIAL",   "watering": 10, "difficulty": "EASY",   "outdoor": False, "indoor": True},
    "Liliaceae":    {"category": "FLOWER",  "sun": "PARTIAL",   "watering": 10, "difficulty": "EASY",   "outdoor": True,  "indoor": False},
    "Brassicaceae": {"category": "VEGETABLE","sun":"FULL_SUN",  "watering": 3,  "difficulty": "MEDIUM", "outdoor": True,  "indoor": False, "edible": True},
    "Solanaceae":   {"category": "VEGETABLE","sun":"FULL_SUN",  "watering": 3,  "difficulty": "MEDIUM", "outdoor": True,  "indoor": False, "edible": True},
    "Cucurbitaceae":{"category": "VEGETABLE","sun":"FULL_SUN",  "watering": 3,  "difficulty": "MEDIUM", "outdoor": True,  "indoor": False, "edible": True},
    "Cupressaceae": {"category": "TREE",    "sun": "FULL_SUN",  "watering": 21, "difficulty": "EASY",   "outdoor": True,  "indoor": False},
    "Oleaceae":     {"category": "TREE",    "sun": "FULL_SUN",  "watering": 14, "difficulty": "EASY",   "outdoor": True,  "indoor": False},
}

DEFAULT_RULES = {"category": "OUTDOOR", "sun": "PARTIAL", "watering": 14, "difficulty": "EASY", "outdoor": True, "indoor": False}

TOXIC_FAMILIES = {"Ranunculaceae", "Solanaceae", "Euphorbiaceae", "Apocynaceae", "Taxaceae", "Araceae"}


def infer_care(family: str, phylum: str) -> dict:
    """Infère les paramètres de soin à partir de la famille botanique."""
    rules = FAMILY_RULES.get(family, DEFAULT_RULES)
    toxic = family in TOXIC_FAMILIES

    return {
        "category":           rules.get("category", "OUTDOOR"),
        "sun_exposure":       rules.get("sun", "PARTIAL"),
        "watering_freq_days": rules.get("watering", 14),
        "watering_difficulty":rules.get("difficulty", "EASY"),
        "outdoor":            rules.get("outdoor", True),
        "indoor":             rules.get("indoor", False),
        "edible":             rules.get("edible", False),
        "toxic":              toxic,
    }


# ─── Main ──────────────────────────────────────────────────────────────────────

def enrich_species(species: dict) -> dict:
    scientific_name = species["scientific_name"]
    family = species.get("family", "")
    phylum = species.get("phylum", "")

    print(f"\n  🔍 {scientific_name}")

    # 1. Wikipedia
    wiki_raw = fetch_wikipedia_summary(scientific_name)
    wiki_data = extract_wiki_data(wiki_raw, scientific_name)
    time.sleep(0.3)

    # 2. Wikidata
    wikidata = fetch_wikidata(scientific_name)
    time.sleep(0.5)

    # 3. Inférence care
    care = infer_care(family, phylum)

    # 4. Nom commun : priorité Wikidata > Wikipedia > nom scientifique
    common_name = (
        wikidata.get("common_name_wikidata")
        or wiki_data.get("common_name_wiki")
        or scientific_name
    )
    # Nettoyage : supprime les parenthèses taxonomiques du nom Wikipedia
    common_name = re.sub(r"\s*\([^)]+\)", "", common_name).strip()

    # 5. Tags automatiques
    tags = []
    if care["edible"]:       tags.append("comestible")
    if care["toxic"]:        tags.append("toxique")
    if care["indoor"]:       tags.append("intérieur")
    if care["outdoor"]:      tags.append("extérieur")
    if family:               tags.append(family.lower())
    tags.append("france")
    tags.append("plante commune")

    enriched = {
        **species,
        "common_name":         common_name,
        "description_short":   wiki_data.get("description_short_wiki", ""),
        "description_long":    wiki_data.get("description_long_wiki", ""),
        "image_url":           wiki_data.get("image_url_wiki"),
        "wikipedia_url":       wiki_data.get("wikipedia_url", ""),
        "wikidata_url":        wikidata.get("wikidata_url", ""),
        "category":            care["category"],
        "sun_exposure":        care["sun_exposure"],
        "watering_freq_days":  care["watering_freq_days"],
        "watering_difficulty": care["watering_difficulty"],
        "outdoor":             care["outdoor"],
        "indoor":              care["indoor"],
        "edible":              care["edible"],
        "toxic":               care["toxic"],
        "tags":                tags,
        "soil_types":          ["universel"],  # défaut raisonnable
        "fertilizer_months":   ["avril", "mai", "juin"],  # saison de croissance standard
        "aliases":             [],
    }

    print(f"     → nom commun : {common_name}")
    print(f"     → catégorie  : {care['category']} | soleil : {care['sun_exposure']} | arrosage : {care['watering_freq_days']}j")
    if wiki_data.get("description_short_wiki"):
        print(f"     → description : {wiki_data['description_short_wiki'][:80]}...")

    return enriched


def main():
    if not IN_FILE.exists():
        print(f"❌ Fichier {IN_FILE} introuvable — lance d'abord 1_fetch_species.py")
        return

    species_list = json.loads(IN_FILE.read_text())
    print(f"🌱 Enrichissement de {len(species_list)} espèces...\n")

    enriched = []
    for i, species in enumerate(species_list, 1):
        print(f"[{i}/{len(species_list)}]", end="")
        result = enrich_species(species)
        enriched.append(result)

    OUT_FILE.write_text(json.dumps(enriched, ensure_ascii=False, indent=2))
    print(f"\n\n✅ Enrichissement terminé.")
    print(f"💾 Sauvegardé dans {OUT_FILE}")

    # Petit rapport
    with_desc = sum(1 for e in enriched if e.get("description_short"))
    with_img  = sum(1 for e in enriched if e.get("image_url"))
    print(f"\n📊 Qualité des données :")
    print(f"   • Avec description  : {with_desc}/{len(enriched)}")
    print(f"   • Avec image        : {with_img}/{len(enriched)}")


if __name__ == "__main__":
    main()
