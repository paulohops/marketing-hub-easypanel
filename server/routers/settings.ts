import { and, asc, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { actionTypes, appSettings, cities, commercialSupervisors, eventTypes, financialCategories, mediaTypes, partners, providers, regionals, serviceTypes, stores, supplierCities, supplierMediaTypes, supplierOfferings, supplierServiceTypes, suppliers, userTrelloBoards } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { writeAuditLog } from "../audit";
import { storagePut } from "../storage";

const paymentKinds = ["paid", "barter", "mixed"] as const;
const contractMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
const imageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

function safeContractName(name: string) {
  const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_").slice(0, 180);
  return /[a-zA-Z0-9]/.test(normalized) ? normalized : "contrato";
}

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

export function uniqueIds(values: number[]) {
  return Array.from(new Set(values));
}

export function normalizeCnpj(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeTrelloUrl(value: string) {
  if (!value) return "";
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Informe uma URL válida do Trello." }); }
  if (!["trello.com", "www.trello.com"].includes(parsed.hostname)) throw new TRPCError({ code: "BAD_REQUEST", message: "A URL deve pertencer ao Trello." });
  return parsed.toString();
}

export function normalizeSpreadsheetKey(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
}

const spreadsheetImportSchema = z.object({
  providers: z.array(z.object({ name: z.string().trim().min(2).max(160), legalName: z.string().trim().max(220).optional(), billingCnpj: z.string().trim().max(32).optional(), contactName: z.string().trim().max(160).optional(), phone: z.string().trim().max(32).optional(), email: z.string().trim().email().max(320).optional(), address: z.string().trim().max(1000).optional() })).max(300),
  regionals: z.array(z.object({ providerName: z.string().trim().max(160).optional(), name: z.string().trim().min(2).max(160), code: z.string().trim().min(2).max(32).transform(value => value.toUpperCase()) })).max(300),
  cities: z.array(z.object({ regionalCode: z.string().trim().min(2).max(32).transform(value => value.toUpperCase()), name: z.string().trim().min(2).max(160), state: z.string().trim().length(2).transform(value => value.toUpperCase()), ibgeCode: z.string().trim().max(16).optional(), address: z.string().trim().max(1000).optional(), zipCode: z.string().trim().max(16).optional(), latitude: z.coerce.number().min(-90).max(90).optional(), longitude: z.coerce.number().min(-180).max(180).optional(), locationNotes: z.string().trim().max(1000).optional() })).max(500),
  stores: z.array(z.object({ regionalCode: z.string().trim().min(2).max(32).transform(value => value.toUpperCase()), cityName: z.string().trim().min(2).max(160), name: z.string().trim().min(2).max(160), code: z.string().trim().min(2).max(32).transform(value => value.toUpperCase()), address: z.string().trim().max(1000).optional() })).max(500),
});

export const settingsRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "settings.read");
    const database = await requireDatabase();
    const [providerRows, regionalRows, cityRows, supplierRows, storeRows, partnerRows, serviceRows, mediaTypeRows, actionTypeRows, eventTypeRows, financialCategoryRows, supplierOfferingRows, supervisorRows] = await Promise.all([
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
      database.select().from(financialCategories).orderBy(asc(financialCategories.name)),
      database.select().from(supplierOfferings).orderBy(asc(supplierOfferings.name)),
      database.select().from(commercialSupervisors).orderBy(asc(commercialSupervisors.name)),
    ]);
    return { providers: providerRows, regionals: regionalRows, cities: cityRows, suppliers: supplierRows, stores: storeRows, partners: partnerRows, serviceTypes: serviceRows, mediaTypes: mediaTypeRows, actionTypes: actionTypeRows, eventTypes: eventTypeRows, financialCategories: financialCategoryRows, supplierOfferings: supplierOfferingRows, commercialSupervisors: supervisorRows };
  }),

  createProvider: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), legalName: z.string().trim().max(220).optional(), billingCnpj: z.string().trim().max(32).optional(), contactName: z.string().trim().max(160).optional(), phone: z.string().trim().max(32).optional(), email: z.string().trim().email().max(320).optional(), address: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [existing] = await database.select({ id: providers.id }).from(providers).where(sql`lower(${providers.name}) = lower(${input.name})`).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe um fornecedor de origem com este nome." });
    const billingCnpj = input.billingCnpj ? normalizeCnpj(input.billingCnpj) : null;
    if (billingCnpj && billingCnpj.length !== 14) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um CNPJ de faturamento com 14 dígitos." });
    const [created] = await database.insert(providers).values({ ...input, billingCnpj, legalName: input.legalName || null, contactName: input.contactName || null, phone: input.phone || null, email: input.email || null, address: input.address || null }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "provider", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  uploadProviderLogo: protectedProcedure.input(z.object({ providerId: z.number().int().positive(), originalName: z.string().trim().min(1).max(255), mimeType: z.enum(imageMimeTypes), dataBase64: z.string().min(1).max(4_200_000) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [provider] = await database.select().from(providers).where(eq(providers.id, input.providerId)).limit(1);
    if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (!bytes.length || bytes.length > 3 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "O logotipo deve ter até 3 MB." });
    const stored = await storagePut(`trade/providers/${provider.id}/logo-${Date.now()}-${safeContractName(input.originalName)}`, bytes, input.mimeType);
    const [updated] = await database.update(providers).set({ logoStorageKey: stored.key, logoUrl: stored.url, updatedAt: new Date() }).where(eq(providers.id, provider.id)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "provider", entityId: provider.id, action: "upload_logo", beforeData: { logoStorageKey: provider.logoStorageKey }, afterData: { logoStorageKey: updated.logoStorageKey } });
    return updated;
  }),

  createRegional: protectedProcedure.input(z.object({ providerId: z.number().int().positive().nullable(), name: z.string().trim().min(2).max(160), code: z.string().trim().min(2).max(32).toUpperCase() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [existing] = await database.select({ id: regionals.id }).from(regionals).where(sql`lower(${regionals.name}) = lower(${input.name}) OR ${regionals.code} = ${input.code}`).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma regional com este nome ou código." });
    const [created] = await database.insert(regionals).values(input).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: created.id, entityType: "regional", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  createCity: protectedProcedure.input(z.object({ regionalId: z.number().int().positive(), name: z.string().trim().min(2).max(160), state: z.string().trim().length(2).toUpperCase(), ibgeCode: z.string().trim().max(16).optional(), address: z.string().trim().max(1000).optional(), zipCode: z.string().trim().max(16).optional(), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), locationNotes: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [existing] = await database.select({ id: cities.id }).from(cities).where(and(eq(cities.regionalId, input.regionalId), sql`lower(${cities.name}) = lower(${input.name})`)).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Esta cidade já está cadastrada na regional selecionada." });
    const [created] = await database.insert(cities).values({ ...input, address: input.address || null, zipCode: input.zipCode || null, latitude: input.latitude?.toFixed(7), longitude: input.longitude?.toFixed(7), locationNotes: input.locationNotes || null }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: input.regionalId, entityType: "city", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  createSupplier: protectedProcedure.input(z.object({ providerId: z.number().int().positive().nullable(), cityId: z.number().int().positive().nullable().optional(), displayName: z.string().trim().min(2).max(180), legalName: z.string().trim().max(220).optional(), document: z.string().trim().min(14).max(32), contactName: z.string().trim().max(160).optional(), phone: z.string().trim().min(8).max(32), email: z.string().trim().email().max(320), partnershipType: z.enum(paymentKinds).optional(), paymentMethod: z.string().trim().max(80).optional(), paymentRecurrence: z.string().trim().max(80).optional(), hasContract: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const document = normalizeCnpj(input.document);
    if (document.length !== 14) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um CNPJ com 14 dígitos." });
    const [sameName] = await database.select({ id: suppliers.id }).from(suppliers).where(sql`lower(${suppliers.displayName}) = lower(${input.displayName})`).limit(1);
    if (sameName) throw new TRPCError({ code: "CONFLICT", message: "Já existe um fornecedor com este nome de exibição." });
    const [sameDocument] = await database.select({ id: suppliers.id }).from(suppliers).where(sql`regexp_replace(coalesce(${suppliers.document}, ''), '[^0-9]', '', 'g') = ${document}`).limit(1);
    if (sameDocument) throw new TRPCError({ code: "CONFLICT", message: "Já existe um fornecedor cadastrado com este CNPJ." });
    const [created] = await database.insert(suppliers).values({ ...input, cityId: input.cityId ?? null, document, legalName: input.legalName || null, contactName: input.contactName || null, partnershipType: input.partnershipType ?? null, paymentMethod: input.paymentMethod || null, paymentRecurrence: input.paymentRecurrence || null, hasContract: input.hasContract ?? false }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "supplier", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  supplierCoverage: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "settings.read");
    const database = await requireDatabase();
    const [citiesBySupplier, servicesBySupplier, mediaBySupplier] = await Promise.all([database.select().from(supplierCities), database.select().from(supplierServiceTypes), database.select().from(supplierMediaTypes)]);
    return { citiesBySupplier, servicesBySupplier, mediaBySupplier };
  }),

  setSupplierCoverage: protectedProcedure.input(z.object({ supplierId: z.number().int().positive(), cityIds: z.array(z.number().int().positive()).max(150), serviceTypeIds: z.array(z.number().int().positive()).max(150), mediaTypeIds: z.array(z.number().int().positive()).max(150) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
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
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [existing] = await database.select({ id: stores.id }).from(stores).where(sql`${stores.code} = ${input.code} OR (${stores.cityId} = ${input.cityId} AND lower(${stores.name}) = lower(${input.name}))`).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma loja com este código ou nome na cidade selecionada." });
    const [created] = await database.insert(stores).values({ ...input, address: input.address || null }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "store", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  createPartner: protectedProcedure.input(z.object({ cityId: z.number().int().positive().nullable().optional(), name: z.string().trim().min(2).max(160), email: z.string().trim().email().max(320).optional(), phone: z.string().trim().max(32).optional(), partnershipType: z.enum(paymentKinds).optional(), paymentMethod: z.string().trim().max(80).optional(), paymentRecurrence: z.string().trim().max(80).optional(), hasContract: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [existing] = await database.select({ id: partners.id }).from(partners).where(input.email ? sql`lower(coalesce(${partners.email}, '')) = lower(${input.email}) OR lower(${partners.name}) = lower(${input.name})` : sql`lower(${partners.name}) = lower(${input.name})`).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe um parceiro com este nome ou e-mail." });
    const [created] = await database.insert(partners).values({ cityId: input.cityId ?? null, name: input.name, email: input.email || null, phone: input.phone || null, partnershipType: input.partnershipType ?? null, paymentMethod: input.paymentMethod || null, paymentRecurrence: input.paymentRecurrence || null, hasContract: input.hasContract ?? false }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "partner", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  createType: protectedProcedure.input(z.object({ kind: z.enum(["service", "media", "action", "event"]), name: z.string().trim().min(2).max(160) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const table = { service: serviceTypes, media: mediaTypes, action: actionTypes, event: eventTypes }[input.kind];
    const [created] = await database.insert(table).values({ name: input.name }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: `${input.kind}_type`, entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  createFinancialCategory: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), description: z.string().trim().max(600).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [existing] = await database.select({ id: financialCategories.id }).from(financialCategories).where(sql`lower(${financialCategories.name}) = lower(${input.name})`).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma categoria financeira com este nome." });
    const [created] = await database.insert(financialCategories).values({ name: input.name, description: input.description || null }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "financial_category", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  createSupplierOffering: protectedProcedure.input(z.object({ supplierId: z.number().int().positive(), kind: z.enum(["service", "media", "action", "event", "other"]), name: z.string().trim().min(2).max(180), unit: z.string().trim().min(1).max(64), unitPrice: z.number().nonnegative().max(99_999_999), notes: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [supplier] = await database.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, input.supplierId)).limit(1);
    if (!supplier) throw new TRPCError({ code: "NOT_FOUND", message: "Fornecedor não encontrado." });
    const [existing] = await database.select({ id: supplierOfferings.id }).from(supplierOfferings).where(and(eq(supplierOfferings.supplierId, input.supplierId), eq(supplierOfferings.kind, input.kind), sql`lower(${supplierOfferings.name}) = lower(${input.name})`)).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Este fornecedor já possui uma oferta com a mesma categoria e nome." });
    const [created] = await database.insert(supplierOfferings).values({ ...input, unitPrice: input.unitPrice.toFixed(2), notes: input.notes || null }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "supplier_offering", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  updateProvider: protectedProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(160), legalName: z.string().trim().max(220).optional(), billingCnpj: z.string().trim().max(32).optional(), contactName: z.string().trim().max(160).optional(), phone: z.string().trim().max(32).optional(), email: z.string().trim().email().max(320).optional(), address: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write"); const database = await requireDatabase(); const [before] = await database.select().from(providers).where(eq(providers.id, input.id)).limit(1); if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." }); const billingCnpj = input.billingCnpj ? normalizeCnpj(input.billingCnpj) : null; if (billingCnpj && billingCnpj.length !== 14) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um CNPJ de faturamento com 14 dígitos." }); const [updated] = await database.update(providers).set({ ...input, billingCnpj, legalName: input.legalName || null, contactName: input.contactName || null, phone: input.phone || null, email: input.email || null, address: input.address || null, updatedAt: new Date() }).where(eq(providers.id, input.id)).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "provider", entityId: input.id, action: "update", beforeData: before, afterData: updated }); return updated;
  }),

  updateRegional: protectedProcedure.input(z.object({ id: z.number().int().positive(), providerId: z.number().int().positive().nullable(), name: z.string().trim().min(2).max(160), code: z.string().trim().min(2).max(32).toUpperCase() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write"); const database = await requireDatabase(); const [before] = await database.select().from(regionals).where(eq(regionals.id, input.id)).limit(1); if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Regional não encontrada." }); const [updated] = await database.update(regionals).set(input).where(eq(regionals.id, input.id)).returning(); await writeAuditLog({ actorUserId: ctx.user.id, regionalId: input.id, entityType: "regional", entityId: input.id, action: "update", beforeData: before, afterData: updated }); return updated;
  }),

  updateCity: protectedProcedure.input(z.object({ id: z.number().int().positive(), regionalId: z.number().int().positive(), name: z.string().trim().min(2).max(160), state: z.string().trim().length(2).toUpperCase(), ibgeCode: z.string().trim().max(16).optional(), address: z.string().trim().max(1000).optional(), zipCode: z.string().trim().max(16).optional(), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), locationNotes: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write"); const database = await requireDatabase(); const [before] = await database.select().from(cities).where(eq(cities.id, input.id)).limit(1); if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Cidade não encontrada." }); const [updated] = await database.update(cities).set({ ...input, ibgeCode: input.ibgeCode || null, address: input.address || null, zipCode: input.zipCode || null, latitude: input.latitude?.toFixed(7), longitude: input.longitude?.toFixed(7), locationNotes: input.locationNotes || null, updatedAt: new Date() }).where(eq(cities.id, input.id)).returning(); await writeAuditLog({ actorUserId: ctx.user.id, regionalId: input.regionalId, entityType: "city", entityId: input.id, action: "update", beforeData: before, afterData: updated }); return updated;
  }),

  updateType: protectedProcedure.input(z.object({ kind: z.enum(["service", "media", "action", "event"]), id: z.number().int().positive(), name: z.string().trim().min(2).max(160) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write"); const database = await requireDatabase(); const table = { service: serviceTypes, media: mediaTypes, action: actionTypes, event: eventTypes }[input.kind]; const [before] = await database.select().from(table).where(eq(table.id, input.id)).limit(1); if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Tipo não encontrado." }); const [updated] = await database.update(table).set({ name: input.name }).where(eq(table.id, input.id)).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: `${input.kind}_type`, entityId: input.id, action: "update", beforeData: before, afterData: updated }); return updated;
  }),

  createCommercialSupervisor: protectedProcedure.input(z.object({ userId: z.number().int().positive().nullable(), name: z.string().trim().min(2).max(160), email: z.string().trim().email().max(320).optional(), phone: z.string().trim().max(32).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write"); const database = await requireDatabase(); const [created] = await database.insert(commercialSupervisors).values({ ...input, email: input.email || null, phone: input.phone || null }).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "commercial_supervisor", entityId: created.id, action: "create", afterData: created }); return created;
  }),

  updateSupplier: protectedProcedure.input(z.object({ id: z.number().int().positive(), providerId: z.number().int().positive().nullable(), cityId: z.number().int().positive().nullable().optional(), displayName: z.string().trim().min(2).max(180), legalName: z.string().trim().max(220).optional(), document: z.string().trim().min(14).max(32), contactName: z.string().trim().max(160).optional(), phone: z.string().trim().min(8).max(32), email: z.string().trim().email().max(320), partnershipType: z.enum(paymentKinds).optional(), paymentMethod: z.string().trim().max(80).optional(), paymentRecurrence: z.string().trim().max(80).optional(), hasContract: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write"); const database = await requireDatabase(); const [before] = await database.select().from(suppliers).where(eq(suppliers.id, input.id)).limit(1); if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Fornecedor não encontrado." }); const document = normalizeCnpj(input.document); if (document.length !== 14) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um CNPJ com 14 dígitos." }); const [sameName, sameDocument] = await Promise.all([database.select({ id: suppliers.id }).from(suppliers).where(sql`lower(${suppliers.displayName}) = lower(${input.displayName})`), database.select({ id: suppliers.id }).from(suppliers).where(sql`regexp_replace(coalesce(${suppliers.document}, ''), '[^0-9]', '', 'g') = ${document}`)]); if (sameName.some(row => row.id !== input.id)) throw new TRPCError({ code: "CONFLICT", message: "Já existe um fornecedor com este nome de exibição." }); if (sameDocument.some(row => row.id !== input.id)) throw new TRPCError({ code: "CONFLICT", message: "Já existe um fornecedor cadastrado com este CNPJ." }); const [updated] = await database.update(suppliers).set({ ...input, cityId: input.cityId ?? null, document, legalName: input.legalName || null, contactName: input.contactName || null, partnershipType: input.partnershipType ?? null, paymentMethod: input.paymentMethod || null, paymentRecurrence: input.paymentRecurrence || null, hasContract: input.hasContract ?? before.hasContract, updatedAt: new Date() }).where(eq(suppliers.id, input.id)).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "supplier", entityId: input.id, action: "update", beforeData: before, afterData: updated }); return updated;
  }),

  updatePartner: protectedProcedure.input(z.object({ id: z.number().int().positive(), cityId: z.number().int().positive().nullable().optional(), name: z.string().trim().min(2).max(160), email: z.string().trim().email().max(320).optional(), phone: z.string().trim().max(32).optional(), partnershipType: z.enum(paymentKinds).optional(), paymentMethod: z.string().trim().max(80).optional(), paymentRecurrence: z.string().trim().max(80).optional(), hasContract: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write"); const database = await requireDatabase(); const [before] = await database.select().from(partners).where(eq(partners.id, input.id)).limit(1); if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Parceiro não encontrado." }); const [updated] = await database.update(partners).set({ cityId: input.cityId ?? null, name: input.name, email: input.email || null, phone: input.phone || null, partnershipType: input.partnershipType ?? null, paymentMethod: input.paymentMethod || null, paymentRecurrence: input.paymentRecurrence || null, hasContract: input.hasContract ?? before.hasContract, updatedAt: new Date() }).where(eq(partners.id, input.id)).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "partner", entityId: input.id, action: "update", beforeData: before, afterData: updated }); return updated;
  }),

  uploadRegistryContract: protectedProcedure.input(z.object({ entityType: z.enum(["supplier", "partner"]), entityId: z.number().int().positive(), originalName: z.string().trim().min(1).max(255), mimeType: z.enum(contractMimeTypes), dataBase64: z.string().min(1).max(7_000_000) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const table = input.entityType === "supplier" ? suppliers : partners;
    const [entity] = await database.select().from(table).where(eq(table.id, input.entityId)).limit(1);
    if (!entity) throw new TRPCError({ code: "NOT_FOUND", message: input.entityType === "supplier" ? "Fornecedor não encontrado." : "Parceiro não encontrado." });
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "O contrato deve ter até 5 MB." });
    const filename = safeContractName(input.originalName);
    const stored = await storagePut(`trade/contracts/${input.entityType}/${input.entityId}/${Date.now()}-${filename}`, bytes, input.mimeType);
    const [updated] = await database.update(table).set({ hasContract: true, contractStorageKey: stored.key, contractUrl: stored.url, updatedAt: new Date() }).where(eq(table.id, input.entityId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: input.entityType, entityId: input.entityId, action: "upload_contract", beforeData: { contractStorageKey: entity.contractStorageKey }, afterData: { contractStorageKey: updated.contractStorageKey } });
    return updated;
  }),

  updateCommercialSupervisor: protectedProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(160), email: z.string().trim().email().max(320).optional(), phone: z.string().trim().max(32).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write"); const database = await requireDatabase(); const [before] = await database.select().from(commercialSupervisors).where(eq(commercialSupervisors.id, input.id)).limit(1); if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Supervisor comercial não encontrado." }); const [updated] = await database.update(commercialSupervisors).set({ name: input.name, email: input.email || null, phone: input.phone || null, updatedAt: new Date() }).where(eq(commercialSupervisors.id, input.id)).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "commercial_supervisor", entityId: input.id, action: "update", beforeData: before, afterData: updated }); return updated;
  }),

  updateFinancialCategory: protectedProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(2).max(160), description: z.string().trim().max(600).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write"); const database = await requireDatabase(); const [before] = await database.select().from(financialCategories).where(eq(financialCategories.id, input.id)).limit(1); if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Categoria financeira não encontrada." }); const [updated] = await database.update(financialCategories).set({ name: input.name, description: input.description || null, updatedAt: new Date() }).where(eq(financialCategories.id, input.id)).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "financial_category", entityId: input.id, action: "update", beforeData: before, afterData: updated }); return updated;
  }),

  updateSupplierOffering: protectedProcedure.input(z.object({ id: z.number().int().positive(), kind: z.enum(["service", "media", "action", "event", "other"]), name: z.string().trim().min(2).max(180), unit: z.string().trim().min(1).max(64), unitPrice: z.number().nonnegative().max(99_999_999), notes: z.string().trim().max(1000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write"); const database = await requireDatabase(); const [before] = await database.select().from(supplierOfferings).where(eq(supplierOfferings.id, input.id)).limit(1); if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Oferta não encontrada." }); const [updated] = await database.update(supplierOfferings).set({ kind: input.kind, name: input.name, unit: input.unit, unitPrice: input.unitPrice.toFixed(2), notes: input.notes || null, updatedAt: new Date() }).where(eq(supplierOfferings.id, input.id)).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "supplier_offering", entityId: input.id, action: "update", beforeData: before, afterData: updated }); return updated;
  }),

  setRegistryActive: protectedProcedure.input(z.object({ kind: z.enum(["provider", "regional", "city", "supplier", "partner", "supervisor", "service", "media", "action", "event", "financial_category", "supplier_offering"]), id: z.number().int().positive(), active: z.boolean() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const now = new Date();
    switch (input.kind) {
      case "provider": await database.update(providers).set({ active: input.active }).where(eq(providers.id, input.id)); break;
      case "regional": await database.update(regionals).set({ active: input.active }).where(eq(regionals.id, input.id)); break;
      case "city": await database.update(cities).set({ active: input.active }).where(eq(cities.id, input.id)); break;
      case "supplier": await database.update(suppliers).set({ active: input.active, updatedAt: now }).where(eq(suppliers.id, input.id)); break;
      case "partner": await database.update(partners).set({ active: input.active }).where(eq(partners.id, input.id)); break;
      case "supervisor": await database.update(commercialSupervisors).set({ active: input.active, updatedAt: now }).where(eq(commercialSupervisors.id, input.id)); break;
      case "service": await database.update(serviceTypes).set({ active: input.active }).where(eq(serviceTypes.id, input.id)); break;
      case "media": await database.update(mediaTypes).set({ active: input.active }).where(eq(mediaTypes.id, input.id)); break;
      case "action": await database.update(actionTypes).set({ active: input.active }).where(eq(actionTypes.id, input.id)); break;
      case "event": await database.update(eventTypes).set({ active: input.active }).where(eq(eventTypes.id, input.id)); break;
      case "financial_category": await database.update(financialCategories).set({ active: input.active, updatedAt: now }).where(eq(financialCategories.id, input.id)); break;
      case "supplier_offering": await database.update(supplierOfferings).set({ active: input.active, updatedAt: now }).where(eq(supplierOfferings.id, input.id)); break;
    }
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: input.kind, entityId: input.id, action: input.active ? "activate" : "deactivate", afterData: { active: input.active } });
    return { success: true } as const;
  }),

  importOperationalSpreadsheet: protectedProcedure.input(spreadsheetImportSchema).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [providerRows, regionalRows, cityRows, storeRows] = await Promise.all([
      database.select().from(providers), database.select().from(regionals), database.select().from(cities), database.select().from(stores),
    ]);
    const providerByName = new Map(providerRows.map(row => [normalizeSpreadsheetKey(row.name), row]));
    const regionalByCode = new Map(regionalRows.map(row => [row.code.toUpperCase(), row]));
    const cityByRegionalAndName = new Map(cityRows.map(row => [`${row.regionalId}:${normalizeSpreadsheetKey(row.name)}`, row]));
    const storeByCode = new Map(storeRows.map(row => [row.code.toUpperCase(), row]));
    const created = { providers: 0, regionals: 0, cities: 0, stores: 0 };

    await database.transaction(async transaction => {
      for (const row of input.providers) {
        const key = normalizeSpreadsheetKey(row.name);
        if (providerByName.has(key)) continue;
        const billingCnpj = row.billingCnpj ? normalizeCnpj(row.billingCnpj) : null;
        if (billingCnpj && billingCnpj.length !== 14) throw new TRPCError({ code: "BAD_REQUEST", message: `CNPJ inválido para a empresa ${row.name}.` });
        const [provider] = await transaction.insert(providers).values({ ...row, billingCnpj, legalName: row.legalName || null, contactName: row.contactName || null, phone: row.phone || null, email: row.email || null, address: row.address || null }).returning();
        providerByName.set(key, provider); created.providers += 1;
      }
      for (const row of input.regionals) {
        if (regionalByCode.has(row.code)) continue;
        const provider = row.providerName ? providerByName.get(normalizeSpreadsheetKey(row.providerName)) : undefined;
        if (row.providerName && !provider) throw new TRPCError({ code: "BAD_REQUEST", message: `A empresa "${row.providerName}" da regional ${row.code} não foi localizada.` });
        const [regional] = await transaction.insert(regionals).values({ providerId: provider?.id ?? null, name: row.name, code: row.code }).returning();
        regionalByCode.set(row.code, regional); created.regionals += 1;
      }
      for (const row of input.cities) {
        const regional = regionalByCode.get(row.regionalCode);
        if (!regional) throw new TRPCError({ code: "BAD_REQUEST", message: `A regional ${row.regionalCode} da cidade ${row.name} não foi localizada.` });
        const key = `${regional.id}:${normalizeSpreadsheetKey(row.name)}`;
        if (cityByRegionalAndName.has(key)) continue;
        const [city] = await transaction.insert(cities).values({ regionalId: regional.id, name: row.name, state: row.state, ibgeCode: row.ibgeCode || null, address: row.address || null, zipCode: row.zipCode || null, latitude: row.latitude?.toFixed(7) ?? null, longitude: row.longitude?.toFixed(7) ?? null, locationNotes: row.locationNotes || null }).returning();
        cityByRegionalAndName.set(key, city); created.cities += 1;
      }
      for (const row of input.stores) {
        if (storeByCode.has(row.code)) continue;
        const regional = regionalByCode.get(row.regionalCode);
        const city = regional ? cityByRegionalAndName.get(`${regional.id}:${normalizeSpreadsheetKey(row.cityName)}`) : undefined;
        if (!city) throw new TRPCError({ code: "BAD_REQUEST", message: `A cidade ${row.cityName} da regional ${row.regionalCode} da loja ${row.name} não foi localizada.` });
        const [store] = await transaction.insert(stores).values({ cityId: city.id, name: row.name, code: row.code, address: row.address || null }).returning();
        storeByCode.set(row.code, store); created.stores += 1;
      }
    });
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "operational_spreadsheet", entityId: 0, action: "import", afterData: { created, received: Object.fromEntries(Object.entries(input).map(([key, rows]) => [key, rows.length])) } });
    return { created, skipped: { providers: input.providers.length - created.providers, regionals: input.regionals.length - created.regionals, cities: input.cities.length - created.cities, stores: input.stores.length - created.stores } };
  }),

  getTrelloConfiguration: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "settings.read");
    const database = await requireDatabase();
    const [personalBoardRows, settingRows] = await Promise.all([
      database.select().from(userTrelloBoards).where(eq(userTrelloBoards.userId, ctx.user.id)).limit(1),
      database.select().from(appSettings).where(eq(appSettings.key, "trello_board_url")).limit(1),
    ]);
    const personalBoard = personalBoardRows[0];
    const setting = settingRows[0];
    return { url: personalBoard?.boardUrl ?? setting?.value ?? "", source: personalBoard ? "personal" as const : setting ? "shared" as const : "none" as const };
  }),

  updateTrelloConfiguration: protectedProcedure.input(z.object({ url: z.string().trim().max(2048) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const normalizedUrl = normalizeTrelloUrl(input.url);
    const database = await requireDatabase();
    const [updated] = await database.insert(appSettings).values({ key: "trello_board_url", value: normalizedUrl, updatedAt: new Date() }).onConflictDoUpdate({ target: appSettings.key, set: { value: normalizedUrl, updatedAt: new Date() } }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "app_setting", entityId: 0, action: "update_trello", afterData: { configured: Boolean(normalizedUrl) } });
    return { url: updated.value };
  }),

  getRegional: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.read");
    const database = await requireDatabase();
    const [regional] = await database.select().from(regionals).where(eq(regionals.id, input.id));
    return regional ?? null;
  }),
});
