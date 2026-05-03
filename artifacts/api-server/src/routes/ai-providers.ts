import { Router, type IRouter } from "express";
import { getProvidersStatus, saveProviderKey, toggleProvider } from "../lib/multi-ai";

const router: IRouter = Router();

const DB_PROVIDERS = ["openai", "claude", "gemini"] as const;
type DbProvider = (typeof DB_PROVIDERS)[number];

function isDbProvider(p: string): p is DbProvider {
  return (DB_PROVIDERS as readonly string[]).includes(p);
}

router.get("/ai-providers/status", async (req, res) => {
  try {
    const status = await getProvidersStatus();
    res.json(status);
  } catch (err) {
    req.log.error({ err }, "Failed to get provider status");
    res.status(500).json({ error: "Failed to get provider status" });
  }
});

router.post("/ai-providers/:provider/key", async (req, res) => {
  try {
    const { provider } = req.params;
    if (!isDbProvider(provider)) {
      res.status(400).json({ error: "Invalid provider. Must be openai, claude, or gemini." });
      return;
    }
    const { apiKey } = req.body as { apiKey?: string };
    if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 8) {
      res.status(400).json({ error: "Invalid API key" });
      return;
    }
    await saveProviderKey(provider, apiKey.trim());
    res.json({ success: true, provider });
  } catch (err) {
    req.log.error({ err }, "Failed to save provider key");
    res.status(500).json({ error: "Failed to save provider key" });
  }
});

router.patch("/ai-providers/:provider/toggle", async (req, res) => {
  try {
    const { provider } = req.params;
    if (!isDbProvider(provider)) {
      res.status(400).json({ error: "Invalid provider" });
      return;
    }
    const { enabled } = req.body as { enabled?: boolean };
    if (typeof enabled !== "boolean") {
      res.status(400).json({ error: "enabled must be boolean" });
      return;
    }
    await toggleProvider(provider, enabled);
    res.json({ success: true, provider, enabled });
  } catch (err) {
    req.log.error({ err }, "Failed to toggle provider");
    res.status(500).json({ error: "Failed to toggle provider" });
  }
});

export default router;
