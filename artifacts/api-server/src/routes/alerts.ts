import { Router, type IRouter } from "express";
import { CreateAlertBody, DeleteAlertParams } from "@workspace/api-zod";
import { db, alerts } from "@workspace/db";
import { desc, eq } from "drizzle-orm";

const router: IRouter = Router();

function serialize(alert: typeof alerts.$inferSelect) {
  return {
    ...alert,
    triggeredAt: alert.triggeredAt ? alert.triggeredAt.toISOString() : null,
    createdAt: alert.createdAt.toISOString(),
  };
}

router.get("/alerts", async (req, res) => {
  try {
    const items = await db.select().from(alerts).orderBy(desc(alerts.createdAt));
    res.json(items.map(serialize));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch alerts");
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

router.post("/alerts", async (req, res) => {
  try {
    const body = CreateAlertBody.parse(req.body);
    const [item] = await db
      .insert(alerts)
      .values({
        symbol: body.symbol.toUpperCase(),
        name: body.name,
        condition: body.condition,
        targetPrice: body.targetPrice,
      })
      .returning();

    res.status(201).json(serialize(item));
  } catch (err) {
    req.log.error({ err }, "Failed to create alert");
    res.status(500).json({ error: "Failed to create alert" });
  }
});

router.delete("/alerts/:id", async (req, res) => {
  try {
    const params = DeleteAlertParams.parse({ id: req.params.id });
    await db.delete(alerts).where(eq(alerts.id, params.id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete alert");
    res.status(500).json({ error: "Failed to delete alert" });
  }
});

export default router;
