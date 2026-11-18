import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Beaker, CheckCircle2, Clock, GitCompare, Leaf, Search, ShieldAlert, Sparkles, X } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { analyzeIngredients, analyzeProduct, checkCompatibility, compareProducts, getHistory, getHistoryDetail, searchProducts } from "./api";
import type { AnalysisResult, Category, CompatibilityResult, HistoryItem, Product } from "./types";
import { categoryMeta, CategoryCard, IngredientRow, PageShell, ProductCard, AnalysisPanel } from "./components";

const isCat = (x?: string): Category => (x === "food" || x === "medicine" ? x : "beauty");

function sortProductsByAvailability(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const aHas = Boolean(a.ingredients && a.ingredients.length > 0);
    const bHas = Boolean(b.ingredients && b.ingredients.length > 0);
    if (aHas === bHas) return 0;
    return aHas ? -1 : 1;
  });
}

export function HomePage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const submit = () => query.trim() && navigate(`/search?q=${encodeURIComponent(query.trim())}`);

  return (
    <PageShell current="Home">
      <section className="hero">
        <div>
          <div className="hero-pill"><Leaf size={14} /> Conscious consumption made easy</div>
          <h1>Know What's in<br />Your Product</h1>
          <p>Search or enter ingredients to check product information, analyze evidence, and make more informed choices for your skin, food, and everyday health.</p>
          <div className="hero-search">
            <Search size={19} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Search for a product or ingredient…"
            />
            <button onClick={submit}><Search size={18} /></button>
          </div>
        </div>
        <div className="hero-art"><div className="orb">🌿</div><div className="petal p1">✦</div><div className="petal p2">✿</div></div>
      </section>
      <div className="section-head"><div><h2>Explore a category</h2><p>Start with the kind of product you want to inspect.</p></div></div>
      <div className="categories"><CategoryCard category="beauty" /><CategoryCard category="food" /><CategoryCard category="medicine" /></div>
      <div className="quick-grid" style={{ gridTemplateColumns: "1fr", maxWidth: 360 }}>
        <a href="/search/beauty?manual=1" className="quick-card lavender">
          <Beaker size={21} />
          <div><strong>Manual Entry</strong><span>Paste an ingredient list</span></div>
        </a>
      </div>
    </PageShell>
  );
}

export function GlobalSearchPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const qs = new URLSearchParams(location.search);
  const initialQuery = qs.get("q") || "";
  const initialCategory = (qs.get("category") || "all") as "all" | Category;

  const [query, setQuery] = useState(initialQuery);
  const [categoryFilter, setCategoryFilter] = useState<"all" | Category>(initialCategory);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const search = async (q = query, cat = categoryFilter) => {
    if (!q.trim()) return;
    setLoading(true);
    setError("");
    try {
      if (cat === "all") {
        const settled = await Promise.allSettled([
          searchProducts(q, "beauty"),
          searchProducts(q, "food"),
          searchProducts(q, "medicine"),
        ]);
        const combined: Product[] = [];
        settled.forEach((res) => {
          if (res.status === "fulfilled" && Array.isArray(res.value)) {
            combined.push(...res.value);
          }
        });
        setResults(sortProductsByAvailability(combined));
      } else {
        const list = await searchProducts(q, cat);
        setResults(sortProductsByAvailability(list));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Global search failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = new URLSearchParams(location.search).get("q");
    const cat = (new URLSearchParams(location.search).get("category") || "all") as "all" | Category;
    if (q) {
      setQuery(q);
      setCategoryFilter(cat);
      search(q, cat);
    }
  }, [location.search]);

  const handleSearchSubmit = () => {
    if (!query.trim()) return;
    navigate(`/search?q=${encodeURIComponent(query.trim())}&category=${categoryFilter}`);
  };

  const analyze = async (p: Product) => navigate("/analysis", { state: { product: p } });

  return (
    <PageShell
      current="Search"
      title="Global Product Search"
      subtitle="Search products across beauty, food, and medicine."
    >
      <div className="search-controls" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
        <div className="search-bar large" style={{ flex: 1, minWidth: 280 }}>
          <Search size={19} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
            placeholder="Search products across beauty, food, medicine…"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as "all" | Category)}
          style={{
            border: "1px solid var(--border)",
            background: "#fff",
            borderRadius: 999,
            padding: "0 18px",
            height: 54,
            fontWeight: 600,
            fontSize: 13,
            color: "var(--deep)",
            outline: "none",
            cursor: "pointer",
          }}
        >
          <option value="all">All Categories</option>
          <option value="beauty">Beauty & Personal Care</option>
          <option value="food">Packaged Food</option>
          <option value="medicine">Medicine</option>
        </select>
        <button
          className="primary-btn"
          style={{ height: 54, padding: "0 24px", fontSize: 14 }}
          onClick={handleSearchSubmit}
        >
          Search
        </button>
      </div>

      {loading && <div className="center-state">Searching across providers…</div>}
      {error && <div className="error-box"><AlertTriangle size={17} />{error}</div>}

      {!loading && !error && query && (
        <div className="results-head">
          <span>Search results for “{query}”</span>
          <span>{results.length} products found</span>
        </div>
      )}

      <div className="results-list">
        {results.map((p) => (
          <ProductCard key={`${p.category}-${p.source.name}-${p.id}`} product={p} onAnalyze={analyze} />
        ))}
      </div>

      {!loading && !results.length && query && !error && (
        <div className="empty-state">
          <Search size={28} />
          <h3>No matching products found</h3>
          <p>Try searching another product name or select a specific category.</p>
        </div>
      )}
    </PageShell>
  );
}

export function SearchPage() {
  const { category } = useParams();
  const cat = isCat(category);
  const location = useLocation();
  const navigate = useNavigate();
  const qs = new URLSearchParams(location.search);

  const [query, setQuery] = useState(qs.get("q") || "");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState(qs.get("manual") === "1");
  const [ingredients, setIngredients] = useState("");

  const search = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true);
    setError("");
    try {
      setResults(sortProductsByAvailability(await searchProducts(q, cat)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = new URLSearchParams(location.search).get("q");
    if (q) {
      setQuery(q);
      search(q);
    }
  }, [location.search]);

  const analyze = async (p: Product) => navigate("/analysis", { state: { product: p } });

  return (
    <PageShell
      current="Search"
      title={categoryMeta[cat].label}
      subtitle="Search product records or enter ingredients manually."
    >
      <div className="mode-tabs">
        <button className={!manual ? "active" : ""} onClick={() => setManual(false)}>
          Search product
        </button>
        <button className={manual ? "active" : ""} onClick={() => setManual(true)}>
          Manual entry
        </button>
      </div>

      {!manual ? (
        <>
          <div className="search-bar large">
            <Search size={19} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder={`Search ${
                cat === "beauty"
                  ? "Cetaphil, Nivea…"
                  : cat === "food"
                  ? "Honey Nut Cheerios, Nutella…"
                  : "paracetamol, ibuprofen…"
              }`}
            />
            <button onClick={() => search()}>Search</button>
          </div>
          {loading && <div className="center-state">Searching providers…</div>}
          {error && <div className="error-box"><AlertTriangle size={17} />{error}</div>}
          {!loading && !error && query && (
            <div className="results-head">
              <span>Search results for “{query}”</span>
              <span>{results.length} products found</span>
            </div>
          )}
          <div className="results-list">
            {results.map((p) => (
              <ProductCard key={`${p.source.name}-${p.id}`} product={p} onAnalyze={analyze} />
            ))}
          </div>
          {!loading && !results.length && query && !error && (
            <div className="empty-state">
              <Search size={28} />
              <h3>No matching product record found</h3>
              <p>Try a shorter name, another spelling, or manual ingredient entry.</p>
            </div>
          )}
        </>
      ) : (
        <div className="card manual-card">
          <div className="manual-label">
            <Beaker size={17} /> Paste an ingredient list
          </div>
          <textarea
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder="Aqua, Glycerin, Niacinamide, Cetearyl Alcohol…"
          />
          <button
            className="primary-btn"
            onClick={async () => {
              if (!ingredients.trim()) return;
              try {
                const r = await analyzeIngredients(ingredients, cat, "Manual Ingredient List");
                navigate("/analysis", { state: { result: r } });
              } catch (e) {
                setError(e instanceof Error ? e.message : "Analysis failed");
              }
            }}
          >
            Analyze ingredients <ArrowRight size={16} />
          </button>
          {error && <div className="error-box">{error}</div>}
        </div>
      )}
    </PageShell>
  );
}

export function AnalysisPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [result, setResult] = useState<AnalysisResult | null>((location.state as any)?.result || null);
  const [loading, setLoading] = useState(!result);
  const [error, setError] = useState("");
  const product = (location.state as any)?.product as Product | undefined;

  useEffect(() => {
    if (result) return;
    if (!product) {
      setError("No product selected.");
      setLoading(false);
      return;
    }
    const hasIngredients = Boolean(product.ingredients && product.ingredients.length > 0);
    if (!hasIngredients) {
      setError(
        "This product record does not contain an ingredient list. You can analyze it using manual ingredient entry or upload a product label."
      );
      setLoading(false);
      return;
    }
    analyzeProduct(product)
      .then(setResult)
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Analysis failed";
        if (msg.includes("no ingredient list") || msg.includes("422")) {
          setError(
            "This product record does not contain an ingredient list. You can analyze it using manual ingredient entry or upload a product label."
          );
        } else {
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <PageShell current="Search" title="Analyzing product">
        <div className="center-state">Matching ingredients and running the ML classification…</div>
      </PageShell>
    );

  if (error || !result) {
    const isUnavailable = product && (!product.ingredients || product.ingredients.length === 0);
    return (
      <PageShell current="Search" title={product ? product.name : undefined}>
        <div className="back-row">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </button>
        </div>
        <div className="error-box"><AlertTriangle size={17} />{error || "Analysis unavailable"}</div>
        {isUnavailable && (
          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href={`/search/${product?.category || "beauty"}?manual=1`} className="primary-btn">
              Manual Ingredient Entry <ArrowRight size={16} />
            </a>
          </div>
        )}
      </PageShell>
    );
  }

  const p = result.product;
  return (
    <PageShell current="Search">
      <div className="back-row">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Back
        </button>
        <span>Product analysis</span>
      </div>
      <section className="product-header card">
        <div className="product-hero-thumb">
          {p.image_url ? <img src={p.image_url} alt="" /> : <span>{categoryMeta[p.category].icon}</span>}
        </div>
        <div className="product-hero-copy">
          <div className="tag-row">
            <span className="source-chip">{p.source.name}</span>
            <span className="category-tag">{categoryMeta[p.category].label}</span>
          </div>
          <h1>{p.name}</h1>
          <p>{p.brand || "Brand unavailable"} {p.code ? `• Barcode ${p.code}` : ""}</p>
          <div className="data-line">
            Ingredient list: <strong>{result.findings.length} ingredients retrieved</strong> · Reference coverage: <strong>{result.findings.filter(f => f.matched).length} of {result.findings.length} matched</strong>
          </div>
        </div>
      </section>
      <div className="notice">
        <ShieldAlert size={18} />
        <div>
          <strong>Use this as an information aid, not a safety guarantee.</strong>
          <p>Unknown or missing information is shown as unknown. Medicine decisions should be discussed with a doctor or pharmacist.</p>
        </div>
      </div>
      <AnalysisPanel result={result} />
      <div className="next-actions">
        <a href={`/search/${p.category}`}>Add another product</a>
        <button onClick={() => navigate("/compare", { state: { seed: p } })}>Compare products</button>
        <button onClick={() => navigate("/compatibility", { state: { seed: p } })}>Check compatibility</button>
      </div>
    </PageShell>
  );
}

export function ComparePage() {
  const location = useLocation();
  const seed = (location.state as any)?.seed as Product | undefined;
  const [a, setA] = useState<Product | null>(seed || null);
  const [b, setB] = useState<Product | null>(null);
  const [qa, setQa] = useState("");
  const [qb, setQb] = useState("");
  const [ra, setRa] = useState<Product[]>([]);
  const [rb, setRb] = useState<Product[]>([]);
  const [data, setData] = useState<any>(null);

  const search = async (q: string, setter: (x: Product[]) => void) => {
    try {
      const list = await searchProducts(q, "beauty");
      setter(sortProductsByAvailability(list));
    } catch {
      setter([]);
    }
  };

  return (
    <PageShell
      current="Compare"
      title="Product Comparison"
      subtitle="Compare shared ingredients, unique ingredients, evidence states, and data completeness side-by-side."
    >
      <div className="compare-pickers">
        {[
          ["A", a, setA, qa, setQa, ra, setRa],
          ["B", b, setB, qb, setQb, rb, setRb],
        ].map(([label, p, setP, q, setQ, r, setR]: any) => (
          <div className="card picker" key={label}>
            <span className="picker-label">Product {label}</span>
            {p ? (
              <div className="selected-product">
                <strong>{p.name}</strong>
                <button onClick={() => setP(null)}>
                  <X size={15} />
                </button>
              </div>
            ) : (
              <>
                <div className="search-bar">
                  <Search size={16} />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search product"
                  />
                </div>
                <button className="secondary-btn" onClick={() => search(q, setR)}>
                  Find
                </button>
                <div>
                  {r.slice(0, 5).map((x: Product) => (
                    <button key={x.id} className="result-choice" onClick={() => setP(x)}>
                      {x.name} ({x.brand || "Brand N/A"})
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <button
        className="primary-btn compare-run"
        disabled={!a || !b}
        onClick={async () => {
          if (a && b) setData(await compareProducts([a, b]));
        }}
      >
        Compare selected products <GitCompare size={16} />
      </button>
      {data && (
        <div className="card comparison-card">
          <div className="summary-grid">
            <div className="summary-card">
              <span>Shared ingredients</span>
              <strong>{data.shared.length}</strong>
            </div>
            <div className="summary-card">
              <span>Only in A</span>
              <strong>{data.only_a.length}</strong>
            </div>
            <div className="summary-card">
              <span>Only in B</span>
              <strong>{data.only_b.length}</strong>
            </div>
          </div>
          <div className="comparison-grid">
            <div>
              <h3>Shared</h3>
              {data.shared.map((x: string) => (
                <div className="compare-pill" key={x}>
                  <CheckCircle2 size={15} />
                  {x}
                </div>
              ))}
            </div>
            <div>
              <h3>Unique to A</h3>
              {data.only_a.map((x: string) => (
                <div className="compare-pill" key={x}>
                  {x}
                </div>
              ))}
            </div>
            <div>
              <h3>Unique to B</h3>
              {data.only_b.map((x: string) => (
                <div className="compare-pill" key={x}>
                  {x}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function ProductPickerCard({
  label,
  product,
  onSelect,
  onClear,
}: {
  label: string;
  product: Product | null;
  onSelect: (p: Product) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [catFilter, setCatFilter] = useState<"all" | Category>("all");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      if (catFilter === "all") {
        const settled = await Promise.allSettled([
          searchProducts(query, "beauty"),
          searchProducts(query, "food"),
          searchProducts(query, "medicine"),
        ]);
        const combined: Product[] = [];
        settled.forEach((res) => {
          if (res.status === "fulfilled" && Array.isArray(res.value)) {
            combined.push(...res.value);
          }
        });
        setResults(sortProductsByAvailability(combined));
      } else {
        const res = await searchProducts(query, catFilter);
        setResults(sortProductsByAvailability(res));
      }
      setSearching(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  if (product) {
    const c = categoryMeta[product.category];
    const hasIng = Boolean(product.ingredients && product.ingredients.length > 0);
    return (
      <div className="card picker">
        <span className="picker-label">{label}</span>
        <div
          className="selected-product"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "12px 14px",
            borderRadius: 14,
            background: "#eff8f3",
          }}
        >
          <div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
              {c && <span className="category-tag" style={{ fontSize: 9 }}>{c.label}</span>}
              <span className="source-chip" style={{ fontSize: 9 }}>{product.source.name}</span>
            </div>
            <strong style={{ fontSize: 15 }}>{product.name}</strong>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted)" }}>
              {product.brand || "Brand unavailable"}
            </p>
            <span
              className={`data-chip ${product.data_completeness}`}
              style={{ marginTop: 6, fontSize: 10, display: "inline-block" }}
            >
              {hasIng ? `${product.ingredients.length} ingredients` : "Ingredients unavailable"}
            </span>
          </div>
          <button
            onClick={onClear}
            title="Change product"
            style={{
              border: 0,
              background: "#fff",
              borderRadius: "50%",
              width: 28,
              height: 28,
              display: "grid",
              placeItems: "center",
              boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
              cursor: "pointer",
            }}
          >
            <X size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card picker">
      <span className="picker-label">{label}</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 160 }}>
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doSearch()}
            placeholder="Search product name…"
          />
        </div>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value as "all" | Category)}
          style={{
            border: "1px solid var(--border)",
            background: "#fff",
            borderRadius: 999,
            padding: "0 12px",
            fontSize: 11,
            outline: "none",
          }}
        >
          <option value="all">All</option>
          <option value="beauty">Beauty</option>
          <option value="food">Food</option>
          <option value="medicine">Medicine</option>
        </select>
        <button className="secondary-btn" onClick={doSearch}>
          Find
        </button>
      </div>

      {loading && <div style={{ fontSize: 12, color: "var(--muted)", padding: 8 }}>Searching providers…</div>}

      {searching && !loading && (
        <div
          style={{
            maxHeight: 240,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginTop: 8,
          }}
        >
          {results.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--muted)", padding: 8 }}>No matching products found.</div>
          ) : (
            results.map((x) => {
              const has = Boolean(x.ingredients && x.ingredients.length > 0);
              return (
                <button
                  key={`${x.category}-${x.source.name}-${x.id}`}
                  className="result-choice"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                  }}
                  onClick={() => {
                    onSelect(x);
                    setSearching(false);
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 13 }}>{x.name}</strong>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>
                      {x.brand || "Brand unavailable"} · {categoryMeta[x.category]?.label || x.category}
                    </div>
                  </div>
                  <span className={`data-chip ${x.data_completeness}`} style={{ fontSize: 9 }}>
                    {has ? "Ingredient list available" : "Ingredients unavailable"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export function CompatibilityPage() {
  const location = useLocation();
  const seed = (location.state as any)?.seed as Product | undefined;

  const [a, setA] = useState<Product | null>(seed || null);
  const [b, setB] = useState<Product | null>(null);
  const [result, setResult] = useState<CompatibilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Seed default product A if not provided
  useEffect(() => {
    if (!a) {
      searchProducts("Cetaphil Gentle Skin Cleanser", "beauty")
        .then((res) => {
          if (res && res[0]) setA(res[0]);
        })
        .catch(() => {});
    }
  }, []);

  const runCheck = async () => {
    if (!a || !b) return;
    setError("");
    setResult(null);

    const aHas = Boolean(a.ingredients && a.ingredients.length > 0);
    const bHas = Boolean(b.ingredients && b.ingredients.length > 0);

    if (!aHas || !bHas) {
      setError(
        "Compatibility cannot be fully assessed because one or both products do not have an ingredient list."
      );
      return;
    }

    setLoading(true);
    try {
      const res = await checkCompatibility(a, b);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compatibility check failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      current="Compatibility"
      title="Compatibility Check"
      subtitle="Check documented ingredient overlap and compatibility evidence; unknown stays unknown."
    >
      <div className="compare-pickers" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <ProductPickerCard
          label="Product A"
          product={a}
          onSelect={(p) => {
            setA(p);
            setResult(null);
            setError("");
          }}
          onClear={() => {
            setA(null);
            setResult(null);
            setError("");
          }}
        />
        <ProductPickerCard
          label="Product B"
          product={b}
          onSelect={(p) => {
            setB(p);
            setResult(null);
            setError("");
          }}
          onClear={() => {
            setB(null);
            setResult(null);
            setError("");
          }}
        />
      </div>

      <button
        className="primary-btn compare-run"
        disabled={!a || !b || loading}
        onClick={runCheck}
        style={{ marginTop: 16 }}
      >
        {loading ? "Checking compatibility…" : "Check compatibility"} <Leaf size={16} />
      </button>

      {error && (
        <div style={{ marginTop: 16 }}>
          <div className="error-box">
            <AlertTriangle size={17} />
            {error}
          </div>
          {(!a?.ingredients?.length || !b?.ingredients?.length) && (
            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                className="secondary-btn"
                onClick={() => {
                  if (!a?.ingredients?.length) setA(null);
                  if (!b?.ingredients?.length) setB(null);
                  setError("");
                }}
              >
                Try another product
              </button>
              <a href="/search/beauty?manual=1" className="primary-btn">
                Enter ingredients manually <ArrowRight size={16} />
              </a>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className={`card compatibility ${result.status}`} style={{ marginTop: 20 }}>
          <div className="compat-status" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <CheckCircle2
              size={24}
              style={{ color: result.status === "conflict" ? "var(--high)" : "var(--green)" }}
            />
            <div>
              <h2 style={{ font: "600 20px Quicksand", margin: 0 }}>{result.label}</h2>
              <p style={{ margin: "4px 0 0", color: "#637169", fontSize: 13, lineHeight: 1.5 }}>
                {result.summary}
              </p>
            </div>
          </div>

          <div
            className="compat-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 20 }}
          >
            {result.concerns && result.concerns.length > 0 && (
              <div>
                <h3 style={{ font: "600 15px Quicksand", color: "var(--high)" }}>Documented conflicts</h3>
                {result.concerns.map((x) => (
                  <div className="compare-pill warn" key={x}>
                    <AlertTriangle size={14} /> {x}
                  </div>
                ))}
              </div>
            )}

            {result.shared && result.shared.length > 0 && (
              <div>
                <h3 style={{ font: "600 15px Quicksand", color: "var(--deep)" }}>
                  Shared ingredients ({result.shared.length})
                </h3>
                {result.shared.map((x) => (
                  <span className="compare-pill" key={x}>
                    <CheckCircle2 size={14} style={{ color: "var(--green)" }} /> {x}
                  </span>
                ))}
              </div>
            )}

            {result.missing && result.missing.length > 0 && (
              <div>
                <h3 style={{ font: "600 15px Quicksand", color: "var(--muted)" }}>Missing / Unknown data</h3>
                {result.missing.map((x) => (
                  <span className="compare-pill" key={x}>
                    {x}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}

export function HistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getHistory(20)
      .then(setHistory)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load history."))
      .finally(() => setLoading(false));
  }, []);

  const openHistoryItem = async (item: HistoryItem) => {
    if (item.result) {
      navigate("/analysis", { state: { result: item.result } });
    } else {
      try {
        setLoading(true);
        const detail = await getHistoryDetail(item.id);
        if (detail.result) {
          navigate("/analysis", { state: { result: detail.result } });
        } else {
          setError("Analysis record is missing detailed result.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load stored analysis.");
      } finally {
        setLoading(false);
      }
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr.endsWith("Z") ? dateStr : dateStr.replace(" ", "T") + "Z");
      if (isNaN(d.getTime())) return dateStr;
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  };

  const formatSummary = (counts: Record<string, number>) => {
    const parts: string[] = [];
    if (counts.none) parts.push(`${counts.none} none`);
    if (counts.low) parts.push(`${counts.low} low`);
    if (counts.moderate) parts.push(`${counts.moderate} moderate`);
    if (counts.high) parts.push(`${counts.high} high`);
    if (counts.unknown) parts.push(`${counts.unknown} unknown`);
    return parts.length ? parts.join(" · ") : "No risk counts available";
  };

  return (
    <PageShell
      current="History"
      title="Recent Analyses"
      subtitle="View previously stored product analysis history without re-calling external APIs."
    >
      {loading && <div className="center-state">Loading analysis history…</div>}
      {error && <div className="error-box"><AlertTriangle size={17} />{error}</div>}

      {!loading && !error && history.length === 0 && (
        <div className="empty-state">
          <Clock size={36} style={{ color: "var(--muted)", marginBottom: 8 }} />
          <h3>No analyses yet.</h3>
          <p>You haven't performed any ingredient analyses yet.</p>
          <button className="primary-btn" style={{ marginTop: 14 }} onClick={() => navigate("/search/beauty")}>
            Analyze your first product <ArrowRight size={16} />
          </button>
        </div>
      )}

      {!loading && !error && history.length > 0 && (
        <div className="results-list" style={{ marginTop: 10 }}>
          {history.map((item) => {
            const catLabel = item.category ? item.category[0].toUpperCase() + item.category.slice(1) : "Beauty";
            return (
              <div
                key={item.id}
                className="product-card"
                style={{ cursor: "pointer" }}
                onClick={() => openHistoryItem(item)}
              >
                <div className="product-thumb">
                  {categoryMeta[item.category]?.icon || <Clock size={20} />}
                </div>
                <div className="product-copy">
                  <h3>{item.product_name}</h3>
                  <p>
                    {catLabel} · {formatDate(item.created_at)}
                  </p>
                  <div className="meta-row">
                    <span className="source-chip">{formatSummary(item.counts)}</span>
                    <span className="data-chip good">{item.total_ingredients} ingredients analyzed</span>
                  </div>
                </div>
                <button
                  className="mini-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    openHistoryItem(item);
                  }}
                >
                  View <ArrowRight size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

export function NotFound() {
  return (
    <PageShell current="Home" title="Page not found">
      <div className="empty-state">That page does not exist.</div>
    </PageShell>
  );
}
