import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetWatchlist, 
  getGetWatchlistQueryKey,
  useAddToWatchlist,
  useRemoveFromWatchlist,
  AddWatchlistBodyExchange,
  AddWatchlistBodyInstrumentType
} from "@workspace/api-client-react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { LiveRefreshBar } from "@/components/live-refresh-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

type LiveQuote = { symbol: string; name: string; price: number; change: number; changePercent: number };

export default function WatchlistBoard() {
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [exchange, setExchange] = useState<AddWatchlistBodyExchange>("NSE");
  const [type, setType] = useState<AddWatchlistBodyInstrumentType>("STOCK");
  const [liveQuotes, setLiveQuotes] = useState<Record<string, LiveQuote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: watchlist, isLoading } = useGetWatchlist();

  const fetchQuotes = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) { setLiveQuotes({}); return; }
    setQuotesLoading(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/market/quotes?symbols=${symbols.join(",")}`);
      const data: LiveQuote[] = await res.json();
      const map: Record<string, LiveQuote> = {};
      for (const q of data) map[q.symbol] = q;
      setLiveQuotes(map);
    } catch { /* silent */ }
    finally { setQuotesLoading(false); }
  }, []);

  const watchlistSymbols = useRef<string[]>([]);
  useEffect(() => {
    const syms = watchlist?.map((w) => w.symbol) ?? [];
    watchlistSymbols.current = syms;
    fetchQuotes(syms);
  }, [watchlist, fetchQuotes]);

  const { isMarketOpen, isPreOpen, lastUpdatedIST, countdown, refresh } = useLiveRefresh({
    onRefresh: () => {
      queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() });
      fetchQuotes(watchlistSymbols.current);
    },
  });
  
  const addMutation = useAddToWatchlist();
  const removeMutation = useRemoveFromWatchlist();

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim() || !name.trim()) return;

    addMutation.mutate({
      data: {
        symbol: symbol.trim().toUpperCase(),
        name: name.trim(),
        exchange,
        instrumentType: type
      }
    }, {
      onSuccess: () => {
        toast({ title: "Added to Watchlist", description: `${symbol.toUpperCase()} has been added.` });
        setSymbol("");
        setName("");
        queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to add symbol.", variant: "destructive" });
      }
    });
  };

  const handleRemove = (id: number, sym: string) => {
    removeMutation.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Removed", description: `${sym} has been removed from watchlist.` });
        queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to remove symbol.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight font-mono">WATCHLIST</h1>
        <LiveRefreshBar
          isMarketOpen={isMarketOpen}
          isPreOpen={isPreOpen}
          lastUpdatedIST={lastUpdatedIST}
          countdown={countdown}
          onRefresh={refresh}
          isRefreshing={quotesLoading}
        />
      </div>

      <Card className="rounded-sm border-muted bg-card">
        <CardHeader className="p-4 border-b border-muted bg-muted/10">
          <CardTitle className="text-sm font-mono">ADD SYMBOL</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2 flex-1 w-full">
              <label className="text-xs font-mono text-muted-foreground">SYMBOL</label>
              <Input 
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                placeholder="e.g. RELIANCE"
                className="font-mono uppercase bg-background"
                required
              />
            </div>
            <div className="space-y-2 flex-1 w-full">
              <label className="text-xs font-mono text-muted-foreground">COMPANY NAME</label>
              <Input 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Reliance Industries"
                className="font-mono bg-background"
                required
              />
            </div>
            <div className="space-y-2 w-full md:w-[150px]">
              <label className="text-xs font-mono text-muted-foreground">EXCHANGE</label>
              <Select value={exchange} onValueChange={(v: AddWatchlistBodyExchange) => setExchange(v)}>
                <SelectTrigger className="font-mono bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NSE">NSE</SelectItem>
                  <SelectItem value="BSE">BSE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 w-full md:w-[150px]">
              <label className="text-xs font-mono text-muted-foreground">TYPE</label>
              <Select value={type} onValueChange={(v: AddWatchlistBodyInstrumentType) => setType(v)}>
                <SelectTrigger className="font-mono bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STOCK">STOCK</SelectItem>
                  <SelectItem value="INDEX">INDEX</SelectItem>
                  <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                  <SelectItem value="FUTURES">FUTURES</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              type="submit" 
              disabled={addMutation.isPending || !symbol || !name}
              className="w-full md:w-auto font-mono bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              ADD
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-sm border-muted bg-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : watchlist && watchlist.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-muted hover:bg-transparent bg-muted/5">
                  <TableHead className="font-mono text-xs text-muted-foreground">SYMBOL</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground">NAME</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground text-right">LTP</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground text-right">CHG %</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground">EXCHANGE</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground">TYPE</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground text-right">ACTION</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {watchlist.map((item) => {
                  const q = liveQuotes[item.symbol];
                  const up = (q?.changePercent ?? 0) >= 0;
                  return (
                  <TableRow key={item.id} className="border-muted hover:bg-muted/10">
                    <TableCell className="font-bold">{item.symbol}</TableCell>
                    <TableCell className="text-muted-foreground">{item.name}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {q ? q.price.toFixed(2) : <span className="text-muted-foreground/40">—</span>}
                    </TableCell>
                    <TableCell className={`text-right font-mono tabular-nums text-xs ${q ? (up ? "text-green-400" : "text-red-400") : "text-muted-foreground/40"}`}>
                      {q ? `${up ? "+" : ""}${q.changePercent.toFixed(2)}%` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs border-muted">{item.exchange}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs bg-muted/50">{item.instrumentType}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleRemove(item.id, item.symbol)}
                        disabled={removeMutation.isPending}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="py-20 text-center text-muted-foreground font-mono text-sm border-dashed">
              WATCHLIST IS EMPTY
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
