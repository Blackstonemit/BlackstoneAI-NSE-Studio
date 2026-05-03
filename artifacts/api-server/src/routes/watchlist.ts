import { Router, type IRouter } from "express";
import { AddToWatchlistBody, RemoveFromWatchlistParams } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { watchlist } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/watchlist", async (req, res) => {
  try {
    const items = await db.select().from(watchlist).orderBy(watchlist.addedAt);
    res.json(
      items.map((item) => ({
        ...item,
        addedAt: item.addedAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to fetch watchlist");
    res.status(500).json({ error: "Failed to fetch watchlist" });
  }
});

router.post("/watchlist", async (req, res) => {
  try {
    const body = AddToWatchlistBody.parse(req.body);
    const [item] = await db
      .insert(watchlist)
      .values({
        symbol: body.symbol.toUpperCase(),
        name: body.name,
        exchange: body.exchange ?? "NSE",
        instrumentType: body.instrumentType ?? "STOCK",
      })
      .returning();

    res.status(201).json({
      ...item,
      addedAt: item.addedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to add to watchlist");
    res.status(500).json({ error: "Failed to add to watchlist" });
  }
});

router.delete("/watchlist/:id", async (req, res) => {
  try {
    const params = RemoveFromWatchlistParams.parse({ id: req.params.id });
    await db.delete(watchlist).where(eq(watchlist.id, params.id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to remove from watchlist");
    res.status(500).json({ error: "Failed to remove from watchlist" });
  }
});

export default router;
