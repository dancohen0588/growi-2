"""
PIPELINE COMPLET — Scrape, filtre, enrichit et insère des plantes en base.

Usage :
  python run_pipeline.py                  → test    : 20 plantes
  python run_pipeline.py --count 500      → 500 nouvelles plantes
  python run_pipeline.py --count 1000     → 1000 nouvelles plantes

Le pipeline est intelligent :
  - Étape 1b filtre les plantes déjà en base → on n'importe que du nouveau
  - Étape 2 enrichit via iNaturalist (desc + image garantis au max)
  - Étape 3 insère sans doublons (ON CONFLICT DO NOTHING)

Estimation des durées (hors réseau) :
  20   plantes →  ~2 min
  500  plantes → ~30 min  (2 appels iNaturalist/plante × 1.1s de délai)
  1000 plantes → ~60 min
"""

import sys
import time
import importlib.util
import traceback
from pathlib import Path

# ─── Paramètres ───────────────────────────────────────────────────────────────

def parse_count() -> int:
    """Lit --count N depuis argv, défaut 20."""
    for i, arg in enumerate(sys.argv):
        if arg == "--count" and i + 1 < len(sys.argv):
            try:
                return int(sys.argv[i + 1])
            except ValueError:
                print(f"⚠️  --count '{sys.argv[i+1]}' invalide, utilise 20 par défaut.")
    # Rétrocompatibilité avec l'ancien flag --full
    if "--full" in sys.argv:
        return 1000
    return 20

TARGET_COUNT = parse_count()
HERE         = Path(__file__).parent

cible_line = f"Cible     : {TARGET_COUNT} nouvelles plantes"
print(f"""
╔══════════════════════════════════════════════╗
║   🌿  GROWI — Pipeline d'import des plantes  ║
╠══════════════════════════════════════════════╣
║   {cible_line:<43} ║
║   Étapes : GBIF → filtre DB → iNaturalist → Supabase ║
╚══════════════════════════════════════════════╝
""")


# ─── Helper de chargement de module ──────────────────────────────────────────

def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod  = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# ─── Étape 1 : Fetch GBIF ────────────────────────────────────────────────────

print("=" * 52)
print("ÉTAPE 1/4 — Récupération des espèces (GBIF)")
print("=" * 52)

try:
    fetch_mod = load_module("fetch", HERE / "1_fetch_species.py")
    # On demande plus de candidats que nécessaire pour absorber les doublons
    fetch_mod.TARGET_COUNT = int(TARGET_COUNT * 1.4)
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


# ─── Étape 1b : Pré-filtrage anti-doublons ───────────────────────────────────

print("=" * 52)
print("ÉTAPE 2/4 — Filtrage anti-doublons (DB)")
print("=" * 52)

try:
    prefilter_mod = load_module("prefilter", HERE / "1b_prefilter.py")
    prefilter_mod.TARGET_COUNT = TARGET_COUNT
    prefilter_mod.main()
except Exception as e:
    print(f"\n⚠️  Pré-filtrage échoué ({e}) — on continue sans filtre.")

# Vérifie qu'il reste des plantes à traiter
import json
species_remaining = json.loads((HERE / "species_raw.json").read_text())
if not species_remaining:
    print("\n✅ Toutes les plantes de ce batch sont déjà en base. Rien à faire.")
    sys.exit(0)

print(f"\n✅ Étape 2 OK — {len(species_remaining)} plante(s) à enrichir\n")
time.sleep(1)


# ─── Étape 2 : Enrichissement iNaturalist ────────────────────────────────────

print("=" * 52)
print("ÉTAPE 3/4 — Enrichissement iNaturalist")
print(f"           (~{len(species_remaining) * 2} appels API, patience...)")
print("=" * 52)

try:
    enrich_mod = load_module("enrich", HERE / "2_enrich_plants.py")
    enrich_mod.main()
except Exception as e:
    print(f"\n❌ ÉTAPE 3 échouée : {e}")
    traceback.print_exc()
    sys.exit(1)

if not (HERE / "species_enriched.json").exists():
    print("\n❌ species_enriched.json absent — arrêt.")
    sys.exit(1)

# Rapport qualité intermédiaire
enriched = json.loads((HERE / "species_enriched.json").read_text())
with_desc = sum(1 for e in enriched if e.get("description_short"))
with_img  = sum(1 for e in enriched if e.get("image_url"))
print(f"\n📊 Qualité après enrichissement :")
print(f"   • Avec description : {with_desc}/{len(enriched)} ({with_desc*100//len(enriched) if enriched else 0}%)")
print(f"   • Avec image       : {with_img}/{len(enriched)}  ({with_img*100//len(enriched) if enriched else 0}%)")
print("\n✅ Étape 3 OK\n")
time.sleep(1)


# ─── Étape 3 : Insertion Supabase ────────────────────────────────────────────

print("=" * 52)
print("ÉTAPE 4/4 — Insertion dans Supabase")
print("=" * 52)

try:
    insert_mod = load_module("insert", HERE / "3_insert_db.py")
    insert_mod.main()
except Exception as e:
    print(f"\n❌ ÉTAPE 4 échouée : {e}")
    traceback.print_exc()
    sys.exit(1)

print(f"""
╔══════════════════════════════════════════════╗
║   🎉  Pipeline terminé !                     ║
╠══════════════════════════════════════════════╣
║   Fichiers générés :                         ║
║   • species_raw.json      (candidats GBIF)   ║
║   • species_skipped.json  (doublons ignorés) ║
║   • species_enriched.json (données complètes)║
╚══════════════════════════════════════════════╝
""")
