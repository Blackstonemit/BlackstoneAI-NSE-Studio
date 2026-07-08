import { pgTable, text, serial, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  condition: text("condition").notNull(),
  targetPrice: real("target_price").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  triggeredAt: timestamp("triggered_at"),
  triggeredPrice: real("triggered_price"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
  status: true,
  triggeredAt: true,
  triggeredPrice: true,
  createdAt: true,
});
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;
