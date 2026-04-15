"""
PIPELINE COMPLET — Lance les 3 étapes dans l'ordre.

Usage (depuis le dossier plant_scraper/) :
  python run_pipeline.py          → test  : 20 plantes
  python run_pipeline.py --full   → prod  : 1000 plantes

Prérequis :
  pip install -r requirements.txt
  Le .env de growi-frontend/ doit contenir DIRECT_URL (déjà présent normalement)
"""

import sys
import time
import importlib.util
import traceback
from pathlib import Path

# ─── Paramètres ───────────────────────────────────────────────────────────────

MODE         = "full" if "--full" in sys.argv else "test"
TARGET_COUNT = 1000 if MODE == "full" else 20

HERE = Path(__file__).parent

print(f"""
╔══════════════════════════════════════════════╗
║   🌿  GROWI — Pipeline d'import des plantes  ║
╠══════════════════════════════════════════════╣
║   Mode  : {MODE.upper():<35} ║
║   Cible : {TARGET_COUNT} plante{'s' if TARGET_COUNT > 1 else '':<33} ║
╚══════════════════════════════════════════════╝
""")


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod  = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ─── Étape 1 ──────────────────────────────────────────────────────────────────

print("=" * 52)
print("ÉTAPE 1/3 — Récupération des espèces (GBIF)")
print("=" * 52)

try:
    fetch_mod = load_module("fetch", HERE / "1_fetch_species.py")
    fetch_mod.TARGET_COUNT = TARGET_COUNT   # override du paramètre global
    fetch_mod.main()
except Exception as e:
    print(f"\n❌ ÉTAPE 1 échouée : {e}")
    traceback.print_exc()
    sys.exit(1)

if not (HERE / "species_raw.json").exists():
    print("\n❌ species_raw.json absent — arrêt.")
    sys.exit(1)

print("\n✅ Étape 1 OK\n")
time.sleep(1)

# ─── Étape 2 ──────────────────────────────────────────────────────────────────

print("=" * 52)
print("ÉTAPE 2/3 — Enrichissement Wikipedia + Wikidata")
print("=" * 52)

try:
    enrich_mod = load_module("enrich", HERE / "2_enrich_plants.py")
    enrich_mod.main()
except Exception as e:
    print(f"\n❌ ÉTAPE 2 échouée : {e}")
    traceback.print_exc()
    sys.exit(1)

if not (HERE / "species_enriched.json").exists():
    print("\n❌ species_enriched.json absent — arrêt.")
    sys.exit(1)

print("\n✅ Étape 2 OK\n")
time.sleep(1)

# ─── Étape 3 ──────────────────────────────────────────────────────────────────

print("=" * 52)
print("ÉTAPE 3/3 — Insertion dans Supabase")
print("=" * 52)

try:
    insert_mod = load_module("insert", HERE / "3_insert_db.py")
    insert_mod.main()
except Exception as e:
    print(f"\n❌ ÉTAPE 3 échouée : {e}")
    traceback.print_exc()
    sys.exit(1)

print(f"""
╔══════════════════════════════════════════════╗
║   🎉  Pipeline terminé avec succès !         ║
╠══════════════════════════════════════════════╣
║   Fichiers générés :                         ║
║   • species_raw.json      (données GBIF)     ║
║   • species_enriched.json (données complètes)║
╚══════════════════════════════════════════════╝
""")
