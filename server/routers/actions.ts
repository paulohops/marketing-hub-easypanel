import { and, asc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { actionDebriefs, actionPoints, actions, actionServices, actionStockItems, actionSuppliers, actionTeamMembers, actionTypes, auditLogs, cities, commercialSupervisors, documents, events, invoices, payments, regionals, serviceTypes, stockItems, stockMovements, supplierCities, supplierOfferings, supplierServiceTypes, suppliers, tradeCampaigns, users } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

async function requireDatabase() { const database = await getDb(); if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." }); return database; }

const allocationSchema = z.object({ stockItemId: z.number().int().positive(), quantity: z.coerce.number().int().positive().max(99999999) });
const serviceAllocationSchema = z.object({ serviceTypeId: z.number().int().positive(), supplierOfferingId: z.number().int().positive().nullable().optional(), estimatedAmount: z.coerce.number().finite().min(0).max(99999999999) });
const evidenceUrlSchema = z.string().trim().min(1).max(2_000).refine(value => value.startsWith("/manus-storage/") || /^https?:\/\//i.test(value), "Endereço de evidência inválido.");

async function calculateActionTotal(database: any, serviceAllocations: Array<{ estimatedAmount: number }>, stockAllocations: Array<{ stockItemId: number; quantity: number }>) {
  const servicesTotal = serviceAllocations.reduce((total, allocation) => total + allocation.estimatedAmount, 0);
  if (!stockAllocations.length) return servicesTotal;
  const movements = await database.select({ stockItemId: stockMovements.stockItemId, unitCost: stockMovements.unitCost, occurredAt: stockMovements.occurredAt }).from(stockMovements).where(inArray(stockMovements.stockItemId, stockAllocations.map(allocation => allocation.stockItemId)));
  const latestCosts = new Map<number, { amount: number; occurredAt: Date }>();
  for (const movement of movements) {
    if (movement.unitCost === null) continue;
    const current = latestCosts.get(movement.stockItemId);
    if (!current || movement.occurredAt > current.occurredAt) latestCosts.set(movement.stockItemId, { amount: Number(movement.unitCost), occurredAt: movement.occurredAt });
  }
  const stockTotal = stockAllocations.reduce((total, allocation) => total + allocation.quantity * (latestCosts.get(allocation.stockItemId)?.amount ?? 0), 0);
  return servicesTotal + stockTotal;
}

export function canUpdateActionStatus(currentStatus: string, nextStatus: string) {
  return ["planned", "in_progress", "paused", "completed", "cancelled"].includes(currentStatus) && ["planned", "in_progress", "paused", "completed", "cancelled"].includes(nextStatus);
}

export function validActionRange(startsAt: Date, endsAt: Date | null) {
  return !endsAt || endsAt >= startsAt;
}

export function normalizeStockAllocations(allocations: Array<{ stockItemId: number; quantity: number }>) {
  return Array.from(new Map(allocations.map(allocation => [allocation.stockItemId, allocation])).values());
}

export function normalizeServiceAllocations(allocations: Array<{ serviceTypeId: number; supplierOfferingId?: number | null; estimatedAmount: number }>) {
  return Array.from(new Map(allocations.map(allocation => [allocation.serviceTypeId, { ...allocation, supplierOfferingId: allocation.supplierOfferingId ?? null }])).values());
}

async function ensureActionReferences(database: any, input: { tradeCampaignId?: number | null; eventId?: number | null; cityId: number; actionTypeId: number; actionPointId: number | null; commercialSupervisorId: number | null; supplierIds: number[]; serviceTypeIds: number[]; serviceAllocations?: Array<{ supplierOfferingId?: number | null }>; teamMemberIds: number[]; stockAllocations: Array<{ stockItemId: number }> }) {
  const checks = [
    { ids: [input.cityId], table: cities, column: cities.id, activeColumn: cities.active, label: "cidade" },
    { ids: [input.actionTypeId], table: actionTypes, column: actionTypes.id, activeColumn: actionTypes.active, label: "tipo de ação" },
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
    if (rows.length !== ids.length) throw new TRPCError({ code: "BAD_REQUEST", message: `Vínculo de ${check.label} inexistente ou indisponível.` });
  }));
  const [selectedCity] = await database.select({ id: cities.id, regionalId: cities.regionalId }).from(cities).where(eq(cities.id, input.cityId));
  if (input.tradeCampaignId) {
    const [campaign] = await database.select({ id: tradeCampaigns.id, regionalId: tradeCampaigns.regionalId }).from(tradeCampaigns).where(eq(tradeCampaigns.id, input.tradeCampaignId));
    if (!campaign) throw new TRPCError({ code: "BAD_REQUEST", message: "Campanha inexistente." });
    if (campaign.regionalId && campaign.regionalId !== selectedCity?.regionalId) throw new TRPCError({ code: "BAD_REQUEST", message: "A campanha deve pertencer à mesma regional da cidade da ação." });
  }
  if (input.eventId) {
    const [event] = await database.select({ id: events.id, cityId: events.cityId, tradeCampaignId: events.tradeCampaignId, status: events.status }).from(events).where(eq(events.id, input.eventId)).limit(1);
    if (!event || event.status === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "Evento inexistente ou cancelado." });
    if (event.cityId !== input.cityId) throw new TRPCError({ code: "BAD_REQUEST", message: "O evento deve pertencer à mesma cidade da ação." });
    if (input.tradeCampaignId && event.tradeCampaignId && event.tradeCampaignId !== input.tradeCampaignId) throw new TRPCError({ code: "BAD_REQUEST", message: "A ação e o evento precisam pertencer à mesma campanha quando ambos estiverem vinculados." });
  }
  if (input.actionPointId) {
    const [point] = await database.select({ id: actionPoints.id, cityId: actionPoints.cityId }).from(actionPoints).where(eq(actionPoints.id, input.actionPointId));
    if (!point || point.cityId !== input.cityId) throw new TRPCError({ code: "BAD_REQUEST", message: "O ponto de ação deve pertencer à cidade selecionada." });
  }
  const supplierIds = Array.from(new Set(input.supplierIds));
  if (supplierIds.length) {
    const coverage = await database.select({ supplierId: supplierCities.supplierId }).from(supplierCities).where(and(eq(supplierCities.cityId, input.cityId), inArray(supplierCities.supplierId, supplierIds)));
    if (new Set(coverage.map((row: { supplierId: number }) => row.supplierId)).size !== supplierIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Há fornecedor selecionado sem cobertura para a cidade da ação." });
  }
  if (input.serviceTypeIds.length) {
    if (!supplierIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione ao menos um fornecedor antes de incluir serviços." });
    const offeredServices = await database.select({ serviceTypeId: supplierServiceTypes.serviceTypeId }).from(supplierServiceTypes).where(inArray(supplierServiceTypes.supplierId, supplierIds));
    const offeredServiceIds = new Set(offeredServices.map((service: { serviceTypeId: number }) => service.serviceTypeId));
    if (input.serviceTypeIds.some(serviceTypeId => !offeredServiceIds.has(serviceTypeId))) throw new TRPCError({ code: "BAD_REQUEST", message: "Há serviço selecionado que não é oferecido pelos fornecedores da ação." });
  }
  const selectedOfferingIds = Array.from(new Set((input.serviceAllocations ?? []).flatMap(allocation => allocation.supplierOfferingId ? [allocation.supplierOfferingId] : [])));
  if (selectedOfferingIds.length) {
    const offerings = await database.select({ id: supplierOfferings.id, supplierId: supplierOfferings.supplierId, kind: supplierOfferings.kind, active: supplierOfferings.active }).from(supplierOfferings).where(inArray(supplierOfferings.id, selectedOfferingIds));
    if (offerings.length !== selectedOfferingIds.length || offerings.some((offering: any) => !offering.active || offering.kind !== "service" || !supplierIds.includes(offering.supplierId))) throw new TRPCError({ code: "BAD_REQUEST", message: "A oferta selecionada deve estar ativa e pertencer a um fornecedor da ação." });
  }
  const stockIds = Array.from(new Set(input.stockAllocations.map(allocation => allocation.stockItemId)));
  if (stockIds.length && selectedCity) {
    const allocatedStock = await database.select({ id: stockItems.id, regionalId: stockItems.regionalId, cityId: stockItems.cityId }).from(stockItems).where(inArray(stockItems.id, stockIds));
    if (allocatedStock.some((item: { regionalId: number; cityId: number | null }) => item.regionalId !== selectedCity.regionalId || (item.cityId !== null && item.cityId !== input.cityId))) throw new TRPCError({ code: "BAD_REQUEST", message: "Os itens de estoque devem pertencer à regional e à cidade selecionadas para a ação." });
  }
}

export const actionsRouter = router({
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "actions.read");
    const database = await requireDatabase();
    const [cityRows, typeRows, supplierRows, serviceRows, supervisorRows, teamRows, stockRows, actionPointRows, supplierCityRows, supplierServiceTypeRows, campaignRows, eventRows, offeringRows] = await Promise.all([
      database.select({ city: cities, regionalName: regionals.name }).from(cities).innerJoin(regionals, eq(cities.regionalId, regionals.id)).where(eq(cities.active, true)).orderBy(asc(regionals.name), asc(cities.name)),
      database.select().from(actionTypes).where(eq(actionTypes.active, true)).orderBy(asc(actionTypes.name)),
      database.select().from(suppliers).where(eq(suppliers.active, true)).orderBy(asc(suppliers.displayName)),
      database.select().from(serviceTypes).where(eq(serviceTypes.active, true)).orderBy(asc(serviceTypes.name)),
      database.select().from(commercialSupervisors).where(eq(commercialSupervisors.active, true)).orderBy(asc(commercialSupervisors.name)),
      database.select({ id: users.id, name: users.name, email: users.email, jobTitle: users.jobTitle, avatarUrl: users.avatarUrl }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)),
      database.select({ id: stockItems.id, name: stockItems.name, sku: stockItems.sku, unit: stockItems.unit, cityId: stockItems.cityId, regionalId: stockItems.regionalId }).from(stockItems).where(eq(stockItems.active, true)).orderBy(asc(stockItems.name)),
      database.select().from(actionPoints).orderBy(asc(actionPoints.name)),
      database.select({ supplierId: supplierCities.supplierId, cityId: supplierCities.cityId }).from(supplierCities),
      database.select({ supplierId: supplierServiceTypes.supplierId, serviceTypeId: supplierServiceTypes.serviceTypeId }).from(supplierServiceTypes),
      database.select({ id: tradeCampaigns.id, name: tradeCampaigns.name, regionalId: tradeCampaigns.regionalId, status: tradeCampaigns.status, logoUrl: tradeCampaigns.logoUrl }).from(tradeCampaigns).orderBy(asc(tradeCampaigns.name)),
      database.select({ id: events.id, name: events.name, cityId: events.cityId, tradeCampaignId: events.tradeCampaignId, status: events.status, startsAt: events.startsAt }).from(events).orderBy(asc(events.startsAt)),
      database.select({ id: supplierOfferings.id, supplierId: supplierOfferings.supplierId, name: supplierOfferings.name, unit: supplierOfferings.unit, unitPrice: supplierOfferings.unitPrice, notes: supplierOfferings.notes }).from(supplierOfferings).where(and(eq(supplierOfferings.kind, "service"), eq(supplierOfferings.active, true))).orderBy(asc(supplierOfferings.name)),
    ]);
    return { cities: cityRows, actionTypes: typeRows, suppliers: supplierRows, serviceTypes: serviceRows, supervisors: supervisorRows, teamUsers: teamRows, stockItems: stockRows, actionPoints: actionPointRows, supplierCities: supplierCityRows, supplierServiceTypes: supplierServiceTypeRows, campaigns: campaignRows, events: eventRows, supplierOfferings: offeringRows };
  }),
  list: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "actions.read");
    const database = await requireDatabase();
    const [rows, teamRows, stockRows, supplierRows, serviceRows, historyRows, imageRows, invoiceRows, paymentRows] = await Promise.all([
      database.select({ action: actions, cityName: cities.name, actionTypeName: actionTypes.name, debrief: actionDebriefs, supervisorName: commercialSupervisors.name, actionPointName: actionPoints.name, campaignName: tradeCampaigns.name, campaignLogoUrl: tradeCampaigns.logoUrl, eventName: events.name }).from(actions).innerJoin(cities, eq(actions.cityId, cities.id)).innerJoin(actionTypes, eq(actions.actionTypeId, actionTypes.id)).leftJoin(actionDebriefs, eq(actionDebriefs.actionId, actions.id)).leftJoin(commercialSupervisors, eq(actions.commercialSupervisorId, commercialSupervisors.id)).leftJoin(actionPoints, eq(actions.actionPointId, actionPoints.id)).leftJoin(tradeCampaigns, eq(actions.tradeCampaignId, tradeCampaigns.id)).leftJoin(events, eq(actions.eventId, events.id)).orderBy(asc(actions.scheduledFor)),
      database.select({ actionId: actionTeamMembers.actionId, userId: users.id, name: users.name, jobTitle: users.jobTitle, avatarUrl: users.avatarUrl }).from(actionTeamMembers).innerJoin(users, eq(actionTeamMembers.userId, users.id)),
      database.select({ actionId: actionStockItems.actionId, stockItemId: stockItems.id, name: stockItems.name, unit: stockItems.unit, plannedQuantity: actionStockItems.plannedQuantity }).from(actionStockItems).innerJoin(stockItems, eq(actionStockItems.stockItemId, stockItems.id)),
      database.select({ actionId: actionSuppliers.actionId, supplierId: suppliers.id, name: suppliers.displayName, photoUrl: suppliers.photoUrl, mainService: suppliers.mainService }).from(actionSuppliers).innerJoin(suppliers, eq(actionSuppliers.supplierId, suppliers.id)),
      database.select({ actionId: actionServices.actionId, serviceTypeId: serviceTypes.id, name: serviceTypes.name, estimatedAmount: actionServices.estimatedAmount, supplierOfferingId: actionServices.supplierOfferingId, offeringName: supplierOfferings.name, unit: supplierOfferings.unit, listedUnitPrice: supplierOfferings.unitPrice, supplierId: suppliers.id, supplierName: suppliers.displayName }).from(actionServices).innerJoin(serviceTypes, eq(actionServices.serviceTypeId, serviceTypes.id)).leftJoin(supplierOfferings, eq(actionServices.supplierOfferingId, supplierOfferings.id)).leftJoin(suppliers, eq(supplierOfferings.supplierId, suppliers.id)),
      database.select({ actionId: auditLogs.entityId, auditAction: auditLogs.action, occurredAt: auditLogs.occurredAt, actorName: users.name, afterData: auditLogs.afterData }).from(auditLogs).leftJoin(users, eq(auditLogs.actorUserId, users.id)).where(eq(auditLogs.entityType, "action")).orderBy(asc(auditLogs.occurredAt)),
      database.select({ actionId: documents.entityId, url: documents.url, createdAt: documents.createdAt }).from(documents).where(and(eq(documents.entityType, "action"), inArray(documents.mimeType, ["image/jpeg", "image/png", "image/webp"]))).orderBy(asc(documents.createdAt)),
      database.select({ id: invoices.id, operationId: invoices.operationId, amount: invoices.amount, status: invoices.status }).from(invoices).where(eq(invoices.operationType, "action")),
      database.select({ invoiceId: payments.invoiceId, amount: payments.amount }).from(payments),
    ]);
    return rows.map(row => {
      const linkedInvoices = invoiceRows.filter(invoice => invoice.operationId === row.action.id && invoice.status !== "cancelled");
      const paidAmount = linkedInvoices.reduce((total, invoice) => total + paymentRows.filter(payment => payment.invoiceId === invoice.id).reduce((subtotal, payment) => subtotal + Number(payment.amount), 0), 0);
      const linkedSuppliers = supplierRows.filter(supplier => supplier.actionId === row.action.id);
      const linkedServices = serviceRows.filter(service => service.actionId === row.action.id).map(service => {
        if (service.supplierName || linkedSuppliers.length !== 1) return service;
        return { ...service, supplierId: linkedSuppliers[0].supplierId, supplierName: linkedSuppliers[0].name };
      });
      const enrichedSuppliers = linkedSuppliers.map(supplier => ({
        ...supplier,
        mainService:
          supplier.mainService
          || linkedServices.find(service => service.supplierId === supplier.supplierId)?.offeringName
          || linkedServices.find(service => service.supplierId === supplier.supplierId)?.name
          || null,
      }));
      const estimatedAmount = Number(row.action.estimatedCost);
      return {
        action: row.action,
        cityName: row.cityName,
        actionTypeName: row.actionTypeName,
        debrief: row.debrief,
        supervisorName: row.supervisorName,
        actionPointName: row.actionPointName,
        campaignName: row.campaignName,
        campaignLogoUrl: row.campaignLogoUrl,
        eventName: row.eventName,
        coverImageUrl: row.action.coverImageUrl ?? imageRows.find(image => image.actionId === row.action.id)?.url ?? null,
        finance: {
          estimatedAmount,
          invoicedAmount: linkedInvoices.reduce((total, invoice) => total + Number(invoice.amount), 0),
          paidAmount,
          remainingAmount: estimatedAmount - paidAmount,
        },
        teamMembers: teamRows.filter(member => member.actionId === row.action.id),
        stockItems: stockRows.filter(item => item.actionId === row.action.id),
        suppliers: enrichedSuppliers,
        services: linkedServices,
        history: historyRows.filter(item => item.actionId === row.action.id),
      };
    });
  }),
  create: protectedProcedure.input(z.object({
    tradeCampaignId: z.number().int().positive().nullable(), eventId: z.number().int().positive().nullable().default(null), cityId: z.number().int().positive(), actionTypeId: z.number().int().positive(), actionPointId: z.number().int().positive().nullable(), name: z.string().trim().min(2).max(180), address: z.string().trim().max(2000).optional(), latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(), scheduledFor: z.coerce.date(), endsAt: z.coerce.date().nullable(), objective: z.string().trim().min(3).max(2000), commercialSupervisorId: z.number().int().positive().nullable(), partnershipType: z.enum(["paid", "barter", "mixed"]), estimatedCost: z.coerce.number().finite().min(0).max(99999999999).optional(), supplierIds: z.array(z.number().int().positive()).max(20), serviceTypeIds: z.array(z.number().int().positive()).max(20), serviceAllocations: z.array(serviceAllocationSchema).max(20).optional(), teamMemberIds: z.array(z.number().int().positive()).max(40), stockAllocations: z.array(allocationSchema).max(40),
  })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.write");
    if (!validActionRange(input.scheduledFor, input.endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O término da ação deve ser posterior ao início." });
    const database = await requireDatabase();
    const serviceAllocations = normalizeServiceAllocations(input.serviceAllocations?.length ? input.serviceAllocations : input.serviceTypeIds.map(serviceTypeId => ({ serviceTypeId, estimatedAmount: 0 })));
    await ensureActionReferences(database, { ...input, serviceTypeIds: serviceAllocations.map(allocation => allocation.serviceTypeId), serviceAllocations });
    const stockAllocations = normalizeStockAllocations(input.stockAllocations);
    const estimatedCost = await calculateActionTotal(database, serviceAllocations, stockAllocations);
    const created = await database.transaction(async transaction => {
      const [action] = await transaction.insert(actions).values({ tradeCampaignId: input.tradeCampaignId, eventId: input.eventId, cityId: input.cityId, actionTypeId: input.actionTypeId, actionPointId: input.actionPointId, name: input.name, address: input.address || null, latitude: input.latitude?.toFixed(7) ?? null, longitude: input.longitude?.toFixed(7) ?? null, scheduledFor: input.scheduledFor, endsAt: input.endsAt, objective: input.objective, commercialSupervisorId: input.commercialSupervisorId, partnershipType: input.partnershipType, estimatedCost: estimatedCost.toFixed(2) }).returning();
      if (input.supplierIds.length) await transaction.insert(actionSuppliers).values(Array.from(new Set(input.supplierIds)).map(supplierId => ({ actionId: action.id, supplierId })));
      if (serviceAllocations.length) await transaction.insert(actionServices).values(serviceAllocations.map(allocation => ({ actionId: action.id, serviceTypeId: allocation.serviceTypeId, supplierOfferingId: allocation.supplierOfferingId, estimatedAmount: allocation.estimatedAmount.toFixed(2) })));
      if (input.teamMemberIds.length) await transaction.insert(actionTeamMembers).values(Array.from(new Set(input.teamMemberIds)).map(userId => ({ actionId: action.id, userId })));
      if (stockAllocations.length) await transaction.insert(actionStockItems).values(stockAllocations.map(allocation => ({ actionId: action.id, stockItemId: allocation.stockItemId, plannedQuantity: allocation.quantity.toFixed(0) })));
      return action;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "action", entityId: created.id, action: "create", afterData: { ...created, teamMemberIds: input.teamMemberIds, stockAllocations, serviceAllocations, estimatedCost } });
    return created;
  }),
  updateDetails: protectedProcedure.input(z.object({
    actionId: z.number().int().positive(), tradeCampaignId: z.number().int().positive().nullable(), eventId: z.number().int().positive().nullable().default(null), cityId: z.number().int().positive(), actionTypeId: z.number().int().positive(), actionPointId: z.number().int().positive().nullable(), name: z.string().trim().min(2).max(180), address: z.string().trim().max(2000).optional(), latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(), scheduledFor: z.coerce.date(), endsAt: z.coerce.date().nullable(), objective: z.string().trim().min(3).max(2000), commercialSupervisorId: z.number().int().positive().nullable(), partnershipType: z.enum(["paid", "barter", "mixed"]), estimatedCost: z.coerce.number().finite().min(0).max(99999999999).optional(), supplierIds: z.array(z.number().int().positive()).max(20), serviceTypeIds: z.array(z.number().int().positive()).max(20), serviceAllocations: z.array(serviceAllocationSchema).max(20).optional(), teamMemberIds: z.array(z.number().int().positive()).max(40), stockAllocations: z.array(allocationSchema).max(40),
  })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.write");
    if (!validActionRange(input.scheduledFor, input.endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O término da ação deve ser posterior ao início." });
    const database = await requireDatabase();
    const [before] = await database.select().from(actions).where(eq(actions.id, input.actionId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Ação não encontrada." });
    const serviceAllocations = normalizeServiceAllocations(input.serviceAllocations?.length ? input.serviceAllocations : input.serviceTypeIds.map(serviceTypeId => ({ serviceTypeId, estimatedAmount: 0 })));
    const stockAllocations = normalizeStockAllocations(input.stockAllocations);
    await ensureActionReferences(database, { ...input, serviceTypeIds: serviceAllocations.map(allocation => allocation.serviceTypeId), serviceAllocations });
    const estimatedCost = await calculateActionTotal(database, serviceAllocations, stockAllocations);
    const updated = await database.transaction(async transaction => {
      const [action] = await transaction.update(actions).set({ tradeCampaignId: input.tradeCampaignId, eventId: input.eventId, cityId: input.cityId, actionTypeId: input.actionTypeId, actionPointId: input.actionPointId, name: input.name, address: input.address || null, latitude: input.latitude?.toFixed(7) ?? null, longitude: input.longitude?.toFixed(7) ?? null, scheduledFor: input.scheduledFor, endsAt: input.endsAt, objective: input.objective, commercialSupervisorId: input.commercialSupervisorId, partnershipType: input.partnershipType, estimatedCost: estimatedCost.toFixed(2), updatedAt: new Date() }).where(eq(actions.id, input.actionId)).returning();
      await Promise.all([
        transaction.delete(actionSuppliers).where(eq(actionSuppliers.actionId, input.actionId)),
        transaction.delete(actionServices).where(eq(actionServices.actionId, input.actionId)),
        transaction.delete(actionTeamMembers).where(eq(actionTeamMembers.actionId, input.actionId)),
        transaction.delete(actionStockItems).where(eq(actionStockItems.actionId, input.actionId)),
      ]);
      if (input.supplierIds.length) await transaction.insert(actionSuppliers).values(Array.from(new Set(input.supplierIds)).map(supplierId => ({ actionId: input.actionId, supplierId })));
      if (serviceAllocations.length) await transaction.insert(actionServices).values(serviceAllocations.map(allocation => ({ actionId: input.actionId, serviceTypeId: allocation.serviceTypeId, supplierOfferingId: allocation.supplierOfferingId, estimatedAmount: allocation.estimatedAmount.toFixed(2) })));
      if (input.teamMemberIds.length) await transaction.insert(actionTeamMembers).values(Array.from(new Set(input.teamMemberIds)).map(userId => ({ actionId: input.actionId, userId })));
      if (stockAllocations.length) await transaction.insert(actionStockItems).values(stockAllocations.map(allocation => ({ actionId: input.actionId, stockItemId: allocation.stockItemId, plannedQuantity: allocation.quantity.toFixed(0) })));
      return action;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "action", entityId: updated.id, action: "update_details", beforeData: before, afterData: { ...updated, supplierIds: input.supplierIds, serviceAllocations, teamMemberIds: input.teamMemberIds, stockAllocations } });
    return updated;
  }),
  uploadCover: protectedProcedure.input(z.object({ actionId: z.number().int().positive(), originalName: z.string().trim().min(1).max(255), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), dataBase64: z.string().min(1).max(70_000_000) })).mutation(async ({ ctx, input }) => { await assertPermission(ctx.user, "actions.write"); const database = await requireDatabase(); const bytes = Buffer.from(input.dataBase64, "base64"); if (!bytes.length || bytes.length > 50 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "A capa deve ter até 50 MB." }); const [action] = await database.select({ id: actions.id, cityId: actions.cityId }).from(actions).where(eq(actions.id, input.actionId)); if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "Ação não encontrada." }); const stored = await storagePut(`trade/action/${action.id}/cover-${Date.now()}-${input.originalName}`, bytes, input.mimeType); const [updated] = await database.update(actions).set({ coverImageUrl: stored.url, updatedAt: new Date() }).where(eq(actions.id, action.id)).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "action", entityId: action.id, action: "upload_cover", afterData: { url: stored.url } }); return updated; }),
  uploadStatusEvidence: protectedProcedure.input(z.object({ actionId: z.number().int().positive(), originalName: z.string().trim().min(1).max(255), mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4", "video/webm", "audio/mpeg", "audio/wav", "audio/ogg"]), dataBase64: z.string().min(1).max(70_000_000) })).mutation(async ({ ctx, input }) => { await assertPermission(ctx.user, "actions.write"); const database = await requireDatabase(); const bytes = Buffer.from(input.dataBase64, "base64"); if (!bytes.length || bytes.length > 50 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "A evidência deve ter até 50 MB." }); const [action] = await database.select({ id: actions.id }).from(actions).where(eq(actions.id, input.actionId)); if (!action) throw new TRPCError({ code: "NOT_FOUND", message: "Ação não encontrada." }); const safeName = input.originalName.replace(/[^a-zA-Z0-9._-]/g, "_"); const stored = await storagePut(`trade/action-status-evidence/${action.id}/${Date.now()}-${safeName}`, bytes, input.mimeType); return { url: stored.url }; }),
  updateExecutionStatus: protectedProcedure.input(z.object({ actionId: z.number().int().positive(), status: z.enum(["planned", "in_progress", "paused", "completed", "cancelled"]), reason: z.string().trim().max(3000).optional(), evidenceUrls: z.array(evidenceUrlSchema).max(10).default([]) })).mutation(async ({ ctx, input }) => { await assertPermission(ctx.user, "actions.write"); if (["paused", "cancelled"].includes(input.status) && !input.reason) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o motivo da alteração de status." }); const database = await requireDatabase(); const [before] = await database.select().from(actions).where(eq(actions.id, input.actionId)).limit(1); if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Ação não encontrada." }); if (!canUpdateActionStatus(before.status, input.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "Status de ação inválido." }); const [updated] = await database.update(actions).set({ status: input.status, updatedAt: new Date() }).where(eq(actions.id, input.actionId)).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "action", entityId: updated.id, action: "update_execution_status", beforeData: before, afterData: { ...updated, reason: input.reason || null, evidenceUrls: input.evidenceUrls } }); return updated; }),
  reschedule: protectedProcedure.input(z.object({ actionId: z.number().int().positive(), scheduledFor: z.coerce.date(), endsAt: z.coerce.date().nullable(), reason: z.string().trim().min(3).max(3000), evidenceUrls: z.array(evidenceUrlSchema).max(10).default([]) })).mutation(async ({ ctx, input }) => { await assertPermission(ctx.user, "actions.write"); if (!validActionRange(input.scheduledFor, input.endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O término da ação deve ser posterior ao início." }); const database = await requireDatabase(); const [before] = await database.select().from(actions).where(eq(actions.id, input.actionId)); if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Ação não encontrada." }); if (["completed", "cancelled"].includes(before.status)) throw new TRPCError({ code: "CONFLICT", message: "Ações concluídas ou canceladas não podem ser reagendadas." }); const [updated] = await database.update(actions).set({ scheduledFor: input.scheduledFor, endsAt: input.endsAt, updatedAt: new Date() }).where(eq(actions.id, input.actionId)).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "action", entityId: updated.id, action: "reschedule", beforeData: before, afterData: { ...updated, reason: input.reason, evidenceUrls: input.evidenceUrls } }); return updated; }),
  saveDebrief: protectedProcedure.input(z.object({ actionId: z.number().int().positive(), rating: z.number().int().min(1).max(5), notes: z.string().trim().max(3000).optional(), positives: z.string().trim().max(2000).optional(), negatives: z.string().trim().max(2000).optional(), resultAchieved: z.boolean(), resultSummary: z.string().trim().max(3000).optional(), leadCount: z.coerce.number().int().min(0).max(9999999).default(0), saleCount: z.coerce.number().int().min(0).max(9999999).default(0), renewalCount: z.coerce.number().int().min(0).max(9999999).default(0), worthRepeating: z.boolean().nullable(), completedAt: z.coerce.date() })).mutation(async ({ ctx, input }) => { await assertPermission(ctx.user, "actions.write"); const database = await requireDatabase(); const [current] = await database.select().from(actionDebriefs).where(eq(actionDebriefs.actionId, input.actionId)); const values = { ...input, notes: input.notes || null, positives: input.positives || null, negatives: input.negatives || null, resultSummary: input.resultSummary || null }; const [saved] = current ? await database.update(actionDebriefs).set(values).where(eq(actionDebriefs.actionId, input.actionId)).returning() : await database.insert(actionDebriefs).values(values).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "action_debrief", entityId: saved.id, action: current ? "update" : "create", afterData: saved }); return saved; }),
});
