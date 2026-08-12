import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { users } from "../../drizzle/schema";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { verifyLocalPassword } from "../auth/localPasswords";
import { getSessionCookieOptions } from "../_core/cookies";
import { sdk } from "../_core/sdk";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

const loginInput = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").max(320),
  password: z.string().min(1).max(128),
});

const attemptsByEmail = new Map<string, { attempts: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_WINDOW_MS = 15 * 60 * 1000;

function registerFailedAttempt(email: string) {
  const current = attemptsByEmail.get(email);
  const now = Date.now();
  if (!current || current.until <= now) {
    attemptsByEmail.set(email, { attempts: 1, until: now + LOCK_WINDOW_MS });
    return;
  }
  attemptsByEmail.set(email, { attempts: current.attempts + 1, until: current.until });
}

function assertNotRateLimited(email: string) {
  const current = attemptsByEmail.get(email);
  if (current && current.until > Date.now() && current.attempts >= MAX_ATTEMPTS) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente." });
  }
}

export const localAuthRouter = router({
  login: publicProcedure.input(loginInput).mutation(async ({ ctx, input }) => {
    const email = input.email.toLowerCase();
    assertNotRateLimited(email);
    const database = await getDb();
    if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });

    const [account] = await database.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    const validPassword = Boolean(account?.passwordHash) && await verifyLocalPassword(input.password, account.passwordHash!);
    if (!account || !account.isActive || !validPassword) {
      registerFailedAttempt(email);
      throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
    }

    attemptsByEmail.delete(email);
    const signedInAt = new Date();
    await database.update(users).set({ lastSignedIn: signedInAt, updatedAt: signedInAt }).where(eq(users.id, account.id));
    const token = await sdk.createSessionToken(account.openId, { name: account.name || "Trade HUB", expiresInMs: ONE_YEAR_MS });
    ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
    return { success: true } as const;
  }),
});
