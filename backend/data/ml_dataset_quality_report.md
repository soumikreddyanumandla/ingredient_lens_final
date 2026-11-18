# Ingredient Lens — ML Dataset Quality Report

## Executive Summary
The expanded ML dataset replaces the initial 50-row placeholder dataset with a high-quality, normalized repository of **427 unique ingredient records** across **19 controlled functional categories**.

---

## Dataset Overview

| Metric | Value |
| :--- | :--- |
| **Total Rows** | 427 |
| **Unique Ingredients** | 427 |
| **Taxonomy Classes** | 19 |
| **Duplicate Rows** | 0 |
| **Missing Values** | 0 |
| **Conflicting Labels** | 0 |

---

## Class Distribution

| Functional Class | Count | Percentage |
| :--- | :---: | :---: |
| `emollient` | 47 | 11.0% |
| `humectant` | 39 | 9.1% |
| `active` | 28 | 6.6% |
| `pharmaceutical_active` | 26 | 6.1% |
| `thickener` | 22 | 5.2% |
| `preservative` | 22 | 5.2% |
| `antioxidant` | 22 | 5.2% |
| `surfactant` | 21 | 4.9% |
| `emulsifier` | 21 | 4.9% |
| `nutrient` | 21 | 4.9% |
| `sweetener` | 21 | 4.9% |
| `sunscreen_filter` | 20 | 4.7% |
| `excipient_binder` | 20 | 4.7% |
| `fragrance` | 19 | 4.4% |
| `solvent` | 19 | 4.4% |
| `flavoring` | 18 | 4.2% |
| `soothing_agent` | 17 | 4.0% |
| `pH_regulator` | 16 | 3.7% |
| `chelating_agent` | 8 | 1.9% |

---

## Source Distribution

| Data Source | Record Count |
| :--- | :---: |
| Cosmetic Reference | 236 |
| PubChem | 42 |
| Food Reference | 39 |
| openFDA | 24 |
| Open Beauty Facts | 20 |
| USP Excipient Reference | 19 |
| Open Food Facts | 15 |
| PubChem / Food Reference | 14 |
| FDA / Cosmetic Reference | 8 |
| Food / Cosmetic Reference | 4 |
| PubChem / Cosmetic Reference | 3 |
| Open Beauty Facts / PubChem | 1 |
| DailyMed / FDA | 1 |
| USP / FDA Excipient Reference | 1 |

---

## Data Cleaning & Quality Safeguards
1. **Name Normalization**: Lowercase normalization, parenthetical synonym extraction, whitespace trimming, and alias mapping (`aqua` -> `water`, `nicotinamide` -> `niacinamide`).
2. **Provenance**: Every record includes explicit provenance tags (`source` column).
3. **No Synthetic Duplication**: No synthetic rows or duplicate ingredient records were created.
4. **Safety Separation**: Safety and medical risk classification remain strictly decoupled from the ML pipeline and continue to rely on local reference rules (`ingredient_rules.json`).
