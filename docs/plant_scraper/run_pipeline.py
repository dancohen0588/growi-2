"""
PIPELINE COMPLET — Lance les 3 étapes dans l'ordre avec gestion des erreurs.

Usage :
  python run_pipeline.py            # test : 20 plantes
  python run_pipeline.py --full     # production : 1000 plantes (plus tard)

Prérequis :
  pip install -r requirements.txt
  cp .env.example .env              # puis remplis SUPABASE_SERVICE_KEY
"""

import sys
import time
import traceback
from pathlib import Path

# ─── Paramètres ───────────────────────────────────────────────────────────────

MODE = "test"   # "test" = 20 plantes | "full" = 1000 plantes
if "--full" in sys.argv:
    MODE = "full"

TARGET_COUNT = 20 if MODE == "test" else 1000

print(f"""
╔══════════════════════════════════════════════╗
║   🌿  GROWI — Pipeline d'import des plantes   ║
╠══════════════════════════════════════════════╣
║   Mode    : {MODE.upper():<33} ║
║   Cible   : {TARGET_COUNT} plante{'s' if TARGET_COUNT > 1 else '':<31} ║
╚══════════════════════════════════════════════╝
""")

# ─── Étape 1 : Fetch GBIF ─────────────────────────────────────────────────────

print("=" * 50)
print("ÉTAPE 1/3 — Récupération des espèces (GBIF)")
print("=" * 50)

try:
    # Patch dynamique du TARGET_COUNT dans le module
    import importlib.util, types

    spec = importlib.util.spec_from_file_location("fetch", "1_fetch_species.py")
    fetch_mod = importlib.util.module_from_spec(spec)
    fetch_mod.TARGET_COUNT = TARGET_COUNT   # override avant exécution
    spec.loader.exec_module(fetch_mod)
    fetch_mod.TARGET_COUNT = TARGET_COUNT
    fetch_mod.main()

except Exception as e:
    print(f"\n❌ ÉTAPE 1 échouée : {e}")
    traceback.print_exc()
    sys.exit(1)

if not Path("species_raw.json").exists():
    print("\n❌ species_raw.json absent après l'étape 1 — arrêt.")
    sys.exit(1)

print("\n✅ Étape 1 terminée.\n")
time.sleep(1)

# ─── Étape 2 : Enrichissement ─────────────────────────────────────────────────

print("=" * 50)
print("ÉTAPE 2/3 — Enrichissement Wikipedia + Wikidata")
print("=" * 50)

try:
    spec = importlib.util.spec_from_file_location("enrich", "2_enrich_plants.py")
    enrich_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(enrich_mod)
    enrich_mod.main()

except Exception as e:
    print(f"\n❌ ÉTAPE 2 échouée : {e}")
    traceback.print_exc()
    sys.exit(1)

if not Path("species_enriched.json").exists():
    print("\n❌ species_enriched.json absent après l'étape 2 — arrêt.")
    sys.exit(1)

print("\n✅ Étape 2 terminée.\n")
time.sleep(1)

# ─── Étape 3 : Insertion Supabase ─────────────────────────────────────────────

print("=" * 50)
print("ÉTAPE 3/3 — Insertion dans Supabase")
print("=" * 50)

try:
    spec = importlib.util.spec_from_file_location("insert", "3_insert_db.py")
    insert_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(insert_mod)
    insert_mod.main()

except Exception as e:
    print(f"\n❌ ÉTAPE 3 échouée : {e}")
    traceback.print_exc()
    sys.exit(1)

print("\n✅ Étape 3 terminée.")

# ─── Résumé final ─────────────────────────────────────────────────────────────

print(f"""
╔══════════════════════════════════════════════╗
║   🎉  Pipeline terminé avec succès !          ║
╠══════════════════════════════════════════════╣
║   Fichiers générés :                          ║
║   • species_raw.json      (données GBIF)      ║
║   • species_enriched.json (données complètes) ║
╚══════════════════════════════════════════════╝
""")
