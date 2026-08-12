import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { cities, regionals, stockBalances, stockItems, stockMovements, users } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { writeAuditLog } from "../audit";

type Movement = { movementType: "entry" | "exit" | "adjustment"; quantity: string };

export function calculateStockBalance(movements: Movement[]) {
  return movements.reduce((total, movement) => {
    const quantity = Number(movement.quantity);
    if (movement.movementType === "exit") return total - quantity;
    return total + quantity;
  }, 0);
}

export function orderMovementHistory<T extends { occurredAt: Date; id: number }>(movements: T[]) {
  return [...movements].sort((first, second) => second.occurredAt.getTime() - first.occurredAt.getTime() || second.id - first.id);
}

export function movementDelta(movementType: Movement["movementType"], quantity: number) {
  return movementType === "exit" ? -quantity : quantity;
}

export function canApplyStockMovement(balance: number, movementType: Movement["movementType"], quantity: number) {
  return balance + movementDelta(movementType, quantity) >= 0;
}

export const inventoryHistoryInput = z.object({
  stockItemId: z.number().int().positive().optional(),
  regionalId: z.number().int().positive().optional(),
  cityId: z.number().int().positive().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().min(5).max(100).default(20),
});

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

export const inventoryRouter = router({
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "inventory.read");
    const database = await requireDatabase();
    const [regionalRows, cityRows] = await Promise.all([
      database.select().from(regionals).where(eq(regionals.active, true)).orderBy(asc(regionals.name)),
      database.select().from(cities).where(eq(cities.active, true)).orderBy(asc(cities.name)),
    ]);
    return { regionals: regionalRows, cities: cityRows };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "inventory.read");
    const database = await requireDatabase();
    const [items, movements] = await Promise.all([
      database.select({ item: stockItems, regionalName: regionals.name, cityName: cities.name, materializedBalance: stockBalances.quantity }).from(stockItems).innerJoin(regionals, eq(stockItems.regionalId, regionals.id)).leftJoin(cities, eq(stockItems.cityId, cities.id)).leftJoin(stockBalances, eq(stockBalances.stockItemId, stockItems.id)).orderBy(asc(stockItems.name)),
      database.select().from(stockMovements),
    ]);
    return items.map(({ item, regionalName, cityName, materializedBalance }) => {
      const relatedMovements = movements.filter(movement => movement.stockItemId === item.id);
      return { ...item, regionalName, cityName, balance: materializedBalance === null ? calculateStockBalance(relatedMovements) : Number(materializedBalance), movementCount: relatedMovements.length };
    });
  }),

  listMovements: protectedProcedure.input(inventoryHistoryInput.optional()).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "inventory.read");
    const database = await requireDatabase();
    const filters = input ?? { page: 1, pageSize: 20 };
    const conditions = [];
    if (filters.stockItemId) conditions.push(eq(stockMovements.stockItemId, filters.stockItemId));
    if (filters.regionalId) conditions.push(eq(stockItems.regionalId, filters.regionalId));
    if (filters.cityId) conditions.push(eq(stockItems.cityId, filters.cityId));
    if (filters.startsAt) conditions.push(gte(stockMovements.occurredAt, filters.startsAt));
    if (filters.endsAt) conditions.push(lte(stockMovements.occurredAt, filters.endsAt));
    const where = conditions.length ? and(...conditions) : undefined;
    const [totalRows, rows] = await Promise.all([
      database.select({ total: count() }).from(stockMovements).innerJoin(stockItems, eq(stockMovements.stockItemId, stockItems.id)).where(where),
      database.select({ movement: stockMovements, performedByName: users.name, itemName: stockItems.name, regionalName: regionals.name, cityName: cities.name }).from(stockMovements).innerJoin(stockItems, eq(stockMovements.stockItemId, stockItems.id)).innerJoin(regionals, eq(stockItems.regionalId, regionals.id)).leftJoin(cities, eq(stockItems.cityId, cities.id)).leftJoin(users, eq(stockMovements.performedByUserId, users.id)).where(where).orderBy(desc(stockMovements.occurredAt), desc(stockMovements.id)).limit(filters.pageSize).offset((filters.page - 1) * filters.pageSize),
    ]);
    return { items: rows, total: Number(totalRows[0]?.total ?? 0), page: filters.page, pageSize: filters.pageSize };
  }),

  createItem: protectedProcedure.input(z.object({ regionalId: z.number().int().positive(), cityId: z.number().int().positive().nullable(), sku: z.string().trim().min(2).max(64).toUpperCase(), name: z.string().trim().min(2).max(180), description: z.string().trim().max(2000).optional(), unit: z.string().trim().min(1).max(24).default("un"), minimumQuantity: z.number().nonnegative().max(1_000_000).default(0) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "inventory.write");
    const database = await requireDatabase();
    const created = await database.transaction(async transaction => {
      const [item] = await transaction.insert(stockItems).values({ ...input, description: input.description || null, minimumQuantity: input.minimumQuantity.toFixed(2) }).returning();
      await transaction.insert(stockBalances).values({ stockItemId: item.id, quantity: "0.00" }).onConflictDoNothing();
      return item;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: input.regionalId, entityType: "stock_item", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  registerMovement: protectedProcedure.input(z.object({ stockItemId: z.number().int().positive(), movementType: z.enum(["entry", "exit", "adjustment"]), quantity: z.number().positive().max(1_000_000), unitCost: z.number().nonnegative().max(10_000_000).optional(), occurredAt: z.coerce.date(), reference: z.string().trim().max(120).optional(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "inventory.write");
    const database = await requireDatabase();
    const { item, created } = await database.transaction(async transaction => {
      const [stockItem] = await transaction.select().from(stockItems).where(eq(stockItems.id, input.stockItemId));
      if (!stockItem) throw new TRPCError({ code: "NOT_FOUND", message: "Item de estoque não encontrado." });
      await transaction.insert(stockBalances).values({ stockItemId: stockItem.id, quantity: "0.00" }).onConflictDoNothing();
      const delta = movementDelta(input.movementType, input.quantity);
      const [balance] = await transaction.update(stockBalances).set({ quantity: sql`${stockBalances.quantity} + ${delta.toFixed(2)}`, updatedAt: new Date() }).where(and(eq(stockBalances.stockItemId, stockItem.id), sql`${stockBalances.quantity} + ${delta.toFixed(2)} >= 0`)).returning();
      if (!balance) throw new TRPCError({ code: "BAD_REQUEST", message: "A saída informada deixaria o estoque negativo." });
      const [movement] = await transaction.insert(stockMovements).values({ ...input, quantity: input.quantity.toFixed(2), unitCost: input.unitCost?.toFixed(2), reference: input.reference || null, notes: input.notes || null, performedByUserId: ctx.user.id }).returning();
      return { item: stockItem, created: movement };
    });
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: item.regionalId, entityType: "stock_movement", entityId: created.id, action: "create", afterData: created });
    return created;
  }),
});
