import OpenAI from "openai";
import { db, providerSettings } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export type AIProvider = "nvidia" | "openai" | "gemini";

export type AIMessage = { role: "system" | "user" | "assistant"; content: string };

export type AICompletionResult = {
  content: string;
  provider: AIProvider;
};

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

const PROVIDER_MODELS: Record<AIProvider, string> = {
  nvidia: process.env["NVIDIA_MODEL"] ?? "qwen/qwen3.5-122b-a10b",
  openai: "gpt-4o-mini",
  gemini: "gemini-1.5-flash",
};

function makeClient(provider: AIProvider, apiKey: string): OpenAI {
  if (provider === "nvidia") {
    return new OpenAI({ apiKey, baseURL: NVIDIA_BASE_URL });
  }
  if (provider === "gemini") {
    return new OpenAI({ apiKey, baseURL: GEMINI_BASE_URL });
  }
  return new OpenAI({ apiKey });
}

async function getProviderKey(provider: AIProvider): Promise<string | null> {
  if (provider === "nvidia") {
    return process.env["NVIDIA_API_KEY"] ?? null;
  }
  try {
    const [row] = await db
      .select()
      .from(providerSettings)
      .where(eq(providerSettings.provider, provider));
    if (!row?.enabled || !row?.apiKey) return null;
    return row.apiKey;
  } catch {
    return null;
  }
}

export async function callWithFallback(
  messages: AIMessage[],
  options: { maxTokens?: number } = {}
): Promise<AICompletionResult> {
  const order: AIProvider[] = ["nvidia", "openai", "gemini"];

  for (const provider of order) {
    const apiKey = await getProviderKey(provider);
    if (!apiKey) {
      logger.debug({ provider }, "AI provider not configured, skipping");
      continue;
    }

    try {
      const client = makeClient(provider, apiKey);
      const model = PROVIDER_MODELS[provider];

      const response = await client.chat.completions.create({
        model,
        max_tokens: options.maxTokens ?? 2048,
        messages: messages as Parameters<typeof client.chat.completions.create>[0]["messages"],
      });

      const content = response.choices[0]?.message?.content?.trim() ?? "";
      if (!content) throw new Error("Empty response");

      logger.info({ provider, model }, "AI call succeeded");
      return { content, provider };
    } catch (err) {
      logger.warn({ err, provider }, "AI provider failed, trying next");
    }
  }

  throw new Error("All AI providers failed or are not configured");
}

export async function getProvidersStatus(): Promise<
  Array<{ provider: AIProvider; configured: boolean; enabled: boolean; isDefault: boolean }>
> {
  const dbRows = await db.select().from(providerSettings).catch(() => []);
  const dbMap = new Map(dbRows.map((r) => [r.provider, r]));

  const nvidiaKey = process.env["NVIDIA_API_KEY"];
  const providers: AIProvider[] = ["nvidia", "openai", "gemini"];

  return providers.map((p, idx) => {
    if (p === "nvidia") {
      return { provider: p, configured: !!nvidiaKey, enabled: true, isDefault: idx === 0 };
    }
    const row = dbMap.get(p);
    return {
      provider: p,
      configured: !!(row?.apiKey),
      enabled: row?.enabled ?? false,
      isDefault: false,
    };
  });
}

export async function saveProviderKey(
  provider: "openai" | "gemini",
  apiKey: string
): Promise<void> {
  await db
    .insert(providerSettings)
    .values({ provider, apiKey, enabled: true })
    .onConflictDoUpdate({
      target: providerSettings.provider,
      set: { apiKey, enabled: true, updatedAt: new Date() },
    });
}

export async function toggleProvider(
  provider: "openai" | "gemini",
  enabled: boolean
): Promise<void> {
  await db
    .insert(providerSettings)
    .values({ provider, enabled, apiKey: null })
    .onConflictDoUpdate({
      target: providerSettings.provider,
      set: { enabled, updatedAt: new Date() },
    });
}
