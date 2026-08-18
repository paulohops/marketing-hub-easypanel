import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
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
  productMediaTypes,
  productTypes,
  providers,
  regionals,
  serviceTypes,
  serviceTypeRelations,
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
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { writeAuditLog } from "../audit";
import { storagePut } from "../storage";
import {
  BRANDING_FONT_OPTIONS,
  DEFAULT_APP_BRANDING,
  type AppBranding,
  type BrandingFontId,
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
  document: z.string().trim().min(14).max(32),
  contactName: z.string().trim().max(160).optional(),
  phone: z.string().trim().min(8).max(32),
  email: z.string().trim().email().max(320),
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

const brandingFontIds = BRANDING_FONT_OPTIONS.map(option => option.id) as [
  BrandingFontId,
  ...BrandingFontId[],
];
const brandingInputSchema = z.object({
  appName: z.string().trim().min(2).max(80),
  appSubtitle: z.string().trim().max(80),
  primaryColor: hexColorSchema,
  accentColor: hexColorSchema,
  backgroundColor: hexColorSchema,
  darkBackgroundColor: hexColorSchema.optional(),
  cardColor: hexColorSchema,
  foregroundColor: hexColorSchema,
  fontFamily: z.enum(brandingFontIds),
  faviconUrl: z.string().trim().max(1000).optional(),
});

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function isBrandingFont(value: unknown): value is BrandingFontId {
  return (
    typeof value === "string" &&
    brandingFontIds.includes(value as BrandingFontId)
  );
}

export function normalizeAppBranding(value: unknown): AppBranding {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const appName =
    typeof source.appName === "string" && source.appName.trim().length >= 2
      ? source.appName.trim().slice(0, 80)
      : DEFAULT_APP_BRANDING.appName;
  const appSubtitle =
    typeof source.appSubtitle === "string"
      ? source.appSubtitle.trim().slice(0, 80)
      : DEFAULT_APP_BRANDING.appSubtitle;
  const isLocalLogo =
    typeof source.logoUrl === "string" &&
    source.logoUrl.startsWith("/") &&
    !source.logoUrl.startsWith("//");
  const logoUrl =
    typeof source.logoUrl === "string" &&
    (isLocalLogo || /^https?:\/\//i.test(source.logoUrl))
      ? source.logoUrl
      : DEFAULT_APP_BRANDING.logoUrl;
  return {
    appName,
    appSubtitle,
    primaryColor: isHexColor(source.primaryColor)
      ? source.primaryColor.toUpperCase()
      : DEFAULT_APP_BRANDING.primaryColor,
    accentColor: isHexColor(source.accentColor)
      ? source.accentColor.toUpperCase()
      : DEFAULT_APP_BRANDING.accentColor,
    backgroundColor: isHexColor(source.backgroundColor)
      ? source.backgroundColor.toUpperCase()
      : DEFAULT_APP_BRANDING.backgroundColor,
    darkBackgroundColor: isHexColor(source.darkBackgroundColor)
      ? source.darkBackgroundColor.toUpperCase()
      : DEFAULT_APP_BRANDING.darkBackgroundColor,
    cardColor: isHexColor(source.cardColor)
      ? source.cardColor.toUpperCase()
      : DEFAULT_APP_BRANDING.cardColor,
    foregroundColor: isHexColor(source.foregroundColor)
      ? source.foregroundColor.toUpperCase()
      : DEFAULT_APP_BRANDING.foregroundColor,
    fontFamily: isBrandingFont(source.fontFamily)
      ? source.fontFamily
      : DEFAULT_APP_BRANDING.fontFamily,
    logoUrl,
    faviconUrl:
      typeof source.faviconUrl === "string" &&
      (source.faviconUrl.startsWith("/") ||
        /^https?:\/\//i.test(source.faviconUrl))
        ? source.faviconUrl
        : DEFAULT_APP_BRANDING.faviconUrl,
  };
}

function parseBrandingValue(value: string | null | undefined): AppBranding {
  if (!value) return DEFAULT_APP_BRANDING;
  try {
    return normalizeAppBranding(JSON.parse(value));
  } catch {
    return DEFAULT_APP_BRANDING;
  }
}

function safeBrandingName(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 160) || "logo-aplicativo"
  );
}

const spreadsheetImportSchema = z.object({
  providers: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(160),
        legalName: z.string().trim().max(220).optional(),
        billingCnpj: z.string().trim().max(32).optional(),
        contactName: z.string().trim().max(160).optional(),
        phone: z.string().trim().max(32).optional(),
        email: z.string().trim().email().max(320).optional(),
        website: z.string().trim().max(1000).optional(),
        address: z.string().trim().max(1000).optional(),
      })
    )
    .max(300),
  regionals: z
    .array(
      z.object({
        providerName: z.string().trim().max(160).optional(),
        name: z.string().trim().min(2).max(160),
        code: z
          .string()
          .trim()
          .min(2)
          .max(32)
          .transform(value => value.toUpperCase()),
      })
    )
    .max(300),
  cities: z
    .array(
      z.object({
        regionalCode: z
          .string()
          .trim()
          .min(2)
          .max(32)
          .transform(value => value.toUpperCase()),
        name: z.string().trim().min(2).max(160),
        state: z
          .string()
          .trim()
          .length(2)
          .transform(value => value.toUpperCase()),
        ibgeCode: z.string().trim().max(16).optional(),
        address: z.string().trim().max(1000).optional(),
        zipCode: z.string().trim().max(16).optional(),
        latitude: z.coerce.number().min(-90).max(90).optional(),
        longitude: z.coerce.number().min(-180).max(180).optional(),
        locationNotes: z.string().trim().max(1000).optional(),
      })
    )
    .max(500),
  stores: z
    .array(
      z.object({
        regionalCode: z
          .string()
          .trim()
          .min(2)
          .max(32)
          .transform(value => value.toUpperCase()),
        cityName: z.string().trim().min(2).max(160),
        name: z.string().trim().min(2).max(160),
        code: z
          .string()
          .trim()
          .min(2)
          .max(32)
          .transform(value => value.toUpperCase()),
        address: z.string().trim().max(1000).optional(),
      })
    )
    .max(500),
});

const importModuleIds = IMPORT_MODULES.map(module => module.id) as [ImportModuleId, ...ImportModuleId[]];
const registrySpreadsheetSchema = z.object({
  module: z.enum(importModuleIds),
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000),
});

type RegistryImportRow = Record<string, unknown>;
type ImportDatabase = Awaited<ReturnType<typeof requireDatabase>>;

function importText(row: RegistryImportRow, key: string) {
  const value = row[key];
  return String(value ?? "").trim();
}

function importOptionalText(row: RegistryImportRow, key: string) {
  const value = importText(row, key);
  return value || undefined;
}

function importNumber(row: RegistryImportRow, key: string, label: string, line: number, options: { integer?: boolean } = {}) {
  const value = importOptionalText(row, key);
  if (!value) return undefined;
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || (options.integer && !Number.isInteger(parsed))) throw new TRPCError({ code: "BAD_REQUEST", message: `Linha ${line}: ${label} precisa ser numérico.` });
  return parsed;
}

function importBoolean(row: RegistryImportRow, key: string) {
  const value = importText(row, key).toLocaleLowerCase("pt-BR");
  if (!value) return undefined;
  return ["sim", "s", "true", "1", "yes"].includes(value);
}

function requireImportText(row: RegistryImportRow, key: string, label: string, line: number) {
  const value = importText(row, key);
  if (!value) throw new TRPCError({ code: "BAD_REQUEST", message: `Linha ${line}: informe ${label}.` });
  return value;
}

async function findImportRecord(database: ImportDatabase, table: any, nameColumn: any, value: string) {
  const [record] = await database.select().from(table).where(sql`lower(${nameColumn}) = lower(${value})`).limit(1);
  return record;
}

async function requireImportRecord(database: ImportDatabase, table: any, nameColumn: any, value: string, label: string, line: number) {
  const record = await findImportRecord(database, table, nameColumn, value);
  if (!record) throw new TRPCError({ code: "BAD_REQUEST", message: `Linha ${line}: ${label} \"${value}\" não foi encontrado.` });
  return record;
}

function importEnumValue<T extends string>(value: string, allowed: readonly T[], label: string, line: number) {
  if (!allowed.includes(value as T)) throw new TRPCError({ code: "BAD_REQUEST", message: `Linha ${line}: ${label} deve ser um destes valores: ${allowed.join(", ")}.` });
  return value as T;
}

async function importRegistryRows(database: ImportDatabase, module: ImportModuleId, rows: RegistryImportRow[]) {
  let created = 0;
  let skipped = 0;
  const now = new Date();
  const markDuplicate = (existing: unknown) => { if (existing) skipped += 1; return Boolean(existing); };

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const line = index + 2;
    switch (module) {
      case "providers": {
        const name = requireImportText(row, "name", "Nome", line);
        if (markDuplicate(await findImportRecord(database, providers, providers.name, name))) break;
        await database.insert(providers).values({ name, legalName: importOptionalText(row, "legalName"), billingCnpj: importOptionalText(row, "billingCnpj"), contactName: importOptionalText(row, "contactName"), phone: importOptionalText(row, "phone"), email: importOptionalText(row, "email"), address: importOptionalText(row, "address"), updatedAt: now }).returning({ id: providers.id });
        created += 1;
        break;
      }
      case "regionals": {
        const name = requireImportText(row, "name", "Nome", line);
        const code = requireImportText(row, "code", "Código", line).toUpperCase();
        const providerName = importOptionalText(row, "providerName");
        const provider = providerName ? await requireImportRecord(database, providers, providers.name, providerName, "a Empresa", line) : null;
        if (markDuplicate(await findImportRecord(database, regionals, regionals.code, code))) break;
        await database.insert(regionals).values({ name, code, providerId: provider?.id ?? null, active: true }).returning({ id: regionals.id });
        created += 1;
        break;
      }
      case "cities": {
        const regionalCode = requireImportText(row, "regionalCode", "Código da Regional", line).toUpperCase();
        const regional = await requireImportRecord(database, regionals, regionals.code, regionalCode, "a Regional", line);
        const name = requireImportText(row, "name", "Nome", line);
        const state = requireImportText(row, "state", "UF", line).toUpperCase();
        if (state.length !== 2) throw new TRPCError({ code: "BAD_REQUEST", message: `Linha ${line}: a UF precisa ter 2 letras.` });
        const [existing] = await database.select({ id: cities.id }).from(cities).where(and(eq(cities.regionalId, regional.id), sql`lower(${cities.name}) = lower(${name})`)).limit(1);
        if (markDuplicate(existing)) break;
        await database.insert(cities).values({ regionalId: regional.id, name, state, ibgeCode: importOptionalText(row, "ibgeCode"), address: importOptionalText(row, "address"), zipCode: importOptionalText(row, "zipCode"), latitude: importNumber(row, "latitude", "Latitude", line)?.toString(), longitude: importNumber(row, "longitude", "Longitude", line)?.toString(), locationNotes: importOptionalText(row, "locationNotes"), active: true, updatedAt: now }).returning({ id: cities.id });
        created += 1;
        break;
      }
      case "stores": {
        const regionalCode = requireImportText(row, "regionalCode", "Código da Regional", line).toUpperCase();
        const regional = await requireImportRecord(database, regionals, regionals.code, regionalCode, "a Regional", line);
        const cityName = requireImportText(row, "cityName", "Cidade", line);
        const [city] = await database.select().from(cities).where(and(eq(cities.regionalId, regional.id), sql`lower(${cities.name}) = lower(${cityName})`)).limit(1);
        if (!city) throw new TRPCError({ code: "BAD_REQUEST", message: `Linha ${line}: a Cidade \"${cityName}\" não foi encontrada na Regional ${regionalCode}.` });
        const name = requireImportText(row, "name", "Nome", line);
        const code = requireImportText(row, "code", "Código", line).toUpperCase();
        if (markDuplicate(await findImportRecord(database, stores, stores.code, code))) break;
        await database.insert(stores).values({ cityId: city.id, name, code, address: importOptionalText(row, "address"), referencePoint: importOptionalText(row, "referencePoint"), zipCode: importOptionalText(row, "zipCode"), phone: importOptionalText(row, "phone"), email: importOptionalText(row, "email"), openingHours: importOptionalText(row, "openingHours"), latitude: importNumber(row, "latitude", "Latitude", line)?.toString(), longitude: importNumber(row, "longitude", "Longitude", line)?.toString(), active: true, updatedAt: now }).returning({ id: stores.id });
        created += 1;
        break;
      }
      case "partners": {
        const name = requireImportText(row, "name", "Nome", line);
        if (markDuplicate(await findImportRecord(database, partners, partners.name, name))) break;
        const cityName = importOptionalText(row, "cityName");
        const city = cityName ? await findImportRecord(database, cities, cities.name, cityName) : null;
        const partnershipType = importOptionalText(row, "partnershipType");
        await database.insert(partners).values({ cityId: city?.id ?? null, name, legalName: importOptionalText(row, "legalName"), document: importOptionalText(row, "document"), contactName: importOptionalText(row, "contactName"), phone: importOptionalText(row, "phone"), email: importOptionalText(row, "email"), partnershipType: partnershipType ? importEnumValue(partnershipType, paymentKinds, "Tipo de parceria", line) : undefined, paymentMethod: importOptionalText(row, "paymentMethod"), paymentRecurrence: importOptionalText(row, "paymentRecurrence"), hasContract: importBoolean(row, "hasContract") ?? false, active: true }).returning({ id: partners.id });
        created += 1;
        break;
      }
      case "suppliers": {
        const displayName = requireImportText(row, "displayName", "Nome de exibição", line);
        const document = requireImportText(row, "document", "Documento", line);
        const phone = requireImportText(row, "phone", "Telefone", line);
        const email = requireImportText(row, "email", "E-mail", line);
        if (markDuplicate(await findImportRecord(database, suppliers, suppliers.document, document))) break;
        const providerName = importOptionalText(row, "providerName");
        const cityName = importOptionalText(row, "cityName");
        const provider = providerName ? await requireImportRecord(database, providers, providers.name, providerName, "a Empresa", line) : null;
        const city = cityName ? await requireImportRecord(database, cities, cities.name, cityName, "a Cidade", line) : null;
        const partnershipType = importOptionalText(row, "partnershipType");
        await database.insert(suppliers).values({ providerId: provider?.id ?? null, cityId: city?.id ?? null, displayName, address: importOptionalText(row, "address"), legalName: importOptionalText(row, "legalName"), document, contactName: importOptionalText(row, "contactName"), phone, email, mainService: importOptionalText(row, "mainService"), partnershipType: partnershipType ? importEnumValue(partnershipType, paymentKinds, "Tipo de parceria", line) : undefined, paymentMethod: importOptionalText(row, "paymentMethod"), paymentRecurrence: importOptionalText(row, "paymentRecurrence"), pixKey: importOptionalText(row, "pixKey"), paymentDay: importNumber(row, "paymentDay", "Dia de pagamento", line, { integer: true }), paymentBarterValue: importNumber(row, "paymentBarterValue", "Valor de permuta", line)?.toString(), paymentBarterService: importOptionalText(row, "paymentBarterService"), paymentNotes: importOptionalText(row, "paymentNotes"), contractStartsOn: importOptionalText(row, "contractStartsOn") ?? null, contractEndsOn: importOptionalText(row, "contractEndsOn") ?? null, hasContract: importBoolean(row, "hasContract") ?? false, active: true, updatedAt: now }).returning({ id: suppliers.id });
        created += 1;
        break;
      }
      case "mediaTypes": {
        const name = requireImportText(row, "name", "Nome", line);
        if (markDuplicate(await findImportRecord(database, mediaTypes, mediaTypes.name, name))) break;
        const parentName = importOptionalText(row, "parentMediaTypeName");
        const parent = parentName ? await requireImportRecord(database, mediaTypes, mediaTypes.name, parentName, "o Tipo de mídia pai", line) : null;
        const operationCategory = importOptionalText(row, "operationCategory") ?? "graphics";
        await database.insert(mediaTypes).values({ name, operationCategory: importEnumValue(operationCategory, mediaOperationCategories, "Categoria de mídia", line), parentMediaTypeId: parent?.id ?? null, active: true }).returning({ id: mediaTypes.id });
        created += 1;
        break;
      }
      case "serviceTypes": {
        const name = requireImportText(row, "name", "Nome", line);
        if (markDuplicate(await findImportRecord(database, serviceTypes, serviceTypes.name, name))) break;
        const mediaName = importOptionalText(row, "mediaTypeName");
        const parentName = importOptionalText(row, "parentServiceTypeName");
        const media = mediaName ? await requireImportRecord(database, mediaTypes, mediaTypes.name, mediaName, "o Tipo de mídia", line) : null;
        const parent = parentName ? await requireImportRecord(database, serviceTypes, serviceTypes.name, parentName, "o Tipo de serviço pai", line) : null;
        await database.insert(serviceTypes).values({ name, mediaTypeId: media?.id ?? null, parentServiceTypeId: parent?.id ?? null, active: true }).returning({ id: serviceTypes.id });
        created += 1;
        break;
      }
      case "productTypes": {
        const name = requireImportText(row, "name", "Nome", line);
        if (markDuplicate(await findImportRecord(database, productTypes, productTypes.name, name))) break;
        await database.insert(productTypes).values({ name, description: importOptionalText(row, "description"), active: true, updatedAt: now }).returning({ id: productTypes.id });
        created += 1;
        break;
      }
      case "actionTypes":
      case "eventTypes":
      case "campaignTypes":
      case "campaignSectors":
      case "financialCategories": {
        const tableMap = { actionTypes, eventTypes, campaignTypes, campaignSectors, financialCategories } as const;
        const table = tableMap[module];
        const name = requireImportText(row, "name", "Nome", line);
        if (markDuplicate(await findImportRecord(database, table, table.name, name))) break;
        const values = { name, active: true, ...(module === "financialCategories" ? { description: importOptionalText(row, "description"), updatedAt: now } : {}) };
        await database.insert(table).values(values as never).returning({ id: table.id });
        created += 1;
        break;
      }
      case "supplierOfferings": {
        const supplierName = requireImportText(row, "supplierName", "Fornecedor", line);
        const supplier = await requireImportRecord(database, suppliers, suppliers.displayName, supplierName, "o Fornecedor", line);
        const kind = importEnumValue(requireImportText(row, "kind", "Categoria da oferta", line), ["product", "service", "media", "action", "event", "other"] as const, "Categoria da oferta", line);
        const name = requireImportText(row, "name", "Nome", line);
        if (markDuplicate((await database.select({ id: supplierOfferings.id }).from(supplierOfferings).where(and(eq(supplierOfferings.supplierId, supplier.id), eq(supplierOfferings.kind, kind), sql`lower(${supplierOfferings.name}) = lower(${name})`)).limit(1))[0])) break;
        const mediaName = importOptionalText(row, "mediaTypeName");
        const serviceName = importOptionalText(row, "serviceTypeName");
        const productName = importOptionalText(row, "productTypeName");
        const media = mediaName ? await requireImportRecord(database, mediaTypes, mediaTypes.name, mediaName, "o Tipo de mídia", line) : null;
        const service = serviceName ? await requireImportRecord(database, serviceTypes, serviceTypes.name, serviceName, "o Tipo de serviço", line) : null;
        const product = productName ? await requireImportRecord(database, productTypes, productTypes.name, productName, "o Tipo de produto", line) : null;
        const unitPrice = importNumber(row, "unitPrice", "Preço unitário", line);
        if (unitPrice == null) throw new TRPCError({ code: "BAD_REQUEST", message: `Linha ${line}: informe Preço unitário.` });
        await database.insert(supplierOfferings).values({ supplierId: supplier.id, kind, mediaTypeId: media?.id ?? null, serviceTypeId: service?.id ?? null, productTypeId: product?.id ?? null, name, unit: importOptionalText(row, "unit") ?? "unidade", unitPrice: unitPrice.toFixed(2), averageUnitPrice: importNumber(row, "averageUnitPrice", "Preço médio unitário", line)?.toFixed(2) ?? null, notes: importOptionalText(row, "notes"), active: true, updatedAt: now }).returning({ id: supplierOfferings.id });
        created += 1;
        break;
      }
      case "commercialSupervisors": {
        const name = requireImportText(row, "name", "Nome", line);
        if (markDuplicate(await findImportRecord(database, commercialSupervisors, commercialSupervisors.name, name))) break;
        await database.insert(commercialSupervisors).values({ userId: null, name, email: importOptionalText(row, "email"), phone: importOptionalText(row, "phone"), active: true, updatedAt: now }).returning({ id: commercialSupervisors.id });
        created += 1;
        break;
      }
      case "actionPoints": {
        const cityName = requireImportText(row, "cityName", "Cidade", line);
        const city = await requireImportRecord(database, cities, cities.name, cityName, "a Cidade", line);
        const name = requireImportText(row, "name", "Nome", line);
        const [existing] = await database.select({ id: actionPoints.id }).from(actionPoints).where(and(eq(actionPoints.cityId, city.id), sql`lower(${actionPoints.name}) = lower(${name})`)).limit(1);
        if (markDuplicate(existing)) break;
        await database.insert(actionPoints).values({ cityId: city.id, name, address: importOptionalText(row, "address"), latitude: importNumber(row, "latitude", "Latitude", line)?.toString() ?? null, longitude: importNumber(row, "longitude", "Longitude", line)?.toString() ?? null, notes: importOptionalText(row, "notes"), active: true, updatedAt: now }).returning({ id: actionPoints.id });
        created += 1;
        break;
      }
    }
  }
  return { created, skipped };
}

export const settingsRouter = router({
  branding: publicProcedure.query(async () => {
    const database = await getDb();
    if (!database) return DEFAULT_APP_BRANDING;
    const [setting] = await database
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "app_branding"))
      .limit(1);
    return parseBrandingValue(setting?.value);
  }),

  updateBranding: protectedProcedure
    .input(brandingInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [currentSetting] = await database
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "app_branding"))
        .limit(1);
      let current: AppBranding = DEFAULT_APP_BRANDING;
      if (currentSetting) current = parseBrandingValue(currentSetting.value);
      const next = normalizeAppBranding({ ...current, ...input });
      const [updated] = await database
        .insert(appSettings)
        .values({
          key: "app_branding",
          value: JSON.stringify(next),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: JSON.stringify(next), updatedAt: new Date() },
        })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "app_setting",
        entityId: 0,
        action: "update_branding",
        afterData: { ...next, logoUrl: Boolean(next.logoUrl) },
      });
      return parseBrandingValue(updated.value);
    }),

  uploadAppLogo: protectedProcedure
    .input(
      z.object({
        originalName: z.string().trim().min(1).max(255),
        mimeType: z.enum(imageMimeTypes),
        dataBase64: z.string().min(1).max(4_200_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (!bytes.length || bytes.length > 3 * 1024 * 1024)
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "A logo do aplicativo deve ter até 3 MB.",
        });
      const stored = await storagePut(
        `trade/app-branding/logo-${Date.now()}-${safeBrandingName(input.originalName)}`,
        bytes,
        input.mimeType
      );
      const [currentSetting] = await database
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "app_branding"))
        .limit(1);
      const current = currentSetting
        ? parseBrandingValue(currentSetting.value)
        : DEFAULT_APP_BRANDING;
      const next = { ...current, logoUrl: stored.url };
      const [updated] = await database
        .insert(appSettings)
        .values({
          key: "app_branding",
          value: JSON.stringify(next),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: JSON.stringify(next), updatedAt: new Date() },
        })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "app_setting",
        entityId: 0,
        action: "upload_branding_logo",
        afterData: { storageKey: stored.key },
      });
      return parseBrandingValue(updated.value);
    }),

  uploadAppFavicon: protectedProcedure
    .input(
      z.object({
        originalName: z.string().trim().min(1).max(255),
        mimeType: z.enum([
          "image/png",
          "image/x-icon",
          "image/vnd.microsoft.icon",
          "image/svg+xml",
        ]),
        dataBase64: z.string().min(1).max(1_500_000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (!bytes.length || bytes.length > 1024 * 1024)
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "O favicon deve ter até 1 MB.",
        });
      const stored = await storagePut(
        `trade/app-branding/favicon-${Date.now()}-${safeBrandingName(input.originalName)}`,
        bytes,
        input.mimeType
      );
      const [currentSetting] = await database
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "app_branding"))
        .limit(1);
      const current = currentSetting
        ? parseBrandingValue(currentSetting.value)
        : DEFAULT_APP_BRANDING;
      const next = { ...current, faviconUrl: stored.url };
      const [updated] = await database
        .insert(appSettings)
        .values({
          key: "app_branding",
          value: JSON.stringify(next),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: JSON.stringify(next), updatedAt: new Date() },
        })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "app_setting",
        entityId: 0,
        action: "upload_branding_favicon",
        afterData: { storageKey: stored.key },
      });
      return parseBrandingValue(updated.value);
    }),

  resetBranding: protectedProcedure.mutation(async ({ ctx }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [updated] = await database
      .insert(appSettings)
      .values({
        key: "app_branding",
        value: JSON.stringify(DEFAULT_APP_BRANDING),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: JSON.stringify(DEFAULT_APP_BRANDING),
          updatedAt: new Date(),
        },
      })
      .returning();
    await writeAuditLog({
      actorUserId: ctx.user.id,
      entityType: "app_setting",
      entityId: 0,
      action: "reset_branding",
      afterData: { restoredDefaults: true },
    });
    return parseBrandingValue(updated.value);
  }),

  system: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "settings.read");
    const database = await requireDatabase();
    const [setting] = await database
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "app_system"))
      .limit(1);
    const source = setting?.value
      ? (JSON.parse(setting.value) as Record<string, unknown>)
      : {};
    return {
      smtpHost: typeof source.smtpHost === "string" ? source.smtpHost : "",
      smtpPort: typeof source.smtpPort === "string" ? source.smtpPort : "587",
      smtpUser: typeof source.smtpUser === "string" ? source.smtpUser : "",
      smtpPassword: "",
      smtpFrom: typeof source.smtpFrom === "string" ? source.smtpFrom : "",
      notificationEmailEnabled: source.notificationEmailEnabled === true,
      openAiApiKey: source.openAiApiKey ? "********" : "",
      googleMapsApiKey: source.googleMapsApiKey ? "********" : "",
      googleClientId:
        typeof source.googleClientId === "string" ? source.googleClientId : "",
      googleClientSecret: source.googleClientSecret ? "********" : "",
      googleRedirectUri:
        typeof source.googleRedirectUri === "string"
          ? source.googleRedirectUri
          : "",
      googleOAuthEnabled: source.googleOAuthEnabled === true,
      emailLoginCodeEnabled: source.emailLoginCodeEnabled === true,
    };
  }),

  updateSystem: protectedProcedure
    .input(
      z.object({
        smtpHost: z.string().trim().max(255),
        smtpPort: z.string().trim().max(8),
        smtpUser: z.string().trim().max(255),
        smtpPassword: z.string().max(500).optional(),
        smtpFrom: z.string().trim().email().or(z.literal("")),
        notificationEmailEnabled: z.boolean(),
        openAiApiKey: z.string().max(500).optional(),
        googleMapsApiKey: z.string().max(500).optional(),
        googleClientId: z.string().trim().max(500).optional(),
        googleClientSecret: z.string().max(500).optional(),
        googleRedirectUri: z.string().trim().max(1000).optional(),
        googleOAuthEnabled: z.boolean(),
        emailLoginCodeEnabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [currentSetting] = await database
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "app_system"))
        .limit(1);
      let current: Record<string, unknown> = {};
      if (currentSetting?.value) {
        try {
          current = JSON.parse(currentSetting.value) as Record<string, unknown>;
        } catch {
          current = {};
        }
      }
      const next = {
        ...current,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpUser: input.smtpUser,
        smtpFrom: input.smtpFrom,
        notificationEmailEnabled: input.notificationEmailEnabled,
        ...(input.smtpPassword ? { smtpPassword: input.smtpPassword } : {}),
        ...(input.openAiApiKey && input.openAiApiKey !== "********"
          ? { openAiApiKey: input.openAiApiKey }
          : {}),
        ...(input.googleMapsApiKey && input.googleMapsApiKey !== "********"
          ? { googleMapsApiKey: input.googleMapsApiKey }
          : {}),
        ...(input.googleClientId
          ? { googleClientId: input.googleClientId }
          : {}),
        ...(input.googleClientSecret && input.googleClientSecret !== "********"
          ? { googleClientSecret: input.googleClientSecret }
          : {}),
        ...(input.googleRedirectUri
          ? { googleRedirectUri: input.googleRedirectUri }
          : {}),
        googleOAuthEnabled: input.googleOAuthEnabled,
        emailLoginCodeEnabled: input.emailLoginCodeEnabled,
      };
      const [updated] = await database
        .insert(appSettings)
        .values({
          key: "app_system",
          value: JSON.stringify(next),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: JSON.stringify(next), updatedAt: new Date() },
        })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "app_setting",
        entityId: 0,
        action: "update_system_settings",
        afterData: {
          smtpHost: next.smtpHost,
          smtpFrom: next.smtpFrom,
          notificationEmailEnabled: next.notificationEmailEnabled,
          hasApiKeys: Boolean(next.openAiApiKey || next.googleMapsApiKey),
        },
      });
      return {
        smtpHost: String(next.smtpHost ?? ""),
        smtpPort: String(next.smtpPort ?? "587"),
        smtpUser: String(next.smtpUser ?? ""),
        smtpPassword: "",
        smtpFrom: String(next.smtpFrom ?? ""),
        notificationEmailEnabled: next.notificationEmailEnabled === true,
        openAiApiKey: next.openAiApiKey ? "********" : "",
        googleMapsApiKey: next.googleMapsApiKey ? "********" : "",
        googleClientId: String(next.googleClientId ?? ""),
        googleClientSecret: next.googleClientSecret ? "********" : "",
        googleRedirectUri: String(next.googleRedirectUri ?? ""),
        googleOAuthEnabled: next.googleOAuthEnabled === true,
        emailLoginCodeEnabled: next.emailLoginCodeEnabled === true,
      };
    }),

  overview: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "settings.read");
    const database = await requireDatabase();
    const [
      providerRows,
      regionalRows,
      cityRows,
      supplierRows,
      storeRows,
      partnerRows,
      serviceRows,
      serviceRelationRows,
      mediaTypeRows,
      productTypeRows,
      actionTypeRows,
      eventTypeRows,
      campaignTypeRows,
      campaignSectorRows,
      financialCategoryRows,
      supplierOfferingRows,
      supervisorRows,
      actionPointRows,
      supervisorStoreRows,
      supervisorCityRows,
      productMediaRows,
      actionRows,
      eventRows,
      mediaPointRows,
      mediaCampaignRows,
      actionSupplierRows,
      eventSupplierRows,
      providerDocumentRows,
    ] = await Promise.all([
      database
        .select()
        .from(providers)
        .orderBy(asc(providers.name))
        .catch(() => []),
      database
        .select()
        .from(regionals)
        .orderBy(asc(regionals.name))
        .catch(() => []),
      database
        .select()
        .from(cities)
        .orderBy(asc(cities.name))
        .catch(() => []),
      database
        .select()
        .from(suppliers)
        .orderBy(asc(suppliers.displayName))
        .catch(() => []),
      database
        .select()
        .from(stores)
        .orderBy(asc(stores.name))
        .catch(() => []),
      database
        .select()
        .from(partners)
        .orderBy(asc(partners.name))
        .catch(() => []),
      database
        .select()
        .from(serviceTypes)
        .orderBy(asc(serviceTypes.name))
        .catch(() => []),
      database
        .select()
        .from(serviceTypeRelations)
        .catch(() => []),
      database
        .select()
        .from(mediaTypes)
        .orderBy(asc(mediaTypes.name))
        .catch(() => []),
      database
        .select()
        .from(productTypes)
        .orderBy(asc(productTypes.name))
        .catch(() => []),
      database
        .select()
        .from(actionTypes)
        .orderBy(asc(actionTypes.name))
        .catch(() => []),
      database
        .select()
        .from(eventTypes)
        .orderBy(asc(eventTypes.name))
        .catch(() => []),
      database
        .select()
        .from(campaignTypes)
        .orderBy(asc(campaignTypes.name))
        .catch(() => []),
      database
        .select()
        .from(campaignSectors)
        .orderBy(asc(campaignSectors.name))
        .catch(() => []),
      database
        .select()
        .from(financialCategories)
        .orderBy(asc(financialCategories.name))
        .catch(() => []),
      database
        .select()
        .from(supplierOfferings)
        .orderBy(asc(supplierOfferings.name))
        .catch(() => []),
      database
        .select()
        .from(commercialSupervisors)
        .orderBy(asc(commercialSupervisors.name))
        .catch(() => []),
      database
        .select()
        .from(actionPoints)
        .orderBy(asc(actionPoints.name))
        .catch(() => []),
      database
        .select()
        .from(commercialSupervisorStores)
        .catch(() => []),
      database
        .select()
        .from(commercialSupervisorCities)
        .catch(() => []),
      database
        .select()
        .from(productMediaTypes)
        .catch(() => []),
      database
        .select({ id: actions.id, name: actions.name, cityId: actions.cityId })
        .from(actions)
        .catch(() => []),
      database
        .select({ id: events.id, name: events.name, cityId: events.cityId })
        .from(events)
        .catch(() => []),
      database
        .select({
          id: mediaPoints.id,
          name: mediaPoints.name,
          cityId: mediaPoints.cityId,
          supplierId: mediaPoints.supplierId,
        })
        .from(mediaPoints)
        .catch(() => []),
      database
        .select({ mediaPointId: mediaCampaigns.mediaPointId })
        .from(mediaCampaigns)
        .catch(() => []),
      database
        .select({
          actionId: actionSuppliers.actionId,
          supplierId: actionSuppliers.supplierId,
        })
        .from(actionSuppliers)
        .catch(() => []),
      database
        .select({
          eventId: eventSuppliers.eventId,
          supplierId: eventSuppliers.supplierId,
        })
        .from(eventSuppliers)
        .catch(() => []),
      database
        .select()
        .from(providerDocuments)
        .orderBy(asc(providerDocuments.createdAt))
        .catch(() => []),
    ]);
    return {
      providers: providerRows,
      regionals: regionalRows,
      cities: cityRows,
      suppliers: supplierRows,
      stores: storeRows,
      partners: partnerRows,
      serviceTypes: serviceRows,
      serviceTypeRelations: serviceRelationRows,
      mediaTypes: mediaTypeRows,
      productTypes: productTypeRows,
      actionTypes: actionTypeRows,
      eventTypes: eventTypeRows,
      campaignTypes: campaignTypeRows,
      campaignSectors: campaignSectorRows,
      financialCategories: financialCategoryRows,
      supplierOfferings: supplierOfferingRows,
      commercialSupervisors: supervisorRows,
      actionPoints: actionPointRows,
      commercialSupervisorStores: supervisorStoreRows,
      commercialSupervisorCities: supervisorCityRows,
      productMediaTypes: productMediaRows,
      providerDocuments: providerDocumentRows,
      operationalFootprint: {
        actions: actionRows,
        events: eventRows,
        mediaPoints: mediaPointRows,
        mediaCampaigns: mediaCampaignRows,
        actionSuppliers: actionSupplierRows,
        eventSuppliers: eventSupplierRows,
      },
    };
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
      const [created] = await database
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
      const document = normalizeCnpj(input.document);
      if (document.length !== 14)
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
      const [sameDocument] = await database
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(
          sql`regexp_replace(coalesce(${suppliers.document}, ''), '[^0-9]', '', 'g') = ${document}`
        )
        .limit(1);
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
            phone: input.phone,
            email: input.email,
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
      const [updated] = await database
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
      const document = normalizeCnpj(input.document);
      if (document.length !== 14)
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
            phone: input.phone,
            email: input.email,
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

  importRegistrySpreadsheet: protectedProcedure
    .input(registrySpreadsheetSchema)
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const result = await importRegistryRows(database, input.module, input.rows);
      await writeAuditLog({ actorUserId: ctx.user.id, entityType: "registry_import", entityId: ctx.user.id, action: "import", afterData: { module: input.module, ...result } });
      return { module: input.module, ...result };
    }),

  importOperationalSpreadsheet: protectedProcedure
    .input(spreadsheetImportSchema)
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [providerRows, regionalRows, cityRows, storeRows] =
        await Promise.all([
          database.select().from(providers),
          database.select().from(regionals),
          database.select().from(cities),
          database.select().from(stores),
        ]);
      const providerByName = new Map(
        providerRows.map(row => [normalizeSpreadsheetKey(row.name), row])
      );
      const regionalByCode = new Map(
        regionalRows.map(row => [row.code.toUpperCase(), row])
      );
      const cityByRegionalAndName = new Map(
        cityRows.map(row => [
          `${row.regionalId}:${normalizeSpreadsheetKey(row.name)}`,
          row,
        ])
      );
      const storeByCode = new Map(
        storeRows.map(row => [row.code.toUpperCase(), row])
      );
      const created = { providers: 0, regionals: 0, cities: 0, stores: 0 };

      await database.transaction(async transaction => {
        for (const row of input.providers) {
          const key = normalizeSpreadsheetKey(row.name);
          if (providerByName.has(key)) continue;
          const billingCnpj = row.billingCnpj
            ? normalizeCnpj(row.billingCnpj)
            : null;
          const website = normalizeWebsiteUrl(row.website);
          if (billingCnpj && billingCnpj.length !== 14)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `CNPJ inválido para a empresa ${row.name}.`,
            });
          const [provider] = await transaction
            .insert(providers)
            .values({
              ...row,
              website,
              billingCnpj,
              legalName: row.legalName || null,
              contactName: row.contactName || null,
              phone: row.phone || null,
              email: row.email || null,
              address: row.address || null,
            })
            .returning();
          providerByName.set(key, provider);
          created.providers += 1;
        }
        for (const row of input.regionals) {
          if (regionalByCode.has(row.code)) continue;
          const provider = row.providerName
            ? providerByName.get(normalizeSpreadsheetKey(row.providerName))
            : undefined;
          if (row.providerName && !provider)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `A empresa "${row.providerName}" da regional ${row.code} não foi localizada.`,
            });
          const [regional] = await transaction
            .insert(regionals)
            .values({
              providerId: provider?.id ?? null,
              name: row.name,
              code: row.code,
            })
            .returning();
          regionalByCode.set(row.code, regional);
          created.regionals += 1;
        }
        for (const row of input.cities) {
          const regional = regionalByCode.get(row.regionalCode);
          if (!regional)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `A regional ${row.regionalCode} da cidade ${row.name} não foi localizada.`,
            });
          const key = `${regional.id}:${normalizeSpreadsheetKey(row.name)}`;
          if (cityByRegionalAndName.has(key)) continue;
          const [city] = await transaction
            .insert(cities)
            .values({
              regionalId: regional.id,
              name: row.name,
              state: row.state,
              ibgeCode: row.ibgeCode || null,
              address: row.address || null,
              zipCode: row.zipCode || null,
              latitude: row.latitude?.toFixed(7) ?? null,
              longitude: row.longitude?.toFixed(7) ?? null,
              locationNotes: row.locationNotes || null,
            })
            .returning();
          cityByRegionalAndName.set(key, city);
          created.cities += 1;
        }
        for (const row of input.stores) {
          if (storeByCode.has(row.code)) continue;
          const regional = regionalByCode.get(row.regionalCode);
          const city = regional
            ? cityByRegionalAndName.get(
                `${regional.id}:${normalizeSpreadsheetKey(row.cityName)}`
              )
            : undefined;
          if (!city)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `A cidade ${row.cityName} da regional ${row.regionalCode} da loja ${row.name} não foi localizada.`,
            });
          const [store] = await transaction
            .insert(stores)
            .values({
              cityId: city.id,
              name: row.name,
              code: row.code,
              address: row.address || null,
            })
            .returning();
          storeByCode.set(row.code, store);
          created.stores += 1;
        }
      });
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "operational_spreadsheet",
        entityId: 0,
        action: "import",
        afterData: {
          created,
          received: Object.fromEntries(
            Object.entries(input).map(([key, rows]) => [key, rows.length])
          ),
        },
      });
      return {
        created,
        skipped: {
          providers: input.providers.length - created.providers,
          regionals: input.regionals.length - created.regionals,
          cities: input.cities.length - created.cities,
          stores: input.stores.length - created.stores,
        },
      };
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
});
