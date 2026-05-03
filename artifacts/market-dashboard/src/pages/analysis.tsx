import { useState, useEffect } from "react";
import { 
  useGetTechnicalAnalysis, 
  getGetTechnicalAnalysisQueryKey,
  useRunAgentAnalysis,
  GetTechnicalAnalysisInterval
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Loader2, BrainCircuit, Cpu, TrendingUp, TrendingDown, ShieldAlert, X, Sliders } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { loadSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

type AgentResult = {
  symbol: string;
  summary: string;
  keyLevels: { support: number[]; resistance: number[] };
  signals: Array<{
    action: string;
    displayText: string;
    entryPrice: number | null;
    targetPrice: number | null;
    stopLoss: number | null;
    confidence: number;
    rationale: string;
    instrumentType: string;
  }>;
  riskAssessment: string;
  generatedAt: string;
};

export default function AnalysisBoard() {
  const agentSettings = loadSettings();

  const [symbol, setSymbol] = useState(agentSettings.defaultSymbol);
  const [searchInput, setSearchInput] = useState(agentSettings.defaultSymbol);
  const [interval, setAnalysisInterval] = useState<GetTechnicalAnalysisInterval>("1d");
  const [instrumentType, setInstrumentType] = useState<string>(agentSettings.agentInstrumentType);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [autoRanOnce, setAutoRanOnce] = useState(false);

  const { toast } = useToast();

  const { data: analysis, isLoading: loadingAnalysis, isError: analysisError } = useGetTechnicalAnalysis(
    { symbol, interval },
    { query: { queryKey: getGetTechnicalAnalysisQueryKey({ symbol, interval }), retry: 1 } }
  );

  const runAgent = useRunAgentAnalysis();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const s = searchInput.trim().toUpperCase();
      setSymbol(s);
      setAgentResult(null);
    }
  };

  const handleAnalyze = (overrideSymbol?: string) => {
    const targetSymbol = overrideSymbol ?? (searchInput.trim().toUpperCase() || symbol);
    if (targetSymbol !== symbol && !overrideSymbol) {
      setSymbol(targetSymbol);
      setAgentResult(null);
    }

    const settings = loadSettings();

    runAgent.mutate({
      data: {
        symbol: targetSymbol,
        timeframe: settings.agentTimeframe,
        instrumentType,
        numSignals: settings.agentNumSignals,
        maxTokens: settings.agentMaxTokens,
        style: settings.agentStyle,
        customContext: settings.agentCustomContext,
        confidenceThreshold: settings.agentConfidenceThreshold,
        saveSignals: settings.agentSaveSignals,
      } as Parameters<typeof runAgent.mutate>[0]["data"]
    }, {
      onSuccess: (result) => {
        setAgentResult(result as unknown as AgentResult);
        toast({ title: "AI Analysis Complete", description: `Analysis ready for ${targetSymbol}` });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to run agent analysis.", variant: "destructive" });
      },
    });
  };

  // Auto-run on mount if enabled in settings
  useEffect(() => {
    if (agentSettings.agentAutoRun && !autoRanOnce) {
      setAutoRanOnce(true);
      handleAnalyze(symbol);
    }
  }, []);

  const confidenceThreshold = agentSettings.agentConfidenceThreshold;
  const filteredSignals = agentResult?.signals.filter((s) => s.confidence >= confidenceThreshold) ?? [];

  const styleColors: Record<string, string> = {
    conservative: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    moderate: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
    aggressive: "text-red-400 border-red-500/30 bg-red-500/10",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight font-mono">TECHNICAL ANALYSIS</h1>

        <div className="flex gap-2 items-center flex-wrap">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 w-[180px] font-mono border-muted bg-card uppercase"
              placeholder="SYMBOL..."
            />
          </form>

          <Select value={interval} onValueChange={(v: GetTechnicalAnalysisInterval) => setAnalysisInterval(v)}>
            <SelectTrigger className="w-[110px] font-mono border-muted bg-card">
              <SelectValue placeholder="INTERVAL" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5m">5 MIN</SelectItem>
              <SelectItem value="15m">15 MIN</SelectItem>
              <SelectItem value="1h">1 HOUR</SelectItem>
              <SelectItem value="1d">1 DAY</SelectItem>
            </SelectContent>
          </Select>

          <Select value={instrumentType} onValueChange={setInstrumentType}>
            <SelectTrigger className="w-[110px] font-mono border-muted bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STOCK">STOCK</SelectItem>
              <SelectItem value="INDEX">INDEX</SelectItem>
              <SelectItem value="OPTIONS">OPTIONS</SelectItem>
              <SelectItem value="FUTURES">FUTURES</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 text-xs font-mono border border-muted rounded-sm px-2 py-1">
            <Cpu className="h-3 w-3 text-success" />
            <span className="text-muted-foreground">NVIDIA</span>
          </div>

          {/* Agent config summary badge */}
          <div className={cn(
            "hidden sm:flex items-center gap-1 text-[10px] font-mono border rounded-sm px-2 py-1",
            styleColors[agentSettings.agentStyle] ?? "border-muted text-muted-foreground"
          )}>
            <Sliders className="h-3 w-3" />
            {agentSettings.agentStyle.toUpperCase()} · {agentSettings.agentTimeframe} · ≥{confidenceThreshold}%
          </div>

          <Button
            onClick={() => handleAnalyze()}
            disabled={runAgent.isPending}
            className="font-mono bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {runAgent.isPending
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <BrainCircuit className="mr-2 h-4 w-4" />}
            AI AGENT
          </Button>
        </div>
      </div>

      {/* Auto-run indicator */}
      {agentSettings.agentAutoRun && !autoRanOnce && (
        <div className="flex items-center gap-2 text-xs font-mono text-primary/80 border border-primary/20 bg-primary/5 rounded-sm px-3 py-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Auto-Run enabled — launching agent analysis…
        </div>
      )}

      {/* Agent running */}
      {runAgent.isPending && (
        <Card className="rounded-sm border-primary/40 bg-primary/5">
          <CardContent className="p-6 flex items-center gap-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <div className="font-mono font-bold text-sm">RUNNING AI ANALYSIS…</div>
              <div className="text-xs text-muted-foreground mt-1">
                Style: <span className="capitalize">{agentSettings.agentStyle}</span> ·
                Timeframe: {agentSettings.agentTimeframe} ·
                Instrument: {instrumentType} ·
                Tokens: {agentSettings.agentMaxTokens}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent result */}
      {agentResult && !runAgent.isPending && (
        <Card className="rounded-sm border-primary/40 bg-card">
          <CardHeader className="p-4 border-b border-muted flex flex-row items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <BrainCircuit className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-mono">AI AGENT ANALYSIS — {agentResult.symbol}</CardTitle>
              <Badge variant="outline" className={cn("text-[10px] font-mono border", styleColors[agentSettings.agentStyle])}>
                {agentSettings.agentStyle.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono border-muted text-muted-foreground">
                {agentSettings.agentTimeframe}
              </Badge>
              {agentSettings.agentConfidenceThreshold > 0 && (
                <Badge variant="outline" className="text-[10px] font-mono border-muted text-muted-foreground">
                  ≥{agentSettings.agentConfidenceThreshold}% CONF
                </Badge>
              )}
            </div>
            <button onClick={() => setAgentResult(null)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{agentResult.summary}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-success/5 border border-success/20 rounded-sm p-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                  <span className="text-xs font-mono font-bold text-success">SUPPORT LEVELS</span>
                </div>
                <div className="space-y-1">
                  {agentResult.keyLevels.support.length > 0
                    ? agentResult.keyLevels.support.map((lvl, i) => (
                        <div key={i} className="font-mono text-sm font-bold">{typeof lvl === "number" ? lvl.toFixed(2) : lvl}</div>
                      ))
                    : <div className="text-xs text-muted-foreground">—</div>}
                </div>
              </div>

              <div className="bg-destructive/5 border border-destructive/20 rounded-sm p-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs font-mono font-bold text-destructive">RESISTANCE LEVELS</span>
                </div>
                <div className="space-y-1">
                  {agentResult.keyLevels.resistance.length > 0
                    ? agentResult.keyLevels.resistance.map((lvl, i) => (
                        <div key={i} className="font-mono text-sm font-bold">{typeof lvl === "number" ? lvl.toFixed(2) : lvl}</div>
                      ))
                    : <div className="text-xs text-muted-foreground">—</div>}
                </div>
              </div>

              <div className="bg-muted/20 border border-muted rounded-sm p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                  <span className="text-xs font-mono font-bold text-warning">RISK ASSESSMENT</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{agentResult.riskAssessment}</p>
              </div>
            </div>

            {/* Signals */}
            {filteredSignals.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono text-muted-foreground font-bold tracking-wider">AI SIGNALS</div>
                  {agentResult.signals.length !== filteredSignals.length && (
                    <div className="text-xs font-mono text-muted-foreground">
                      {agentResult.signals.length - filteredSignals.length} signal(s) filtered (below {confidenceThreshold}% confidence)
                    </div>
                  )}
                </div>
                {filteredSignals.map((sig, i) => (
                  <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 border border-muted rounded-sm bg-muted/10 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className={cn(
                        "font-mono text-xs border-0 px-2 py-0.5 shrink-0",
                        sig.action === "BUY" ? "bg-success/20 text-success" :
                        sig.action === "SELL" ? "bg-destructive/20 text-destructive" :
                        "bg-warning/20 text-warning"
                      )}>
                        {sig.action}
                      </Badge>
                      <div>
                        <div className="font-mono font-bold text-sm">{sig.displayText}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{sig.rationale}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                      <div className="text-muted-foreground">ENTRY: <span className="text-foreground font-bold">{sig.entryPrice ?? "—"}</span></div>
                      <div className="text-muted-foreground">TARGET: <span className="text-success font-bold">{sig.targetPrice ?? "—"}</span></div>
                      <div className="text-muted-foreground">SL: <span className="text-destructive font-bold">{sig.stopLoss ?? "—"}</span></div>
                      <div className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        sig.confidence > 70 ? "text-success border-success/30 bg-success/10" :
                        sig.confidence > 40 ? "text-warning border-warning/30 bg-warning/10" :
                        "text-destructive border-destructive/30 bg-destructive/10"
                      )}>
                        {sig.confidence}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : agentResult.signals.length > 0 ? (
              <div className="text-center py-4 border border-muted border-dashed rounded-sm text-xs font-mono text-muted-foreground">
                All {agentResult.signals.length} signal(s) filtered below {confidenceThreshold}% confidence threshold.
                Lower the threshold in Settings → AI Agent.
              </div>
            ) : null}

            <div className="text-[10px] font-mono text-muted-foreground/50 text-right">
              Generated at {new Date(agentResult.generatedAt).toLocaleTimeString()} · Saved to signals: {agentSettings.agentSaveSignals ? "YES" : "NO"}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Technical indicators */}
      {loadingAnalysis ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : analysisError || !analysis ? (
        <div className="py-20 text-center border border-muted border-dashed rounded-sm bg-card">
          <h3 className="text-lg font-mono font-bold text-muted-foreground">NO DATA FOUND FOR {symbol}</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {analysisError ? "Could not fetch market data. Markets may be closed or the symbol is invalid." : "Enter a valid NSE symbol and press Enter."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="rounded-sm border-muted col-span-1 md:col-span-2 bg-card">
              <CardContent className="p-6 flex flex-col justify-center h-full">
                <div className="text-sm font-mono text-muted-foreground mb-2">OVERALL SIGNAL</div>
                <div className="flex items-center gap-4">
                  <div className={cn("text-4xl font-bold font-mono tracking-tight",
                    analysis.overallSignal === "BUY" ? "text-success" :
                    analysis.overallSignal === "SELL" ? "text-destructive" : "text-warning"
                  )}>
                    {analysis.overallSignal}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-mono text-muted-foreground mb-1">STRENGTH: {analysis.signalStrength}%</div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full",
                        analysis.overallSignal === "BUY" ? "bg-success" :
                        analysis.overallSignal === "SELL" ? "bg-destructive" : "bg-warning"
                      )} style={{ width: `${analysis.signalStrength}%` }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm border-muted bg-card">
              <CardContent className="p-6 flex flex-col justify-center h-full">
                <div className="text-sm font-mono text-muted-foreground mb-2">TREND</div>
                <Badge variant="outline" className={cn(
                  "font-mono text-lg py-1 px-3 w-fit border-0",
                  analysis.trend.includes("BULLISH") ? "bg-success/20 text-success" :
                  analysis.trend.includes("BEARISH") ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"
                )}>
                  {analysis.trend.replace("_", " ")}
                </Badge>
              </CardContent>
            </Card>

            <Card className="rounded-sm border-muted bg-card">
              <CardContent className="p-6 flex flex-col justify-center h-full">
                <div className="text-sm font-mono text-muted-foreground mb-2">RSI (14)</div>
                <div className={cn("text-3xl font-bold font-mono",
                  analysis.rsi && analysis.rsi > 70 ? "text-destructive" :
                  analysis.rsi && analysis.rsi < 30 ? "text-success" : "text-foreground"
                )}>
                  {analysis.rsi?.toFixed(2) || "N/A"}
                </div>
                <div className="text-xs font-mono text-muted-foreground mt-1">
                  {analysis.rsi && analysis.rsi > 70 ? "OVERBOUGHT" :
                   analysis.rsi && analysis.rsi < 30 ? "OVERSOLD" : "NEUTRAL"}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono">MACD (12, 26, 9)</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {[
                  { label: "MACD LINE", val: analysis.macd?.macd.toFixed(4) },
                  { label: "SIGNAL LINE", val: analysis.macd?.signal.toFixed(4) },
                  { label: "HISTOGRAM", val: analysis.macd?.histogram.toFixed(4), color: (analysis.macd?.histogram ?? 0) > 0 ? "text-success" : "text-destructive" },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between items-center border-b border-muted pb-2 last:border-0 last:pb-0">
                    <span className="font-mono text-sm text-muted-foreground">{r.label}</span>
                    <span className={cn("font-mono font-bold", r.color)}>{r.val || "N/A"}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono">MOVING AVERAGES</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {[
                  { label: "SMA 20",  val: analysis.sma20?.toFixed(2) },
                  { label: "SMA 50",  val: analysis.sma50?.toFixed(2) },
                  { label: "SMA 200", val: analysis.sma200?.toFixed(2) },
                  { label: "EMA 9",   val: analysis.ema9?.toFixed(2) },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between items-center border-b border-muted pb-2 last:border-0 last:pb-0">
                    <span className="font-mono text-sm text-muted-foreground">{r.label}</span>
                    <span className="font-mono font-bold">{r.val || "N/A"}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-sm border-muted bg-card md:col-span-2">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono">BOLLINGER BANDS (20, 2)</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-3 gap-6 text-center">
                  {[
                    { label: "UPPER BAND", val: analysis.bollingerBands?.upper.toFixed(2), border: "border-muted" },
                    { label: "MIDDLE (SMA 20)", val: analysis.bollingerBands?.middle.toFixed(2), border: "border-primary/20" },
                    { label: "LOWER BAND", val: analysis.bollingerBands?.lower.toFixed(2), border: "border-muted" },
                  ].map((b) => (
                    <div key={b.label} className={cn("bg-muted/20 p-4 rounded-sm border", b.border)}>
                      <div className="text-xs font-mono text-muted-foreground mb-2">{b.label}</div>
                      <div className="font-mono font-bold text-lg">{b.val || "N/A"}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
