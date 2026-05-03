import { db } from "@workspace/db";
import { signals } from "@workspace/db";
import { lt, eq, and } from "drizzle-orm";
import { logger } from "./logger";
import { nvidia, NVIDIA_MODEL } from "./nvidia";
import { computeTechnicals } from "../routes/analysis";

function isMarketHoursIST(): boolean {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return mins >= 9 * 60 + 15 && mins < 15 * 60 + 30;
}

function nextTradingDayEnd(): Date {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(now.getTime() + istOffsetMs);
  let expiry = new Date(Date.UTC(
    nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 10, 0, 0, 0
  ));
  if (expiry <= now) {
    expiry = new Date(expiry.getTime() + 24 * 60 * 60 * 1000);
    const d = expiry.getUTCDay();
    if (d === 6) expiry = new Date(expiry.getTime() + 2 * 86400000);
    else if (d === 0) expiry = new Date(expiry.getTime() + 86400000);
  }
  return expiry;
}

export type SchedulerStatus = {
  isRunning: boolean;
  lastExpiry: string | null;
  lastGenerate: string | null;
  nextGenerate: string | null;
  signalsExpired: number;
  signalsGenerated: number;
  lastErrors: string[];
  marketOpen: boolean;
};

const status: SchedulerStatus = {
  isRunning: false,
  lastExpiry: null,
  lastGenerate: null,
  nextGenerate: null,
  signalsExpired: 0,
  signalsGenerated: 0,
  lastErrors: [],
  marketOpen: false,
};

const EXPIRY_INTERVAL_MS = 5 * 60 * 1000;
const GENERATE_INTERVAL_MS = 30 * 60 * 1000;

let expiryTimer: ReturnType<typeof setInterval> | null = null;
let generateTimer: ReturnType<typeof setInterval> | null = null;

function pushError(msg: string) {
  status.lastErrors.push(msg);
  if (status.lastErrors.length > 5) status.lastErrors.shift();
}

export async function expireStaleSignals(): Promise<number> {
  try {
    const expired = await db
      .update(signals)
      .set({ status: "EXPIRED" })
      .where(and(lt(signals.expiresAt, new Date()), eq(signals.status, "ACTIVE")))
      .returning({ id: signals.id });

    if (expired.length > 0) {
      status.signalsExpired += expired.length;
      logger.info({ count: expired.length }, "Auto-expired stale signals");
    }
    status.lastExpiry = new Date().toISOString();
    return expired.length;
  } catch (err) {
    logger.error({ err }, "Signal expiry job failed");
    pushError(`expiry: ${String(err)}`);
    return 0;
  }
}

export async function autoGenerateSignals(symbols: string[]): Promise<number> {
  status.marketOpen = isMarketHoursIST();
  if (!status.marketOpen) {
    logger.info("Auto-generate skipped: outside market hours");
    return 0;
  }

  logger.info({ symbols }, "Scheduler: auto-generating AI signals");
  let count = 0;

  for (const symbol of symbols.slice(0, 5)) {
    try {
      let techData: Record<string, unknown> | null = null;
      try {
        techData = await computeTechnicals(symbol);
      } catch {
        continue;
      }

      const systemPrompt = `You are an expert Indian stock market technical analyst. Based on the provided technical indicators, generate a precise trading signal for NSE/BSE instruments. Always respond with valid JSON only. No markdown, no explanation outside JSON.`;
      const userPrompt = `Analyze ${symbol} and generate ONE trading signal based on this data:
RSI: ${techData?.rsi ?? "N/A"}, Trend: ${techData?.trend}, Overall Signal: ${techData?.overallSignal}, Strength: ${techData?.signalStrength}%
SMA20: ${techData?.sma20}, SMA50: ${techData?.sma50}, MACD: ${JSON.stringify(techData?.macd)}
Timeframe: INTRADAY

Respond with exactly this JSON:
{"action":"BUY"|"SELL"|"EXIT","instrumentType":"STOCK"|"OPTIONS"|"FUTURES","displayText":"e.g. BUY NIFTY @ 22500","entryPrice":number|null,"targetPrice":number|null,"stopLoss":number|null,"confidence":0-100,"rationale":"1 sentence"}`;

      const response = await nvidia.chat.completions.create({
        model: NVIDIA_MODEL,
        max_tokens: 512,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = response.choices[0]?.message?.content?.trim() ?? "";
      let sig: Record<string, unknown>;
      try {
        const m = content.match(/\{[\s\S]*\}/);
        sig = JSON.parse(m?.[0] ?? content) as Record<string, unknown>;
      } catch {
        continue;
      }

      await db.insert(signals).values({
        symbol,
        instrumentType: String(sig.instrumentType || "STOCK"),
        action: String(sig.action || "HOLD"),
        displayText: String(sig.displayText || `${sig.action} ${symbol}`),
        entryPrice: (sig.entryPrice as number | null) ?? null,
        targetPrice: (sig.targetPrice as number | null) ?? null,
        stopLoss: (sig.stopLoss as number | null) ?? null,
        confidence: Math.min(100, Math.max(0, Number(sig.confidence ?? 50))),
        rationale: String(sig.rationale || "Scheduled auto-generated signal"),
        status: "ACTIVE",
        timeframe: "INTRADAY",
        expiresAt: nextTradingDayEnd(),
      });

      count++;
      status.signalsGenerated++;
    } catch (err) {
      logger.warn({ err, symbol }, "Scheduler: signal generation failed for symbol");
      pushError(`generate ${symbol}: ${String(err)}`);
    }
  }

  status.lastGenerate = new Date().toISOString();
  status.nextGenerate = new Date(Date.now() + GENERATE_INTERVAL_MS).toISOString();
  logger.info({ count }, "Scheduler: auto-generate cycle done");
  return count;
}

const DEFAULT_SYMBOLS = ["NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "HDFCBANK"];
let schedulerSymbols: string[] = DEFAULT_SYMBOLS;

export function startScheduler(symbols: string[] = DEFAULT_SYMBOLS) {
  if (status.isRunning) return;
  schedulerSymbols = symbols.length > 0 ? symbols : DEFAULT_SYMBOLS;
  status.isRunning = true;
  status.marketOpen = isMarketHoursIST();

  void expireStaleSignals();
  expiryTimer = setInterval(() => void expireStaleSignals(), EXPIRY_INTERVAL_MS);

  status.nextGenerate = new Date(Date.now() + GENERATE_INTERVAL_MS).toISOString();
  generateTimer = setInterval(() => void autoGenerateSignals(schedulerSymbols), GENERATE_INTERVAL_MS);

  logger.info({ symbols: schedulerSymbols }, "Scheduler started");
}

export function stopScheduler() {
  if (expiryTimer) { clearInterval(expiryTimer); expiryTimer = null; }
  if (generateTimer) { clearInterval(generateTimer); generateTimer = null; }
  status.isRunning = false;
  logger.info("Scheduler stopped");
}

export function getSchedulerStatus(): SchedulerStatus {
  return { ...status, marketOpen: isMarketHoursIST() };
}
