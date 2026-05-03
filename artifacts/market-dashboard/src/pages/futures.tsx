import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetFutures, 
  getGetFuturesQueryKey
} from "@workspace/api-client-react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { LiveRefreshBar } from "@/components/live-refresh-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ArrowUpIcon, ArrowDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FuturesFeed() {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  const queryClient = useQueryClient();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim().toUpperCase());
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: futures, isLoading } = useGetFutures(
    debouncedSearch ? { symbol: debouncedSearch } : undefined,
    { query: { queryKey: getGetFuturesQueryKey(debouncedSearch ? { symbol: debouncedSearch } : undefined) } }
  );

  const { isMarketOpen, isPreOpen, lastUpdatedIST, countdown, refresh } = useLiveRefresh({
    onRefresh: () => {
      queryClient.invalidateQueries({ queryKey: getGetFuturesQueryKey() });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight font-mono">FUTURES</h1>

        <LiveRefreshBar
          isMarketOpen={isMarketOpen}
          isPreOpen={isPreOpen}
          lastUpdatedIST={lastUpdatedIST}
          countdown={countdown}
          onRefresh={refresh}
        />
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 w-[250px] font-mono border-muted bg-card uppercase"
            placeholder="FILTER SYMBOL..."
          />
        </div>
      </div>

      <Card className="rounded-sm border-muted bg-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : futures && futures.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-muted hover:bg-transparent">
                  <TableHead className="font-mono text-xs text-muted-foreground">SYMBOL</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground">EXPIRY</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground text-right">LTP</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground text-right">CHG %</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground text-right">VOL</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground text-right">OI</TableHead>
                  <TableHead className="font-mono text-xs text-muted-foreground text-right">BASIS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {futures.map((f) => (
                  <TableRow key={`${f.symbol}-${f.expiry}`} className="border-muted hover:bg-muted/10">
                    <TableCell className="font-bold">{f.symbol}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{new Date(f.expiry).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right font-mono">{f.ltp.toFixed(2)}</TableCell>
                    <TableCell className={cn(
                      "text-right font-mono",
                      f.change >= 0 ? "text-success" : "text-destructive"
                    )}>
                      <div className="flex items-center justify-end">
                        {f.change >= 0 ? <ArrowUpIcon className="h-3 w-3 mr-1" /> : <ArrowDownIcon className="h-3 w-3 mr-1" />}
                        {Math.abs(f.changePercent).toFixed(2)}%
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {f.volume >= 1_000_000
                        ? `${(f.volume / 1_000_000).toFixed(2)}M`
                        : f.volume >= 1_000
                          ? `${(f.volume / 1_000).toFixed(1)}K`
                          : f.volume.toString()}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {f.openInterest >= 1_000_000
                        ? `${(f.openInterest / 1_000_000).toFixed(2)}M`
                        : f.openInterest >= 1_000
                          ? `${(f.openInterest / 1_000).toFixed(1)}K`
                          : f.openInterest.toString()}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-mono",
                      f.basis > 0 ? "text-success" : "text-destructive"
                    )}>
                      {f.basis > 0 ? "+" : ""}{f.basis.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-20 text-center text-muted-foreground font-mono text-sm border-dashed">
              NO FUTURES FOUND
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
