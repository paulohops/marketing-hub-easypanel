import { and, asc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { actionDebriefs, actions, actionServices, actionStockItems, actionSuppliers, actionTeamMembers, actionTypes, cities, commercialSupervisors, serviceTypes, stockItems, suppliers, users } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

async function requireDatabase() { const database = await getDb(); if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." }); return database; }

const allocationSchema = z.object({ stockItemId: z.number().int().positive(), quantity: z.coerce.number().positive().max(99999999) });

export function canUpdateActionStatus(currentStatus: string, nextStatus: string) {
  return !["cancelled", "completed"].includes(currentStatus) && ["in_progress", "completed", "cancelled"].includes(nextStatus);
}

export function validActionRange(startsAt: Date, endsAt: Date | null) {
  return !endsAt || endsAt >= startsAt;
}

export function normalizeStockAllocations(allocations: Array<{ stockItemId: number; quantity: number }>) {
  return Array.from(new Map(allocations.map(allocation => [allocation.stockItemId, allocation])).values());
}

async function ensureActionReferences(database: any, input: { cityId: number; actionTypeId: number; commercialSupervisorId: number | null; supplierIds: number[]; serviceTypeIds: number[]; teamMemberIds: number[]; stockAllocations: Array<{ stockItemId: number }> }) {
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
}

export const actionsRouter = router({
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "actions.read");
    const database = await requireDatabase();
    const [cityRows, typeRows, supplierRows, serviceRows, supervisorRows, teamRows, stockRows] = await Promise.all([
      database.select().from(cities).where(eq(cities.active, true)).orderBy(asc(cities.name)),
      database.select().from(actionTypes).where(eq(actionTypes.active, true)).orderBy(asc(actionTypes.name)),
      database.select().from(suppliers).where(eq(suppliers.active, true)).orderBy(asc(suppliers.displayName)),
      database.select().from(serviceTypes).where(eq(serviceTypes.active, true)).orderBy(asc(serviceTypes.name)),
      database.select().from(commercialSupervisors).where(eq(commercialSupervisors.active, true)).orderBy(asc(commercialSupervisors.name)),
      database.select({ id: users.id, name: users.name, email: users.email, jobTitle: users.jobTitle }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)),
      database.select({ id: stockItems.id, name: stockItems.name, sku: stockItems.sku, unit: stockItems.unit, cityId: stockItems.cityId }).from(stockItems).where(eq(stockItems.active, true)).orderBy(asc(stockItems.name)),
    ]);
    return { cities: cityRows, actionTypes: typeRows, suppliers: supplierRows, serviceTypes: serviceRows, supervisors: supervisorRows, teamUsers: teamRows, stockItems: stockRows };
  }),
  list: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "actions.read");
    const database = await requireDatabase();
    const [rows, teamRows, stockRows] = await Promise.all([
      database.select({ action: actions, cityName: cities.name, actionTypeName: actionTypes.name, debrief: actionDebriefs, supervisorName: commercialSupervisors.name }).from(actions).innerJoin(cities, eq(actions.cityId, cities.id)).innerJoin(actionTypes, eq(actions.actionTypeId, actionTypes.id)).leftJoin(actionDebriefs, eq(actionDebriefs.actionId, actions.id)).leftJoin(commercialSupervisors, eq(actions.commercialSupervisorId, commercialSupervisors.id)).orderBy(asc(actions.scheduledFor)),
      database.select({ actionId: actionTeamMembers.actionId, userId: users.id, name: users.name, jobTitle: users.jobTitle }).from(actionTeamMembers).innerJoin(users, eq(actionTeamMembers.userId, users.id)),
      database.select({ actionId: actionStockItems.actionId, stockItemId: stockItems.id, name: stockItems.name, unit: stockItems.unit, plannedQuantity: actionStockItems.plannedQuantity }).from(actionStockItems).innerJoin(stockItems, eq(actionStockItems.stockItemId, stockItems.id)),
    ]);
    return rows.map(row => ({ ...row, teamMembers: teamRows.filter(member => member.actionId === row.action.id), stockItems: stockRows.filter(item => item.actionId === row.action.id) }));
  }),
  create: protectedProcedure.input(z.object({
    cityId: z.number().int().positive(), actionTypeId: z.number().int().positive(), name: z.string().trim().min(2).max(180), address: z.string().trim().max(2000).optional(), latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(), scheduledFor: z.coerce.date(), endsAt: z.coerce.date().nullable(), objective: z.string().trim().min(3).max(2000), commercialSupervisorId: z.number().int().positive().nullable(), partnershipType: z.enum(["paid", "barter", "mixed"]), estimatedCost: z.coerce.number().finite().min(0).max(99999999999), supplierIds: z.array(z.number().int().positive()).max(20), serviceTypeIds: z.array(z.number().int().positive()).max(20), teamMemberIds: z.array(z.number().int().positive()).max(40), stockAllocations: z.array(allocationSchema).max(40),
  })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.write");
    if (!validActionRange(input.scheduledFor, input.endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O término da ação deve ser posterior ao início." });
    const database = await requireDatabase();
    await ensureActionReferences(database, input);
    const stockAllocations = normalizeStockAllocations(input.stockAllocations);
    const created = await database.transaction(async transaction => {
      const [action] = await transaction.insert(actions).values({ cityId: input.cityId, actionTypeId: input.actionTypeId, name: input.name, address: input.address || null, latitude: input.latitude?.toFixed(7) ?? null, longitude: input.longitude?.toFixed(7) ?? null, scheduledFor: input.scheduledFor, endsAt: input.endsAt, objective: input.objective, commercialSupervisorId: input.commercialSupervisorId, partnershipType: input.partnershipType, estimatedCost: input.estimatedCost.toFixed(2) }).returning();
      if (input.supplierIds.length) await transaction.insert(actionSuppliers).values(Array.from(new Set(input.supplierIds)).map(supplierId => ({ actionId: action.id, supplierId })));
      if (input.serviceTypeIds.length) await transaction.insert(actionServices).values(Array.from(new Set(input.serviceTypeIds)).map(serviceTypeId => ({ actionId: action.id, serviceTypeId })));
      if (input.teamMemberIds.length) await transaction.insert(actionTeamMembers).values(Array.from(new Set(input.teamMemberIds)).map(userId => ({ actionId: action.id, userId })));
      if (stockAllocations.length) await transaction.insert(actionStockItems).values(stockAllocations.map(allocation => ({ actionId: action.id, stockItemId: allocation.stockItemId, plannedQuantity: allocation.quantity.toFixed(2) })));
      return action;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "action", entityId: created.id, action: "create", afterData: { ...created, teamMemberIds: input.teamMemberIds, stockAllocations, estimatedCost: input.estimatedCost } });
    return created;
  }),
  updateExecutionStatus: protectedProcedure.input(z.object({ actionId: z.number().int().positive(), status: z.enum(["in_progress", "completed", "cancelled"]) })).mutation(async ({ ctx, input }) => { await assertPermission(ctx.user, "actions.write"); const database = await requireDatabase(); const [before] = await database.select().from(actions).where(eq(actions.id, input.actionId)).limit(1); if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Ação não encontrada." }); if (!canUpdateActionStatus(before.status, input.status)) throw new TRPCError({ code: "CONFLICT", message: "O status desta ação não pode mais ser alterado." }); const [updated] = await database.update(actions).set({ status: input.status, updatedAt: new Date() }).where(eq(actions.id, input.actionId)).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "action", entityId: updated.id, action: "update_execution_status", beforeData: before, afterData: updated }); return updated; }),
  saveDebrief: protectedProcedure.input(z.object({ actionId: z.number().int().positive(), rating: z.number().int().min(1).max(5), notes: z.string().trim().max(3000).optional(), positives: z.string().trim().max(2000).optional(), negatives: z.string().trim().max(2000).optional(), resultAchieved: z.boolean(), worthRepeating: z.boolean().nullable(), completedAt: z.coerce.date() })).mutation(async ({ ctx, input }) => { await assertPermission(ctx.user, "actions.write"); const database = await requireDatabase(); const [current] = await database.select().from(actionDebriefs).where(eq(actionDebriefs.actionId, input.actionId)); const values = { ...input, notes: input.notes || null, positives: input.positives || null, negatives: input.negatives || null }; const [saved] = current ? await database.update(actionDebriefs).set(values).where(eq(actionDebriefs.actionId, input.actionId)).returning() : await database.insert(actionDebriefs).values(values).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "action_debrief", entityId: saved.id, action: current ? "update" : "create", afterData: saved }); return saved; }),
});
