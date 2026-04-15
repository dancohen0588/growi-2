"""
ÉTAPE 2 — Enrichissement des espèces via Wikipedia FR et Wikidata SPARQL.

Pour chaque espèce dans species_raw.json :
  - Wikipedia FR  → descriptionShort, descriptionLong, commonName FR, imageUrl
  - Wikidata      → commonName FR (renforcement)

Sortie : species_enriched.json
"""

import httpx
import json
import time
import re
from pathlib import Path

IN_FILE          = Path(__file__).parent / "species_raw.json"
OUT_FILE         = Path(__file__).parent / "species_enriched.json"
WIKIPEDIA_REST   = "https://fr.wikipedia.org/api/rest_v1/page/summary"
WIKIPEDIA_API    = "https://fr.wikipedia.org/w/api.php"
WIKIDATA_SPARQL  = "https://query.wikidata.org/sparql"


# ─── Wikipedia ────────────────────────────────────────────────────────────────

def fetch_wikipedia_summary(scientific_name: str) -> dict:
    """Résumé Wikipedia FR : essai direct puis recherche full-text."""
    slug = scientific_name.replace(" ", "_")

    # Essai 1 : titre direct
    try:
        resp = httpx.get(f"{WIKIPEDIA_REST}/{slug}", timeout=10)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass

    # Essai 2 : recherche plein texte
    try:
        params = {
            "action":   "query",
            "list":     "search",
            "srsearch": scientific_name,
            "srlimit":  1,
            "format":   "json",
            "origin":   "*",
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
    description_long = re.sub(r"<[^>]+>", "", description_long).strip()

    first_sentence = ""
    if description_long:
        match          = re.match(r"^([^.!?]*[.!?])", description_long)
        first_sentence = match.group(1).strip() if match else description_long[:200]

    image_url = (
        wiki.get("thumbnail",      {}).get("source")
        or wiki.get("originalimage", {}).get("source")
        or None
    )

    wiki_title      = wiki.get("title", "")
    common_name_wiki = wiki_title if wiki_title != scientific_name else ""

    return {
        "description_short_wiki": first_sentence,
        "description_long_wiki":  description_long[:2000] if description_long else "",
        "image_url_wiki":         image_url,
        "common_name_wiki":       common_name_wiki,
        "wikipedia_url":          wiki.get("content_urls", {}).get("desktop", {}).get("page", ""),
    }


# ─── Wikidata ─────────────────────────────────────────────────────────────────

WIKIDATA_QUERY = """
SELECT DISTINCT ?item ?commonNameFR WHERE {{
  ?item wdt:P225 "{scientific_name}" .
  OPTIONAL {{ ?item wdt:P1843 ?commonNameFR . FILTER(LANG(?commonNameFR) = "fr") }}
}}
LIMIT 1
"""


def fetch_wikidata(scientific_name: str) -> dict:
    query   = WIKIDATA_QUERY.format(scientific_name=scientific_name)
    headers = {
        "Accept":     "application/sparql-results+json",
        "User-Agent": "GrowiPlantBot/1.0 (https://growi.app)",
    }
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
            "wikidata_url":         row.get("item",         {}).get("value", ""),
        }
    except Exception as e:
        print(f"    ⚠️  Wikidata ({scientific_name}): {e}")
        return {}


# ─── Règles d'inférence des soins ─────────────────────────────────────────────
#
# Categories valides (depuis plant-mapper.ts) :
#   INDOOR, VEGETABLE, FLOWERS, TREES_SHRUBS, HERBS, SUCCULENTS, AQUATIC, CLIMBING
#
# wateringDifficulty valides (depuis plant-mapper.ts) :
#   EASY, MEDIUM, DEMANDING
#
# sunExposure valides :
#   FULL_SUN, PARTIAL, SHADE

FAMILY_RULES: dict[str, dict] = {
    "Fagaceae":      {"cat": "TREES_SHRUBS", "sun": "FULL_SUN", "water": 21, "diff": "EASY",      "out": True,  "in": False},
    "Betulaceae":    {"cat": "TREES_SHRUBS", "sun": "FULL_SUN", "water": 14, "diff": "EASY",      "out": True,  "in": False},
    "Pinaceae":      {"cat": "TREES_SHRUBS", "sun": "FULL_SUN", "water": 21, "diff": "EASY",      "out": True,  "in": False},
    "Cupressaceae":  {"cat": "TREES_SHRUBS", "sun": "FULL_SUN", "water": 21, "diff": "EASY",      "out": True,  "in": False},
    "Salicaceae":    {"cat": "TREES_SHRUBS", "sun": "FULL_SUN", "water": 10, "diff": "EASY",      "out": True,  "in": False},
    "Oleaceae":      {"cat": "TREES_SHRUBS", "sun": "FULL_SUN", "water": 14, "diff": "EASY",      "out": True,  "in": False},
    "Rosaceae":      {"cat": "TREES_SHRUBS", "sun": "FULL_SUN", "water": 7,  "diff": "MEDIUM",    "out": True,  "in": False, "edible": True},
    "Asteraceae":    {"cat": "FLOWERS",      "sun": "FULL_SUN", "water": 7,  "diff": "EASY",      "out": True,  "in": False},
    "Poaceae":       {"cat": "FLOWERS",      "sun": "FULL_SUN", "water": 7,  "diff": "EASY",      "out": True,  "in": False},
    "Fabaceae":      {"cat": "TREES_SHRUBS", "sun": "FULL_SUN", "water": 10, "diff": "EASY",      "out": True,  "in": False},
    "Lamiaceae":     {"cat": "HERBS",        "sun": "FULL_SUN", "water": 7,  "diff": "EASY",      "out": True,  "in": True,  "edible": True},
    "Apiaceae":      {"cat": "HERBS",        "sun": "PARTIAL",  "water": 7,  "diff": "EASY",      "out": True,  "in": False, "edible": True},
    "Ranunculaceae": {"cat": "FLOWERS",      "sun": "PARTIAL",  "water": 7,  "diff": "MEDIUM",    "out": True,  "in": False},
    "Orchidaceae":   {"cat": "INDOOR",       "sun": "PARTIAL",  "water": 10, "diff": "DEMANDING", "out": False, "in": True},
    "Crassulaceae":  {"cat": "SUCCULENTS",   "sun": "FULL_SUN", "water": 21, "diff": "EASY",      "out": True,  "in": True},
    "Cactaceae":     {"cat": "SUCCULENTS",   "sun": "FULL_SUN", "water": 21, "diff": "EASY",      "out": False, "in": True},
    "Araceae":       {"cat": "INDOOR",       "sun": "PARTIAL",  "water": 10, "diff": "EASY",      "out": False, "in": True},
    "Liliaceae":     {"cat": "FLOWERS",      "sun": "PARTIAL",  "water": 10, "diff": "EASY",      "out": True,  "in": False},
    "Brassicaceae":  {"cat": "VEGETABLE",    "sun": "FULL_SUN", "water": 3,  "diff": "MEDIUM",    "out": True,  "in": False, "edible": True},
    "Solanaceae":    {"cat": "VEGETABLE",    "sun": "FULL_SUN", "water": 3,  "diff": "MEDIUM",    "out": True,  "in": False, "edible": True},
    "Cucurbitaceae": {"cat": "VEGETABLE",    "sun": "FULL_SUN", "water": 3,  "diff": "MEDIUM",    "out": True,  "in": False, "edible": True},
    "Convolvulaceae":{"cat": "CLIMBING",     "sun": "FULL_SUN", "water": 7,  "diff": "EASY",      "out": True,  "in": False},
    "Vitaceae":      {"cat": "CLIMBING",     "sun": "FULL_SUN", "water": 7,  "diff": "MEDIUM",    "out": True,  "in": False, "edible": True},
}

DEFAULT_RULES = {"cat": "FLOWERS", "sun": "PARTIAL", "water": 14, "diff": "EASY", "out": True, "in": False}

TOXIC_FAMILIES = {
    "Ranunculaceae", "Solanaceae", "Euphorbiaceae",
    "Apocynaceae",   "Taxaceae",   "Araceae",
}


def infer_care(family: str) -> dict:
    rules = FAMILY_RULES.get(family, DEFAULT_RULES)
    return {
        "category":            rules.get("cat",    "FLOWERS"),
        "sun_exposure":        rules.get("sun",    "PARTIAL"),
        "watering_freq_days":  rules.get("water",  14),
        "watering_difficulty": rules.get("diff",   "EASY"),
        "outdoor":             rules.get("out",    True),
        "indoor":              rules.get("in",     False),
        "edible":              rules.get("edible", False),
        "toxic":               family in TOXIC_FAMILIES,
    }


# ─── Main ──────────────────────────────────────────────────────────────────────

def enrich_species(species: dict) -> dict:
    sci  = species["scientific_name"]
    fam  = species.get("family", "")

    print(f"\n  🔍 {sci}")

    wiki_raw  = fetch_wikipedia_summary(sci)
    wiki_data = extract_wiki_data(wiki_raw, sci)
    time.sleep(0.3)

    wikidata = fetch_wikidata(sci)
    time.sleep(0.5)

    care = infer_care(fam)

    # Nom commun : Wikidata > Wikipedia > nom scientifique
    common_name = (
        wikidata.get("common_name_wikidata")
        or wiki_data.get("common_name_wiki")
        or sci
    )
    common_name = re.sub(r"\s*\([^)]+\)", "", common_name).strip()

    # Tags automatiques
    tags = ["france", "plante commune"]
    if care["edible"]:  tags.append("comestible")
    if care["toxic"]:   tags.append("toxique")
    if care["indoor"]:  tags.append("intérieur")
    if care["outdoor"]: tags.append("extérieur")
    if fam:             tags.append(fam.lower())

    result = {
        **species,
        "common_name":         common_name,
        "description_short":   wiki_data.get("description_short_wiki", ""),
        "description_long":    wiki_data.get("description_long_wiki",  ""),
        "image_url":           wiki_data.get("image_url_wiki"),
        "wikipedia_url":       wiki_data.get("wikipedia_url", ""),
        "wikidata_url":        wikidata.get("wikidata_url",   ""),
        "category":            care["category"],
        "sun_exposure":        care["sun_exposure"],
        "watering_freq_days":  care["watering_freq_days"],
        "watering_difficulty": care["watering_difficulty"],
        "outdoor":             care["outdoor"],
        "indoor":              care["indoor"],
        "edible":              care["edible"],
        "toxic":               care["toxic"],
        "tags":                tags,
        "soil_types":          ["universel"],
        "fertilizer_months":   ["avril", "mai", "juin"],
        "aliases":             [],
    }

    print(f"     → nom commun  : {common_name}")
    print(f"     → catégorie   : {care['category']} | soleil : {care['sun_exposure']} | arrosage : {care['watering_freq_days']}j | diff : {care['watering_difficulty']}")
    if wiki_data.get("description_short_wiki"):
        preview = wiki_data["description_short_wiki"][:80]
        print(f"     → description : {preview}...")

    return result


def main():
    if not IN_FILE.exists():
        print(f"❌ {IN_FILE} introuvable — lance d'abord 1_fetch_species.py")
        return

    species_list = json.loads(IN_FILE.read_text())
    print(f"🌱 Enrichissement de {len(species_list)} espèces...\n")

    enriched = [enrich_species(s) for s in species_list]

    OUT_FILE.write_text(json.dumps(enriched, ensure_ascii=False, indent=2))

    with_desc = sum(1 for e in enriched if e.get("description_short"))
    with_img  = sum(1 for e in enriched if e.get("image_url"))
    print(f"\n\n✅ Enrichissement terminé.")
    print(f"💾 Sauvegardé dans {OUT_FILE}")
    print(f"\n📊 Qualité :")
    print(f"   • Avec description : {with_desc}/{len(enriched)}")
    print(f"   • Avec image       : {with_img}/{len(enriched)}")


if __name__ == "__main__":
    main()
