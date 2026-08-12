import { auditLogs } from "../drizzle/schema";
import { getDb } from "./db";

type AuditEvent = {
  actorUserId: number;
  regionalId?: number | null;
  entityType: string;
  entityId: number;
  action: string;
  beforeData?: unknown;
  afterData?: unknown;
};

export async function writeAuditLog(event: AuditEvent) {
  const database = await getDb();
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
}
