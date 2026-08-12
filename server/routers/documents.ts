import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { actions, documents, events, invoices, mediaCampaigns, regionals, stockItems } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";
import { writeAuditLog } from "../audit";

const entityTypes = ["media_campaign", "action", "event", "invoice", "stock", "regional_media"] as const;
const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

export function permissionForEntity(entityType: (typeof entityTypes)[number], write: boolean) {
  const mode = write ? "write" : "read";
  if (entityType === "invoice") return `finance.${mode}`;
  if (entityType === "stock") return `inventory.${mode}`;
  if (entityType === "action") return `actions.${mode}`;
  if (entityType === "event") return `events.${mode}`;
  return `media.${mode}`;
}

export function safeName(name: string) {
  const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 180);
  return /[a-zA-Z0-9]/.test(normalized) ? normalized : "arquivo";
}

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

export const documentsRouter = router({
  listForEntity: protectedProcedure.input(z.object({ entityType: z.enum(entityTypes), entityId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    assertPermission(ctx.user, permissionForEntity(input.entityType, false));
    const database = await requireDatabase();
    return database.select().from(documents).where(and(eq(documents.entityType, input.entityType), eq(documents.entityId, input.entityId))).orderBy(asc(documents.createdAt));
  }),

  upload: protectedProcedure.input(z.object({ entityType: z.enum(entityTypes), entityId: z.number().int().positive(), regionalId: z.number().int().positive().nullable(), originalName: z.string().trim().min(1).max(255), mimeType: z.enum(allowedMimeTypes), dataBase64: z.string().min(1).max(7_000_000) })).mutation(async ({ ctx, input }) => {
    assertPermission(ctx.user, permissionForEntity(input.entityType, true));
    const database = await requireDatabase();
    if (input.entityType === "invoice") {
      const [invoice] = await database.select({ id: invoices.id }).from(invoices).where(eq(invoices.id, input.entityId));
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Nota fiscal não encontrada." });
    }
    if (input.entityType === "stock") {
      const [item] = await database.select({ id: stockItems.id }).from(stockItems).where(eq(stockItems.id, input.entityId));
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item de estoque não encontrado." });
    }
    if (input.entityType === "media_campaign") {
      const [campaign] = await database.select({ id: mediaCampaigns.id }).from(mediaCampaigns).where(eq(mediaCampaigns.id, input.entityId));
      if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada." });
    }
    if (input.entityType === "action") {
      const [action] = await database.select({ id: actions.id }).from(actions).where(eq(actions.id, input.entityId));
      if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "Ação não encontrada." });
    }
    if (input.entityType === "event") {
      const [event] = await database.select({ id: events.id }).from(events).where(eq(events.id, input.entityId));
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." });
    }
    if (input.entityType === "regional_media") {
      const [regional] = await database.select({ id: regionals.id }).from(regionals).where(eq(regionals.id, input.entityId));
      if (!regional) throw new TRPCError({ code: "NOT_FOUND", message: "Regional não encontrada." });
    }
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "O arquivo deve ter até 5 MB." });
    const filename = safeName(input.originalName);
    const stored = await storagePut(`trade/${input.entityType}/${input.entityId}/${filename}`, bytes, input.mimeType);
    const [created] = await database.insert(documents).values({ regionalId: input.regionalId, entityType: input.entityType, entityId: input.entityId, storageKey: stored.key, url: stored.url, originalName: filename, mimeType: input.mimeType, sizeBytes: bytes.length, uploadedByUserId: ctx.user.id }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: input.regionalId, entityType: "document", entityId: created.id, action: "upload", afterData: { entityType: input.entityType, entityId: input.entityId, originalName: filename } });
    return created;
  }),
});
