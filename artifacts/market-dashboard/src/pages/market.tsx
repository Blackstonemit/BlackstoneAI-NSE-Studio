import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetMarketMovers, 
  getGetMarketMoversQueryKey,
  useGetWatchlist,
  useGetMarketQuotes,
  getGetMarketQuotesQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";

export default function MarketFeed() {
  const queryClient = useQueryClient();

  const { data: movers, isLoading: loadingMovers } = useGetMarketMovers();
  const { data: watchlist } = useGetWatchlist();
  
  const watchlistSymbols = watchlist?.map(w => w.symbol).join(",") || "";
  
  const { data: quotes, isLoading: loadingQuotes } = useGetMarketQuotes(
    { symbols: watchlistSymbols },
    { query: { enabled: !!watchlistSymbols, queryKey: getGetMarketQuotesQueryKey({ symbols: watchlistSymbols }) } }
  );

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetMarketMoversQueryKey() });
      if (watchlistSymbols) {
        queryClient.invalidateQueries({ queryKey: getGetMarketQuotesQueryKey({ symbols: watchlistSymbols }) });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [queryClient, watchlistSymbols]);

  const QuoteTable = ({ data, isLoading }: { data: any[], isLoading: boolean }) => {
    if (isLoading) {
      return (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      );
    }
    
    if (!data || data.length === 0) {
      return <div className="p-8 text-center text-muted-foreground font-mono text-sm">NO DATA</div>;
    }

    return (
      <Table>
        <TableHeader>
          <TableRow className="border-muted hover:bg-transparent">
            <TableHead className="font-mono text-xs text-muted-foreground">SYMBOL</TableHead>
            <TableHead className="font-mono text-xs text-muted-foreground text-right">LTP</TableHead>
            <TableHead className="font-mono text-xs text-muted-foreground text-right">CHG %</TableHead>
            <TableHead className="font-mono text-xs text-muted-foreground text-right">VOL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((q) => (
            <TableRow key={q.symbol} className="border-muted hover:bg-muted/10">
              <TableCell className="font-bold">{q.symbol}</TableCell>
              <TableCell className="text-right font-mono">{q.price.toFixed(2)}</TableCell>
              <TableCell className={cn(
                "text-right font-mono",
                q.change >= 0 ? "text-success" : "text-destructive"
              )}>
                <div className="flex items-center justify-end">
                  {q.change >= 0 ? <ArrowUpIcon className="h-3 w-3 mr-1" /> : <ArrowDownIcon className="h-3 w-3 mr-1" />}
                  {Math.abs(q.changePercent).toFixed(2)}%
                </div>
              </TableCell>
              <TableCell className="text-right font-mono text-muted-foreground">
                {(q.volume / 100000).toFixed(1)}M
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight font-mono">MARKET FEED</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="p-4 border-b border-muted">
              <CardTitle className="text-sm font-mono text-success">TOP GAINERS</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <QuoteTable data={movers?.gainers || []} isLoading={loadingMovers} />
            </CardContent>
          </Card>

          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="p-4 border-b border-muted">
              <CardTitle className="text-sm font-mono text-destructive">TOP LOSERS</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <QuoteTable data={movers?.losers || []} isLoading={loadingMovers} />
            </CardContent>
          </Card>
          
          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="p-4 border-b border-muted">
              <CardTitle className="text-sm font-mono text-primary">MOST ACTIVE</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <QuoteTable data={movers?.mostActive || []} isLoading={loadingMovers} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-sm border-muted bg-card sticky top-6">
            <CardHeader className="p-4 border-b border-muted">
              <CardTitle className="text-sm font-mono">WATCHLIST FEED</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!watchlistSymbols ? (
                <div className="p-8 text-center text-muted-foreground font-mono text-sm">WATCHLIST IS EMPTY</div>
              ) : (
                <QuoteTable data={quotes || []} isLoading={loadingQuotes} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
