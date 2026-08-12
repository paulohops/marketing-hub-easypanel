import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let pool: Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.warn("[Database] POSTGRES_URL is not configured");
    return null;
  }

  if (!db) {
    pool = new Pool({
      connectionString,
      max: 8,
      idleTimeoutMillis: 30_000,
      ssl: { rejectUnauthorized: true },
    });
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
    loginMethod: user.loginMethod ?? null,
    lastSignedIn: user.lastSignedIn ?? new Date(),
    role: user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "viewer"),
  };

  await database.insert(users).values(values).onConflictDoUpdate({
    target: users.openId,
    set: {
      name: values.name,
      email: values.email,
      loginMethod: values.loginMethod,
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
