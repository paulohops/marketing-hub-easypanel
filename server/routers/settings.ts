import { asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { actionTypes, cities, eventTypes, mediaTypes, partners, providers, regionals, serviceTypes, stores, supplierCities, supplierMediaTypes, supplierServiceTypes, suppliers } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { writeAuditLog } from "../audit";

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

export function uniqueIds(values: number[]) {
  return Array.from(new Set(values));
}

export const settingsRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    assertPermission(ctx.user, "settings.read");
    const database = await requireDatabase();
    const [providerRows, regionalRows, cityRows, supplierRows, storeRows, partnerRows, serviceRows, mediaTypeRows, actionTypeRows, eventTypeRows] = await Promise.all([
      database.select().from(providers).orderBy(asc(providers.name)),
      database.select().from(regionals).orderBy(asc(regionals.name)),
      database.select().from(cities).orderBy(asc(cities.name)),
      database.select().from(suppliers).orderBy(asc(suppliers.displayName)),
      database.select().from(stores).orderBy(asc(stores.name)),
      database.select().from(partners).orderBy(asc(partners.name)),
      database.select().from(serviceTypes).orderBy(asc(serviceTypes.name)),
      database.select().from(mediaTypes).orderBy(asc(mediaTypes.name)),
      database.select().from(actionTypes).orderBy(asc(actionTypes.name)),
      database.select().from(eventTypes).orderBy(asc(eventTypes.name)),
    ]);
    return { providers: providerRows, regionals: regionalRows, cities: cityRows, suppliers: supplierRows, stores: storeRows, partners: partnerRows, serviceTypes: serviceRows, mediaTypes: mediaTypeRows, actionTypes: actionTypeRows, eventTypes: eventTypeRows };
  }),

  createProvider: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160) })).mutation(async ({ ctx, input }) => {
    assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [created] = await database.insert(providers).values({ name: input.name }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "provider", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  createRegional: protectedProcedure.input(z.object({ providerId: z.number().int().positive().nullable(), name: z.string().trim().min(2).max(160), code: z.string().trim().min(2).max(32).toUpperCase() })).mutation(async ({ ctx, input }) => {
    assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [created] = await database.insert(regionals).values(input).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: created.id, entityType: "regional", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  createCity: protectedProcedure.input(z.object({ regionalId: z.number().int().positive(), name: z.string().trim().min(2).max(160), state: z.string().trim().length(2).toUpperCase(), ibgeCode: z.string().trim().max(16).optional() })).mutation(async ({ ctx, input }) => {
    assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [created] = await database.insert(cities).values(input).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: input.regionalId, entityType: "city", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  createSupplier: protectedProcedure.input(z.object({ providerId: z.number().int().positive().nullable(), displayName: z.string().trim().min(2).max(180), legalName: z.string().trim().max(220).optional(), document: z.string().trim().max(32).optional(), contactName: z.string().trim().max(160).optional(), phone: z.string().trim().max(32).optional(), email: z.string().trim().email().max(320).optional() })).mutation(async ({ ctx, input }) => {
    assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [created] = await database.insert(suppliers).values({ ...input, legalName: input.legalName || null, document: input.document || null, contactName: input.contactName || null, phone: input.phone || null, email: input.email || null }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "supplier", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  supplierCoverage: protectedProcedure.query(async ({ ctx }) => {
    assertPermission(ctx.user, "settings.read");
    const database = await requireDatabase();
    const [citiesBySupplier, servicesBySupplier, mediaBySupplier] = await Promise.all([database.select().from(supplierCities), database.select().from(supplierServiceTypes), database.select().from(supplierMediaTypes)]);
    return { citiesBySupplier, servicesBySupplier, mediaBySupplier };
  }),

  setSupplierCoverage: protectedProcedure.input(z.object({ supplierId: z.number().int().positive(), cityIds: z.array(z.number().int().positive()).max(150), serviceTypeIds: z.array(z.number().int().positive()).max(150), mediaTypeIds: z.array(z.number().int().positive()).max(150) })).mutation(async ({ ctx, input }) => {
    assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const cityIds = uniqueIds(input.cityIds), serviceTypeIds = uniqueIds(input.serviceTypeIds), mediaTypeIds = uniqueIds(input.mediaTypeIds);
    await database.transaction(async transaction => {
      await transaction.delete(supplierCities).where(eq(supplierCities.supplierId, input.supplierId));
      await transaction.delete(supplierServiceTypes).where(eq(supplierServiceTypes.supplierId, input.supplierId));
      await transaction.delete(supplierMediaTypes).where(eq(supplierMediaTypes.supplierId, input.supplierId));
      if (cityIds.length) await transaction.insert(supplierCities).values(cityIds.map(cityId => ({ supplierId: input.supplierId, cityId })));
      if (serviceTypeIds.length) await transaction.insert(supplierServiceTypes).values(serviceTypeIds.map(serviceTypeId => ({ supplierId: input.supplierId, serviceTypeId })));
      if (mediaTypeIds.length) await transaction.insert(supplierMediaTypes).values(mediaTypeIds.map(mediaTypeId => ({ supplierId: input.supplierId, mediaTypeId })));
    });
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "supplier", entityId: input.supplierId, action: "set_coverage", afterData: { cityIds, serviceTypeIds, mediaTypeIds } });
    return { supplierId: input.supplierId, cityIds, serviceTypeIds, mediaTypeIds };
  }),

  createStore: protectedProcedure.input(z.object({ cityId: z.number().int().positive(), name: z.string().trim().min(2).max(160), code: z.string().trim().min(2).max(32).toUpperCase(), address: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
    assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [created] = await database.insert(stores).values({ ...input, address: input.address || null }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "store", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  createPartner: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), email: z.string().trim().email().max(320).optional(), phone: z.string().trim().max(32).optional() })).mutation(async ({ ctx, input }) => {
    assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [created] = await database.insert(partners).values({ name: input.name, email: input.email || null, phone: input.phone || null }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "partner", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  createType: protectedProcedure.input(z.object({ kind: z.enum(["service", "media", "action", "event"]), name: z.string().trim().min(2).max(160) })).mutation(async ({ ctx, input }) => {
    assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const table = { service: serviceTypes, media: mediaTypes, action: actionTypes, event: eventTypes }[input.kind];
    const [created] = await database.insert(table).values({ name: input.name }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: `${input.kind}_type`, entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  getRegional: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    assertPermission(ctx.user, "settings.read");
    const database = await requireDatabase();
    const [regional] = await database.select().from(regionals).where(eq(regionals.id, input.id));
    return regional ?? null;
  }),
});
