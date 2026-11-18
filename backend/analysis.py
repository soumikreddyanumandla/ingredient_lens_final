from __future__ import annotations
import json, re
from pathlib import Path
from typing import Any
from providers import pubchem_lookup, batch_pubchem_lookup
from ai_ml import predict_function, generate_explanation

RULES_PATH = Path(__file__).parent / "data" / "ingredient_rules.json"

def normalize(name: str) -> str:
    text = re.sub(r"\([^)]*\)", "", name or "")
    text = re.sub(r"\s+", " ", text.strip().lower())
    synonyms = {
        "aqua": "water",
        "eau": "water",
        "tocopherol acetate": "tocopheryl acetate",
        "fragrance": "parfum",
        "sodium hyaluronate": "hyaluronic acid (sodium hyaluronate)",
        "vit e": "tocopherol",
        "d-panthenol": "panthenol",
        "dl-panthenol": "panthenol",
        "provitamin b5": "panthenol",
    }
    return synonyms.get(text, text)

def split_ingredients(text: str) -> list[str]:
    return [p.strip(" .;") for p in re.split(r"\s*[,;]\s*", text or "") if p.strip()]

def load_rules() -> dict[str,Any]:
    return json.loads(RULES_PATH.read_text(encoding="utf-8"))

def _risk_for(category: str, ingredient: str, rules: dict[str,Any]) -> tuple[str,str,str,str|None]:
    entry=rules.get(category,{}).get(ingredient) or rules.get("all",{}).get(ingredient)
    if not entry:
        return "unknown","Unknown ingredient","No matching documented rule was found in the local reference set.",None
    return entry["risk"], entry["title"], entry["explanation"], entry.get("function")

async def analyze_product(product: dict[str,Any]) -> dict[str,Any]:
    rules=load_rules()
    raw_items = []
    unknown_norms = []
    for raw in product.get("ingredients",[]):
        norm=normalize(raw)
        risk,title,explanation,function=_risk_for(product["category"],norm,rules)
        ml_label,ml_conf,ml_warning=predict_function(norm)
        if norm and risk == "unknown":
            unknown_norms.append(norm)
        raw_items.append({
            "raw": raw, "norm": norm, "risk": risk, "title": title,
            "explanation": explanation, "function": function,
            "ml_label": ml_label, "ml_conf": ml_conf, "ml_warning": ml_warning
        })

    pubchem_map = await batch_pubchem_lookup(unknown_norms)

    findings=[]
    for item in raw_items:
        raw, norm, risk = item["raw"], item["norm"], item["risk"]
        pubchem = pubchem_map.get(norm, {}) if risk == "unknown" else {}
        findings.append({
            "original_name":raw,"normalized_name":norm,"risk":risk,"title":item["title"],
            "explanation":item["explanation"],"function":item["function"],"matched":risk!="unknown",
            "confidence":1.0 if risk!="unknown" else 0.0,
            "ml_function":item["ml_label"],"ml_confidence":item["ml_conf"],"ml_warning":item["ml_warning"],
            "source":rules.get(product["category"],{}).get(norm,{}).get("source")
                     or rules.get("all",{}).get(norm,{}).get("source")
                     or (pubchem.get("source") if pubchem else None),
        })
    counts={k:0 for k in ["high","moderate","low","none","unknown"]}
    for f in findings: counts[f["risk"]]+=1
    limitations=[
        "Ingredient-level findings are based on the locally documented reference rules and available product data.",
        "A missing or unknown match is not evidence that an ingredient is safe.",
    ]
    if product["category"]=="medicine":
        limitations.append("Medicine data may be incomplete. Consult a doctor or pharmacist for personal medication decisions.")
    elif product["category"]=="beauty":
        limitations.append("Individual sensitivity, concentration, formulation and real-world use are not fully captured.")
    else:
        limitations.append("Food ingredient and nutrition records can be incomplete or user-contributed.")
    result = {
        "product":product,"findings":findings,"counts":counts,
        "explanation":"",
        "generated_by":"Deterministic findings + ML ingredient-function classifier",
        "limitations":limitations,
    }
    result["explanation"] = await generate_explanation(result)
    return result

def compare(products:list[dict[str,Any]]) -> dict[str,Any]:
    if len(products)<2: raise ValueError("Two products are required.")
    a,b=products[0],products[1]
    ia={normalize(x) for x in a.get("ingredients",[])}
    ib={normalize(x) for x in b.get("ingredients",[])}
    return {"products":products[:2],"shared":sorted(ia&ib),"only_a":sorted(ia-ib),"only_b":sorted(ib-ia)}

def compatibility(a:dict[str,Any],b:dict[str,Any]) -> dict[str,Any]:
    ia={normalize(x) for x in a.get("ingredients",[])}; ib={normalize(x) for x in b.get("ingredients",[])}
    shared=sorted(ia&ib)
    missing=[]
    concerns=[]
    rules=load_rules()
    # Only documented conflict rules are allowed here.
    for x in shared:
        for y in rules.get("all",{}).get(x,{}).get("compatibility_conflicts",[]):
            if y in ib:
                concerns.append(f"{x} + {y}")
    if not a.get("ingredients"): missing.append(f"{a.get('name','Product A')}: ingredient list unavailable")
    if not b.get("ingredients"): missing.append(f"{b.get('name','Product B')}: ingredient list unavailable")
    if concerns: status="conflict"; label="Documented concern identified"; summary="A documented rule matched a potential ingredient conflict in the available data."
    elif missing: status="unknown"; label="Insufficient data"; summary="One or both ingredient lists are incomplete, so compatibility cannot be established."
    else: status="compatible"; label="No documented conflict found"; summary="No documented ingredient conflict was found in the current local rules. This is not a guarantee of personal suitability."
    return {"status":status,"label":label,"summary":summary,"shared":shared,"concerns":sorted(set(concerns)),"missing":missing}
