import { useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowLeft, ArrowRight, Beaker, CheckCircle2,
  ChevronRight, CircleHelp, Clock, FileText, FlaskConical, HeartPulse,
  Home, Leaf, Menu, Microscope, Search, ShieldCheck, ShieldAlert, Sparkles,
  X, Utensils, Wand2, GitCompare, Pill, Droplets
} from "lucide-react";
import type { AnalysisResult, Category, IngredientFinding, Product, Risk } from "./types";

export const categoryMeta: Record<Category, { label: string; icon: ReactNode; tone: string; subtitle: string }> = {
  beauty: { label: "Beauty & Personal Care", icon: <Droplets size={20}/>, tone: "pink", subtitle: "Skincare, haircare, cosmetics and more" },
  food: { label: "Packaged Food", icon: <Utensils size={20}/>, tone: "yellow", subtitle: "Snacks, beverages, groceries and more" },
  medicine: { label: "Medicine", icon: <Pill size={20}/>, tone: "lavender", subtitle: "Prescription & OTC medicines" },
};

export function Sidebar({ current, onNavigate }: { current?: string; onNavigate?: () => void }) {
  const items = [
    { label: "Home", path: "/", icon: <Home size={17}/> },
    { label: "Search", path: "/search", icon: <Search size={17}/> },
    { label: "Compare", path: "/compare", icon: <GitCompare size={17}/> },
    { label: "Compatibility", path: "/compatibility", icon: <Leaf size={17}/> },
    { label: "History", path: "/history", icon: <Clock size={17}/> },
  ];
  return (
    <aside className="sidebar">
      <div className="brand" onClick={() => (window.location.href = "/")}>
        <div className="brand-mark"><Leaf size={18}/></div>
        <div><strong>Ingredient</strong><span>Lens</span></div>
      </div>
      <nav>
        {items.map(i => (
          <a key={i.path} href={i.path} className={current === i.label ? "nav-item active" : "nav-item"} onClick={onNavigate}>
            {i.icon}<span>{i.label}</span>
          </a>
        ))}
      </nav>
      <div className="profile">
        <div className="avatar">S</div>
        <div><strong>Siri Arelli</strong><span>Student</span></div>
      </div>
    </aside>
  );
}

export function MobileNav({ current }: { current: string }) {
  const items = [["Home","/"],["Search","/search"],["History","/history"]];
  return <div className="mobile-nav">{items.map(([label,path]) =>
    <a key={path} href={path} className={current===label ? "active":""}><span>{label}</span></a>)}</div>;
}

export function PageShell({
  current, title, subtitle, children
}: { current: string; title?: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="app">
      <Sidebar current={current}/>
      <main className="main">
        {(title || subtitle) && <header className="page-head">
          <div><div className="eyebrow">Ingredient Lens</div>{title && <h1>{title}</h1>}{subtitle && <p>{subtitle}</p>}</div>
        </header>}
        {children}
      </main>
      <MobileNav current={current}/>
    </div>
  );
}

export function CategoryCard({ category }: { category: Category }) {
  const c = categoryMeta[category];
  return <a className={`category-card ${c.tone}`} href={`/search/${category}`}>
    <div className="cat-icon">{c.icon}</div>
    <div><h3>{c.label}</h3><p>{c.subtitle}</p></div>
    <ChevronRight size={18} className="arrow"/>
  </a>;
}

export function ProductCard({ product, onAnalyze }: { product: Product; onAnalyze: (p: Product)=>void }) {
  const c = categoryMeta[product.category];
  const hasIngredients = Boolean(product.ingredients && product.ingredients.length > 0);
  return <div className="product-card">
    <div className="product-thumb">
      {product.image_url ? <img src={product.image_url} alt="" /> : (c ? c.icon : null)}
    </div>
    <div className="product-copy">
      <h3>{product.name || "Unnamed product"}</h3>
      <p>{product.brand || "Brand unavailable"}</p>
      <div className="meta-row">
        {c && <span className="category-tag">{c.label}</span>}
        <span className="source-chip">{product.source.name}</span>
        <span className={`data-chip ${product.data_completeness}`}>{hasIngredients ? "Ingredient list available" : "Ingredients unavailable"}</span>
      </div>
    </div>
    <button className="mini-primary" onClick={() => onAnalyze(product)}>Analyze <ArrowRight size={15}/></button>
  </div>;
}

export function RiskBadge({ risk }: { risk: Risk }) {
  const label = risk === "none" ? "Low concern" : risk === "unknown" ? "Unknown" : `${risk[0].toUpperCase()}${risk.slice(1)} risk`;
  return <span className={`risk-badge ${risk}`}><span className="dot"/> {label}</span>;
}

export function IngredientRow({ finding }: { finding: IngredientFinding }) {
  const isLowConfidence = Boolean(
    finding.ml_warning ||
      (finding.ml_confidence !== undefined && finding.ml_confidence !== null && finding.ml_confidence < 0.35)
  );
  const confPercent =
    finding.ml_confidence !== undefined && finding.ml_confidence !== null
      ? Math.round(finding.ml_confidence * 100)
      : null;

  const displayExplanation =
    finding.risk === "unknown"
      ? "Unknown means no matching documented rule was found in the current reference set. It does not mean the ingredient is unsafe."
      : finding.explanation;

  return (
    <div className="ingredient-row">
      <div className={`risk-dot ${finding.risk}`} />
      <div className="ingredient-main">
        <strong>{finding.normalized_name || finding.original_name}</strong>
        <p>{displayExplanation}</p>
        <div className="ingredient-tags">
          {finding.matched ? (
            <span className="ref-tag">Matched Reference Rule</span>
          ) : (
            <span className="ref-tag warn" style={{ background: "#f1f3f2", color: "#66716c" }}>
              No Documented Rule Found
            </span>
          )}

          {finding.function && (
            <span className="ref-tag">
              Reference Function: {finding.function}
            </span>
          )}

          {finding.ml_function ? (
            <span
              className={`ml-tag ${isLowConfidence ? "warn" : ""}`}
              title={
                isLowConfidence
                  ? "This is an ML-assisted functional classification with limited confidence. It should not be interpreted as a safety or medical assessment."
                  : undefined
              }
            >
              ML Function: {finding.ml_function}
              {confPercent !== null ? ` (confidence: ${confPercent}%)` : ""}
              {isLowConfidence ? " ⚠️ Low confidence" : ""}
            </span>
          ) : (
            <span className="ml-unavailable-tag">
              ML function prediction unavailable
            </span>
          )}
        </div>

        {isLowConfidence && finding.ml_function && (
          <div
            className="ml-warning-callout"
            title="This is an ML-assisted functional classification with limited confidence. It should not be interpreted as a safety or medical assessment."
          >
            ⚠️ <strong>Low-confidence ML prediction ({confPercent !== null ? `${confPercent}%` : ""}):</strong> This is an ML-assisted functional classification. ML assists with ingredient category estimation only, not safety or risk assessment.
          </div>
        )}
      </div>
      <RiskBadge risk={finding.risk} />
    </div>
  );
}

export function AnalysisPanel({ result }: { result: AnalysisResult }) {
  const totalCount = result.findings.length;
  const matchedCount = result.findings.filter((f) => f.matched).length;
  const lowConcernCount = result.counts.none + result.counts.low;

  return <div className="analysis-stack">
    <div className="summary-grid">
      <div className="summary-card">
        <span>Ingredient List</span>
        <strong>{totalCount} ingredients retrieved</strong>
      </div>
      <div className="summary-card">
        <span>Reference Coverage</span>
        <strong>{matchedCount} of {totalCount} matched ({Math.round((matchedCount / (totalCount || 1)) * 100)}%)</strong>
      </div>
      <div className="summary-card">
        <span>Low Concern</span>
        <strong>{lowConcernCount}</strong>
      </div>
      <div className="summary-card">
        <span>Unknown (No Rule)</span>
        <strong>{result.counts.unknown}</strong>
      </div>
    </div>

    {result.counts.unknown > 0 && (
      <div className="notice" style={{ background: "#f4f8f6", borderColor: "#cce5d8", color: "#1b4d3e" }}>
        <ShieldAlert size={18} />
        <div>
          <strong>Reference Coverage Notice ({matchedCount} of {totalCount} matched):</strong>
          <p>The ingredient list was successfully retrieved ({totalCount} ingredients). {result.counts.unknown} ingredient(s) do not currently match a documented rule in the reference set. An 'Unknown' status means no documented rule exists; it does not mean the ingredient is unsafe.</p>
        </div>
      </div>
    )}

    <div className="card ai-card">
      <div className="section-title"><div className="icon-bubble mint"><Sparkles size={17}/></div><div><h2>Evidence-grounded explanation</h2><p>Generated from the findings already returned by Ingredient Lens.</p></div></div>
      <p className="big-copy">{result.explanation}</p>
      <div className="generated-by">Source: {result.generated_by}</div>
    </div>
    <div className="card">
      <div className="section-head"><h2>Ingredient List <span>({result.findings.length})</span></h2><span className="legend">red / orange / yellow / green / grey</span></div>
      <div className="ingredient-list">{result.findings.map((f, i)=><IngredientRow key={`${f.normalized_name}-${i}`} finding={f}/>)}</div>
    </div>
    <div className="card">
      <div className="section-title"><div className="icon-bubble sky"><CircleHelp size={17}/></div><div><h2>Sources & limitations</h2></div></div>
      <ul className="simple-list">{result.limitations.map((x,i)=><li key={i}>{x}</li>)}</ul>
    </div>
  </div>;
}
