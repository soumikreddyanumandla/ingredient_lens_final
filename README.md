# Ingredient Lens

A compact full-stack AI/ML-assisted ingredient analysis project inspired by the supplied Stitch UI.

## Structure

```text
ingredient_lens/
├── frontend/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── pages.tsx
│       ├── components.tsx
│       ├── api.ts
│       ├── types.ts
│       └── styles.css
└── backend/
    ├── main.py
    ├── config.py
    ├── providers.py
    ├── analysis.py
    ├── ai_ml.py
    ├── database.py
    ├── requirements.txt
    ├── .env.example
    ├── data/
    │   ├── ingredient_rules.json
    │   └── ml_dataset.csv
    └── tests/
        └── test_core.py
```

## What is implemented

- Beauty, packaged food and medicine search work through backend provider integrations.
- Open Food Facts / Open Beauty Facts product search and barcode lookup.
- openFDA medicine label lookup and DailyMed supplementary drug-name lookup.
- PubChem ingredient identity/synonym lookup.
- Ingredient normalization and category-specific transparent rules.
- OCR endpoint with EasyOCR (lazy-loaded) plus editable text workflow in the UI.
- A genuine ML component: TF-IDF + Logistic Regression predicts broad ingredient-function categories from ingredient text. This is a classification aid, not a safety model.
- Optional grounded LLM explanation endpoint. The core app works without an LLM key.
- Product analysis, comparison and compatibility pages.
- Camera barcode scanning with browser BarcodeDetector when available + manual barcode fallback.
- Local session history and responsive botanical UI.

## Windows setup

### 1. Backend

Open a terminal in `backend`:

```powershell
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn main:app --reload
```

Backend:
`http://127.0.0.1:8000`

Swagger:
`http://127.0.0.1:8000/docs`

### 2. Frontend

Open a second terminal in `frontend`:

```powershell
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally:
`http://localhost:5173`

### 3. Machine Learning Pipeline & Dataset

The ML component predicts broad ingredient functional categories (e.g. `solvent`, `humectant`, `emollient`, `active`, `pharmaceutical_active`, `preservative`).

> **Safety Separation Statement:**  
> The ML component predicts broad ingredient functional categories, while safety/risk assessment is based on the evidence-grounded ingredient reference rules (`ingredient_rules.json`). The ML model is not used to determine toxicity, allergy risk, pregnancy safety, or medical contraindications.

#### Dataset & Model Specifications:
* **Dataset Size:** 427 unique, normalized ingredient records (`backend/data/ml_dataset.csv`).
* **Taxonomy Classes:** 19 controlled functional categories (`solvent`, `humectant`, `emollient`, `surfactant`, `emulsifier`, `preservative`, `antioxidant`, `active`, `fragrance`, `thickener`, `pH_regulator`, `chelating_agent`, `soothing_agent`, `sunscreen_filter`, `sweetener`, `flavoring`, `nutrient`, `pharmaceutical_active`, `excipient_binder`).
* **Data Sources & Provenance:** Cosmetic ingredient reference literature, PubChem, Open Beauty Facts, Open Food Facts, USP & FDA Drug Labeling references.
* **Preprocessing:** Lowercase normalization, parenthetical synonym extraction, whitespace trimming, and canonical alias mapping (`aqua` -> `water`, `nicotinamide` -> `niacinamide`).
* **Architecture:** `TfidfVectorizer(lowercase=True, ngram_range=(1,2), sublinear_tf=True)` + `LogisticRegression(max_iter=2000)`.
* **Evaluation Strategy:** 5-Fold Stratified Cross-Validation & 80/20 Stratified Holdout test set.
* **Metrics & Evaluation Report:** `backend/data/ml_evaluation.json` & quality report `backend/data/ml_dataset_quality_report.json`.
* **Confusion Matrix Graphic:** `backend/data/ml_confusion_matrix.png`.

| Metric | Baseline Model (50 rows) | Improved Model (427 rows) | Gain |
| :--- | :---: | :---: | :---: |
| **Dataset Size** | 50 | 427 | **+377 records (8.5x)** |
| **Taxonomy Classes** | 15 | 19 | **+4 classes** |
| **5-Fold CV Accuracy** | 7.69% | **33.26%** | **+25.57%** |
| **Macro F1 Score** | 1.19% | **30.54%** | **+29.35% (25.6x)** |
| **Weighted F1 Score** | 1.10% | **31.52%** | **+30.42%** |

To retrain the ML model:

```powershell
python ai_ml.py --train
```

This updates:
```text
backend/data/ingredient_function_model.joblib
```
*(Previous version backed up to `backend/data/ingredient_function_model_backup.joblib`)*

### 4. Optional LLM explanation

Copy `.env.example` to `.env` and set:

```text
LLM_API_URL=
LLM_API_KEY=
LLM_MODEL=
```

The API is optional. Without it, Ingredient Lens generates a deterministic evidence-based explanation.

## Notes

- External product databases can have incomplete or user-contributed records.
- Unknown data is displayed as unknown; it is not treated as safe.
- Medicine results include a doctor/pharmacist caution.
- Do not use the application to diagnose, prescribe, or change medication.
- Live external API behavior can change; provider errors are surfaced rather than replaced with fabricated results.
