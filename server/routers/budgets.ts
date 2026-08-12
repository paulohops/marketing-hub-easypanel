import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";
import { monthlyBudgets, operationCosts, tradeOperations } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const budgetTypes = ["trade_events", "branding_b2c"] as const;
const costValues = z.number().nonnegative().max(10_000_000);
const monthInput = z.string().regex(/^\d{4}-\d{2}$/, "Informe o mês no formato AAAA-MM.");

export function monthBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(year, monthNumber - 1, 1)), end: new Date(Date.UTC(year, monthNumber, 1)), storedDate: `${month}-01` };
}

export function totalCost(cost: { investmentBase: string; permitCost: string; storeCost: string; otherCosts: string }) {
  return Number(cost.investmentBase) + Number(cost.permitCost) + Number(cost.storeCost) + Number(cost.otherCosts);
}

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
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
    const [budgetRows, costRows] = await Promise.all([
      database.select().from(monthlyBudgets).where(eq(monthlyBudgets.competenceMonth, storedDate)),
      database.select({ cost: operationCosts }).from(operationCosts).innerJoin(tradeOperations, eq(operationCosts.operationId, tradeOperations.id)).where(and(eq(operationCosts.status, "approved"), gte(tradeOperations.startsAt, start), lt(tradeOperations.startsAt, end))),
    ]);
    return budgetTypes.map(budgetType => {
      const budget = budgetRows.find(row => row.budgetType === budgetType);
      const realized = costRows.filter(row => row.cost.budgetType === budgetType).reduce((sum, row) => sum + totalCost(row.cost), 0);
      const total = Number(budget?.totalAmount ?? 0);
      return { budgetType, total, realized, available: total - realized, hasBudget: Boolean(budget) };
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

  listCosts: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "finance.read");
    const database = await requireDatabase();
    const rows = await database.select({ cost: operationCosts, operation: tradeOperations }).from(operationCosts).innerJoin(tradeOperations, eq(operationCosts.operationId, tradeOperations.id)).orderBy(asc(tradeOperations.startsAt));
    return rows.map(row => ({ ...row.cost, operationName: row.operation.name, operationStartsAt: row.operation.startsAt, total: totalCost(row.cost) }));
  }),

  operationOptions: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "finance.read");
    const database = await requireDatabase();
    return database.select({ id: tradeOperations.id, name: tradeOperations.name, startsAt: tradeOperations.startsAt, status: tradeOperations.status }).from(tradeOperations).orderBy(asc(tradeOperations.startsAt));
  }),

  upsertCost: protectedProcedure.input(z.object({ operationId: z.number().int().positive(), budgetType: z.enum(budgetTypes), investmentBase: costValues, permitCost: costValues, storeCost: costValues, otherCosts: costValues, notes: z.string().trim().max(2_000).optional(), submitForApproval: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
    const database = await requireDatabase();
    const [operation, before] = await Promise.all([
      database.select({ id: tradeOperations.id }).from(tradeOperations).where(eq(tradeOperations.id, input.operationId)).limit(1),
      database.select().from(operationCosts).where(eq(operationCosts.operationId, input.operationId)).limit(1),
    ]);
    if (!operation[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Operação não encontrada." });
    await assertPermission(ctx.user, before[0] ? "finance.update" : "finance.create");
    if (before[0] && ["approved", "rejected"].includes(before[0].status)) throw new TRPCError({ code: "CONFLICT", message: "Custos aprovados ou rejeitados não podem ser alterados." });
    const status: "pending_approval" | "draft" = input.submitForApproval ? "pending_approval" : "draft";
    const values = { operationId: input.operationId, budgetType: input.budgetType, investmentBase: input.investmentBase.toFixed(2), permitCost: input.permitCost.toFixed(2), storeCost: input.storeCost.toFixed(2), otherCosts: input.otherCosts.toFixed(2), notes: input.notes || null, status, createdByUserId: ctx.user.id, updatedAt: new Date() };
    const [saved] = await database.insert(operationCosts).values(values).onConflictDoUpdate({ target: operationCosts.operationId, set: { budgetType: values.budgetType, investmentBase: values.investmentBase, permitCost: values.permitCost, storeCost: values.storeCost, otherCosts: values.otherCosts, notes: values.notes, status: values.status, updatedAt: values.updatedAt } }).returning();
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
