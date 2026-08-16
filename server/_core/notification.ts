import { TRPCError } from "@trpc/server";
import nodemailer from "nodemailer";
import { and, eq } from "drizzle-orm";
import { appSettings, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "./env";

export type NotificationPayload = { title: string; content: string };

type SystemSettings = {
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
  notificationEmailEnabled?: boolean;
};

function validatePayload(input: NotificationPayload): NotificationPayload {
  const title = input.title?.trim();
  const content = input.content?.trim();
  if (!title) throw new TRPCError({ code: "BAD_REQUEST", message: "Notification title is required." });
  if (!content) throw new TRPCError({ code: "BAD_REQUEST", message: "Notification content is required." });
  if (title.length > 1200) throw new TRPCError({ code: "BAD_REQUEST", message: "Notification title is too long." });
  if (content.length > 20000) throw new TRPCError({ code: "BAD_REQUEST", message: "Notification content is too long." });
  return { title, content };
}

async function loadSystemSettings(): Promise<SystemSettings> {
  const database = await getDb();
  if (!database) return {};
  const [setting] = await database.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, "app_system")).limit(1);
  if (!setting?.value) return {};
  try { return JSON.parse(setting.value) as SystemSettings; } catch { return {}; }
}

async function sendEmail(settings: SystemSettings, payload: NotificationPayload): Promise<boolean> {
  if (!settings.notificationEmailEnabled || !settings.smtpHost || !settings.smtpFrom) return false;
  const database = await getDb();
  if (!database) return false;
  const rows = await database.select({ email: users.email }).from(users).where(and(eq(users.isActive, true), eq(users.role, "admin")));
  const recipients = rows.map(row => row.email?.trim()).filter((email): email is string => Boolean(email));
  if (!recipients.length) return false;
  const port = Number(settings.smtpPort || 587);
  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port,
    secure: port === 465,
    auth: settings.smtpUser ? { user: settings.smtpUser, pass: settings.smtpPassword || "" } : undefined,
  });
  await transporter.sendMail({
    from: settings.smtpFrom,
    to: recipients,
    subject: payload.title,
    text: payload.content,
    html: `<h2>${payload.title.replace(/[<>]/g, "")}</h2><p>${payload.content.replace(/[<>]/g, "").replace(/\n/g, "<br />")}</p>`,
  });
  return true;
}

export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  const validated = validatePayload(payload);
  let delivered = false;
  try { delivered = await sendEmail(await loadSystemSettings(), validated); } catch (error) { console.warn("[Notification] SMTP request failed", error); }
  if (ENV.notificationWebhookUrl) {
    try {
      const response = await fetch(ENV.notificationWebhookUrl, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", ...(ENV.notificationWebhookToken ? { authorization: `Bearer ${ENV.notificationWebhookToken}` } : {}) },
        body: JSON.stringify(validated),
      });
      delivered = response.ok || delivered;
    } catch (error) { console.warn("[Notification] Webhook request failed", error); }
  }
  if (!delivered) console.info("[Notification]", validated.title, validated.content);
  return delivered;
}

export async function sendTestNotification(): Promise<boolean> {
  return notifyOwner({ title: "Teste de notificações", content: "A configuração de notificações do sistema foi validada com sucesso." });
}

export default notifyOwner;
