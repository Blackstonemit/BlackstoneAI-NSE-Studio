import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const providerSettings = pgTable("provider_settings", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().unique(),
  apiKey: text("api_key"),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProviderSettingsSchema = createInsertSchema(providerSettings).omit({ id: true, updatedAt: true });
export type ProviderSetting = typeof providerSettings.$inferSelect;
export type InsertProviderSetting = z.infer<typeof insertProviderSettingsSchema>;
