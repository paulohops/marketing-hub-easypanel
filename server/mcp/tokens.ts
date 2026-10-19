import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull, or, gt, sql } from "drizzle-orm";
import { mcpTokens, users, type User } from "../../drizzle/schema";
import { getDb } from "../db";

export function hashMcpToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export type GeneratedMcpToken = {
  id: number;
  token: string;
  name: string;
  tokenPrefix: string;
  expiresAt: Date | null;
  createdAt: Date;
};

export async function generateMcpToken(options: {
  userId: number;
  name: string;
  expiresInDays?: number | null;
}): Promise<GeneratedMcpToken> {
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indisponível.");

  const randomSecret = randomBytes(24).toString("hex");
  const rawToken = `mcp_hub_${randomSecret}`;
  const tokenPrefix = `mcp_hub_${randomSecret.slice(0, 8)}...`;
  const tokenHash = hashMcpToken(rawToken);

  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const [created] = await database
    .insert(mcpTokens)
    .values({
      userId: options.userId,
      name: options.name.trim() || "Token MCP",
      tokenHash,
      tokenPrefix,
      expiresAt,
    })
    .returning();

  return {
    id: created.id,
    token: rawToken,
    name: created.name,
    tokenPrefix: created.tokenPrefix,
    expiresAt: created.expiresAt,
    createdAt: created.createdAt,
  };
}

export async function verifyMcpToken(rawToken: string): Promise<User | null> {
  const database = await getDb();
  if (!database) return null;

  const tokenHash = hashMcpToken(rawToken);
  const now = new Date();

  const [row] = await database
    .select({
      token: mcpTokens,
      user: users,
    })
    .from(mcpTokens)
    .innerJoin(users, eq(mcpTokens.userId, users.id))
    .where(
      and(
        eq(mcpTokens.tokenHash, tokenHash),
        isNull(mcpTokens.revokedAt),
        or(isNull(mcpTokens.expiresAt), gt(mcpTokens.expiresAt, now)),
        eq(users.isActive, true)
      )
    )
    .limit(1);

  if (!row) return null;

  // Atualiza lastUsedAt de forma assíncrona
  database
    .update(mcpTokens)
    .set({ lastUsedAt: now, updatedAt: now })
    .where(eq(mcpTokens.id, row.token.id))
    .catch(err => console.error("[MCP] Erro ao atualizar lastUsedAt do token:", err));

  return row.user;
}

export async function listUserMcpTokens(userId: number) {
  const database = await getDb();
  if (!database) return [];

  return database
    .select({
      id: mcpTokens.id,
      name: mcpTokens.name,
      tokenPrefix: mcpTokens.tokenPrefix,
      expiresAt: mcpTokens.expiresAt,
      lastUsedAt: mcpTokens.lastUsedAt,
      revokedAt: mcpTokens.revokedAt,
      createdAt: mcpTokens.createdAt,
    })
    .from(mcpTokens)
    .where(eq(mcpTokens.userId, userId))
    .orderBy(desc(mcpTokens.createdAt));
}

export async function revokeMcpToken(tokenId: number, userId: number): Promise<boolean> {
  const database = await getDb();
  if (!database) return false;

  const result = await database
    .update(mcpTokens)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(mcpTokens.id, tokenId), eq(mcpTokens.userId, userId)))
    .returning();

  return result.length > 0;
}
