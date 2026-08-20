import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { cities, regionals, requestHistory, requests, users } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const requestTypes = ["action", "event", "media", "finance", "other"] as const;
const requestStatuses = ["draft", "submitted", "in_review", "approved", "rejected", "in_progress", "completed", "cancelled"] as const;
const requestPriorities = ["low", "normal", "high", "urgent"] as const;
const requestedByUsers = alias(users, "request_requested_by_users");
const assignedToUsers = alias(users, "request_assigned_to_users");

const requestFields = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(12_000).nullable().optional(),
  requestType: z.enum(requestTypes).default("action"),
  status: z.enum(requestStatuses).default("submitted"),
  priority: z.enum(requestPriorities).default("normal"),
  assignedToUserId: z.number().int().positive().nullable().optional(),
  regionalId: z.number().int().positive().nullable().optional(),
  cityId: z.number().int().positive().nullable().optional(),
  requestedForDate: z.string().date().nullable().optional(),
  dueDate: z.string().date().nullable().optional(),
  linkedEntityType: z.string().trim().max(64).nullable().optional(),
  linkedEntityId: z.number().int().positive().nullable().optional(),
});

type Database = Awaited<ReturnType<typeof getDb>>;

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

function nullable(value: string | null | undefined) {
  return value?.trim() || null;
}

async function validateReferences(database: NonNullable<Database>, input: Pick<z.infer<typeof requestFields>, "assignedToUserId" | "regionalId" | "cityId">) {
  if (input.assignedToUserId) {
    const [assignee] = await database.select({ id: users.id }).from(users).where(and(eq(users.id, input.assignedToUserId), eq(users.isActive, true))).limit(1);
    if (!assignee) throw new TRPCError({ code: "BAD_REQUEST", message: "O responsável selecionado não existe ou está inativo." });
  }
  if (input.regionalId) {
    const [regional] = await database.select({ id: regionals.id }).from(regionals).where(and(eq(regionals.id, input.regionalId), eq(regionals.active, true))).limit(1);
    if (!regional) throw new TRPCError({ code: "BAD_REQUEST", message: "A regional selecionada não existe ou está inativa." });
  }
  if (input.cityId) {
    const [city] = await database.select({ id: cities.id, regionalId: cities.regionalId }).from(cities).where(and(eq(cities.id, input.cityId), eq(cities.active, true))).limit(1);
    if (!city) throw new TRPCError({ code: "BAD_REQUEST", message: "A cidade selecionada não existe ou está inativa." });
    if (input.regionalId && city.regionalId !== input.regionalId) throw new TRPCError({ code: "BAD_REQUEST", message: "A cidade selecionada não pertence à regional informada." });
  }
}

function normaliseInput(input: z.infer<typeof requestFields>) {
  return {
    title: input.title.trim(),
    description: nullable(input.description),
    requestType: input.requestType,
    status: input.status,
    priority: input.priority,
    assignedToUserId: input.assignedToUserId ?? null,
    regionalId: input.regionalId ?? null,
    cityId: input.cityId ?? null,
    requestedForDate: input.requestedForDate ?? null,
    dueDate: input.dueDate ?? null,
    linkedEntityType: nullable(input.linkedEntityType),
    linkedEntityId: input.linkedEntityId ?? null,
  };
}

export const requestsRouter = router({
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "requests.read");
    const database = await requireDatabase();
    const [userRows, regionalRows, cityRows] = await Promise.all([
      database.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)),
      database.select({ id: regionals.id, name: regionals.name }).from(regionals).where(eq(regionals.active, true)).orderBy(asc(regionals.name)),
      database.select({ id: cities.id, name: cities.name, state: cities.state, regionalId: cities.regionalId, regionalName: regionals.name }).from(cities).innerJoin(regionals, eq(cities.regionalId, regionals.id)).where(eq(cities.active, true)).orderBy(asc(cities.name)),
    ]);
    return { users: userRows, regionals: regionalRows, cities: cityRows, types: requestTypes, statuses: requestStatuses, priorities: requestPriorities };
  }),

  list: protectedProcedure.input(z.object({ search: z.string().trim().max(120).optional(), requestType: z.enum(requestTypes).optional(), status: z.enum(requestStatuses).optional(), priority: z.enum(requestPriorities).optional() }).optional()).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "requests.read");
    const database = await requireDatabase();
    const filters = [];
    if (input?.requestType) filters.push(eq(requests.requestType, input.requestType));
    if (input?.status) filters.push(eq(requests.status, input.status));
    if (input?.priority) filters.push(eq(requests.priority, input.priority));
    if (input?.search) {
      const search = `%${input.search}%`;
      filters.push(or(ilike(requests.title, search), ilike(requests.description, search), ilike(requestedByUsers.name, search), ilike(assignedToUsers.name, search), ilike(cities.name, search)));
    }
    const rows = await database.select({ request: requests, requesterName: requestedByUsers.name, requesterEmail: requestedByUsers.email, assigneeName: assignedToUsers.name, regionalName: regionals.name, cityName: cities.name, cityState: cities.state }).from(requests).leftJoin(requestedByUsers, eq(requests.requestedByUserId, requestedByUsers.id)).leftJoin(assignedToUsers, eq(requests.assignedToUserId, assignedToUsers.id)).leftJoin(regionals, eq(requests.regionalId, regionals.id)).leftJoin(cities, eq(requests.cityId, cities.id)).where(filters.length ? and(...filters) : undefined).orderBy(desc(requests.updatedAt), asc(requests.title));
    return rows.map(row => ({ ...row.request, requesterName: row.requesterName ?? null, requesterEmail: row.requesterEmail ?? null, assigneeName: row.assigneeName ?? null, regionalName: row.regionalName ?? null, cityName: row.cityName ?? null, cityState: row.cityState ?? null }));
  }),

  history: protectedProcedure.input(z.object({ requestId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "requests.read");
    const database = await requireDatabase();
    return database.select({ id: requestHistory.id, requestId: requestHistory.requestId, action: requestHistory.action, fromStatus: requestHistory.fromStatus, toStatus: requestHistory.toStatus, note: requestHistory.note, createdAt: requestHistory.createdAt, actorName: users.name }).from(requestHistory).leftJoin(users, eq(requestHistory.actorUserId, users.id)).where(eq(requestHistory.requestId, input.requestId)).orderBy(desc(requestHistory.createdAt));
  }),

  create: protectedProcedure.input(requestFields).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "requests.create");
    const database = await requireDatabase();
    const data = normaliseInput(input);
    await validateReferences(database, data);
    const created = await database.transaction(async tx => {
      const [request] = await tx.insert(requests).values({ ...data, requestedByUserId: ctx.user.id }).returning();
      await tx.insert(requestHistory).values({ requestId: request.id, actorUserId: ctx.user.id, action: "created", toStatus: request.status, note: "Solicitação criada" });
      return request;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: created.regionalId, entityType: "request", entityId: created.id, action: "create", afterData: data });
    return created;
  }),

  update: protectedProcedure.input(requestFields.extend({ id: z.number().int().positive(), statusNote: z.string().trim().max(2_000).nullable().optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "requests.update");
    const database = await requireDatabase();
    const { id, statusNote, ...fields } = input;
    const [before] = await database.select().from(requests).where(eq(requests.id, id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Solicitação não encontrada." });
    const data = normaliseInput(fields);
    await validateReferences(database, data);
    const completedAt = data.status === "completed" ? before.completedAt ?? new Date() : null;
    const updated = await database.transaction(async tx => {
      const [request] = await tx.update(requests).set({ ...data, completedAt, updatedAt: new Date() }).where(eq(requests.id, id)).returning();
      if (before.status !== request.status || before.assignedToUserId !== request.assignedToUserId || statusNote?.trim()) {
        await tx.insert(requestHistory).values({ requestId: request.id, actorUserId: ctx.user.id, action: before.status !== request.status ? "status_changed" : "updated", fromStatus: before.status, toStatus: request.status, note: statusNote?.trim() || (before.assignedToUserId !== request.assignedToUserId ? "Responsável atualizado" : null) });
      }
      return request;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: updated.regionalId, entityType: "request", entityId: updated.id, action: "update", beforeData: before, afterData: { ...data, completedAt } });
    return updated;
  }),

  delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "requests.delete");
    const database = await requireDatabase();
    const [current] = await database.select().from(requests).where(eq(requests.id, input.id)).limit(1);
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Solicitação não encontrada." });
    await database.delete(requests).where(eq(requests.id, input.id));
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: current.regionalId, entityType: "request", entityId: current.id, action: "delete", beforeData: current });
    return { success: true };
  }),
});
