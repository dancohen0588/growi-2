"""
ÉTAPE 3 — Insertion dans Supabase via connexion PostgreSQL directe.

Utilise DIRECT_URL du .env existant (growi-frontend/.env) avec psycopg2.
Pas besoin de clé API Supabase — connexion postgres native.

Mappe species_enriched.json → plant_catalog (schéma Prisma exact).
"""

import json
import uuid
import os
import re
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from dotenv import load_dotenv
import psycopg2
import psycopg2.extras

# Charge le .env du projet (dossier parent du script)
load_dotenv(Path(__file__).parent.parent / ".env")

IN_FILE = Path(__file__).parent / "species_enriched.json"


def get_db_url() -> str:
    """
    Retourne l'URL de connexion PostgreSQL utilisable par psycopg2.

    Stratégie :
      1. DATABASE_URL (pooler Supabase via aws-0-eu-west-1.pooler.supabase.com)
         → accessible depuis n'importe où, plan gratuit inclus.
         → nécessite de supprimer les params pgBouncer (pgbouncer, connection_limit)
            que psycopg2 ne comprend pas.
      2. DIRECT_URL en fallback (connexion directe, peut être bloquée sur plan gratuit).
    """
    raw = os.environ.get("DATABASE_URL") or os.environ.get("DIRECT_URL")
    if not raw:
        raise RuntimeError("Aucune variable DATABASE_URL ou DIRECT_URL trouvée dans .env")

    # Supprime les params spécifiques à pgBouncer/Supabase que psycopg2 rejette
    parsed     = urlparse(raw)
    params     = {k: v[0] for k, v in parse_qs(parsed.query).items()}
    for key in ("pgbouncer", "connection_limit"):
        params.pop(key, None)
    clean_url  = urlunparse(parsed._replace(query=urlencode(params)))
    return clean_url


# ─── Valeurs valides (depuis plant-mapper.ts & seed SQL) ─────────────────────

# sunExposure
VALID_SUN = {"FULL_SUN", "PARTIAL", "SHADE"}

# wateringDifficulty  ← ATTENTION : "DEMANDING" pas "HARD" (cf. plant-mapper.ts)
VALID_DIFFICULTY = {"EASY", "MEDIUM", "DEMANDING"}

# category (cf. categoryMap dans plant-mapper.ts)
VALID_CATEGORY = {
    "INDOOR", "VEGETABLE", "FLOWERS", "TREES_SHRUBS",
    "HERBS",  "SUCCULENTS", "AQUATIC", "CLIMBING",
}

EMOJI_MAP = {
    "TREES_SHRUBS": "🌳",
    "FLOWERS":      "🌸",
    "HERBS":        "🌿",
    "VEGETABLE":    "🥦",
    "INDOOR":       "🪴",
    "SUCCULENTS":   "🌵",
    "CLIMBING":     "🌿",
    "AQUATIC":      "🪷",
}


def clean(val: str | None, max_len: int | None = None) -> str | None:
    """Nettoie une chaîne : strip + troncature optionnelle."""
    if not val:
        return None
    val = val.strip()
    if max_len and len(val) > max_len:
        val = val[:max_len]
    return val or None


def to_json_str(value) -> str | None:
    """Convertit une liste Python en JSON string (format stocké en DB)."""
    if not value:
        return None
    return json.dumps(value, ensure_ascii=False)


def map_to_row(plant: dict) -> dict:
    """Mappe un plant enrichi vers un dict prêt pour INSERT dans plant_catalog."""
    now = datetime.now(timezone.utc)

    category   = plant.get("category", "FLOWERS")
    if category not in VALID_CATEGORY:
        category = "FLOWERS"

    sun = plant.get("sun_exposure", "PARTIAL")
    if sun not in VALID_SUN:
        sun = "PARTIAL"

    diff = plant.get("watering_difficulty", "EASY")
    if diff not in VALID_DIFFICULTY:
        diff = "EASY"

    sci_name = plant.get("scientific_name", "").strip()
    # Supprime l'auteur taxonomique éventuel (ex: "Quercus robur L.")
    sci_name = re.sub(r"\s+[A-Z][a-z]*\.?\s*$", "", sci_name).strip()

    return {
        "id":                str(uuid.uuid4()),
        "commonName":        clean(plant.get("common_name") or sci_name, 255),
        "scientificName":    sci_name,
        "family":            clean(plant.get("family")),
        "emoji":             EMOJI_MAP.get(category, "🌱"),
        "category":          category,
        "imageUrl":          clean(plant.get("image_url")),
        "descriptionShort":  clean(plant.get("description_short"), 500),
        "descriptionLong":   clean(plant.get("description_long"),  2000),
        "sunExposure":       sun,
        "wateringFreqDays":  int(plant.get("watering_freq_days", 14)),
        "wateringDifficulty":diff,
        "minTempCelsius":    None,
        "maxTempCelsius":    None,
        "hardinesZone":      None,
        "soilTypes":         to_json_str(plant.get("soil_types")),
        "fertilizerMonths":  to_json_str(plant.get("fertilizer_months")),
        "indoor":            bool(plant.get("indoor", False)),
        "outdoor":           bool(plant.get("outdoor", True)),
        "edible":            bool(plant.get("edible", False)),
        "toxic":             bool(plant.get("toxic",  False)),
        "aliases":           to_json_str(plant.get("aliases")),
        "tags":              to_json_str(plant.get("tags")),
        "source":            "GBIF + Wikipedia FR + Wikidata",
        "createdAt":         now,
        "updatedAt":         now,
    }


INSERT_SQL = """
INSERT INTO plant_catalog (
    id, "commonName", "scientificName", family, emoji, category,
    "imageUrl", "descriptionShort", "descriptionLong",
    "sunExposure", "wateringFreqDays", "wateringDifficulty",
    "minTempCelsius", "maxTempCelsius", "hardinesZone",
    "soilTypes", "fertilizerMonths",
    indoor, outdoor, edible, toxic,
    aliases, tags, source, "createdAt", "updatedAt"
) VALUES (
    %(id)s, %(commonName)s, %(scientificName)s, %(family)s, %(emoji)s, %(category)s,
    %(imageUrl)s, %(descriptionShort)s, %(descriptionLong)s,
    %(sunExposure)s, %(wateringFreqDays)s, %(wateringDifficulty)s,
    %(minTempCelsius)s, %(maxTempCelsius)s, %(hardinesZone)s,
    %(soilTypes)s, %(fertilizerMonths)s,
    %(indoor)s, %(outdoor)s, %(edible)s, %(toxic)s,
    %(aliases)s, %(tags)s, %(source)s, %(createdAt)s, %(updatedAt)s
)
ON CONFLICT ("scientificName") DO NOTHING;
"""

COUNT_SQL   = 'SELECT COUNT(*) FROM plant_catalog;'
EXISTING_SQL= 'SELECT "scientificName" FROM plant_catalog;'


def main():
    if not IN_FILE.exists():
        print(f"❌ {IN_FILE} introuvable — lance d'abord 2_enrich_plants.py")
        return

    plants = json.loads(IN_FILE.read_text())
    print(f"🚀 Insertion de {len(plants)} plantes dans Supabase...\n")

    try:
        db_url = get_db_url()
    except RuntimeError as e:
        print(f"❌ {e}")
        return

    # Affiche quelle URL on utilise (masque le mot de passe)
    parsed = urlparse(db_url)
    safe   = db_url.replace(parsed.password or "", "***") if parsed.password else db_url
    print(f"🔗 Connexion via : {safe}\n")

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur  = conn.cursor()

    # Compte avant
    cur.execute(COUNT_SQL)
    nb_before = cur.fetchone()[0]
    print(f"📊 Entrées en base avant insertion : {nb_before}\n")

    # Noms déjà présents (pour affichage)
    cur.execute(EXISTING_SQL)
    existing = {row[0] for row in cur.fetchall()}

    inserted = 0
    skipped  = 0
    errors   = []

    for plant in plants:
        row      = map_to_row(plant)
        sci_name = row["scientificName"]

        if not sci_name:
            print(f"  ⏭️  Nom scientifique vide — ignoré")
            skipped += 1
            continue

        if sci_name in existing:
            print(f"  ⏭️  Déjà en base : {sci_name}")
            skipped += 1
            continue

        try:
            cur.execute(INSERT_SQL, row)
            print(f"  ✅ Inséré : {row['commonName']} ({sci_name})")
            inserted += 1
        except Exception as e:
            print(f"  ❌ Erreur ({sci_name}): {e}")
            conn.rollback()
            errors.append(sci_name)
            continue

    conn.commit()
    cur.execute(COUNT_SQL)
    nb_after = cur.fetchone()[0]
    cur.close()
    conn.close()

    print(f"\n{'─'*50}")
    print(f"✅ Insertions réussies  : {inserted}")
    print(f"⏭️  Déjà présents        : {skipped}")
    print(f"❌ Erreurs              : {len(errors)}")
    print(f"📊 Total en base        : {nb_after} (avant : {nb_before})")
    if errors:
        print(f"\n⚠️  Espèces en erreur : {', '.join(errors)}")


if __name__ == "__main__":
    main()
