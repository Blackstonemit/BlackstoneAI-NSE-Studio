import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Search, X, TrendingUp, BarChart2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchResult {
  symbol: string;
  yahooSymbol: string;
  name: string;
  exchange: string;
  type: string;
}


function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function StockSearch() {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 280);

  const fetchResults = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    try {
      const r = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`);
      const data = await r.json();
      setResults(data.results ?? []);
      setIsOpen(true);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults(debouncedQuery);
  }, [debouncedQuery, fetchResults]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectResult(result: SearchResult) {
    navigate(`/analysis?symbol=${result.symbol}&exchange=${result.exchange.includes("BSE") ? "BSE" : "NSE"}`);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      selectResult(results[activeIdx]);
    }
  }

  const exchangeColor = (ex: string) => {
    if (ex.includes("NSE")) return "bg-blue-500/15 text-blue-400 border-blue-700/30";
    if (ex.includes("BSE")) return "bg-orange-500/15 text-orange-400 border-orange-700/30";
    return "bg-muted/30 text-muted-foreground border-border";
  };

  const typeIcon = (type: string) => {
    if (type === "Index") return <BarChart2 className="h-3 w-3" />;
    return <TrendingUp className="h-3 w-3" />;
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className={cn(
        "flex items-center gap-2 px-3 h-9 rounded-md border bg-muted/30 transition-colors",
        isOpen ? "border-primary/60 bg-muted/50" : "border-border hover:border-muted-foreground/40"
      )}>
        {isLoading
          ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />
          : <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        }
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIdx(-1); }}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder="Search NSE / BSE stocks…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 font-mono"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {query ? (
          <button
            onClick={() => { setQuery(""); setResults([]); setIsOpen(false); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-muted-foreground/50 border border-border/50 rounded px-1 py-0.5 font-mono">
            ⌘K
          </kbd>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-md shadow-xl overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            {results.map((r, i) => (
              <button
                key={r.yahooSymbol}
                onMouseDown={(e) => { e.preventDefault(); selectResult(r); }}
                onMouseEnter={() => setActiveIdx(i)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                  activeIdx === i ? "bg-primary/10 text-foreground" : "hover:bg-muted/30 text-foreground"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm text-primary">{r.symbol}</span>
                    <span className={cn(
                      "inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-sm border font-mono",
                      exchangeColor(r.exchange)
                    )}>
                      {r.exchange.includes("NSE") ? "NSE" : r.exchange.includes("BSE") ? "BSE" : r.exchange}
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      {typeIcon(r.type)} {r.type}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{r.name}</div>
                </div>
                <div className="text-[10px] text-muted-foreground/50 font-mono shrink-0">→ Analysis</div>
              </button>
            ))}
          </div>
          <div className="px-3 py-1.5 border-t border-border bg-muted/10 text-[10px] text-muted-foreground/50 font-mono flex gap-3">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>Esc close</span>
          </div>
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-md shadow-xl p-4 text-center text-sm text-muted-foreground font-mono">
          No NSE/BSE stocks found for "{query}"
        </div>
      )}
    </div>
  );
}
