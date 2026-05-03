import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOptionsChain,
  getGetOptionsChainQueryKey
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export default function OptionsChain() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [searchInput, setSearchInput] = useState("NIFTY");
  const [expiry, setExpiry] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: chainData, isLoading } = useGetOptionsChain(
    { symbol, expiry: expiry || undefined },
    { query: { queryKey: getGetOptionsChainQueryKey({ symbol, expiry: expiry || undefined }) } }
  );

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: getGetOptionsChainQueryKey({ symbol, expiry: expiry || undefined }) });
    }, 30000);
    return () => clearInterval(interval);
  }, [queryClient, symbol, expiry]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSymbol(searchInput.trim().toUpperCase());
      setExpiry("");
    }
  };

  const stats = useMemo(() => {
    if (!chainData) return null;
    const totalCallOI = chainData.calls.reduce((s, c) => s + c.openInterest, 0);
    const totalPutOI = chainData.puts.reduce((s, p) => s + p.openInterest, 0);
    const pcr = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;
    const maxCallOI = Math.max(...chainData.calls.map(c => c.openInterest));
    const maxPutOI = Math.max(...chainData.puts.map(p => p.openInterest));
    const maxCallOIStrike = chainData.calls.find(c => c.openInterest === maxCallOI)?.strikePrice;
    const maxPutOIStrike = chainData.puts.find(p => p.openInterest === maxPutOI)?.strikePrice;
    return { totalCallOI, totalPutOI, pcr, maxCallOI, maxPutOI, maxCallOIStrike, maxPutOIStrike };
  }, [chainData]);

  // Find ATM strike index (closest to underlying)
  const atmIndex = useMemo(() => {
    if (!chainData) return -1;
    let closest = 0;
    let minDiff = Infinity;
    chainData.calls.forEach((c, i) => {
      const diff = Math.abs(c.strikePrice - chainData.underlyingPrice);
      if (diff < minDiff) { minDiff = diff; closest = i; }
    });
    return closest;
  }, [chainData]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight font-mono">OPTIONS CHAIN</h1>
        <div className="flex gap-3 items-center">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 w-[180px] font-mono border-muted bg-card uppercase"
              placeholder="SYMBOL..."
            />
          </form>
          {chainData && chainData.expiries.length > 0 && (
            <Select value={expiry || chainData.selectedExpiry} onValueChange={setExpiry}>
              <SelectTrigger className="w-[150px] font-mono border-muted bg-card">
                <SelectValue placeholder="EXPIRY" />
              </SelectTrigger>
              <SelectContent>
                {chainData.expiries.map(exp => (
                  <SelectItem key={exp} value={exp}>
                    {new Date(exp).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {isLoading ? (
        <Card className="rounded-sm border-muted p-6 space-y-3">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
        </Card>
      ) : !chainData ? (
        <div className="py-20 text-center border border-muted border-dashed rounded-sm bg-card">
          <h3 className="text-lg font-mono font-bold text-muted-foreground">NO DATA FOUND FOR {symbol}</h3>
        </div>
      ) : (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div className="bg-card border border-muted rounded-sm p-3">
              <div className="text-[10px] font-mono text-muted-foreground tracking-widest">SPOT</div>
              <div className="text-base font-bold font-mono">{chainData.underlyingPrice.toFixed(2)}</div>
            </div>
            <div className="bg-card border border-muted rounded-sm p-3">
              <div className="text-[10px] font-mono text-muted-foreground tracking-widest">PCR</div>
              <div className={cn("text-base font-bold font-mono", stats!.pcr > 1 ? "text-green-400" : stats!.pcr < 0.7 ? "text-red-400" : "text-yellow-400")}>
                {stats!.pcr.toFixed(2)}
              </div>
            </div>
            <div className="bg-card border border-muted rounded-sm p-3">
              <div className="text-[10px] font-mono text-muted-foreground tracking-widest">TOTAL CALL OI</div>
              <div className="text-base font-bold font-mono text-blue-400">{fmt(stats!.totalCallOI)}</div>
            </div>
            <div className="bg-card border border-muted rounded-sm p-3">
              <div className="text-[10px] font-mono text-muted-foreground tracking-widest">TOTAL PUT OI</div>
              <div className="text-base font-bold font-mono text-red-400">{fmt(stats!.totalPutOI)}</div>
            </div>
            <div className="bg-card border border-muted rounded-sm p-3 col-span-2 md:col-span-1">
              <div className="text-[10px] font-mono text-muted-foreground tracking-widest">MAX OI STRIKES</div>
              <div className="text-xs font-mono mt-0.5">
                <span className="text-blue-400">C: {stats!.maxCallOIStrike}</span>
                <span className="text-muted-foreground mx-1">|</span>
                <span className="text-red-400">P: {stats!.maxPutOIStrike}</span>
              </div>
            </div>
          </div>

          {/* Table */}
          <Card className="rounded-sm border-muted overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse">
                {/* Group headers */}
                <thead>
                  <tr className="border-b border-muted">
                    <th colSpan={5} className="py-2 text-center text-blue-400 bg-blue-500/5 border-r border-muted font-semibold tracking-widest">
                      CALLS
                    </th>
                    <th className="py-2 text-center bg-muted/20 font-bold text-foreground border-x border-muted w-24">
                      STRIKE
                    </th>
                    <th colSpan={5} className="py-2 text-center text-red-400 bg-red-500/5 border-l border-muted font-semibold tracking-widest">
                      PUTS
                    </th>
                  </tr>
                  <tr className="border-b border-muted text-muted-foreground">
                    <th className="py-1.5 px-2 text-right bg-blue-500/5 border-r border-muted/40">OI</th>
                    <th className="py-1.5 px-2 text-right bg-blue-500/5">VOL</th>
                    <th className="py-1.5 px-2 text-right bg-blue-500/5">IV%</th>
                    <th className="py-1.5 px-2 text-right bg-blue-500/5">CHG</th>
                    <th className="py-1.5 px-2 text-right bg-blue-500/5 border-r border-muted">LTP</th>
                    <th className="py-1.5 px-2 text-center bg-muted/20 border-x border-muted"></th>
                    <th className="py-1.5 px-2 text-left bg-red-500/5 border-l border-muted">LTP</th>
                    <th className="py-1.5 px-2 text-left bg-red-500/5">CHG</th>
                    <th className="py-1.5 px-2 text-left bg-red-500/5">IV%</th>
                    <th className="py-1.5 px-2 text-left bg-red-500/5">VOL</th>
                    <th className="py-1.5 px-2 text-left bg-red-500/5 border-l border-muted/40">OI</th>
                  </tr>
                </thead>
                {chainData.calls.map((call, i) => {
                    const put = chainData.puts[i];
                    if (!put) return null;

                    const isATM = i === atmIndex;
                    const isCallITM = call.strikePrice < chainData.underlyingPrice;
                    const isPutITM = put.strikePrice > chainData.underlyingPrice;
                    const isMaxCallOI = call.openInterest === stats!.maxCallOI;
                    const isMaxPutOI = put.openInterest === stats!.maxPutOI;

                    return (
                      <tbody key={call.strikePrice}>
                        {/* ATM divider row */}
                        {isATM && (
                          <tr className="border-y border-yellow-500/60">
                            <td colSpan={11} className="py-1 px-3 text-center bg-yellow-500/10 text-yellow-400 text-[10px] tracking-widest font-bold">
                              ▶ ATM — {symbol} SPOT {chainData.underlyingPrice.toFixed(2)}
                            </td>
                          </tr>
                        )}
                        <tr
                          className={cn(
                            "border-b border-muted/30 transition-colors",
                            isATM ? "bg-yellow-500/5" : "hover:bg-muted/10"
                          )}
                        >
                          {/* CALLS */}
                          <td className={cn("py-2 px-2 text-right tabular-nums border-r border-muted/30", isCallITM ? "bg-blue-500/10" : "")}>
                            <span className={cn(isMaxCallOI ? "text-blue-400 font-bold" : "text-muted-foreground")}>
                              {isMaxCallOI && <span className="text-blue-400 mr-0.5">★</span>}
                              {fmt(call.openInterest)}
                            </span>
                          </td>
                          <td className={cn("py-2 px-2 text-right tabular-nums", isCallITM ? "bg-blue-500/10" : "")}>
                            <span className="text-blue-300 font-semibold">{fmt(call.volume)}</span>
                          </td>
                          <td className={cn("py-2 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-blue-500/10" : "")}>
                            {call.impliedVolatility.toFixed(1)}
                          </td>
                          <td className={cn("py-2 px-2 text-right tabular-nums", isCallITM ? "bg-blue-500/10" : "")}>
                            <span className={call.change >= 0 ? "text-green-400" : "text-red-400"}>
                              {call.change >= 0 ? "+" : ""}{call.change.toFixed(2)}
                            </span>
                          </td>
                          <td className={cn("py-2 px-2 text-right tabular-nums font-bold border-r border-muted", isCallITM ? "bg-blue-500/10" : "")}>
                            {call.ltp.toFixed(2)}
                          </td>

                          {/* STRIKE */}
                          <td className={cn(
                            "py-2 px-2 text-center font-bold border-x border-muted",
                            isATM ? "text-yellow-400 bg-yellow-500/10" : "bg-muted/10 text-foreground"
                          )}>
                            {call.strikePrice}
                          </td>

                          {/* PUTS */}
                          <td className={cn("py-2 px-2 text-left tabular-nums font-bold border-l border-muted", isPutITM ? "bg-red-500/10" : "")}>
                            {put.ltp.toFixed(2)}
                          </td>
                          <td className={cn("py-2 px-2 text-left tabular-nums", isPutITM ? "bg-red-500/10" : "")}>
                            <span className={put.change >= 0 ? "text-green-400" : "text-red-400"}>
                              {put.change >= 0 ? "+" : ""}{put.change.toFixed(2)}
                            </span>
                          </td>
                          <td className={cn("py-2 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-red-500/10" : "")}>
                            {put.impliedVolatility.toFixed(1)}
                          </td>
                          <td className={cn("py-2 px-2 text-left tabular-nums", isPutITM ? "bg-red-500/10" : "")}>
                            <span className="text-red-300 font-semibold">{fmt(put.volume)}</span>
                          </td>
                          <td className={cn("py-2 px-2 text-left tabular-nums border-l border-muted/30", isPutITM ? "bg-red-500/10" : "")}>
                            <span className={cn(isMaxPutOI ? "text-red-400 font-bold" : "text-muted-foreground")}>
                              {isMaxPutOI && <span className="text-red-400 mr-0.5">★</span>}
                              {fmt(put.openInterest)}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    );
                })}
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
