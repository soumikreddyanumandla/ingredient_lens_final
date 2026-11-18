from __future__ import annotations
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, File, UploadFile, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import settings
from database import init_db, save_analysis, get_recent_analyses, get_analysis_by_id
from providers import search_products, barcode_product
from analysis import analyze_product, split_ingredients, compare, compatibility
from ai_ml import predict_function

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app=FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_origin,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

VALID={"beauty","food","medicine"}

class ManualRequest(BaseModel):
    ingredients_text: str = Field(min_length=1)
    category: str
    product_name: str = "Manual Ingredient List"

class ProductRequest(BaseModel):
    product: dict

class CompareRequest(BaseModel):
    products: list[dict]

class CompatibilityRequest(BaseModel):
    product_a: dict
    product_b: dict

@app.get("/")
async def root():
    return {
        "service": "Ingredient Lens API",
        "docs": "/docs",
        "health": "/api/health",
        "frontend": "http://localhost:5173"
    }

@app.get("/api/health")
async def health():
    return {"status":"ok","service":"Ingredient Lens API"}

@app.get("/api/search")
async def search(query: str=Query(min_length=1), category: str="beauty"):
    if category not in VALID: raise HTTPException(400,"Invalid category.")
    try: return await search_products(query,category)
    except Exception as e: raise HTTPException(502,f"Provider search failed: {e}")

@app.get("/api/barcode/{barcode}")
async def barcode(barcode: str, category: str="beauty"):
    if category not in VALID: raise HTTPException(400,"Invalid category.")
    try: return await barcode_product(barcode,category)
    except ValueError as e: raise HTTPException(404,str(e))
    except Exception as e: raise HTTPException(502,f"Barcode provider failed: {e}")

@app.post("/api/analyze")
async def analyze(req: ProductRequest):
    product=req.product
    if product.get("category") not in VALID: raise HTTPException(400,"Invalid category.")
    if not product.get("ingredients"): raise HTTPException(422,"This product record has no ingredient list. Try manual entry or upload a label.")
    result=await analyze_product(product)
    save_analysis(product.get("name","Unknown"),product["category"],result)
    return result

@app.post("/api/analyze/manual")
async def manual(req: ManualRequest):
    if req.category not in VALID: raise HTTPException(400,"Invalid category.")
    ingredients=split_ingredients(req.ingredients_text)
    product={
        "id":f"manual:{req.product_name}",
        "code":"","name":req.product_name,"brand":"Manual input","category":req.category,
        "image_url":None,"ingredients_text":req.ingredients_text,"ingredients":ingredients,
        "data_completeness":"good" if len(ingredients)>=8 else ("moderate" if len(ingredients)>=4 else "low"),
        "source":{"name":"User input","url":"","retrieved_at":""},
        "nutrition":{},"warnings":[],"active_ingredients":[],"dosage":"",
    }
    result=await analyze_product(product)
    save_analysis(product["name"],product["category"],result)
    return result

@app.post("/api/upload")
async def upload(file: UploadFile=File(...)):
    if file.content_type not in {"image/png","image/jpeg","image/webp"}:
        raise HTTPException(400,"Only JPG, PNG and WebP files are supported.")
    data=await file.read()
    if len(data)>10*1024*1024: raise HTTPException(400,"Maximum image size is 10MB.")
    try:
        import easyocr
        from PIL import Image
        import io, numpy as np
        reader=easyocr.Reader(["en"],gpu=False,verbose=False)
        img=np.array(Image.open(io.BytesIO(data)).convert("RGB"))
        results=reader.readtext(img,detail=1)
        text=" ".join(str(r[1]) for r in results)
        confidence=(sum(float(r[2]) for r in results)/len(results)) if results else None
        ingredients=split_ingredients(text)
        return {"text":text,"ingredients":ingredients,"confidence":confidence}
    except ImportError:
        raise HTTPException(503,"OCR dependency is not installed. Run: pip install easyocr")
    except Exception as e:
        raise HTTPException(422,f"OCR could not extract usable text: {e}")

@app.post("/api/compare")
async def compare_route(req: CompareRequest):
    try:return compare(req.products)
    except Exception as e:raise HTTPException(400,str(e))

@app.post("/api/compatibility")
async def compatibility_route(req: CompatibilityRequest):
    try:return compatibility(req.product_a,req.product_b)
    except Exception as e:raise HTTPException(400,str(e))

@app.get("/api/ml/predict")
async def ml_predict(ingredient: str):
    label, confidence, warning = predict_function(ingredient)
    return {
        "ingredient": ingredient,
        "function": label,
        "confidence": confidence,
        "model_version": "1.1",
        "warning": warning
    }

@app.get("/api/history")
async def get_history(limit: int = Query(default=20, ge=1, le=50)):
    try:
        return get_recent_analyses(limit=limit)
    except Exception as e:
        raise HTTPException(500, f"Database error fetching history: {e}")

@app.get("/api/history/{id}")
async def get_history_detail(id: int):
    try:
        record = get_analysis_by_id(id)
        if not record:
            raise HTTPException(404, f"Analysis record with ID {id} not found.")
        return record
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Database error fetching history record: {e}")

