"""
ÉTAPE 1 — Récupération des 20 espèces végétales les plus communes en France via GBIF.

Sources :
  - GBIF Occurrence API  → espèces avec le plus d'occurrences en France
  - GBIF Species API     → détails taxonomiques (famille, genre, rang)

Sortie : species_raw.json
"""

import httpx
import json
import time
from pathlib import Path

GBIF_BASE = "https://api.gbif.org/v1"
TARGET_COUNT = 20
OUT_FILE = Path("species_raw.json")


def fetch_top_species_keys(limit: int = TARGET_COUNT) -> list[dict]:
    """
    Interroge l'API GBIF pour obtenir les clés des espèces végétales
    les plus fréquemment observées en France (métropole).
    """
    print(f"🌿 Récupération des {limit} espèces les plus communes en France (GBIF)...")

    url = f"{GBIF_BASE}/occurrence/search"
    params = {
        "country": "FR",
        "kingdom": "Plantae",
        "rank": "SPECIES",
        "hasCoordinate": "true",
        "facet": "speciesKey",
        "facetLimit": limit * 2,  # marge pour filtrer les nulls
        "limit": 0,               # on veut seulement les facettes, pas les occurrences
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

    # On prend les N premières entrées (les plus fréquentes)
    top_entries = species_facet["counts"][:limit * 2]
    print(f"  → {len(top_entries)} clés d'espèces récupérées")
    return top_entries


def fetch_species_details(species_key: str) -> dict | None:
    """
    Récupère les détails taxonomiques d'une espèce GBIF.
    Retourne None si l'espèce n'est pas valide (hybride, rang incorrect, etc.)
    """
    url = f"{GBIF_BASE}/species/{species_key}"
    try:
        resp = httpx.get(url, timeout=15)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()

        # On garde seulement les vraies espèces (pas les sous-espèces ou synonymes)
        if data.get("rank") != "SPECIES":
            return None
        if data.get("taxonomicStatus") not in ("ACCEPTED", "DOUBTFUL"):
            return None
        # Exclure les algues, champignons, mousses (on veut plantes vasculaires)
        phylum = data.get("phylum", "")
        if phylum in ("Basidiomycota", "Ascomycota", "Chlorophyta", "Rhodophyta"):
            return None

        return {
            "gbif_key": species_key,
            "scientific_name": data.get("canonicalName") or data.get("scientificName", ""),
            "family": data.get("family", ""),
            "genus": data.get("genus", ""),
            "phylum": phylum,
            "class": data.get("class", ""),
            "order": data.get("order", ""),
            "kingdom": data.get("kingdom", "Plantae"),
            "authorship": data.get("authorship", ""),
            "gbif_url": f"https://www.gbif.org/species/{species_key}",
        }
    except Exception as e:
        print(f"  ⚠️  Erreur pour species_key={species_key}: {e}")
        return None


def main():
    top_entries = fetch_top_species_keys(limit=TARGET_COUNT)

    species_list = []
    print(f"\n📋 Récupération des détails taxonomiques...")

    for entry in top_entries:
        if len(species_list) >= TARGET_COUNT:
            break

        key = entry["name"]
        count = entry["count"]

        details = fetch_species_details(key)
        if details is None:
            print(f"  ⏭️  Ignoré (key={key})")
            continue

        details["occurrence_count_fr"] = count
        species_list.append(details)
        print(f"  ✅ [{len(species_list):02d}/{TARGET_COUNT}] {details['scientific_name']} "
              f"(famille: {details['family']}, occurrences FR: {count:,})")

        time.sleep(0.2)  # politesse envers l'API

    print(f"\n✅ {len(species_list)} espèces valides récupérées.")

    OUT_FILE.write_text(json.dumps(species_list, ensure_ascii=False, indent=2))
    print(f"💾 Sauvegardé dans {OUT_FILE}")


if __name__ == "__main__":
    main()
