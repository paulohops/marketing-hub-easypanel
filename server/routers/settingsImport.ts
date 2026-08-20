import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  actionPoints,
  actionTypes,
  campaignSectors,
  campaignTypes,
  cities,
  commercialSupervisors,
  eventTypes,
  financialCategories,
  mediaTypes,
  productTypes,
  providers,
  regionals,
  serviceTypes,
  stores,
  partners,
  supplierOfferings,
  suppliers,
} from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { getDb } from "../db";
import { protectedProcedure } from "../_core/trpc";
import { writeAuditLog } from "../audit";
import { IMPORT_MODULES, type ImportModuleId } from "../../shared/import-modules";
import { normalizeCnpj, normalizeWebsiteUrl } from "./settingsRegistry";

const paymentKinds = ["paid", "barter", "mixed"] as const;
const mediaOperationCategories = [
  "graphics",
  "audio_video",
  "leafleting",
  "sound_car",
  "influencers",
] as const;

async function requireDatabase() {
  const database = await getDb();
  if (!database)
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Banco de dados indisponível.",
    });
  return database;
}

export function normalizeSpreadsheetKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
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



export const settingsImportProcedures = {
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
};
