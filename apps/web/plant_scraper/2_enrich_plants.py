"""
ÉTAPE 2 — Enrichissement des espèces via iNaturalist (primaire) + Wikidata (fallback nom).

Pour chaque espèce dans species_raw.json :
  - iNaturalist  → commonName FR, descriptionShort, descriptionLong, imageUrl
                   (agrège Wikipedia + photos communautaires vérifiées, sans clé)
  - Wikidata     → commonName FR en fallback si iNaturalist ne trouve pas de nom FR

Sortie : species_enriched.json
"""

import httpx
import json
import time
import re
import sys
from pathlib import Path

# Import du module iNaturalist partagé (même dossier)
sys.path.insert(0, str(Path(__file__).parent))
from utils_inaturalist import fetch_inaturalist_with_delay

IN_FILE         = Path(__file__).parent / "species_raw.json"
OUT_FILE        = Path(__file__).parent / "species_enriched.json"
WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"


# ─── Wikidata (fallback nom commun uniquement) ────────────────────────────────

WIKIDATA_QUERY = """
SELECT DISTINCT ?commonNameFR WHERE {{
  ?item wdt:P225 "{scientific_name}" .
  OPTIONAL {{ ?item wdt:P1843 ?commonNameFR . FILTER(LANG(?commonNameFR) = "fr") }}
}}
LIMIT 1
"""


def fetch_wikidata_name(scientific_name: str) -> str:
    """Retourne uniquement le nom commun FR depuis Wikidata (fallback léger)."""
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
            return ""
        bindings = resp.json().get("results", {}).get("bindings", [])
        if not bindings:
            return ""
        return bindings[0].get("commonNameFR", {}).get("value", "")
    except Exception as e:
        print(f"    ⚠️  Wikidata ({scientific_name}): {e}")
        return ""


# ─── Règles d'inférence des soins ─────────────────────────────────────────────
#
# Categories valides (depuis plant-mapper.ts) :
#   INDOOR, VEGETABLE, FLOWERS, TREES_SHRUBS, HERBS, SUCCULENTS, AQUATIC, CLIMBING
#
# wateringDifficulty valides : EASY, MEDIUM, DEMANDING
# sunExposure valides        : FULL_SUN, PARTIAL, SHADE

FAMILY_RULES: dict[str, dict] = {
    "Fagaceae":       {"cat": "TREES_SHRUBS", "sun": "FULL_SUN", "water": 21, "diff": "EASY",      "out": True,  "in": False},
    "Betulaceae":     {"cat": "TREES_SHRUBS", "sun": "FULL_SUN", "water": 14, "diff": "EASY",      "out": True,  "in": False},
    "Pinaceae":       {"cat": "TREES_SHRUBS", "sun": "FULL_SUN", "water": 21, "diff": "EASY",      "out": True,  "in": False},
    "Cupressaceae":   {"cat": "TREES_SHRUBS", "sun": "FULL_SUN", "water": 21, "diff": "EASY",      "out": True,  "in": False},
    "Salicaceae":     {"cat": "TREES_SHRUBS", "sun": "FULL_SUN", "water": 10, "diff": "EASY",      "out": True,  "in": False},
    "Oleaceae":       {"cat": "TREES_SHRUBS", "sun": "FULL_SUN", "water": 14, "diff": "EASY",      "out": True,  "in": False},
    "Rosaceae":       {"cat": "TREES_SHRUBS", "sun": "FULL_SUN", "water": 7,  "diff": "MEDIUM",    "out": True,  "in": False, "edible": True},
    "Cornaceae":      {"cat": "TREES_SHRUBS", "sun": "PARTIAL",  "water": 10, "diff": "EASY",      "out": True,  "in": False},
    "Asteraceae":     {"cat": "FLOWERS",      "sun": "FULL_SUN", "water": 7,  "diff": "EASY",      "out": True,  "in": False},
    "Poaceae":        {"cat": "FLOWERS",      "sun": "FULL_SUN", "water": 7,  "diff": "EASY",      "out": True,  "in": False},
    "Fabaceae":       {"cat": "FLOWERS",      "sun": "FULL_SUN", "water": 10, "diff": "EASY",      "out": True,  "in": False},
    "Lamiaceae":      {"cat": "HERBS",        "sun": "FULL_SUN", "water": 7,  "diff": "EASY",      "out": True,  "in": True,  "edible": True},
    "Apiaceae":       {"cat": "HERBS",        "sun": "PARTIAL",  "water": 7,  "diff": "EASY",      "out": True,  "in": False, "edible": True},
    "Ranunculaceae":  {"cat": "FLOWERS",      "sun": "PARTIAL",  "water": 7,  "diff": "MEDIUM",    "out": True,  "in": False},
    "Orchidaceae":    {"cat": "INDOOR",       "sun": "PARTIAL",  "water": 10, "diff": "DEMANDING", "out": False, "in": True},
    "Crassulaceae":   {"cat": "SUCCULENTS",   "sun": "FULL_SUN", "water": 21, "diff": "EASY",      "out": True,  "in": True},
    "Cactaceae":      {"cat": "SUCCULENTS",   "sun": "FULL_SUN", "water": 21, "diff": "EASY",      "out": False, "in": True},
    "Araceae":        {"cat": "INDOOR",       "sun": "PARTIAL",  "water": 10, "diff": "EASY",      "out": False, "in": True},
    "Liliaceae":      {"cat": "FLOWERS",      "sun": "PARTIAL",  "water": 10, "diff": "EASY",      "out": True,  "in": False},
    "Brassicaceae":   {"cat": "VEGETABLE",    "sun": "FULL_SUN", "water": 3,  "diff": "MEDIUM",    "out": True,  "in": False, "edible": True},
    "Solanaceae":     {"cat": "VEGETABLE",    "sun": "FULL_SUN", "water": 3,  "diff": "MEDIUM",    "out": True,  "in": False, "edible": True},
    "Cucurbitaceae":  {"cat": "VEGETABLE",    "sun": "FULL_SUN", "water": 3,  "diff": "MEDIUM",    "out": True,  "in": False, "edible": True},
    "Convolvulaceae": {"cat": "CLIMBING",     "sun": "FULL_SUN", "water": 7,  "diff": "EASY",      "out": True,  "in": False},
    "Vitaceae":       {"cat": "CLIMBING",     "sun": "FULL_SUN", "water": 7,  "diff": "MEDIUM",    "out": True,  "in": False, "edible": True},
    "Plantaginaceae": {"cat": "FLOWERS",      "sun": "PARTIAL",  "water": 10, "diff": "EASY",      "out": True,  "in": False},
    "Urticaceae":     {"cat": "FLOWERS",      "sun": "PARTIAL",  "water": 7,  "diff": "EASY",      "out": True,  "in": False},
    "Hypericaceae":   {"cat": "FLOWERS",      "sun": "PARTIAL",  "water": 10, "diff": "EASY",      "out": True,  "in": False},
    "Geraniaceae":    {"cat": "FLOWERS",      "sun": "PARTIAL",  "water": 7,  "diff": "EASY",      "out": True,  "in": False},
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


# ─── Enrichissement principal ─────────────────────────────────────────────────

def enrich_species(species: dict) -> dict:
    sci = species["scientific_name"]
    fam = species.get("family", "")

    print(f"\n  🔍 {sci}")

    # 1. iNaturalist (source principale : description + image + nom commun FR)
    inat = fetch_inaturalist_with_delay(sci)

    # 2. Wikidata (fallback nom commun si iNaturalist ne retourne pas de nom FR)
    common_name = inat.get("common_name", "")
    if not common_name:
        print(f"     ↳ iNat sans nom FR → Wikidata fallback...")
        common_name = fetch_wikidata_name(sci)
        time.sleep(0.5)

    # 3. Dernier recours : nom scientifique
    if not common_name:
        common_name = sci

    # Nettoyage du nom (supprime les parenthèses taxonomiques)
    common_name = re.sub(r"\s*\([^)]+\)", "", common_name).strip()

    # 4. Inférence des soins depuis la famille botanique
    care = infer_care(fam)

    # 5. Tags automatiques
    tags = ["france", "plante commune"]
    if care["edible"]:  tags.append("comestible")
    if care["toxic"]:   tags.append("toxique")
    if care["indoor"]:  tags.append("intérieur")
    if care["outdoor"]: tags.append("extérieur")
    if fam:             tags.append(fam.lower())

    # Rapport qualité
    has_desc  = bool(inat.get("description_short"))
    has_img   = bool(inat.get("image_url"))
    locale    = inat.get("source_locale", "—")
    print(f"     → nom commun  : {common_name}")
    print(f"     → catégorie   : {care['category']} | soleil : {care['sun_exposure']} | arrosage : {care['watering_freq_days']}j")
    print(f"     → iNaturalist : desc={'✅' if has_desc else '❌'}  image={'✅' if has_img else '❌'}  locale={locale}")
    if has_desc:
        print(f"     → description : {inat['description_short'][:80]}...")

    return {
        **species,
        "common_name":         common_name,
        "description_short":   inat.get("description_short", ""),
        "description_long":    inat.get("description_long",  ""),
        "image_url":           inat.get("image_url"),
        "wikipedia_url":       inat.get("wikipedia_url",    ""),
        "inaturalist_url":     inat.get("inaturalist_url",  ""),
        "inaturalist_id":      inat.get("inaturalist_id"),
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


def main():
    if not IN_FILE.exists():
        print(f"❌ {IN_FILE} introuvable — lance d'abord 1_fetch_species.py")
        return

    species_list = json.loads(IN_FILE.read_text())
    print(f"🌱 Enrichissement de {len(species_list)} espèces via iNaturalist...\n")

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
