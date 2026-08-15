import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users, type InsertUser } from "../drizzle/schema";
import { ENV } from "./_core/env";

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  const connectionString = ENV.databaseUrl;
  if (!connectionString) {
    console.warn("[Database] DATABASE_URL is not configured");
    return null;
  }

  if (!db) {
    const sslEnabled = process.env.DATABASE_SSL === "true";
    pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 8),
      idleTimeoutMillis: 30_000,
      ...(sslEnabled
        ? {
            ssl: {
              rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
            },
          }
        : {}),
    });
    pool.on("error", error => console.error("[Database] Pool error", error));
    db = drizzle(pool);
  }

  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const database = await getDb();
  if (!database) return;

  const values: InsertUser = {
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    phone: user.phone ?? null,
    loginMethod: user.loginMethod ?? null,
    lastSignedIn: user.lastSignedIn ?? new Date(),
    role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "viewer"),
  };

  await database.insert(users).values(values).onConflictDoUpdate({
    target: users.openId,
    set: {
      name: sql`coalesce(excluded."name", "users"."name")`,
      email: sql`coalesce(excluded."email", "users"."email")`,
      loginMethod: sql`coalesce(excluded."loginMethod", "users"."loginMethod")`,
      lastSignedIn: values.lastSignedIn,
      updatedAt: new Date(),
    },
  });
}

export async function getUserByOpenId(openId: string) {
  const database = await getDb();
  if (!database) return undefined;
  const result = await database.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
