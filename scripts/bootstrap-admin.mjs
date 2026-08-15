import "dotenv/config";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME?.trim() || "Administrador Trade HUB";
const resetPassword = process.env.ADMIN_RESET_PASSWORD === "true";
const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!email || !password) throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD.");
if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
  throw new Error("ADMIN_PASSWORD precisa ter 12+ caracteres, minúscula, maiúscula e número.");
}
if (!connectionString) throw new Error("Defina DATABASE_URL.");

const pool = new Pool({
  connectionString,
  ...(process.env.DATABASE_SSL === "true"
    ? { ssl: { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" } }
    : {}),
});

try {
  const existingResult = await pool.query(
    'SELECT "id", "openId", "passwordHash", "passwordUpdatedAt" FROM "users" WHERE lower("email") = lower($1) LIMIT 1',
    [email],
  );
  const existing = existingResult.rows[0];
  const now = new Date();
  const passwordHash = existing?.passwordHash && !resetPassword
    ? existing.passwordHash
    : await bcrypt.hash(password, 12);

  if (existing) {
    await pool.query(
      'UPDATE "users" SET "name"=$1, "email"=$2, "role"=\'admin\', "isActive"=true, "loginMethod"=\'local\', "passwordHash"=$3, "passwordUpdatedAt"=$4, "updatedAt"=$4 WHERE "id"=$5',
      [name, email, passwordHash, resetPassword || !existing.passwordHash ? now : existing.passwordUpdatedAt, existing.id],
    );
    console.log(`Administrador atualizado: ${email}`);
  } else {
    const openId = `local_${createHash("sha256").update(email).digest("hex").slice(0, 32)}`;
    await pool.query(
      'INSERT INTO "users" ("openId", "name", "email", "role", "isActive", "loginMethod", "passwordHash", "passwordUpdatedAt", "lastSignedIn") VALUES ($1, $2, $3, \'admin\', true, \'local\', $4, $5, $5)',
      [openId, name, email, passwordHash, now],
    );
    console.log(`Administrador criado: ${email}`);
  }
} finally {
  await pool.end();
}
