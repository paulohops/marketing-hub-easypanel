import type { Request, Response } from "express";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { actions, cities, invoices, mediaCampaigns, mediaPoints, notifications } from "../drizzle/schema";
import { getDb } from "./db";
import { notifyOwner } from "./_core/notification";
import { sdk } from "./_core/sdk";

type AlertCategory = "campaign_expiry" | "payment_due" | "action_pending";
type NewAlert = { category: AlertCategory; title: string; message: string; entityType: string; entityId: number; regionalId?: number | null };

const startOfUtcDay = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
const asDate = (value: Date) => value.toISOString().slice(0, 10);

export function summarizeAlerts(alerts: NewAlert[]) {
  const counts = alerts.reduce<Record<AlertCategory, number>>((accumulator, alert) => ({ ...accumulator, [alert.category]: (accumulator[alert.category] ?? 0) + 1 }), { campaign_expiry: 0, payment_due: 0, action_pending: 0 });
  return `Campanhas: ${counts.campaign_expiry}; pagamentos: ${counts.payment_due}; ações pendentes: ${counts.action_pending}.`;
}

async function persistIfNew(alert: NewAlert, dayStart: Date) {
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indisponível para alertas operacionais.");
  const existing = await database.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.category, alert.category), eq(notifications.entityType, alert.entityType), eq(notifications.entityId, alert.entityId), gte(notifications.createdAt, dayStart))).limit(1);
  if (existing.length) return false;
  await database.insert(notifications).values({ category: alert.category, title: alert.title, message: alert.message, entityType: alert.entityType, entityId: alert.entityId, regionalId: alert.regionalId ?? null });
  return true;
}

export async function runOperationalAlertSweep(now = new Date()) {
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indisponível para alertas operacionais.");
  const today = asDate(now);
  const campaignHorizon = asDate(new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000));
  const paymentHorizon = asDate(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
  const [campaignRows, invoiceRows, actionRows] = await Promise.all([
    database.select({ id: mediaCampaigns.id, name: mediaCampaigns.name, endsOn: mediaCampaigns.endsOn, regionalId: cities.regionalId }).from(mediaCampaigns).innerJoin(mediaPoints, eq(mediaCampaigns.mediaPointId, mediaPoints.id)).innerJoin(cities, eq(mediaPoints.cityId, cities.id)).where(and(eq(mediaCampaigns.status, "active"), gte(mediaCampaigns.endsOn, today), lte(mediaCampaigns.endsOn, campaignHorizon))),
    database.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, dueDate: invoices.dueDate, amount: invoices.amount }).from(invoices).where(and(inArray(invoices.status, ["open", "partially_paid", "overdue"]), lte(invoices.dueDate, paymentHorizon))),
    database.select({ id: actions.id, name: actions.name, scheduledFor: actions.scheduledFor, regionalId: cities.regionalId }).from(actions).innerJoin(cities, eq(actions.cityId, cities.id)).where(and(eq(actions.status, "planned"), lte(actions.scheduledFor, now))),
  ]);
  const candidates: NewAlert[] = [
    ...campaignRows.map(row => ({ category: "campaign_expiry" as const, title: "Campanha próxima do vencimento", message: `A campanha ${row.name} vence em ${new Date(`${row.endsOn}T12:00:00Z`).toLocaleDateString("pt-BR")}.`, entityType: "media_campaign", entityId: row.id, regionalId: row.regionalId })),
    ...invoiceRows.map(row => ({ category: "payment_due" as const, title: "Pagamento pendente", message: `A nota fiscal ${row.invoiceNumber} vence em ${new Date(`${row.dueDate}T12:00:00Z`).toLocaleDateString("pt-BR")} no valor de R$ ${Number(row.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`, entityType: "invoice", entityId: row.id })),
    ...actionRows.map(row => ({ category: "action_pending" as const, title: "Ação sem execução registrada", message: `A ação ${row.name}, prevista para ${row.scheduledFor.toLocaleString("pt-BR")}, ainda não possui execução concluída.`, entityType: "action", entityId: row.id, regionalId: row.regionalId })),
  ];
  const dayStart = startOfUtcDay(now);
  const generated: NewAlert[] = [];
  for (const alert of candidates) if (await persistIfNew(alert, dayStart)) generated.push(alert);
  if (generated.length) await notifyOwner({ title: `Hub Trade: ${generated.length} alerta(s) operacional(is)`, content: summarizeAlerts(generated) });
  return { checkedAt: now.toISOString(), generated: generated.length, summary: summarizeAlerts(generated) };
}

export async function operationalAlertsHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    return res.json({ ok: true, ...(await runOperationalAlertSweep()) });
  } catch (error) {
    const detail = error instanceof Error ? { message: error.message, stack: error.stack } : { message: "Erro desconhecido" };
    return res.status(500).json({ error: "operational-alerts-failed", detail, context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
  }
}
