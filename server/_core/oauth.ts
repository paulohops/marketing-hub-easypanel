import type { Express } from "express";
import { randomUUID } from "crypto";
import { parse as parseCookie } from "cookie";
import { eq, sql } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";
import { getDb } from "../db";

const STATE_COOKIE = "trade_hub_google_oauth_state";
const GOOGLE_LOGIN_ENABLED = false;

function redirectUri(req: any) {
  return ENV.googleRedirectUri || `${ENV.publicAppUrl || `${req.protocol}://${req.get("host")}`}/api/oauth/google/callback`;
}

function unavailable(res: any) {
  return res.status(503).send("Login com Google não configurado. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET.");
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/google", (req, res) => {
    if (!GOOGLE_LOGIN_ENABLED || !ENV.googleClientId || !ENV.googleClientSecret) return unavailable(res);
    const state = randomUUID();
    res.cookie(STATE_COOKIE, state, { ...getSessionCookieOptions(req), maxAge: 10 * 60 * 1000 });
    const params = new URLSearchParams({ client_id: ENV.googleClientId, redirect_uri: redirectUri(req), response_type: "code", scope: "openid email profile", state, access_type: "online", prompt: "select_account" });
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  app.get("/api/oauth/google/callback", async (req, res) => {
    if (!GOOGLE_LOGIN_ENABLED || !ENV.googleClientId || !ENV.googleClientSecret) return unavailable(res);
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const cookies = parseCookie(req.headers.cookie ?? "");
    if (!code || !state || state !== cookies[STATE_COOKIE]) return res.status(400).send("Sessão OAuth inválida ou expirada.");
    res.clearCookie(STATE_COOKIE, getSessionCookieOptions(req));
    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: ENV.googleClientId, client_secret: ENV.googleClientSecret, redirect_uri: redirectUri(req), grant_type: "authorization_code" }) });
      if (!tokenResponse.ok) return res.status(401).send("Não foi possível validar o login Google.");
      const token = await tokenResponse.json() as { access_token?: string };
      if (!token.access_token) return res.status(401).send("Resposta OAuth inválida.");
      const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
      if (!profileResponse.ok) return res.status(401).send("Não foi possível obter o perfil Google.");
      const profile = await profileResponse.json() as { email?: string; email_verified?: boolean; name?: string; picture?: string };
      const email = profile.email?.trim().toLowerCase();
      if (!email || profile.email_verified !== true) return res.status(401).send("A conta Google precisa ter um e-mail verificado.");
      const database = await getDb();
      if (!database) return res.status(503).send("Banco de dados indisponível.");
      const [account] = await database.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
      if (!account || !account.isActive) return res.status(403).send("Não existe um usuário ativo cadastrado com este e-mail.");
      const now = new Date();
      await database.update(users).set({ name: account.name || profile.name || null, avatarUrl: account.avatarUrl || profile.picture || null, loginMethod: "google", lastSignedIn: now, updatedAt: now }).where(eq(users.id, account.id));
      const session = await sdk.createSessionToken(account.openId, { name: account.name || profile.name || "Trade HUB", expiresInMs: ONE_YEAR_MS });
      res.cookie(COOKIE_NAME, session, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      return res.redirect("/");
    } catch (error) {
      console.error("[Auth] Google OAuth callback failed", error);
      return res.status(502).send("Falha ao concluir o login com Google.");
    }
  });
}
