import { and, asc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  actionPoints,
  actions,
  actionServices,
  actionSuppliers,
  actionTypes,
  appSettings,
  campaignCities,
  campaignPromotionCities,
  campaignSectors,
  campaignTypes,
  cities,
  documents,
  commercialSupervisorCities,
  commercialSupervisorStores,
  commercialSupervisors,
  events,
  eventServices,
  eventSuppliers,
  eventTypes,
  financialCategories,
  mediaCampaignCityDistributions,
  mediaCampaigns,
  mediaPoints,
  mediaTypes,
  partners,
  providerDocuments,
  providerFiscalEntities,
  mediaServiceCatalog,
  productMediaTypes,
  productTypes,
  providers,
  regionals,
  serviceTypes,
  serviceTypeRelations,
  serviceSubservices,
  subserviceTypes,
  stockItems,
  stores,
  supplierCities,
  supplierMediaTypes,
  supplierOfferings,
  supplierServiceTypes,
  supplierContracts,
  suppliers,
  tradeOperations,
  urbanMediaRegistrations,
  userTrelloBoards,
} from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { getDb } from "../db";
import { publicProcedure, protectedProcedure } from "../_core/trpc";
import { writeAuditLog } from "../audit";
import { storagePut } from "../storage";
import {
} from "../../shared/branding";
import { IMPORT_MODULES, type ImportModuleId } from "../../shared/import-modules";

const paymentKinds = ["paid", "barter", "mixed"] as const;
const mediaOperationCategories = [
  "graphics",
  "audio_video",
  "leafleting",
  "sound_car",
  "influencers",
] as const;
const contractMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const imageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Informe uma cor no formato hexadecimal #RRGGBB.")
  .transform(value => value.toUpperCase());
const supplierInputSchema = z.object({
  providerId: z.number().int().positive().nullable(),
  cityId: z.number().int().positive().nullable().optional(),
  displayName: z.string().trim().min(2).max(180),
  address: z.string().trim().max(1000).optional(),
  legalName: z.string().trim().max(220).optional(),
  document: z.string().trim().min(14).max(32).optional(),
  contactName: z.string().trim().max(160).optional(),
  phone: z.string().trim().min(8).max(32).optional(),
  email: z.string().trim().email().max(320).optional(),
  mainService: z.string().trim().max(180).optional(),
  partnershipType: z.enum(paymentKinds).optional(),
  paymentMethod: z.string().trim().max(80).optional(),
  paymentRecurrence: z.string().trim().max(80).optional(),
  pixKey: z.string().trim().max(220).optional(),
  paymentDay: z.number().int().min(1).max(31).nullable().optional(),
  paymentBarterValue: z
    .number()
    .nonnegative()
    .max(99_999_999)
    .nullable()
    .optional(),
  paymentBarterService: z.string().trim().max(1000).optional(),
  paymentNotes: z.string().trim().max(1000).optional(),
  contractStartsOn: z.string().date().nullable().optional(),
  contractEndsOn: z.string().date().nullable().optional(),
  hasContract: z.boolean().optional(),
});

const providerInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  legalName: z.string().trim().max(220).optional(),
  billingCnpj: z.string().trim().max(32).optional(),
  contactName: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(32).optional(),
  email: z.string().trim().email().max(320).optional(),
  website: z.string().trim().max(1000).optional(),
  address: z.string().trim().max(1000).optional(),
  headquartersCityId: z.number().int().positive().nullable().optional(),
  brandColors: z.array(hexColorSchema).max(10).optional(),
});

const fiscalEntityInputSchema = z.object({
  providerId: z.number().int().positive(),
  name: z.string().trim().min(2).max(180),
  legalName: z.string().trim().max(220).optional(),
  cnpj: z.string().trim().min(14).max(18),
  stateRegistration: z.string().trim().max(80).optional(),
  municipalRegistration: z.string().trim().max(80).optional(),
  address: z.string().trim().max(1000).optional(),
  cityId: z.number().int().positive().nullable().optional(),
  isDefault: z.boolean().optional(),
});

function normalizeFiscalCnpj(value: string) {
  const normalized = value.replace(/\D/g, "");
  if (normalized.length !== 14) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um CNPJ fiscal com 14 dígitos." });
  }
  return normalized;
}

function safeContractName(name: string) {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 180);
  return /[a-zA-Z0-9]/.test(normalized) ? normalized : "contrato";
}

async function requireDatabase() {
  const database = await getDb();
  if (!database)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Banco de dados indisponível.",
    });
  return database;
}

export function uniqueIds(values: number[]) {
  return Array.from(new Set(values));
}

async function resolveServiceParentIds(
  database: Awaited<ReturnType<typeof requireDatabase>>,
  parentIds: number[],
  childId?: number
) {
  const normalizedIds = uniqueIds(parentIds);
  if (childId && normalizedIds.includes(childId)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Um SubServiço não pode ser vinculado a si mesmo.",
    });
  }
  if (!normalizedIds.length) return [];
  const parents = await database
    .select({
      id: serviceTypes.id,
      mediaTypeId: serviceTypes.mediaTypeId,
      parentServiceTypeId: serviceTypes.parentServiceTypeId,
      active: serviceTypes.active,
    })
    .from(serviceTypes)
    .where(inArray(serviceTypes.id, normalizedIds));
  if (
    parents.length !== normalizedIds.length ||
    parents.some(parent => parent.active === false)
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Um ou mais Serviços principais selecionados não existem ou estão inativos.",
    });
  }
  if (parents.some(parent => parent.parentServiceTypeId !== null)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Selecione somente Serviços principais, não SubServiços.",
    });
  }
  return normalizedIds.map(id => parents.find(parent => parent.id === id)!);
}

export function normalizeCnpj(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeWebsiteUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "O site deve usar uma URL HTTP ou HTTPS válida.",
    });
  }
  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Informe um site válido, como https://empresa.com.br.",
    });
  }
  if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "O site deve usar uma URL HTTP ou HTTPS válida.",
    });
  }
  return parsed.toString();
}

export function normalizeTrelloUrl(value: string) {
  if (!value) return "";
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Informe uma URL válida do Trello.",
    });
  }
  if (!["trello.com", "www.trello.com"].includes(parsed.hostname))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "A URL deve pertencer ao Trello.",
    });
  return parsed.toString();
}

export function getTrelloEmbedUrl(value: string) {
  if (!value) return "";
  const parsed = new URL(value);
  parsed.searchParams.set("embed", "1");
  return parsed.toString();
}

export function normalizeSpreadsheetKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export const settingsRegistryProcedures = {
  listFiscalEntities: protectedProcedure
    .input(z.object({ providerId: z.number().int().positive().optional() }).optional())
    .query(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.read");
      const database = await requireDatabase();
      const conditions = input?.providerId
        ? eq(providerFiscalEntities.providerId, input.providerId)
        : undefined;
      return database
        .select({
          id: providerFiscalEntities.id,
          providerId: providerFiscalEntities.providerId,
          providerName: providers.name,
          name: providerFiscalEntities.name,
          legalName: providerFiscalEntities.legalName,
          cnpj: providerFiscalEntities.cnpj,
          stateRegistration: providerFiscalEntities.stateRegistration,
          municipalRegistration: providerFiscalEntities.municipalRegistration,
          address: providerFiscalEntities.address,
          cityId: providerFiscalEntities.cityId,
          isDefault: providerFiscalEntities.isDefault,
          active: providerFiscalEntities.active,
          createdAt: providerFiscalEntities.createdAt,
          updatedAt: providerFiscalEntities.updatedAt,
        })
        .from(providerFiscalEntities)
        .innerJoin(providers, eq(providers.id, providerFiscalEntities.providerId))
        .where(conditions)
        .orderBy(asc(providers.name), asc(providerFiscalEntities.name));
    }),

  createFiscalEntity: protectedProcedure
    .input(fiscalEntityInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const cnpj = normalizeFiscalCnpj(input.cnpj);
      const [provider] = await database
        .select({ id: providers.id })
        .from(providers)
        .where(eq(providers.id, input.providerId))
        .limit(1);
      if (!provider) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa operacional não encontrada." });
      if (input.cityId) {
        const [city] = await database.select({ id: cities.id }).from(cities).where(eq(cities.id, input.cityId)).limit(1);
        if (!city) throw new TRPCError({ code: "BAD_REQUEST", message: "Cidade fiscal não encontrada." });
      }
      const [sameCnpj] = await database
        .select({ id: providerFiscalEntities.id })
        .from(providerFiscalEntities)
        .where(eq(providerFiscalEntities.cnpj, cnpj))
        .limit(1);
      if (sameCnpj) throw new TRPCError({ code: "CONFLICT", message: "Este CNPJ já está cadastrado como empresa fiscal." });
      const [existing] = await database
        .select({ id: providerFiscalEntities.id })
        .from(providerFiscalEntities)
        .where(eq(providerFiscalEntities.providerId, input.providerId))
        .limit(1);
      const created = await database.transaction(async tx => {
        if (input.isDefault || !existing) {
          await tx.update(providerFiscalEntities).set({ isDefault: false, updatedAt: new Date() }).where(eq(providerFiscalEntities.providerId, input.providerId));
        }
        const [row] = await tx.insert(providerFiscalEntities).values({
          providerId: input.providerId,
          name: input.name,
          legalName: input.legalName || null,
          cnpj,
          stateRegistration: input.stateRegistration || null,
          municipalRegistration: input.municipalRegistration || null,
          address: input.address || null,
          cityId: input.cityId || null,
          isDefault: input.isDefault ?? !existing,
        }).returning();
        return row;
      });
      await writeAuditLog({ actorUserId: ctx.user.id, entityType: "provider_fiscal_entity", entityId: created.id, action: "create", afterData: created });
      return created;
    }),

  updateFiscalEntity: protectedProcedure
    .input(fiscalEntityInputSchema.partial().extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [before] = await database.select().from(providerFiscalEntities).where(eq(providerFiscalEntities.id, input.id)).limit(1);
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa fiscal não encontrada." });
      const providerId = input.providerId ?? before.providerId;
      const cnpj = input.cnpj ? normalizeFiscalCnpj(input.cnpj) : before.cnpj;
      const [sameCnpj] = await database.select({ id: providerFiscalEntities.id }).from(providerFiscalEntities).where(and(eq(providerFiscalEntities.cnpj, cnpj), ne(providerFiscalEntities.id, input.id))).limit(1);
      if (sameCnpj) throw new TRPCError({ code: "CONFLICT", message: "Este CNPJ já está cadastrado como empresa fiscal." });
      if (input.cityId) {
        const [city] = await database.select({ id: cities.id }).from(cities).where(eq(cities.id, input.cityId)).limit(1);
        if (!city) throw new TRPCError({ code: "BAD_REQUEST", message: "Cidade fiscal não encontrada." });
      }
      const nextDefault = input.isDefault ?? before.isDefault;
      const updated = await database.transaction(async tx => {
        if (nextDefault || providerId !== before.providerId) {
          await tx.update(providerFiscalEntities).set({ isDefault: false, updatedAt: new Date() }).where(eq(providerFiscalEntities.providerId, providerId));
        }
        const [row] = await tx.update(providerFiscalEntities).set({
          providerId,
          name: input.name ?? before.name,
          legalName: input.legalName === undefined ? before.legalName : input.legalName || null,
          cnpj,
          stateRegistration: input.stateRegistration === undefined ? before.stateRegistration : input.stateRegistration || null,
          municipalRegistration: input.municipalRegistration === undefined ? before.municipalRegistration : input.municipalRegistration || null,
          address: input.address === undefined ? before.address : input.address || null,
          cityId: input.cityId === undefined ? before.cityId : input.cityId || null,
          isDefault: nextDefault,
          updatedAt: new Date(),
        }).where(eq(providerFiscalEntities.id, input.id)).returning();
        return row;
      });
      await writeAuditLog({ actorUserId: ctx.user.id, entityType: "provider_fiscal_entity", entityId: input.id, action: "update", beforeData: before, afterData: updated });
      return updated;
    }),

  deleteFiscalEntity: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [before] = await database.select().from(providerFiscalEntities).where(eq(providerFiscalEntities.id, input.id)).limit(1);
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa fiscal não encontrada." });
      await database.transaction(async tx => {
        await tx.delete(providerFiscalEntities).where(eq(providerFiscalEntities.id, input.id));
        if (before.isDefault) {
          const [replacement] = await tx.select({ id: providerFiscalEntities.id }).from(providerFiscalEntities).where(eq(providerFiscalEntities.providerId, before.providerId)).orderBy(asc(providerFiscalEntities.id)).limit(1);
          if (replacement) await tx.update(providerFiscalEntities).set({ isDefault: true, updatedAt: new Date() }).where(eq(providerFiscalEntities.id, replacement.id));
        }
      });
      await writeAuditLog({ actorUserId: ctx.user.id, entityType: "provider_fiscal_entity", entityId: input.id, action: "delete", beforeData: before });
      return { success: true };
    }),

  createProvider: protectedProcedure
    .input(providerInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [existing] = await database
        .select({ id: providers.id })
        .from(providers)
        .where(sql`lower(${providers.name}) = lower(${input.name})`)
        .limit(1);
      if (existing)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe um fornecedor de origem com este nome.",
        });
      const billingCnpj = input.billingCnpj
        ? normalizeCnpj(input.billingCnpj)
        : null;
      const website = normalizeWebsiteUrl(input.website);
      if (billingCnpj && billingCnpj.length !== 14)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe um CNPJ de faturamento com 14 dígitos.",
        });
      if (input.headquartersCityId) {
        const [headquarters] = await database
          .select({ id: cities.id })
          .from(cities)
          .where(eq(cities.id, input.headquartersCityId))
          .limit(1);
        if (!headquarters)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "A cidade selecionada para matriz não existe.",
          });
      }
      const created = await database.transaction(async tx => {
        if (billingCnpj) {
          const [sameCnpj] = await tx
            .select({ id: providerFiscalEntities.id })
            .from(providerFiscalEntities)
            .where(eq(providerFiscalEntities.cnpj, billingCnpj))
            .limit(1);
          if (sameCnpj) throw new TRPCError({ code: "CONFLICT", message: "Este CNPJ já está cadastrado como empresa fiscal." });
        }
        const [provider] = await tx
          .insert(providers)
          .values({
            ...input,
            website,
            billingCnpj,
            legalName: input.legalName || null,
            contactName: input.contactName || null,
            phone: input.phone || null,
            email: input.email || null,
            address: input.address || null,
            headquartersCityId: input.headquartersCityId ?? null,
            brandColors: input.brandColors ?? [],
          })
          .returning();
        if (billingCnpj) {
          await tx.insert(providerFiscalEntities).values({
            providerId: provider.id,
            name: input.legalName || input.name,
            legalName: input.legalName || null,
            cnpj: billingCnpj,
            cityId: input.headquartersCityId ?? null,
            isDefault: true,
          });
        }
        return provider;
      });
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "provider",
        entityId: created.id,
        action: "create",
        afterData: created,
      });
      return created;
    }),

  uploadProviderLogo: protectedProcedure
    .input(
      z.object({
        providerId: z.number().int().positive(),
        originalName: z.string().trim().min(1).max(255),
        mimeType: z.enum(imageMimeTypes),
        dataBase64: z.string().min(1).max(4_200_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [provider] = await database
        .select()
        .from(providers)
        .where(eq(providers.id, input.providerId))
        .limit(1);
      if (!provider)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Empresa não encontrada.",
        });
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (!bytes.length || bytes.length > 3 * 1024 * 1024)
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "O logotipo deve ter até 3 MB.",
        });
      const stored = await storagePut(
        `trade/providers/${provider.id}/logo-${Date.now()}-${safeContractName(input.originalName)}`,
        bytes,
        input.mimeType
      );
      const [updated] = await database
        .update(providers)
        .set({
          logoStorageKey: stored.key,
          logoUrl: stored.url,
          updatedAt: new Date(),
        })
        .where(eq(providers.id, provider.id))
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "provider",
        entityId: provider.id,
        action: "upload_logo",
        beforeData: { logoStorageKey: provider.logoStorageKey },
        afterData: { logoStorageKey: updated.logoStorageKey },
      });
      return updated;
    }),

  uploadProviderCnpjCard: protectedProcedure
    .input(
      z.object({
        providerId: z.number().int().positive(),
        originalName: z.string().trim().min(1).max(255),
        mimeType: z.enum(contractMimeTypes),
        dataBase64: z.string().min(1).max(7_000_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [provider] = await database
        .select()
        .from(providers)
        .where(eq(providers.id, input.providerId))
        .limit(1);
      if (!provider)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Empresa não encontrada.",
        });
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (!bytes.length || bytes.length > 5 * 1024 * 1024)
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "O Cartão CNPJ deve ter até 5 MB.",
        });
      const stored = await storagePut(
        `trade/providers/${provider.id}/cnpj-card-${Date.now()}-${safeContractName(input.originalName)}`,
        bytes,
        input.mimeType
      );
      const [updated] = await database
        .update(providers)
        .set({
          cnpjCardStorageKey: stored.key,
          cnpjCardUrl: stored.url,
          updatedAt: new Date(),
        })
        .where(eq(providers.id, provider.id))
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "provider",
        entityId: provider.id,
        action: "upload_cnpj_card",
        beforeData: { cnpjCardStorageKey: provider.cnpjCardStorageKey },
        afterData: { cnpjCardStorageKey: updated.cnpjCardStorageKey },
      });
      return updated;
    }),

  uploadProviderBrandManual: protectedProcedure
    .input(
      z.object({
        providerId: z.number().int().positive(),
        originalName: z.string().trim().min(1).max(255),
        mimeType: z.enum(contractMimeTypes),
        dataBase64: z.string().min(1).max(14_000_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [provider] = await database
        .select()
        .from(providers)
        .where(eq(providers.id, input.providerId))
        .limit(1);
      if (!provider)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Empresa não encontrada.",
        });
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (!bytes.length || bytes.length > 10 * 1024 * 1024)
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "O Manual da marca deve ter até 10 MB.",
        });
      const stored = await storagePut(
        `trade/providers/${provider.id}/brand-manual-${Date.now()}-${safeContractName(input.originalName)}`,
        bytes,
        input.mimeType
      );
      const [updated] = await database
        .update(providers)
        .set({
          brandManualStorageKey: stored.key,
          brandManualUrl: stored.url,
          updatedAt: new Date(),
        })
        .where(eq(providers.id, provider.id))
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "provider",
        entityId: provider.id,
        action: "upload_brand_manual",
        beforeData: { brandManualStorageKey: provider.brandManualStorageKey },
        afterData: { brandManualStorageKey: updated.brandManualStorageKey },
      });
      return updated;
    }),

  uploadProviderDocument: protectedProcedure
    .input(
      z.object({
        providerId: z.number().int().positive(),
        title: z.string().trim().min(2).max(180),
        originalName: z.string().trim().min(1).max(255),
        mimeType: z.enum(contractMimeTypes),
        dataBase64: z.string().min(1).max(14_000_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [provider] = await database
        .select({ id: providers.id })
        .from(providers)
        .where(eq(providers.id, input.providerId))
        .limit(1);
      if (!provider)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Empresa não encontrada.",
        });
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (!bytes.length || bytes.length > 10 * 1024 * 1024)
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "O documento complementar deve ter até 10 MB.",
        });
      const stored = await storagePut(
        `trade/providers/${provider.id}/documents/${Date.now()}-${safeContractName(input.originalName)}`,
        bytes,
        input.mimeType
      );
      const [created] = await database
        .insert(providerDocuments)
        .values({
          providerId: provider.id,
          title: input.title,
          storageKey: stored.key,
          url: stored.url,
          originalName: input.originalName,
          mimeType: input.mimeType,
          sizeBytes: bytes.length,
          uploadedByUserId: ctx.user.id,
        })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "provider",
        entityId: provider.id,
        action: "upload_document",
        afterData: {
          documentId: created.id,
          title: created.title,
          originalName: created.originalName,
        },
      });
      return created;
    }),

  deleteProviderDocument: protectedProcedure
    .input(
      z.object({
        providerId: z.number().int().positive(),
        documentId: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [document] = await database
        .select()
        .from(providerDocuments)
        .where(
          and(
            eq(providerDocuments.id, input.documentId),
            eq(providerDocuments.providerId, input.providerId)
          )
        )
        .limit(1);
      if (!document)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Documento complementar não encontrado para esta empresa.",
        });
      await database
        .delete(providerDocuments)
        .where(eq(providerDocuments.id, document.id));
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "provider",
        entityId: input.providerId,
        action: "delete_document",
        beforeData: {
          documentId: document.id,
          title: document.title,
          originalName: document.originalName,
        },
      });
      return { id: document.id };
    }),

  createRegional: protectedProcedure
    .input(
      z.object({
        providerId: z.number().int().positive().nullable(),
        name: z.string().trim().min(2).max(160),
        code: z.string().trim().min(2).max(32).toUpperCase(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [existing] = await database
        .select({ id: regionals.id })
        .from(regionals)
        .where(
          sql`lower(${regionals.name}) = lower(${input.name}) OR ${regionals.code} = ${input.code}`
        )
        .limit(1);
      if (existing)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe uma regional com este nome ou código.",
        });
      const [created] = await database
        .insert(regionals)
        .values(input)
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        regionalId: created.id,
        entityType: "regional",
        entityId: created.id,
        action: "create",
        afterData: created,
      });
      return created;
    }),

  createCity: protectedProcedure
    .input(
      z.object({
        regionalId: z.number().int().positive(),
        name: z.string().trim().min(2).max(160),
        state: z.string().trim().length(2).toUpperCase(),
        ibgeCode: z.string().trim().max(16).optional(),
        address: z.string().trim().max(1000).optional(),
        zipCode: z.string().trim().max(16).optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        locationNotes: z.string().trim().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [existing] = await database
        .select({ id: cities.id })
        .from(cities)
        .where(
          and(
            eq(cities.regionalId, input.regionalId),
            sql`lower(${cities.name}) = lower(${input.name})`
          )
        )
        .limit(1);
      if (existing)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Esta cidade já está cadastrada na regional selecionada.",
        });
      const [created] = await database
        .insert(cities)
        .values({
          ...input,
          address: input.address || null,
          zipCode: input.zipCode || null,
          latitude: input.latitude?.toFixed(7),
          longitude: input.longitude?.toFixed(7),
          locationNotes: input.locationNotes || null,
        })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        regionalId: input.regionalId,
        entityType: "city",
        entityId: created.id,
        action: "create",
        afterData: created,
      });
      return created;
    }),

  createSupplier: protectedProcedure
    .input(supplierInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const document = input.document ? normalizeCnpj(input.document) : null;
      if (document && document.length !== 14)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe um CNPJ com 14 dígitos.",
        });
      const [sameName] = await database
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(
          sql`lower(${suppliers.displayName}) = lower(${input.displayName})`
        )
        .limit(1);
      if (sameName)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe um fornecedor com este nome de exibição.",
        });
      const [sameDocument] = document
        ? await database
            .select({ id: suppliers.id })
            .from(suppliers)
            .where(
              sql`regexp_replace(coalesce(${suppliers.document}, ''), '[^0-9]', '', 'g') = ${document}`
            )
            .limit(1)
        : [];
      if (sameDocument)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe um fornecedor cadastrado com este CNPJ.",
        });
      const created = await database.transaction(async transaction => {
        const [supplier] = await transaction
          .insert(suppliers)
          .values({
            providerId: input.providerId,
            cityId: input.cityId ?? null,
            displayName: input.displayName,
            address: input.address || null,
            document,
            legalName: input.legalName || null,
            contactName: input.contactName || null,
            phone: input.phone || null,
            email: input.email || null,
            mainService: input.mainService || null,
            partnershipType: input.partnershipType ?? null,
            paymentMethod: input.paymentMethod || null,
            paymentRecurrence: input.paymentRecurrence || null,
            pixKey: input.pixKey || null,
            paymentDay: input.paymentDay ?? null,
            paymentBarterValue:
              input.paymentBarterValue == null
                ? null
                : input.paymentBarterValue.toFixed(2),
            paymentBarterService: input.paymentBarterService || null,
            paymentNotes: input.paymentNotes || null,
            contractStartsOn: input.contractStartsOn ?? null,
            contractEndsOn: input.contractEndsOn ?? null,
            hasContract: input.hasContract ?? false,
          })
          .returning();
        if (supplier.cityId)
          await transaction
            .insert(supplierCities)
            .values({ supplierId: supplier.id, cityId: supplier.cityId })
            .onConflictDoNothing();
        return supplier;
      });
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "supplier",
        entityId: created.id,
        action: "create",
        afterData: created,
      });
      return created;
    }),

  supplierCoverage: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "settings.read");
    const database = await requireDatabase();
    const [
      citiesBySupplier,
      servicesBySupplier,
      mediaBySupplier,
      serviceRows,
      mediaRows,
    ] = await Promise.all([
      database.select().from(supplierCities),
      database.select().from(supplierServiceTypes),
      database.select().from(supplierMediaTypes),
      database
        .select()
        .from(serviceTypes)
        .where(eq(serviceTypes.active, true))
        .orderBy(asc(serviceTypes.name)),
      database
        .select()
        .from(mediaTypes)
        .where(eq(mediaTypes.active, true))
        .orderBy(asc(mediaTypes.name)),
    ]);
    return {
      citiesBySupplier,
      servicesBySupplier,
      mediaBySupplier,
      serviceTypes: serviceRows,
      mediaTypes: mediaRows,
    };
  }),

  setSupplierCoverage: protectedProcedure
    .input(
      z.object({
        supplierId: z.number().int().positive(),
        cityIds: z.array(z.number().int().positive()).max(150),
        serviceTypeIds: z.array(z.number().int().positive()).max(150),
        mediaTypeIds: z.array(z.number().int().positive()).max(150),
        serviceMediaLinks: z
          .array(
            z.object({
              serviceTypeId: z.number().int().positive(),
              mediaTypeId: z.number().int().positive().nullable().optional(),
            })
          )
          .max(300)
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [supplier] = await database
        .select({ id: suppliers.id, cityId: suppliers.cityId })
        .from(suppliers)
        .where(eq(suppliers.id, input.supplierId))
        .limit(1);
      if (!supplier)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fornecedor não encontrado.",
        });
      const cityIds = uniqueIds([
          ...input.cityIds,
          ...(supplier.cityId ? [supplier.cityId] : []),
        ]),
        serviceTypeIds = uniqueIds(input.serviceTypeIds),
        mediaTypeIds = uniqueIds(input.mediaTypeIds),
        serviceMediaLinks = (
          input.serviceMediaLinks ??
          serviceTypeIds.map(serviceTypeId => ({
            serviceTypeId,
            mediaTypeId: null,
          }))
        ).filter(
          (link, index, all) =>
            all.findIndex(
              candidate =>
                candidate.serviceTypeId === link.serviceTypeId &&
                candidate.mediaTypeId === link.mediaTypeId
            ) === index
        );
      await database.transaction(async transaction => {
        await transaction
          .delete(supplierCities)
          .where(eq(supplierCities.supplierId, input.supplierId));
        await transaction
          .delete(supplierServiceTypes)
          .where(eq(supplierServiceTypes.supplierId, input.supplierId));
        await transaction
          .delete(supplierMediaTypes)
          .where(eq(supplierMediaTypes.supplierId, input.supplierId));
        if (cityIds.length)
          await transaction
            .insert(supplierCities)
            .values(
              cityIds.map(cityId => ({ supplierId: input.supplierId, cityId }))
            );
        if (serviceMediaLinks.length)
          await transaction.insert(supplierServiceTypes).values(
            serviceMediaLinks.map(link => ({
              supplierId: input.supplierId,
              serviceTypeId: link.serviceTypeId,
              mediaTypeId: link.mediaTypeId ?? null,
            }))
          );
        if (mediaTypeIds.length)
          await transaction.insert(supplierMediaTypes).values(
            mediaTypeIds.map(mediaTypeId => ({
              supplierId: input.supplierId,
              mediaTypeId,
            }))
          );
      });
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "supplier",
        entityId: input.supplierId,
        action: "set_coverage",
        afterData: { cityIds, serviceTypeIds, mediaTypeIds },
      });
      return {
        supplierId: input.supplierId,
        cityIds,
        serviceTypeIds,
        mediaTypeIds,
        serviceMediaLinks,
      };
    }),

  createStore: protectedProcedure
    .input(
      z.object({
        cityId: z.number().int().positive(),
        name: z.string().trim().min(2).max(160),
        code: z.string().trim().min(2).max(32).toUpperCase(),
        address: z.string().trim().max(1000).optional(),
        referencePoint: z.string().trim().max(240).optional(),
        zipCode: z.string().trim().max(16).optional(),
        phone: z.string().trim().max(32).optional(),
        email: z.string().trim().email().max(320).optional(),
        openingHours: z.string().trim().max(1000).optional(),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [existing] = await database
        .select({ id: stores.id })
        .from(stores)
        .where(
          sql`${stores.code} = ${input.code} OR (${stores.cityId} = ${input.cityId} AND lower(${stores.name}) = lower(${input.name}))`
        )
        .limit(1);
      if (existing)
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Já existe uma loja com este código ou nome na cidade selecionada.",
        });
      const [created] = await database
        .insert(stores)
        .values({
          ...input,
          address: input.address || null,
          referencePoint: input.referencePoint || null,
          zipCode: input.zipCode || null,
          phone: input.phone || null,
          email: input.email || null,
          openingHours: input.openingHours || null,
          latitude: input.latitude?.toFixed(7) ?? null,
          longitude: input.longitude?.toFixed(7) ?? null,
        })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "store",
        entityId: created.id,
        action: "create",
        afterData: created,
      });
      return created;
    }),

  updateStore: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        cityId: z.number().int().positive(),
        name: z.string().trim().min(2).max(160),
        code: z.string().trim().min(2).max(32).toUpperCase(),
        address: z.string().trim().max(1000).optional(),
        referencePoint: z.string().trim().max(240).optional(),
        zipCode: z.string().trim().max(16).optional(),
        phone: z.string().trim().max(32).optional(),
        email: z.string().trim().email().max(320).optional(),
        openingHours: z.string().trim().max(1000).optional(),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [before] = await database
        .select()
        .from(stores)
        .where(eq(stores.id, input.id))
        .limit(1);
      if (!before)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Loja não encontrada.",
        });
      const duplicate = await database
        .select({ id: stores.id })
        .from(stores)
        .where(
          sql`${stores.code} = ${input.code} OR (${stores.cityId} = ${input.cityId} AND lower(${stores.name}) = lower(${input.name}))`
        );
      if (duplicate.some(row => row.id !== input.id))
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Já existe outra loja com este código ou nome na cidade selecionada.",
        });
      const [updated] = await database
        .update(stores)
        .set({
          cityId: input.cityId,
          name: input.name,
          code: input.code,
          address: input.address || null,
          referencePoint: input.referencePoint || null,
          zipCode: input.zipCode || null,
          phone: input.phone || null,
          email: input.email || null,
          openingHours: input.openingHours || null,
          latitude: input.latitude?.toFixed(7) ?? null,
          longitude: input.longitude?.toFixed(7) ?? null,
          active: input.active ?? before.active,
          updatedAt: new Date(),
        })
        .where(eq(stores.id, input.id))
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "store",
        entityId: input.id,
        action: "update",
        beforeData: before,
        afterData: updated,
      });
      return updated;
    }),

  uploadStorePhoto: protectedProcedure
    .input(
      z.object({
        storeId: z.number().int().positive(),
        originalName: z.string().trim().min(1).max(255),
        mimeType: z.enum(imageMimeTypes),
        dataBase64: z.string().min(1).max(7_000_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [store] = await database
        .select()
        .from(stores)
        .where(eq(stores.id, input.storeId))
        .limit(1);
      if (!store)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Loja não encontrada.",
        });
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (!bytes.length || bytes.length > 5 * 1024 * 1024)
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "A imagem da loja deve ter até 5 MB.",
        });
      const stored = await storagePut(
        `trade/stores/${input.storeId}/${Date.now()}-${safeContractName(input.originalName)}`,
        bytes,
        input.mimeType
      );
      const [updated] = await database
        .update(stores)
        .set({
          photoStorageKey: stored.key,
          photoUrl: stored.url,
          updatedAt: new Date(),
        })
        .where(eq(stores.id, input.storeId))
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "store",
        entityId: input.storeId,
        action: "upload_photo",
        beforeData: { photoStorageKey: store.photoStorageKey },
        afterData: { photoStorageKey: updated.photoStorageKey },
      });
      return updated;
    }),

  createPartner: protectedProcedure
    .input(
      z.object({
        cityId: z.number().int().positive().nullable().optional(),
        name: z.string().trim().min(2).max(160),
        email: z.string().trim().email().max(320).optional(),
        phone: z.string().trim().max(32).optional(),
        partnershipType: z.enum(paymentKinds).optional(),
        paymentMethod: z.string().trim().max(80).optional(),
        paymentRecurrence: z.string().trim().max(80).optional(),
        hasContract: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [existing] = await database
        .select({ id: partners.id })
        .from(partners)
        .where(
          input.email
            ? sql`lower(coalesce(${partners.email}, '')) = lower(${input.email}) OR lower(${partners.name}) = lower(${input.name})`
            : sql`lower(${partners.name}) = lower(${input.name})`
        )
        .limit(1);
      if (existing)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe um parceiro com este nome ou e-mail.",
        });
      const [created] = await database
        .insert(partners)
        .values({
          cityId: input.cityId ?? null,
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          partnershipType: input.partnershipType ?? null,
          paymentMethod: input.paymentMethod || null,
          paymentRecurrence: input.paymentRecurrence || null,
          hasContract: input.hasContract ?? false,
        })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "partner",
        entityId: created.id,
        action: "create",
        afterData: created,
      });
      return created;
        }),
  createType: protectedProcedure
    .input(
      z.object({
        kind: z.enum([
          "service",
          "subservice",
          "media",
          "product",
          "action",
          "event",
          "campaign",
          "campaign_sector",
        ]),
        name: z.string().trim().min(2).max(160),
        description: z.string().trim().max(600).optional(),
        operationCategory: z.enum(mediaOperationCategories).optional(),
        parentMediaTypeId: z.number().int().positive().nullable().optional(),
        mediaTypeId: z.number().int().positive().nullable().optional(),
        parentServiceTypeId: z.number().int().positive().nullable().optional(),
        subserviceParentIds: z.array(z.number().int().positive()).max(100).optional(),
        unit: z.string().trim().max(48).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      if (input.kind === "product") {
        const [created] = await database
          .insert(productTypes)
          .values({ name: input.name, description: input.description || null })
          .returning();
        await writeAuditLog({
          actorUserId: ctx.user.id,
          entityType: "product_type",
          entityId: created.id,
          action: "create",
          afterData: created,
        });
        return created;
      }
      if (input.kind === "service") {
        const requestedParentIds =
          input.subserviceParentIds === undefined
            ? input.parentServiceTypeId
              ? [input.parentServiceTypeId]
              : []
            : input.subserviceParentIds;
        const parents = await resolveServiceParentIds(database, requestedParentIds);
        const parentServiceTypeId = parents[0]?.id ?? null;
        const mediaTypeId =
          input.mediaTypeId ?? parents[0]?.mediaTypeId ?? null;
        const [created] = await database
          .insert(serviceTypes)
          .values({ name: input.name, mediaTypeId, parentServiceTypeId })
          .returning();
        if (parents.length) {
          await database
            .insert(serviceTypeRelations)
            .values(
              parents.map(parent => ({
                serviceTypeId: parent.id,
                subserviceTypeId: created.id,
              }))
            )
            .onConflictDoNothing();
        }
        await writeAuditLog({
          actorUserId: ctx.user.id,
          entityType: "service_type",
          entityId: created.id,
          action: "create",
          afterData: {
            ...created,
            subserviceParentIds: parents.map(parent => parent.id),
          },
        });
        return created;
      }
      if (input.kind === "subservice") {
        const parents = await resolveServiceParentIds(
          database,
          input.subserviceParentIds ?? (input.parentServiceTypeId ? [input.parentServiceTypeId] : [])
        );
        const [created] = await database
          .insert(subserviceTypes)
          .values({
            name: input.name,
            description: input.description || null,
            unit: input.unit || "unidade",
          })
          .returning();
        if (parents.length) {
          await database
            .insert(serviceSubservices)
            .values(
              parents.map(parent => ({
                serviceTypeId: parent.id,
                subserviceTypeId: created.id,
              }))
            )
            .onConflictDoNothing();
        }
        await writeAuditLog({
          actorUserId: ctx.user.id,
          entityType: "subservice_type",
          entityId: created.id,
          action: "create",
          afterData: { ...created, serviceTypeIds: parents.map(parent => parent.id) },
        });
        return created;
      }
      if (input.kind === "media") {
        const parentId = input.parentMediaTypeId ?? null;
        const [parent] = parentId
          ? await database
              .select()
              .from(mediaTypes)
              .where(eq(mediaTypes.id, parentId))
              .limit(1)
          : [null];
        if (parentId && !parent)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O subtipo de mídia selecionado não existe.",
          });
        if (parent?.parentMediaTypeId)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "A variação deve ser vinculada diretamente a um subtipo de mídia.",
          });
        const operationCategory =
          input.operationCategory ?? parent?.operationCategory ?? "graphics";
        if (parent && parent.operationCategory !== operationCategory)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O subtipo deve pertencer à mesma categoria principal.",
          });
        const [created] = await database
          .insert(mediaTypes)
          .values({
            name: input.name,
            operationCategory,
            parentMediaTypeId: parentId,
          })
          .returning();
        await writeAuditLog({
          actorUserId: ctx.user.id,
          entityType: "media_type",
          entityId: created.id,
          action: "create",
          afterData: created,
        });
        return created;
      }
      const table = {
        action: actionTypes,
        event: eventTypes,
        campaign: campaignTypes,
        campaign_sector: campaignSectors,
      }[input.kind as "action" | "event" | "campaign" | "campaign_sector"];
      if (!table)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tipo de cadastro inválido.",
        });
      const [created] = await database
        .insert(table)
        .values({ name: input.name })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: `${input.kind}_type`,
        entityId: created.id,
        action: "create",
        afterData: created,
      });
      return created;
    }),

  createFinancialCategory: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(160),
        description: z.string().trim().max(600).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [existing] = await database
        .select({ id: financialCategories.id })
        .from(financialCategories)
        .where(sql`lower(${financialCategories.name}) = lower(${input.name})`)
        .limit(1);
      if (existing)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe uma categoria financeira com este nome.",
        });
      const [created] = await database
        .insert(financialCategories)
        .values({ name: input.name, description: input.description || null })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "financial_category",
        entityId: created.id,
        action: "create",
        afterData: created,
      });
      return created;
    }),

  createSupplierOffering: protectedProcedure
    .input(
      z.object({
        supplierId: z.number().int().positive(),
        kind: z.enum([
          "product",
          "service",
          "subservice",
          "media",
          "action",
          "event",
          "other",
        ]),
        name: z.string().trim().min(2).max(180),
        unit: z.string().trim().min(1).max(64),
        unitPrice: z.number().nonnegative().max(99_999_999),
        averageUnitPrice: z
          .number()
          .nonnegative()
          .max(99_999_999)
          .nullable()
          .optional(),
        productTypeId: z.number().int().positive().nullable().optional(),
        mediaTypeId: z.number().int().positive().nullable().optional(),
        serviceTypeId: z.number().int().positive().nullable().optional(),
        notes: z.string().trim().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [supplier] = await database
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(eq(suppliers.id, input.supplierId))
        .limit(1);
      if (!supplier)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fornecedor não encontrado.",
        });
      const [existing] = await database
        .select({ id: supplierOfferings.id })
        .from(supplierOfferings)
        .where(
          and(
            eq(supplierOfferings.supplierId, input.supplierId),
            eq(supplierOfferings.kind, input.kind),
            sql`lower(${supplierOfferings.name}) = lower(${input.name})`
          )
        )
        .limit(1);
      if (existing)
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Este fornecedor já possui uma oferta com a mesma categoria e nome.",
        });
      const [created] = await database
        .insert(supplierOfferings)
        .values({
          ...input,
          mediaTypeId: input.mediaTypeId ?? null,
          serviceTypeId: input.serviceTypeId ?? null,
          productTypeId: input.productTypeId ?? null,
          unitPrice: input.unitPrice.toFixed(2),
          averageUnitPrice:
            input.averageUnitPrice == null
              ? null
              : input.averageUnitPrice.toFixed(2),
          notes: input.notes || null,
        })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "supplier_offering",
        entityId: created.id,
        action: "create",
        afterData: created,
      });
      return created;
    }),

  updateProvider: protectedProcedure
    .input(providerInputSchema.extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [before] = await database
        .select()
        .from(providers)
        .where(eq(providers.id, input.id))
        .limit(1);
      if (!before)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Empresa não encontrada.",
        });
      const billingCnpj = input.billingCnpj
        ? normalizeCnpj(input.billingCnpj)
        : null;
      const website = normalizeWebsiteUrl(input.website);
      if (billingCnpj && billingCnpj.length !== 14)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe um CNPJ de faturamento com 14 dígitos.",
        });
      const headquartersCityId =
        input.headquartersCityId === undefined
          ? before.headquartersCityId
          : input.headquartersCityId;
      if (headquartersCityId) {
        const [headquarters] = await database
          .select({ id: cities.id, providerId: regionals.providerId })
          .from(cities)
          .innerJoin(regionals, eq(cities.regionalId, regionals.id))
          .where(eq(cities.id, headquartersCityId))
          .limit(1);
        if (!headquarters || headquarters.providerId !== input.id)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "A cidade-matriz deve estar vinculada a uma regional desta empresa.",
          });
      }
      if (billingCnpj && billingCnpj !== before.billingCnpj) {
        const [sameCnpj] = await database
          .select({ id: providerFiscalEntities.id })
          .from(providerFiscalEntities)
          .where(eq(providerFiscalEntities.cnpj, billingCnpj))
          .limit(1);
        if (sameCnpj) throw new TRPCError({ code: "CONFLICT", message: "Este CNPJ já está cadastrado como empresa fiscal." });
      }
      const runInTransaction = <T>(work: (tx: any) => Promise<T>) => {
        const transaction = (database as any).transaction;
        return typeof transaction === "function"
          ? transaction.call(database, work)
          : work(database as any);
      };
      const updated = await runInTransaction(async tx => {
        const [provider] = await tx
          .update(providers)
          .set({
            name: input.name,
            billingCnpj,
            legalName: input.legalName || null,
            contactName: input.contactName || null,
            phone: input.phone || null,
            email: input.email || null,
            website,
            address: input.address || null,
            headquartersCityId: headquartersCityId ?? null,
            brandColors: input.brandColors ?? before.brandColors,
            updatedAt: new Date(),
          })
          .where(eq(providers.id, input.id))
          .returning();
        if (billingCnpj) {
          const [defaultFiscal] = await tx
            .select()
            .from(providerFiscalEntities)
            .where(and(eq(providerFiscalEntities.providerId, input.id), eq(providerFiscalEntities.isDefault, true)))
            .limit(1);
          if (defaultFiscal && (defaultFiscal.cnpj === before.billingCnpj || defaultFiscal.cnpj === billingCnpj)) {
            await tx.update(providerFiscalEntities).set({
              name: input.legalName || input.name,
              legalName: input.legalName || null,
              cnpj: billingCnpj,
              cityId: headquartersCityId ?? null,
              updatedAt: new Date(),
            }).where(eq(providerFiscalEntities.id, defaultFiscal.id));
          } else if (!defaultFiscal) {
            await tx.insert(providerFiscalEntities).values({
              providerId: input.id,
              name: input.legalName || input.name,
              legalName: input.legalName || null,
              cnpj: billingCnpj,
              cityId: headquartersCityId ?? null,
              isDefault: true,
            });
          }
        }
        return provider;
      });
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "provider",
        entityId: input.id,
        action: "update",
        beforeData: before,
        afterData: updated,
      });
      return updated;
    }),

  updateRegional: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        providerId: z.number().int().positive().nullable(),
        name: z.string().trim().min(2).max(160),
        code: z.string().trim().min(2).max(32).toUpperCase(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [before] = await database
        .select()
        .from(regionals)
        .where(eq(regionals.id, input.id))
        .limit(1);
      if (!before)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Regional não encontrada.",
        });
      const [updated] = await database
        .update(regionals)
        .set(input)
        .where(eq(regionals.id, input.id))
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        regionalId: input.id,
        entityType: "regional",
        entityId: input.id,
        action: "update",
        beforeData: before,
        afterData: updated,
      });
      return updated;
    }),

  updateCity: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        regionalId: z.number().int().positive(),
        name: z.string().trim().min(2).max(160),
        state: z.string().trim().length(2).toUpperCase(),
        ibgeCode: z.string().trim().max(16).optional(),
        address: z.string().trim().max(1000).optional(),
        zipCode: z.string().trim().max(16).optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        locationNotes: z.string().trim().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [before] = await database
        .select()
        .from(cities)
        .where(eq(cities.id, input.id))
        .limit(1);
      if (!before)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cidade não encontrada.",
        });
      const [updated] = await database
        .update(cities)
        .set({
          ...input,
          ibgeCode: input.ibgeCode || null,
          address: input.address || null,
          zipCode: input.zipCode || null,
          latitude: input.latitude?.toFixed(7),
          longitude: input.longitude?.toFixed(7),
          locationNotes: input.locationNotes || null,
          updatedAt: new Date(),
        })
        .where(eq(cities.id, input.id))
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        regionalId: input.regionalId,
        entityType: "city",
        entityId: input.id,
        action: "update",
        beforeData: before,
        afterData: updated,
      });
      return updated;
    }),

  updateType: protectedProcedure
    .input(
      z.object({
        kind: z.enum([
          "service",
          "subservice",
          "media",
          "product",
          "action",
          "event",
          "campaign",
          "campaign_sector",
        ]),
        id: z.number().int().positive(),
        name: z.string().trim().min(2).max(160),
        description: z.string().trim().max(600).optional(),
        operationCategory: z.enum(mediaOperationCategories).optional(),
        parentMediaTypeId: z.number().int().positive().nullable().optional(),
        mediaTypeId: z.number().int().positive().nullable().optional(),
        parentServiceTypeId: z.number().int().positive().nullable().optional(),
        subserviceParentIds: z.array(z.number().int().positive()).max(100).optional(),
        unit: z.string().trim().max(48).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      if (input.kind === "product") {
        const [before] = await database
          .select()
          .from(productTypes)
          .where(eq(productTypes.id, input.id))
          .limit(1);
        if (!before)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Tipo de produto não encontrado.",
          });
        const [updated] = await database
          .update(productTypes)
          .set({
            name: input.name,
            description: input.description || null,
            updatedAt: new Date(),
          })
          .where(eq(productTypes.id, input.id))
          .returning();
        await writeAuditLog({
          actorUserId: ctx.user.id,
          entityType: "product_type",
          entityId: input.id,
          action: "update",
          beforeData: before,
          afterData: updated,
        });
        return updated;
      }
      if (input.kind === "subservice") {
        const [before] = await database
          .select()
          .from(subserviceTypes)
          .where(eq(subserviceTypes.id, input.id))
          .limit(1);
        if (!before)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "SubServiço não encontrado.",
          });
        const parents = await resolveServiceParentIds(
          database,
          input.subserviceParentIds ?? (input.parentServiceTypeId ? [input.parentServiceTypeId] : [])
        );
        const [updated] = await database
          .update(subserviceTypes)
          .set({
            name: input.name,
            description: input.description || null,
            unit: input.unit || before.unit,
            updatedAt: new Date(),
          })
          .where(eq(subserviceTypes.id, input.id))
          .returning();
        await database
          .delete(serviceSubservices)
          .where(eq(serviceSubservices.subserviceTypeId, input.id));
        if (parents.length) {
          await database
            .insert(serviceSubservices)
            .values(
              parents.map(parent => ({
                serviceTypeId: parent.id,
                subserviceTypeId: input.id,
              }))
            )
            .onConflictDoNothing();
        }
        await writeAuditLog({
          actorUserId: ctx.user.id,
          entityType: "subservice_type",
          entityId: input.id,
          action: "update",
          beforeData: before,
          afterData: { ...updated, serviceTypeIds: parents.map(parent => parent.id) },
        });
        return updated;
      }
      if (input.kind === "media") {
        const [before] = await database
          .select()
          .from(mediaTypes)
          .where(eq(mediaTypes.id, input.id))
          .limit(1);
        if (!before)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Tipo de mídia não encontrado.",
          });
        const parentId =
          input.parentMediaTypeId === undefined
            ? before.parentMediaTypeId
            : input.parentMediaTypeId;
        if (parentId === input.id)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Um tipo não pode ser variação de si mesmo.",
          });
        const [parent] = parentId
          ? await database
              .select()
              .from(mediaTypes)
              .where(eq(mediaTypes.id, parentId))
              .limit(1)
          : [null];
        if (parentId && !parent)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O subtipo de mídia selecionado não existe.",
          });
        if (parent?.parentMediaTypeId)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "A variação deve ser vinculada diretamente a um subtipo de mídia.",
          });
        const operationCategory =
          input.operationCategory ??
          parent?.operationCategory ??
          before.operationCategory;
        if (parent && parent.operationCategory !== operationCategory)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "O subtipo deve pertencer à mesma categoria principal.",
          });
        const [updated] = await database
          .update(mediaTypes)
          .set({
            name: input.name,
            operationCategory,
            parentMediaTypeId: parentId,
          })
          .where(eq(mediaTypes.id, input.id))
          .returning();
        await writeAuditLog({
          actorUserId: ctx.user.id,
          entityType: "media_type",
          entityId: input.id,
          action: "update",
          beforeData: before,
          afterData: updated,
        });
        return updated;
      }
      if (input.kind === "service") {
        const [before] = await database
          .select()
          .from(serviceTypes)
          .where(eq(serviceTypes.id, input.id))
          .limit(1);
        if (!before)
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Serviço não encontrado.",
          });
        const requestedParentIds =
          input.subserviceParentIds === undefined
            ? input.parentServiceTypeId === undefined
              ? before.parentServiceTypeId
                ? [before.parentServiceTypeId]
                : []
              : input.parentServiceTypeId
                ? [input.parentServiceTypeId]
                : []
            : input.subserviceParentIds;
        const parents = await resolveServiceParentIds(
          database,
          requestedParentIds,
          input.id
        );
        const parentServiceTypeId = parents[0]?.id ?? null;
        const mediaTypeId =
          input.mediaTypeId === undefined
            ? (parents[0]?.mediaTypeId ?? before.mediaTypeId)
            : input.mediaTypeId;
        const [updated] = await database
          .update(serviceTypes)
          .set({
            name: input.name,
            mediaTypeId: mediaTypeId ?? null,
            parentServiceTypeId,
          })
          .where(eq(serviceTypes.id, input.id))
          .returning();
        await database
          .delete(serviceTypeRelations)
          .where(eq(serviceTypeRelations.subserviceTypeId, input.id));
        if (parents.length) {
          await database
            .insert(serviceTypeRelations)
            .values(
              parents.map(parent => ({
                serviceTypeId: parent.id,
                subserviceTypeId: input.id,
              }))
            )
            .onConflictDoNothing();
        }
        await writeAuditLog({
          actorUserId: ctx.user.id,
          entityType: "service_type",
          entityId: input.id,
          action: "update",
          beforeData: before,
          afterData: {
            ...updated,
            subserviceParentIds: parents.map(parent => parent.id),
          },
        });
        return updated;
      }
      const table = {
        action: actionTypes,
        event: eventTypes,
        campaign: campaignTypes,
        campaign_sector: campaignSectors,
      }[input.kind];
      const [before] = await database
        .select()
        .from(table)
        .where(eq(table.id, input.id))
        .limit(1);
      if (!before)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tipo não encontrado.",
        });
      const [updated] = await database
        .update(table)
        .set({ name: input.name })
        .where(eq(table.id, input.id))
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: `${input.kind}_type`,
        entityId: input.id,
        action: "update",
        beforeData: before,
        afterData: updated,
      });
      return updated;
    }),

  createCommercialSupervisor: protectedProcedure
    .input(
      z.object({
        userId: z.number().int().positive().nullable(),
        name: z.string().trim().min(2).max(160),
        email: z.string().trim().email().max(320).optional(),
        phone: z.string().trim().max(32).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [created] = await database
        .insert(commercialSupervisors)
        .values({
          ...input,
          email: input.email || null,
          phone: input.phone || null,
        })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "commercial_supervisor",
        entityId: created.id,
        action: "create",
        afterData: created,
      });
      return created;
    }),

  setCommercialSupervisorStores: protectedProcedure
    .input(
      z.object({
        commercialSupervisorId: z.number().int().positive(),
        storeIds: z.array(z.number().int().positive()).max(300),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const storeIds = uniqueIds(input.storeIds);
      const [supervisor] = await database
        .select({ id: commercialSupervisors.id })
        .from(commercialSupervisors)
        .where(eq(commercialSupervisors.id, input.commercialSupervisorId))
        .limit(1);
      if (!supervisor)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Supervisor comercial não encontrado.",
        });
      if (storeIds.length) {
        const existingStores = await database
          .select({ id: stores.id })
          .from(stores)
          .where(inArray(stores.id, storeIds));
        if (existingStores.length !== storeIds.length)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Uma ou mais lojas selecionadas não existem.",
          });
        const conflictingLinks = await database
          .select({
            storeId: commercialSupervisorStores.storeId,
            commercialSupervisorId:
              commercialSupervisorStores.commercialSupervisorId,
          })
          .from(commercialSupervisorStores)
          .where(inArray(commercialSupervisorStores.storeId, storeIds));
        if (
          conflictingLinks.some(
            link => link.commercialSupervisorId !== input.commercialSupervisorId
          )
        )
          throw new TRPCError({
            code: "CONFLICT",
            message: "Cada loja pode ter apenas um supervisor responsável.",
          });
      }
      await database.transaction(async transaction => {
        await transaction
          .delete(commercialSupervisorStores)
          .where(
            eq(
              commercialSupervisorStores.commercialSupervisorId,
              input.commercialSupervisorId
            )
          );
        if (storeIds.length)
          await transaction.insert(commercialSupervisorStores).values(
            storeIds.map(storeId => ({
              commercialSupervisorId: input.commercialSupervisorId,
              storeId,
            }))
          );
      });
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "commercial_supervisor",
        entityId: input.commercialSupervisorId,
        action: "set_stores",
        afterData: { storeIds },
      });
      return { commercialSupervisorId: input.commercialSupervisorId, storeIds };
    }),

  setCommercialSupervisorCities: protectedProcedure
    .input(
      z.object({
        commercialSupervisorId: z.number().int().positive(),
        cityIds: z.array(z.number().int().positive()).max(300),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const cityIds = uniqueIds(input.cityIds);
      const [supervisor] = await database
        .select({ id: commercialSupervisors.id })
        .from(commercialSupervisors)
        .where(eq(commercialSupervisors.id, input.commercialSupervisorId))
        .limit(1);
      if (!supervisor)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Supervisor comercial não encontrado.",
        });
      if (cityIds.length) {
        const existingCities = await database
          .select({ id: cities.id })
          .from(cities)
          .where(inArray(cities.id, cityIds));
        if (existingCities.length !== cityIds.length)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Uma ou mais cidades selecionadas não existem.",
          });
      }
      await database.transaction(async transaction => {
        await transaction
          .delete(commercialSupervisorCities)
          .where(
            eq(
              commercialSupervisorCities.commercialSupervisorId,
              input.commercialSupervisorId
            )
          );
        if (cityIds.length)
          await transaction.insert(commercialSupervisorCities).values(
            cityIds.map(cityId => ({
              commercialSupervisorId: input.commercialSupervisorId,
              cityId,
            }))
          );
      });
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "commercial_supervisor",
        entityId: input.commercialSupervisorId,
        action: "set_cities",
        afterData: { cityIds },
      });
      return { commercialSupervisorId: input.commercialSupervisorId, cityIds };
    }),

  setProductMediaTypes: protectedProcedure
    .input(
      z.object({
        productTypeId: z.number().int().positive(),
        mediaTypeIds: z.array(z.number().int().positive()).max(300),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const mediaTypeIds = uniqueIds(input.mediaTypeIds);
      const [product] = await database
        .select({ id: productTypes.id })
        .from(productTypes)
        .where(eq(productTypes.id, input.productTypeId))
        .limit(1);
      if (!product)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tipo de produto não encontrado.",
        });
      if (mediaTypeIds.length) {
        const existingMediaTypes = await database
          .select({ id: mediaTypes.id })
          .from(mediaTypes)
          .where(inArray(mediaTypes.id, mediaTypeIds));
        if (existingMediaTypes.length !== mediaTypeIds.length)
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Um ou mais tipos de mídia selecionados não existem.",
          });
      }
      await database.transaction(async transaction => {
        await transaction
          .delete(productMediaTypes)
          .where(eq(productMediaTypes.productTypeId, input.productTypeId));
        if (mediaTypeIds.length)
          await transaction.insert(productMediaTypes).values(
            mediaTypeIds.map(mediaTypeId => ({
              productTypeId: input.productTypeId,
              mediaTypeId,
            }))
          );
      });
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "product_type",
        entityId: input.productTypeId,
        action: "set_media_types",
        afterData: { mediaTypeIds },
      });
      return { productTypeId: input.productTypeId, mediaTypeIds };
    }),

  createActionPoint: protectedProcedure
    .input(
      z.object({
        cityId: z.number().int().positive(),
        name: z.string().trim().min(2).max(180),
        address: z.string().trim().max(2000).optional(),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
        notes: z.string().trim().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [city] = await database
        .select({ id: cities.id })
        .from(cities)
        .where(eq(cities.id, input.cityId))
        .limit(1);
      if (!city)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A cidade selecionada não existe.",
        });
      const [existing] = await database
        .select({ id: actionPoints.id })
        .from(actionPoints)
        .where(
          sql`${actionPoints.cityId} = ${input.cityId} AND lower(${actionPoints.name}) = lower(${input.name})`
        )
        .limit(1);
      if (existing)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe um ponto de ação com este nome nessa cidade.",
        });
      const [created] = await database
        .insert(actionPoints)
        .values({
          cityId: input.cityId,
          name: input.name,
          address: input.address || null,
          latitude: input.latitude?.toFixed(7) ?? null,
          longitude: input.longitude?.toFixed(7) ?? null,
          notes: input.notes || null,
        })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "action_point",
        entityId: created.id,
        action: "create",
        afterData: { ...created, cityId: input.cityId },
      });
      return created;
    }),

  updateActionPoint: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        cityId: z.number().int().positive(),
        name: z.string().trim().min(2).max(180),
        address: z.string().trim().max(2000).optional(),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
        notes: z.string().trim().max(2000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [before] = await database
        .select()
        .from(actionPoints)
        .where(eq(actionPoints.id, input.id))
        .limit(1);
      if (!before)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Ponto de ação não encontrado.",
        });
      const [city] = await database
        .select({ id: cities.id })
        .from(cities)
        .where(eq(cities.id, input.cityId))
        .limit(1);
      if (!city)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A cidade selecionada não existe.",
        });
      const [updated] = await database
        .update(actionPoints)
        .set({
          cityId: input.cityId,
          name: input.name,
          address: input.address || null,
          latitude: input.latitude?.toFixed(7) ?? null,
          longitude: input.longitude?.toFixed(7) ?? null,
          notes: input.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(actionPoints.id, input.id))
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "action_point",
        entityId: input.id,
        action: "update",
        beforeData: before,
        afterData: { ...updated, cityId: input.cityId },
      });
      return updated;
    }),

  updateSupplier: protectedProcedure
    .input(supplierInputSchema.extend({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [before] = await database
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, input.id))
        .limit(1);
      if (!before)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fornecedor não encontrado.",
        });
      const document = input.document ? normalizeCnpj(input.document) : before.document;
      if (document && document.length !== 14)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe um CNPJ com 14 dígitos.",
        });
      const [sameName, sameDocument] = await Promise.all([
        database
          .select({ id: suppliers.id })
          .from(suppliers)
          .where(
            sql`lower(${suppliers.displayName}) = lower(${input.displayName})`
          ),
        database
          .select({ id: suppliers.id })
          .from(suppliers)
          .where(
            sql`regexp_replace(coalesce(${suppliers.document}, ''), '[^0-9]', '', 'g') = ${document}`
          ),
      ]);
      if (sameName.some(row => row.id !== input.id))
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe um fornecedor com este nome de exibição.",
        });
      if (sameDocument.some(row => row.id !== input.id))
        throw new TRPCError({
          code: "CONFLICT",
          message: "Já existe um fornecedor cadastrado com este CNPJ.",
        });
      const updated = await database.transaction(async transaction => {
        const [supplier] = await transaction
          .update(suppliers)
          .set({
            providerId: input.providerId,
            cityId: input.cityId ?? null,
            displayName: input.displayName,
            address: input.address || null,
            document,
            legalName: input.legalName || null,
            contactName: input.contactName || null,
            phone: input.phone || null,
            email: input.email || null,
            mainService: input.mainService || null,
            partnershipType: input.partnershipType ?? null,
            paymentMethod: input.paymentMethod || null,
            paymentRecurrence: input.paymentRecurrence || null,
            pixKey: input.pixKey || null,
            paymentDay: input.paymentDay ?? null,
            paymentBarterValue:
              input.paymentBarterValue == null
                ? null
                : input.paymentBarterValue.toFixed(2),
            paymentBarterService: input.paymentBarterService || null,
            paymentNotes: input.paymentNotes || null,
            contractStartsOn: input.contractStartsOn ?? null,
            contractEndsOn: input.contractEndsOn ?? null,
            hasContract: input.hasContract ?? before.hasContract,
            updatedAt: new Date(),
          })
          .where(eq(suppliers.id, input.id))
          .returning();
        if (before.cityId && before.cityId !== supplier.cityId)
          await transaction
            .delete(supplierCities)
            .where(
              and(
                eq(supplierCities.supplierId, supplier.id),
                eq(supplierCities.cityId, before.cityId)
              )
            );
        if (supplier.cityId)
          await transaction
            .insert(supplierCities)
            .values({ supplierId: supplier.id, cityId: supplier.cityId })
            .onConflictDoNothing();
        return supplier;
      });
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "supplier",
        entityId: input.id,
        action: "update",
        beforeData: before,
        afterData: updated,
      });
      return updated;
    }),

  uploadSupplierPhoto: protectedProcedure
    .input(
      z.object({
        supplierId: z.number().int().positive(),
        originalName: z.string().trim().min(1).max(255),
        mimeType: z.enum(imageMimeTypes),
        dataBase64: z.string().min(1).max(7_000_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [supplier] = await database
        .select()
        .from(suppliers)
        .where(eq(suppliers.id, input.supplierId))
        .limit(1);
      if (!supplier)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Fornecedor não encontrado.",
        });
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (!bytes.length || bytes.length > 5 * 1024 * 1024)
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "A imagem do fornecedor deve ter até 5 MB.",
        });
      const stored = await storagePut(
        `trade/suppliers/${input.supplierId}/${Date.now()}-${safeContractName(input.originalName)}`,
        bytes,
        input.mimeType
      );
      const [updated] = await database
        .update(suppliers)
        .set({
          photoStorageKey: stored.key,
          photoUrl: stored.url,
          updatedAt: new Date(),
        })
        .where(eq(suppliers.id, input.supplierId))
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "supplier",
        entityId: input.supplierId,
        action: "upload_photo",
        beforeData: { photoStorageKey: supplier.photoStorageKey },
        afterData: { photoStorageKey: updated.photoStorageKey },
      });
      return updated;
    }),

  updatePartner: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        cityId: z.number().int().positive().nullable().optional(),
        name: z.string().trim().min(2).max(160),
        email: z.string().trim().email().max(320).optional(),
        phone: z.string().trim().max(32).optional(),
        partnershipType: z.enum(paymentKinds).optional(),
        paymentMethod: z.string().trim().max(80).optional(),
        paymentRecurrence: z.string().trim().max(80).optional(),
        hasContract: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [before] = await database
        .select()
        .from(partners)
        .where(eq(partners.id, input.id))
        .limit(1);
      if (!before)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Parceiro não encontrado.",
        });
      const [updated] = await database
        .update(partners)
        .set({
          cityId: input.cityId ?? null,
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          partnershipType: input.partnershipType ?? null,
          paymentMethod: input.paymentMethod || null,
          paymentRecurrence: input.paymentRecurrence || null,
          hasContract: input.hasContract ?? before.hasContract,
          updatedAt: new Date(),
        })
        .where(eq(partners.id, input.id))
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "partner",
        entityId: input.id,
        action: "update",
        beforeData: before,
        afterData: updated,
      });
      return updated;
    }),

  uploadRegistryContract: protectedProcedure
    .input(
      z.object({
        entityType: z.enum(["supplier", "partner"]),
        entityId: z.number().int().positive(),
        originalName: z.string().trim().min(1).max(255),
        mimeType: z.enum(contractMimeTypes),
        dataBase64: z.string().min(1).max(7_000_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const table = input.entityType === "supplier" ? suppliers : partners;
      const [entity] = await database
        .select()
        .from(table)
        .where(eq(table.id, input.entityId))
        .limit(1);
      if (!entity)
        throw new TRPCError({
          code: "NOT_FOUND",
          message:
            input.entityType === "supplier"
              ? "Fornecedor não encontrado."
              : "Parceiro não encontrado.",
        });
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (!bytes.length || bytes.length > 5 * 1024 * 1024)
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "O contrato deve ter até 5 MB.",
        });
      const filename = safeContractName(input.originalName);
      const stored = await storagePut(
        `trade/contracts/${input.entityType}/${input.entityId}/${Date.now()}-${filename}`,
        bytes,
        input.mimeType
      );
      const [updated] = await database
        .update(table)
        .set({
          hasContract: true,
          contractStorageKey: stored.key,
          contractUrl: stored.url,
          updatedAt: new Date(),
        })
        .where(eq(table.id, input.entityId))
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: input.entityType,
        entityId: input.entityId,
        action: "upload_contract",
        beforeData: { contractStorageKey: entity.contractStorageKey },
        afterData: { contractStorageKey: updated.contractStorageKey },
      });
      return updated;
    }),

  updateCommercialSupervisor: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(2).max(160),
        email: z.string().trim().email().max(320).optional(),
        phone: z.string().trim().max(32).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [before] = await database
        .select()
        .from(commercialSupervisors)
        .where(eq(commercialSupervisors.id, input.id))
        .limit(1);
      if (!before)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Supervisor comercial não encontrado.",
        });
      const [updated] = await database
        .update(commercialSupervisors)
        .set({
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          updatedAt: new Date(),
        })
        .where(eq(commercialSupervisors.id, input.id))
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "commercial_supervisor",
        entityId: input.id,
        action: "update",
        beforeData: before,
        afterData: updated,
      });
      return updated;
    }),

  updateFinancialCategory: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(2).max(160),
        description: z.string().trim().max(600).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [before] = await database
        .select()
        .from(financialCategories)
        .where(eq(financialCategories.id, input.id))
        .limit(1);
      if (!before)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Categoria financeira não encontrada.",
        });
      const [updated] = await database
        .update(financialCategories)
        .set({
          name: input.name,
          description: input.description || null,
          updatedAt: new Date(),
        })
        .where(eq(financialCategories.id, input.id))
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "financial_category",
        entityId: input.id,
        action: "update",
        beforeData: before,
        afterData: updated,
      });
      return updated;
    }),

  updateSupplierOffering: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        kind: z.enum([
          "product",
          "service",
          "subservice",
          "media",
          "action",
          "event",
          "other",
        ]),
        name: z.string().trim().min(2).max(180),
        unit: z.string().trim().min(1).max(64),
        unitPrice: z.number().nonnegative().max(99_999_999),
        averageUnitPrice: z
          .number()
          .nonnegative()
          .max(99_999_999)
          .nullable()
          .optional(),
        productTypeId: z.number().int().positive().nullable().optional(),
        mediaTypeId: z.number().int().positive().nullable().optional(),
        serviceTypeId: z.number().int().positive().nullable().optional(),
        notes: z.string().trim().max(1000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [before] = await database
        .select()
        .from(supplierOfferings)
        .where(eq(supplierOfferings.id, input.id))
        .limit(1);
      if (!before)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Oferta não encontrada.",
        });
      const [updated] = await database
        .update(supplierOfferings)
        .set({
          kind: input.kind,
          name: input.name,
          productTypeId: input.productTypeId ?? null,
          mediaTypeId: input.mediaTypeId ?? null,
          serviceTypeId: input.serviceTypeId ?? null,
          unit: input.unit,
          unitPrice: input.unitPrice.toFixed(2),
          averageUnitPrice:
            input.averageUnitPrice == null
              ? null
              : input.averageUnitPrice.toFixed(2),
          notes: input.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(supplierOfferings.id, input.id))
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "supplier_offering",
        entityId: input.id,
        action: "update",
        beforeData: before,
        afterData: updated,
      });
      return updated;
    }),

  setRegistryActive: protectedProcedure
    .input(
      z.object({
        kind: z.enum([
          "provider",
          "provider_fiscal_entity",
          "regional",
          "city",
          "store",
          "supplier",
          "partner",
          "supervisor",
          "service",
          "product",
          "media",
          "action",
          "event",
          "campaign",
          "campaign_sector",
          "financial_category",
          "supplier_offering",
        ]),
        id: z.number().int().positive(),
        active: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const now = new Date();
      let updated: { id: number; active: boolean } | undefined;
      switch (input.kind) {
        case "product": {
          const [row] = await database
            .update(productTypes)
            .set({ active: input.active, updatedAt: now })
            .where(eq(productTypes.id, input.id))
            .returning({ id: productTypes.id, active: productTypes.active });
          updated = row;
          break;
        }
        case "provider":
          [updated] = await database
            .update(providers)
            .set({ active: input.active })
            .where(eq(providers.id, input.id))
            .returning({ id: providers.id, active: providers.active });
          break;
        case "provider_fiscal_entity":
          [updated] = await database
            .update(providerFiscalEntities)
            .set({ active: input.active, updatedAt: now })
            .where(eq(providerFiscalEntities.id, input.id))
            .returning({ id: providerFiscalEntities.id, active: providerFiscalEntities.active });
          break;
        case "regional":
          [updated] = await database
            .update(regionals)
            .set({ active: input.active })
            .where(eq(regionals.id, input.id))
            .returning({ id: regionals.id, active: regionals.active });
          break;
        case "city":
          [updated] = await database
            .update(cities)
            .set({ active: input.active })
            .where(eq(cities.id, input.id))
            .returning({ id: cities.id, active: cities.active });
          break;
        case "store":
          [updated] = await database
            .update(stores)
            .set({ active: input.active, updatedAt: now })
            .where(eq(stores.id, input.id))
            .returning({ id: stores.id, active: stores.active });
          break;
        case "supplier":
          [updated] = await database
            .update(suppliers)
            .set({ active: input.active, updatedAt: now })
            .where(eq(suppliers.id, input.id))
            .returning({ id: suppliers.id, active: suppliers.active });
          break;
        case "partner":
          [updated] = await database
            .update(partners)
            .set({ active: input.active })
            .where(eq(partners.id, input.id))
            .returning({ id: partners.id, active: partners.active });
          break;
        case "supervisor":
          [updated] = await database
            .update(commercialSupervisors)
            .set({ active: input.active, updatedAt: now })
            .where(eq(commercialSupervisors.id, input.id))
            .returning({
              id: commercialSupervisors.id,
              active: commercialSupervisors.active,
            });
          break;
        case "service":
          [updated] = await database
            .update(serviceTypes)
            .set({ active: input.active })
            .where(eq(serviceTypes.id, input.id))
            .returning({ id: serviceTypes.id, active: serviceTypes.active });
          break;
        case "media":
          [updated] = await database
            .update(mediaTypes)
            .set({ active: input.active })
            .where(eq(mediaTypes.id, input.id))
            .returning({ id: mediaTypes.id, active: mediaTypes.active });
          break;
        case "action":
          [updated] = await database
            .update(actionTypes)
            .set({ active: input.active })
            .where(eq(actionTypes.id, input.id))
            .returning({ id: actionTypes.id, active: actionTypes.active });
          break;
        case "event":
          [updated] = await database
            .update(eventTypes)
            .set({ active: input.active })
            .where(eq(eventTypes.id, input.id))
            .returning({ id: eventTypes.id, active: eventTypes.active });
          break;
        case "campaign":
          [updated] = await database
            .update(campaignTypes)
            .set({ active: input.active })
            .where(eq(campaignTypes.id, input.id))
            .returning({ id: campaignTypes.id, active: campaignTypes.active });
          break;
        case "campaign_sector":
          [updated] = await database
            .update(campaignSectors)
            .set({ active: input.active })
            .where(eq(campaignSectors.id, input.id))
            .returning({
              id: campaignSectors.id,
              active: campaignSectors.active,
            });
          break;
        case "financial_category":
          [updated] = await database
            .update(financialCategories)
            .set({ active: input.active, updatedAt: now })
            .where(eq(financialCategories.id, input.id))
            .returning({
              id: financialCategories.id,
              active: financialCategories.active,
            });
          break;
        case "supplier_offering":
          [updated] = await database
            .update(supplierOfferings)
            .set({ active: input.active, updatedAt: now })
            .where(eq(supplierOfferings.id, input.id))
            .returning({
              id: supplierOfferings.id,
              active: supplierOfferings.active,
            });
          break;
      }
      if (!updated)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cadastro não encontrado.",
        });
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: input.kind,
        entityId: input.id,
        action: input.active ? "activate" : "deactivate",
        afterData: { active: updated.active },
      });
      return { success: true, active: updated.active } as const;
    }),

  deleteRegistry: protectedProcedure
    .input(
      z.object({
        kind: z.enum([
          "provider",
          "provider_fiscal_entity",
          "regional",
          "city",
          "store",
          "supplier",
          "partner",
          "supervisor",
          "service",
          "product",
          "media",
          "action",
          "event",
          "campaign",
          "campaign_sector",
          "financial_category",
          "supplier_offering",
        ]),
        id: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const tables = {
        provider: providers,
        provider_fiscal_entity: providerFiscalEntities,
        regional: regionals,
        city: cities,
        store: stores,
        supplier: suppliers,
        partner: partners,
        supervisor: commercialSupervisors,
        service: serviceTypes,
        product: productTypes,
        media: mediaTypes,
        action: actionTypes,
        event: eventTypes,
        campaign: campaignTypes,
        campaign_sector: campaignSectors,
        financial_category: financialCategories,
        supplier_offering: supplierOfferings,
      } as const;
      const table = tables[input.kind];
      const [before] = await database
        .select()
        .from(table)
        .where(eq(table.id, input.id))
        .limit(1);
      if (!before)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Cadastro não encontrado.",
        });
      if (input.kind === "city") {
        const [store, actionPoint, operation, action, event, mediaPoint] =
          await Promise.all([
            database
              .select({ id: stores.id })
              .from(stores)
              .where(eq(stores.cityId, input.id))
              .limit(1),
            database
              .select({ id: actionPoints.id })
              .from(actionPoints)
              .where(eq(actionPoints.cityId, input.id))
              .limit(1),
            database
              .select({ id: tradeOperations.id })
              .from(tradeOperations)
              .where(eq(tradeOperations.cityId, input.id))
              .limit(1),
            database
              .select({ id: actions.id })
              .from(actions)
              .where(eq(actions.cityId, input.id))
              .limit(1),
            database
              .select({ id: events.id })
              .from(events)
              .where(eq(events.cityId, input.id))
              .limit(1),
            database
              .select({ id: mediaPoints.id })
              .from(mediaPoints)
              .where(eq(mediaPoints.cityId, input.id))
              .limit(1),
          ]);
        if (
          store[0] ||
          actionPoint[0] ||
          operation[0] ||
          action[0] ||
          event[0] ||
          mediaPoint[0]
        )
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Esta cidade possui operações, pontos ou lojas vinculados. Inative-a para preservar o histórico.",
          });
        await database.transaction(async tx => {
          await tx.delete(supplierCities).where(eq(supplierCities.cityId, input.id));
          await tx
            .delete(commercialSupervisorCities)
            .where(eq(commercialSupervisorCities.cityId, input.id));
          await tx.delete(campaignCities).where(eq(campaignCities.cityId, input.id));
          await tx
            .delete(campaignPromotionCities)
            .where(eq(campaignPromotionCities.cityId, input.id));
          await tx
            .delete(mediaCampaignCityDistributions)
            .where(eq(mediaCampaignCityDistributions.cityId, input.id));
          await tx
            .update(providers)
            .set({ headquartersCityId: null, updatedAt: new Date() })
            .where(eq(providers.headquartersCityId, input.id));
          await tx
            .update(suppliers)
            .set({ cityId: null, updatedAt: new Date() })
            .where(eq(suppliers.cityId, input.id));
          await tx
            .update(partners)
            .set({ cityId: null, updatedAt: new Date() })
            .where(eq(partners.cityId, input.id));
          await tx
            .update(stockItems)
            .set({ cityId: null, updatedAt: new Date() })
            .where(eq(stockItems.cityId, input.id));
          await tx.delete(cities).where(eq(cities.id, input.id));
        });
      } else if (input.kind === "regional") {
        const [city, stock] = await Promise.all([
          database
            .select({ id: cities.id })
            .from(cities)
            .where(eq(cities.regionalId, input.id))
            .limit(1),
          database
            .select({ id: stockItems.id })
            .from(stockItems)
            .where(eq(stockItems.regionalId, input.id))
            .limit(1),
        ]);
        if (city[0] || stock[0])
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Esta regional possui cidades ou estoque vinculados. Remova ou transfira esses registros antes de excluir a regional.",
          });
        await database.transaction(async tx => {
          await tx.delete(regionals).where(eq(regionals.id, input.id));
        });
      } else if (input.kind === "store") {
        await database.transaction(async tx => {
          await tx
            .delete(commercialSupervisorStores)
            .where(eq(commercialSupervisorStores.storeId, input.id));
          await tx.delete(stores).where(eq(stores.id, input.id));
        });
      } else if (input.kind === "supplier") {
        const [mediaPoint, operation, actionSupplier, eventSupplier, contract] =
          await Promise.all([
            database
              .select({ id: mediaPoints.id })
              .from(mediaPoints)
              .where(eq(mediaPoints.supplierId, input.id))
              .limit(1),
            database
              .select({ id: tradeOperations.id })
              .from(tradeOperations)
              .where(eq(tradeOperations.supplierId, input.id))
              .limit(1),
            database
              .select({ id: actionSuppliers.id })
              .from(actionSuppliers)
              .where(eq(actionSuppliers.supplierId, input.id))
              .limit(1),
            database
              .select({ id: eventSuppliers.id })
              .from(eventSuppliers)
              .where(eq(eventSuppliers.supplierId, input.id))
              .limit(1),
            database
              .select({ id: supplierContracts.id })
              .from(supplierContracts)
              .where(eq(supplierContracts.supplierId, input.id))
              .limit(1),
          ]);
        if (
          mediaPoint[0] ||
          operation[0] ||
          actionSupplier[0] ||
          eventSupplier[0] ||
          contract[0]
        )
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Este fornecedor possui vínculos operacionais ou financeiros. Inative-o para preservar o histórico.",
          });
        await database.transaction(async tx => {
          await tx.delete(supplierCities).where(eq(supplierCities.supplierId, input.id));
          await tx
            .delete(supplierMediaTypes)
            .where(eq(supplierMediaTypes.supplierId, input.id));
          await tx
            .delete(supplierServiceTypes)
            .where(eq(supplierServiceTypes.supplierId, input.id));
          await tx
            .delete(supplierOfferings)
            .where(eq(supplierOfferings.supplierId, input.id));
          await tx.delete(suppliers).where(eq(suppliers.id, input.id));
        });
      } else if (input.kind === "service") {
        const [mediaPoint, actionService, eventService, child] =
          await Promise.all([
            database
              .select({ id: mediaPoints.id })
              .from(mediaPoints)
              .where(eq(mediaPoints.serviceTypeId, input.id))
              .limit(1),
            database
              .select({ id: actionServices.id })
              .from(actionServices)
              .where(eq(actionServices.serviceTypeId, input.id))
              .limit(1),
            database
              .select({ id: eventServices.id })
              .from(eventServices)
              .where(eq(eventServices.serviceTypeId, input.id))
              .limit(1),
            database
              .select({ id: serviceTypes.id })
              .from(serviceTypes)
              .where(eq(serviceTypes.parentServiceTypeId, input.id))
              .limit(1),
          ]);
        if (mediaPoint[0] || actionService[0] || eventService[0] || child[0])
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Este serviço está vinculado a pontos de mídia ou possui subserviços. Inative-o ou remova os vínculos antes de excluir.",
          });
        await database.transaction(async tx => {
          await tx
            .delete(supplierServiceTypes)
            .where(eq(supplierServiceTypes.serviceTypeId, input.id));
          await tx
            .delete(serviceTypeRelations)
            .where(eq(serviceTypeRelations.serviceTypeId, input.id));
          await tx
            .delete(serviceTypeRelations)
            .where(eq(serviceTypeRelations.subserviceTypeId, input.id));
          await tx.delete(serviceTypes).where(eq(serviceTypes.id, input.id));
        });
      } else if (input.kind === "media") {
        const [mediaPoint, operation, registration, child] =
          await Promise.all([
            database
              .select({ id: mediaPoints.id })
              .from(mediaPoints)
              .where(eq(mediaPoints.mediaTypeId, input.id))
              .limit(1),
            database
              .select({ id: tradeOperations.id })
              .from(tradeOperations)
              .where(eq(tradeOperations.mediaTypeId, input.id))
              .limit(1),
            database
              .select({ id: urbanMediaRegistrations.id })
              .from(urbanMediaRegistrations)
              .where(eq(urbanMediaRegistrations.mediaVariationTypeId, input.id))
              .limit(1),
            database
              .select({ id: mediaTypes.id })
              .from(mediaTypes)
              .where(eq(mediaTypes.parentMediaTypeId, input.id))
              .limit(1),
          ]);
        if (mediaPoint[0] || operation[0] || registration[0] || child[0])
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Este tipo de mídia está vinculado a operações ou registros de mídia. Inative-o para preservar o histórico.",
          });
        await database.delete(mediaTypes).where(eq(mediaTypes.id, input.id));
      }
      if (["city", "regional", "store", "supplier", "service", "media"].includes(input.kind)) {
        await writeAuditLog({
          actorUserId: ctx.user.id,
          entityType: input.kind,
          entityId: input.id,
          action: "delete",
          beforeData: before,
        });
        return { success: true } as const;
      }
      try {
        if (input.kind === "provider") {
          const [linkedRegionals, linkedSuppliers] = await Promise.all([
            database
              .select({ id: regionals.id, name: regionals.name })
              .from(regionals)
              .where(eq(regionals.providerId, input.id)),
            database
              .select({ id: suppliers.id, name: suppliers.displayName })
              .from(suppliers)
              .where(eq(suppliers.providerId, input.id)),
          ]);
          await database.transaction(async tx => {
            if (linkedRegionals.length)
              await tx
                .update(regionals)
                .set({ providerId: null })
                .where(eq(regionals.providerId, input.id));
            if (linkedSuppliers.length)
              await tx
                .update(suppliers)
                .set({ providerId: null, updatedAt: new Date() })
                .where(eq(suppliers.providerId, input.id));
            await tx.delete(providers).where(eq(providers.id, input.id));
          });
          await writeAuditLog({
            actorUserId: ctx.user.id,
            entityType: input.kind,
            entityId: input.id,
            action: "delete",
            beforeData: {
              ...before,
              detachedRegionalIds: linkedRegionals.map(item => item.id),
              detachedSupplierIds: linkedSuppliers.map(item => item.id),
            },
          });
          return { success: true } as const;
        }
        await database.delete(table).where(eq(table.id, input.id));
      } catch (error) {
        const details =
          error instanceof Error ? error.message.toLowerCase() : "";
        const cause =
          typeof error === "object" && error && "cause" in error
            ? (error as { cause?: unknown }).cause
            : null;
        const causeCode =
          typeof cause === "object" && cause && "code" in cause
            ? String((cause as { code?: unknown }).code)
            : "";
        const directCode =
          typeof error === "object" && error && "code" in error
            ? String((error as { code?: unknown }).code)
            : "";
        if (
          directCode === "23503" ||
          causeCode === "23503" ||
          details.includes("foreign key") ||
          details.includes("violates foreign key")
        )
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Este cadastro possui vínculos operacionais e não pode ser excluído. Inative-o para preservar o histórico.",
          });
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Não foi possível excluir este cadastro com segurança. Verifique os vínculos existentes ou inative o registro para preservar o histórico.",
        });
      }
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: input.kind,
        entityId: input.id,
        action: "delete",
        beforeData: before,
      });
      return { success: true } as const;
    }),

  deleteRegistries: protectedProcedure
    .input(
      z.object({
        kind: z.enum([
          "provider",
          "provider_fiscal_entity",
          "regional",
          "city",
          "store",
          "supplier",
          "partner",
          "supervisor",
          "service",
          "product",
          "media",
          "action",
          "event",
          "campaign",
          "campaign_sector",
          "financial_category",
          "supplier_offering",
        ]),
        ids: z.array(z.number().int().positive()).min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const ids = Array.from(new Set(input.ids));
      let deleted = 0;
      await database.transaction(async tx => {
        switch (input.kind) {
          case "provider": {
            await tx.update(regionals).set({ providerId: null }).where(inArray(regionals.providerId, ids));
            await tx.update(suppliers).set({ providerId: null, updatedAt: new Date() }).where(inArray(suppliers.providerId, ids));
            const removed = await tx.delete(providers).where(inArray(providers.id, ids)).returning({ id: providers.id });
            deleted = removed.length;
            break;
          }
          case "provider_fiscal_entity": {
            const removed = await tx.delete(providerFiscalEntities).where(inArray(providerFiscalEntities.id, ids)).returning({ id: providerFiscalEntities.id });
            deleted = removed.length;
            break;
          }
          case "regional": {
            const [city, stock] = await Promise.all([
              tx.select({ id: cities.id }).from(cities).where(inArray(cities.regionalId, ids)).limit(1),
              tx.select({ id: stockItems.id }).from(stockItems).where(inArray(stockItems.regionalId, ids)).limit(1),
            ]);
            if (city[0] || stock[0])
              throw new TRPCError({
                code: "CONFLICT",
                message: "Uma ou mais regionais possuem cidades ou estoque vinculados.",
              });
            const removed = await tx.delete(regionals).where(inArray(regionals.id, ids)).returning({ id: regionals.id });
            deleted = removed.length;
            break;
          }
          case "city": {
            const [store, actionPoint, operation, action, event, mediaPoint] = await Promise.all([
              tx.select({ id: stores.id }).from(stores).where(inArray(stores.cityId, ids)).limit(1),
              tx.select({ id: actionPoints.id }).from(actionPoints).where(inArray(actionPoints.cityId, ids)).limit(1),
              tx.select({ id: tradeOperations.id }).from(tradeOperations).where(inArray(tradeOperations.cityId, ids)).limit(1),
              tx.select({ id: actions.id }).from(actions).where(inArray(actions.cityId, ids)).limit(1),
              tx.select({ id: events.id }).from(events).where(inArray(events.cityId, ids)).limit(1),
              tx.select({ id: mediaPoints.id }).from(mediaPoints).where(inArray(mediaPoints.cityId, ids)).limit(1),
            ]);
            if (store[0] || actionPoint[0] || operation[0] || action[0] || event[0] || mediaPoint[0])
              throw new TRPCError({
                code: "CONFLICT",
                message: "Uma ou mais cidades possuem operações, pontos ou lojas vinculados.",
              });
            await tx.delete(supplierCities).where(inArray(supplierCities.cityId, ids));
            await tx.delete(commercialSupervisorCities).where(inArray(commercialSupervisorCities.cityId, ids));
            await tx.delete(campaignCities).where(inArray(campaignCities.cityId, ids));
            await tx.delete(campaignPromotionCities).where(inArray(campaignPromotionCities.cityId, ids));
            await tx.delete(mediaCampaignCityDistributions).where(inArray(mediaCampaignCityDistributions.cityId, ids));
            await tx.update(providers).set({ headquartersCityId: null, updatedAt: new Date() }).where(inArray(providers.headquartersCityId, ids));
            await tx.update(suppliers).set({ cityId: null, updatedAt: new Date() }).where(inArray(suppliers.cityId, ids));
            await tx.update(partners).set({ cityId: null, updatedAt: new Date() }).where(inArray(partners.cityId, ids));
            await tx.update(stockItems).set({ cityId: null, updatedAt: new Date() }).where(inArray(stockItems.cityId, ids));
            const removed = await tx.delete(cities).where(inArray(cities.id, ids)).returning({ id: cities.id });
            deleted = removed.length;
            break;
          }
          case "store": {
            await tx.delete(commercialSupervisorStores).where(inArray(commercialSupervisorStores.storeId, ids));
            const removed = await tx.delete(stores).where(inArray(stores.id, ids)).returning({ id: stores.id });
            deleted = removed.length;
            break;
          }
          case "supplier": {
            const [mediaPoint, operation, actionSupplier, eventSupplier, contract] = await Promise.all([
              tx.select({ id: mediaPoints.id }).from(mediaPoints).where(inArray(mediaPoints.supplierId, ids)).limit(1),
              tx.select({ id: tradeOperations.id }).from(tradeOperations).where(inArray(tradeOperations.supplierId, ids)).limit(1),
              tx.select({ id: actionSuppliers.id }).from(actionSuppliers).where(inArray(actionSuppliers.supplierId, ids)).limit(1),
              tx.select({ id: eventSuppliers.id }).from(eventSuppliers).where(inArray(eventSuppliers.supplierId, ids)).limit(1),
              tx.select({ id: supplierContracts.id }).from(supplierContracts).where(inArray(supplierContracts.supplierId, ids)).limit(1),
            ]);
            if (mediaPoint[0] || operation[0] || actionSupplier[0] || eventSupplier[0] || contract[0])
              throw new TRPCError({
                code: "CONFLICT",
                message: "Um ou mais fornecedores possuem vínculos operacionais ou financeiros.",
              });
            await tx.delete(supplierCities).where(inArray(supplierCities.supplierId, ids));
            await tx.delete(supplierMediaTypes).where(inArray(supplierMediaTypes.supplierId, ids));
            await tx.delete(supplierServiceTypes).where(inArray(supplierServiceTypes.supplierId, ids));
            await tx.delete(supplierOfferings).where(inArray(supplierOfferings.supplierId, ids));
            const removed = await tx.delete(suppliers).where(inArray(suppliers.id, ids)).returning({ id: suppliers.id });
            deleted = removed.length;
            break;
          }
          case "partner": {
            const removed = await tx.delete(partners).where(inArray(partners.id, ids)).returning({ id: partners.id });
            deleted = removed.length;
            break;
          }
          case "supervisor": {
            const removed = await tx.delete(commercialSupervisors).where(inArray(commercialSupervisors.id, ids)).returning({ id: commercialSupervisors.id });
            deleted = removed.length;
            break;
          }
          case "service": {
            const [mediaPoint, actionService, eventService, child] = await Promise.all([
              tx.select({ id: mediaPoints.id }).from(mediaPoints).where(inArray(mediaPoints.serviceTypeId, ids)).limit(1),
              tx.select({ id: actionServices.id }).from(actionServices).where(inArray(actionServices.serviceTypeId, ids)).limit(1),
              tx.select({ id: eventServices.id }).from(eventServices).where(inArray(eventServices.serviceTypeId, ids)).limit(1),
              tx.select({ id: serviceTypes.id }).from(serviceTypes).where(inArray(serviceTypes.parentServiceTypeId, ids)).limit(1),
            ]);
            if (mediaPoint[0] || actionService[0] || eventService[0] || child[0])
              throw new TRPCError({
                code: "CONFLICT",
                message: "Um ou mais serviços estão vinculados a pontos de mídia ou possuem subserviços.",
              });
            await tx.delete(supplierServiceTypes).where(inArray(supplierServiceTypes.serviceTypeId, ids));
            await tx.delete(serviceTypeRelations).where(inArray(serviceTypeRelations.serviceTypeId, ids));
            await tx.delete(serviceTypeRelations).where(inArray(serviceTypeRelations.subserviceTypeId, ids));
            const removed = await tx.delete(serviceTypes).where(inArray(serviceTypes.id, ids)).returning({ id: serviceTypes.id });
            deleted = removed.length;
            break;
          }
          case "product": {
            const removed = await tx.delete(productTypes).where(inArray(productTypes.id, ids)).returning({ id: productTypes.id });
            deleted = removed.length;
            break;
          }
          case "media": {
            const [mediaPoint, operation, registration, child] = await Promise.all([
              tx.select({ id: mediaPoints.id }).from(mediaPoints).where(inArray(mediaPoints.mediaTypeId, ids)).limit(1),
              tx.select({ id: tradeOperations.id }).from(tradeOperations).where(inArray(tradeOperations.mediaTypeId, ids)).limit(1),
              tx.select({ id: urbanMediaRegistrations.id }).from(urbanMediaRegistrations).where(inArray(urbanMediaRegistrations.mediaVariationTypeId, ids)).limit(1),
              tx.select({ id: mediaTypes.id }).from(mediaTypes).where(inArray(mediaTypes.parentMediaTypeId, ids)).limit(1),
            ]);
            if (mediaPoint[0] || operation[0] || registration[0] || child[0])
              throw new TRPCError({
                code: "CONFLICT",
                message: "Um ou mais tipos de mídia estão vinculados a operações ou registros de mídia.",
              });
            const removed = await tx.delete(mediaTypes).where(inArray(mediaTypes.id, ids)).returning({ id: mediaTypes.id });
            deleted = removed.length;
            break;
          }
          case "action": {
            const removed = await tx.delete(actionTypes).where(inArray(actionTypes.id, ids)).returning({ id: actionTypes.id });
            deleted = removed.length;
            break;
          }
          case "event": {
            const removed = await tx.delete(eventTypes).where(inArray(eventTypes.id, ids)).returning({ id: eventTypes.id });
            deleted = removed.length;
            break;
          }
          case "campaign": {
            const removed = await tx.delete(campaignTypes).where(inArray(campaignTypes.id, ids)).returning({ id: campaignTypes.id });
            deleted = removed.length;
            break;
          }
          case "campaign_sector": {
            const removed = await tx.delete(campaignSectors).where(inArray(campaignSectors.id, ids)).returning({ id: campaignSectors.id });
            deleted = removed.length;
            break;
          }
          case "financial_category": {
            const removed = await tx.delete(financialCategories).where(inArray(financialCategories.id, ids)).returning({ id: financialCategories.id });
            deleted = removed.length;
            break;
          }
          case "supplier_offering": {
            const removed = await tx.delete(supplierOfferings).where(inArray(supplierOfferings.id, ids)).returning({ id: supplierOfferings.id });
            deleted = removed.length;
            break;
          }
        }
      });
      if (!deleted)
        throw new TRPCError({ code: "NOT_FOUND", message: "Nenhum cadastro selecionado foi encontrado." });
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "registry",
        entityId: deleted,
        action: "delete_many",
        beforeData: { kind: input.kind, requestedIds: ids, deleted },
      });
      return { success: true as const, deleted };
    }),

  getTrelloConfiguration: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "settings.read");
    const database = await requireDatabase();
    const [personalBoardRows, settingRows] = await Promise.all([
      database
        .select()
        .from(userTrelloBoards)
        .where(eq(userTrelloBoards.userId, ctx.user.id))
        .limit(1),
      database
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "trello_board_url"))
        .limit(1),
    ]);
    const personalBoard = personalBoardRows[0];
    const setting = settingRows[0];
    const url = personalBoard?.boardUrl ?? setting?.value ?? "";
    return {
      url,
      embedUrl: getTrelloEmbedUrl(url),
      source: personalBoard
        ? ("personal" as const)
        : setting
          ? ("shared" as const)
          : ("none" as const),
    };
  }),

  updateTrelloConfiguration: protectedProcedure
    .input(z.object({ url: z.string().trim().max(2048) }))
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const normalizedUrl = normalizeTrelloUrl(input.url);
      const database = await requireDatabase();
      const [updated] = await database
        .insert(appSettings)
        .values({
          key: "trello_board_url",
          value: normalizedUrl,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: normalizedUrl, updatedAt: new Date() },
        })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "app_setting",
        entityId: 0,
        action: "update_trello",
        afterData: { configured: Boolean(normalizedUrl) },
      });
      return { url: updated.value };
    }),

  clearModuleData: protectedProcedure
    .input(
      z.object({
        modules: z.array(z.enum(["media", "actions", "campaigns", "inventory", "operational_catalogs"])).min(1),
        confirmation: z.literal("APAGAR"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const selected = new Set(input.modules);
      const deletedByModule: Record<string, number> = Object.fromEntries(
        input.modules.map(module => [module, 0])
      );
      await database.transaction(async transaction => {
        const executeDelete = async (module: string, statement: SQL) => {
          const result = await transaction.execute(statement);
          deletedByModule[module] =
            (deletedByModule[module] ?? 0) + Number(result.rowCount ?? 0);
        };
        if (selected.has("media")) {
          await executeDelete("media", sql`DELETE FROM "media_campaign_city_distributions"`);
          await executeDelete("media", sql`DELETE FROM "sound_car_runs"`);
          await executeDelete("media", sql`DELETE FROM "influencer_posts"`);
          await executeDelete("media", sql`DELETE FROM "influencer_group_members"`);
          await executeDelete("media", sql`DELETE FROM "influencer_groups"`);
          await executeDelete("media", sql`DELETE FROM "influencers"`);
          await executeDelete("media", sql`DELETE FROM "documents" WHERE CAST("entityType" AS text) = ANY (ARRAY['media_campaign', 'media_point']::text[])`);
          await executeDelete("media", sql`DELETE FROM "media_campaigns"`);
          await executeDelete("media", sql`DELETE FROM "media_spots"`);
          await executeDelete("media", sql`DELETE FROM "urban_media_registrations"`);
          await executeDelete("media", sql`DELETE FROM "media_points"`);
        }
        if (selected.has("actions")) {
          await executeDelete("actions", sql`DELETE FROM "documents" WHERE CAST("entityType" AS text) = ANY (ARRAY['action', 'event']::text[])`);
          await executeDelete("actions", sql`DELETE FROM "action_debriefs"`);
          await executeDelete("actions", sql`DELETE FROM "action_stock_items"`);
          await executeDelete("actions", sql`DELETE FROM "action_team_members"`);
          await executeDelete("actions", sql`DELETE FROM "action_services"`);
          await executeDelete("actions", sql`DELETE FROM "action_suppliers"`);
          await executeDelete("actions", sql`DELETE FROM "actions"`);
          await executeDelete("actions", sql`DELETE FROM "event_stock_items"`);
          await executeDelete("actions", sql`DELETE FROM "event_team_members"`);
          await executeDelete("actions", sql`DELETE FROM "event_services"`);
          await executeDelete("actions", sql`DELETE FROM "event_suppliers"`);
          await executeDelete("actions", sql`DELETE FROM "events"`);
        }
        if (selected.has("campaigns")) {
          await executeDelete("campaigns", sql`DELETE FROM "campaign_promotion_plans"`);
          await executeDelete("campaigns", sql`DELETE FROM "campaign_promotion_cities"`);
          await executeDelete("campaigns", sql`DELETE FROM "campaign_promotions"`);
          await executeDelete("campaigns", sql`DELETE FROM "campaign_cities"`);
          await executeDelete("campaigns", sql`DELETE FROM "campaign_regionals"`);
          await executeDelete("campaigns", sql`DELETE FROM "trade_campaigns"`);
        }
        if (selected.has("inventory")) {
          await executeDelete("inventory", sql`DELETE FROM "stock_transfers"`);
          await executeDelete("inventory", sql`DELETE FROM "stock_movements"`);
          await executeDelete("inventory", sql`DELETE FROM "stock_balances"`);
          await executeDelete("inventory", sql`DELETE FROM "stock_items"`);
        }
        if (selected.has("operational_catalogs")) {
          await executeDelete("operational_catalogs", sql`DELETE FROM "product_media_types"`);
          await executeDelete("operational_catalogs", sql`DELETE FROM "service_type_relations"`);
          await executeDelete("operational_catalogs", sql`DELETE FROM "supplier_offerings"`);
          await executeDelete("operational_catalogs", sql`DELETE FROM "supplier_service_types"`);
          await executeDelete("operational_catalogs", sql`DELETE FROM "supplier_media_types"`);
          await executeDelete("operational_catalogs", sql`DELETE FROM "commercial_supervisor_cities"`);
          await executeDelete("operational_catalogs", sql`DELETE FROM "commercial_supervisor_stores"`);
          await executeDelete("operational_catalogs", sql`DELETE FROM "action_points"`);
          await executeDelete("operational_catalogs", sql`DELETE FROM "service_types"`);
          await executeDelete("operational_catalogs", sql`DELETE FROM "media_types"`);
          await executeDelete("operational_catalogs", sql`DELETE FROM "product_types"`);
          await executeDelete("operational_catalogs", sql`DELETE FROM "action_types"`);
          await executeDelete("operational_catalogs", sql`DELETE FROM "event_types"`);
          await executeDelete("operational_catalogs", sql`DELETE FROM "campaign_types"`);
          await executeDelete("operational_catalogs", sql`DELETE FROM "campaign_sectors"`);
          await executeDelete("operational_catalogs", sql`DELETE FROM "financial_categories"`);
          await executeDelete("operational_catalogs", sql`DELETE FROM "commercial_supervisors"`);
        }
      });
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "data_center",
        entityId: ctx.user.id,
        action: "clear_modules",
        afterData: { modules: input.modules, deletedByModule },
      });
      return { success: true as const, modules: input.modules, deleted: deletedByModule };
    }),
  getRegional: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.read");
      const database = await requireDatabase();
      const [regional] = await database
        .select()
        .from(regionals)
        .where(eq(regionals.id, input.id));
      return regional ?? null;
    }),
};
