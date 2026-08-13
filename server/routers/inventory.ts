import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { cities, regionals, stockBalances, stockItems, stockMovements, stockTransfers, users } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { writeAuditLog } from "../audit";
import { storagePut } from "../storage";

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

const stockCategoryValues = ["brinde_relacionamento", "brinde_vip", "material_suporte"] as const;
const photoMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 160) || "foto";
}
const inventoryListInput = z.object({
  regionalId: z.number().int().positive().optional(),
  cityId: z.number().int().positive().optional(),
  category: z.enum(stockCategoryValues).optional(),
}).optional();

const stockItemUpdateInput = z.object({
  id: z.number().int().positive(),
  sku: z.string().trim().min(2).max(64).toUpperCase(),
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2_000).optional(),
  unit: z.string().trim().min(1).max(24),
  category: z.enum(stockCategoryValues),
  minimumQuantity: z.number().nonnegative().max(1_000_000),
  active: z.boolean(),
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

  list: protectedProcedure.input(inventoryListInput).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "inventory.read");
    const database = await requireDatabase();
    const conditions = [];
    if (input?.regionalId) conditions.push(eq(stockItems.regionalId, input.regionalId));
    if (input?.cityId) conditions.push(eq(stockItems.cityId, input.cityId));
    if (input?.category) conditions.push(eq(stockItems.category, input.category));
    const where = conditions.length ? and(...conditions) : undefined;
    const [items, movements] = await Promise.all([
      database.select({ item: stockItems, regionalName: regionals.name, cityName: cities.name, materializedBalance: stockBalances.quantity }).from(stockItems).innerJoin(regionals, eq(stockItems.regionalId, regionals.id)).leftJoin(cities, eq(stockItems.cityId, cities.id)).leftJoin(stockBalances, eq(stockBalances.stockItemId, stockItems.id)).where(where).orderBy(asc(stockItems.name)),
      database.select().from(stockMovements),
    ]);
    return items.map(({ item, regionalName, cityName, materializedBalance }) => {
      const relatedMovements = movements.filter(movement => movement.stockItemId === item.id);
      return { ...item, regionalName, cityName, balance: materializedBalance === null ? calculateStockBalance(relatedMovements) : Number(materializedBalance), movementCount: relatedMovements.length };
    });
  }),

  territorialSummary: protectedProcedure.input(z.object({ regionalId: z.number().int().positive().optional(), cityId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "inventory.read");
    const database = await requireDatabase();
    const conditions = [];
    if (input?.regionalId) conditions.push(eq(stockItems.regionalId, input.regionalId));
    if (input?.cityId) conditions.push(eq(stockItems.cityId, input.cityId));
    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await database.select({ regionalId: stockItems.regionalId, regionalName: regionals.name, cityId: stockItems.cityId, cityName: cities.name, category: stockItems.category, balance: stockBalances.quantity }).from(stockItems).innerJoin(regionals, eq(stockItems.regionalId, regionals.id)).leftJoin(cities, eq(stockItems.cityId, cities.id)).leftJoin(stockBalances, eq(stockBalances.stockItemId, stockItems.id)).where(where);
    const summary = new Map<string, { regionalId: number; regionalName: string; cityId: number | null; cityName: string; category: (typeof stockCategoryValues)[number]; itemCount: number; quantity: number }>();
    for (const row of rows) {
      const cityName = row.cityName ?? "Estoque regional";
      const key = [row.regionalId, row.cityId ?? "regional", row.category].join(":");
      const current = summary.get(key) ?? { regionalId: row.regionalId, regionalName: row.regionalName, cityId: row.cityId, cityName, category: row.category, itemCount: 0, quantity: 0 };
      current.itemCount += 1;
      current.quantity += Number(row.balance ?? 0);
      summary.set(key, current);
    }
    return Array.from(summary.values()).sort((first, second) => first.regionalName.localeCompare(second.regionalName) || first.cityName.localeCompare(second.cityName) || first.category.localeCompare(second.category));
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

  createItem: protectedProcedure.input(z.object({ regionalId: z.number().int().positive(), cityId: z.number().int().positive().nullable(), sku: z.string().trim().min(2).max(64).toUpperCase(), name: z.string().trim().min(2).max(180), description: z.string().trim().max(2000).optional(), unit: z.string().trim().min(1).max(24).default("un"), category: z.enum(stockCategoryValues).default("material_suporte"), minimumQuantity: z.number().nonnegative().max(1_000_000).default(0) })).mutation(async ({ ctx, input }) => {
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

  uploadPhoto: protectedProcedure.input(z.object({ stockItemId: z.number().int().positive(), originalName: z.string().trim().min(1).max(255), mimeType: z.enum(photoMimeTypes), dataBase64: z.string().min(1).max(4_200_000) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "inventory.update");
    const database = await requireDatabase();
    const [item] = await database.select().from(stockItems).where(eq(stockItems.id, input.stockItemId)).limit(1);
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item de estoque não encontrado." });
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (!bytes.length || bytes.length > 3 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "A foto do item deve ter até 3 MB." });
    const stored = await storagePut(`trade/stock/${item.id}/foto-${Date.now()}-${safeFileName(input.originalName)}`, bytes, input.mimeType);
    const [updated] = await database.update(stockItems).set({ photoStorageKey: stored.key, photoUrl: stored.url, updatedAt: new Date() }).where(eq(stockItems.id, item.id)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: item.regionalId, entityType: "stock_item", entityId: item.id, action: "upload_photo", beforeData: { photoStorageKey: item.photoStorageKey }, afterData: { photoStorageKey: updated.photoStorageKey } });
    return updated;
  }),

  updateStockItem: protectedProcedure.input(stockItemUpdateInput).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "inventory.update");
    const database = await requireDatabase();
    const [before] = await database.select().from(stockItems).where(eq(stockItems.id, input.id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Item de estoque não encontrado." });
    const [updated] = await database.update(stockItems).set({
      sku: input.sku,
      name: input.name,
      description: input.description || null,
      unit: input.unit,
      category: input.category,
      minimumQuantity: input.minimumQuantity.toFixed(2),
      active: input.active,
      updatedAt: new Date(),
    }).where(eq(stockItems.id, input.id)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: before.regionalId, entityType: "stock_item", entityId: updated.id, action: "update", beforeData: before, afterData: updated });
    return updated;
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

  transfer: protectedProcedure.input(z.object({ sourceStockItemId: z.number().int().positive(), destinationStockItemId: z.number().int().positive(), quantity: z.number().positive().max(1_000_000), occurredAt: z.coerce.date(), notes: z.string().trim().max(2_000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "inventory.update");
    if (input.sourceStockItemId === input.destinationStockItemId) throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha itens de origem e destino diferentes." });
    const database = await requireDatabase();
    const transfer = await database.transaction(async transaction => {
      const [source, destination] = await Promise.all([
        transaction.select().from(stockItems).where(eq(stockItems.id, input.sourceStockItemId)).limit(1),
        transaction.select().from(stockItems).where(eq(stockItems.id, input.destinationStockItemId)).limit(1),
      ]);
      if (!source[0] || !destination[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Item de origem ou destino não encontrado." });
      if (!source[0].cityId || !destination[0].cityId || source[0].cityId === destination[0].cityId) throw new TRPCError({ code: "BAD_REQUEST", message: "A transferência deve ocorrer entre duas cidades diferentes." });
      if (source[0].sku !== destination[0].sku || source[0].unit !== destination[0].unit || source[0].category !== destination[0].category) throw new TRPCError({ code: "BAD_REQUEST", message: "Os itens transferidos devem possuir o mesmo SKU, unidade e categoria." });
      await transaction.insert(stockBalances).values([{ stockItemId: source[0].id, quantity: "0.00" }, { stockItemId: destination[0].id, quantity: "0.00" }]).onConflictDoNothing();
      const [created] = await transaction.insert(stockTransfers).values({ sourceStockItemId: source[0].id, destinationStockItemId: destination[0].id, quantity: input.quantity.toFixed(2), transferredAt: input.occurredAt, notes: input.notes || null, performedByUserId: ctx.user.id }).returning();
      const [sourceBalance] = await transaction.update(stockBalances).set({ quantity: sql`${stockBalances.quantity} - ${input.quantity.toFixed(2)}`, updatedAt: new Date() }).where(and(eq(stockBalances.stockItemId, source[0].id), sql`${stockBalances.quantity} - ${input.quantity.toFixed(2)} >= 0`)).returning();
      if (!sourceBalance) throw new TRPCError({ code: "BAD_REQUEST", message: "A transferência deixaria o estoque de origem negativo." });
      await transaction.update(stockBalances).set({ quantity: sql`${stockBalances.quantity} + ${input.quantity.toFixed(2)}`, updatedAt: new Date() }).where(eq(stockBalances.stockItemId, destination[0].id));
      const reference = `Transferência #${created.id}`;
      await transaction.insert(stockMovements).values([
        { stockItemId: source[0].id, movementType: "exit", quantity: input.quantity.toFixed(2), occurredAt: input.occurredAt, reference, notes: input.notes || "Transferência para a cidade de destino.", performedByUserId: ctx.user.id },
        { stockItemId: destination[0].id, movementType: "entry", quantity: input.quantity.toFixed(2), occurredAt: input.occurredAt, reference, notes: input.notes || "Transferência recebida da cidade de origem.", performedByUserId: ctx.user.id },
      ]);
      return { created, source: source[0] };
    });
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: transfer.source.regionalId, entityType: "stock_transfer", entityId: transfer.created.id, action: "create", beforeData: { sourceStockItemId: input.sourceStockItemId }, afterData: transfer.created });
    return transfer.created;
  }),
});
