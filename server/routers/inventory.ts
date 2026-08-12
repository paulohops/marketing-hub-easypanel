import { asc, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { cities, regionals, stockItems, stockMovements, users } from "../../drizzle/schema";
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

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

export const inventoryRouter = router({
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    assertPermission(ctx.user, "inventory.read");
    const database = await requireDatabase();
    const [regionalRows, cityRows] = await Promise.all([
      database.select().from(regionals).where(eq(regionals.active, true)).orderBy(asc(regionals.name)),
      database.select().from(cities).where(eq(cities.active, true)).orderBy(asc(cities.name)),
    ]);
    return { regionals: regionalRows, cities: cityRows };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    assertPermission(ctx.user, "inventory.read");
    const database = await requireDatabase();
    const [items, movements] = await Promise.all([
      database.select({ item: stockItems, regionalName: regionals.name, cityName: cities.name }).from(stockItems).innerJoin(regionals, eq(stockItems.regionalId, regionals.id)).leftJoin(cities, eq(stockItems.cityId, cities.id)).orderBy(asc(stockItems.name)),
      database.select().from(stockMovements),
    ]);
    return items.map(({ item, regionalName, cityName }) => {
      const relatedMovements = movements.filter(movement => movement.stockItemId === item.id);
      return { ...item, regionalName, cityName, balance: calculateStockBalance(relatedMovements), movementCount: relatedMovements.length };
    });
  }),

  listMovements: protectedProcedure.input(z.object({ stockItemId: z.number().int().positive().optional() })).query(async ({ ctx, input }) => {
    assertPermission(ctx.user, "inventory.read");
    if (!input.stockItemId) return [];
    const database = await requireDatabase();
    return database.select({ movement: stockMovements, performedByName: users.name }).from(stockMovements).leftJoin(users, eq(stockMovements.performedByUserId, users.id)).where(eq(stockMovements.stockItemId, input.stockItemId)).orderBy(desc(stockMovements.occurredAt), desc(stockMovements.id));
  }),

  createItem: protectedProcedure.input(z.object({ regionalId: z.number().int().positive(), cityId: z.number().int().positive().nullable(), sku: z.string().trim().min(2).max(64).toUpperCase(), name: z.string().trim().min(2).max(180), description: z.string().trim().max(2000).optional(), unit: z.string().trim().min(1).max(24).default("un"), minimumQuantity: z.number().nonnegative().max(1_000_000).default(0) })).mutation(async ({ ctx, input }) => {
    assertPermission(ctx.user, "inventory.write");
    const database = await requireDatabase();
    const [created] = await database.insert(stockItems).values({ ...input, description: input.description || null, minimumQuantity: input.minimumQuantity.toFixed(2) }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: input.regionalId, entityType: "stock_item", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  registerMovement: protectedProcedure.input(z.object({ stockItemId: z.number().int().positive(), movementType: z.enum(["entry", "exit", "adjustment"]), quantity: z.number().positive().max(1_000_000), unitCost: z.number().nonnegative().max(10_000_000).optional(), occurredAt: z.coerce.date(), reference: z.string().trim().max(120).optional(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    assertPermission(ctx.user, "inventory.write");
    const database = await requireDatabase();
    const [item] = await database.select().from(stockItems).where(eq(stockItems.id, input.stockItemId));
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item de estoque não encontrado." });
    const previous = await database.select({ movementType: stockMovements.movementType, quantity: stockMovements.quantity }).from(stockMovements).where(eq(stockMovements.stockItemId, input.stockItemId));
    const projectedBalance = calculateStockBalance(previous) + (input.movementType === "exit" ? -input.quantity : input.quantity);
    if (projectedBalance < 0) throw new TRPCError({ code: "BAD_REQUEST", message: "A saída informada deixaria o estoque negativo." });
    const [created] = await database.insert(stockMovements).values({ ...input, quantity: input.quantity.toFixed(2), unitCost: input.unitCost?.toFixed(2), reference: input.reference || null, notes: input.notes || null, performedByUserId: ctx.user.id }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: item.regionalId, entityType: "stock_movement", entityId: created.id, action: "create", afterData: created });
    return created;
  }),
});
