"""
ÉTAPE 1 — Récupération des espèces végétales les plus communes en France via GBIF.

Sources :
  - GBIF Occurrence API  → espèces avec le plus d'occurrences en France
  - GBIF Species API     → détails taxonomiques (famille, genre, rang)

Sortie : species_raw.json
"""

import httpx
import json
import time
from pathlib import Path

GBIF_BASE    = "https://api.gbif.org/v1"
TARGET_COUNT = 20       # ← modifié par run_pipeline.py pour le mode full
OUT_FILE     = Path(__file__).parent / "species_raw.json"


def fetch_top_species_keys(limit: int = TARGET_COUNT) -> list[dict]:
    """
    Interroge GBIF pour les espèces végétales les plus observées en France.
    Utilise les facettes d'occurrence pour avoir un classement par fréquence.

    NOTE : le bon paramètre GBIF pour filtrer par règne est `taxonKey`
    (pas `kingdom` qui est ignoré). taxonKey=6 = Plantae dans le backbone GBIF.
    """
    print(f"🌿 Récupération des {limit} espèces les plus communes en France (GBIF)...")

    url    = f"{GBIF_BASE}/occurrence/search"
    params = {
        "country":      "FR",
        "taxonKey":     6,           # 6 = Plantae dans le backbone GBIF
        "hasCoordinate":"true",
        "facet":        "speciesKey",
        "facetLimit":   limit * 3,   # marge pour filtrer les nulls/invalides
        "limit":        0,
    }

    resp = httpx.get(url, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    facets = data.get("facets", [])
    if not facets:
        raise ValueError("Aucune facette retournée par GBIF — vérifie les paramètres.")

    species_facet = next((f for f in facets if f["field"] == "SPECIES_KEY"), None)
    if not species_facet:
        raise ValueError("Facette SPECIES_KEY introuvable.")

    entries = species_facet["counts"][:limit * 3]
    print(f"  → {len(entries)} clés d'espèces candidates récupérées")
    return entries


def fetch_species_details(species_key: str) -> dict | None:
    """
    Récupère les détails taxonomiques d'une espèce GBIF.
    Retourne None si l'espèce est invalide (hybride, sous-espèce, champignon...).
    """
    url = f"{GBIF_BASE}/species/{species_key}"
    try:
        resp = httpx.get(url, timeout=15)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()

        # Filtres de qualité
        if data.get("rank") != "SPECIES":
            return None
        if data.get("taxonomicStatus") not in ("ACCEPTED", "DOUBTFUL"):
            return None

        # Exclure champignons, algues, mousses — on veut les plantes vasculaires
        phylum = data.get("phylum", "")
        excluded_phyla = {
            "Basidiomycota", "Ascomycota", "Chlorophyta",
            "Rhodophyta", "Bryophyta", "Marchantiophyta",
        }
        if phylum in excluded_phyla:
            return None

        return {
            "gbif_key":       species_key,
            "scientific_name":data.get("canonicalName") or data.get("scientificName", ""),
            "family":         data.get("family", ""),
            "genus":          data.get("genus", ""),
            "phylum":         phylum,
            "class":          data.get("class", ""),
            "order":          data.get("order", ""),
            "kingdom":        data.get("kingdom", "Plantae"),
            "authorship":     data.get("authorship", ""),
            "gbif_url":       f"https://www.gbif.org/species/{species_key}",
        }

    except Exception as e:
        print(f"  ⚠️  Erreur pour species_key={species_key}: {e}")
        return None


def main():
    top_entries  = fetch_top_species_keys(limit=TARGET_COUNT)
    species_list = []

    print(f"\n📋 Récupération des détails taxonomiques...")

    for entry in top_entries:
        if len(species_list) >= TARGET_COUNT:
            break

        key     = entry["name"]
        count   = entry["count"]
        details = fetch_species_details(key)

        if details is None:
            print(f"  ⏭️  Ignoré (key={key})")
            continue

        details["occurrence_count_fr"] = count
        species_list.append(details)
        print(f"  ✅ [{len(species_list):02d}/{TARGET_COUNT}] {details['scientific_name']} "
              f"(famille: {details['family']}, occurrences FR: {count:,})")

        time.sleep(0.2)

    print(f"\n✅ {len(species_list)} espèces valides récupérées.")
    OUT_FILE.write_text(json.dumps(species_list, ensure_ascii=False, indent=2))
    print(f"💾 Sauvegardé dans {OUT_FILE}")


if __name__ == "__main__":
    main()
