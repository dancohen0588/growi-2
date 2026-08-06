"""
ÉTAPE 1b — Pré-filtrage : retire les plantes déjà en base de species_raw.json.

À insérer entre 1_fetch_species.py et 2_enrich_plants.py.
Sans ce filtre, on gaspille des appels iNaturalist sur des espèces
déjà importées lors d'un run précédent.

Entrée  : species_raw.json   (sortie de 1_fetch_species.py)
Sortie  : species_raw.json   (réécrit, doublons supprimés)
          species_skipped.json (archive des doublons pour traçabilité)

Affiche un rapport : combien supprimés, combien restants, combien demandés.
"""

import os
import json
from pathlib import Path
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from dotenv import load_dotenv
import psycopg2

load_dotenv(Path(__file__).parent.parent / ".env")

IN_FILE       = Path(__file__).parent / "species_raw.json"
SKIPPED_FILE  = Path(__file__).parent / "species_skipped.json"

# TARGET_COUNT est injecté par run_pipeline.py ; fallback à None (pas de limite)
TARGET_COUNT = None


def get_db_url() -> str:
    raw = os.environ.get("DATABASE_URL") or os.environ.get("DIRECT_URL")
    if not raw:
        raise RuntimeError("Aucune variable DATABASE_URL ou DIRECT_URL trouvée dans .env")
    parsed = urlparse(raw)
    params = {k: v[0] for k, v in parse_qs(parsed.query).items()}
    for key in ("pgbouncer", "connection_limit"):
        params.pop(key, None)
    return urlunparse(parsed._replace(query=urlencode(params)))


def fetch_existing_names(conn) -> set[str]:
    """Retourne tous les scientificName déjà présents en base."""
    cur = conn.cursor()
    cur.execute('SELECT "scientificName" FROM plant_catalog;')
    names = {row[0] for row in cur.fetchall()}
    cur.close()
    return names


def main():
    if not IN_FILE.exists():
        print(f"❌ {IN_FILE} introuvable — lance d'abord 1_fetch_species.py")
        return

    species_list = json.loads(IN_FILE.read_text())
    print(f"📋 {len(species_list)} espèces candidates dans species_raw.json")

    # Connexion DB
    try:
        conn = psycopg2.connect(get_db_url())
    except Exception as e:
        print(f"❌ Connexion DB impossible : {e}")
        print("   Le filtrage anti-doublons est ignoré — on continue avec toutes les espèces.")
        return

    existing = fetch_existing_names(conn)
    conn.close()
    print(f"🗄️  {len(existing)} plantes déjà en base")

    # Sépare les nouvelles des doublons
    new_species     = []
    skipped_species = []

    for sp in species_list:
        sci = sp.get("scientific_name", "").strip()
        if sci in existing:
            skipped_species.append(sp)
        else:
            new_species.append(sp)

    print(f"\n  ✅ Nouvelles espèces      : {len(new_species)}")
    print(f"  ⏭️  Déjà en base (ignorées): {len(skipped_species)}")

    # Applique la limite TARGET_COUNT si définie
    if TARGET_COUNT and len(new_species) > TARGET_COUNT:
        surplus      = new_species[TARGET_COUNT:]
        new_species  = new_species[:TARGET_COUNT]
        skipped_species.extend(surplus)
        print(f"  ✂️  Tronqué à {TARGET_COUNT} (limite demandée)")

    if not new_species:
        print("\n⚠️  Aucune nouvelle espèce à importer — toutes sont déjà en base.")
        print("   Lance 1_fetch_species.py avec un TARGET_COUNT plus grand pour en récupérer d'autres.")

    # Sauvegarde
    IN_FILE.write_text(json.dumps(new_species, ensure_ascii=False, indent=2))
    SKIPPED_FILE.write_text(json.dumps(skipped_species, ensure_ascii=False, indent=2))

    print(f"\n💾 species_raw.json mis à jour ({len(new_species)} espèces à traiter)")
    print(f"💾 species_skipped.json archivé  ({len(skipped_species)} ignorées)")


if __name__ == "__main__":
    main()
