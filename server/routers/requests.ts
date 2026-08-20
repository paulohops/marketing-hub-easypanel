import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ilike, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  actions,
  cities,
  events,
  mediaCampaigns,
  mediaPoints,
  regionals,
  requestHistory,
  requests,
  users,
} from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const requestTypes = ["action", "event", "media", "finance", "other"] as const;
const requestStatuses = ["draft", "submitted", "in_review", "approved", "rejected", "in_progress", "completed", "cancelled"] as const;
const requestPriorities = ["low", "normal", "high", "urgent"] as const;
const requestLinkTypes = ["action", "event", "media_point", "media_campaign"] as const;
const requestedByUsers = alias(users, "request_requested_by_users");
const assignedToUsers = alias(users, "request_assigned_to_users");
const campaignMediaPoints = alias(mediaPoints, "request_campaign_media_points");

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
  linkedEntityType: z.enum(requestLinkTypes).nullable().optional(),
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

async function validateLinkedEntity(database: NonNullable<Database>, input: Pick<z.infer<typeof requestFields>, "linkedEntityType" | "linkedEntityId">) {
  if (!input.linkedEntityType && input.linkedEntityId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione o tipo do registro vinculado." });
  }
  if (input.linkedEntityType && !input.linkedEntityId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione o registro operacional vinculado." });
  }
  if (!input.linkedEntityType || !input.linkedEntityId) return;

  const entityExists = input.linkedEntityType === "action"
    ? await database.select({ id: actions.id }).from(actions).where(eq(actions.id, input.linkedEntityId)).limit(1)
    : input.linkedEntityType === "event"
      ? await database.select({ id: events.id }).from(events).where(eq(events.id, input.linkedEntityId)).limit(1)
      : input.linkedEntityType === "media_point"
        ? await database.select({ id: mediaPoints.id }).from(mediaPoints).where(eq(mediaPoints.id, input.linkedEntityId)).limit(1)
        : await database.select({ id: mediaCampaigns.id }).from(mediaCampaigns).where(eq(mediaCampaigns.id, input.linkedEntityId)).limit(1);

  if (!entityExists.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O registro operacional vinculado não existe mais." });
  }
}

async function validateReferences(
  database: NonNullable<Database>,
  input: Pick<z.infer<typeof requestFields>, "assignedToUserId" | "regionalId" | "cityId" | "linkedEntityType" | "linkedEntityId">
) {
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
  await validateLinkedEntity(database, input);
}

function normaliseInput(input: z.infer<typeof requestFields>) {
  const linkedEntityId = input.linkedEntityId ?? null;
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
    linkedEntityType: input.linkedEntityType ?? null,
    linkedEntityId,
    actionId: input.linkedEntityType === "action" ? linkedEntityId : null,
    eventId: input.linkedEntityType === "event" ? linkedEntityId : null,
    mediaPointId: input.linkedEntityType === "media_point" ? linkedEntityId : null,
    mediaCampaignId: input.linkedEntityType === "media_campaign" ? linkedEntityId : null,
  };
}

function getLinkedMeta(row: {
  request: typeof requests.$inferSelect;
  actionName: string | null;
  eventName: string | null;
  mediaPointName: string | null;
  mediaPointChannelKind: "standard" | "external" | null;
  mediaCampaignName: string | null;
  campaignMediaPointName: string | null;
  campaignMediaPointChannelKind: "standard" | "external" | null;
}) {
  const { request } = row;
  if (request.linkedEntityType === "action" && request.actionId) return { linkedLabel: row.actionName, linkedHref: `/acoes/${request.actionId}` };
  if (request.linkedEntityType === "event" && request.eventId) return { linkedLabel: row.eventName, linkedHref: `/eventos/${request.eventId}` };
  if (request.linkedEntityType === "media_point" && request.mediaPointId) {
    const prefix = row.mediaPointChannelKind === "external" ? "/midias/externa" : "/midias";
    return { linkedLabel: row.mediaPointName, linkedHref: `${prefix}/${request.mediaPointId}` };
  }
  if (request.linkedEntityType === "media_campaign" && request.mediaCampaignId) {
    const prefix = row.campaignMediaPointChannelKind === "external" ? "/midias/externa/veiculacao" : "/midias/veiculacao";
    return { linkedLabel: row.mediaCampaignName || row.campaignMediaPointName, linkedHref: `${prefix}/${request.mediaCampaignId}` };
  }
  return { linkedLabel: null, linkedHref: null };
}

export const requestsRouter = router({
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "requests.read");
    const database = await requireDatabase();
    const [userRows, regionalRows, cityRows, actionRows, eventRows, mediaPointRows, mediaCampaignRows] = await Promise.all([
      database.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)),
      database.select({ id: regionals.id, name: regionals.name }).from(regionals).where(eq(regionals.active, true)).orderBy(asc(regionals.name)),
      database.select({ id: cities.id, name: cities.name, state: cities.state, regionalId: cities.regionalId, regionalName: regionals.name }).from(cities).innerJoin(regionals, eq(cities.regionalId, regionals.id)).where(eq(cities.active, true)).orderBy(asc(cities.name)),
      database.select({ id: actions.id, name: actions.name, status: actions.status, cityId: actions.cityId }).from(actions).orderBy(asc(actions.name)).limit(250),
      database.select({ id: events.id, name: events.name, status: events.status, cityId: events.cityId }).from(events).orderBy(asc(events.name)).limit(250),
      database.select({ id: mediaPoints.id, name: mediaPoints.name, status: mediaPoints.status, channelKind: mediaPoints.channelKind, cityId: mediaPoints.cityId }).from(mediaPoints).orderBy(asc(mediaPoints.name)).limit(250),
      database.select({ id: mediaCampaigns.id, name: mediaCampaigns.name, status: mediaCampaigns.status, mediaPointId: mediaCampaigns.mediaPointId, mediaPointName: mediaPoints.name }).from(mediaCampaigns).leftJoin(mediaPoints, eq(mediaCampaigns.mediaPointId, mediaPoints.id)).orderBy(asc(mediaCampaigns.name)).limit(250),
    ]);
    return { users: userRows, regionals: regionalRows, cities: cityRows, actions: actionRows, events: eventRows, mediaPoints: mediaPointRows, mediaCampaigns: mediaCampaignRows, types: requestTypes, statuses: requestStatuses, priorities: requestPriorities, linkTypes: requestLinkTypes };
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
      filters.push(or(ilike(requests.title, search), ilike(requests.description, search), ilike(requestedByUsers.name, search), ilike(assignedToUsers.name, search), ilike(cities.name, search), ilike(actions.name, search), ilike(events.name, search), ilike(mediaPoints.name, search), ilike(mediaCampaigns.name, search)));
    }
    const rows = await database.select({ request: requests, requesterName: requestedByUsers.name, requesterEmail: requestedByUsers.email, assigneeName: assignedToUsers.name, regionalName: regionals.name, cityName: cities.name, cityState: cities.state, actionName: actions.name, eventName: events.name, mediaPointName: mediaPoints.name, mediaPointChannelKind: mediaPoints.channelKind, mediaCampaignName: mediaCampaigns.name, campaignMediaPointName: campaignMediaPoints.name, campaignMediaPointChannelKind: campaignMediaPoints.channelKind }).from(requests).leftJoin(requestedByUsers, eq(requests.requestedByUserId, requestedByUsers.id)).leftJoin(assignedToUsers, eq(requests.assignedToUserId, assignedToUsers.id)).leftJoin(regionals, eq(requests.regionalId, regionals.id)).leftJoin(cities, eq(requests.cityId, cities.id)).leftJoin(actions, eq(requests.actionId, actions.id)).leftJoin(events, eq(requests.eventId, events.id)).leftJoin(mediaPoints, eq(requests.mediaPointId, mediaPoints.id)).leftJoin(mediaCampaigns, eq(requests.mediaCampaignId, mediaCampaigns.id)).leftJoin(campaignMediaPoints, eq(mediaCampaigns.mediaPointId, campaignMediaPoints.id)).where(filters.length ? and(...filters) : undefined).orderBy(desc(requests.updatedAt), asc(requests.title));
    return rows.map(row => ({ ...row.request, requesterName: row.requesterName ?? null, requesterEmail: row.requesterEmail ?? null, assigneeName: row.assigneeName ?? null, regionalName: row.regionalName ?? null, cityName: row.cityName ?? null, cityState: row.cityState ?? null, ...getLinkedMeta(row) }));
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
    const linkChanged = before.linkedEntityType !== data.linkedEntityType || before.linkedEntityId !== data.linkedEntityId;
    const updated = await database.transaction(async tx => {
      const [request] = await tx.update(requests).set({ ...data, completedAt, updatedAt: new Date() }).where(eq(requests.id, id)).returning();
      if (before.status !== request.status || before.assignedToUserId !== request.assignedToUserId || linkChanged || statusNote?.trim()) {
        const defaultNote = linkChanged ? "Registro operacional vinculado atualizado" : before.assignedToUserId !== request.assignedToUserId ? "Responsável atualizado" : null;
        await tx.insert(requestHistory).values({ requestId: request.id, actorUserId: ctx.user.id, action: before.status !== request.status ? "status_changed" : "updated", fromStatus: before.status, toStatus: request.status, note: statusNote?.trim() || defaultNote });
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
