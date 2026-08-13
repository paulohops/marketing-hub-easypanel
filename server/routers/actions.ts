import { and, asc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { actionDebriefs, actionPoints, actions, actionServices, actionStockItems, actionSuppliers, actionTeamMembers, actionTypes, auditLogs, cities, commercialSupervisors, documents, invoices, payments, regionals, serviceTypes, stockItems, supplierCities, suppliers, tradeCampaigns, users } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

async function requireDatabase() { const database = await getDb(); if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." }); return database; }

const allocationSchema = z.object({ stockItemId: z.number().int().positive(), quantity: z.coerce.number().positive().max(99999999) });
const serviceAllocationSchema = z.object({ serviceTypeId: z.number().int().positive(), estimatedAmount: z.coerce.number().finite().min(0).max(99999999999) });

export function canUpdateActionStatus(currentStatus: string, nextStatus: string) {
  return !["cancelled", "completed"].includes(currentStatus) && ["in_progress", "completed", "cancelled"].includes(nextStatus);
}

export function validActionRange(startsAt: Date, endsAt: Date | null) {
  return !endsAt || endsAt >= startsAt;
}

export function normalizeStockAllocations(allocations: Array<{ stockItemId: number; quantity: number }>) {
  return Array.from(new Map(allocations.map(allocation => [allocation.stockItemId, allocation])).values());
}

export function normalizeServiceAllocations(allocations: Array<{ serviceTypeId: number; estimatedAmount: number }>) {
  return Array.from(new Map(allocations.map(allocation => [allocation.serviceTypeId, allocation])).values());
}

async function ensureActionReferences(database: any, input: { tradeCampaignId?: number | null; cityId: number; actionTypeId: number; actionPointId: number | null; commercialSupervisorId: number | null; supplierIds: number[]; serviceTypeIds: number[]; teamMemberIds: number[]; stockAllocations: Array<{ stockItemId: number }> }) {
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
  if (input.actionPointId) {
    const [point] = await database.select({ id: actionPoints.id, cityId: actionPoints.cityId }).from(actionPoints).where(eq(actionPoints.id, input.actionPointId));
    if (!point || point.cityId !== input.cityId) throw new TRPCError({ code: "BAD_REQUEST", message: "O ponto de ação deve pertencer à cidade selecionada." });
  }
  const supplierIds = Array.from(new Set(input.supplierIds));
  if (supplierIds.length) {
    const coverage = await database.select({ supplierId: supplierCities.supplierId }).from(supplierCities).where(and(eq(supplierCities.cityId, input.cityId), inArray(supplierCities.supplierId, supplierIds)));
    if (new Set(coverage.map((row: { supplierId: number }) => row.supplierId)).size !== supplierIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Há fornecedor selecionado sem cobertura para a cidade da ação." });
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
    const [cityRows, typeRows, supplierRows, serviceRows, supervisorRows, teamRows, stockRows, actionPointRows, supplierCityRows, campaignRows] = await Promise.all([
      database.select({ city: cities, regionalName: regionals.name }).from(cities).innerJoin(regionals, eq(cities.regionalId, regionals.id)).where(eq(cities.active, true)).orderBy(asc(regionals.name), asc(cities.name)),
      database.select().from(actionTypes).where(eq(actionTypes.active, true)).orderBy(asc(actionTypes.name)),
      database.select().from(suppliers).where(eq(suppliers.active, true)).orderBy(asc(suppliers.displayName)),
      database.select().from(serviceTypes).where(eq(serviceTypes.active, true)).orderBy(asc(serviceTypes.name)),
      database.select().from(commercialSupervisors).where(eq(commercialSupervisors.active, true)).orderBy(asc(commercialSupervisors.name)),
      database.select({ id: users.id, name: users.name, email: users.email, jobTitle: users.jobTitle }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)),
      database.select({ id: stockItems.id, name: stockItems.name, sku: stockItems.sku, unit: stockItems.unit, cityId: stockItems.cityId, regionalId: stockItems.regionalId }).from(stockItems).where(eq(stockItems.active, true)).orderBy(asc(stockItems.name)),
      database.select().from(actionPoints).orderBy(asc(actionPoints.name)),
      database.select({ supplierId: supplierCities.supplierId, cityId: supplierCities.cityId }).from(supplierCities),
      database.select({ id: tradeCampaigns.id, name: tradeCampaigns.name, regionalId: tradeCampaigns.regionalId, status: tradeCampaigns.status }).from(tradeCampaigns).orderBy(asc(tradeCampaigns.name)),
    ]);
    return { cities: cityRows, actionTypes: typeRows, suppliers: supplierRows, serviceTypes: serviceRows, supervisors: supervisorRows, teamUsers: teamRows, stockItems: stockRows, actionPoints: actionPointRows, supplierCities: supplierCityRows, campaigns: campaignRows };
  }),
  list: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "actions.read");
    const database = await requireDatabase();
    const [rows, teamRows, stockRows, supplierRows, serviceRows, historyRows, imageRows, invoiceRows, paymentRows] = await Promise.all([
      database.select({ action: actions, cityName: cities.name, actionTypeName: actionTypes.name, debrief: actionDebriefs, supervisorName: commercialSupervisors.name, actionPointName: actionPoints.name, campaignName: tradeCampaigns.name }).from(actions).innerJoin(cities, eq(actions.cityId, cities.id)).innerJoin(actionTypes, eq(actions.actionTypeId, actionTypes.id)).leftJoin(actionDebriefs, eq(actionDebriefs.actionId, actions.id)).leftJoin(commercialSupervisors, eq(actions.commercialSupervisorId, commercialSupervisors.id)).leftJoin(actionPoints, eq(actions.actionPointId, actionPoints.id)).leftJoin(tradeCampaigns, eq(actions.tradeCampaignId, tradeCampaigns.id)).orderBy(asc(actions.scheduledFor)),
      database.select({ actionId: actionTeamMembers.actionId, userId: users.id, name: users.name, jobTitle: users.jobTitle }).from(actionTeamMembers).innerJoin(users, eq(actionTeamMembers.userId, users.id)),
      database.select({ actionId: actionStockItems.actionId, stockItemId: stockItems.id, name: stockItems.name, unit: stockItems.unit, plannedQuantity: actionStockItems.plannedQuantity }).from(actionStockItems).innerJoin(stockItems, eq(actionStockItems.stockItemId, stockItems.id)),
      database.select({ actionId: actionSuppliers.actionId, supplierId: suppliers.id, name: suppliers.displayName }).from(actionSuppliers).innerJoin(suppliers, eq(actionSuppliers.supplierId, suppliers.id)),
      database.select({ actionId: actionServices.actionId, serviceTypeId: serviceTypes.id, name: serviceTypes.name, estimatedAmount: actionServices.estimatedAmount }).from(actionServices).innerJoin(serviceTypes, eq(actionServices.serviceTypeId, serviceTypes.id)),
      database.select({ actionId: auditLogs.entityId, auditAction: auditLogs.action, occurredAt: auditLogs.occurredAt, actorName: users.name }).from(auditLogs).leftJoin(users, eq(auditLogs.actorUserId, users.id)).where(eq(auditLogs.entityType, "action")).orderBy(asc(auditLogs.occurredAt)),
      database.select({ actionId: documents.entityId, url: documents.url, createdAt: documents.createdAt }).from(documents).where(and(eq(documents.entityType, "action"), inArray(documents.mimeType, ["image/jpeg", "image/png", "image/webp"]))).orderBy(asc(documents.createdAt)),
      database.select({ id: invoices.id, operationId: invoices.operationId, amount: invoices.amount, status: invoices.status }).from(invoices).where(eq(invoices.operationType, "action")),
      database.select({ invoiceId: payments.invoiceId, amount: payments.amount }).from(payments),
    ]);
    return rows.map(row => {
      const linkedInvoices = invoiceRows.filter(invoice => invoice.operationId === row.action.id && invoice.status !== "cancelled");
      const paidAmount = linkedInvoices.reduce((total, invoice) => total + paymentRows.filter(payment => payment.invoiceId === invoice.id).reduce((subtotal, payment) => subtotal + Number(payment.amount), 0), 0);
      const estimatedAmount = Number(row.action.estimatedCost);
      return { ...row, coverImageUrl: imageRows.find(image => image.actionId === row.action.id)?.url ?? null, finance: { estimatedAmount, invoicedAmount: linkedInvoices.reduce((total, invoice) => total + Number(invoice.amount), 0), paidAmount, remainingAmount: estimatedAmount - paidAmount }, teamMembers: teamRows.filter(member => member.actionId === row.action.id), stockItems: stockRows.filter(item => item.actionId === row.action.id), suppliers: supplierRows.filter(supplier => supplier.actionId === row.action.id), services: serviceRows.filter(service => service.actionId === row.action.id), history: historyRows.filter(item => item.actionId === row.action.id) };
    });
  }),
  create: protectedProcedure.input(z.object({
    tradeCampaignId: z.number().int().positive().nullable(), cityId: z.number().int().positive(), actionTypeId: z.number().int().positive(), actionPointId: z.number().int().positive().nullable(), name: z.string().trim().min(2).max(180), address: z.string().trim().max(2000).optional(), latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(), scheduledFor: z.coerce.date(), endsAt: z.coerce.date().nullable(), objective: z.string().trim().min(3).max(2000), commercialSupervisorId: z.number().int().positive().nullable(), partnershipType: z.enum(["paid", "barter", "mixed"]), estimatedCost: z.coerce.number().finite().min(0).max(99999999999), supplierIds: z.array(z.number().int().positive()).max(20), serviceTypeIds: z.array(z.number().int().positive()).max(20), serviceAllocations: z.array(serviceAllocationSchema).max(20).optional(), teamMemberIds: z.array(z.number().int().positive()).max(40), stockAllocations: z.array(allocationSchema).max(40),
  })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.write");
    if (!validActionRange(input.scheduledFor, input.endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O término da ação deve ser posterior ao início." });
    const database = await requireDatabase();
    const serviceAllocations = normalizeServiceAllocations(input.serviceAllocations?.length ? input.serviceAllocations : input.serviceTypeIds.map(serviceTypeId => ({ serviceTypeId, estimatedAmount: 0 })));
    await ensureActionReferences(database, { ...input, serviceTypeIds: serviceAllocations.map(allocation => allocation.serviceTypeId) });
    const stockAllocations = normalizeStockAllocations(input.stockAllocations);
    const created = await database.transaction(async transaction => {
      const [action] = await transaction.insert(actions).values({ tradeCampaignId: input.tradeCampaignId, cityId: input.cityId, actionTypeId: input.actionTypeId, actionPointId: input.actionPointId, name: input.name, address: input.address || null, latitude: input.latitude?.toFixed(7) ?? null, longitude: input.longitude?.toFixed(7) ?? null, scheduledFor: input.scheduledFor, endsAt: input.endsAt, objective: input.objective, commercialSupervisorId: input.commercialSupervisorId, partnershipType: input.partnershipType, estimatedCost: input.estimatedCost.toFixed(2) }).returning();
      if (input.supplierIds.length) await transaction.insert(actionSuppliers).values(Array.from(new Set(input.supplierIds)).map(supplierId => ({ actionId: action.id, supplierId })));
      if (serviceAllocations.length) await transaction.insert(actionServices).values(serviceAllocations.map(allocation => ({ actionId: action.id, serviceTypeId: allocation.serviceTypeId, estimatedAmount: allocation.estimatedAmount.toFixed(2) })));
      if (input.teamMemberIds.length) await transaction.insert(actionTeamMembers).values(Array.from(new Set(input.teamMemberIds)).map(userId => ({ actionId: action.id, userId })));
      if (stockAllocations.length) await transaction.insert(actionStockItems).values(stockAllocations.map(allocation => ({ actionId: action.id, stockItemId: allocation.stockItemId, plannedQuantity: allocation.quantity.toFixed(2) })));
      return action;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "action", entityId: created.id, action: "create", afterData: { ...created, teamMemberIds: input.teamMemberIds, stockAllocations, serviceAllocations, estimatedCost: input.estimatedCost } });
    return created;
  }),
  updateDetails: protectedProcedure.input(z.object({
    actionId: z.number().int().positive(), tradeCampaignId: z.number().int().positive().nullable(), cityId: z.number().int().positive(), actionTypeId: z.number().int().positive(), actionPointId: z.number().int().positive().nullable(), name: z.string().trim().min(2).max(180), address: z.string().trim().max(2000).optional(), latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(), scheduledFor: z.coerce.date(), endsAt: z.coerce.date().nullable(), objective: z.string().trim().min(3).max(2000), commercialSupervisorId: z.number().int().positive().nullable(), partnershipType: z.enum(["paid", "barter", "mixed"]), estimatedCost: z.coerce.number().finite().min(0).max(99999999999), supplierIds: z.array(z.number().int().positive()).max(20), serviceTypeIds: z.array(z.number().int().positive()).max(20), serviceAllocations: z.array(serviceAllocationSchema).max(20).optional(), teamMemberIds: z.array(z.number().int().positive()).max(40), stockAllocations: z.array(allocationSchema).max(40),
  })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.write");
    if (!validActionRange(input.scheduledFor, input.endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O término da ação deve ser posterior ao início." });
    const database = await requireDatabase();
    const [before] = await database.select().from(actions).where(eq(actions.id, input.actionId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Ação não encontrada." });
    const serviceAllocations = normalizeServiceAllocations(input.serviceAllocations?.length ? input.serviceAllocations : input.serviceTypeIds.map(serviceTypeId => ({ serviceTypeId, estimatedAmount: 0 })));
    const stockAllocations = normalizeStockAllocations(input.stockAllocations);
    await ensureActionReferences(database, { ...input, serviceTypeIds: serviceAllocations.map(allocation => allocation.serviceTypeId) });
    const updated = await database.transaction(async transaction => {
      const [action] = await transaction.update(actions).set({ tradeCampaignId: input.tradeCampaignId, cityId: input.cityId, actionTypeId: input.actionTypeId, actionPointId: input.actionPointId, name: input.name, address: input.address || null, latitude: input.latitude?.toFixed(7) ?? null, longitude: input.longitude?.toFixed(7) ?? null, scheduledFor: input.scheduledFor, endsAt: input.endsAt, objective: input.objective, commercialSupervisorId: input.commercialSupervisorId, partnershipType: input.partnershipType, estimatedCost: input.estimatedCost.toFixed(2), updatedAt: new Date() }).where(eq(actions.id, input.actionId)).returning();
      await Promise.all([
        transaction.delete(actionSuppliers).where(eq(actionSuppliers.actionId, input.actionId)),
        transaction.delete(actionServices).where(eq(actionServices.actionId, input.actionId)),
        transaction.delete(actionTeamMembers).where(eq(actionTeamMembers.actionId, input.actionId)),
        transaction.delete(actionStockItems).where(eq(actionStockItems.actionId, input.actionId)),
      ]);
      if (input.supplierIds.length) await transaction.insert(actionSuppliers).values(Array.from(new Set(input.supplierIds)).map(supplierId => ({ actionId: input.actionId, supplierId })));
      if (serviceAllocations.length) await transaction.insert(actionServices).values(serviceAllocations.map(allocation => ({ actionId: input.actionId, serviceTypeId: allocation.serviceTypeId, estimatedAmount: allocation.estimatedAmount.toFixed(2) })));
      if (input.teamMemberIds.length) await transaction.insert(actionTeamMembers).values(Array.from(new Set(input.teamMemberIds)).map(userId => ({ actionId: input.actionId, userId })));
      if (stockAllocations.length) await transaction.insert(actionStockItems).values(stockAllocations.map(allocation => ({ actionId: input.actionId, stockItemId: allocation.stockItemId, plannedQuantity: allocation.quantity.toFixed(2) })));
      return action;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "action", entityId: updated.id, action: "update_details", beforeData: before, afterData: { ...updated, supplierIds: input.supplierIds, serviceAllocations, teamMemberIds: input.teamMemberIds, stockAllocations } });
    return updated;
  }),
  updateExecutionStatus: protectedProcedure.input(z.object({ actionId: z.number().int().positive(), status: z.enum(["in_progress", "completed", "cancelled"]) })).mutation(async ({ ctx, input }) => { await assertPermission(ctx.user, "actions.write"); const database = await requireDatabase(); const [before] = await database.select().from(actions).where(eq(actions.id, input.actionId)).limit(1); if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Ação não encontrada." }); if (!canUpdateActionStatus(before.status, input.status)) throw new TRPCError({ code: "CONFLICT", message: "O status desta ação não pode mais ser alterado." }); const [updated] = await database.update(actions).set({ status: input.status, updatedAt: new Date() }).where(eq(actions.id, input.actionId)).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "action", entityId: updated.id, action: "update_execution_status", beforeData: before, afterData: updated }); return updated; }),
  reschedule: protectedProcedure.input(z.object({ actionId: z.number().int().positive(), scheduledFor: z.coerce.date(), endsAt: z.coerce.date().nullable() })).mutation(async ({ ctx, input }) => { await assertPermission(ctx.user, "actions.write"); if (!validActionRange(input.scheduledFor, input.endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O término da ação deve ser posterior ao início." }); const database = await requireDatabase(); const [before] = await database.select().from(actions).where(eq(actions.id, input.actionId)); if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Ação não encontrada." }); if (["completed", "cancelled"].includes(before.status)) throw new TRPCError({ code: "CONFLICT", message: "Ações concluídas ou canceladas não podem ser reagendadas." }); const [updated] = await database.update(actions).set({ scheduledFor: input.scheduledFor, endsAt: input.endsAt, updatedAt: new Date() }).where(eq(actions.id, input.actionId)).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "action", entityId: updated.id, action: "reschedule", beforeData: before, afterData: updated }); return updated; }),
  saveDebrief: protectedProcedure.input(z.object({ actionId: z.number().int().positive(), rating: z.number().int().min(1).max(5), notes: z.string().trim().max(3000).optional(), positives: z.string().trim().max(2000).optional(), negatives: z.string().trim().max(2000).optional(), resultAchieved: z.boolean(), resultSummary: z.string().trim().max(3000).optional(), leadCount: z.coerce.number().int().min(0).max(9999999).default(0), saleCount: z.coerce.number().int().min(0).max(9999999).default(0), renewalCount: z.coerce.number().int().min(0).max(9999999).default(0), worthRepeating: z.boolean().nullable(), completedAt: z.coerce.date() })).mutation(async ({ ctx, input }) => { await assertPermission(ctx.user, "actions.write"); const database = await requireDatabase(); const [current] = await database.select().from(actionDebriefs).where(eq(actionDebriefs.actionId, input.actionId)); const values = { ...input, notes: input.notes || null, positives: input.positives || null, negatives: input.negatives || null, resultSummary: input.resultSummary || null }; const [saved] = current ? await database.update(actionDebriefs).set(values).where(eq(actionDebriefs.actionId, input.actionId)).returning() : await database.insert(actionDebriefs).values(values).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "action_debrief", entityId: saved.id, action: current ? "update" : "create", afterData: saved }); return saved; }),
});
