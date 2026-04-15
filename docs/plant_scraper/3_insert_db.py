"""
ÉTAPE 3 — Insertion des plantes enrichies dans Supabase (table plant_catalog).

Lit species_enriched.json et insère chaque entrée dans plant_catalog.
- Utilise UPSERT sur scientificName pour éviter les doublons
- Génère un id UUID v4 pour chaque plante
- Mappe les champs enrichis vers le schéma exact de la table

Prérequis : fichier .env avec SUPABASE_URL et SUPABASE_SERVICE_KEY
"""

import json
import uuid
import os
from pathlib import Path
from datetime import datetime, timezone

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

IN_FILE = Path("species_enriched.json")

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")


# ─── Mapping des valeurs ───────────────────────────────────────────────────────

# sunExposure : valeurs acceptées par la DB
SUN_MAP = {
    "FULL_SUN": "FULL_SUN",
    "PARTIAL":  "PARTIAL",
    "SHADE":    "SHADE",
}

# wateringDifficulty : valeurs acceptées par la DB
DIFFICULTY_MAP = {
    "EASY":   "EASY",
    "MEDIUM": "MEDIUM",
    "HARD":   "HARD",
}


def to_json_str(value) -> str | None:
    """Convertit une liste Python en JSON string (format stocké en DB)."""
    if not value:
        return None
    if isinstance(value, list):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def map_to_db_row(plant: dict) -> dict:
    """
    Mappe les champs d'une plante enrichie vers le schéma plant_catalog.
    """
    now = datetime.now(timezone.utc).isoformat()

    # Emoji par catégorie (fallback)
    EMOJI_MAP = {
        "TREE":       "🌳",
        "SHRUB":      "🌿",
        "FLOWER":     "🌸",
        "GRASS":      "🌾",
        "HERB":       "🌿",
        "VEGETABLE":  "🥦",
        "INDOOR":     "🪴",
        "SUCCULENTS": "🌵",
        "OUTDOOR":    "🌱",
    }
    category = plant.get("category", "OUTDOOR")
    emoji = EMOJI_MAP.get(category, "🌱")

    return {
        "id":                str(uuid.uuid4()),
        "commonName":        plant.get("common_name") or plant.get("scientific_name", ""),
        "scientificName":    plant.get("scientific_name", ""),
        "family":            plant.get("family") or None,
        "emoji":             emoji,
        "category":          category,
        "imageUrl":          plant.get("image_url") or None,
        "descriptionShort":  plant.get("description_short") or None,
        "descriptionLong":   plant.get("description_long") or None,
        "sunExposure":       SUN_MAP.get(plant.get("sun_exposure", "PARTIAL"), "PARTIAL"),
        "wateringFreqDays":  plant.get("watering_freq_days", 14),
        "wateringDifficulty":DIFFICULTY_MAP.get(plant.get("watering_difficulty", "EASY"), "EASY"),
        "minTempCelsius":    None,   # non dispo via GBIF/Wiki sans scraping approfondi
        "maxTempCelsius":    None,
        "hardinesZone":      None,
        "soilTypes":         to_json_str(plant.get("soil_types")),
        "fertilizerMonths":  to_json_str(plant.get("fertilizer_months")),
        "indoor":            bool(plant.get("indoor", False)),
        "outdoor":           bool(plant.get("outdoor", True)),
        "edible":            bool(plant.get("edible", False)),
        "toxic":             bool(plant.get("toxic", False)),
        "aliases":           to_json_str(plant.get("aliases")),
        "tags":              to_json_str(plant.get("tags")),
        "source":            "GBIF + Wikipedia FR + Wikidata",
        "createdAt":         now,
        "updatedAt":         now,
    }


def insert_plants(client: Client, plants: list[dict]) -> dict:
    """
    Insère les plantes via upsert sur scientificName.
    Retourne un résumé des opérations.
    """
    rows = [map_to_db_row(p) for p in plants]

    inserted = 0
    skipped  = 0
    errors   = []

    for row in rows:
        sci_name = row["scientificName"]
        try:
            # Vérifie si la plante existe déjà
            existing = (
                client.table("plant_catalog")
                .select("id")
                .eq("scientificName", sci_name)
                .execute()
            )
            if existing.data:
                print(f"  ⏭️  Déjà en base : {sci_name}")
                skipped += 1
                continue

            # Insert
            result = client.table("plant_catalog").insert(row).execute()
            if result.data:
                print(f"  ✅ Inséré : {row['commonName']} ({sci_name})")
                inserted += 1
            else:
                print(f"  ⚠️  Insert sans retour : {sci_name}")
                errors.append(sci_name)

        except Exception as e:
            print(f"  ❌ Erreur pour {sci_name}: {e}")
            errors.append(sci_name)

    return {"inserted": inserted, "skipped": skipped, "errors": errors}


def main():
    # Vérifications préliminaires
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Variables d'environnement manquantes !")
        print("   Crée un fichier .env avec SUPABASE_URL et SUPABASE_SERVICE_KEY")
        print("   (voir .env.example)")
        return

    if not IN_FILE.exists():
        print(f"❌ Fichier {IN_FILE} introuvable — lance d'abord 2_enrich_plants.py")
        return

    plants = json.loads(IN_FILE.read_text())
    print(f"🚀 Insertion de {len(plants)} plantes dans Supabase...\n")

    # Connexion Supabase
    client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"✅ Connecté à {SUPABASE_URL}\n")

    # Comptage avant
    count_before = client.table("plant_catalog").select("id", count="exact").execute()
    nb_before = count_before.count or 0
    print(f"📊 Entrées en base avant insertion : {nb_before}\n")

    # Insertion
    result = insert_plants(client, plants)

    # Comptage après
    count_after = client.table("plant_catalog").select("id", count="exact").execute()
    nb_after = count_after.count or 0

    print(f"\n{'─'*50}")
    print(f"✅ Insertions réussies  : {result['inserted']}")
    print(f"⏭️  Déjà présents        : {result['skipped']}")
    print(f"❌ Erreurs              : {len(result['errors'])}")
    print(f"📊 Total en base        : {nb_after} (avant : {nb_before})")
    if result["errors"]:
        print(f"\n⚠️  Espèces en erreur : {', '.join(result['errors'])}")


if __name__ == "__main__":
    main()
