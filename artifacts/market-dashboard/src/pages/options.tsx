import { useState, useEffect, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOptionsChain,
  getGetOptionsChainQueryKey,
} from "@workspace/api-client-react";
import type { OptionContract } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Download, RefreshCw, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

// NSE returns extra fields beyond the base OptionContract schema
type NseContract = OptionContract & {
  changeInOI?: number;
  bid?: number;
  ask?: number;
  bidQty?: number;
  askQty?: number;
};

type ChainData = {
  symbol: string;
  underlyingPrice: number;
  expiries: string[];
  selectedExpiry: string;
  calls: NseContract[];
  puts: NseContract[];
  dataSource?: string;
  timestamp?: string;
};

function fmtIn(n: number) {
  if (n >= 10_000_000) return (n / 10_000_000).toFixed(2) + "Cr";
  if (n >= 100_000) return (n / 100_000).toFixed(2) + "L";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("en-IN");
}

function fmtOI(n: number) {
  if (Math.abs(n) >= 100_000) return (n / 100_000).toFixed(2) + "L";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("en-IN");
}

function Chng({ v, decimals = 2 }: { v: number; decimals?: number }) {
  if (v === 0) return <span className="text-muted-foreground">–</span>;
  return (
    <span className={v > 0 ? "text-green-400" : "text-red-400"}>
      {v > 0 ? "+" : ""}
      {v.toFixed(decimals)}
    </span>
  );
}

export default function OptionsChain() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [searchInput, setSearchInput] = useState("NIFTY");
  const [expiry, setExpiry] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const queryClient = useQueryClient();

  const queryParams = useMemo(
    () => ({ symbol, expiry: expiry || undefined }),
    [symbol, expiry]
  );
  const { data: rawData, isLoading, isError } = useGetOptionsChain(queryParams, {
    query: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false },
  });
  const chainData = rawData as ChainData | undefined;

  useEffect(() => {
    if (chainData) setLastUpdated(new Date());
  }, [chainData]);

  useEffect(() => {
    const id = setInterval(() => {
      queryClient.invalidateQueries({
        queryKey: getGetOptionsChainQueryKey(queryParams),
      });
    }, 30000);
    return () => clearInterval(id);
  }, [queryClient, symbol, expiry]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) { setSymbol(searchInput.trim().toUpperCase()); setExpiry(""); }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({
      queryKey: getGetOptionsChainQueryKey({ symbol, expiry: expiry || undefined }),
    });
    setLastUpdated(new Date());
  };

  const isNSE = chainData?.dataSource === "NSE";

  const stats = useMemo(() => {
    if (!chainData) return null;
    const totalCallOI  = chainData.calls.reduce((s, c) => s + c.openInterest, 0);
    const totalPutOI   = chainData.puts.reduce((s, p) => s + p.openInterest, 0);
    const totalCallVol = chainData.calls.reduce((s, c) => s + c.volume, 0);
    const totalPutVol  = chainData.puts.reduce((s, p) => s + p.volume, 0);
    const pcr = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;
    const maxCallOI = Math.max(...chainData.calls.map((c) => c.openInterest));
    const maxPutOI  = Math.max(...chainData.puts.map((p) => p.openInterest));
    const maxCallOIStrike = chainData.calls.find((c) => c.openInterest === maxCallOI)?.strikePrice;
    const maxPutOIStrike  = chainData.puts.find((p) => p.openInterest === maxPutOI)?.strikePrice;
    return { totalCallOI, totalPutOI, totalCallVol, totalPutVol, pcr, maxCallOI, maxPutOI, maxCallOIStrike, maxPutOIStrike };
  }, [chainData]);

  const atmIndex = useMemo(() => {
    if (!chainData) return -1;
    let closest = 0, minDiff = Infinity;
    chainData.calls.forEach((c, i) => {
      const d = Math.abs(c.strikePrice - chainData.underlyingPrice);
      if (d < minDiff) { minDiff = d; closest = i; }
    });
    return closest;
  }, [chainData]);

  const downloadCSV = useCallback(() => {
    if (!chainData) return;
    const header = isNSE
      ? "Call OI,Call Chg OI,Call Vol,Call IV,Call Bid,Call Ask,Call LTP,Call Chg,Strike,Put Chg,Put LTP,Put Bid,Put Ask,Put IV,Put Vol,Put Chg OI,Put OI"
      : "Call OI,Call Vol,Call IV,Call LTP,Call Chg,Strike,Put Chg,Put LTP,Put IV,Put Vol,Put OI";
    const rows = [header];
    chainData.calls.forEach((call, i) => {
      const put = chainData.puts[i] as NseContract | undefined;
      if (!put) return;
      if (isNSE) {
        rows.push([
          call.openInterest, (call as NseContract).changeInOI ?? 0, call.volume,
          call.impliedVolatility.toFixed(2), (call as NseContract).bid ?? 0,
          (call as NseContract).ask ?? 0, call.ltp.toFixed(2), call.change.toFixed(2),
          call.strikePrice,
          put.change.toFixed(2), put.ltp.toFixed(2), put.bid ?? 0, put.ask ?? 0,
          put.impliedVolatility.toFixed(2), put.volume, put.changeInOI ?? 0, put.openInterest,
        ].join(","));
      } else {
        rows.push([
          call.openInterest, call.volume, call.impliedVolatility.toFixed(2),
          call.ltp.toFixed(2), call.change.toFixed(2), call.strikePrice,
          put.change.toFixed(2), put.ltp.toFixed(2), put.impliedVolatility.toFixed(2),
          put.volume, put.openInterest,
        ].join(","));
      }
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${symbol}_options_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }, [chainData, symbol, isNSE]);

  // NSE has more columns; define column spans
  const callCols = isNSE ? 8 : 5;
  const putCols  = isNSE ? 8 : 5;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight font-mono">OPTIONS CHAIN</h1>
        <div className="flex gap-2 items-center flex-wrap">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 w-[160px] font-mono border-muted bg-card uppercase text-sm"
              placeholder="SYMBOL..." />
          </form>
          {chainData && chainData.expiries.length > 0 && (
            <Select value={expiry || chainData.selectedExpiry} onValueChange={setExpiry}>
              <SelectTrigger className="w-[150px] font-mono border-muted bg-card text-sm">
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
          <button onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-muted bg-card rounded-sm hover:bg-muted/30 transition-colors">
            <RefreshCw className="h-3 w-3" />REFRESH
          </button>
          {chainData && (
            <button onClick={downloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-muted bg-card rounded-sm hover:bg-muted/30 transition-colors">
              <Download className="h-3 w-3" />CSV
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="border border-muted rounded-sm bg-card p-6 space-y-3">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          <div className="text-center text-xs text-muted-foreground font-mono pt-2">LOADING OPTIONS CHAIN...</div>
        </div>
      ) : isError ? (
        <div className="py-20 text-center border border-red-500/30 border-dashed rounded-sm bg-card">
          <h3 className="text-lg font-mono font-bold text-red-400">FAILED TO LOAD OPTIONS DATA</h3>
          <p className="text-sm text-muted-foreground mt-2">Check network connection and try refreshing.</p>
        </div>
      ) : !chainData ? (
        <div className="py-20 text-center border border-muted border-dashed rounded-sm bg-card">
          <h3 className="text-lg font-mono font-bold text-muted-foreground">NO DATA FOUND FOR {symbol}</h3>
        </div>
      ) : (
        <div className="border border-muted rounded-sm bg-card overflow-hidden">

          {/* NSE-style underlying banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-2.5 border-b border-muted bg-muted/10">
            <div className="font-mono text-sm flex items-center gap-3">
              <span className="text-muted-foreground">Underlying Index:</span>
              <span className="font-bold">{symbol}</span>
              <span className="text-xl font-bold">{chainData.underlyingPrice.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              {/* Data source badge */}
              <span className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider border",
                isNSE
                  ? "text-green-400 border-green-500/40 bg-green-500/10"
                  : chainData.dataSource === "Yahoo"
                    ? "text-yellow-400 border-yellow-500/40 bg-yellow-500/10"
                    : "text-muted-foreground border-muted/40 bg-muted/10"
              )}>
                <Radio className="h-2.5 w-2.5" />
                {isNSE ? "NSE LIVE" : chainData.dataSource === "Yahoo" ? "YAHOO FINANCE" : "SYNTHETIC"}
              </span>
              <span className="text-muted-foreground">
                As on {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} IST
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 sm:grid-cols-6 border-b border-muted divide-x divide-muted text-center text-xs font-mono">
            {[
              { label: "PCR", value: stats!.pcr.toFixed(2), color: stats!.pcr > 1 ? "text-green-400" : stats!.pcr < 0.7 ? "text-red-400" : "text-yellow-400" },
              { label: "CALL OI", value: fmtIn(stats!.totalCallOI), color: "text-blue-400" },
              { label: "PUT OI",  value: fmtIn(stats!.totalPutOI),  color: "text-red-400"  },
              { label: "CALL VOL",value: fmtIn(stats!.totalCallVol),color: "text-blue-300" },
              { label: "PUT VOL", value: fmtIn(stats!.totalPutVol), color: "text-red-300"  },
              { label: "MAX OI", value: null, callStrike: stats!.maxCallOIStrike, putStrike: stats!.maxPutOIStrike },
            ].map((s, i) => (
              <div key={i} className="py-2 px-2">
                <div className="text-muted-foreground text-[10px] tracking-wider">{s.label}</div>
                {s.value !== null
                  ? <div className={cn("font-bold text-sm mt-0.5", s.color)}>{s.value}</div>
                  : <div className="text-[11px] mt-0.5">
                      <span className="text-blue-400">C:{s.callStrike}</span>
                      <span className="text-muted-foreground mx-1">|</span>
                      <span className="text-red-400">P:{s.putStrike}</span>
                    </div>
                }
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono border-collapse" style={{ minWidth: isNSE ? "1100px" : "700px" }}>
              <thead>

                <tr>
                  <th colSpan={callCols} className="py-2 text-center text-white bg-blue-700/80 border-r border-blue-600 font-semibold tracking-widest">
                    CALLS
                  </th>
                  <th className="py-2 text-center bg-muted/30 border-x border-muted font-bold text-foreground w-20">
                    STRIKE
                  </th>
                  <th colSpan={putCols} className="py-2 text-center text-white bg-red-700/80 border-l border-red-600 font-semibold tracking-widest">
                    PUTS
                  </th>
                </tr>
                <tr className="border-b-2 border-muted text-muted-foreground bg-muted/20 text-[11px]">
                  {/* Call columns */}
                  <th className="py-1.5 px-2 text-right font-normal">OI</th>
                  {isNSE && <th className="py-1.5 px-2 text-right font-normal">CHNG OI</th>}
                  <th className="py-1.5 px-2 text-right font-normal">VOL</th>
                  <th className="py-1.5 px-2 text-right font-normal">IV</th>
                  {isNSE && <th className="py-1.5 px-2 text-right font-normal">BID</th>}
                  {isNSE && <th className="py-1.5 px-2 text-right font-normal">ASK</th>}
                  <th className="py-1.5 px-2 text-right font-normal">CHNG</th>
                  <th className="py-1.5 px-2 text-right font-normal border-r border-muted bg-blue-900/30 text-blue-300">LTP</th>
                  {/* Strike */}
                  <th className="py-1.5 px-2 text-center font-bold border-x border-muted bg-muted/30"></th>
                  {/* Put columns */}
                  <th className="py-1.5 px-2 text-left font-normal border-l border-muted bg-red-900/30 text-red-300">LTP</th>
                  <th className="py-1.5 px-2 text-left font-normal">CHNG</th>
                  {isNSE && <th className="py-1.5 px-2 text-left font-normal">BID</th>}
                  {isNSE && <th className="py-1.5 px-2 text-left font-normal">ASK</th>}
                  <th className="py-1.5 px-2 text-left font-normal">IV</th>
                  <th className="py-1.5 px-2 text-left font-normal">VOL</th>
                  {isNSE && <th className="py-1.5 px-2 text-left font-normal">CHNG OI</th>}
                  <th className="py-1.5 px-2 text-left font-normal">OI</th>
                </tr>
              </thead>

              <tbody>
              {chainData.calls.map((call, i) => {
                const put = chainData.puts[i] as NseContract | undefined;
                if (!put) return null;

                const isATM = i === atmIndex;
                const isCallITM = call.strikePrice < chainData.underlyingPrice;
                const isPutITM  = put.strikePrice  > chainData.underlyingPrice;
                const isMaxCallOI = call.openInterest === stats!.maxCallOI;
                const isMaxPutOI  = put.openInterest  === stats!.maxPutOI;
                const nc = call as NseContract;
                const np = put  as NseContract;

                return (
                  <tr key={call.strikePrice} className={cn(
                    "border-b border-muted/30 transition-colors",
                    isATM ? "hover:bg-yellow-500/10" : "hover:bg-muted/10"
                  )}>
                      {/* ── CALLS ── */}
                      {/* OI */}
                      <td className={cn("py-1.5 px-2 text-right tabular-nums", isCallITM ? "bg-blue-500/8" : "")}>
                        <span className={isMaxCallOI ? "text-blue-400 font-bold" : "text-muted-foreground"}>
                          {isMaxCallOI && "★ "}{fmtOI(call.openInterest)}
                        </span>
                      </td>
                      {/* CHNG OI — NSE only */}
                      {isNSE && (
                        <td className={cn("py-1.5 px-2 text-right tabular-nums", isCallITM ? "bg-blue-500/8" : "")}>
                          <Chng v={nc.changeInOI ?? 0} />
                        </td>
                      )}
                      {/* VOL */}
                      <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-blue-500/8" : "")}>
                        {fmtOI(call.volume)}
                      </td>
                      {/* IV */}
                      <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-blue-500/8" : "")}>
                        {call.impliedVolatility.toFixed(2)}
                      </td>
                      {/* BID — NSE only */}
                      {isNSE && (
                        <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-blue-500/8" : "")}>
                          {nc.bid ? nc.bid.toFixed(2) : "–"}
                        </td>
                      )}
                      {/* ASK — NSE only */}
                      {isNSE && (
                        <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-blue-500/8" : "")}>
                          {nc.ask ? nc.ask.toFixed(2) : "–"}
                        </td>
                      )}
                      {/* CHNG */}
                      <td className={cn("py-1.5 px-2 text-right tabular-nums", isCallITM ? "bg-blue-500/8" : "")}>
                        <Chng v={call.change} />
                      </td>
                      {/* LTP — highlighted blue */}
                      <td className={cn(
                        "py-1.5 px-2 text-right tabular-nums font-bold border-r border-muted",
                        isCallITM ? "bg-blue-600/25 text-blue-200" : "bg-blue-900/20 text-blue-300"
                      )}>
                        {call.ltp.toFixed(2)}
                      </td>

                      {/* ── STRIKE ── */}
                      <td className={cn(
                        "py-1.5 px-2 text-center font-bold border-x border-muted",
                        isATM ? "bg-yellow-500/20 text-yellow-300 ring-1 ring-inset ring-yellow-500/40" : "bg-muted/20 text-foreground"
                      )}>
                        {isATM && <span className="text-[9px] block text-yellow-400 leading-none mb-0.5">ATM</span>}
                        {call.strikePrice}
                      </td>

                      {/* ── PUTS ── */}
                      {/* LTP — highlighted red */}
                      <td className={cn(
                        "py-1.5 px-2 text-left tabular-nums font-bold border-l border-muted",
                        isPutITM ? "bg-red-600/25 text-red-200" : "bg-red-900/20 text-red-300"
                      )}>
                        {put.ltp.toFixed(2)}
                      </td>
                      {/* CHNG */}
                      <td className={cn("py-1.5 px-2 text-left tabular-nums", isPutITM ? "bg-red-500/8" : "")}>
                        <Chng v={put.change} />
                      </td>
                      {/* BID — NSE only */}
                      {isNSE && (
                        <td className={cn("py-1.5 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-red-500/8" : "")}>
                          {np.bid ? np.bid.toFixed(2) : "–"}
                        </td>
                      )}
                      {/* ASK — NSE only */}
                      {isNSE && (
                        <td className={cn("py-1.5 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-red-500/8" : "")}>
                          {np.ask ? np.ask.toFixed(2) : "–"}
                        </td>
                      )}
                      {/* IV */}
                      <td className={cn("py-1.5 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-red-500/8" : "")}>
                        {put.impliedVolatility.toFixed(2)}
                      </td>
                      {/* VOL */}
                      <td className={cn("py-1.5 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-red-500/8" : "")}>
                        {fmtOI(put.volume)}
                      </td>
                      {/* CHNG OI — NSE only */}
                      {isNSE && (
                        <td className={cn("py-1.5 px-2 text-left tabular-nums", isPutITM ? "bg-red-500/8" : "")}>
                          <Chng v={np.changeInOI ?? 0} />
                        </td>
                      )}
                      {/* OI */}
                      <td className={cn("py-1.5 px-2 text-left tabular-nums", isPutITM ? "bg-red-500/8" : "")}>
                        <span className={isMaxPutOI ? "text-red-400 font-bold" : "text-muted-foreground"}>
                          {isMaxPutOI && "★ "}{fmtOI(put.openInterest)}
                        </span>
                      </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
