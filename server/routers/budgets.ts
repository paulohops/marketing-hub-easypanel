import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";
import { actions, events, mediaCampaigns, monthlyBudgets, operationCosts, tradeOperations } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const budgetTypes = ["trade_events", "branding_b2c"] as const;
const costOperationTypes = ["media_campaign", "action", "event", "trade_operation"] as const;
const operationOptionOffsets = { media_campaign: 1_000_000, action: 2_000_000, event: 3_000_000, trade_operation: 4_000_000 } as const;
const costValues = z.number().nonnegative().max(10_000_000);
const monthInput = z.string().regex(/^\d{4}-\d{2}$/, "Informe o mês no formato AAAA-MM.");
const yearInput = z.number().int().min(2020).max(2100);

export function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(year, monthNumber - 1, 1)), end: new Date(Date.UTC(year, monthNumber, 1)), storedDate: `${month}-01` };
}

export function annualMonths(year: number) {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
}

export function distributeAnnualAmount(annualAmount: number) {
  const cents = Math.round(annualAmount * 100);
  const base = Math.floor(cents / 12);
  return Array.from({ length: 12 }, (_, index) => (base + (index < cents % 12 ? 1 : 0)) / 100);
}

export function totalCost(cost: { investmentBase: string; permitCost: string; storeCost: string; otherCosts: string }) {
  return Number(cost.investmentBase) + Number(cost.permitCost) + Number(cost.storeCost) + Number(cost.otherCosts);
}

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

async function operationCatalog(database: Awaited<ReturnType<typeof getDb>>) {
  if (!database) return [];
  const [campaignRows, actionRows, eventRows, legacyRows] = await Promise.all([
    database.select({ id: mediaCampaigns.id, name: mediaCampaigns.name, startsOn: mediaCampaigns.startsOn, status: mediaCampaigns.status }).from(mediaCampaigns).orderBy(asc(mediaCampaigns.startsOn)),
    database.select({ id: actions.id, name: actions.name, scheduledFor: actions.scheduledFor, status: actions.status }).from(actions).orderBy(asc(actions.scheduledFor)),
    database.select({ id: events.id, name: events.name, startsAt: events.startsAt, status: events.status }).from(events).orderBy(asc(events.startsAt)),
    database.select({ id: tradeOperations.id, name: tradeOperations.name, startsAt: tradeOperations.startsAt, status: tradeOperations.status }).from(tradeOperations).orderBy(asc(tradeOperations.startsAt)),
  ]);
  return [
    ...campaignRows.map(row => ({ id: row.id, name: row.name, label: `Mídia · ${row.name}`, operationType: "media_campaign" as const, startsAt: new Date(`${row.startsOn}T12:00:00.000Z`), status: row.status })),
    ...actionRows.map(row => ({ id: row.id, name: row.name, label: `Ação · ${row.name}`, operationType: "action" as const, startsAt: new Date(`${row.scheduledFor}T12:00:00.000Z`), status: row.status })),
    ...eventRows.map(row => ({ id: row.id, name: row.name, label: `Evento · ${row.name}`, operationType: "event" as const, startsAt: row.startsAt, status: row.status })),
    ...legacyRows.map(row => ({ id: row.id, name: row.name, label: `Operação legada · ${row.name}`, operationType: "trade_operation" as const, startsAt: row.startsAt, status: row.status })),
  ].sort((first, second) => first.startsAt.getTime() - second.startsAt.getTime());
}

export function encodeOperationOptionId(operationType: (typeof costOperationTypes)[number], operationId: number) {
  return operationOptionOffsets[operationType] + operationId;
}

export function decodeOperationOptionId(optionId: number) {
  const operationType = costOperationTypes.find(type => optionId > operationOptionOffsets[type] && optionId < operationOptionOffsets[type] + 1_000_000);
  return operationType ? { operationType, operationId: optionId - operationOptionOffsets[operationType] } : null;
}

export const budgetsRouter = router({
  listBudgets: protectedProcedure.input(z.object({ month: monthInput })).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.read");
    const database = await requireDatabase();
    return database.select().from(monthlyBudgets).where(eq(monthlyBudgets.competenceMonth, monthBounds(input.month).storedDate)).orderBy(asc(monthlyBudgets.budgetType));
  }),

  summary: protectedProcedure.input(z.object({ month: monthInput })).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.read");
    const database = await requireDatabase();
    const { start, end, storedDate } = monthBounds(input.month);
    const [budgetRows, costRows, operations] = await Promise.all([
      database.select().from(monthlyBudgets).where(eq(monthlyBudgets.competenceMonth, storedDate)),
      database.select().from(operationCosts).where(eq(operationCosts.status, "approved")),
      operationCatalog(database),
    ]);
    const costsInMonth = costRows.filter(cost => {
      const operation = operations.find(candidate => candidate.operationType === cost.operationType && candidate.id === cost.operationId);
      return operation && operation.startsAt >= start && operation.startsAt < end;
    });
    return budgetTypes.map(budgetType => {
      const budget = budgetRows.find(row => row.budgetType === budgetType);
      const realized = costsInMonth.filter(row => row.budgetType === budgetType).reduce((sum, row) => sum + totalCost(row), 0);
      const total = Number(budget?.totalAmount ?? 0);
      return { budgetType, total, realized, available: total - realized, hasBudget: Boolean(budget) };
    });
  }),

  annualSummary: protectedProcedure.input(z.object({ year: yearInput })).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.read");
    const database = await requireDatabase();
    const months = annualMonths(input.year);
    const start = new Date(Date.UTC(input.year, 0, 1));
    const end = new Date(Date.UTC(input.year + 1, 0, 1));
    const [budgetRows, costRows, operations] = await Promise.all([
      database.select().from(monthlyBudgets).where(and(gte(monthlyBudgets.competenceMonth, `${input.year}-01-01`), lt(monthlyBudgets.competenceMonth, `${input.year + 1}-01-01`))),
      database.select().from(operationCosts).where(eq(operationCosts.status, "approved")),
      operationCatalog(database),
    ]);
    const relevantCosts = costRows.filter(cost => {
      const operation = operations.find(candidate => candidate.operationType === cost.operationType && candidate.id === cost.operationId);
      return operation && operation.startsAt >= start && operation.startsAt < end;
    });
    return budgetTypes.map(budgetType => {
      const monthly = months.map(month => {
        const bounds = monthBounds(month);
        const planned = Number(budgetRows.find(row => row.budgetType === budgetType && row.competenceMonth === bounds.storedDate)?.totalAmount ?? 0);
        const realized = relevantCosts.filter(cost => {
          const operation = operations.find(candidate => candidate.operationType === cost.operationType && candidate.id === cost.operationId);
          return cost.budgetType === budgetType && operation && operation.startsAt >= bounds.start && operation.startsAt < bounds.end;
        }).reduce((sum, cost) => sum + totalCost(cost), 0);
        return { month, planned, realized, available: planned - realized };
      });
      const planned = monthly.reduce((sum, item) => sum + item.planned, 0);
      const realized = monthly.reduce((sum, item) => sum + item.realized, 0);
      return { budgetType, planned, realized, available: planned - realized, configuredMonths: monthly.filter(item => item.planned > 0).length, monthly };
    });
  }),

  saveBudget: protectedProcedure.input(z.object({ month: monthInput, budgetType: z.enum(budgetTypes), totalAmount: z.number().nonnegative().max(100_000_000), notes: z.string().trim().max(2_000).optional() })).mutation(async ({ ctx, input }) => {
    const database = await requireDatabase();
    const storedDate = monthBounds(input.month).storedDate;
    const [before] = await database.select().from(monthlyBudgets).where(and(eq(monthlyBudgets.competenceMonth, storedDate), eq(monthlyBudgets.budgetType, input.budgetType))).limit(1);
    await assertPermission(ctx.user, before ? "finance.update" : "finance.create");
    const [saved] = await database.insert(monthlyBudgets).values({ competenceMonth: storedDate, budgetType: input.budgetType, totalAmount: input.totalAmount.toFixed(2), notes: input.notes || null, createdByUserId: ctx.user.id, updatedAt: new Date() }).onConflictDoUpdate({ target: [monthlyBudgets.competenceMonth, monthlyBudgets.budgetType], set: { totalAmount: input.totalAmount.toFixed(2), notes: input.notes || null, updatedAt: new Date() } }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "monthly_budget", entityId: saved.id, action: before ? "update" : "create", beforeData: before, afterData: saved });
    return saved;
  }),

  saveAnnualBudget: protectedProcedure.input(z.object({ year: yearInput, budgetType: z.enum(budgetTypes), annualAmount: z.number().positive().max(100_000_000), notes: z.string().trim().max(2_000).optional(), replaceExisting: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
    const database = await requireDatabase();
    const months = annualMonths(input.year);
    const existing = await database.select().from(monthlyBudgets).where(and(eq(monthlyBudgets.budgetType, input.budgetType), gte(monthlyBudgets.competenceMonth, `${input.year}-01-01`), lt(monthlyBudgets.competenceMonth, `${input.year + 1}-01-01`)));
    await assertPermission(ctx.user, existing.length ? "finance.update" : "finance.create");
    if (existing.length && !input.replaceExisting) throw new TRPCError({ code: "CONFLICT", message: "Já existem verbas mensais nesta categoria e ano. Confirme a substituição para redistribuir a verba anual." });
    const distributed = distributeAnnualAmount(input.annualAmount);
    const saved = await Promise.all(months.map(async (month, index) => {
      const competenceMonth = monthBounds(month).storedDate;
      const [row] = await database.insert(monthlyBudgets).values({ competenceMonth, budgetType: input.budgetType, totalAmount: distributed[index].toFixed(2), notes: input.notes || null, createdByUserId: ctx.user.id, updatedAt: new Date() }).onConflictDoUpdate({ target: [monthlyBudgets.competenceMonth, monthlyBudgets.budgetType], set: { totalAmount: distributed[index].toFixed(2), notes: input.notes || null, updatedAt: new Date() } }).returning();
      return row;
    }));
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "monthly_budget", entityId: saved[0].id, action: existing.length ? "annual_redistribution" : "annual_distribution", beforeData: { year: input.year, budgetType: input.budgetType, affectedMonths: existing.length }, afterData: { year: input.year, budgetType: input.budgetType, annualAmount: input.annualAmount, distributedMonths: months.length } });
    return { saved, monthlyAmount: distributed[0] };
  }),

  listCosts: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "finance.read");
    const database = await requireDatabase();
    const [costRows, operations] = await Promise.all([database.select().from(operationCosts), operationCatalog(database)]);
    return costRows.map(cost => {
      const operation = operations.find(candidate => candidate.operationType === cost.operationType && candidate.id === cost.operationId);
      return { ...cost, operationName: operation?.label ?? "Operação não localizada", operationStartsAt: operation?.startsAt ?? cost.createdAt, total: totalCost(cost) };
    }).sort((first, second) => first.operationStartsAt.getTime() - second.operationStartsAt.getTime());
  }),

  operationOptions: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "finance.read");
    const database = await requireDatabase();
    return (await operationCatalog(database)).map(operation => ({ ...operation, id: encodeOperationOptionId(operation.operationType, operation.id), name: operation.label }));
  }),

  upsertCost: protectedProcedure.input(z.object({ operationId: z.number().int().positive(), budgetType: z.enum(budgetTypes), investmentBase: costValues, permitCost: costValues, storeCost: costValues, otherCosts: costValues, notes: z.string().trim().max(2_000).optional(), submitForApproval: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
    const database = await requireDatabase();
    const selectedOperation = decodeOperationOptionId(input.operationId);
    if (!selectedOperation) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma operação válida da lista." });
    const [operations, before] = await Promise.all([
      operationCatalog(database),
      database.select().from(operationCosts).where(and(eq(operationCosts.operationId, selectedOperation.operationId), eq(operationCosts.operationType, selectedOperation.operationType))).limit(1),
    ]);
    if (!operations.some(operation => operation.id === selectedOperation.operationId && operation.operationType === selectedOperation.operationType)) throw new TRPCError({ code: "NOT_FOUND", message: "Operação não encontrada." });
    await assertPermission(ctx.user, before[0] ? "finance.update" : "finance.create");
    if (before[0] && ["approved", "rejected"].includes(before[0].status)) throw new TRPCError({ code: "CONFLICT", message: "Custos aprovados ou rejeitados não podem ser alterados." });
    const status: "pending_approval" | "draft" = input.submitForApproval ? "pending_approval" : "draft";
    const values = { operationId: selectedOperation.operationId, operationType: selectedOperation.operationType, budgetType: input.budgetType, investmentBase: input.investmentBase.toFixed(2), permitCost: input.permitCost.toFixed(2), storeCost: input.storeCost.toFixed(2), otherCosts: input.otherCosts.toFixed(2), notes: input.notes || null, status, createdByUserId: ctx.user.id, updatedAt: new Date() };
    const [saved] = await database.insert(operationCosts).values(values).onConflictDoUpdate({ target: [operationCosts.operationType, operationCosts.operationId], set: { budgetType: values.budgetType, investmentBase: values.investmentBase, permitCost: values.permitCost, storeCost: values.storeCost, otherCosts: values.otherCosts, notes: values.notes, status: values.status, updatedAt: values.updatedAt } }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "operation_cost", entityId: saved.id, action: before[0] ? "update" : "create", beforeData: before[0], afterData: saved });
    return { ...saved, total: totalCost(saved) };
  }),

  reviewCost: protectedProcedure.input(z.object({ costId: z.number().int().positive(), status: z.enum(["approved", "rejected"]) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.update");
    const database = await requireDatabase();
    const [before] = await database.select().from(operationCosts).where(eq(operationCosts.id, input.costId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Custo operacional não encontrado." });
    if (before.status !== "pending_approval") throw new TRPCError({ code: "CONFLICT", message: "Somente custos pendentes podem ser aprovados ou rejeitados." });
    if (before.createdByUserId === ctx.user.id && ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Um custo não pode ser aprovado pela mesma pessoa que o cadastrou." });
    const [updated] = await database.update(operationCosts).set({ status: input.status, approvedByUserId: ctx.user.id, approvedAt: new Date(), updatedAt: new Date() }).where(eq(operationCosts.id, input.costId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "operation_cost", entityId: updated.id, action: input.status, beforeData: before, afterData: updated });
    return { ...updated, total: totalCost(updated) };
  }),
});
