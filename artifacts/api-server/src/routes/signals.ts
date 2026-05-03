import { Router, type IRouter } from "express";
import { GetSignalsQueryParams, GetSignalParams } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { signals } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { nvidia, NVIDIA_MODEL } from "../lib/nvidia";
import { computeTechnicals } from "./analysis";

const router: IRouter = Router();

router.get("/signals", async (req, res) => {
  try {
    const query = GetSignalsQueryParams.parse(req.query);

    const allSignals = await db.select().from(signals).orderBy(desc(signals.createdAt));

    const filtered = allSignals.filter((s) => {
      if (query.type && query.type !== "ALL" && s.instrumentType !== query.type)
        return false;
      if (
        query.action &&
        query.action !== "ALL" &&
        s.action !== query.action
      )
        return false;
      if (
        query.status &&
        query.status !== "ALL" &&
        s.status !== query.status
      )
        return false;
      return true;
    });

    res.json(
      filtered.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt?.toISOString() ?? null,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to fetch signals");
    res.status(500).json({ error: "Failed to fetch signals" });
  }
});

router.get("/signals/:id", async (req, res) => {
  try {
    const params = GetSignalParams.parse({ id: req.params.id });
    const [signal] = await db
      .select()
      .from(signals)
      .where(eq(signals.id, params.id));

    if (!signal) {
      res.status(404).json({ error: "Signal not found" });
      return;
    }

    res.json({
      ...signal,
      createdAt: signal.createdAt.toISOString(),
      expiresAt: signal.expiresAt?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch signal");
    res.status(500).json({ error: "Failed to fetch signal" });
  }
});

router.post("/signals/generate", async (req, res) => {
  try {
    const { symbols = [], timeframe = "INTRADAY" } = req.body as {
      symbols?: string[];
      timeframe?: string;
    };

    const targetSymbols =
      symbols.length > 0
        ? symbols
        : ["NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "HDFCBANK"];

    const newSignals = [];

    for (const symbol of targetSymbols.slice(0, 5)) {
      try {
        // Get technical analysis
        let techData: any = null;
        try {
          techData = await computeTechnicals(symbol);
        } catch {
          continue;
        }

        // Use AI to generate a trading signal
        const systemPrompt = `You are an expert Indian stock market technical analyst. Based on the provided technical indicators, generate precise trading signals for NSE/BSE instruments. 
Always respond with valid JSON only. No markdown, no explanation outside JSON.`;

        const userPrompt = `Analyze ${symbol} and generate a trading signal based on this data:
RSI: ${techData.rsi ?? "N/A"}
MACD: ${JSON.stringify(techData.macd)}
Trend: ${techData.trend}
Overall Signal: ${techData.overallSignal}
Signal Strength: ${techData.signalStrength}%
SMA20: ${techData.sma20}, SMA50: ${techData.sma50}
Stochastic: ${JSON.stringify(techData.stochastic)}
Timeframe: ${timeframe}

Generate a JSON signal with this exact structure:
{
  "action": "BUY" | "SELL" | "EXIT",
  "instrumentType": "STOCK" | "OPTIONS" | "FUTURES",
  "displayText": "e.g. BUY NIFTY FUTURES @ 22500 or BUY RELIANCE 2800 CE",
  "entryPrice": number or null,
  "targetPrice": number or null,
  "stopLoss": number or null,
  "confidence": 0-100,
  "rationale": "concise 1-2 sentence rationale"
}`;

        const response = await nvidia.chat.completions.create({
          model: NVIDIA_MODEL,
          max_tokens: 1024,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });

        const content = response.choices[0]?.message?.content?.trim() ?? "";
        let signalData: any;

        try {
          // Extract JSON from response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          signalData = JSON.parse(jsonMatch?.[0] ?? content);
        } catch {
          continue;
        }

        const now = new Date();
        const istOffsetMs = 5.5 * 60 * 60 * 1000;
        const nowIST = new Date(now.getTime() + istOffsetMs);
        let expiresAt: Date;
        if (timeframe === "INTRADAY") {
          // Market closes at 15:30 IST = 10:00 UTC
          expiresAt = new Date(Date.UTC(
            nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(),
            10, 0, 0, 0
          ));
          // If market close has already passed today, set to next trading day
          if (expiresAt <= now) {
            expiresAt = new Date(expiresAt.getTime() + 24 * 60 * 60 * 1000);
            // Skip weekend: if Saturday(6) advance to Monday, if Sunday(7) advance to Monday
            const day = expiresAt.getUTCDay();
            if (day === 6) expiresAt = new Date(expiresAt.getTime() + 2 * 24 * 60 * 60 * 1000);
            else if (day === 0) expiresAt = new Date(expiresAt.getTime() + 1 * 24 * 60 * 60 * 1000);
          }
        } else if (timeframe === "SWING") {
          expiresAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
        } else {
          expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        }

        const [inserted] = await db
          .insert(signals)
          .values({
            symbol,
            instrumentType: signalData.instrumentType || "STOCK",
            action: signalData.action || "HOLD",
            displayText: signalData.displayText || `${signalData.action} ${symbol}`,
            entryPrice: signalData.entryPrice ?? null,
            targetPrice: signalData.targetPrice ?? null,
            stopLoss: signalData.stopLoss ?? null,
            confidence: Math.min(100, Math.max(0, signalData.confidence ?? 50)),
            rationale: signalData.rationale || "Technical analysis signal",
            status: "ACTIVE",
            timeframe,
            expiresAt,
          })
          .returning();

        newSignals.push({
          ...inserted,
          createdAt: inserted.createdAt.toISOString(),
          expiresAt: inserted.expiresAt?.toISOString() ?? null,
        });
      } catch (err) {
        req.log.warn({ err, symbol }, "Failed to generate signal for symbol");
      }
    }

    res.json(newSignals);
  } catch (err) {
    req.log.error({ err }, "Failed to generate signals");
    res.status(500).json({ error: "Failed to generate signals" });
  }
});

export default router;
