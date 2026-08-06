"""
ÉTAPE 4 — Enrichissement rétroactif des plantes déjà en base via iNaturalist.

Ce script :
  1. Lit la table plant_catalog et trouve les plantes avec des champs manquants
     (descriptionShort IS NULL OR imageUrl IS NULL)
  2. Pour chacune, appelle iNaturalist
  3. Met à jour les champs vides en base (UPDATE ciblé — ne touche pas les données existantes)

Usage :
  python 4_backfill_db.py              → enrichit les plantes avec champs manquants
  python 4_backfill_db.py --all        → re-enrichit TOUTES les plantes (même celles déjà remplies)
  python 4_backfill_db.py --dry-run    → affiche ce qui serait fait sans modifier la base

Le script est idempotent : re-lancer ne crée pas de doublons.
"""

import os
import sys
import json
import time
import re
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from dotenv import load_dotenv
import psycopg2

# Import du module iNaturalist partagé
sys.path.insert(0, str(Path(__file__).parent))
from utils_inaturalist import fetch_inaturalist_with_delay

# Charge le .env du projet (dossier parent)
load_dotenv(Path(__file__).parent.parent / ".env")

# ─── Options ──────────────────────────────────────────────────────────────────

FORCE_ALL = "--all"     in sys.argv   # re-enrichit même les plantes déjà remplies
DRY_RUN   = "--dry-run" in sys.argv   # n'écrit pas en base


# ─── Connexion DB (même logique que 3_insert_db.py) ──────────────────────────

def get_db_url() -> str:
    raw = os.environ.get("DATABASE_URL") or os.environ.get("DIRECT_URL")
    if not raw:
        raise RuntimeError("Aucune variable DATABASE_URL ou DIRECT_URL trouvée dans .env")
    parsed = urlparse(raw)
    params = {k: v[0] for k, v in parse_qs(parsed.query).items()}
    for key in ("pgbouncer", "connection_limit"):
        params.pop(key, None)
    return urlunparse(parsed._replace(query=urlencode(params)))


# ─── Requêtes SQL ─────────────────────────────────────────────────────────────

# Plantes avec champs manquants (mode normal)
SELECT_MISSING_SQL = """
SELECT id, "commonName", "scientificName", family, category
FROM plant_catalog
WHERE "descriptionShort" IS NULL
   OR "imageUrl"         IS NULL
ORDER BY "scientificName";
"""

# Toutes les plantes (mode --all)
SELECT_ALL_SQL = """
SELECT id, "commonName", "scientificName", family, category
FROM plant_catalog
ORDER BY "scientificName";
"""

UPDATE_SQL = """
UPDATE plant_catalog SET
    "commonName"       = CASE WHEN %(update_name)s AND %(commonName)s IS NOT NULL
                              THEN %(commonName)s ELSE "commonName" END,
    "descriptionShort" = COALESCE(%(descriptionShort)s, "descriptionShort"),
    "descriptionLong"  = COALESCE(%(descriptionLong)s,  "descriptionLong"),
    "imageUrl"         = COALESCE(%(imageUrl)s,         "imageUrl"),
    "updatedAt"        = %(updatedAt)s
WHERE id = %(id)s;
"""


# ─── Helpers ──────────────────────────────────────────────────────────────────

def clean(val: str | None, max_len: int | None = None) -> str | None:
    if not val:
        return None
    val = val.strip()
    if max_len and len(val) > max_len:
        val = val[:max_len]
    return val or None


def name_is_placeholder(name: str, scientific_name: str) -> bool:
    """Retourne True si le nom commun est en fait le nom scientifique (placeholder)."""
    return name.strip().lower() == scientific_name.strip().lower()


# ─── Backfill principal ───────────────────────────────────────────────────────

def backfill(cur, plants: list[dict]) -> dict:
    stats = {"updated": 0, "skipped": 0, "no_data": 0, "errors": []}

    for plant in plants:
        plant_id   = plant["id"]
        sci_name   = plant["scientificName"]
        cur_name   = plant["commonName"]

        print(f"\n  🔍 {sci_name}")

        inat = fetch_inaturalist_with_delay(sci_name)

        if not inat:
            print(f"     ❌ Aucune donnée iNaturalist")
            stats["no_data"] += 1
            continue

        has_desc  = bool(inat.get("description_short"))
        has_img   = bool(inat.get("image_url"))
        locale    = inat.get("source_locale", "—")
        new_name  = inat.get("common_name", "")

        print(f"     → desc={'✅' if has_desc else '❌'}  image={'✅' if has_img else '❌'}  locale={locale}")

        if has_desc:
            print(f"     → {inat['description_short'][:80]}...")

        # Décide si on met à jour le nom commun :
        # seulement si l'actuel est un placeholder (= nom scientifique)
        should_update_name = (
            bool(new_name)
            and name_is_placeholder(cur_name, sci_name)
        )

        row = {
            "id":               plant_id,
            "commonName":       clean(new_name, 255) if should_update_name else None,
            "update_name":      should_update_name,
            "descriptionShort": clean(inat.get("description_short"), 500),
            "descriptionLong":  clean(inat.get("description_long"),  2000),
            "imageUrl":         clean(inat.get("image_url")),
            "updatedAt":        datetime.now(timezone.utc),
        }

        if DRY_RUN:
            print(f"     [DRY-RUN] UPDATE plant_catalog SET ... WHERE id={plant_id}")
            stats["updated"] += 1
            continue

        try:
            cur.execute(UPDATE_SQL, row)
            action = "mis à jour"
            if should_update_name:
                action += f" + nom → {new_name}"
            print(f"     ✅ {action}")
            stats["updated"] += 1
        except Exception as e:
            print(f"     ❌ Erreur UPDATE ({sci_name}): {e}")
            stats["errors"].append(sci_name)

    return stats


# ─── Main ──────────────────────────────────────────────────────────────────────

def main():
    mode = "FORCE_ALL" if FORCE_ALL else "MISSING_ONLY"
    if DRY_RUN:
        mode += " [DRY-RUN]"

    print(f"""
╔══════════════════════════════════════════════╗
║   🌿  GROWI — Backfill iNaturalist           ║
╠══════════════════════════════════════════════╣
║   Mode : {mode:<37} ║
╚══════════════════════════════════════════════╝
""")

    try:
        db_url = get_db_url()
    except RuntimeError as e:
        print(f"❌ {e}")
        return

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Sélectionne les plantes à enrichir
    query = SELECT_ALL_SQL if FORCE_ALL else SELECT_MISSING_SQL
    cur.execute(query)
    plants = cur.fetchall()

    if not plants:
        print("✅ Aucune plante à enrichir — tout est déjà rempli !")
        cur.close()
        conn.close()
        return

    print(f"📋 {len(plants)} plante(s) à enrichir\n")

    # Lance le backfill
    stats = backfill(cur, plants)

    if not DRY_RUN:
        conn.commit()

    cur.close()
    conn.close()

    print(f"""
{'─'*50}
✅ Mis à jour  : {stats['updated']}
⏭️  Sans données : {stats['no_data']}
❌ Erreurs     : {len(stats['errors'])}
{'─'*50}
""")

    if stats["errors"]:
        print(f"⚠️  Espèces en erreur : {', '.join(stats['errors'])}")

    if DRY_RUN:
        print("ℹ️  Mode DRY-RUN : aucune modification effectuée en base.")


if __name__ == "__main__":
    # psycopg2.extras.RealDictCursor nécessite l'import explicite
    import psycopg2.extras
    main()
