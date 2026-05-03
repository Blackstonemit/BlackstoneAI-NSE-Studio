import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOptionsChain,
  getGetOptionsChainQueryKey,
} from "@workspace/api-client-react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { LiveRefreshBar } from "@/components/live-refresh-bar";
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
import { Badge } from "@/components/ui/badge";
import { Search, Download, RefreshCw, Radio, Upload, X, GitCompare, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

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

type CsvLeg = {
  oi: number | null;
  chgOI: number | null;
  vol: number | null;
  iv: number | null;
  ltp: number | null;
  chg: number | null;
  bid: number | null;
  ask: number | null;
};

type CsvRow = {
  strike: number;
  call: CsvLeg;
  put: CsvLeg;
};

// ── CSV Parsing ───────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function parseNum(s: string): number | null {
  if (!s || s.trim() === "-" || s.trim() === "") return null;
  const n = parseFloat(s.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function parseNseCsv(content: string): CsvRow[] {
  const lines = content.split("\n").filter((l) => l.trim());
  // Skip header rows (CALLS,,PUTS and column header row)
  const dataLines = lines.slice(2);
  const rows: CsvRow[] = [];
  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    if (cols.length < 22) continue;
    const strike = parseNum(cols[11]);
    if (!strike) continue;
    rows.push({
      strike,
      call: { oi: parseNum(cols[1]), chgOI: parseNum(cols[2]), vol: parseNum(cols[3]), iv: parseNum(cols[4]), ltp: parseNum(cols[5]), chg: parseNum(cols[6]), bid: parseNum(cols[8]), ask: parseNum(cols[9]) },
      put: { oi: parseNum(cols[21]), chgOI: parseNum(cols[20]), vol: parseNum(cols[19]), iv: parseNum(cols[18]), ltp: parseNum(cols[17]), chg: parseNum(cols[16]), bid: parseNum(cols[13]), ask: parseNum(cols[14]) },
    });
  }
  return rows;
}

// ── Formatters ────────────────────────────────────────────────────────────────

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

function diffPct(live: number | undefined | null, csv: number | null): number | null {
  if (live == null || csv == null || csv === 0) return null;
  return ((live - csv) / csv) * 100;
}

function DiffBadge({ live, csv }: { live: number | undefined | null; csv: number | null }) {
  const d = diffPct(live, csv);
  if (d === null) return <span className="text-muted-foreground">—</span>;
  const abs = Math.abs(d);
  const color = abs < 1 ? "text-green-400" : abs < 5 ? "text-yellow-400" : "text-red-400";
  return <span className={cn("font-mono text-[10px]", color)}>{d >= 0 ? "+" : ""}{d.toFixed(1)}%</span>;
}

function Chng({ v, decimals = 2 }: { v: number; decimals?: number }) {
  if (v === 0) return <span className="text-muted-foreground">–</span>;
  return (
    <span className={v > 0 ? "text-green-400" : "text-red-400"}>
      {v > 0 ? "+" : ""}{v.toFixed(decimals)}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OptionsChain() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [searchInput, setSearchInput] = useState("NIFTY");
  const [expiry, setExpiry] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [viewMode, setViewMode] = useState<"live" | "compare">("live");
  const [compareExpanded, setCompareExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const queryParams = useMemo(() => ({ symbol, expiry: expiry || undefined }), [symbol, expiry]);
  const { data: rawData, isLoading, isError } = useGetOptionsChain(queryParams, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } as any,
  });
  const chainData = rawData as ChainData | undefined;

  useEffect(() => { if (chainData) setLastUpdated(new Date()); }, [chainData]);

  const { isMarketOpen, isPreOpen, lastUpdatedIST, countdown, refresh: liveRefresh } = useLiveRefresh({
    onRefresh: () => {
      queryClient.invalidateQueries({ queryKey: getGetOptionsChainQueryKey(queryParams) });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) { setSymbol(searchInput.trim().toUpperCase()); setExpiry(""); }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetOptionsChainQueryKey({ symbol, expiry: expiry || undefined }) });
    setLastUpdated(new Date());
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseNseCsv(text);
      if (parsed.length > 0) { setCsvRows(parsed); setViewMode("compare"); }
      else alert("Could not parse CSV. Ensure it is an NSE option chain export.");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const clearCsv = () => { setCsvRows(null); setCsvFileName(""); setViewMode("live"); };

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

  // CSV comparison stats
  const csvStats = useMemo(() => {
    if (!csvRows || !chainData) return null;
    const csvMap = new Map(csvRows.map((r) => [r.strike, r]));
    let matched = 0, totalCallLtpDiff = 0, totalPutLtpDiff = 0, csvCallOI = 0, csvPutOI = 0;
    for (const call of chainData.calls) {
      const csv = csvMap.get(call.strikePrice);
      if (!csv) continue;
      matched++;
      if (csv.call.ltp != null) totalCallLtpDiff += Math.abs(call.ltp - csv.call.ltp);
      if (csv.put.ltp != null) {
        const put = chainData.puts.find((p) => p.strikePrice === call.strikePrice);
        if (put) totalPutLtpDiff += Math.abs(put.ltp - csv.put.ltp);
      }
      if (csv.call.oi != null) csvCallOI += csv.call.oi;
      if (csv.put.oi != null) csvPutOI += csv.put.oi;
    }
    const liveCallOI = chainData.calls.reduce((s, c) => s + c.openInterest, 0);
    const livePutOI  = chainData.puts.reduce((s, p) => s + p.openInterest, 0);
    const csvPCR = csvCallOI > 0 ? csvPutOI / csvCallOI : 0;
    const livePCR = liveCallOI > 0 ? livePutOI / liveCallOI : 0;
    return { matched, totalRows: csvRows.length, avgCallLtpDiff: matched > 0 ? totalCallLtpDiff / matched : 0, avgPutLtpDiff: matched > 0 ? totalPutLtpDiff / matched : 0, csvCallOI, csvPutOI, liveCallOI, livePutOI, csvPCR, livePCR };
  }, [csvRows, chainData]);

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
        rows.push([call.openInterest, (call as NseContract).changeInOI ?? 0, call.volume, call.impliedVolatility.toFixed(2), (call as NseContract).bid ?? 0, (call as NseContract).ask ?? 0, call.ltp.toFixed(2), call.change.toFixed(2), call.strikePrice, put.change.toFixed(2), put.ltp.toFixed(2), (put as NseContract).bid ?? 0, (put as NseContract).ask ?? 0, put.impliedVolatility.toFixed(2), put.volume, (put as NseContract).changeInOI ?? 0, put.openInterest].join(","));
      } else {
        rows.push([call.openInterest, call.volume, call.impliedVolatility.toFixed(2), call.ltp.toFixed(2), call.change.toFixed(2), call.strikePrice, put.change.toFixed(2), put.ltp.toFixed(2), put.impliedVolatility.toFixed(2), put.volume, put.openInterest].join(","));
      }
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${symbol}_options_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }, [chainData, symbol, isNSE]);

  const callCols = isNSE ? 8 : 5;
  const putCols  = isNSE ? 8 : 5;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight font-mono">OPTIONS CHAIN</h1>
          <LiveRefreshBar
            isMarketOpen={isMarketOpen}
            isPreOpen={isPreOpen}
            lastUpdatedIST={lastUpdatedIST}
            countdown={countdown}
            onRefresh={liveRefresh}
          />
        </div>
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
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
          {csvRows ? (
            <div className="flex items-center gap-1">
              <button onClick={() => setViewMode(viewMode === "compare" ? "live" : "compare")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border rounded-sm hover:bg-muted/30 transition-colors",
                  viewMode === "compare" ? "border-primary text-primary bg-primary/10" : "border-muted bg-card"
                )}>
                <GitCompare className="h-3 w-3" />COMPARE
              </button>
              <button onClick={clearCsv}
                className="flex items-center px-2 py-1.5 text-xs font-mono border border-muted bg-card rounded-sm hover:bg-muted/30 transition-colors text-muted-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-muted bg-card rounded-sm hover:bg-muted/30 transition-colors">
              <Upload className="h-3 w-3" />NSE CSV
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
        <div className="space-y-4">
          {/* ── CSV Comparison Panel ────────────────────────────────────────── */}
          {csvRows && csvStats && viewMode === "compare" && (
            <div className="border border-primary/40 rounded-sm bg-card overflow-hidden">
              <button
                onClick={() => setCompareExpanded((e) => !e)}
                className="w-full flex items-center justify-between px-4 py-2.5 border-b border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-mono font-bold text-primary">
                  <GitCompare className="h-4 w-4" />
                  NSE CSV COMPARISON — {csvFileName}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary bg-primary/10">
                    {csvStats.matched}/{csvStats.totalRows} STRIKES MATCHED
                  </Badge>
                  {compareExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {compareExpanded && (
                <>
                  {/* Summary stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-0 divide-x divide-muted border-b border-muted text-center text-xs font-mono">
                    {[
                      { label: "LIVE PCR",     val: csvStats.livePCR.toFixed(2),  color: csvStats.livePCR > 1 ? "text-green-400" : "text-red-400" },
                      { label: "CSV PCR",      val: csvStats.csvPCR.toFixed(2),   color: csvStats.csvPCR  > 1 ? "text-green-400" : "text-red-400" },
                      { label: "LIVE CALL OI", val: fmtIn(csvStats.liveCallOI),   color: "text-blue-400" },
                      { label: "CSV CALL OI",  val: fmtIn(csvStats.csvCallOI),    color: "text-blue-300" },
                      { label: "AVG LTP DIFF", val: `CALL ₹${csvStats.avgCallLtpDiff.toFixed(2)} / PUT ₹${csvStats.avgPutLtpDiff.toFixed(2)}`, color: "text-yellow-400" },
                    ].map((s) => (
                      <div key={s.label} className="py-2 px-2">
                        <div className="text-muted-foreground text-[10px] tracking-wider">{s.label}</div>
                        <div className={cn("font-bold text-sm mt-0.5", s.color)}>{s.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Comparison table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono border-collapse" style={{ minWidth: "860px" }}>
                      <thead>
                        <tr className="border-b border-muted bg-muted/20 text-muted-foreground">
                          <th className="py-1.5 px-3 text-center bg-blue-900/20 text-blue-300 font-normal" colSpan={3}>CALL LTP</th>
                          <th className="py-1.5 px-3 text-center bg-blue-900/20 text-blue-300 font-normal" colSpan={2}>CALL OI</th>
                          <th className="py-1.5 px-3 text-center bg-muted/30 text-foreground font-bold">STRIKE</th>
                          <th className="py-1.5 px-3 text-center bg-red-900/20 text-red-300 font-normal" colSpan={2}>PUT OI</th>
                          <th className="py-1.5 px-3 text-center bg-red-900/20 text-red-300 font-normal" colSpan={3}>PUT LTP</th>
                        </tr>
                        <tr className="border-b-2 border-muted text-muted-foreground bg-muted/10 text-[10px]">
                          <th className="py-1 px-3 text-right font-normal text-blue-300">LIVE</th>
                          <th className="py-1 px-3 text-right font-normal">CSV</th>
                          <th className="py-1 px-3 text-right font-normal">DIFF</th>
                          <th className="py-1 px-3 text-right font-normal text-blue-300">LIVE</th>
                          <th className="py-1 px-3 text-right font-normal border-r border-muted">CSV</th>
                          <th className="py-1 px-3 text-center font-bold border-x border-muted bg-muted/30" />
                          <th className="py-1 px-3 text-left font-normal border-l border-muted text-red-300">LIVE</th>
                          <th className="py-1 px-3 text-left font-normal">CSV</th>
                          <th className="py-1 px-3 text-left font-normal text-red-300">LIVE</th>
                          <th className="py-1 px-3 text-left font-normal">CSV</th>
                          <th className="py-1 px-3 text-left font-normal">DIFF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const csvMap = new Map(csvRows.map((r) => [r.strike, r]));
                          return chainData.calls.map((call, i) => {
                            const put = chainData.puts[i];
                            const csv = csvMap.get(call.strikePrice);
                            const isATM = i === atmIndex;
                            if (!put) return null;
                            return (
                              <tr key={call.strikePrice} className={cn(
                                "border-b border-muted/30 transition-colors",
                                isATM ? "bg-yellow-500/10" : "hover:bg-muted/10",
                                !csv ? "opacity-50" : ""
                              )}>
                                <td className="py-1.5 px-3 text-right tabular-nums text-blue-300 font-bold">{call.ltp.toFixed(2)}</td>
                                <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">{csv?.call.ltp?.toFixed(2) ?? "—"}</td>
                                <td className="py-1.5 px-3 text-right"><DiffBadge live={call.ltp} csv={csv?.call.ltp ?? null} /></td>
                                <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">{fmtOI(call.openInterest)}</td>
                                <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground border-r border-muted">{csv?.call.oi != null ? fmtOI(csv.call.oi) : "—"}</td>
                                <td className={cn("py-1.5 px-3 text-center font-bold border-x border-muted", isATM ? "bg-yellow-500/20 text-yellow-300" : "bg-muted/20")}>
                                  {isATM && <span className="text-[9px] block text-yellow-400 leading-none">ATM</span>}
                                  {call.strikePrice}
                                </td>
                                <td className="py-1.5 px-3 text-left tabular-nums text-muted-foreground border-l border-muted">{fmtOI(put.openInterest)}</td>
                                <td className="py-1.5 px-3 text-left tabular-nums text-muted-foreground">{csv?.put.oi != null ? fmtOI(csv.put.oi) : "—"}</td>
                                <td className="py-1.5 px-3 text-left tabular-nums text-red-300 font-bold">{put.ltp.toFixed(2)}</td>
                                <td className="py-1.5 px-3 text-left tabular-nums text-muted-foreground">{csv?.put.ltp?.toFixed(2) ?? "—"}</td>
                                <td className="py-1.5 px-3 text-left"><DiffBadge live={put.ltp} csv={csv?.put.ltp ?? null} /></td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Live Options Chain Table ─────────────────────────────────────── */}
          <div className="border border-muted rounded-sm bg-card overflow-hidden">
            {/* Underlying banner */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-2.5 border-b border-muted bg-muted/10">
              <div className="font-mono text-sm flex items-center gap-3">
                <span className="text-muted-foreground">Underlying Index:</span>
                <span className="font-bold">{symbol}</span>
                <span className="text-xl font-bold">{chainData.underlyingPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider border",
                  isNSE ? "text-green-400 border-green-500/40 bg-green-500/10"
                    : chainData.dataSource === "Yahoo" ? "text-yellow-400 border-yellow-500/40 bg-yellow-500/10"
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
                    <th colSpan={callCols} className="py-2 text-center text-white bg-blue-700/80 border-r border-blue-600 font-semibold tracking-widest">CALLS</th>
                    <th className="py-2 text-center bg-muted/30 border-x border-muted font-bold text-foreground w-20">STRIKE</th>
                    <th colSpan={putCols} className="py-2 text-center text-white bg-red-700/80 border-l border-red-600 font-semibold tracking-widest">PUTS</th>
                  </tr>
                  <tr className="border-b-2 border-muted text-muted-foreground bg-muted/20 text-[11px]">
                    <th className="py-1.5 px-2 text-right font-normal">OI</th>
                    {isNSE && <th className="py-1.5 px-2 text-right font-normal">CHNG OI</th>}
                    <th className="py-1.5 px-2 text-right font-normal">VOL</th>
                    <th className="py-1.5 px-2 text-right font-normal">IV</th>
                    {isNSE && <th className="py-1.5 px-2 text-right font-normal">BID</th>}
                    {isNSE && <th className="py-1.5 px-2 text-right font-normal">ASK</th>}
                    <th className="py-1.5 px-2 text-right font-normal">CHNG</th>
                    <th className="py-1.5 px-2 text-right font-normal border-r border-muted bg-blue-900/30 text-blue-300">LTP</th>
                    <th className="py-1.5 px-2 text-center font-bold border-x border-muted bg-muted/30" />
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
                      <tr key={call.strikePrice} className={cn("border-b border-muted/30 transition-colors", isATM ? "hover:bg-yellow-500/10" : "hover:bg-muted/10")}>
                        <td className={cn("py-1.5 px-2 text-right tabular-nums", isCallITM ? "bg-blue-500/8" : "")}>
                          <span className={isMaxCallOI ? "text-blue-400 font-bold" : "text-muted-foreground"}>{isMaxCallOI && "★ "}{fmtOI(call.openInterest)}</span>
                        </td>
                        {isNSE && <td className={cn("py-1.5 px-2 text-right tabular-nums", isCallITM ? "bg-blue-500/8" : "")}><Chng v={nc.changeInOI ?? 0} /></td>}
                        <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-blue-500/8" : "")}>{fmtOI(call.volume)}</td>
                        <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-blue-500/8" : "")}>{call.impliedVolatility.toFixed(2)}</td>
                        {isNSE && <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-blue-500/8" : "")}>{nc.bid ? nc.bid.toFixed(2) : "–"}</td>}
                        {isNSE && <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-blue-500/8" : "")}>{nc.ask ? nc.ask.toFixed(2) : "–"}</td>}
                        <td className={cn("py-1.5 px-2 text-right tabular-nums", isCallITM ? "bg-blue-500/8" : "")}><Chng v={call.change} /></td>
                        <td className={cn("py-1.5 px-2 text-right tabular-nums font-bold border-r border-muted", isCallITM ? "bg-blue-600/25 text-blue-200" : "bg-blue-900/20 text-blue-300")}>{call.ltp.toFixed(2)}</td>
                        <td className={cn("py-1.5 px-2 text-center font-bold border-x border-muted", isATM ? "bg-yellow-500/20 text-yellow-300 ring-1 ring-inset ring-yellow-500/40" : "bg-muted/20 text-foreground")}>
                          {isATM && <span className="text-[9px] block text-yellow-400 leading-none mb-0.5">ATM</span>}
                          {call.strikePrice}
                        </td>
                        <td className={cn("py-1.5 px-2 text-left tabular-nums font-bold border-l border-muted", isPutITM ? "bg-red-600/25 text-red-200" : "bg-red-900/20 text-red-300")}>{put.ltp.toFixed(2)}</td>
                        <td className={cn("py-1.5 px-2 text-left tabular-nums", isPutITM ? "bg-red-500/8" : "")}><Chng v={put.change} /></td>
                        {isNSE && <td className={cn("py-1.5 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-red-500/8" : "")}>{np.bid ? np.bid.toFixed(2) : "–"}</td>}
                        {isNSE && <td className={cn("py-1.5 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-red-500/8" : "")}>{np.ask ? np.ask.toFixed(2) : "–"}</td>}
                        <td className={cn("py-1.5 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-red-500/8" : "")}>{put.impliedVolatility.toFixed(2)}</td>
                        <td className={cn("py-1.5 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-red-500/8" : "")}>{fmtOI(put.volume)}</td>
                        {isNSE && <td className={cn("py-1.5 px-2 text-left tabular-nums", isPutITM ? "bg-red-500/8" : "")}><Chng v={np.changeInOI ?? 0} /></td>}
                        <td className={cn("py-1.5 px-2 text-left tabular-nums", isPutITM ? "bg-red-500/8" : "")}>
                          <span className={isMaxPutOI ? "text-red-400 font-bold" : "text-muted-foreground"}>{isMaxPutOI && "★ "}{fmtOI(put.openInterest)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
