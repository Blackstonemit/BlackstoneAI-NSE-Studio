import { useState, useEffect, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOptionsChain,
  getGetOptionsChainQueryKey,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Download, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

function fmt(n: number) {
  if (n >= 10_000_000) return (n / 10_000_000).toFixed(2) + "Cr";
  if (n >= 100_000) return (n / 100_000).toFixed(2) + "L";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export default function OptionsChain() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [searchInput, setSearchInput] = useState("NIFTY");
  const [expiry, setExpiry] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const queryClient = useQueryClient();

  const { data: chainData, isLoading } = useGetOptionsChain(
    { symbol, expiry: expiry || undefined },
    {
      query: {
        queryKey: getGetOptionsChainQueryKey({ symbol, expiry: expiry || undefined }),
        onSuccess: () => setLastUpdated(new Date()),
      },
    }
  );

  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: getGetOptionsChainQueryKey({ symbol, expiry: expiry || undefined }),
      });
      setLastUpdated(new Date());
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

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: getGetOptionsChainQueryKey({ symbol, expiry: expiry || undefined }),
    });
    setLastUpdated(new Date());
  };

  const stats = useMemo(() => {
    if (!chainData) return null;
    const totalCallOI = chainData.calls.reduce((s, c) => s + c.openInterest, 0);
    const totalPutOI = chainData.puts.reduce((s, p) => s + p.openInterest, 0);
    const pcr = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;
    const maxCallOI = Math.max(...chainData.calls.map((c) => c.openInterest));
    const maxPutOI = Math.max(...chainData.puts.map((p) => p.openInterest));
    const maxCallOIStrike = chainData.calls.find((c) => c.openInterest === maxCallOI)?.strikePrice;
    const maxPutOIStrike = chainData.puts.find((p) => p.openInterest === maxPutOI)?.strikePrice;
    const totalCallVol = chainData.calls.reduce((s, c) => s + c.volume, 0);
    const totalPutVol = chainData.puts.reduce((s, p) => s + p.volume, 0);
    return { totalCallOI, totalPutOI, pcr, maxCallOI, maxPutOI, maxCallOIStrike, maxPutOIStrike, totalCallVol, totalPutVol };
  }, [chainData]);

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

  const downloadCSV = useCallback(() => {
    if (!chainData) return;
    const rows = ["Call OI,Call Vol,Call IV,Call LTP,Call Chg,Strike,Put Chg,Put LTP,Put IV,Put Vol,Put OI"];
    chainData.calls.forEach((call, i) => {
      const put = chainData.puts[i];
      if (!put) return;
      rows.push([
        call.openInterest, call.volume, call.impliedVolatility.toFixed(2),
        call.ltp.toFixed(2), call.change.toFixed(2), call.strikePrice,
        put.change.toFixed(2), put.ltp.toFixed(2), put.impliedVolatility.toFixed(2),
        put.volume, put.openInterest,
      ].join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${symbol}_options_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }, [chainData, symbol]);

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight font-mono">OPTIONS CHAIN</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 w-[160px] font-mono border-muted bg-card uppercase text-sm"
              placeholder="SYMBOL..."
            />
          </form>
          {chainData && chainData.expiries.length > 0 && (
            <Select value={expiry || chainData.selectedExpiry} onValueChange={setExpiry}>
              <SelectTrigger className="w-[145px] font-mono border-muted bg-card text-sm">
                <SelectValue placeholder="EXPIRY" />
              </SelectTrigger>
              <SelectContent>
                {chainData.expiries.map((exp) => (
                  <SelectItem key={exp} value={exp}>
                    {new Date(exp).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-muted bg-card rounded-sm hover:bg-muted/30 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />REFRESH
          </button>
          {chainData && (
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-muted bg-card rounded-sm hover:bg-muted/30 transition-colors"
            >
              <Download className="h-3 w-3" />CSV
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="border border-muted rounded-sm bg-card p-6 space-y-3">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
      ) : !chainData ? (
        <div className="py-20 text-center border border-muted border-dashed rounded-sm bg-card">
          <h3 className="text-lg font-mono font-bold text-muted-foreground">NO DATA FOUND FOR {symbol}</h3>
        </div>
      ) : (
        <div className="border border-muted rounded-sm bg-card overflow-hidden">

          {/* NSE-style underlying index banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-2.5 border-b border-muted bg-muted/10">
            <div className="font-mono text-sm">
              <span className="text-muted-foreground">Underlying Index:</span>
              <span className="font-bold text-foreground ml-2">{symbol}</span>
              <span className="text-xl font-bold ml-3">{chainData.underlyingPrice.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
              <span>As on {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} IST</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 sm:grid-cols-6 border-b border-muted divide-x divide-muted text-center text-xs font-mono">
            <div className="py-2 px-3">
              <div className="text-muted-foreground text-[10px] tracking-wider">PCR</div>
              <div className={cn("font-bold text-sm", stats!.pcr > 1 ? "text-green-400" : stats!.pcr < 0.7 ? "text-red-400" : "text-yellow-400")}>
                {stats!.pcr.toFixed(2)}
              </div>
            </div>
            <div className="py-2 px-3">
              <div className="text-muted-foreground text-[10px] tracking-wider">CALL OI</div>
              <div className="font-bold text-sm text-blue-400">{fmt(stats!.totalCallOI)}</div>
            </div>
            <div className="py-2 px-3">
              <div className="text-muted-foreground text-[10px] tracking-wider">PUT OI</div>
              <div className="font-bold text-sm text-red-400">{fmt(stats!.totalPutOI)}</div>
            </div>
            <div className="py-2 px-3">
              <div className="text-muted-foreground text-[10px] tracking-wider">CALL VOL</div>
              <div className="font-bold text-sm text-blue-300">{fmt(stats!.totalCallVol)}</div>
            </div>
            <div className="py-2 px-3">
              <div className="text-muted-foreground text-[10px] tracking-wider">PUT VOL</div>
              <div className="font-bold text-sm text-red-300">{fmt(stats!.totalPutVol)}</div>
            </div>
            <div className="py-2 px-3">
              <div className="text-muted-foreground text-[10px] tracking-wider">MAX OI</div>
              <div className="text-[11px] mt-0.5">
                <span className="text-blue-400">C:{stats!.maxCallOIStrike}</span>
                <span className="text-muted-foreground mx-1">|</span>
                <span className="text-red-400">P:{stats!.maxPutOIStrike}</span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono border-collapse min-w-[700px]">
              <thead>
                {/* CALLS / PUTS group headers — NSE style */}
                <tr>
                  <th
                    colSpan={5}
                    className="py-2 text-center text-white bg-blue-700/80 border-r border-blue-600 font-semibold tracking-widest"
                  >
                    CALLS
                  </th>
                  <th className="py-2 text-center bg-muted/30 border-x border-muted font-bold text-foreground w-20">
                    STRIKE
                  </th>
                  <th
                    colSpan={5}
                    className="py-2 text-center text-white bg-red-700/80 border-l border-red-600 font-semibold tracking-widest"
                  >
                    PUTS
                  </th>
                </tr>
                {/* Column sub-headers — NSE order */}
                <tr className="border-b-2 border-muted text-muted-foreground bg-muted/20">
                  <th className="py-1.5 px-2 text-right font-normal">OI</th>
                  <th className="py-1.5 px-2 text-right font-normal">VOL</th>
                  <th className="py-1.5 px-2 text-right font-normal">IV</th>
                  <th className="py-1.5 px-2 text-right font-normal">CHNG</th>
                  <th className="py-1.5 px-2 text-right font-normal border-r border-muted bg-blue-900/30 text-blue-300">LTP</th>
                  <th className="py-1.5 px-2 text-center font-bold border-x border-muted bg-muted/30"></th>
                  <th className="py-1.5 px-2 text-left font-normal border-l border-muted bg-red-900/30 text-red-300">LTP</th>
                  <th className="py-1.5 px-2 text-left font-normal">CHNG</th>
                  <th className="py-1.5 px-2 text-left font-normal">IV</th>
                  <th className="py-1.5 px-2 text-left font-normal">VOL</th>
                  <th className="py-1.5 px-2 text-left font-normal">OI</th>
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
                    <tr
                      className={cn(
                        "border-b border-muted/30 transition-colors",
                        isATM
                          ? "bg-yellow-500/8 hover:bg-yellow-500/12"
                          : "hover:bg-muted/10"
                      )}
                    >
                      {/* === CALLS === */}
                      {/* OI */}
                      <td className={cn("py-2 px-2 text-right tabular-nums", isCallITM ? "bg-blue-500/8" : "")}>
                        <span className={cn(isMaxCallOI ? "text-blue-400 font-bold" : "text-muted-foreground")}>
                          {isMaxCallOI && "★ "}{fmt(call.openInterest)}
                        </span>
                      </td>
                      {/* VOL */}
                      <td className={cn("py-2 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-blue-500/8" : "")}>
                        {fmt(call.volume)}
                      </td>
                      {/* IV */}
                      <td className={cn("py-2 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-blue-500/8" : "")}>
                        {call.impliedVolatility.toFixed(2)}
                      </td>
                      {/* CHNG */}
                      <td className={cn("py-2 px-2 text-right tabular-nums", isCallITM ? "bg-blue-500/8" : "")}>
                        <span className={call.change >= 0 ? "text-green-400" : "text-red-400"}>
                          {call.change >= 0 ? "+" : ""}{call.change.toFixed(2)}
                        </span>
                      </td>
                      {/* LTP — highlighted blue like NSE */}
                      <td className={cn(
                        "py-2 px-2 text-right tabular-nums font-bold border-r border-muted",
                        isCallITM ? "bg-blue-600/25 text-blue-200" : "bg-blue-900/20 text-blue-300"
                      )}>
                        {call.ltp.toFixed(2)}
                      </td>

                      {/* STRIKE */}
                      <td className={cn(
                        "py-2 px-2 text-center font-bold border-x border-muted",
                        isATM
                          ? "bg-yellow-500/20 text-yellow-300 ring-1 ring-inset ring-yellow-500/40"
                          : "bg-muted/20 text-foreground"
                      )}>
                        {isATM && <span className="text-[9px] block text-yellow-400 leading-none mb-0.5">ATM</span>}
                        {call.strikePrice}
                      </td>

                      {/* === PUTS === */}
                      {/* LTP — highlighted red like NSE */}
                      <td className={cn(
                        "py-2 px-2 text-left tabular-nums font-bold border-l border-muted",
                        isPutITM ? "bg-red-600/25 text-red-200" : "bg-red-900/20 text-red-300"
                      )}>
                        {put.ltp.toFixed(2)}
                      </td>
                      {/* CHNG */}
                      <td className={cn("py-2 px-2 text-left tabular-nums", isPutITM ? "bg-red-500/8" : "")}>
                        <span className={put.change >= 0 ? "text-green-400" : "text-red-400"}>
                          {put.change >= 0 ? "+" : ""}{put.change.toFixed(2)}
                        </span>
                      </td>
                      {/* IV */}
                      <td className={cn("py-2 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-red-500/8" : "")}>
                        {put.impliedVolatility.toFixed(2)}
                      </td>
                      {/* VOL */}
                      <td className={cn("py-2 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-red-500/8" : "")}>
                        {fmt(put.volume)}
                      </td>
                      {/* OI */}
                      <td className={cn("py-2 px-2 text-left tabular-nums", isPutITM ? "bg-red-500/8" : "")}>
                        <span className={cn(isMaxPutOI ? "text-red-400 font-bold" : "text-muted-foreground")}>
                          {isMaxPutOI && "★ "}{fmt(put.openInterest)}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                );
              })}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
