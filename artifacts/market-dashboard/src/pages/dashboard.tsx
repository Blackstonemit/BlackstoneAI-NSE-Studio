import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMarketIndices, getGetMarketIndicesQueryKey,
  useGetMarketMovers,  getGetMarketMoversQueryKey,
  useGetAnalysisSummary, getGetAnalysisSummaryQueryKey,
  useGetSignals, getGetSignalsQueryKey
} from "@workspace/api-client-react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { LiveRefreshBar } from "@/components/live-refresh-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowDownIcon, ArrowUpIcon, Activity, Plus, X, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Pinned-symbol persistence ─────────────────────────────────────────────────

const LS_KEY = "nse_dashboard_pins";

function loadPins(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
}
function savePins(pins: string[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(pins));
}

// ── Quote type from /api/market/quotes ───────────────────────────────────────

type LiveQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
};

type SearchResult = { symbol: string; yahooSymbol: string; name: string; exchange: string; type: string };

// ── Symbol search popover ─────────────────────────────────────────────────────

function AddSymbolPopover({
  pinned,
  onAdd,
  onClose,
}: {
  pinned: string[];
  onAdd: (sym: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selIdx, setSelIdx] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/market/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setSelIdx(-1);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQ(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(val), 280);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { setSelIdx(i => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === "ArrowUp")   { setSelIdx(i => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter") {
      const r = selIdx >= 0 ? results[selIdx] : results[0];
      if (r) { onAdd(r.symbol); onClose(); }
      else if (q.trim()) { onAdd(q.trim().toUpperCase()); onClose(); }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60" onClick={onClose}>
      <div className="bg-card border border-border rounded-sm shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder="Search NSE/BSE symbol… (e.g. WIPRO, HDFC)"
            className="flex-1 bg-transparent text-sm font-mono focus:outline-none placeholder:text-muted-foreground/40"
          />
          {loading && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div className="max-h-72 overflow-y-auto">
            {results.map((r, i) => {
              const alreadyPinned = pinned.includes(r.symbol);
              return (
                <button
                  key={r.yahooSymbol}
                  onClick={() => { if (!alreadyPinned) { onAdd(r.symbol); onClose(); } }}
                  disabled={alreadyPinned}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors",
                    i === selIdx ? "bg-primary/15" : "hover:bg-muted/40",
                    alreadyPinned && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <div>
                    <div className="text-sm font-mono font-bold">{r.symbol}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[250px]">{r.name}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs font-mono">
                    <span className="text-muted-foreground">{r.exchange}</span>
                    <span className="border border-border rounded px-1 py-0.5 text-muted-foreground/60">{r.type}</span>
                    {alreadyPinned && <span className="text-primary">PINNED</span>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : q.length > 0 && !loading ? (
          <div className="px-4 py-3 text-sm font-mono text-muted-foreground">No NSE/BSE results for "{q}"</div>
        ) : (
          <div className="px-4 py-3 text-xs font-mono text-muted-foreground/50">
            Type a company name or ticker · Results filtered to NSE / BSE
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pinned tile ───────────────────────────────────────────────────────────────

function PinnedTile({ quote, onRemove }: { quote: LiveQuote | null; symbol: string; onRemove: () => void }) {
  const up = (quote?.changePercent ?? 0) >= 0;
  return (
    <Card className="rounded-sm border-border bg-card relative group">
      <button
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        title="Remove"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <CardContent className="p-4 flex flex-col justify-between h-full">
        {quote ? (
          <>
            <div className="text-sm font-medium text-muted-foreground truncate pr-5">{quote.name || quote.symbol}</div>
            <div className="flex items-baseline justify-between mt-2">
              <div className="text-xl font-bold font-mono">{quote.price.toFixed(2)}</div>
              <div className={cn("flex items-center text-sm font-mono", up ? "text-success" : "text-destructive")}>
                {up ? <ArrowUpIcon className="h-3 w-3 mr-1" /> : <ArrowDownIcon className="h-3 w-3 mr-1" />}
                {Math.abs(quote.changePercent).toFixed(2)}%
              </div>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground/60 mt-1">
              O:{quote.open.toFixed(0)} H:{quote.high.toFixed(0)} L:{quote.low.toFixed(0)}
            </div>
          </>
        ) : (
          <>
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-6 w-28" />
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const queryClient = useQueryClient();

  const { data: indices, isLoading: loadingIndices } = useGetMarketIndices();
  const { data: movers,  isLoading: loadingMovers  } = useGetMarketMovers();
  const { data: summary, isLoading: loadingSummary } = useGetAnalysisSummary();
  const { data: signals, isLoading: loadingSignals } = useGetSignals({ status: "ACTIVE" });

  // ── Pinned symbols state ─────────────────────────────────────────────────────
  const [pins, setPins] = useState<string[]>(loadPins);
  const [pinnedQuotes, setPinnedQuotes] = useState<Record<string, LiveQuote>>({});
  const [showSearch, setShowSearch] = useState(false);
  const [quotesLoading, setQuotesLoading] = useState(false);

  const addPin = (sym: string) => {
    const next = [...pins.filter(p => p !== sym), sym];
    setPins(next); savePins(next);
  };
  const removePin = (sym: string) => {
    const next = pins.filter(p => p !== sym);
    setPins(next); savePins(next);
    setPinnedQuotes(prev => { const n = { ...prev }; delete n[sym]; return n; });
  };

  const fetchPinnedQuotes = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) return;
    setQuotesLoading(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/market/quotes?symbols=${symbols.join(",")}`);
      const data: LiveQuote[] = await res.json();
      const map: Record<string, LiveQuote> = {};
      for (const q of data) map[q.symbol] = q;
      setPinnedQuotes(map);
    } catch {}
    finally { setQuotesLoading(false); }
  }, []);

  // Fetch on pin list change
  useEffect(() => { fetchPinnedQuotes(pins); }, [pins, fetchPinnedQuotes]);

  const { isMarketOpen, isPreOpen, lastUpdatedIST, countdown, refresh } = useLiveRefresh({
    onRefresh: () => {
      queryClient.invalidateQueries({ queryKey: getGetMarketIndicesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMarketMoversQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAnalysisSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetSignalsQueryKey({ status: "ACTIVE" }) });
      if (pins.length > 0) fetchPinnedQuotes(pins);
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight font-mono">LIVE DASHBOARD</h1>
          <LiveRefreshBar
          isMarketOpen={isMarketOpen}
          isPreOpen={isPreOpen}
          lastUpdatedIST={lastUpdatedIST}
          countdown={countdown}
          onRefresh={refresh}
        />
      </div>

      {/* Indices + Pinned row */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">INDICES</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {loadingIndices
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="rounded-sm border-muted">
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </CardContent>
                </Card>
              ))
            : indices?.map((idx) => (
                <Card key={idx.symbol} className="rounded-sm border-muted bg-card">
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div className="text-sm font-medium text-muted-foreground">{idx.name}</div>
                    <div className="flex items-baseline justify-between mt-2">
                      <div className="text-2xl font-bold font-mono">{idx.value.toFixed(2)}</div>
                      <div className={cn("flex items-center text-sm font-mono", idx.change >= 0 ? "text-success" : "text-destructive")}>
                        {idx.change >= 0 ? <ArrowUpIcon className="h-3 w-3 mr-1" /> : <ArrowDownIcon className="h-3 w-3 mr-1" />}
                        {Math.abs(idx.changePercent).toFixed(2)}%
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
          }
        </div>

        {/* Pinned custom symbols */}
        {pins.length >= 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                WATCHLIST
                {quotesLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground border border-border rounded-sm px-2 py-1 hover:text-primary hover:border-primary transition-colors"
              >
                <Plus className="h-3 w-3" /> ADD SYMBOL
              </button>
            </div>

            {pins.length === 0 ? (
              <button
                onClick={() => setShowSearch(true)}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-sm py-4 text-xs font-mono text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Plus className="h-4 w-4" />
                Search and pin any NSE / BSE symbol
              </button>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {pins.map(sym => (
                  <PinnedTile
                    key={sym}
                    symbol={sym}
                    quote={pinnedQuotes[sym] ?? null}
                    onRemove={() => removePin(sym)}
                  />
                ))}
                {/* Add more button */}
                <button
                  onClick={() => setShowSearch(true)}
                  className="flex flex-col items-center justify-center gap-1.5 border border-dashed border-border rounded-sm py-4 text-xs font-mono text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[80px]"
                >
                  <Plus className="h-5 w-5" />
                  ADD
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Market Breadth + Top Movers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-sm border-muted col-span-1">
          <CardHeader className="p-4 border-b border-muted">
            <CardTitle className="text-sm font-mono">MARKET BREADTH</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loadingSummary ? (
              <Skeleton className="h-32 w-full" />
            ) : summary ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total Analyzed</span>
                  <span className="font-mono">{summary.totalSymbols}</span>
                </div>
                <div className="flex h-2 w-full rounded-full overflow-hidden">
                  <div style={{ width: `${(summary.bullish / summary.totalSymbols) * 100}%` }} className="bg-success" />
                  <div style={{ width: `${(summary.neutral / summary.totalSymbols) * 100}%` }} className="bg-muted" />
                  <div style={{ width: `${(summary.bearish / summary.totalSymbols) * 100}%` }} className="bg-destructive" />
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-success">{summary.bullish} BULLISH</span>
                  <span className="text-muted-foreground">{summary.neutral} NEUTRAL</span>
                  <span className="text-destructive">{summary.bearish} BEARISH</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-sm border-muted col-span-1 md:col-span-2">
          <CardHeader className="p-4 border-b border-muted">
            <CardTitle className="text-sm font-mono">TOP GAINERS / LOSERS</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingMovers ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : movers ? (
              <div className="grid grid-cols-2 divide-x divide-muted">
                <div className="p-2 space-y-1">
                  {movers.gainers.slice(0, 5).map(g => (
                    <div key={g.symbol} className="flex justify-between items-center p-2 hover:bg-muted/50 rounded-sm">
                      <span className="font-bold text-sm">{g.symbol}</span>
                      <span className={cn("font-mono text-sm", g.changePercent >= 0 ? "text-success" : "text-destructive")}>
                        {g.changePercent >= 0 ? "+" : ""}{g.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="p-2 space-y-1">
                  {movers.losers.slice(0, 5).map(l => (
                    <div key={l.symbol} className="flex justify-between items-center p-2 hover:bg-muted/50 rounded-sm">
                      <span className="font-bold text-sm">{l.symbol}</span>
                      <span className="text-destructive font-mono text-sm">{l.changePercent.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Signals */}
      <Card className="rounded-sm border-muted">
        <CardHeader className="p-4 border-b border-muted">
          <CardTitle className="text-sm font-mono">ACTIVE SIGNALS</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingSignals ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : signals && signals.length > 0 ? (
            <div className="divide-y divide-muted">
              {signals.slice(0, 10).map(signal => (
                <div key={signal.id} className="p-4 flex items-center justify-between hover:bg-muted/20">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className={cn(
                      "font-mono rounded-sm border-0 px-2 py-1",
                      signal.action === "BUY"  ? "bg-success/20 text-success" :
                      signal.action === "SELL" ? "bg-destructive/20 text-destructive" :
                      "bg-warning/20 text-warning"
                    )}>
                      {signal.action}
                    </Badge>
                    <div>
                      <div className="font-bold">{signal.displayText}</div>
                      <div className="text-xs text-muted-foreground mt-1">{signal.rationale}</div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-6">
                    <div className="text-xs font-mono text-muted-foreground">ENTRY: {signal.entryPrice ?? "—"}</div>
                    <div className="text-xs font-mono text-muted-foreground">TARGET: <span className="text-success">{signal.targetPrice ?? "—"}</span></div>
                    <div className="text-xs font-mono text-muted-foreground">SL: <span className="text-destructive">{signal.stopLoss ?? "—"}</span></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground font-mono text-sm">NO ACTIVE SIGNALS</div>
          )}
        </CardContent>
      </Card>

      {/* Search modal */}
      {showSearch && (
        <AddSymbolPopover
          pinned={pins}
          onAdd={addPin}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}
