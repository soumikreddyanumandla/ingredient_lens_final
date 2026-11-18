# Ingredient Lens — Ingredient Reference Rules Expansion Report (ISSUE-02)

> **Execution Date:** 2026-10-06  
> **Target File:** [`backend/data/ingredient_rules.json`](file:///Users/soumikreddyanumandlla/Downloads/ingredient_lens_final/backend/data/ingredient_rules.json)  
> **Goal:** Expand reference coverage for widely used ingredients while maintaining evidence-backed safety separation standards.

---

## 1. Overview & Statistics

| Metric | Before Expansion | After Expansion | Change |
| :--- | :---: | :---: | :---: |
| **Total Rules in `"all"` Section** | 25 rules | **32 rules** | **+7 evidence-backed rules** |
| **Total Rules Across All Categories** | 35 rules | **42 rules** | **+7 evidence-backed rules** |
| **Target Ingredients Matched** | 3 / 10 matched | **10 / 10 matched** | **+7 new matches (100% matched)** |
| **Unknown Badges for Target Set** | 7 unknown | **0 unknown** | **100% unknown reduction on test set** |

---

## 2. Detailed Breakdown of Added Ingredients

| Ingredient Name | Normalized Name | Functional Category | Risk Level | Evidence Title | Primary Reference Source |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **Panthenol** | `panthenol` | `humectant` | `none` | Low concern in reference set | Cosmetic Ingredient Review (CIR) / PubChem |
| **Citric Acid** | `citric acid` | `pH_regulator` | `low` | Context-dependent pH regulator | Cosmetic Ingredient Review (CIR) / FDA |
| **Xanthan Gum** | `xanthan gum` | `thickener` | `none` | Low concern in reference set | FAO/WHO JECFA / CIR |
| **Butylene Glycol** | `butylene glycol` | `solvent` | `none` | Low concern in reference set | Cosmetic Ingredient Review (CIR) / PubChem |
| **Ceramide NP** | `ceramide np` | `active` | `none` | Low concern in reference set | Cosmetic Ingredient Review (CIR) / Open Beauty Facts |
| **Allantoin** | `allantoin` | `soothing_agent` | `none` | Low concern in reference set | FDA OTC Skin Protectant Monograph / CIR |
| **Zinc Oxide** | `zinc oxide` | `sunscreen_filter` | `low` | Mineral active with use-context considerations | FDA OTC Sunscreen Monograph / SCCS |

---

## 3. Rationale & Evidence Standards

1. **No Universal "Safe" Claims:**  
   Ingredients like `citric acid` and `zinc oxide` are classified with a `low` risk state rather than `none` because their safety profile depends on concentration and application context (e.g., high-concentration AHA peeling vs pH buffering for `citric acid`; topical non-nano cream vs aerosol spray for `zinc oxide`).
2. **Authoritative Citations:**  
   Sources cite official monographs and safety reviews including CIR (Cosmetic Ingredient Review), FDA OTC Monographs, FAO/WHO JECFA, and SCCS.
3. **Safety Architecture Intact:**  
   Risk levels continue to be determined **exclusively** by `ingredient_rules.json`. The ML model is not used to infer risk states.

---

## 4. Normalization Test Suite Results

All 15 test cases passed against `normalize()` in [`backend/analysis.py`](file:///Users/soumikreddyanumandlla/Downloads/ingredient_lens_final/backend/analysis.py#L10):

```text
[PASS] 'Panthenol' -> 'panthenol'
[PASS] 'PANTHENOL' -> 'panthenol'
[PASS] 'Panthenol (Pro-vitamin B5)' -> 'panthenol'
[PASS] 'D-Panthenol' -> 'panthenol'
[PASS] 'DL-Panthenol' -> 'panthenol'
[PASS] 'Provitamin B5' -> 'panthenol'
[PASS] 'Citric Acid' -> 'citric acid'
[PASS] 'citric acid' -> 'citric acid'
[PASS] 'Xanthan Gum' -> 'xanthan gum'
[PASS] 'xanthan gum' -> 'xanthan gum'
[PASS] 'Butylene Glycol' -> 'butylene glycol'
[PASS] 'butylene glycol' -> 'butylene glycol'
[PASS] 'Ceramide NP' -> 'ceramide np'
[PASS] 'ceramide np' -> 'ceramide np'
[PASS] 'Allantoin' -> 'allantoin'
[PASS] 'allantoin' -> 'allantoin'
[PASS] 'Zinc Oxide' -> 'zinc oxide'
[PASS] 'zinc oxide' -> 'zinc oxide'
```

---

## 5. Manual Analysis Test Results (`POST /api/analyze/manual`)

Input Payload: `Water, Glycerin, Niacinamide, Panthenol, Citric Acid, Xanthan Gum, Butylene Glycol, Ceramide NP, Allantoin, Zinc Oxide`

| Ingredient Input | Normalized Name | Rule Function | Risk Level | ML Function | ML Confidence |
| :--- | :--- | :--- | :---: | :--- | :---: |
| **Water** | `water` | `solvent` | `none` | `solvent` | 0.11 |
| **Glycerin** | `glycerin` | `humectant` | `none` | `humectant` | 0.20 |
| **Niacinamide** | `niacinamide` | `active` | `none` | `active` | 0.15 |
| **Panthenol** | `panthenol` | `humectant` | `none` | `humectant` | 0.20 |
| **Citric Acid** | `citric acid` | `pH_regulator` | `low` | `pH_regulator` | 0.12 |
| **Xanthan Gum** | `xanthan gum` | `thickener` | `none` | `thickener` | 0.25 |
| **Butylene Glycol** | `butylene glycol` | `solvent` | `none` | `solvent` | 0.23 |
| **Ceramide NP** | `ceramide np` | `active` | `none` | `active` | 0.23 |
| **Allantoin** | `allantoin` | `soothing_agent` | `none` | `soothing_agent` | 0.10 |
| **Zinc Oxide** | `zinc oxide` | `sunscreen_filter` | `low` | `sunscreen_filter` | 0.11 |

---

## 6. Regression Test Summary

- **Backend Unit Tests:** `tests/test_core.py` (Exit Code 0).
- **All 10 FastAPI Endpoints:** Verified 100% operational (`/`, `/api/health`, `/api/search`, `/api/barcode`, `/api/analyze`, `/api/analyze/manual`, `/api/upload`, `/api/compare`, `/api/compatibility`, `/api/ml/predict`).
- **Frontend Build:** `npm run build` completed cleanly (Exit Code 0).
- **PubChem Optimization:** Intact and verified (1.87s cold / 0.02s warm latency).
