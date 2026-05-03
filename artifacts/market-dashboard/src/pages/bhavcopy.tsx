import { useState, useRef, useCallback } from "react";
import JSZip from "jszip";
import {
  Upload, FileText, TrendingUp, TrendingDown, Zap,
  ArrowUpDown, Search, ChevronUp, ChevronDown, PackageOpen,
  BarChart3, Banknote, Users, Package
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type BhavRow = {
  symbol: string;
  series: string;
  date: string;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  last: number;
  close: number;
  avgPrice: number;
  volume: number;       // TTL_TRD_QNTY
  turnoverLacs: number; // TURNOVER_LACS
  trades: number;       // NO_OF_TRADES
  delivQty: number;
  delivPer: number;
  changeAbs: number;
  changePct: number;
};

type BulkDeal = {
  date: string;
  symbol: string;
  secName: string;
  client: string;
  buySell: string;
  qty: number;
  price: number;
  remarks: string;
};

type ParsedData = {
  date: string;
  rows: BhavRow[];
  bulkDeals: BulkDeal[];
  totalTurnover: number;
  totalVolume: number;
  totalTrades: number;
  advances: number;
  declines: number;
  unchanged: number;
};

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseBhavCSV(text: string): BhavRow[] {
  const lines = text.split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const rows: BhavRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length < 14) continue;
    const prevClose = parseFloat(cols[3]) || 0;
    const close     = parseFloat(cols[8]) || 0;
    const changeAbs = close - prevClose;
    const changePct = prevClose > 0 ? (changeAbs / prevClose) * 100 : 0;
    rows.push({
      symbol:       cols[0],
      series:       cols[1],
      date:         cols[2],
      prevClose,
      open:         parseFloat(cols[4]) || 0,
      high:         parseFloat(cols[5]) || 0,
      low:          parseFloat(cols[6]) || 0,
      last:         parseFloat(cols[7]) || 0,
      close,
      avgPrice:     parseFloat(cols[9]) || 0,
      volume:       parseInt(cols[10]) || 0,
      turnoverLacs: parseFloat(cols[11]) || 0,
      trades:       parseInt(cols[12]) || 0,
      delivQty:     parseInt(cols[13]) || 0,
      delivPer:     parseFloat(cols[14]) || 0,
      changeAbs,
      changePct,
    });
  }
  return rows;
}

function parseBulkCSV(text: string): BulkDeal[] {
  const lines = text.split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const deals: BulkDeal[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    if (cols.length < 6 || !cols[1]) continue;
    deals.push({
      date: cols[0], symbol: cols[1], secName: cols[2],
      client: cols[3], buySell: cols[4],
      qty: parseInt(cols[5].replace(/,/g, "")) || 0,
      price: parseFloat(cols[6]) || 0,
      remarks: cols[7] || "",
    });
  }
  return deals;
}

async function parseZip(file: File): Promise<{ bhav: string | null; bulk: string | null }> {
  const zip = await JSZip.loadAsync(file);
  let bhav: string | null = null;
  let bulk: string | null = null;
  for (const [name, entry] of Object.entries(zip.files)) {
    const lower = name.toLowerCase();
    if (!entry.dir) {
      if ((lower.includes("sec_bhavdata_full") || lower.startsWith("bc")) && lower.endsWith(".csv")) {
        bhav = await entry.async("string");
      }
      if (lower === "bulk.csv") {
        bulk = await entry.async("string");
      }
    }
  }
  return { bhav, bulk };
}

// ── Small helpers ─────────────────────────────────────────────────────────────

const fmt = (n: number, d = 2) => n.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtInt = (n: number) => n.toLocaleString("en-IN");
const chgColor = (v: number) => v > 0 ? "text-green-400" : v < 0 ? "text-red-400" : "text-muted-foreground";

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-sm p-3 flex items-start gap-3">
      <div className="p-2 rounded-sm bg-primary/10 shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">{label}</div>
        <div className="text-lg font-bold font-mono text-foreground leading-tight">{value}</div>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

function TopTable({ title, rows, colorFn }: {
  title: string;
  rows: BhavRow[];
  colorFn: (r: BhavRow) => string;
}) {
  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-border">
        <span className="text-xs font-mono font-bold text-foreground">{title}</span>
      </div>
      <table className="w-full text-[11px] font-mono">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-3 py-1.5 text-muted-foreground font-normal">CONTRACT</th>
            <th className="text-right px-3 py-1.5 text-muted-foreground font-normal">LTP</th>
            <th className="text-right px-3 py-1.5 text-muted-foreground font-normal">CHNG</th>
            <th className="text-right px-3 py-1.5 text-muted-foreground font-normal">%CHNG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol} className="border-b border-border/50 hover:bg-muted/20">
              <td className="px-3 py-1.5">
                <div className="font-bold">{r.symbol}</div>
                <div className="text-[9px] text-muted-foreground">{r.series}</div>
              </td>
              <td className="px-3 py-1.5 text-right">{fmt(r.close)}</td>
              <td className={cn("px-3 py-1.5 text-right", colorFn(r))}>{r.changeAbs >= 0 ? "+" : ""}{fmt(r.changeAbs)}</td>
              <td className={cn("px-3 py-1.5 text-right font-bold", colorFn(r))}>{r.changePct >= 0 ? "+" : ""}{fmt(r.changePct)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type SortKey = keyof BhavRow;
type SortDir = "asc" | "desc";

export default function BhavcopyPage() {
  const [data, setData] = useState<ParsedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState("");
  const [seriesFilter, setSeriesFilter] = useState("EQ");
  const [sortKey, setSortKey] = useState<SortKey>("turnoverLacs");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      let bhavText: string | null = null;
      let bulkText: string | null = null;

      if (file.name.endsWith(".zip")) {
        const extracted = await parseZip(file);
        bhavText = extracted.bhav;
        bulkText = extracted.bulk;
      } else if (file.name.endsWith(".csv")) {
        bhavText = await file.text();
      }

      if (!bhavText) throw new Error("Could not find Bhavcopy CSV inside the file. Expected sec_bhavdata_full_*.csv or bc*.csv");

      const rows = parseBhavCSV(bhavText);
      if (rows.length === 0) throw new Error("No data rows found — check the file format");

      const bulkDeals = bulkText ? parseBulkCSV(bulkText) : [];
      const date = rows[0]?.date ?? "—";
      const totalTurnover = rows.reduce((s, r) => s + r.turnoverLacs, 0);
      const totalVolume   = rows.reduce((s, r) => s + r.volume, 0);
      const totalTrades   = rows.reduce((s, r) => s + r.trades, 0);
      const advances  = rows.filter((r) => r.changePct > 0).length;
      const declines  = rows.filter((r) => r.changePct < 0).length;
      const unchanged = rows.filter((r) => r.changePct === 0).length;

      setData({ date, rows, bulkDeals, totalTurnover, totalVolume, totalTrades, advances, declines, unchanged });
    } catch (e: any) {
      setError(e.message ?? "Failed to parse file");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
    setPage(1);
  };

  // ── Derived data ────────────────────────────────────────────────────────────
  const eqRows = data ? data.rows.filter((r) => seriesFilter ? r.series === seriesFilter : true) : [];
  const topGainers = [...eqRows].filter(r => r.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, 5);
  const topLosers  = [...eqRows].filter(r => r.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, 5);
  const mostActive = [...eqRows].sort((a, b) => b.turnoverLacs - a.turnoverLacs).slice(0, 5);

  const filtered = eqRows
    .filter((r) => !search || r.symbol.includes(search.toUpperCase()))
    .sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortDir === "asc" ? av - bv : bv - av;
    });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allSeries = data ? [...new Set(data.rows.map(r => r.series))].sort() : [];

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k
      ? sortDir === "asc" ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />
      : <ArrowUpDown className="h-3 w-3 inline opacity-30" />;

  // ── Upload zone ─────────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 text-primary font-mono font-bold text-lg mb-1">
            <PackageOpen className="h-5 w-5" />
            NSE DAILY BHAVCOPY ANALYSER
          </div>
          <p className="text-muted-foreground text-sm">
            Upload the NSE Capital Market daily ZIP (e.g. <span className="font-mono text-foreground">cap-Daily-Multiple_*.zip</span>) or a Bhavcopy CSV
          </p>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "w-full max-w-xl border-2 border-dashed rounded-sm p-12 flex flex-col items-center gap-4 cursor-pointer transition-colors",
            dragging ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <Upload className={cn("h-10 w-10 transition-colors", dragging ? "text-primary" : "text-muted-foreground")} />
          <div className="text-center">
            <div className="font-mono font-medium text-foreground">Drop file here or click to browse</div>
            <div className="text-xs text-muted-foreground mt-1">Supports: .zip (NSE daily bundle) or .csv (Bhavcopy)</div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".zip,.csv"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {loading && (
          <div className="flex items-center gap-2 font-mono text-sm text-muted-foreground animate-pulse">
            <FileText className="h-4 w-4" />
            Parsing file…
          </div>
        )}
        {error && (
          <div className="text-red-400 font-mono text-sm text-center max-w-md">{error}</div>
        )}

        <div className="text-[11px] font-mono text-muted-foreground/50 text-center max-w-md">
          Files are processed entirely in your browser — nothing is uploaded to any server.
        </div>
      </div>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-primary font-mono font-bold text-base">
            <PackageOpen className="h-4 w-4" />
            NSE BHAVCOPY — {data.date.toUpperCase()}
          </div>
          <div className="text-xs text-muted-foreground font-mono mt-0.5">
            {fmtInt(data.rows.length)} securities · {data.rows.filter(r => r.series === "EQ").length} EQ stocks
          </div>
        </div>
        <button
          onClick={() => { setData(null); setSearch(""); setPage(1); }}
          className="text-xs font-mono border border-border rounded-sm px-3 py-1.5 text-muted-foreground hover:text-primary hover:border-primary transition-colors"
        >
          ↑ UPLOAD NEW FILE
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <StatCard icon={Banknote} label="Turnover" value={`₹${fmt(data.totalTurnover / 100, 0)} Cr`} sub="CM Segment" />
        <StatCard icon={BarChart3} label="Volume" value={fmtInt(Math.round(data.totalVolume / 100000))} sub="Lakhs shares" />
        <StatCard icon={Users} label="Trades" value={fmtInt(data.totalTrades)} sub="Total executions" />
        <StatCard icon={Package} label="Securities" value={fmtInt(data.rows.length)} sub="Traded today" />
        <div className="bg-card border border-border rounded-sm p-3 flex flex-col justify-center">
          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider mb-1">A/D/U</div>
          <div className="flex items-center gap-2 font-mono text-sm font-bold">
            <span className="text-green-400">{data.advances}↑</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-red-400">{data.declines}↓</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground">{data.unchanged}—</span>
          </div>
          <div className="w-full mt-1.5 h-1.5 rounded-full bg-border overflow-hidden flex">
            <div className="bg-green-500 h-full" style={{ width: `${(data.advances / data.rows.length) * 100}%` }} />
            <div className="bg-red-500 h-full" style={{ width: `${(data.declines / data.rows.length) * 100}%` }} />
          </div>
        </div>
        {data.bulkDeals.length > 0 && (
          <div className="bg-card border border-amber-500/30 rounded-sm p-3 col-span-2">
            <div className="text-[10px] text-amber-400 font-mono uppercase tracking-wider mb-1">Bulk Deals ({data.bulkDeals.length})</div>
            {data.bulkDeals.slice(0, 3).map((d, i) => (
              <div key={i} className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
                <span className={d.buySell === "BUY" ? "text-green-400" : "text-red-400"}>{d.buySell}</span>
                <span className="text-foreground font-bold">{d.symbol}</span>
                <span>@ ₹{fmt(d.price)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3-column top tables */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TopTable
          title="▲  MOST ACTIVE CALLS (TOP GAINERS)"
          rows={topGainers}
          colorFn={() => "text-green-400"}
        />
        <TopTable
          title="▼  MOST ACTIVE PUTS (TOP LOSERS)"
          rows={topLosers}
          colorFn={() => "text-red-400"}
        />
        <TopTable
          title="⚡  MOST ACTIVE BY TURNOVER"
          rows={mostActive}
          colorFn={(r) => chgColor(r.changePct)}
        />
      </div>

      {/* Bulk deals table */}
      {data.bulkDeals.length > 0 && (
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <div className="px-3 py-2 border-b border-border flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-mono font-bold">BULK DEALS — {data.date.toUpperCase()}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono">
              <thead>
                <tr className="border-b border-border">
                  {["SYMBOL","SECURITY NAME","CLIENT","B/S","QTY","PRICE"].map(h => (
                    <th key={h} className="text-left px-3 py-1.5 text-muted-foreground font-normal whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.bulkDeals.map((d, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-1.5 font-bold text-primary">{d.symbol}</td>
                    <td className="px-3 py-1.5 max-w-[180px] truncate text-muted-foreground">{d.secName}</td>
                    <td className="px-3 py-1.5 max-w-[160px] truncate">{d.client}</td>
                    <td className={cn("px-3 py-1.5 font-bold", d.buySell === "BUY" ? "text-green-400" : "text-red-400")}>{d.buySell}</td>
                    <td className="px-3 py-1.5 text-right">{fmtInt(d.qty)}</td>
                    <td className="px-3 py-1.5 text-right">₹{fmt(d.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Full contract table */}
      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-border flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold">
            <FileText className="h-3.5 w-3.5 text-primary" />
            ALL CONTRACTS — {fmtInt(filtered.length)} ROWS
          </div>

          {/* Series filter */}
          <div className="flex items-center gap-1 flex-wrap ml-1">
            {["", ...allSeries].slice(0, 8).map((s) => (
              <button
                key={s || "ALL"}
                onClick={() => { setSeriesFilter(s); setPage(1); }}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-mono border rounded-sm transition-colors",
                  seriesFilter === s
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                )}
              >
                {s || "ALL"}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="ml-auto flex items-center gap-1.5 border border-border rounded-sm px-2 py-0.5 bg-background">
            <Search className="h-3 w-3 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search symbol…"
              className="w-28 text-[11px] font-mono bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="border-b border-border">
                {([
                  ["symbol","SYMBOL"],["series","SRS"],["open","OPEN"],["high","HIGH"],
                  ["low","LOW"],["close","CLOSE"],["changeAbs","CHNG"],["changePct","%CHNG"],
                  ["volume","VOLUME"],["turnoverLacs","₹ LACS"],["delivPer","DEL%"],["trades","TRADES"],
                ] as [SortKey, string][]).map(([k, label]) => (
                  <th
                    key={k}
                    onClick={() => toggleSort(k)}
                    className="px-3 py-1.5 text-left text-muted-foreground font-normal cursor-pointer hover:text-foreground whitespace-nowrap select-none"
                  >
                    {label} <SortIcon k={k} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.symbol + r.series} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-3 py-1 font-bold text-foreground">{r.symbol}</td>
                  <td className="px-3 py-1 text-muted-foreground">{r.series}</td>
                  <td className="px-3 py-1 text-right">{fmt(r.open)}</td>
                  <td className="px-3 py-1 text-right text-green-400">{fmt(r.high)}</td>
                  <td className="px-3 py-1 text-right text-red-400">{fmt(r.low)}</td>
                  <td className="px-3 py-1 text-right font-bold">{fmt(r.close)}</td>
                  <td className={cn("px-3 py-1 text-right", chgColor(r.changeAbs))}>
                    {r.changeAbs >= 0 ? "+" : ""}{fmt(r.changeAbs)}
                  </td>
                  <td className={cn("px-3 py-1 text-right font-bold", chgColor(r.changePct))}>
                    {r.changePct >= 0 ? "+" : ""}{fmt(r.changePct)}%
                  </td>
                  <td className="px-3 py-1 text-right text-muted-foreground">{fmtInt(r.volume)}</td>
                  <td className="px-3 py-1 text-right">{fmt(r.turnoverLacs, 0)}</td>
                  <td className={cn("px-3 py-1 text-right",
                    r.delivPer >= 60 ? "text-green-400" : r.delivPer >= 30 ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {fmt(r.delivPer)}%
                  </td>
                  <td className="px-3 py-1 text-right text-muted-foreground">{fmtInt(r.trades)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-3 py-2 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground">
          <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {fmtInt(filtered.length)}</span>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  "w-6 h-6 flex items-center justify-center rounded-sm border text-[10px] transition-colors",
                  page === p ? "border-primary bg-primary/15 text-primary" : "border-border hover:border-muted-foreground"
                )}
              >
                {p}
              </button>
            ))}
            {totalPages > 10 && <span className="px-1">…{totalPages}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
