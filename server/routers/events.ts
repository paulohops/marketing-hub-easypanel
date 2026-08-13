import { and, asc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { actionPoints, cities, commercialSupervisors, events, eventServices, eventStockItems, eventSuppliers, eventTeamMembers, eventTypes, invoices, payments, regionals, serviceTypes, stockItems, supplierCities, suppliers, users } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

async function requireDatabase() { const database = await getDb(); if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." }); return database; }

const allocationSchema = z.object({ stockItemId: z.number().int().positive(), quantity: z.coerce.number().positive().max(99999999) });

export function validEventRange(startsAt: Date, endsAt: Date | null) {
  return !endsAt || endsAt >= startsAt;
}

export function normalizeEventStockAllocations(allocations: Array<{ stockItemId: number; quantity: number }>) {
  return Array.from(new Map(allocations.map(allocation => [allocation.stockItemId, allocation])).values());
}

async function ensureEventReferences(database: any, input: { cityId: number; eventTypeId: number; commercialSupervisorId: number | null; supplierIds: number[]; serviceTypeIds: number[]; teamMemberIds: number[]; stockAllocations: Array<{ stockItemId: number }> }) {
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
    if (rows.length !== ids.length) throw new TRPCError({ code: "BAD_REQUEST", message: `Vínculo de ${check.label} inexistente ou indisponível.` });
  }));
  const [selectedCity] = await database.select({ id: cities.id, regionalId: cities.regionalId }).from(cities).where(eq(cities.id, input.cityId));
  const supplierIds = Array.from(new Set(input.supplierIds));
  if (supplierIds.length) {
    const coverage = await database.select({ supplierId: supplierCities.supplierId }).from(supplierCities).where(and(eq(supplierCities.cityId, input.cityId), inArray(supplierCities.supplierId, supplierIds)));
    if (new Set(coverage.map((row: { supplierId: number }) => row.supplierId)).size !== supplierIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Há fornecedor selecionado sem cobertura para a cidade do evento." });
  }
  const stockIds = Array.from(new Set(input.stockAllocations.map(allocation => allocation.stockItemId)));
  if (stockIds.length && selectedCity) {
    const allocatedStock = await database.select({ id: stockItems.id, regionalId: stockItems.regionalId, cityId: stockItems.cityId }).from(stockItems).where(inArray(stockItems.id, stockIds));
    if (allocatedStock.some((item: { regionalId: number; cityId: number | null }) => item.regionalId !== selectedCity.regionalId || (item.cityId !== null && item.cityId !== input.cityId))) throw new TRPCError({ code: "BAD_REQUEST", message: "Os itens de estoque devem pertencer à regional e à cidade selecionadas para o evento." });
  }
}

export const eventsRouter = router({
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "events.read");
    const database = await requireDatabase();
    const [cityRows, typeRows, supplierRows, serviceRows, supervisorRows, teamRows, stockRows, actionPointRows, supplierCityRows] = await Promise.all([
      database.select({ city: cities, regionalName: regionals.name }).from(cities).innerJoin(regionals, eq(cities.regionalId, regionals.id)).where(eq(cities.active, true)).orderBy(asc(regionals.name), asc(cities.name)),
      database.select().from(eventTypes).where(eq(eventTypes.active, true)).orderBy(asc(eventTypes.name)),
      database.select().from(suppliers).where(eq(suppliers.active, true)).orderBy(asc(suppliers.displayName)),
      database.select().from(serviceTypes).where(eq(serviceTypes.active, true)).orderBy(asc(serviceTypes.name)),
      database.select().from(commercialSupervisors).where(eq(commercialSupervisors.active, true)).orderBy(asc(commercialSupervisors.name)),
      database.select({ id: users.id, name: users.name, email: users.email, jobTitle: users.jobTitle }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)),
      database.select({ id: stockItems.id, name: stockItems.name, sku: stockItems.sku, unit: stockItems.unit, cityId: stockItems.cityId, regionalId: stockItems.regionalId }).from(stockItems).where(eq(stockItems.active, true)).orderBy(asc(stockItems.name)),
      database.select().from(actionPoints).where(eq(actionPoints.active, true)).orderBy(asc(actionPoints.name)),
      database.select({ supplierId: supplierCities.supplierId, cityId: supplierCities.cityId }).from(supplierCities),
    ]);
    return { cities: cityRows, eventTypes: typeRows, suppliers: supplierRows, serviceTypes: serviceRows, supervisors: supervisorRows, teamUsers: teamRows, stockItems: stockRows, actionPoints: actionPointRows, supplierCities: supplierCityRows };
  }),
  list: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "events.read");
    const database = await requireDatabase();
    const [rows, teamRows, stockRows, invoiceRows, paymentRows] = await Promise.all([
      database.select({ event: events, cityName: cities.name, eventTypeName: eventTypes.name, supervisorName: commercialSupervisors.name }).from(events).innerJoin(cities, eq(events.cityId, cities.id)).innerJoin(eventTypes, eq(events.eventTypeId, eventTypes.id)).leftJoin(commercialSupervisors, eq(events.commercialSupervisorId, commercialSupervisors.id)).orderBy(asc(events.startsAt)),
      database.select({ eventId: eventTeamMembers.eventId, userId: users.id, name: users.name, jobTitle: users.jobTitle }).from(eventTeamMembers).innerJoin(users, eq(eventTeamMembers.userId, users.id)),
      database.select({ eventId: eventStockItems.eventId, stockItemId: stockItems.id, name: stockItems.name, unit: stockItems.unit, plannedQuantity: eventStockItems.plannedQuantity }).from(eventStockItems).innerJoin(stockItems, eq(eventStockItems.stockItemId, stockItems.id)),
      database.select({ id: invoices.id, operationId: invoices.operationId, amount: invoices.amount, status: invoices.status }).from(invoices).where(eq(invoices.operationType, "event")),
      database.select({ invoiceId: payments.invoiceId, amount: payments.amount }).from(payments),
    ]);
    return rows.map(row => {
      const linkedInvoices = invoiceRows.filter(invoice => invoice.operationId === row.event.id && invoice.status !== "cancelled");
      const paidAmount = linkedInvoices.reduce((total, invoice) => total + paymentRows.filter(payment => payment.invoiceId === invoice.id).reduce((subtotal, payment) => subtotal + Number(payment.amount), 0), 0);
      const estimatedAmount = Number(row.event.estimatedCost);
      return { ...row, finance: { estimatedAmount, invoicedAmount: linkedInvoices.reduce((total, invoice) => total + Number(invoice.amount), 0), paidAmount, remainingAmount: estimatedAmount - paidAmount }, teamMembers: teamRows.filter(member => member.eventId === row.event.id), stockItems: stockRows.filter(item => item.eventId === row.event.id) };
    });
  }),
  create: protectedProcedure.input(z.object({
    cityId: z.number().int().positive(), eventTypeId: z.number().int().positive(), name: z.string().trim().min(2).max(180), address: z.string().trim().max(2000).optional(), latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(), startsAt: z.coerce.date(), endsAt: z.coerce.date().nullable(), commercialSupervisorId: z.number().int().positive().nullable(), partnershipType: z.enum(["paid", "barter", "mixed"]), estimatedCost: z.coerce.number().finite().min(0).max(99999999999), partnershipReason: z.string().trim().max(2000).optional(), preEventNotes: z.string().trim().max(3000).optional(), supplierIds: z.array(z.number().int().positive()).max(20), serviceTypeIds: z.array(z.number().int().positive()).max(20), teamMemberIds: z.array(z.number().int().positive()).max(40), stockAllocations: z.array(allocationSchema).max(40),
  })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "events.write");
    if (!validEventRange(input.startsAt, input.endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O término do evento deve ser posterior ao início." });
    const database = await requireDatabase();
    await ensureEventReferences(database, input);
    const stockAllocations = normalizeEventStockAllocations(input.stockAllocations);
    const created = await database.transaction(async transaction => {
      const [event] = await transaction.insert(events).values({ cityId: input.cityId, eventTypeId: input.eventTypeId, name: input.name, address: input.address || null, latitude: input.latitude?.toFixed(7) ?? null, longitude: input.longitude?.toFixed(7) ?? null, startsAt: input.startsAt, endsAt: input.endsAt, commercialSupervisorId: input.commercialSupervisorId, partnershipType: input.partnershipType, estimatedCost: input.estimatedCost.toFixed(2), partnershipReason: input.partnershipReason || null, preEventNotes: input.preEventNotes || null }).returning();
      if (input.supplierIds.length) await transaction.insert(eventSuppliers).values(Array.from(new Set(input.supplierIds)).map(supplierId => ({ eventId: event.id, supplierId })));
      if (input.serviceTypeIds.length) await transaction.insert(eventServices).values(Array.from(new Set(input.serviceTypeIds)).map(serviceTypeId => ({ eventId: event.id, serviceTypeId })));
      if (input.teamMemberIds.length) await transaction.insert(eventTeamMembers).values(Array.from(new Set(input.teamMemberIds)).map(userId => ({ eventId: event.id, userId })));
      if (stockAllocations.length) await transaction.insert(eventStockItems).values(stockAllocations.map(allocation => ({ eventId: event.id, stockItemId: allocation.stockItemId, plannedQuantity: allocation.quantity.toFixed(2) })));
      return event;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "event", entityId: created.id, action: "create", afterData: { ...created, teamMemberIds: input.teamMemberIds, stockAllocations, estimatedCost: input.estimatedCost } });
    return created;
  }),
  savePostEvent: protectedProcedure.input(z.object({ eventId: z.number().int().positive(), postEventNotes: z.string().trim().max(3000).optional(), rating: z.number().int().min(1).max(5).nullable(), resultAchieved: z.boolean().nullable(), worthRenewing: z.boolean().nullable(), status: z.enum(["planned", "in_progress", "completed", "cancelled"]) })).mutation(async ({ ctx, input }) => { await assertPermission(ctx.user, "events.write"); const database = await requireDatabase(); const [updated] = await database.update(events).set({ postEventNotes: input.postEventNotes || null, rating: input.rating, resultAchieved: input.resultAchieved, worthRenewing: input.worthRenewing, status: input.status, updatedAt: new Date() }).where(eq(events.id, input.eventId)).returning(); if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Evento não encontrado." }); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "event", entityId: updated.id, action: "update", afterData: updated }); return updated; }),
});
