import { TRPCError } from "@trpc/server";
import nodemailer from "nodemailer";
import { and, eq } from "drizzle-orm";
import { appSettings, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { ENV } from "./env";

export type NotificationPayload = { title: string; content: string };

type SystemSettings = {
  appName?: string;
  logoUrl?: string;
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

async function createTransporter(settings: SystemSettings) {
  if (!settings.smtpHost || !settings.smtpFrom) return null;
  const port = Number(settings.smtpPort || 587);
  return nodemailer.createTransport({ host: settings.smtpHost, port, secure: port === 465, auth: settings.smtpUser ? { user: settings.smtpUser, pass: settings.smtpPassword || "" } : undefined });
}

function escapeHtml(value: string) { return value.replace(/[&<>\"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[character] ?? character)); }

const INTERNAL_APP_URL = "http://10.159.245.28:8978/";

export async function sendTemporaryPasswordEmail(input: { to: string; name: string; temporaryPassword: string }) {
  const settings = await loadSystemSettings();
  const transporter = await createTransporter(settings);
  if (!transporter) return false;
  const appName = settings.appName || "Marketing Hub";
  const safeAppName = escapeHtml(appName);
  const safeName = escapeHtml(input.name || "usuário");
  const safePassword = escapeHtml(input.temporaryPassword);
  const subject = `Seu acesso ao ${appName}`;
  const text = `Olá, ${input.name || "usuário"}!\n\nSeu acesso ao ${appName} foi criado.\n\nE-mail: ${input.to}\nSenha temporária: ${input.temporaryPassword}\n\nAcesse: ${INTERNAL_APP_URL}\n\nImportante: para acessar o sistema, é necessário estar conectado à VPN da Sempre Internet. No primeiro acesso, você deverá trocar a senha temporária por uma senha definitiva.\n\nSe você não reconhece este acesso, procure a administração do sistema.`;
  await transporter.sendMail({
    from: settings.smtpFrom,
    to: input.to,
    subject,
    text,
    html: `<div style="background:#f4f7f5;padding:32px 16px;font-family:Arial,sans-serif;color:#183329"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dce8df;border-radius:18px;overflow:hidden"><div style="background:#0e723b;padding:28px 32px;color:#fff"><div style="font-size:20px;font-weight:700">${safeAppName}</div><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.8;margin-top:6px">Novo acesso</div></div><div style="padding:32px"><h1 style="font-size:22px;margin:0 0 14px">Seu acesso foi criado</h1><p style="font-size:15px;line-height:1.6;margin:0 0 24px">Olá, ${safeName}. A administração criou seu acesso ao sistema.</p><div style="background:#eef8f1;border:1px solid #bfe3c9;border-radius:14px;padding:20px"><p style="font-size:13px;margin:0 0 8px;color:#54715f">E-mail de acesso</p><p style="font-size:15px;font-weight:700;margin:0 0 16px">${escapeHtml(input.to)}</p><p style="font-size:13px;margin:0 0 8px;color:#54715f">Senha temporária</p><p style="font-size:22px;font-weight:800;letter-spacing:2px;color:#0e723b;margin:0">${safePassword}</p></div><p style="font-size:14px;line-height:1.6;margin:24px 0 0"><strong>Importante:</strong> para acessar o sistema, é necessário estar conectado à VPN da Sempre Internet.</p><p style="font-size:14px;line-height:1.6;margin:14px 0 0">Acesse <a href="${INTERNAL_APP_URL}" style="color:#0e723b;font-weight:700">${INTERNAL_APP_URL}</a>. No primeiro acesso, o sistema exigirá a troca desta senha por uma senha definitiva.</p><p style="font-size:13px;line-height:1.6;color:#64746b;margin:24px 0 0">Se você não reconhece este acesso, procure a administração do sistema.</p></div></div></div>`,
  });
  return true;
}

export async function sendAuthCodeEmail(input: { to: string; code: string; purpose: "login" | "password_reset"; expiresInMinutes: number }) {
  const settings = await loadSystemSettings();
  const transporter = await createTransporter(settings);
  if (!transporter) return false;
  const appName = settings.appName || "Marketing Hub";
  const isReset = input.purpose === "password_reset";
  const title = isReset ? `Código para redefinir sua senha · ${appName}` : `Código de acesso · ${appName}`;
  const intro = isReset ? "Recebemos uma solicitação para redefinir sua senha." : "Use o código abaixo para concluir seu acesso ao sistema.";
  const safeAppName = escapeHtml(appName);
  const safeCode = escapeHtml(input.code);
  await transporter.sendMail({
    from: settings.smtpFrom,
    to: input.to,
    subject: title,
    text: `${intro}\n\nCódigo: ${input.code}\n\nEste código expira em ${input.expiresInMinutes} minutos. Se você não solicitou esta ação, ignore este e-mail.`,
    html: `<div style="background:#f4f7f5;padding:32px 16px;font-family:Arial,sans-serif;color:#183329"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dce8df;border-radius:18px;overflow:hidden"><div style="background:#0e723b;padding:28px 32px;color:#fff"><div style="font-size:20px;font-weight:700">${safeAppName}</div><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;opacity:.8;margin-top:6px">Acesso seguro</div></div><div style="padding:32px"><h1 style="font-size:22px;margin:0 0 14px">${isReset ? "Redefinição de senha" : "Confirme seu acesso"}</h1><p style="font-size:15px;line-height:1.6;margin:0 0 24px">${escapeHtml(intro)}</p><div style="background:#eef8f1;border:1px solid #bfe3c9;border-radius:14px;text-align:center;padding:22px"><div style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#54715f">Seu código</div><div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#0e723b;margin-top:10px">${safeCode}</div></div><p style="font-size:13px;line-height:1.6;color:#64746b;margin:24px 0 0">O código expira em ${input.expiresInMinutes} minutos. Se você não solicitou esta ação, ignore este e-mail.</p></div></div></div>`,
  });
  return true;
}

async function sendEmail(settings: SystemSettings, payload: NotificationPayload): Promise<boolean> {
  if (!settings.notificationEmailEnabled || !settings.smtpHost || !settings.smtpFrom) return false;
  const database = await getDb();
  if (!database) return false;
  const rows = await database.select({ email: users.email }).from(users).where(and(eq(users.isActive, true), eq(users.role, "admin")));
  const recipients = rows.map(row => row.email?.trim()).filter((email): email is string => Boolean(email));
  if (!recipients.length) return false;
  const transporter = await createTransporter(settings);
  if (!transporter) return false;
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

export async function sendNotificationEmail(input: { to: string[]; title: string; content: string }): Promise<boolean> {
  const validated = validatePayload({ title: input.title, content: input.content });
  const settings = await loadSystemSettings();
  if (!settings.notificationEmailEnabled || !input.to.length) return false;
  const transporter = await createTransporter(settings);
  if (!transporter) return false;
  const recipients = Array.from(new Set(input.to.map(email => email.trim()).filter(Boolean)));
  if (!recipients.length) return false;
  await transporter.sendMail({
    from: settings.smtpFrom,
    to: recipients,
    subject: validated.title,
    text: validated.content,
    html: `<h2>${escapeHtml(validated.title)}</h2><p>${escapeHtml(validated.content).replace(/\n/g, "<br />")}</p>`,
  });
  return true;
}

export async function sendTestNotification(): Promise<boolean> {
  return notifyOwner({ title: "Teste de notificações", content: "A configuração de notificações do sistema foi validada com sucesso." });
}

export default notifyOwner;
