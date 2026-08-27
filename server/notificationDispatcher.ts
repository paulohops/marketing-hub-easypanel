import { and, eq, inArray, or } from "drizzle-orm";
import { sendNotificationEmail } from "./_core/notification";
import {
  cities,
  financeCompanies,
  notificationRuleRecipients,
  notificationRules,
  notifications,
  regionals,
  userCities,
  userRegionals,
  users,
} from "../drizzle/schema";

export type AuditNotificationEvent = {
  actorUserId: number;
  regionalId?: number | null;
  cityId?: number | null;
  companyId?: number | null;
  entityType: string;
  entityId: number;
  action: string;
  beforeData?: unknown;
  afterData?: unknown;
};

type DatabaseLike = any;

type StoredRecord = Record<string, unknown>;

const entityLabels: Record<string, string> = {
  action: "Ação",
  event: "Evento",
  trade_campaign: "Campanha",
  media_campaign: "Campanha de mídia",
  media_point: "Ponto de mídia",
  stock_item: "Item de estoque",
  stock_movement: "Movimentação de estoque",
  stock_category: "Categoria de estoque",
  invoice: "Nota fiscal",
  payment: "Pagamento",
  supplier_contract: "Contrato financeiro",
  purchase_order: "Ordem de compra",
  operation_cost: "Custo operacional",
  task: "Tarefa",
};

function recordData(value: unknown): StoredRecord {
  return value && typeof value === "object" ? value as StoredRecord : {};
}

function recordName(event: AuditNotificationEvent) {
  const after = recordData(event.afterData);
  const before = recordData(event.beforeData);
  return String(after.name ?? after.title ?? after.invoiceNumber ?? after.orderNumber ?? before.name ?? before.title ?? before.invoiceNumber ?? before.orderNumber ?? `${entityLabels[event.entityType] ?? event.entityType} #${event.entityId}`);
}

function operationType(event: AuditNotificationEvent) {
  const before = recordData(event.beforeData);
  const after = recordData(event.afterData);
  if (event.action === "create") return "created";
  if (event.action === "delete") return "deleted";
  if (event.entityType === "task" && event.action === "assigned") return "assigned";
  if (event.action === "due") return "due";
  if (event.action === "expiry") return "expiry";
  const beforeStatus = before.status;
  const afterStatus = after.status;
  if (beforeStatus !== undefined && afterStatus !== undefined && beforeStatus !== afterStatus) return "status_changed";
  if (event.action.includes("status") || event.action === "approved" || event.action === "rejected") return "status_changed";
  return "updated";
}

function categoryForEvent(eventType: string) {
  if (eventType === "created") return "entity_created" as const;
  if (eventType === "deleted") return "entity_deleted" as const;
  if (eventType === "status_changed") return "entity_status_changed" as const;
  if (eventType === "assigned") return "task_assigned" as const;
  if (eventType === "due") return "task_due" as const;
  if (eventType === "expiry") return "campaign_expiry" as const;
  return "entity_updated" as const;
}

function replaceTemplate(template: string, values: Record<string, string>) {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key: string) => values[key] ?? "");
}

async function usersForTarget(database: DatabaseLike, target: { userId: number | null; regionalId: number | null; cityId: number | null; companyId: number | null }) {
  if (target.userId) return [target.userId];
  if (target.cityId) {
    const rows = await database.select({ userId: userCities.userId }).from(userCities).innerJoin(users, eq(users.id, userCities.userId)).where(and(eq(userCities.cityId, target.cityId), eq(users.isActive, true)));
    return rows.map((row: { userId: number }) => row.userId);
  }
  if (target.regionalId) {
    const [regionalUsers, cityUsers] = await Promise.all([
      database.select({ userId: userRegionals.userId }).from(userRegionals).innerJoin(users, eq(users.id, userRegionals.userId)).where(and(eq(userRegionals.regionalId, target.regionalId), eq(users.isActive, true))),
      database.select({ userId: userCities.userId }).from(userCities).innerJoin(cities, eq(cities.id, userCities.cityId)).innerJoin(users, eq(users.id, userCities.userId)).where(and(eq(cities.regionalId, target.regionalId), eq(users.isActive, true))),
    ]);
    return [...regionalUsers, ...cityUsers].map((row: { userId: number }) => row.userId);
  }
  if (target.companyId) {
    const [company] = await database.select({ providerId: financeCompanies.providerId }).from(financeCompanies).where(eq(financeCompanies.id, target.companyId)).limit(1);
    if (!company?.providerId) return [];
    const companyRegionals = await database.select({ id: regionals.id }).from(regionals).where(eq(regionals.providerId, company.providerId));
    const regionalIds = companyRegionals.map((row: { id: number }) => row.id);
    if (!regionalIds.length) return [];
    const [regionalUsers, cityUsers] = await Promise.all([
      database.select({ userId: userRegionals.userId }).from(userRegionals).innerJoin(users, eq(users.id, userRegionals.userId)).where(and(inArray(userRegionals.regionalId, regionalIds), eq(users.isActive, true))),
      database.select({ userId: userCities.userId }).from(userCities).innerJoin(cities, eq(cities.id, userCities.cityId)).innerJoin(users, eq(users.id, userCities.userId)).where(and(inArray(cities.regionalId, regionalIds), eq(users.isActive, true))),
    ]);
    return [...regionalUsers, ...cityUsers].map((row: { userId: number }) => row.userId);
  }
  const rows = await database.select({ id: users.id }).from(users).where(eq(users.isActive, true));
  return rows.map((row: { id: number }) => row.id);
}

function actionUrl(entityType: string, entityId: number) {
  const routes: Record<string, string> = {
    trade_campaign: `/campanhas/${entityId}`,
    media_campaign: `/midias/veiculacao/${entityId}`,
    campaign: `/campanhas/${entityId}`,
    action: `/acoes/${entityId}`,
    event: `/eventos/${entityId}`,
    action_point: `/pontos-de-acao`,
    media_point: `/midias/${entityId}`,
    stock_item: `/estoque?item=${entityId}`,
    stock_movement: "/estoque",
    purchase_order: `/financeiro?purchaseOrder=${entityId}`,
    invoice: `/financeiro?invoice=${entityId}`,
    payment: `/financeiro`,
    supplier_contract: "/financeiro",
    operation_cost: "/financeiro",
    task: `/tarefas?task=${entityId}`,
  };
  return routes[entityType] ?? null;
}

export type NotificationDispatchResult = { matchedRules: number; createdCount: number };

export async function notifyConfiguredRules(database: DatabaseLike, event: AuditNotificationEvent): Promise<NotificationDispatchResult> {
  const currentEventType = operationType(event);
  const rules = await database.select().from(notificationRules).where(and(eq(notificationRules.active, true), or(eq(notificationRules.entityType, event.entityType), eq(notificationRules.entityType, "*"))));
  const applicableRules = rules.filter((rule: { eventType: string }) => rule.eventType === currentEventType || rule.eventType === "*");
  if (!applicableRules.length) return { matchedRules: 0, createdCount: 0 };
  let createdCount = 0;
  const entity = recordName(event);
  const data = { entity, entityId: String(event.entityId), entityType: event.entityType, actorUserId: String(event.actorUserId), action: event.action };
  for (const rule of applicableRules) {
    const targets = await database.select().from(notificationRuleRecipients).where(eq(notificationRuleRecipients.ruleId, rule.id));
    const recipientIds = new Set<number>();
    for (const target of targets) {
      for (const userId of await usersForTarget(database, target)) recipientIds.add(userId);
    }
    if (rule.excludeActor) recipientIds.delete(event.actorUserId);
    if (!recipientIds.size) continue;
    const title = replaceTemplate(rule.titleTemplate, data);
    const message = replaceTemplate(rule.messageTemplate, data);
    const recipientIdList = Array.from(recipientIds);
    const regionalId = event.regionalId ?? (recordData(event.afterData).regionalId as number | null | undefined) ?? null;
    const cityId = event.cityId ?? (recordData(event.afterData).cityId as number | null | undefined) ?? null;
    const values = recipientIdList.map(userId => ({
      userId,
      regionalId,
      cityId,
      category: rule.category || categoryForEvent(currentEventType),
      title,
      message,
      entityType: event.entityType,
      entityId: event.entityId,
      actionUrl: actionUrl(event.entityType, event.entityId),
      actionLabel: "Abrir registro",
      ruleId: rule.id,
      dedupeKey: `${rule.id}:${event.entityType}:${event.entityId}:${currentEventType}:${userId}`,
    }));
    if (rule.inAppEnabled) {
      const inserted = await database.insert(notifications).values(values).onConflictDoNothing({ target: notifications.dedupeKey }).returning({ id: notifications.id });
      createdCount += inserted.length;
    }
    if (rule.emailEnabled) {
      const emailRows = await database.select({ email: users.email }).from(users).where(and(inArray(users.id, recipientIdList), eq(users.isActive, true)));
      const emails = emailRows.map((row: { email: string | null }) => row.email?.trim()).filter((email: string | null): email is string => Boolean(email));
      if (!emails.length) {
        console.warn(`[Notification] Regra ${rule.id} sem destinatários com e-mail cadastrado.`);
      } else {
        try {
          const sent = await sendNotificationEmail({ to: emails, title, content: message, actionUrl: actionUrl(event.entityType, event.entityId), actionLabel: "Abrir registro" });
          if (!sent) console.warn(`[Notification] Regra ${rule.id}: e-mail não enviado; verifique SMTP global e a opção de notificações por e-mail.`);
        } catch (error) {
          console.warn(`[Notification] Regra ${rule.id}: falha ao enviar e-mail de notificação.`, error);
        }
      }
    }
  }
  return { matchedRules: applicableRules.length, createdCount };
}
