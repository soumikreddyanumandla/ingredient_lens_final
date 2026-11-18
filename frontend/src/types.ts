export type Category = "beauty" | "food" | "medicine";
export type Risk = "high" | "moderate" | "low" | "none" | "unknown";

export interface SourceInfo {
  name: string;
  url?: string;
  retrieved_at?: string;
}

export interface IngredientFinding {
  original_name: string;
  normalized_name: string;
  risk: Risk;
  title: string;
  explanation: string;
  function?: string;
  source?: SourceInfo;
  matched: boolean;
  confidence?: number;
  ml_function?: string;
  ml_confidence?: number;
  ml_warning?: string;
}

export interface Product {
  id: string;
  code?: string;
  name: string;
  brand?: string;
  category: Category;
  image_url?: string;
  ingredients_text?: string;
  ingredients: string[];
  data_completeness: "good" | "moderate" | "low" | "unknown";
  source: SourceInfo;
  nutrition?: Record<string, string | number>;
  warnings?: string[];
  active_ingredients?: string[];
  dosage?: string;
}

export interface AnalysisResult {
  product: Product;
  findings: IngredientFinding[];
  counts: Record<Risk, number>;
  explanation: string;
  generated_by: string;
  limitations: string[];
}

export interface CompatibilityResult {
  status: "compatible" | "review" | "unknown" | "conflict";
  label: string;
  summary: string;
  shared: string[];
  concerns: string[];
  missing: string[];
}

export interface ApiError {
  detail: string;
}

export interface HistoryItem {
  id: number;
  product_name: string;
  category: Category;
  created_at: string;
  counts: Record<Risk, number>;
  total_ingredients: number;
  result: AnalysisResult | null;
}
