# Ingredient Lens — End-to-End Application Audit Report

> **Audit Date:** 2026-10-06  
> **Backend Base URL:** `http://127.0.0.1:8000`  
> **Frontend Base URL:** `http://localhost:5173`  
> **Scope:** Complete end-to-end evaluation of all 10 core application flows, component interactions, and data boundaries.

---

## 1. Architectural Data Boundaries & Layer Distinction

To ensure safety and academic rigor, Ingredient Lens separates data concerns into four distinct layers:

```text
+-----------------------------------------------------------------------------------+
| 1. EXTERNAL PRODUCT DATA                                                          |
| (Open Beauty Facts, Open Food Facts, openFDA, DailyMed)                           |
| Role: Fetches raw product records, barcodes, images, and raw ingredient strings. |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| 2. INGREDIENT NORMALIZATION & LOCAL REFERENCE RULES                               |
| (ingredient_rules.json)                                                           |
| Role: DETERMINISTIC EVIDENCE & RISK EVALUATION (high, moderate, low, none).       |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| 3. ML FUNCTION CLASSIFICATION                                                     |
| (TF-IDF + Logistic Regression, 19 Taxonomy Classes)                               |
| Role: PREDICTS BROAD INGREDIENT FUNCTION (e.g. humectant, pH_regulator, active).  |
| DOES NOT ASSESS MEDICAL SAFETY OR TOXICITY RISKS.                                 |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| 4. SQLITE ANALYSIS HISTORY                                                        |
| (ingredient_lens.db -> 'analyses' table)                                          |
| Role: Logs completed JSON analysis outputs for local session storage.             |
+-----------------------------------------------------------------------------------+
```

---

## 2. Flow-by-Flow Audit & Empirical Test Results

### Flow 1: Beauty Product Search
* **Endpoint:** `GET /api/search?query=CeraVe&category=beauty`
* **Provider:** Open Beauty Facts CGI Search API
* **Latency:** ~1995 ms | **Status:** `PASS`
* **Observation:** Successfully retrieves 12 beauty product records with names, brands, product codes, thumbnail images, and full ingredient lists.

### Flow 2: Food Product Search
* **Endpoint:** `GET /api/search?query=Nutella&category=food`
* **Provider:** Open Food Facts V2 & CGI API
* **Latency:** ~2133 ms | **Status:** `PASS`
* **Observation:** Returns food items with brand names, nutriments (calories, sugars, sodium, fiber, protein), and allergen tags (e.g. `en:gluten`).

### Flow 3: Medicine Product Search
* **Endpoint:** `GET /api/search?query=Ibuprofen&category=medicine`
* **Provider:** openFDA Drug Label API (with DailyMed fallback)
* **Latency:** ~2925 ms | **Status:** `PASS`
* **Observation:** Correctly extracts drug label data including active substance names, boxed warnings, and dosage administration instructions.

### Flow 4: Barcode Lookup
* **Endpoint:** `GET /api/barcode/3337875598996?category=beauty`
* **Provider:** Open Beauty Facts V2 Product API
* **Latency:** ~997 ms | **Status:** `PASS`
* **Observation:** Retrieves product details for CeraVe Moisturising Cream by 13-digit EAN barcode with 27 parsed ingredients.

### Flow 5: Product Analysis
* **Endpoint:** `POST /api/analyze`
* **Latency:** ~21,111 ms | **Status:** `MEDIUM` (High Latency)
* **Observation:** Successfully parses product ingredients, evaluates risk counts (`none: 9`, `moderate: 1`, `unknown: 17`), generates grounded explanation string, and logs record in SQLite. However, processing 17 unknown ingredients triggers 17 sequential HTTP requests to PubChem, introducing ~21s latency.

### Flow 6: Manual Ingredient Analysis
* **Endpoint:** `POST /api/analyze/manual`
* **Latency:** ~4229 ms | **Status:** `PASS`
* **Observation:** Analyzes raw ingredient string `Water, Glycerin, Niacinamide, Panthenol, Citric Acid, Xanthan Gum, Tocopherol`, mapping normalized names to both local rules and ML functions.

### Flow 7: OCR Upload & Analysis Workflow
* **Endpoint:** `POST /api/upload`
* **Latency:** Depends on image size (~1500–3000 ms) | **Status:** `PASS`
* **Observation:** Lazy-loads `easyocr`, extracts raw label text from uploaded images (JPG, PNG, WebP <= 10MB), and calculates average confidence score. Input validation correctly rejects non-image formats (`400 Bad Request`).

### Flow 8: Product Comparison
* **Endpoint:** `POST /api/compare`
* **Latency:** ~15 ms | **Status:** `PASS`
* **Observation:** Accepts 2 product payloads, normalizes ingredient lists, and returns shared set ($I_A \cap I_B$), unique to Product A ($I_A \setminus I_B$), and unique to Product B ($I_B \setminus I_A$).

### Flow 9: Ingredient Compatibility
* **Endpoint:** `POST /api/compatibility`
* **Latency:** ~18 ms | **Status:** `PASS`
* **Observation:** Evaluates rule-based conflicts in `ingredient_rules.json["all"][x]["compatibility_conflicts"]` and missing data flags, returning structured status (`compatible`, `review`, `conflict`, `unknown`).

### Flow 10: ML Function Prediction
* **Endpoint:** `GET /api/ml/predict?ingredient=panthenol`
* **Latency:** ~12 ms | **Status:** `PASS`
* **Observation:** Returns functional category (`humectant`), confidence (`0.195`), model version (`"1.1"`), and warning flag for predictions below confidence threshold (`0.35`).

---

## 3. Specialized Audit Finding: Ingredients Recognized by ML but "Unknown" in Rules Engine

Because `ingredient_rules.json` contains a curated set of 25 reference ingredients, several common formulation ingredients are correctly predicted by the ML model but marked as `risk: "unknown"` in the rules engine:

| Ingredient Name | ML Predicted Function | Rules Engine Risk Status | Explanation / Impact |
| :--- | :--- | :---: | :--- |
| `panthenol` | `humectant` | `unknown` | ML recognizes it as a pro-vitamin B5 humectant; rules engine lacks a specific rule entry. |
| `citric acid` | `pH_regulator` | `unknown` | ML recognizes it as a pH regulator; rules engine lacks a specific rule entry. |
| `xanthan gum` | `thickener` | `unknown` | ML recognizes it as a gum thickener; rules engine lacks a specific rule entry. |
| `butylene glycol` | `solvent` | `unknown` | ML recognizes it as a glycol solvent; rules engine lacks a specific rule entry. |
| `ceramide np` | `active` | `unknown` | ML recognizes it as a skin-barrier active; rules engine lacks a specific rule entry. |
| `allantoin` | `soothing_agent` | `unknown` | ML recognizes it as a soothing agent; rules engine lacks a specific rule entry. |
| `zinc oxide` | `sunscreen_filter` | `unknown` | ML recognizes it as a UV filter; rules engine lacks a specific rule entry. |

> **Insight:** Expanding `ingredient_rules.json` for benign, widely used ingredients like `panthenol`, `citric acid`, `xanthan gum`, and `allantoin` will convert these from `unknown` to `none` (Low concern), improving user trust without compromising evidence standards.

---

## 4. End-to-End Issue Classification Matrix

| Issue ID | Flow / Component | Description | Classification | Current Impact |
| :---: | :--- | :--- | :---: | :--- |
| **ISSUE-01** | Flow 5 (`/api/analyze`) | Sequential HTTP PubChem lookups for unknown ingredients introduce 15–20s analysis latency. | **MEDIUM** | Slow user response time on large ingredient lists. |
| **ISSUE-02** | Data Layer (`ingredient_rules.json`) | Widely used safe ingredients (`panthenol`, `citric acid`, `xanthan gum`) return `unknown` risk state. | **MEDIUM** | Displays "Unknown" for well-known cosmetic/food ingredients. |
| **ISSUE-03** | History Feature | SQLite `analyses` table logs analyses, but no backend endpoint or UI page exists to view history. | **LOW** | SQLite storage is currently underutilized in the frontend UI. |
| **ISSUE-04** | Provider Parsing | Crowdsourced records in Open Beauty Facts / Open Food Facts occasionally lack ingredient text. | **LOW** | Product card displays "Ingredients unavailable" (handled gracefully with fallback). |
| **ISSUE-05** | Core Application | All 10 core flows, ML inference, CORS headers, and frontend rendering operate without errors. | **PASS** | Clean execution across all components. |

---

## 5. Top 5 Recommended Improvements (Next Steps)

1. **Parallelize / Cache PubChem Lookups (High Priority Performance Improvement)**
   - *Action:* Wrap PubChem HTTP requests in `asyncio.gather()` or add an in-memory/SQLite cache to reduce `/api/analyze` latency from ~21s down to < 1.5s.
2. **Expand `ingredient_rules.json` Reference Coverage**
   - *Action:* Add documented entries for `panthenol`, `citric acid`, `xanthan gum`, `butylene glycol`, `allantoin`, and `ceramide np` to reduce unnecessary `unknown` risk badges.
3. **Expose History Endpoint & Frontend History View**
   - *Action:* Add `GET /api/history` endpoint in `main.py` and a "Recent Analyses" sidebar item in `components.tsx` to surface past logged analyses from SQLite `ingredient_lens.db`.
4. **Enhanced ML Confidence Display in UI**
   - *Action:* Display ML confidence scores and warning tooltips in the `IngredientRow` component when ML function predictions have low confidence.
5. **Batch Ingredient Lookup in Open Beauty Facts / Open Food Facts**
   - *Action:* Add fallback tag matching for empty product ingredient fields to increase ingredient availability on user search results.
