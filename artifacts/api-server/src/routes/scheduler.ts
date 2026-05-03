import { Router, type IRouter } from "express";
import {
  getSchedulerStatus,
  expireStaleSignals,
  autoGenerateSignals,
} from "../lib/scheduler";

const router: IRouter = Router();

router.get("/scheduler/status", (_req, res) => {
  res.json(getSchedulerStatus());
});

router.post("/scheduler/expire", async (req, res) => {
  try {
    const count = await expireStaleSignals();
    res.json({ expired: count });
  } catch (err) {
    req.log.error({ err }, "Manual expire failed");
    res.status(500).json({ error: "Expire failed" });
  }
});

router.post("/scheduler/generate", async (req, res) => {
  try {
    const { symbols } = req.body as { symbols?: string[] };
    const count = await autoGenerateSignals(symbols ?? []);
    res.json({ generated: count });
  } catch (err) {
    req.log.error({ err }, "Manual generate failed");
    res.status(500).json({ error: "Generate failed" });
  }
});

export default router;
