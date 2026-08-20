import { stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { notifyOwner } from "./notification";
import { ENV } from "./env";
import { adminProcedure, publicProcedure, router } from "./trpc";

export type IntegrationHealthStatus = "ok" | "degraded" | "down";

type IntegrationHealth = {
  brasilApi: IntegrationHealthStatus;
  storage: "ok" | "degraded";
};

const HEALTH_CACHE_MS = 15_000;
let cachedIntegrations: { checkedAt: string; value: IntegrationHealth } | null = null;

async function checkBrasilApi(): Promise<IntegrationHealthStatus> {
  try {
    const response = await fetch("https://brasilapi.com.br/api/cnpj/v1/00000000000191", {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(3_000),
    });
    if (response.ok) return "ok";
    if (response.status === 408 || response.status === 429 || response.status >= 500) {
      return "degraded";
    }
    return "down";
  } catch {
    return "down";
  }
}

async function checkStorage(): Promise<"ok" | "degraded"> {
  try {
    const storage = await stat(path.resolve(ENV.storageDir));
    return storage.isDirectory() ? "ok" : "degraded";
  } catch {
    return "degraded";
  }
}

async function readIntegrationHealth() {
  if (cachedIntegrations && Date.now() - Date.parse(cachedIntegrations.checkedAt) < HEALTH_CACHE_MS) {
    return cachedIntegrations;
  }

  const [brasilApi, storage] = await Promise.all([checkBrasilApi(), checkStorage()]);
  cachedIntegrations = {
    checkedAt: new Date().toISOString(),
    value: { brasilApi, storage },
  };
  return cachedIntegrations;
}

export const systemRouter = router({
  health: router({
    status: publicProcedure
      .input(
        z.object({
          timestamp: z.number().min(0, "timestamp cannot be negative"),
        }),
      )
      .query(() => ({
        ok: true,
      })),

    integrations: publicProcedure
      .input(z.object({ timestamp: z.number().min(0).optional() }).optional())
      .query(async () => {
        const result = await readIntegrationHealth();
        return {
          ...result.value,
          checkedAt: result.checkedAt,
        };
      }),
  }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      }),
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
