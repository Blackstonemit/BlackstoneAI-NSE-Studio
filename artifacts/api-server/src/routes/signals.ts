import { Router, type IRouter } from "express";
import { GetSignalsQueryParams, GetSignalParams } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { signals } from "@workspace/db";
import { eq, and, ne } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import { computeTechnicals } from "./analysis";

const router: IRouter = Router();

router.get("/signals", async (req, res) => {
  try {
    const query = GetSignalsQueryParams.parse(req.query);

    const allSignals = await db.select().from(signals).orderBy(signals.createdAt);

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
      filtered.reverse().map((s) => ({
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

        const response = await openai.chat.completions.create({
          model: "gpt-5-mini",
          max_completion_tokens: 500,
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

        const expiresAt = new Date();
        if (timeframe === "INTRADAY") {
          expiresAt.setHours(15, 30, 0, 0);
        } else if (timeframe === "SWING") {
          expiresAt.setDate(expiresAt.getDate() + 5);
        } else {
          expiresAt.setDate(expiresAt.getDate() + 30);
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
