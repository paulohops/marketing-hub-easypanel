import { auditLogs } from "../drizzle/schema";
import { getDb } from "./db";
import { notifyConfiguredRules } from "./notificationDispatcher";

type AuditEvent = {
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

export async function writeAuditLog(event: AuditEvent, databaseOverride?: any) {
  const database = databaseOverride ?? await getDb();
  if (!database) return;
  await database.insert(auditLogs).values({
    actorUserId: event.actorUserId,
    regionalId: event.regionalId ?? null,
    entityType: event.entityType,
    entityId: event.entityId,
    action: event.action,
    beforeData: event.beforeData ? JSON.stringify(event.beforeData) : null,
    afterData: event.afterData ? JSON.stringify(event.afterData) : null,
    occurredAt: new Date(),
  });
  try {
    await notifyConfiguredRules(database, event);
    const afterData = event.afterData && typeof event.afterData === "object" ? event.afterData as Record<string, unknown> : null;
    if (event.entityType === "task" && event.action === "create" && Number(afterData?.assignedToUserId ?? 0) > 0) {
      await notifyConfiguredRules(database, { ...event, action: "assigned" });
    }
  } catch (error) {
    console.warn("Não foi possível materializar notificações configuráveis:", error);
  }
}
