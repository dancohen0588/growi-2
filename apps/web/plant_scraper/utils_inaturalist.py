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

def _build_result(search: dict, detail: dict, locale: str) -> dict:
    """Fusionne les données search + detail en un dict unifié."""
    taxon_id = search["inaturalist_id"]
    return {
        "inaturalist_id":   taxon_id,
        "common_name":      detail.get("common_name") or search.get("common_name", ""),
        "description_short":detail.get("description_short", ""),
        "description_long": detail.get("description_long",  ""),
        "image_url":        search.get("image_url"),
        "wikipedia_url":    detail.get("wikipedia_url") or search.get("wikipedia_url", ""),
        "inaturalist_url":  f"https://www.inaturalist.org/taxa/{taxon_id}",
        "source_locale":    locale,
    }


def _is_complete(result: dict) -> bool:
    """Un résultat est complet s'il a description ET image."""
    return bool(result.get("description_short")) and bool(result.get("image_url"))


def _is_usable(result: dict) -> bool:
    """Un résultat est utilisable s'il a au moins une image ou un nom commun."""
    return bool(result.get("image_url")) or bool(result.get("common_name"))


def fetch_inaturalist(scientific_name: str) -> dict:
    """
    Enrichit une espèce via iNaturalist (2 appels : search + detail).

    Stratégie de fallback en cascade :
      1. Nom d'espèce complet en FR  (ex: "Quercus robur", locale=fr)
      2. Nom d'espèce complet en EN  (ex: "Quercus robur", locale=en)
      3. Nom de genre seul en FR     (ex: "Quercus", locale=fr)
         → utilisé seulement si l'espèce n'a pas de description
         → donne un résultat générique mais toujours utile (photo + description du genre)

    Retourne {} si aucune stratégie ne donne un résultat utilisable.
    """
    best: dict = {}

    # ── Essais sur le nom d'espèce complet ──────────────────────────────────
    for locale in ("fr", "en"):
        search = _search_taxon(scientific_name, locale)
        if not search or not search.get("inaturalist_id"):
            continue

        time.sleep(0.3)
        detail = _fetch_taxon_detail(search["inaturalist_id"], locale)
        result = _build_result(search, detail, locale)

        if _is_complete(result):
            return result   # desc + image → parfait, on s'arrête

        if _is_usable(result) and not best:
            best = result   # image ou nom commun → garde en réserve

    # ── Fallback genre (si pas de description après les 2 essais) ───────────
    if not best or not best.get("description_short"):
        genus = scientific_name.split()[0]   # "Quercus robur" → "Quercus"

        if genus != scientific_name:   # évite boucle si c'est déjà un nom de genre
            print(f"    ↳ Fallback genre : {genus}")
            for locale in ("fr", "en"):
                genus_search = _search_taxon(genus, locale)
                if not genus_search or not genus_search.get("inaturalist_id"):
                    continue

                time.sleep(0.3)
                genus_detail = _fetch_taxon_detail(genus_search["inaturalist_id"], locale)
                genus_result = _build_result(genus_search, genus_detail, f"{locale}/genre")

                if genus_result.get("description_short"):
                    # On garde la photo de l'espèce si on en avait une, sinon celle du genre
                    if best.get("image_url"):
                        genus_result["image_url"]        = best["image_url"]
                        genus_result["inaturalist_id"]   = best.get("inaturalist_id")
                        genus_result["inaturalist_url"]  = best.get("inaturalist_url", "")
                    if best.get("common_name"):
                        genus_result["common_name"] = best["common_name"]
                    return genus_result

    return best   # retourne le meilleur résultat même incomplet (peut être {})


def fetch_inaturalist_with_delay(scientific_name: str) -> dict:
    """Version avec délai automatique — à utiliser dans les boucles."""
    result = fetch_inaturalist(scientific_name)
    time.sleep(REQUEST_DELAY)
    return result
