import type {
  AnalysisResult,
  Category,
  CompatibilityResult,
  HistoryItem,
  Product,
} from "./types";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return body as T;
}

export const searchProducts = (query: string, category: Category) =>
  request<Product[]>(`/search?query=${encodeURIComponent(query)}&category=${category}`);

export const analyzeProduct = (product: Product) =>
  request<AnalysisResult>("/analyze", {
    method: "POST",
    body: JSON.stringify({ product }),
  });

export const analyzeIngredients = (
  ingredientsText: string,
  category: Category,
  productName = "Manual Ingredient List",
) =>
  request<AnalysisResult>("/analyze/manual", {
    method: "POST",
    body: JSON.stringify({ ingredients_text: ingredientsText, category, product_name: productName }),
  });

export const compareProducts = (products: Product[]) =>
  request<{ products: Product[]; shared: string[]; only_a: string[]; only_b: string[] }>(
    "/compare",
    { method: "POST", body: JSON.stringify({ products }) },
  );

export const checkCompatibility = (a: Product, b: Product) =>
  request<CompatibilityResult>("/compatibility", {
    method: "POST",
    body: JSON.stringify({ product_a: a, product_b: b }),
  });

export const getHistory = (limit = 20) =>
  request<HistoryItem[]>(`/history?limit=${limit}`);

export const getHistoryDetail = (id: number) =>
  request<HistoryItem>(`/history/${id}`);

