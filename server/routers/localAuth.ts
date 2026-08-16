import { TRPCError } from "@trpc/server";
import { createHash, randomInt } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { appSettings, users } from "../../drizzle/schema";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { hashLocalPassword, localPasswordInput, verifyLocalPassword } from "../auth/localPasswords";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { sendAuthCodeEmail } from "../_core/notification";

const loginInput = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").max(320),
  password: z.string().min(1).max(128),
});
const codeInput = z.object({ email: z.string().trim().email("Informe um e-mail válido.").max(320), code: z.string().trim().regex(/^\d{6}$/, "Informe o código de 6 dígitos.") });
const resetInput = codeInput.extend({ newPassword: localPasswordInput });
const CODE_TTL_MS = 10 * 60 * 1000;
const attemptsByEmail = new Map<string, { attempts: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

function registerFailedAttempt(email: string) {
  const current = attemptsByEmail.get(email);
  const now = Date.now();
  if (!current || current.until <= now) { attemptsByEmail.set(email, { attempts: 1, until: now + LOCK_WINDOW_MS }); return; }
  attemptsByEmail.set(email, { attempts: current.attempts + 1, until: current.until });
}
function assertNotRateLimited(email: string) {
  const current = attemptsByEmail.get(email);
  if (current && current.until > Date.now() && current.attempts >= MAX_ATTEMPTS) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." });
}
function hashCode(code: string) { return createHash("sha256").update(code).digest("hex"); }
function generateCode() { return String(randomInt(0, 1_000_000)).padStart(6, "0"); }
async function isEmailLoginCodeEnabled(database: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const [setting] = await database.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, "app_system")).limit(1);
  if (!setting?.value) return false;
  try { return (JSON.parse(setting.value) as Record<string, unknown>).emailLoginCodeEnabled === true; } catch { return false; }
}

async function findAccount(database: NonNullable<Awaited<ReturnType<typeof getDb>>>, email: string) {
  const [account] = await database.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
  return account;
}
async function issueCode(database: NonNullable<Awaited<ReturnType<typeof getDb>>>, account: typeof users.$inferSelect, purpose: "login" | "password_reset") {
  if (!account.email) throw new TRPCError({ code: "BAD_REQUEST", message: "Este usuário não possui e-mail cadastrado." });
  const code = generateCode();
  const delivered = await sendAuthCodeEmail({ to: account.email, code, purpose, expiresInMinutes: CODE_TTL_MS / 60000 });
  if (!delivered) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Não foi possível enviar o código. Verifique a configuração SMTP do Sistema." });
  await database.update(users).set({ authCodeHash: hashCode(code), authCodePurpose: purpose, authCodeExpiresAt: new Date(Date.now() + CODE_TTL_MS), updatedAt: new Date() }).where(eq(users.id, account.id));
}
async function assertCode(database: NonNullable<Awaited<ReturnType<typeof getDb>>>, email: string, code: string, purpose: "login" | "password_reset") {
  const account = await findAccount(database, email);
  if (!account || !account.isActive || account.authCodePurpose !== purpose || !account.authCodeExpiresAt || account.authCodeExpiresAt.getTime() < Date.now() || account.authCodeHash !== hashCode(code)) throw new TRPCError({ code: "UNAUTHORIZED", message: "Código inválido ou expirado." });
  return account;
}
async function createSession(ctx: { req: any; res: any }, database: NonNullable<Awaited<ReturnType<typeof getDb>>>, account: typeof users.$inferSelect) {
  const signedInAt = new Date();
  await database.update(users).set({ lastSignedIn: signedInAt, updatedAt: signedInAt, authCodeHash: null, authCodePurpose: null, authCodeExpiresAt: null }).where(eq(users.id, account.id));
  const token = await sdk.createSessionToken(account.openId, { name: account.name || "Trade HUB", expiresInMs: ONE_YEAR_MS });
  ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
}

export const localAuthRouter = router({
  login: publicProcedure.input(loginInput).mutation(async ({ ctx, input }) => {
    const email = input.email.toLowerCase(); assertNotRateLimited(email);
    const database = await getDb(); if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
    let account;
    try { account = await findAccount(database, email); } catch (error) { console.error("[Auth] Local login query failed; schema may be outdated", error); throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "O banco está em uma versão antiga. Faça o deploy mais recente com RUN_MIGRATIONS=true." }); }
    const validPassword = Boolean(account?.passwordHash) && await verifyLocalPassword(input.password, account.passwordHash!);
    if (!account || !account.isActive || !validPassword) { registerFailedAttempt(email); throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." }); }
    attemptsByEmail.delete(email);
    if (await isEmailLoginCodeEnabled(database)) {
      await issueCode(database, account, "login");
      return { success: true, requiresCode: true } as const;
    }
    await createSession(ctx, database, account);
    return { success: true, requiresCode: false } as const;
  }),
  verifyLoginCode: publicProcedure.input(codeInput).mutation(async ({ ctx, input }) => {
    const database = await getDb(); if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
    const account = await assertCode(database, input.email.toLowerCase(), input.code, "login");
    await createSession(ctx, database, account);
    return { success: true } as const;
  }),
  requestPasswordReset: publicProcedure.input(z.object({ email: z.string().trim().email("Informe um e-mail válido.").max(320) })).mutation(async ({ input }) => {
    const database = await getDb(); if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
    const account = await findAccount(database, input.email.toLowerCase());
    if (account?.isActive && account.email && account.passwordHash) await issueCode(database, account, "password_reset");
    return { success: true } as const;
  }),
  resetPassword: publicProcedure.input(resetInput).mutation(async ({ input }) => {
    const database = await getDb(); if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
    const account = await assertCode(database, input.email.toLowerCase(), input.code, "password_reset");
    await database.update(users).set({ passwordHash: await hashLocalPassword(input.newPassword), passwordUpdatedAt: new Date(), authCodeHash: null, authCodePurpose: null, authCodeExpiresAt: null, updatedAt: new Date() }).where(eq(users.id, account.id));
    return { success: true } as const;
  }),
});

export const __localAuthInternals = { hashCode, generateCode };
