"""
utils_inaturalist.py — Wrapper iNaturalist API

Utilisé par :
  - 2_enrich_plants.py  (enrichissement lors du scraping)
  - 4_backfill_db.py    (enrichissement rétroactif des plantes déjà en base)

STRATÉGIE EN 2 APPELS :
  1. GET /v1/taxa?q={name}   → trouve le taxon, récupère ID + photo + nom commun
                               (wikipedia_summary est NULL dans cet endpoint)
  2. GET /v1/taxa/{id}       → récupère les détails complets dont wikipedia_summary

Rate limit iNaturalist : ~100 req/min → délai de 0.8s entre les paires d'appels.

Données retournées par fetch_inaturalist() :
  {
    "inaturalist_id":   int,
    "common_name":      str,   # nom commun FR (ou EN si pas de FR)
    "description_short":str,   # première phrase du résumé Wikipedia
    "description_long": str,   # résumé Wikipedia complet (≤ 2000 car.)
    "image_url":        str,   # URL photo medium (~500px)
    "wikipedia_url":    str,
    "inaturalist_url":  str,
    "source_locale":    str,   # "fr" ou "en"
  }
  Retourne {} si aucun résultat.
"""

import re
import time
import httpx

INATURALIST_SEARCH = "https://api.inaturalist.org/v1/taxa"
INATURALIST_DETAIL = "https://api.inaturalist.org/v1/taxa/{taxon_id}"
REQUEST_DELAY      = 0.8   # secondes entre chaque paire d'appels
HEADERS            = {"User-Agent": "GrowiPlantBot/1.0 (contact@growi.app)"}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _first_sentence(text: str) -> str:
    """Extrait la première phrase significative (min 20 car.)."""
    if not text:
        return ""
    match = re.match(r"^(.{20,}?[.!?])(?:\s|$)", text)
    return match.group(1).strip() if match else text[:220].strip()


def _clean(text: str) -> str:
    """Supprime les balises HTML et normalise les espaces."""
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def _handle_rate_limit(resp: httpx.Response, params: dict) -> httpx.Response:
    """Gère le 429 avec une pause de 30s puis retry."""
    if resp.status_code == 429:
        print("    ⏳ Rate limit iNaturalist — pause 30s...")
        time.sleep(30)
        resp = httpx.get(resp.url, params=params, headers=HEADERS, timeout=15)
    return resp


def _best_match(results: list[dict], scientific_name: str) -> dict | None:
    """Retourne le taxon le plus pertinent parmi les résultats de recherche."""
    sci_lower = scientific_name.lower()

    # Priorité 1 : correspondance exacte sur le nom canonique
    for r in results:
        if r.get("name", "").lower() == sci_lower:
            return r

    # Priorité 2 : correspondance sur un synonyme
    for r in results:
        synonyms = [s.get("name", "").lower() for s in r.get("taxon_names", [])]
        if sci_lower in synonyms:
            return r

    # Priorité 3 : premier résultat de rang "species"
    for r in results:
        if r.get("rank") == "species":
            return r

    return results[0] if results else None


# ─── Appel 1 : recherche ──────────────────────────────────────────────────────

def _search_taxon(scientific_name: str, locale: str) -> dict | None:
    """
    Appel 1 — /v1/taxa?q=...
    Retourne un dict avec : inaturalist_id, common_name, image_url
    wikipedia_summary EST NULL dans cet endpoint → on ira le chercher en appel 2.
    """
    params = {
        "q":        scientific_name,
        "rank":     "species",
        "locale":   locale,
        "per_page": 5,
    }
    try:
        resp = httpx.get(INATURALIST_SEARCH, params=params, headers=HEADERS, timeout=15)
        resp = _handle_rate_limit(resp, params)
        if resp.status_code != 200:
            return None

        results = resp.json().get("results", [])
        if not results:
            return None

        taxon = _best_match(results, scientific_name)
        if not taxon:
            return None

        # Photo
        photo     = taxon.get("default_photo") or {}
        image_url = photo.get("medium_url") or photo.get("url", "")
        if image_url and "square" in image_url:
            image_url = image_url.replace("square", "medium")

        return {
            "inaturalist_id": taxon.get("id"),
            "common_name":    taxon.get("preferred_common_name", ""),
            "image_url":      image_url or None,
            "wikipedia_url":  taxon.get("wikipedia_url", ""),
        }

    except httpx.TimeoutException:
        print(f"    ⚠️  Timeout search iNaturalist ({scientific_name})")
        return None
    except Exception as e:
        print(f"    ⚠️  Erreur search iNaturalist ({scientific_name}): {e}")
        return None


# ─── Appel 2 : détail ────────────────────────────────────────────────────────

def _fetch_taxon_detail(taxon_id: int, locale: str) -> dict:
    """
    Appel 2 — /v1/taxa/{id}
    Récupère wikipedia_summary (absent de l'endpoint de recherche).
    """
    url    = INATURALIST_DETAIL.format(taxon_id=taxon_id)
    params = {"locale": locale}
    try:
        resp = httpx.get(url, params=params, headers=HEADERS, timeout=15)
        resp = _handle_rate_limit(resp, params)
        if resp.status_code != 200:
            return {}

        results = resp.json().get("results", [])
        if not results:
            return {}

        taxon   = results[0]
        summary = _clean(taxon.get("wikipedia_summary", "") or "")

        # Mise à jour éventuelle du nom commun (l'endpoint detail est plus complet)
        common_name  = taxon.get("preferred_common_name", "")
        wikipedia_url = taxon.get("wikipedia_url", "")

        return {
            "common_name":      common_name,
            "description_short":_first_sentence(summary),
            "description_long": summary[:2000] if summary else "",
            "wikipedia_url":    wikipedia_url,
        }

    except httpx.TimeoutException:
        print(f"    ⚠️  Timeout detail iNaturalist (id={taxon_id})")
        return {}
    except Exception as e:
        print(f"    ⚠️  Erreur detail iNaturalist (id={taxon_id}): {e}")
        return {}


# ─── Fonction principale ──────────────────────────────────────────────────────

def fetch_inaturalist(scientific_name: str) -> dict:
    """
    Enrichit une espèce via iNaturalist en 2 appels.
    Essaie d'abord locale=fr, puis locale=en en fallback.
    Retourne {} si rien de trouvé.
    """
    for locale in ("fr", "en"):
        # Appel 1 : recherche (ID, photo, nom commun)
        search = _search_taxon(scientific_name, locale)
        if not search or not search.get("inaturalist_id"):
            continue

        taxon_id = search["inaturalist_id"]
        time.sleep(0.3)   # petit délai entre les 2 appels

        # Appel 2 : détail (wikipedia_summary)
        detail = _fetch_taxon_detail(taxon_id, locale)

        # Fusion : search fournit la photo, detail fournit la description
        result = {
            "inaturalist_id":   taxon_id,
            "common_name":      detail.get("common_name") or search.get("common_name", ""),
            "description_short":detail.get("description_short", ""),
            "description_long": detail.get("description_long",  ""),
            "image_url":        search.get("image_url"),
            "wikipedia_url":    detail.get("wikipedia_url") or search.get("wikipedia_url", ""),
            "inaturalist_url":  f"https://www.inaturalist.org/taxa/{taxon_id}",
            "source_locale":    locale,
        }

        # On accepte le résultat si on a au moins un nom commun ou une image
        if result["common_name"] or result["image_url"]:
            return result

    return {}


def fetch_inaturalist_with_delay(scientific_name: str) -> dict:
    """Version avec délai automatique — à utiliser dans les boucles."""
    result = fetch_inaturalist(scientific_name)
    time.sleep(REQUEST_DELAY)
    return result
