from __future__ import annotations
import asyncio
import re
from urllib.parse import quote
from datetime import datetime, timezone
from typing import Any
import httpx
from config import settings

OFF_SEARCH = "https://world.openfoodfacts.org/cgi/search.pl"
OFF_SEARCH_V2 = "https://search.openfoodfacts.org/search"
OBF_SEARCH = "https://world.openbeautyfacts.org/cgi/search.pl"
OFF_PRODUCT = "https://world.openfoodfacts.org/api/v2/product"
OBF_PRODUCT = "https://world.openbeautyfacts.org/api/v2/product"
FDA_LABEL = "https://api.fda.gov/drug/label.json"
DAILYMED_DRUGNAMES = "https://dailymed.nlm.nih.gov/dailymed/services/v2/drugnames.json"
PUBCHEM_BASE = "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name"

FIELDS = ",".join([
    "code","product_name","product_name_en","brands","image_front_small_url",
    "image_url","ingredients_text","ingredients_text_en","ingredients_text_fr",
    "ingredients_text_es","ingredients_text_de","ingredients","ingredients_tags",
    "ingredients_original_tags","categories_tags","countries_tags",
    "nutriscore_grade","nutriments","allergens_tags"
])
RETRY_STATUSES = {429, 502, 503, 504}

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _headers() -> dict[str,str]:
    return {
        "User-Agent": "IngredientLens/1.0 (student project; https://world.openfoodfacts.org)",
        "Accept": "application/json",
    }

async def _get(client: httpx.AsyncClient, url: str, params: dict[str,Any]|None=None) -> dict[str,Any]:
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            r = await client.get(url, params=params, headers=_headers())
            if r.status_code in RETRY_STATUSES:
                last_error = httpx.HTTPStatusError(
                    f"{r.status_code} {r.reason_phrase} for url '{r.url}'",
                    request=r.request,
                    response=r,
                )
                await asyncio.sleep(0.5 * (2 ** attempt))
                continue
            r.raise_for_status()
            try:
                data = r.json()
            except ValueError as exc:
                raise ValueError("Provider returned a non-JSON response.") from exc
            if not isinstance(data, dict):
                raise ValueError("Provider returned an unexpected payload.")
            return data
        except httpx.TimeoutException as exc:
            last_error = exc
            await asyncio.sleep(0.5 * (2 ** attempt))
        except httpx.HTTPStatusError as exc:
            if exc.response is not None and exc.response.status_code in RETRY_STATUSES:
                last_error = exc
                await asyncio.sleep(0.5 * (2 ** attempt))
                continue
            raise
    if last_error:
        raise last_error
    raise RuntimeError("Provider request failed.")

def _join_text(value: Any) -> str:
    if isinstance(value, list):
        return ", ".join(str(item) for item in value if item)
    return str(value or "")

def _clean_tag(tag: str) -> str:
    if ":" in tag:
        tag = tag.split(":", 1)[1]
    return tag.replace("-", " ").strip(" .;")

def _split_ingredients(text: str|None) -> list[str]:
    if not text: return []
    text = re.sub(r"\s+", " ", text.strip())
    return [p.strip(" .;") for p in re.split(r"\s*[,;]\s*", text) if p.strip()]

def _extract_ingredients(raw: dict[str, Any]) -> tuple[str, list[str]]:
    # 1. Primary Text Fields (English, general, or language-specific)
    for key in (
        "ingredients_text_en", "ingredients_text", "ingredients_text_fr",
        "ingredients_text_es", "ingredients_text_de", "ingredients_text_it"
    ):
        val = raw.get(key)
        if isinstance(val, str) and val.strip():
            split = _split_ingredients(val)
            if split:
                return val.strip(), split

    # 2. Structured `ingredients` Array (list of dicts with 'text' or 'id')
    struct = raw.get("ingredients")
    if isinstance(struct, list) and struct:
        names: list[str] = []
        for item in struct:
            if isinstance(item, dict):
                text = item.get("text")
                if not text or not str(text).strip():
                    text = item.get("id")
                if text:
                    cleaned = _clean_tag(str(text))
                    if cleaned and len(cleaned) < 80 and not cleaned.isdigit() and cleaned not in names:
                        names.append(cleaned)
        if names:
            return ", ".join(names), names

    # 3. `ingredients_original_tags` or `ingredients_tags`
    for tag_key in ("ingredients_original_tags", "ingredients_tags"):
        tags = raw.get(tag_key)
        if isinstance(tags, list) and tags:
            names: list[str] = []
            for tag in tags:
                if isinstance(tag, str) and tag.strip():
                    cleaned = _clean_tag(tag)
                    if (
                        cleaned
                        and len(cleaned) < 60
                        and not cleaned.isdigit()
                        and not re.match(r"^\d+\s+\d+$", cleaned)
                        and cleaned not in names
                    ):
                        names.append(cleaned)
            if names:
                return ", ".join(names), names

    # 4. No valid ingredient data available
    return "", []

def _normalize_off_hit(raw: dict[str,Any]) -> dict[str,Any]:
    item = dict(raw)
    item["brands"] = _join_text(item.get("brands"))
    item["nutriments"] = item.get("nutriments") or {}
    item["allergens_tags"] = item.get("allergens_tags") or []
    return item

def _completeness(ingredients: list[str]) -> str:
    if not ingredients: return "unknown"
    if len(ingredients) >= 8: return "good"
    if len(ingredients) >= 4: return "moderate"
    return "low"

def _food_product(raw: dict[str,Any]) -> dict[str,Any]:
    ingredient_text, ingredients = _extract_ingredients(raw)
    return {
        "id": str(raw.get("code") or raw.get("id") or raw.get("product_name") or ""),
        "code": str(raw.get("code") or ""),
        "name": raw.get("product_name_en") or raw.get("product_name") or "Unnamed product",
        "brand": raw.get("brands") or "",
        "category": "food",
        "image_url": raw.get("image_front_small_url") or raw.get("image_url"),
        "ingredients_text": ingredient_text,
        "ingredients": ingredients,
        "data_completeness": _completeness(ingredients),
        "source": {"name":"Open Food Facts","url":"https://world.openfoodfacts.org/","retrieved_at":now_iso()},
        "nutrition": {
            "calories": (raw.get("nutriments") or {}).get("energy-kcal_100g"),
            "sugar_g": (raw.get("nutriments") or {}).get("sugars_100g"),
            "sodium_mg": (raw.get("nutriments") or {}).get("sodium_100g"),
            "fiber_g": (raw.get("nutriments") or {}).get("fiber_100g"),
            "protein_g": (raw.get("nutriments") or {}).get("proteins_100g"),
        },
        "warnings": raw.get("allergens_tags") or [],
        "active_ingredients": [],
        "dosage": "",
    }

def _beauty_product(raw: dict[str,Any]) -> dict[str,Any]:
    ingredient_text, ingredients = _extract_ingredients(raw)
    return {
        "id": str(raw.get("code") or raw.get("id") or raw.get("product_name") or ""),
        "code": str(raw.get("code") or ""),
        "name": raw.get("product_name_en") or raw.get("product_name") or "Unnamed product",
        "brand": raw.get("brands") or "",
        "category": "beauty",
        "image_url": raw.get("image_front_small_url") or raw.get("image_url"),
        "ingredients_text": ingredient_text,
        "ingredients": ingredients,
        "data_completeness": _completeness(ingredients),
        "source": {"name":"Open Beauty Facts","url":"https://world.openbeautyfacts.org/","retrieved_at":now_iso()},
        "nutrition": {},
        "warnings": [],
        "active_ingredients": [],
        "dosage": "",
    }

def _medicine_product(raw: dict[str,Any]) -> dict[str,Any]:
    of = raw.get("openfda", {}) or {}
    brand = (of.get("brand_name") or [""])[0]
    generic = (of.get("generic_name") or [""])[0]
    ingredients = []
    for s in (of.get("substance_name") or []):
        if s and s not in ingredients: ingredients.append(s)
    if not ingredients and generic:
        ingredients = [generic]
    warnings = []
    for key in ("warnings","boxed_warning","contraindications","do_not_use"):
        val = raw.get(key)
        if isinstance(val, list): warnings.extend([str(x) for x in val if x])
        elif isinstance(val, str): warnings.append(val)
    return {
        "id": str(raw.get("id") or brand or generic),
        "code": str((of.get("package_ndc") or [""])[0]),
        "name": brand or generic or "Medicine label",
        "brand": brand,
        "category": "medicine",
        "image_url": None,
        "ingredients_text": ", ".join(ingredients),
        "ingredients": ingredients,
        "data_completeness": _completeness(ingredients),
        "source": {"name":"openFDA","url":"https://open.fda.gov/apis/drug/label/","retrieved_at":now_iso()},
        "nutrition": {},
        "warnings": warnings[:6],
        "active_ingredients": ingredients,
        "dosage": ((raw.get("dosage_and_administration") or [""])[0] if isinstance(raw.get("dosage_and_administration"), list) else str(raw.get("dosage_and_administration") or "")),
    }

async def _search_food(client: httpx.AsyncClient, query: str, limit: int) -> list[dict[str,Any]]:
    cgi_params = {
        "search_terms": query,
        "search_simple": 1,
        "action": "process",
        "json": 1,
        "page_size": limit,
        "fields": FIELDS,
    }
    search_params = {"q": query, "page": 1, "page_size": limit, "langs": "en"}
    errors: list[Exception] = []
    for url, params, mapper in (
        (OFF_SEARCH_V2, search_params, lambda data: data.get("hits") or []),
        (OFF_SEARCH, cgi_params, lambda data: data.get("products") or []),
    ):
        try:
            data = await _get(client, url, params)
            products = []
            for raw in mapper(data):
                item = _food_product(_normalize_off_hit(raw))
                if item.get("name") and item["name"] != "Unnamed product":
                    products.append(item)
            if products:
                return products
        except (httpx.HTTPError, ValueError) as exc:
            errors.append(exc)
    if errors:
        raise errors[-1]
    return []

async def search_products(query: str, category: str, limit: int=12) -> list[dict[str,Any]]:
    q = query.strip()
    async with httpx.AsyncClient(timeout=settings.request_timeout, follow_redirects=True) as client:
        if category == "food":
            return await _search_food(client, q, limit)
        if category == "beauty":
            data = await _get(client, OBF_SEARCH, {"search_terms":q,"search_simple":1,"action":"process","json":1,"page_size":limit,"fields":FIELDS})
            return [_beauty_product(_normalize_off_hit(p)) for p in data.get("products",[]) if p.get("product_name")]
        # Medicine search logic with paracetamol/acetaminophen alias support
        search_terms = [q]
        lower_q = q.lower()
        medicine_aliases = {
            "paracetamol": "acetaminophen",
            "acetaminophen": "paracetamol",
        }
        for term, alias in medicine_aliases.items():
            if term in lower_q:
                aliased = re.sub(r"\b" + term + r"\b", alias, lower_q, flags=re.IGNORECASE)
                if aliased not in search_terms:
                    search_terms.append(aliased)

        results: list[dict[str, Any]] = []
        for term in search_terms:
            queries = [
                f'openfda.brand_name:"{term}"',
                f'openfda.generic_name:"{term}"'
            ]
            for search_q in queries:
                try:
                    data = await _get(client, FDA_LABEL, {"search": search_q, "limit": limit})
                    results.extend(_medicine_product(r) for r in data.get("results", []))
                except httpx.HTTPError:
                    continue

        # De-duplicate by label/product id
        seen = set()
        out = []
        for p in results:
            if p.get("id") and p["id"] not in seen:
                out.append(p)
                seen.add(p["id"])

        if not out:
            for term in search_terms:
                try:
                    dm = await _get(client, DAILYMED_DRUGNAMES, {"drug_name": term, "name_type": "both", "pagesize": min(limit, 20), "page": 1})
                    for row in dm.get("data", []):
                        if isinstance(row, dict):
                            raw_name = str(row.get("drug_name") or row.get("name") or "").strip()
                            if raw_name:
                                clean_name = raw_name.title()
                                item_id = f"dailymed:{raw_name.lower()}"
                                if item_id not in seen:
                                    seen.add(item_id)
                                    out.append({
                                        "id": item_id,
                                        "code": "",
                                        "name": clean_name,
                                        "brand": clean_name,
                                        "category": "medicine",
                                        "image_url": None,
                                        "ingredients_text": raw_name.lower(),
                                        "ingredients": [raw_name.lower()],
                                        "data_completeness": "low",
                                        "source": {"name": "DailyMed", "url": "https://dailymed.nlm.nih.gov/", "retrieved_at": now_iso()},
                                        "nutrition": {},
                                        "warnings": [],
                                        "active_ingredients": [raw_name.lower()],
                                        "dosage": "",
                                    })
                except httpx.HTTPError:
                    continue

        return out[:limit]

async def barcode_product(barcode: str, category: str) -> dict[str,Any]:
    base = OBF_PRODUCT if category == "beauty" else OFF_PRODUCT
    if category == "medicine":
        async with httpx.AsyncClient(timeout=settings.request_timeout, follow_redirects=True) as client:
            data = await _get(client, FDA_LABEL, {"search":f'openfda.package_ndc:"{barcode}"',"limit":1})
            results=data.get("results",[])
            if not results: raise ValueError("Medicine barcode was not found in openFDA.")
            return _medicine_product(results[0])
    async with httpx.AsyncClient(timeout=settings.request_timeout, follow_redirects=True) as client:
        data = await _get(client, f"{base}/{barcode}.json", {"fields":FIELDS})
        if data.get("status") != 1 and not data.get("product"):
            raise ValueError("Barcode was not found.")
        return _beauty_product(data.get("product",{})) if category=="beauty" else _food_product(data.get("product",{}))

_PUBCHEM_CACHE: dict[str, dict[str, Any]] = {}
_PUBCHEM_STATS = {"requests_made": 0, "cache_hits": 0, "cache_misses": 0}

def get_pubchem_stats() -> dict[str, int]:
    return dict(_PUBCHEM_STATS)

def reset_pubchem_stats() -> None:
    _PUBCHEM_STATS["requests_made"] = 0
    _PUBCHEM_STATS["cache_hits"] = 0
    _PUBCHEM_STATS["cache_misses"] = 0

async def pubchem_lookup(name: str, client: httpx.AsyncClient | None = None) -> dict[str, Any]:
    if not name:
        return {}
    if name in _PUBCHEM_CACHE:
        _PUBCHEM_STATS["cache_hits"] += 1
        return _PUBCHEM_CACHE[name]

    _PUBCHEM_STATS["cache_misses"] += 1
    _PUBCHEM_STATS["requests_made"] += 1
    
    url = f"{PUBCHEM_BASE}/{quote(name, safe='')}/property/Title,MolecularFormula/JSON"
    try:
        if client is not None:
            r = await client.get(url, headers=_headers(), timeout=4.0)
            r.raise_for_status()
            data = r.json()
        else:
            async with httpx.AsyncClient(timeout=4.0) as c:
                r = await c.get(url, headers=_headers())
                r.raise_for_status()
                data = r.json()

        props = (data.get("PropertyTable", {}).get("Properties") or [{}])[0]
        res = {
            "title": props.get("Title"),
            "formula": props.get("MolecularFormula"),
            "source": {
                "name": "PubChem",
                "url": "https://pubchem.ncbi.nlm.nih.gov/",
                "retrieved_at": now_iso()
            }
        }
    except Exception:
        res = {}
        
    _PUBCHEM_CACHE[name] = res
    return res

async def batch_pubchem_lookup(names: list[str]) -> dict[str, dict[str, Any]]:
    unique_names = list(set(n for n in names if n))
    if not unique_names:
        return {}
    async with httpx.AsyncClient(timeout=5.0) as client:
        tasks = [pubchem_lookup(name, client=client) for name in unique_names]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        out = {}
        for name, res in zip(unique_names, results):
            out[name] = res if isinstance(res, dict) else {}
        return out
