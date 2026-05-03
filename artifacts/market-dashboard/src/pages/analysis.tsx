import { useState } from "react";
import { 
  useGetTechnicalAnalysis, 
  getGetTechnicalAnalysisQueryKey,
  useRunAgentAnalysis,
  useGetWatchlist,
  GetTechnicalAnalysisInterval
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Loader2, BrainCircuit, Cpu } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function AnalysisBoard() {
  const [symbol, setSymbol] = useState("RELIANCE");
  const [searchInput, setSearchInput] = useState("RELIANCE");
  const [interval, setAnalysisInterval] = useState<GetTechnicalAnalysisInterval>("1d");
  
  const { toast } = useToast();

  const { data: analysis, isLoading: loadingAnalysis, isError: analysisError } = useGetTechnicalAnalysis(
    { symbol, interval },
    { query: { queryKey: getGetTechnicalAnalysisQueryKey({ symbol, interval }), retry: 1 } }
  );

  const runAgent = useRunAgentAnalysis();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSymbol(searchInput.trim().toUpperCase());
    }
  };

  const handleAnalyze = () => {
    runAgent.mutate({ data: { symbol, timeframe: "SWING" } }, {
      onSuccess: (result) => {
        toast({
          title: "AI Analysis Complete",
          description: result.summary,
        });
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to run agent analysis.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight font-mono">TECHNICAL ANALYSIS</h1>
        
        <div className="flex gap-4 items-center">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 w-[200px] font-mono border-muted bg-card uppercase"
              placeholder="SYMBOL..."
            />
          </form>

          <Select value={interval} onValueChange={(v: GetTechnicalAnalysisInterval) => setAnalysisInterval(v)}>
            <SelectTrigger className="w-[120px] font-mono border-muted bg-card">
              <SelectValue placeholder="INTERVAL" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5m">5 MIN</SelectItem>
              <SelectItem value="15m">15 MIN</SelectItem>
              <SelectItem value="1h">1 HOUR</SelectItem>
              <SelectItem value="1d">1 DAY</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground border border-muted rounded-sm px-2 py-1">
            <Cpu className="h-3 w-3 text-success" />
            NVIDIA QWEN
          </div>
          <Button 
            onClick={handleAnalyze} 
            disabled={runAgent.isPending}
            className="font-mono bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {runAgent.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
            AI AGENT
          </Button>
        </div>
      </div>

      {loadingAnalysis ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
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
            {/* Summary Cards */}
            <Card className="rounded-sm border-muted col-span-1 md:col-span-2 bg-card">
              <CardContent className="p-6 flex flex-col justify-center h-full">
                <div className="text-sm font-mono text-muted-foreground mb-2">OVERALL SIGNAL</div>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "text-4xl font-bold font-mono tracking-tight",
                    analysis.overallSignal === "BUY" ? "text-success" :
                    analysis.overallSignal === "SELL" ? "text-destructive" : "text-warning"
                  )}>
                    {analysis.overallSignal}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-mono text-muted-foreground mb-1">STRENGTH: {analysis.signalStrength}%</div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full", 
                          analysis.overallSignal === "BUY" ? "bg-success" :
                          analysis.overallSignal === "SELL" ? "bg-destructive" : "bg-warning"
                        )}
                        style={{ width: `${analysis.signalStrength}%` }}
                      />
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
                <div className={cn(
                  "text-3xl font-bold font-mono",
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
            {/* MACD */}
            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono">MACD (12, 26, 9)</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-muted pb-2">
                    <span className="font-mono text-sm text-muted-foreground">MACD LINE</span>
                    <span className="font-mono font-bold">{analysis.macd?.macd.toFixed(4) || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-muted pb-2">
                    <span className="font-mono text-sm text-muted-foreground">SIGNAL LINE</span>
                    <span className="font-mono font-bold">{analysis.macd?.signal.toFixed(4) || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-sm text-muted-foreground">HISTOGRAM</span>
                    <span className={cn("font-mono font-bold", 
                      (analysis.macd?.histogram || 0) > 0 ? "text-success" : "text-destructive"
                    )}>
                      {analysis.macd?.histogram.toFixed(4) || "N/A"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Moving Averages */}
            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono">MOVING AVERAGES</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-muted pb-2">
                    <span className="font-mono text-sm text-muted-foreground">SMA 20</span>
                    <span className="font-mono font-bold">{analysis.sma20?.toFixed(2) || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-muted pb-2">
                    <span className="font-mono text-sm text-muted-foreground">SMA 50</span>
                    <span className="font-mono font-bold">{analysis.sma50?.toFixed(2) || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-muted pb-2">
                    <span className="font-mono text-sm text-muted-foreground">SMA 200</span>
                    <span className="font-mono font-bold">{analysis.sma200?.toFixed(2) || "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-sm text-muted-foreground">EMA 9</span>
                    <span className="font-mono font-bold">{analysis.ema9?.toFixed(2) || "N/A"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Bollinger Bands */}
            <Card className="rounded-sm border-muted bg-card md:col-span-2">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono">BOLLINGER BANDS (20, 2)</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div className="bg-muted/20 p-4 rounded-sm border border-muted">
                    <div className="text-xs font-mono text-muted-foreground mb-2">UPPER BAND</div>
                    <div className="font-mono font-bold text-lg">{analysis.bollingerBands?.upper.toFixed(2) || "N/A"}</div>
                  </div>
                  <div className="bg-muted/20 p-4 rounded-sm border border-primary/20">
                    <div className="text-xs font-mono text-muted-foreground mb-2">MIDDLE (SMA 20)</div>
                    <div className="font-mono font-bold text-lg">{analysis.bollingerBands?.middle.toFixed(2) || "N/A"}</div>
                  </div>
                  <div className="bg-muted/20 p-4 rounded-sm border border-muted">
                    <div className="text-xs font-mono text-muted-foreground mb-2">LOWER BAND</div>
                    <div className="font-mono font-bold text-lg">{analysis.bollingerBands?.lower.toFixed(2) || "N/A"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
