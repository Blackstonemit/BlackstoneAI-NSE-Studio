import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { signals } from "@workspace/db";
import { computeTechnicals } from "./analysis";

const router: IRouter = Router();

router.post("/openai/agent/analyze", async (req, res) => {
  try {
    const { symbol, instrumentType = "STOCK", timeframe = "INTRADAY" } =
      req.body as { symbol: string; instrumentType?: string; timeframe?: string };

    if (!symbol) {
      res.status(400).json({ error: "symbol is required" });
      return;
    }

    // Get technical analysis first
    let techData: any = null;
    try {
      techData = await computeTechnicals(symbol.toUpperCase());
    } catch (err) {
      req.log.warn({ err, symbol }, "Could not fetch technical data");
    }

    const techContext = techData
      ? `
Technical Indicators for ${symbol}:
- RSI (14): ${techData.rsi ?? "N/A"}
- MACD: ${techData.macd ? `${techData.macd.macd.toFixed(2)} | Signal: ${techData.macd.signal.toFixed(2)} | Histogram: ${techData.macd.histogram.toFixed(2)}` : "N/A"}
- Bollinger Bands: ${techData.bollingerBands ? `Upper: ${techData.bollingerBands.upper} | Middle: ${techData.bollingerBands.middle} | Lower: ${techData.bollingerBands.lower}` : "N/A"}
- SMA 20/50/200: ${techData.sma20 ?? "N/A"} / ${techData.sma50 ?? "N/A"} / ${techData.sma200 ?? "N/A"}
- EMA 9/21: ${techData.ema9 ?? "N/A"} / ${techData.ema21 ?? "N/A"}
- ATR (14): ${techData.atr ?? "N/A"}
- Stochastic K/D: ${techData.stochastic ? `${techData.stochastic.k} / ${techData.stochastic.d}` : "N/A"}
- Computed Trend: ${techData.trend}
- Overall Signal: ${techData.overallSignal} (Strength: ${techData.signalStrength}%)`
      : `No technical data available for ${symbol}.`;

    const systemPrompt = `You are an elite Indian stock market analyst with deep expertise in NSE/BSE trading, 
technical analysis, and derivatives (options and futures). You analyze stocks, index options (NIFTY/BANKNIFTY), 
and futures. You provide precise, actionable signals with clear entry, target, and stop-loss levels.

IMPORTANT: Respond ONLY with valid JSON. No markdown fences, no explanations outside JSON.`;

    const userPrompt = `Perform a comprehensive technical analysis for ${symbol} (${instrumentType}) with ${timeframe} timeframe.

${techContext}

Respond with this exact JSON structure:
{
  "summary": "2-3 sentence technical analysis summary",
  "keyLevels": {
    "support": [level1, level2, level3],
    "resistance": [level1, level2, level3]
  },
  "signals": [
    {
      "action": "BUY" | "SELL" | "EXIT",
      "instrumentType": "${instrumentType}",
      "displayText": "clear signal text e.g. BUY NIFTY 22000 CE or SELL RELIANCE @ 2850",
      "entryPrice": number or null,
      "targetPrice": number or null,
      "stopLoss": number or null,
      "confidence": 0-100,
      "rationale": "concise 1-sentence rationale"
    }
  ],
  "riskAssessment": "1-2 sentences on risk assessment and position sizing advice"
}

Provide 1-3 specific, actionable signals. If ${instrumentType} is OPTIONS, suggest specific strike prices and expiries.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim() ?? "";

    let analysisResult: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysisResult = JSON.parse(jsonMatch?.[0] ?? content);
    } catch {
      res.status(500).json({ error: "AI returned invalid response" });
      return;
    }

    // Save generated signals to DB
    const savedSignals = [];
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const nowIST = new Date(now.getTime() + istOffsetMs);
    let expiresAt: Date;
    if (timeframe === "INTRADAY") {
      // 15:30 IST = 10:00 UTC
      expiresAt = new Date(Date.UTC(
        nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(),
        10, 0, 0, 0
      ));
    } else if (timeframe === "SWING") {
      expiresAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
    } else {
      expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    for (const sig of analysisResult.signals ?? []) {
      try {
        const [saved] = await db
          .insert(signals)
          .values({
            symbol: symbol.toUpperCase(),
            instrumentType: sig.instrumentType || instrumentType,
            action: sig.action,
            displayText: sig.displayText,
            entryPrice: sig.entryPrice ?? null,
            targetPrice: sig.targetPrice ?? null,
            stopLoss: sig.stopLoss ?? null,
            confidence: Math.min(100, Math.max(0, sig.confidence ?? 50)),
            rationale: sig.rationale || "",
            status: "ACTIVE",
            timeframe,
            expiresAt,
          })
          .returning();

        savedSignals.push({
          ...saved,
          createdAt: saved.createdAt.toISOString(),
          expiresAt: saved.expiresAt?.toISOString() ?? null,
        });
      } catch {
        // Skip if signal save fails
      }
    }

    res.json({
      symbol: symbol.toUpperCase(),
      summary: analysisResult.summary ?? "",
      keyLevels: analysisResult.keyLevels ?? { support: [], resistance: [] },
      signals: savedSignals,
      riskAssessment: analysisResult.riskAssessment ?? "",
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to run agent analysis");
    res.status(500).json({ error: "Failed to run agent analysis" });
  }
});

export default router;
