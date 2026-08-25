import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { actionTypes, cities, documents, eventTypes, mediaTypes, suppliers, tradeOperations } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { hasSupportedFileSignature, storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

const operationTypeValues = ["trade_action", "media", "event"] as const;
const operationStatusValues = ["planned", "approved", "in_progress", "completed", "cancelled"] as const;
const allowedPermitMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

const operationInput = z.object({
  operationType: z.enum(operationTypeValues),
  actionTypeId: z.number().int().positive().nullable(),
  mediaTypeId: z.number().int().positive().nullable(),
  eventTypeId: z.number().int().positive().nullable(),
  name: z.string().trim().min(2).max(180),
  cityId: z.number().int().positive(),
  supplierId: z.number().int().positive(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable(),
  requiresPermit: z.boolean(),
});

function safeFileName(name: string) {
  const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 180);
  return /[a-zA-Z0-9]/.test(normalized) ? normalized : "comprovante";
}

export function validateOperationDenomination(input: z.infer<typeof operationInput>) {
  const selectedCount = [input.actionTypeId, input.mediaTypeId, input.eventTypeId].filter(Boolean).length;
  if (selectedCount !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione exatamente uma denominação compatível com o tipo da operação." });
  if (input.operationType === "trade_action" && !input.actionTypeId) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione o tipo de ação de trade." });
  if (input.operationType === "media" && !input.mediaTypeId) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione o tipo de mídia." });
  if (input.operationType === "event" && !input.eventTypeId) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione o tipo de evento." });
  if (input.endsAt && input.endsAt < input.startsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "A data final não pode ser anterior à data inicial." });
}

export function canTransitionOperationStatus(current: (typeof operationStatusValues)[number], next: (typeof operationStatusValues)[number]) {
  if (["completed", "cancelled"].includes(current)) return false;
  if (current === "planned") return ["approved", "cancelled"].includes(next);
  if (current === "approved") return ["in_progress", "cancelled"].includes(next);
  return ["completed", "cancelled"].includes(next);
}

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

export const tradeOperationsRouter = router({
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "operations.read");
    const database = await requireDatabase();
    const [cityRows, supplierRows, actionTypeRows, mediaTypeRows, eventTypeRows] = await Promise.all([
      database.select().from(cities).where(eq(cities.active, true)).orderBy(asc(cities.name)),
      database.select().from(suppliers).where(eq(suppliers.active, true)).orderBy(asc(suppliers.displayName)),
      database.select().from(actionTypes).where(eq(actionTypes.active, true)).orderBy(asc(actionTypes.name)),
      database.select().from(mediaTypes).where(eq(mediaTypes.active, true)).orderBy(asc(mediaTypes.name)),
      database.select().from(eventTypes).where(eq(eventTypes.active, true)).orderBy(asc(eventTypes.name)),
    ]);
    return { cities: cityRows, suppliers: supplierRows, actionTypes: actionTypeRows, mediaTypes: mediaTypeRows, eventTypes: eventTypeRows };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "operations.read");
    const database = await requireDatabase();
    const rows = await database.select({ operation: tradeOperations, cityName: cities.name, supplierName: suppliers.displayName, actionTypeName: actionTypes.name, mediaTypeName: mediaTypes.name, eventTypeName: eventTypes.name })
      .from(tradeOperations)
      .innerJoin(cities, eq(tradeOperations.cityId, cities.id))
      .innerJoin(suppliers, eq(tradeOperations.supplierId, suppliers.id))
      .leftJoin(actionTypes, eq(tradeOperations.actionTypeId, actionTypes.id))
      .leftJoin(mediaTypes, eq(tradeOperations.mediaTypeId, mediaTypes.id))
      .leftJoin(eventTypes, eq(tradeOperations.eventTypeId, eventTypes.id))
      .orderBy(asc(tradeOperations.startsAt));
    return rows.map(row => ({ ...row.operation, cityName: row.cityName, supplierName: row.supplierName, denominationName: row.actionTypeName ?? row.mediaTypeName ?? row.eventTypeName ?? "Sem denominação" }));
  }),

  create: protectedProcedure.input(operationInput).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "operations.create");
    validateOperationDenomination(input);
    const database = await requireDatabase();
    const [city, supplier] = await Promise.all([
      database.select({ id: cities.id }).from(cities).where(and(eq(cities.id, input.cityId), eq(cities.active, true))).limit(1),
      database.select({ id: suppliers.id }).from(suppliers).where(and(eq(suppliers.id, input.supplierId), eq(suppliers.active, true))).limit(1),
    ]);
    if (!city[0] || !supplier[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cidade ou fornecedor ativo não encontrado." });
    const [created] = await database.insert(tradeOperations).values({ ...input, createdByUserId: ctx.user.id }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "trade_operation", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  updateStatus: protectedProcedure.input(z.object({ operationId: z.number().int().positive(), status: z.enum(operationStatusValues) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "operations.update");
    const database = await requireDatabase();
    const [before] = await database.select().from(tradeOperations).where(eq(tradeOperations.id, input.operationId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Operação não encontrada." });
    if (!canTransitionOperationStatus(before.status, input.status)) throw new TRPCError({ code: "CONFLICT", message: "A transição de status solicitada não é permitida." });
    if (input.status === "in_progress" && before.requiresPermit && !before.permitStorageKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Envie o comprovante de alvará antes de liberar a execução." });
    const [updated] = await database.update(tradeOperations).set({ status: input.status, updatedAt: new Date() }).where(eq(tradeOperations.id, input.operationId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "trade_operation", entityId: updated.id, action: "update_status", beforeData: before, afterData: updated });
    return updated;
  }),

  uploadPermit: protectedProcedure.input(z.object({ operationId: z.number().int().positive(), originalName: z.string().trim().min(1).max(255), mimeType: z.enum(allowedPermitMimeTypes), dataBase64: z.string().min(1).max(7_000_000) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "operations.update");
    const database = await requireDatabase();
    const [operation] = await database.select({ operation: tradeOperations, regionalId: cities.regionalId }).from(tradeOperations).innerJoin(cities, eq(tradeOperations.cityId, cities.id)).where(eq(tradeOperations.id, input.operationId)).limit(1);
    if (!operation) throw new TRPCError({ code: "NOT_FOUND", message: "Operação não encontrada." });
    if (!operation.operation.requiresPermit) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta operação não exige alvará." });
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "O comprovante deve ter até 5 MB." });
    if (!hasSupportedFileSignature(bytes, input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "O conteúdo do comprovante não corresponde ao formato informado." });
    const originalName = safeFileName(input.originalName);
    const stored = await storagePut(`trade/operations/${input.operationId}/alvara-${Date.now()}-${originalName}`, bytes, input.mimeType);
    const [updated] = await database.transaction(async transaction => {
      const [saved] = await transaction.update(tradeOperations).set({ permitStorageKey: stored.key, permitUrl: stored.url, updatedAt: new Date() }).where(eq(tradeOperations.id, input.operationId)).returning();
      await transaction.insert(documents).values({ regionalId: operation.regionalId, entityType: "trade_operation", entityId: input.operationId, storageKey: stored.key, url: stored.url, originalName, mimeType: input.mimeType, sizeBytes: bytes.length, uploadedByUserId: ctx.user.id });
      return [saved];
    });
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: operation.regionalId, entityType: "trade_operation", entityId: updated.id, action: "upload_permit", afterData: { storageKey: stored.key, originalName } });
    return updated;
  }),

  saveFeedback: protectedProcedure.input(z.object({ operationId: z.number().int().positive(), feedback: z.string().trim().min(3).max(4_000) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "operations.update");
    const database = await requireDatabase();
    const [before] = await database.select().from(tradeOperations).where(eq(tradeOperations.id, input.operationId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Operação não encontrada." });
    const [updated] = await database.update(tradeOperations).set({ postActionFeedback: input.feedback, updatedAt: new Date() }).where(eq(tradeOperations.id, input.operationId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "trade_operation", entityId: updated.id, action: "save_feedback", beforeData: { postActionFeedback: before.postActionFeedback }, afterData: { postActionFeedback: updated.postActionFeedback } });
    return updated;
  }),
});
