import { and, asc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  actionPoints,
  actions,
  auditLogs,
  cities,
  commercialSupervisors,
  documents,
  events,
  eventServices,
  eventStockItems,
  eventSuppliers,
  eventTeamMembers,
  eventTypes,
  invoices,
  payments,
  requests,
  regionals,
  serviceTypes,
  stockItems,
  supplierCities,
  suppliers,
  tradeCampaigns,
  users,
} from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

async function requireDatabase() {
  const database = await getDb();
  if (!database) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  }
  return database;
}

const allocationSchema = z.object({
  stockItemId: z.number().int().positive(),
  quantity: z.coerce.number().positive().max(99999999),
});

const eventDetailsInput = z.object({
  cityId: z.number().int().positive(),
  eventTypeId: z.number().int().positive(),
  campaignId: z.number().int().positive().nullable().optional(),
  actionPointId: z.number().int().positive().nullable().default(null),
  name: z.string().trim().min(2).max(180),
  address: z.string().trim().max(2000).optional(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable(),
  commercialSupervisorId: z.number().int().positive().nullable(),
  partnershipType: z.enum(["paid", "barter", "mixed"]),
  estimatedCost: z.coerce.number().finite().min(0).max(99999999999),
  partnershipReason: z.string().trim().max(2000).optional(),
  preEventNotes: z.string().trim().max(3000).optional(),
  supplierIds: z.array(z.number().int().positive()).max(20),
  serviceTypeIds: z.array(z.number().int().positive()).max(20),
  teamMemberIds: z.array(z.number().int().positive()).max(40),
  stockAllocations: z.array(allocationSchema).max(40),
});

export function validEventRange(startsAt: Date, endsAt: Date | null) {
  return !endsAt || endsAt >= startsAt;
}

export function normalizeEventStockAllocations(allocations: Array<{ stockItemId: number; quantity: number }>) {
  return Array.from(new Map(allocations.map(allocation => [allocation.stockItemId, allocation])).values());
}

async function ensureEventReferences(
  database: any,
  input: Pick<z.infer<typeof eventDetailsInput>, "cityId" | "eventTypeId" | "campaignId" | "actionPointId" | "commercialSupervisorId" | "supplierIds" | "serviceTypeIds" | "teamMemberIds" | "stockAllocations">
) {
  const checks = [
    { ids: [input.cityId], table: cities, column: cities.id, activeColumn: cities.active, label: "cidade" },
    { ids: [input.eventTypeId], table: eventTypes, column: eventTypes.id, activeColumn: eventTypes.active, label: "tipo de evento" },
    { ids: input.commercialSupervisorId ? [input.commercialSupervisorId] : [], table: commercialSupervisors, column: commercialSupervisors.id, activeColumn: commercialSupervisors.active, label: "supervisor comercial" },
    { ids: input.supplierIds, table: suppliers, column: suppliers.id, activeColumn: suppliers.active, label: "fornecedor" },
    { ids: input.serviceTypeIds, table: serviceTypes, column: serviceTypes.id, activeColumn: serviceTypes.active, label: "serviço" },
    { ids: input.teamMemberIds, table: users, column: users.id, activeColumn: users.isActive, label: "responsável do trade" },
    { ids: input.stockAllocations.map(allocation => allocation.stockItemId), table: stockItems, column: stockItems.id, activeColumn: stockItems.active, label: "recurso de estoque" },
  ];

  await Promise.all(checks.map(async check => {
    const ids = Array.from(new Set(check.ids));
    if (!ids.length) return;
    const rows = await database.select({ id: check.column }).from(check.table).where(and(inArray(check.column, ids), eq(check.activeColumn, true)));
    if (rows.length !== ids.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Vínculo de ${check.label} inexistente ou indisponível.` });
    }
  }));

  if (input.campaignId) {
    const [campaign] = await database.select({ id: tradeCampaigns.id }).from(tradeCampaigns).where(eq(tradeCampaigns.id, input.campaignId));
    if (!campaign) throw new TRPCError({ code: "BAD_REQUEST", message: "Campanha inexistente." });
  }

  const [selectedCity] = await database.select({ id: cities.id, regionalId: cities.regionalId }).from(cities).where(eq(cities.id, input.cityId));
  if (input.actionPointId) {
    const [point] = await database.select({ id: actionPoints.id }).from(actionPoints).where(and(eq(actionPoints.id, input.actionPointId), eq(actionPoints.cityId, input.cityId), eq(actionPoints.active, true))).limit(1);
    if (!point) throw new TRPCError({ code: "BAD_REQUEST", message: "O ponto de ação selecionado não existe, está inativo ou pertence a outra cidade." });
  }

  const supplierIds = Array.from(new Set(input.supplierIds));
  if (supplierIds.length) {
    const coverage = await database.select({ supplierId: supplierCities.supplierId }).from(supplierCities).where(and(eq(supplierCities.cityId, input.cityId), inArray(supplierCities.supplierId, supplierIds)));
    if (new Set(coverage.map((row: { supplierId: number }) => row.supplierId)).size !== supplierIds.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Há fornecedor selecionado sem cobertura para a cidade do evento." });
    }
  }

  const stockIds = Array.from(new Set(input.stockAllocations.map(allocation => allocation.stockItemId)));
  if (stockIds.length && selectedCity) {
    const allocatedStock = await database.select({ id: stockItems.id, regionalId: stockItems.regionalId, cityId: stockItems.cityId }).from(stockItems).where(inArray(stockItems.id, stockIds));
    if (allocatedStock.some((item: { regionalId: number; cityId: number | null }) => item.regionalId !== selectedCity.regionalId || (item.cityId !== null && item.cityId !== input.cityId))) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Os itens de estoque devem pertencer à regional e à cidade selecionadas para o evento." });
    }
  }
}

async function replaceEventLinks(database: any, eventId: number, input: z.infer<typeof eventDetailsInput>, stockAllocations: Array<{ stockItemId: number; quantity: number }>) {
  await database.delete(eventSuppliers).where(eq(eventSuppliers.eventId, eventId));
  await database.delete(eventServices).where(eq(eventServices.eventId, eventId));
  await database.delete(eventTeamMembers).where(eq(eventTeamMembers.eventId, eventId));
  await database.delete(eventStockItems).where(eq(eventStockItems.eventId, eventId));
  if (input.supplierIds.length) await database.insert(eventSuppliers).values(Array.from(new Set(input.supplierIds)).map(supplierId => ({ eventId, supplierId })));
  if (input.serviceTypeIds.length) await database.insert(eventServices).values(Array.from(new Set(input.serviceTypeIds)).map(serviceTypeId => ({ eventId, serviceTypeId })));
  if (input.teamMemberIds.length) await database.insert(eventTeamMembers).values(Array.from(new Set(input.teamMemberIds)).map(userId => ({ eventId, userId })));
  if (stockAllocations.length) await database.insert(eventStockItems).values(stockAllocations.map(allocation => ({ eventId, stockItemId: allocation.stockItemId, plannedQuantity: allocation.quantity.toFixed(2) })));
}

export const eventsRouter = router({
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "events.read");
    const database = await requireDatabase();
    const [cityRows, typeRows, campaignRows, supplierRows, serviceRows, supervisorRows, teamRows, stockRows, actionPointRows, supplierCityRows] = await Promise.all([
      database.select({ city: cities, regionalName: regionals.name }).from(cities).innerJoin(regionals, eq(cities.regionalId, regionals.id)).where(eq(cities.active, true)).orderBy(asc(regionals.name), asc(cities.name)).catch(() => []),
      database.select().from(eventTypes).where(eq(eventTypes.active, true)).orderBy(asc(eventTypes.name)).catch(() => []),
      database.select({ id: tradeCampaigns.id, name: tradeCampaigns.name, regionalId: tradeCampaigns.regionalId, status: tradeCampaigns.status }).from(tradeCampaigns).orderBy(asc(tradeCampaigns.name)).catch(() => []),
      database.select().from(suppliers).where(eq(suppliers.active, true)).orderBy(asc(suppliers.displayName)).catch(() => []),
      database.select().from(serviceTypes).where(eq(serviceTypes.active, true)).orderBy(asc(serviceTypes.name)).catch(() => []),
      database.select().from(commercialSupervisors).where(eq(commercialSupervisors.active, true)).orderBy(asc(commercialSupervisors.name)).catch(() => []),
      database.select({ id: users.id, name: users.name, email: users.email, jobTitle: users.jobTitle }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)).catch(() => []),
      database.select({ id: stockItems.id, name: stockItems.name, sku: stockItems.sku, unit: stockItems.unit, cityId: stockItems.cityId, regionalId: stockItems.regionalId }).from(stockItems).where(eq(stockItems.active, true)).orderBy(asc(stockItems.name)).catch(() => []),
      database.select().from(actionPoints).where(eq(actionPoints.active, true)).orderBy(asc(actionPoints.name)).catch(() => []),
      database.select({ supplierId: supplierCities.supplierId, cityId: supplierCities.cityId }).from(supplierCities).catch(() => []),
    ]);
    return { cities: cityRows, eventTypes: typeRows, campaigns: campaignRows, suppliers: supplierRows, serviceTypes: serviceRows, supervisors: supervisorRows, teamUsers: teamRows, stockItems: stockRows, actionPoints: actionPointRows, supplierCities: supplierCityRows };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "events.read");
    const database = await requireDatabase();
    const [rows, teamRows, stockRows, supplierRows, serviceRows, invoiceRows, paymentRows] = await Promise.all([
      database.select({ event: events, cityName: cities.name, eventTypeName: eventTypes.name, campaignName: tradeCampaigns.name, campaignLogoUrl: tradeCampaigns.logoUrl, supervisorName: commercialSupervisors.name, actionPointName: actionPoints.name, actionPointAddress: actionPoints.address }).from(events).innerJoin(cities, eq(events.cityId, cities.id)).innerJoin(eventTypes, eq(events.eventTypeId, eventTypes.id)).leftJoin(tradeCampaigns, eq(events.tradeCampaignId, tradeCampaigns.id)).leftJoin(commercialSupervisors, eq(events.commercialSupervisorId, commercialSupervisors.id)).leftJoin(actionPoints, eq(events.actionPointId, actionPoints.id)).orderBy(asc(events.startsAt), asc(events.id)),
      database.select({ eventId: eventTeamMembers.eventId, userId: users.id, name: users.name, jobTitle: users.jobTitle, avatarUrl: users.avatarUrl }).from(eventTeamMembers).innerJoin(users, eq(eventTeamMembers.userId, users.id)),
      database.select({ eventId: eventStockItems.eventId, stockItemId: stockItems.id, name: stockItems.name, unit: stockItems.unit, plannedQuantity: eventStockItems.plannedQuantity }).from(eventStockItems).innerJoin(stockItems, eq(eventStockItems.stockItemId, stockItems.id)),
      database.select({ eventId: eventSuppliers.eventId, supplierId: suppliers.id, name: suppliers.displayName, photoUrl: suppliers.photoUrl, mainService: suppliers.mainService }).from(eventSuppliers).innerJoin(suppliers, eq(eventSuppliers.supplierId, suppliers.id)),
      database.select({ eventId: eventServices.eventId, serviceTypeId: serviceTypes.id, name: serviceTypes.name }).from(eventServices).innerJoin(serviceTypes, eq(eventServices.serviceTypeId, serviceTypes.id)),
      database.select({ id: invoices.id, operationId: invoices.operationId, amount: invoices.amount, status: invoices.status }).from(invoices).where(eq(invoices.operationType, "event")),
      database.select({ invoiceId: payments.invoiceId, amount: payments.amount }).from(payments),
    ]);
    const eventIds = rows.map(row => row.event.id);
    if (!eventIds.length) return [];
    const [historyRows, documentRows] = await Promise.all([
      database.select({ eventId: auditLogs.entityId, id: auditLogs.id, auditAction: auditLogs.action, occurredAt: auditLogs.occurredAt, actorName: users.name, afterData: auditLogs.afterData }).from(auditLogs).leftJoin(users, eq(auditLogs.actorUserId, users.id)).where(and(eq(auditLogs.entityType, "event"), inArray(auditLogs.entityId, eventIds))).orderBy(asc(auditLogs.occurredAt)),
      database.select({ eventId: documents.entityId, id: documents.id, url: documents.url, originalName: documents.originalName, mimeType: documents.mimeType, createdAt: documents.createdAt }).from(documents).where(and(eq(documents.entityType, "event"), inArray(documents.entityId, eventIds))).orderBy(asc(documents.createdAt)),
    ]);
    return rows.map(row => {
      const linkedInvoices = invoiceRows.filter(invoice => invoice.operationId === row.event.id && invoice.status !== "cancelled");
      const paidAmount = linkedInvoices.reduce((total, invoice) => total + paymentRows.filter(payment => payment.invoiceId === invoice.id).reduce((subtotal, payment) => subtotal + Number(payment.amount), 0), 0);
      const estimatedAmount = Number(row.event.estimatedCost);
      return {
        ...row,
        finance: { estimatedAmount, invoicedAmount: linkedInvoices.reduce((total, invoice) => total + Number(invoice.amount), 0), paidAmount, remainingAmount: estimatedAmount - paidAmount },
        teamMembers: teamRows.filter(member => member.eventId === row.event.id),
        stockItems: stockRows.filter(item => item.eventId === row.event.id),
        suppliers: supplierRows.filter(supplier => supplier.eventId === row.event.id),
        services: serviceRows.filter(service => service.eventId === row.event.id),
        history: historyRows.filter(item => item.eventId === row.event.id),
        documents: documentRows.filter(item => item.eventId === row.event.id),
      };
    });
  }),

  create: protectedProcedure.input(eventDetailsInput).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "events.write");
    if (!validEventRange(input.startsAt, input.endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O término do evento deve ser posterior ao início." });
    const database = await requireDatabase();
    await ensureEventReferences(database, input);
    const stockAllocations = normalizeEventStockAllocations(input.stockAllocations);
    const created = await database.transaction(async transaction => {
      const [event] = await transaction.insert(events).values({ cityId: input.cityId, eventTypeId: input.eventTypeId, tradeCampaignId: input.campaignId ?? null, actionPointId: input.actionPointId ?? null, name: input.name, address: input.address || null, latitude: input.latitude?.toFixed(7) ?? null, longitude: input.longitude?.toFixed(7) ?? null, startsAt: input.startsAt, endsAt: input.endsAt, commercialSupervisorId: input.commercialSupervisorId, partnershipType: input.partnershipType, estimatedCost: input.estimatedCost.toFixed(2), partnershipReason: input.partnershipReason || null, preEventNotes: input.preEventNotes || null }).returning();
      await replaceEventLinks(transaction, event.id, input, stockAllocations);
      await writeAuditLog({ actorUserId: ctx.user.id, entityType: "event", entityId: event.id, action: "create", afterData: { ...event, actionPointId: input.actionPointId, teamMemberIds: input.teamMemberIds, stockAllocations } }, transaction);
      return event;
    });
    return created;
  }),

  updateDetails: protectedProcedure.input(eventDetailsInput.extend({ eventId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "events.write");
    if (!validEventRange(input.startsAt, input.endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O término do evento deve ser posterior ao início." });
    const database = await requireDatabase();
    const [before] = await database.select().from(events).where(eq(events.id, input.eventId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." });
    await ensureEventReferences(database, input);
    const stockAllocations = normalizeEventStockAllocations(input.stockAllocations);
    return database.transaction(async transaction => {
      const [updated] = await transaction.update(events).set({ cityId: input.cityId, eventTypeId: input.eventTypeId, tradeCampaignId: input.campaignId ?? null, actionPointId: input.actionPointId ?? null, name: input.name, address: input.address || null, latitude: input.latitude?.toFixed(7) ?? null, longitude: input.longitude?.toFixed(7) ?? null, startsAt: input.startsAt, endsAt: input.endsAt, commercialSupervisorId: input.commercialSupervisorId, partnershipType: input.partnershipType, estimatedCost: input.estimatedCost.toFixed(2), partnershipReason: input.partnershipReason || null, preEventNotes: input.preEventNotes || null, updatedAt: new Date() }).where(eq(events.id, input.eventId)).returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." });
      await replaceEventLinks(transaction, input.eventId, input, stockAllocations);
      await writeAuditLog({ actorUserId: ctx.user.id, entityType: "event", entityId: input.eventId, action: "update", beforeData: before, afterData: { ...updated, actionPointId: input.actionPointId, teamMemberIds: input.teamMemberIds, stockAllocations } }, transaction);
      return updated;
    });
  }),

  delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "events.write");
    const database = await requireDatabase();
    const [before] = await database.select().from(events).where(eq(events.id, input.id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." });
    if (before.status !== "planned" && before.status !== "cancelled") throw new TRPCError({ code: "CONFLICT", message: "Somente eventos planejados ou cancelados podem ser excluídos. Preserve o histórico de eventos em andamento ou concluídos." });
    const [linkedAction, linkedRequest, linkedInvoice, linkedDocument] = await Promise.all([
      database.select({ id: actions.id }).from(actions).where(eq(actions.eventId, input.id)).limit(1),
      database.select({ id: requests.id }).from(requests).where(eq(requests.eventId, input.id)).limit(1),
      database.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.operationType, "event"), eq(invoices.operationId, input.id))).limit(1),
      database.select({ id: documents.id }).from(documents).where(and(eq(documents.entityType, "event"), eq(documents.entityId, input.id))).limit(1),
    ]);
    if (linkedAction[0] || linkedRequest[0] || linkedInvoice[0] || linkedDocument[0]) throw new TRPCError({ code: "CONFLICT", message: "Este evento possui ações, solicitações, faturas ou evidências vinculadas. Remova ou encerre esses vínculos de forma independente para preservar o histórico." });
    await database.transaction(async transaction => {
      await transaction.delete(eventTeamMembers).where(eq(eventTeamMembers.eventId, input.id));
      await transaction.delete(eventStockItems).where(eq(eventStockItems.eventId, input.id));
      await transaction.delete(eventSuppliers).where(eq(eventSuppliers.eventId, input.id));
      await transaction.delete(eventServices).where(eq(eventServices.eventId, input.id));
      await transaction.delete(events).where(eq(events.id, input.id));
    });
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "event", entityId: input.id, action: "delete", beforeData: before });
    return { success: true } as const;
  }),

  savePostEvent: protectedProcedure.input(z.object({ eventId: z.number().int().positive(), postEventNotes: z.string().trim().max(3000).optional(), resultSummary: z.string().trim().max(3000).optional(), notes: z.string().trim().max(3000).optional(), positives: z.string().trim().max(3000).optional(), negatives: z.string().trim().max(3000).optional(), leadCount: z.number().int().min(0).max(999999999).default(0), saleCount: z.number().int().min(0).max(999999999).default(0), renewalCount: z.number().int().min(0).max(999999999).default(0), completedAt: z.coerce.date().nullable().optional(), rating: z.number().int().min(1).max(5).nullable(), resultAchieved: z.boolean().nullable(), worthRenewing: z.boolean().nullable(), status: z.enum(["planned", "in_progress", "paused", "completed", "cancelled"]) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "events.write");
    const database = await requireDatabase();
    const completedAt = input.status === "completed" ? input.completedAt ?? new Date() : input.completedAt ?? null;
    const [updated] = await database.update(events).set({ postEventNotes: input.postEventNotes || input.notes || null, resultSummary: input.resultSummary || null, positives: input.positives || null, negatives: input.negatives || null, leadCount: input.leadCount, saleCount: input.saleCount, renewalCount: input.renewalCount, completedAt, rating: input.rating, resultAchieved: input.resultAchieved, worthRenewing: input.worthRenewing, status: input.status, updatedAt: new Date() }).where(eq(events.id, input.eventId)).returning();
    if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." });
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "event", entityId: updated.id, action: "update", afterData: updated });
    return updated;
  }),
});
