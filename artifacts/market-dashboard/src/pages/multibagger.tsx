import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetScreenerStocks,
  getGetScreenerStocksQueryKey,
  useAnalyzeScreenerStocks,
  GetScreenerStocksPreset,
} from "@workspace/api-client-react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Rocket, TrendingUp, TrendingDown, Loader2, BrainCircuit,
  ExternalLink, RefreshCw, Star, AlertTriangle, Zap, BarChart3,
  ChevronDown, ChevronUp, Search,
} from "lucide-react";
import { TradeButtons } from "@/components/trade-buttons";

type Preset = GetScreenerStocksPreset;

const PRESET_LABELS: Record<Preset, { label: string; desc: string; color: string }> = {
  multibagger: { label: "Multibagger", desc: "High-growth small caps with strong fundamentals", color: "text-yellow-400" },
  penny: { label: "Penny Stocks", desc: "Price < ₹20, low market cap", color: "text-orange-400" },
  turnaround: { label: "Turnaround", desc: "Recovering businesses with debt reduction", color: "text-blue-400" },
  growth: { label: "High Growth", desc: "Revenue > 25% CAGR with strong ROCE", color: "text-green-400" },
};

const VERDICT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  STRONG_BUY: { label: "STRONG BUY", color: "text-green-400", bg: "bg-green-900/30 border-green-700" },
  BUY: { label: "BUY", color: "text-emerald-400", bg: "bg-emerald-900/20 border-emerald-700" },
  HOLD: { label: "HOLD", color: "text-yellow-400", bg: "bg-yellow-900/20 border-yellow-700" },
  AVOID: { label: "AVOID", color: "text-red-400", bg: "bg-red-900/20 border-red-700" },
};

const POTENTIAL_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  HIGH: { label: "HIGH", icon: Rocket },
  MEDIUM: { label: "MEDIUM", icon: TrendingUp },
  LOW: { label: "LOW", icon: BarChart3 },
};

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 75 ? "bg-green-500" :
    score >= 55 ? "bg-yellow-500" :
    score >= 35 ? "bg-orange-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${score}%` }} />
      </div>
      <span className="font-mono text-xs font-bold w-8 text-right">{score}</span>
    </div>
  );
}

function fmt(v: number | null | undefined, prefix = "", suffix = "", dec = 2) {
  if (v == null) return "—";
  return `${prefix}${v.toFixed(dec)}${suffix}`;
}

function fmtCr(cr: number) {
  if (cr >= 10000) return `₹${(cr / 100).toFixed(1)}K Cr`;
  return `₹${cr.toFixed(0)} Cr`;
}

type AnalysisItem = {
  symbol: string;
  name: string;
  verdict: string;
  multibaggerPotential: string;
  targetPrice1yr?: number | null;
  stopLoss?: number | null;
  rationale: string;
  risks: string[];
  catalysts: string[];
  confidence: number;
};

export default function MultibaggerPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<Preset>("multibagger");
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());
  const [aiResults, setAiResults] = useState<AnalysisItem[]>([]);
  const [aiSummary, setAiSummary] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data, isLoading, isError, refetch } = useGetScreenerStocks(
    { preset },
    { query: { queryKey: getGetScreenerStocksQueryKey({ preset }) } }
  );

  const { isMarketOpen } = useLiveRefresh({
    onRefresh: () => {
      queryClient.invalidateQueries({ queryKey: getGetScreenerStocksQueryKey({ preset }) });
    },
  });

  const analyzeStocks = useAnalyzeScreenerStocks();

  function toggleSelect(sym: string) {
    setSelectedSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else if (next.size < 5) next.add(sym);
      else toast({ title: "Max 5 stocks for AI analysis", variant: "destructive" });
      return next;
    });
  }

  function toggleExpand(sym: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  }

  async function runAIAnalysis() {
    const syms = selectedSymbols.size > 0
      ? Array.from(selectedSymbols)
      : (data?.stocks.slice(0, 5).map((s) => s.symbol) ?? []);

    if (!syms.length) return;

    try {
      const result = await analyzeStocks.mutateAsync({ data: { symbols: syms, preset } });
      setAiResults(result.analyses);
      setAiSummary(result.summary);
      toast({ title: `AI analysed ${result.analyses.length} stocks` });
    } catch {
      toast({ title: "AI analysis failed", variant: "destructive" });
    }
  }

  const stocks = data?.stocks ?? [];
  const analysisMap = new Map(aiResults.map((a) => [a.symbol, a]));

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-mono text-foreground tracking-wider flex items-center gap-2">
              <Rocket className="h-6 w-6 text-yellow-400" />
              MULTIBAGGER SCREEN
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {data ? (
                <>Screener.in data — {data.totalFound} stocks found · <span className="font-mono text-xs">{data.criteria}</span></>
              ) : "Live screening from screener.in + Yahoo Finance"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={isMarketOpen ? "text-green-400 border-green-700" : "text-muted-foreground"}>
              {isMarketOpen ? "MARKET OPEN" : "MARKET CLOSED"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="font-mono text-xs gap-1">
              <RefreshCw className="h-3 w-3" /> REFRESH
            </Button>
          </div>
        </div>

        {/* Preset Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => {
            const cfg = PRESET_LABELS[p];
            return (
              <button
                key={p}
                onClick={() => { setPreset(p); setSelectedSymbols(new Set()); setAiResults([]); }}
                className={cn(
                  "px-4 py-2 rounded-sm font-mono text-xs border transition-all",
                  preset === p
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                )}
              >
                <span className={cfg.color}>{cfg.label}</span>
                <span className="hidden sm:inline text-muted-foreground ml-1">— {cfg.desc}</span>
              </button>
            );
          })}
        </div>

        {/* AI Analysis Panel */}
        <Card className="border-yellow-800/50 bg-yellow-950/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-mono text-yellow-400 flex items-center gap-2">
                <BrainCircuit className="h-4 w-4" />
                AI SUBAGENT ANALYSIS
                <Badge variant="outline" className="text-yellow-400 border-yellow-700 text-xs">
                  GPT-5.4
                </Badge>
              </CardTitle>
              <Button
                onClick={runAIAnalysis}
                disabled={analyzeStocks.isPending}
                className="bg-yellow-600 hover:bg-yellow-500 text-black font-mono text-xs h-8"
              >
                {analyzeStocks.isPending ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" /> ANALYSING...</>
                ) : (
                  <><Zap className="h-3 w-3 mr-1" /> {selectedSymbols.size > 0 ? `ANALYSE ${selectedSymbols.size} SELECTED` : "ANALYSE TOP 5"}</>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedSymbols.size > 0
                ? `${selectedSymbols.size}/5 stocks selected — AI will analyse these for multibagger potential`
                : "Select up to 5 stocks from the table below, or click Analyse to run on top 5 by score"}
            </p>
          </CardHeader>

          {aiSummary && (
            <CardContent className="pt-0 space-y-3">
              <p className="text-sm text-muted-foreground border border-yellow-800/30 bg-yellow-900/10 rounded-sm p-3">
                {aiSummary}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {aiResults.map((a) => {
                  const vc = VERDICT_CONFIG[a.verdict] ?? VERDICT_CONFIG.HOLD;
                  const pc = POTENTIAL_CONFIG[a.multibaggerPotential] ?? POTENTIAL_CONFIG.MEDIUM;
                  const PIcon = pc.icon;
                  return (
                    <div key={a.symbol} className={cn("border rounded-sm p-3 space-y-2", vc.bg)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-sm">{a.symbol}</span>
                          <span className="text-xs text-muted-foreground ml-2 truncate">{a.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={cn("text-xs font-mono border", vc.color, vc.bg)}>
                            {vc.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <PIcon className={cn("h-3 w-3", a.multibaggerPotential === "HIGH" ? "text-yellow-400" : "text-muted-foreground")} />
                        <span className="font-mono text-muted-foreground">{pc.label} POTENTIAL</span>
                        <span className="ml-auto font-mono text-xs">{a.confidence}% conf</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{a.rationale}</p>
                      {(a.targetPrice1yr || a.stopLoss) && (
                        <div className="flex gap-4 text-xs font-mono">
                          {a.targetPrice1yr && <span className="text-green-400">Target: ₹{a.targetPrice1yr}</span>}
                          {a.stopLoss && <span className="text-red-400">SL: ₹{a.stopLoss}</span>}
                        </div>
                      )}
                      {a.catalysts.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {a.catalysts.map((c) => (
                            <span key={c} className="text-xs bg-green-900/20 text-green-400 border border-green-800/30 px-1.5 py-0.5 rounded-sm">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                      {a.risks.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {a.risks.slice(0, 2).map((r) => (
                            <span key={r} className="text-xs bg-red-900/20 text-red-400 border border-red-800/30 px-1.5 py-0.5 rounded-sm">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          )}
        </Card>

        {/* Screener Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Search className="h-4 w-4" />
                SCREENER RESULTS
                {data && (
                  <Badge variant="secondary" className="text-xs">
                    {data.totalFound} found · screener.in
                  </Badge>
                )}
              </CardTitle>
              {selectedSymbols.size > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedSymbols(new Set())} className="text-xs text-muted-foreground">
                  Clear selection
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : isError ? (
              <div className="p-8 text-center text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-orange-400" />
                <p>Failed to load screener data. Check API connection.</p>
              </div>
            ) : stocks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2" />
                <p>No stocks found for this preset.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-muted-foreground">
                      <th className="text-left px-3 py-2 w-6"></th>
                      <th className="text-left px-3 py-2">SYMBOL</th>
                      <th className="text-right px-3 py-2">PRICE</th>
                      <th className="text-right px-3 py-2">CHG%</th>
                      <th className="text-right px-3 py-2">MKT CAP</th>
                      <th className="text-right px-3 py-2">P/E</th>
                      <th className="text-right px-3 py-2">52W H/L</th>
                      <th className="text-right px-3 py-2 w-32">SCORE</th>
                      <th className="text-center px-3 py-2">AI</th>
                      <th className="text-center px-3 py-2">TRADE</th>
                      <th className="text-center px-3 py-2 w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stocks.map((s) => {
                      const isSelected = selectedSymbols.has(s.symbol);
                      const isExpanded = expandedRows.has(s.symbol);
                      const aiResult = analysisMap.get(s.symbol);
                      const vc = aiResult ? (VERDICT_CONFIG[aiResult.verdict] ?? null) : null;

                      return (
                        <React.Fragment key={s.symbol}>
                          <tr
                            className={cn(
                              "border-b border-border/50 transition-colors cursor-pointer",
                              isSelected ? "bg-primary/10" : "hover:bg-muted/20"
                            )}
                          >
                            <td className="px-3 py-2.5">
                              <button
                                onClick={() => toggleSelect(s.symbol)}
                                className={cn(
                                  "w-4 h-4 rounded-sm border flex items-center justify-center transition-colors",
                                  isSelected ? "bg-primary border-primary" : "border-border hover:border-primary"
                                )}
                              >
                                {isSelected && <Star className="h-2.5 w-2.5 text-primary-foreground fill-current" />}
                              </button>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-col">
                                <span className="font-bold text-foreground">{s.symbol}</span>
                                <span className="text-muted-foreground text-xs truncate max-w-[140px]">{s.name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className="font-bold">₹{s.currentPrice.toFixed(2)}</span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <span className={cn("font-bold", s.changePercent >= 0 ? "text-green-400" : "text-red-400")}>
                                {s.changePercent >= 0 ? "+" : ""}{s.changePercent.toFixed(2)}%
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground">
                              {fmtCr(s.marketCap)}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              {s.pe != null ? (
                                <span className={cn(s.pe < 20 ? "text-green-400" : s.pe < 40 ? "text-yellow-400" : "text-orange-400")}>
                                  {s.pe.toFixed(1)}x
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground">
                              {s.weekHigh52 && s.weekLow52
                                ? <span>{fmt(s.weekLow52, "₹", "", 0)}<span className="text-muted-foreground/40 mx-0.5">/</span>{fmt(s.weekHigh52, "₹", "", 0)}</span>
                                : "—"}
                            </td>
                            <td className="px-3 py-2.5 w-32">
                              <ScoreBar score={s.multibaggerScore} />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {vc ? (
                                <Badge variant="outline" className={cn("text-xs border font-mono", vc.color, vc.bg)}>
                                  {vc.label}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <TradeButtons
                                symbol={s.symbol}
                                price={s.currentPrice}
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1">
                                <a
                                  href={s.screenerUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                                <button
                                  onClick={() => toggleExpand(s.symbol)}
                                  className="text-muted-foreground hover:text-primary transition-colors"
                                >
                                  {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${s.symbol}-expanded`} className="bg-muted/10 border-b border-border/30">
                              <td colSpan={11} className="px-4 py-3">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                  <div>
                                    <p className="text-muted-foreground mb-1">EPS (TTM)</p>
                                    <p className="font-bold">{fmt(s.eps, "₹")}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground mb-1">ROE</p>
                                    <p className={cn("font-bold", (s.roe ?? 0) > 15 ? "text-green-400" : "")}>
                                      {fmt(s.roe, "", "%")}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground mb-1">5yr Sales Growth</p>
                                    <p className={cn("font-bold", (s.salesGrowth5yr ?? 0) > 15 ? "text-green-400" : "text-yellow-400")}>
                                      {fmt(s.salesGrowth5yr, "", "% CAGR")}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground mb-1">5yr Profit Growth</p>
                                    <p className={cn("font-bold", (s.profitGrowth5yr ?? 0) > 15 ? "text-green-400" : "text-yellow-400")}>
                                      {fmt(s.profitGrowth5yr, "", "% CAGR")}
                                    </p>
                                  </div>
                                </div>
                                {aiResult && (
                                  <div className="mt-3 space-y-1">
                                    <p className="text-muted-foreground">{aiResult.rationale}</p>
                                    <div className="flex flex-wrap gap-3 mt-2">
                                      {aiResult.catalysts.map((c) => (
                                        <span key={c} className="text-xs text-green-400">✓ {c}</span>
                                      ))}
                                      {aiResult.risks.map((r) => (
                                        <span key={r} className="text-xs text-red-400">⚠ {r}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground/60 border-t border-border pt-3">
          ⚠ Data sourced from screener.in and Yahoo Finance. Multibagger Score is algorithmic — not financial advice. Always do your own research before investing. Past performance is not indicative of future results.
        </p>
      </div>
    </div>
  );
}
