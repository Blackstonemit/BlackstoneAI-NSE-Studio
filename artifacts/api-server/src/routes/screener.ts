import { Router, type IRouter } from "express";
import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new (YahooFinanceClass as any)();
import { computeTechnicals } from "./analysis";
import { callWithFallback } from "../lib/multi-ai";
import { extractFirstJSON } from "../lib/json-extract";

const router: IRouter = Router();

const SCREENER_PRESETS: Record<string, { query: string; criteria: string; symbols: string[] }> = {
  multibagger: {
    query: "Market Capitalization < 500 AND Current Price < 100 AND EPS > 0 AND \"Sales growth 5Years\" > 15 AND \"Profit growth 5years\" > 15",
    criteria: "Market Cap < ₹500Cr, Price < ₹100, EPS > 0, 5yr Sales Growth > 15%, 5yr Profit Growth > 15%",
    symbols: [
      "RVNL.NS", "IRFC.NS", "HAL.NS", "BEL.NS", "CDSL.NS",
      "IRCON.NS", "RITES.NS", "NBCC.NS", "SJVN.NS", "NHPC.NS",
      "PNBHOUSING.NS", "KARURVYSYA.NS", "SOUTHBANK.NS", "FEDERALBNK.NS",
      "TATAELXSI.NS", "PERSISTENT.NS", "COFORGE.NS", "MPHASIS.NS",
      "ZOMATO.NS", "NYKAA.NS", "POLICYBZR.NS",
      "SUZLON.NS", "INOXWIND.NS", "ORIENTELEC.NS", "KPITTECH.NS",
    ],
  },
  penny: {
    query: "Market Capitalization < 100 AND Current Price < 20",
    criteria: "Market Cap < ₹100Cr, Price < ₹20",
    symbols: [
      "SUZLON.NS", "YAARI.NS", "ORIENTELEC.NS", "RBLBANK.NS", "IDEA.NS",
      "JBCHEPHARM.NS", "STELMON.NS", "PRECWIRE.NS", "GTLINFRA.NS",
      "OPTIEMUS.NS", "CERA.NS", "JTLIND.NS", "TAPIFRUIT.NS", "PAYTM.NS",
    ],
  },
  turnaround: {
    query: "Market Capitalization < 1000 AND \"Profit growth 5years\" > 20 AND \"Debt to equity\" < 1",
    criteria: "Market Cap < ₹1000Cr, 5yr Profit Growth > 20%, Debt/Equity < 1",
    symbols: [
      "BALRAMCHIN.NS", "DHAMPUR.NS", "TRIVENI.NS", "GMRINFRA.NS",
      "JPPOWER.NS", "ADANIPOWER.NS", "RELPOWER.NS", "THERMAX.NS",
      "CESC.NS", "KALPATPOWR.NS", "TORNTPOWER.NS", "TATAPOWER.NS",
      "RECLTD.NS", "PFC.NS", "IREDA.NS",
    ],
  },
  growth: {
    query: "Market Capitalization < 2000 AND \"Sales growth 5Years\" > 25 AND ROCE > 20",
    criteria: "Market Cap < ₹2000Cr, 5yr Sales Growth > 25%, ROCE > 20%",
    symbols: [
      "ASTRAL.NS", "POLYCAB.NS", "DIXON.NS", "AMBER.NS", "DMART.NS",
      "LAXMIMACH.NS", "ELGIEQUIP.NS", "GRINDWELL.NS", "SUPRAJIT.NS",
      "GARFIBRES.NS", "VARROC.NS", "ENDURANCE.NS", "MUTHOOTFIN.NS",
      "CHOLAFIN.NS", "AAVAS.NS",
    ],
  },
};

interface ScreenerStock {
  symbol: string;
  name: string;
  currentPrice: number;
  marketCap: number;
  pe: number | null;
  eps: number | null;
  roe: number | null;
  salesGrowth5yr: number | null;
  profitGrowth5yr: number | null;
  weekHigh52: number | null;
  weekLow52: number | null;
  change: number;
  changePercent: number;
  multibaggerScore: number;
  rsi: number | null;
  screenerUrl: string;
  dataSource: string;
}

function calcMultibaggerScore(stock: {
  pe: number | null;
  eps: number | null;
  roe: number | null;
  salesGrowth5yr: number | null;
  profitGrowth5yr: number | null;
  changePercent: number;
  marketCap: number;
}): number {
  let score = 50;
  if (stock.salesGrowth5yr != null) score += Math.min(20, stock.salesGrowth5yr * 0.5);
  if (stock.profitGrowth5yr != null) score += Math.min(20, stock.profitGrowth5yr * 0.5);
  if (stock.roe != null) score += Math.min(10, stock.roe * 0.3);
  if (stock.pe != null && stock.pe > 0 && stock.pe < 20) score += 10;
  else if (stock.pe != null && stock.pe >= 20 && stock.pe < 35) score += 5;
  if (stock.eps != null && stock.eps > 0) score += 5;
  if (stock.marketCap < 500) score += 5;
  score = Math.max(0, Math.min(100, score));
  return Math.round(score);
}

async function fetchFromScreenerIn(
  preset: string
): Promise<{ stocks: Array<Record<string, unknown>>; fromLive: boolean }> {
  const presetConfig = SCREENER_PRESETS[preset] ?? SCREENER_PRESETS.multibagger;
  const url = `https://www.screener.in/screen/raw/?sort=Market+Capitalization&order=asc&query=${encodeURIComponent(presetConfig.query)}&limit=40`;

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NSEBot/1.0)",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) throw new Error(`screener.in returned ${resp.status}`);
    const json = (await resp.json()) as { columns?: string[]; results?: unknown[][] };
    if (!json.columns || !json.results) throw new Error("Unexpected screener.in format");

    const cols = json.columns;
    const nameIdx = cols.findIndex((c) => /name|company/i.test(c));
    const priceIdx = cols.findIndex((c) => /price/i.test(c));
    const capIdx = cols.findIndex((c) => /cap/i.test(c));
    const peIdx = cols.findIndex((c) => /^p\/e|^pe/i.test(c));
    const roeIdx = cols.findIndex((c) => /roe/i.test(c));
    const salesGrowthIdx = cols.findIndex((c) => /sales.*5|5.*sales/i.test(c));
    const profitGrowthIdx = cols.findIndex((c) => /profit.*5|5.*profit/i.test(c));

    const rows = json.results.map((row: unknown[]) => ({
      rawName: String(row[nameIdx] ?? ""),
      currentPrice: Number(row[priceIdx] ?? 0),
      marketCap: Number(row[capIdx] ?? 0),
      pe: peIdx >= 0 ? Number(row[peIdx] ?? null) || null : null,
      roe: roeIdx >= 0 ? Number(row[roeIdx] ?? null) || null : null,
      salesGrowth5yr: salesGrowthIdx >= 0 ? Number(row[salesGrowthIdx] ?? null) || null : null,
      profitGrowth5yr: profitGrowthIdx >= 0 ? Number(row[profitGrowthIdx] ?? null) || null : null,
    }));

    return { stocks: rows, fromLive: true };
  } catch {
    return { stocks: [], fromLive: false };
  }
}

router.get("/market/screener", async (req, res) => {
  const preset = (req.query.preset as string) ?? "multibagger";
  const presetConfig = SCREENER_PRESETS[preset] ?? SCREENER_PRESETS.multibagger;

  try {
    const { stocks: liveRows, fromLive } = await fetchFromScreenerIn(preset);

    const symbolList = fromLive
      ? liveRows.slice(0, 20).map((r) => {
          const name = (r.rawName as string).toUpperCase().replace(/\s+/g, "");
          return `${name}.NS`;
        })
      : presetConfig.symbols;

    const stocks = (await Promise.all(
      symbolList.map(async (sym, i) => {
        try {
          const q = await yahooFinance.quote(sym);
          const price = q.regularMarketPrice ?? 0;
          if (!price) return null;

          const liveRow = fromLive ? (liveRows[i] ?? null) : null;
          const mcapCr = (q.marketCap ?? 0) / 1e7;
          const rawSym = sym.replace(".NS", "").replace(".BO", "");

          const pe: number | null = liveRow?.pe != null ? (liveRow.pe as number) : (q.trailingPE ?? null);
          const eps: number | null = q.epsTrailingTwelveMonths ?? null;
          const roe: number | null = liveRow?.roe != null ? (liveRow.roe as number) : null;
          const salesGrowth5yr: number | null = liveRow?.salesGrowth5yr != null ? (liveRow.salesGrowth5yr as number) : null;
          const profitGrowth5yr: number | null = liveRow?.profitGrowth5yr != null ? (liveRow.profitGrowth5yr as number) : null;

          const score = calcMultibaggerScore({
            pe, eps, roe, salesGrowth5yr, profitGrowth5yr,
            changePercent: q.regularMarketChangePercent ?? 0,
            marketCap: mcapCr,
          });

          return {
            symbol: rawSym,
            name: (q.longName ?? q.shortName ?? rawSym) as string,
            currentPrice: price,
            marketCap: mcapCr,
            pe, eps, roe, salesGrowth5yr, profitGrowth5yr,
            weekHigh52: q.fiftyTwoWeekHigh ?? null,
            weekLow52: q.fiftyTwoWeekLow ?? null,
            change: q.regularMarketChange ?? 0,
            changePercent: q.regularMarketChangePercent ?? 0,
            multibaggerScore: score,
            rsi: null,
            screenerUrl: `https://www.screener.in/company/${rawSym}/`,
            dataSource: fromLive ? "screener.in + Yahoo Finance" : "Yahoo Finance",
          } as ScreenerStock;
        } catch {
          return null;
        }
      })
    )).filter(Boolean) as ScreenerStock[];

    stocks.sort((a, b) => b.multibaggerScore - a.multibaggerScore);

    res.json({
      stocks: stocks.slice(0, 25),
      preset,
      criteria: presetConfig.criteria,
      fetchedAt: new Date().toISOString(),
      totalFound: stocks.length,
    });
  } catch (err) {
    req.log.error({ err }, "Screener fetch failed");
    res.status(500).json({ error: "Failed to fetch screener data" });
  }
});

router.post("/market/screener/analyze", async (req, res) => {
  const { symbols = [], preset = "multibagger" } = req.body as {
    symbols: string[];
    preset?: string;
  };

  if (!symbols.length) {
    res.status(400).json({ error: "symbols array required" });
    return;
  }

  try {
    const techResults = await Promise.allSettled(
      symbols.slice(0, 5).map(async (sym) => {
        const ticker = sym.includes(".") ? sym : `${sym}.NS`;
        try {
          const tech = await computeTechnicals(ticker);
          let q: Awaited<ReturnType<typeof yahooFinance.quote>> | null = null;
          try { q = await yahooFinance.quote(ticker); } catch { /* skip */ }

          const price = q?.regularMarketPrice ?? 0;
          const sma50 = tech.sma50 ?? 0;
          return {
            symbol: sym,
            name: q?.longName ?? sym,
            price,
            marketCap: (q?.marketCap ?? 0) / 1e7,
            pe: q?.trailingPE ?? null,
            rsi: tech.rsi,
            macd: tech.macd,
            trend: sma50 > 0 && price > sma50 ? "ABOVE SMA50" : "BELOW SMA50",
          };
        } catch {
          return { symbol: sym, name: sym, price: 0, marketCap: 0, pe: null, rsi: null, macd: null, trend: "N/A" };
        }
      })
    );

    const techData = techResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    const prompt = `You are an expert Indian stock market analyst specializing in identifying multibagger stocks — small-cap and mid-cap companies that can deliver 5-10x returns over 2-3 years.

Analyse these ${preset} screener candidates using technical + fundamental data:

${techData.map((s) => `
Symbol: ${s.symbol} | Name: ${s.name}
Price: ₹${s.price} | Market Cap: ₹${s.marketCap.toFixed(0)}Cr | PE: ${s.pe ?? "N/A"}
RSI(14): ${s.rsi ?? "N/A"} | MACD: ${s.macd ? `${s.macd.macd.toFixed(2)} vs Signal ${s.macd.signal.toFixed(2)}` : "N/A"}
Trend: ${s.trend}
`).join("\n")}

For each stock provide a multibagger analysis. Return ONLY this JSON (no markdown):
{
  "analyses": [
    {
      "symbol": "SYMBOL",
      "name": "Full Name",
      "verdict": "STRONG_BUY|BUY|HOLD|AVOID",
      "multibaggerPotential": "HIGH|MEDIUM|LOW",
      "targetPrice1yr": 150.0,
      "stopLoss": 45.0,
      "rationale": "2-3 sentence analysis including why this is/isn't a multibagger candidate",
      "risks": ["risk1", "risk2"],
      "catalysts": ["catalyst1", "catalyst2"],
      "confidence": 70
    }
  ],
  "summary": "Overall 2-3 sentence market summary of these multibagger candidates"
}`;

    const result = await callWithFallback([
      { role: "system", content: "You are an expert Indian stock market analyst. Return only valid JSON." },
      { role: "user", content: prompt },
    ], { maxTokens: 2000 });

    const parsed = extractFirstJSON(result.content) as {
      analyses: Array<{
        symbol: string;
        name: string;
        verdict: string;
        multibaggerPotential: string;
        targetPrice1yr: number | null;
        stopLoss: number | null;
        rationale: string;
        risks: string[];
        catalysts: string[];
        confidence: number;
      }>;
      summary: string;
    };

    res.json({
      analyses: parsed.analyses ?? [],
      summary: parsed.summary ?? "Analysis complete.",
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Screener AI analysis failed");
    res.status(500).json({ error: "AI analysis failed" });
  }
});

export default router;
