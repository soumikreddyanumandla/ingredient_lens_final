from __future__ import annotations
import argparse, csv, json, os
from pathlib import Path
from typing import Any
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

from config import settings

BASE = Path(__file__).parent
DATA = BASE / "data" / "ml_dataset.csv"
MODEL = BASE / "data" / "ingredient_function_model.joblib"

MODEL_VERSION = "1.1"

def train_model() -> dict[str,Any]:
    rows=list(csv.DictReader(DATA.open(encoding="utf-8")))
    texts=[r["ingredient"] for r in rows]; labels=[r["function"] for r in rows]
    model=Pipeline([
        ("tfidf",TfidfVectorizer(lowercase=True,ngram_range=(1,2),sublinear_tf=True)),
        ("clf",LogisticRegression(max_iter=2000))
    ])
    model.fit(texts,labels)
    joblib.dump(model,MODEL)
    return {"samples":len(rows),"classes":sorted(set(labels)),"model_version":MODEL_VERSION}

_cached=None
def _load():
    global _cached
    if _cached is not None: return _cached
    if MODEL.exists():
        _cached=joblib.load(MODEL)
    else:
        try:
            train_model()
            _cached=joblib.load(MODEL)
        except Exception:
            _cached=None
    return _cached

def predict_function(ingredient: str) -> tuple[str|None,float|None,str|None]:
    model=_load()
    if model is None: return None,None,None
    try:
        probs=model.predict_proba([ingredient])[0]
        idx=probs.argmax()
        label = str(model.classes_[idx])
        conf = float(probs[idx])
        warning = "Low-confidence ML prediction; verify against reference data." if conf < 0.35 else None
        return label, conf, warning
    except Exception:
        return None,None,None

async def generate_explanation(result: dict[str,Any]) -> str:
    # Optional provider; deterministic fallback keeps core application functional.
    if settings.llm_api_url and settings.llm_api_key:
        try:
            import httpx
            prompt = {
                "product_category": result["product"]["category"],
                "product_name": result["product"]["name"],
                "findings": [
                    {"ingredient":f["normalized_name"],"risk":f["risk"],"explanation":f["explanation"],"function":f.get("function"),"source":f.get("source")}
                    for f in result["findings"]
                ],
                "limitations":result["limitations"],
                "instruction":"Explain only the supplied findings. Do not change risk states, invent facts, citations or concentrations. Do not diagnose or prescribe."
            }
            headers={"Authorization":f"Bearer {settings.llm_api_key}"}
            async with httpx.AsyncClient(timeout=25) as client:
                r=await client.post(settings.llm_api_url,json={
                    "model":settings.llm_model,
                    "messages":[{"role":"system","content":"You are a cautious evidence-grounded explainer."},{"role":"user","content":json.dumps(prompt)}],
                    "temperature":0.1
                },headers=headers)
                r.raise_for_status(); data=r.json()
                return data["choices"][0]["message"]["content"].strip()
        except Exception:
            pass
    groups={"high":[],"moderate":[],"low":[],"none":[],"unknown":[]}
    for f in result["findings"]: groups[f["risk"]].append(f["normalized_name"])
    parts=[]
    if groups["high"]: parts.append(f"{len(groups['high'])} ingredient(s) have a documented high-priority concern in the local rules.")
    if groups["moderate"]: parts.append(f"{len(groups['moderate'])} ingredient(s) have a moderate or context-dependent concern.")
    if groups["low"]: parts.append(f"{len(groups['low'])} ingredient(s) have lower-priority findings.")
    if groups["none"]: parts.append(f"{len(groups['none'])} ingredient(s) have no concern identified in the available reference set.")
    if groups["unknown"]: parts.append(f"{len(groups['unknown'])} ingredient(s) remain unknown because no local documented match was found.")
    parts.append("The ML component is used to estimate broad ingredient function categories; it is not a safety or medical-risk model.")
    return " ".join(parts)

if __name__=="__main__":
    parser=argparse.ArgumentParser(); parser.add_argument("--train",action="store_true"); args=parser.parse_args()
    if args.train: print(json.dumps(train_model(),indent=2))
