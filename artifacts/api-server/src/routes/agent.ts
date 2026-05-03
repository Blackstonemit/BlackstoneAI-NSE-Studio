import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { signals } from "@workspace/db";
import { computeTechnicals } from "./analysis";
import { callWithFallback } from "../lib/multi-ai";

const router: IRouter = Router();

const STYLE_PROMPT: Record<string, string> = {
  conservative:
    "Prefer high-confidence, well-confirmed signals only. Use tight stop-losses and conservative targets. Require multiple indicator alignment before generating a signal. If confidence is below 65%, do not include the signal.",
  moderate:
    "Balance risk and reward. Include signals that have moderate confirmation. Standard stop-loss and target levels. Include signals with confidence above 50%.",
  aggressive:
    "Include all noteworthy signals even if early or less confirmed. Wider targets, higher risk tolerance. Active traders want more signals. Include signals with confidence above 35%.",
};

router.post("/openai/agent/analyze", async (req, res) => {
  try {
    const {
      symbol,
      instrumentType = "STOCK",
      timeframe = "INTRADAY",
      numSignals = 2,
      maxTokens = 2048,
      style = "moderate",
      customContext = "",
      confidenceThreshold = 0,
      saveSignals: doSaveSignals = true,
    } = req.body as {
      symbol: string;
      instrumentType?: string;
      timeframe?: string;
      numSignals?: number;
      maxTokens?: number;
      style?: string;
      customContext?: string;
      confidenceThreshold?: number;
      saveSignals?: boolean;
    };

    if (!symbol) {
      res.status(400).json({ error: "symbol is required" });
      return;
    }

    const clampedNumSignals = Math.min(5, Math.max(1, Number(numSignals) || 2));
    const clampedTokens = Math.min(4096, Math.max(512, Number(maxTokens) || 2048));
    const clampedThreshold = Math.min(90, Math.max(0, Number(confidenceThreshold) || 0));
    const styleKey = ["conservative", "moderate", "aggressive"].includes(style) ? style : "moderate";

    let techData: any = null;
    try {
      techData = await computeTechnicals(symbol.toUpperCase());
    } catch (err) {
      req.log.warn({ err, symbol }, "Could not fetch technical data");
    }

    const techContext = techData
      ? `Technical Indicators for ${symbol}:
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

    const styleInstruction = STYLE_PROMPT[styleKey];

    const systemPrompt = `You are an elite Indian stock market analyst with deep expertise in NSE/BSE trading, technical analysis, and derivatives (options and futures). You analyze stocks, index options (NIFTY/BANKNIFTY), and futures. You provide precise, actionable signals with clear entry, target, and stop-loss levels.

Trading Style: ${styleKey.toUpperCase()} — ${styleInstruction}

IMPORTANT: Respond ONLY with valid JSON. No markdown fences, no explanations outside JSON.`;

    const customSection = customContext?.trim()
      ? `\n\nAdditional context from the user:\n${customContext.trim()}`
      : "";

    const userPrompt = `Perform a comprehensive technical analysis for ${symbol} (${instrumentType}) with ${timeframe} timeframe.

${techContext}${customSection}

Generate exactly ${clampedNumSignals} signal(s) that reflect a ${styleKey} trading approach.

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

If ${instrumentType} is OPTIONS, suggest specific strike prices and expiries. Only include signals with confidence >= ${clampedThreshold}.`;

    const { content, provider: usedProvider } = await callWithFallback(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: clampedTokens }
    );

    let analysisResult: any;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysisResult = JSON.parse(jsonMatch?.[0] ?? content);
    } catch {
      res.status(500).json({ error: "AI returned invalid response" });
      return;
    }

    const rawSignals: any[] = analysisResult.signals ?? [];
    const filteredSignals = rawSignals.filter(
      (s) => (s.confidence ?? 0) >= clampedThreshold
    );

    const savedSignals = [];
    if (doSaveSignals) {
      const now = new Date();
      const istOffsetMs = 5.5 * 60 * 60 * 1000;
      const nowIST = new Date(now.getTime() + istOffsetMs);
      let expiresAt: Date;
      if (timeframe === "INTRADAY") {
        expiresAt = new Date(Date.UTC(
          nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate(), 10, 0, 0, 0
        ));
        if (expiresAt <= now) {
          expiresAt = new Date(expiresAt.getTime() + 24 * 60 * 60 * 1000);
          const day = expiresAt.getUTCDay();
          if (day === 6) expiresAt = new Date(expiresAt.getTime() + 2 * 24 * 60 * 60 * 1000);
          else if (day === 0) expiresAt = new Date(expiresAt.getTime() + 1 * 24 * 60 * 60 * 1000);
        }
      } else if (timeframe === "SWING") {
        expiresAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
      } else {
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      for (const sig of filteredSignals) {
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
    }

    res.json({
      symbol: symbol.toUpperCase(),
      summary: analysisResult.summary ?? "",
      keyLevels: analysisResult.keyLevels ?? { support: [], resistance: [] },
      signals: doSaveSignals ? savedSignals : filteredSignals.map((s) => ({
        ...s,
        confidence: Math.min(100, Math.max(0, s.confidence ?? 50)),
      })),
      riskAssessment: analysisResult.riskAssessment ?? "",
      generatedAt: new Date().toISOString(),
      meta: {
        style: styleKey,
        timeframe,
        instrumentType,
        numRequested: clampedNumSignals,
        numGenerated: rawSignals.length,
        numAfterFilter: filteredSignals.length,
        confidenceThreshold: clampedThreshold,
        savedToDb: doSaveSignals,
        provider: usedProvider,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to run agent analysis");
    res.status(500).json({ error: "Failed to run agent analysis" });
  }
});

export default router;
