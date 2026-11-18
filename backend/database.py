from __future__ import annotations
import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).with_name("ingredient_lens.db")

def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS analyses (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              product_name TEXT NOT NULL,
              category TEXT NOT NULL,
              result_json TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)

def save_analysis(product_name: str, category: str, result: dict) -> int | None:
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO analyses(product_name, category, result_json) VALUES (?, ?, ?)",
            (product_name, category, json.dumps(result)),
        )
        return cursor.lastrowid

def get_recent_analyses(limit: int = 20) -> list[dict]:
    limit = max(1, min(limit, 50))
    records = []
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, product_name, category, result_json, created_at FROM analyses ORDER BY id DESC LIMIT ?",
            (limit,)
        )
        rows = cursor.fetchall()
        for row in rows:
            counts = {"high": 0, "moderate": 0, "low": 0, "none": 0, "unknown": 0}
            total_ingredients = 0
            parsed_result = None
            try:
                data = json.loads(row["result_json"])
                if isinstance(data, dict):
                    parsed_result = data
                    counts = data.get("counts", counts)
                    findings = data.get("findings", [])
                    ingredients = data.get("product", {}).get("ingredients", [])
                    total_ingredients = len(findings) if findings else len(ingredients)
            except Exception:
                pass

            records.append({
                "id": row["id"],
                "product_name": row["product_name"],
                "category": row["category"],
                "created_at": row["created_at"],
                "counts": counts,
                "total_ingredients": total_ingredients,
                "result": parsed_result,
            })
    return records

def get_analysis_by_id(analysis_id: int) -> dict | None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, product_name, category, result_json, created_at FROM analyses WHERE id = ?",
            (analysis_id,)
        )
        row = cursor.fetchone()
        if not row:
            return None

        counts = {"high": 0, "moderate": 0, "low": 0, "none": 0, "unknown": 0}
        total_ingredients = 0
        parsed_result = None
        try:
            data = json.loads(row["result_json"])
            if isinstance(data, dict):
                parsed_result = data
                counts = data.get("counts", counts)
                findings = data.get("findings", [])
                ingredients = data.get("product", {}).get("ingredients", [])
                total_ingredients = len(findings) if findings else len(ingredients)
        except Exception:
            pass

        return {
            "id": row["id"],
            "product_name": row["product_name"],
            "category": row["category"],
            "created_at": row["created_at"],
            "counts": counts,
            "total_ingredients": total_ingredients,
            "result": parsed_result,
        }
