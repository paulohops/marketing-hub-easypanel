import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { appSettings, auditLogs, cities, documents, influencerGroupMembers, influencerGroups, influencerPosts, influencers, invoices, mediaCampaignCityDistributions, mediaCampaignNeighborhoodDistributions, mediaCampaignSchedules, mediaCampaigns, mediaPoints, mediaSpots, mediaTypes, neighborhoods, mediaServiceCatalog, payments, productTypes, regionals, serviceSubservices, serviceTypeRelations, serviceTypes, soundCarRuns, subserviceTypes, supplierCities, supplierContracts, supplierMediaTypes, supplierOfferings, supplierServiceTypes, suppliers, tradeCampaigns, urbanMediaRegistrations, users } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";
import { ENV } from "../_core/env";

async function requireDatabase() { const database = await getDb(); if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." }); return database; }

const partnershipKinds = ["paid", "barter", "mixed"] as const;
const channelKinds = ["standard", "external"] as const;
const mediaOperationCategories = ["graphics", "audio_video", "leafleting", "sound_car", "influencers"] as const;
const replacementFrequencies = ["weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual", "custom"] as const;
const spotMimeTypes = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "video/mp4", "video/webm"] as const;
const mediaEvidenceMimeTypes = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"] as const;
const safeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_");
const traditionalScheduleSchema = z.object({
  programName: z.string().trim().min(2).max(180),
  weekday: z.number().int().min(0).max(6).nullable().optional(),
  specificDate: z.string().date().nullable().optional(),
  neighborhoodId: z.number().int().positive().nullable().optional(),
  startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  notes: z.string().trim().max(1000).optional(),
}).superRefine((value, context) => {
  const hasWeekday = value.weekday !== null && value.weekday !== undefined;
  const hasSpecificDate = Boolean(value.specificDate);
  if (hasWeekday === hasSpecificDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Informe um dia da semana ou uma data específica, mas não os dois.", path: ["weekday"] });
  }
  if (value.endsAt <= value.startsAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "O horário final deve ser posterior ao horário inicial.", path: ["endsAt"] });
  }
});

function canTraditionalServiceRunConcurrently(name: string | null | undefined) {
  return /entrevista|participa[cç][aã]o|programa ao vivo|live/.test((name ?? "").toLocaleLowerCase("pt-BR"));
}

function campaignStatusFor(startsOn: string) { return startsOn > new Date().toISOString().slice(0, 10) ? "scheduled" as const : "active" as const; }

async function assertPointRelationships(database: Awaited<ReturnType<typeof requireDatabase>>, input: { supplierId: number; cityId: number; mediaTypeId: number; mediaVariationTypeId?: number | null; serviceTypeId: number | null; operationCategory: typeof mediaOperationCategories[number] }, existingPoint?: { supplierId: number; cityId: number; mediaTypeId: number; serviceTypeId: number | null }) {
  const [supplier, city, cityCoverage, mediaCoverage, serviceCoverage, mediaType, variation] = await Promise.all([
    database.select().from(suppliers).where(and(eq(suppliers.id, input.supplierId), eq(suppliers.active, true))).limit(1),
    database.select().from(cities).where(and(eq(cities.id, input.cityId), eq(cities.active, true))).limit(1),
    database.select().from(supplierCities).where(and(eq(supplierCities.supplierId, input.supplierId), eq(supplierCities.cityId, input.cityId))).limit(1),
    database.select().from(supplierMediaTypes).where(and(eq(supplierMediaTypes.supplierId, input.supplierId), eq(supplierMediaTypes.mediaTypeId, input.mediaTypeId))).limit(1),
    input.serviceTypeId ? database.select().from(supplierServiceTypes).where(and(eq(supplierServiceTypes.supplierId, input.supplierId), eq(supplierServiceTypes.serviceTypeId, input.serviceTypeId))).limit(1) : Promise.resolve([]),
    database.select().from(mediaTypes).where(eq(mediaTypes.id, input.mediaTypeId)).limit(1),
    input.mediaVariationTypeId ? database.select().from(mediaTypes).where(eq(mediaTypes.id, input.mediaVariationTypeId)).limit(1) : Promise.resolve([]),
  ]);
  if (!supplier[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um fornecedor ativo." });
  if (!city[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma cidade ativa." });
  const keepsExistingCityCoverage = existingPoint?.supplierId === input.supplierId && existingPoint.cityId === input.cityId;
  const keepsExistingMediaCoverage = existingPoint?.supplierId === input.supplierId && existingPoint.mediaTypeId === input.mediaTypeId;
  const keepsExistingServiceCoverage = Boolean(input.serviceTypeId && existingPoint?.supplierId === input.supplierId && existingPoint.serviceTypeId === input.serviceTypeId);
  if (!cityCoverage[0] && !keepsExistingCityCoverage) throw new TRPCError({ code: "BAD_REQUEST", message: "O fornecedor não está habilitado para atender a cidade selecionada. Atualize a cobertura do fornecedor." });
  if (!mediaCoverage[0] && !keepsExistingMediaCoverage) throw new TRPCError({ code: "BAD_REQUEST", message: "O fornecedor não está habilitado para este tipo de mídia. Atualize sua cobertura." });
  if (input.serviceTypeId && !serviceCoverage[0] && !keepsExistingServiceCoverage) throw new TRPCError({ code: "BAD_REQUEST", message: "O fornecedor não está habilitado para o serviço selecionado. Atualize sua cobertura." });
  if (!mediaType[0]) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um tipo de mídia válido." });
  if (mediaType[0].operationCategory !== input.operationCategory) throw new TRPCError({ code: "BAD_REQUEST", message: "O tipo de mídia não pertence à categoria selecionada." });
  if (input.mediaVariationTypeId && (!variation[0] || variation[0].parentMediaTypeId !== input.mediaTypeId || variation[0].operationCategory !== input.operationCategory)) throw new TRPCError({ code: "BAD_REQUEST", message: "A variação selecionada não pertence ao subtipo de mídia." });
}

export const mediaRouter = router({
  mapConfig: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "media.read");
    const database = await requireDatabase();
    const [setting] = await database.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, "app_system")).limit(1);
    let storedApiKey = "";
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value) as { googleMapsApiKey?: unknown };
        storedApiKey = typeof parsed.googleMapsApiKey === "string" ? parsed.googleMapsApiKey.trim() : "";
      } catch {
        storedApiKey = "";
      }
    }
    return {
      apiKey: storedApiKey || ENV.googleMapsApiKey.trim() || "",
    };
  }),
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "media.read");
    const database = await requireDatabase();
    const [supplierRows, cityRows, regionalRows, mediaTypeRows, serviceRows, subserviceRows, relationRows, serviceSubserviceRows, catalogRows, productRows, supplierMediaRows, supplierCityRows, supplierServiceRows, offeringRows, contractRows, userRows, tradeCampaignRows, neighborhoodRows] = await Promise.all([
      database.select().from(suppliers).where(eq(suppliers.active, true)).orderBy(asc(suppliers.displayName)).catch(() => []),
      database.select({ city: cities, regionalName: regionals.name }).from(cities).innerJoin(regionals, eq(cities.regionalId, regionals.id)).where(eq(cities.active, true)).orderBy(asc(cities.name)).catch(() => []),
      database.select().from(regionals).where(eq(regionals.active, true)).orderBy(asc(regionals.name)).catch(() => []),
      database.select().from(mediaTypes).where(eq(mediaTypes.active, true)).orderBy(asc(mediaTypes.name)).catch(() => []),
      database.select().from(serviceTypes).where(eq(serviceTypes.active, true)).orderBy(asc(serviceTypes.name)).catch(() => []),
      database.select().from(subserviceTypes).where(eq(subserviceTypes.active, true)).orderBy(asc(subserviceTypes.name)).catch(() => []),
      database.select().from(serviceTypeRelations).catch(() => []),
      database.select().from(serviceSubservices).where(eq(serviceSubservices.active, true)).catch(() => []),
      database.select().from(mediaServiceCatalog).where(eq(mediaServiceCatalog.active, true)).catch(() => []),
      database.select().from(productTypes).where(eq(productTypes.active, true)).orderBy(asc(productTypes.name)).catch(() => []),
      database.select().from(supplierMediaTypes).catch(() => []),
      database.select().from(supplierCities).catch(() => []),
      database.select().from(supplierServiceTypes).catch(() => []),
      database.select().from(supplierOfferings).where(eq(supplierOfferings.active, true)).orderBy(asc(supplierOfferings.name)).catch(() => []),
      database.select().from(supplierContracts).where(eq(supplierContracts.status, "active")).orderBy(desc(supplierContracts.startsOn)).catch(() => []),
      database.select({ id: users.id, name: users.name, email: users.email, jobTitle: users.jobTitle }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)).catch(() => []),
      database.select().from(tradeCampaigns).orderBy(desc(tradeCampaigns.createdAt)).catch(() => []),
      database.select().from(neighborhoods).where(eq(neighborhoods.active, true)).orderBy(asc(neighborhoods.name)).catch(() => []),
    ]);
    return { suppliers: supplierRows, cities: cityRows, regionals: regionalRows, mediaTypes: mediaTypeRows, serviceTypes: serviceRows, subserviceTypes: subserviceRows, serviceTypeRelations: relationRows, serviceSubservices: serviceSubserviceRows, mediaServiceCatalog: catalogRows, productTypes: productRows, supplierMediaTypes: supplierMediaRows, supplierCities: supplierCityRows, supplierServiceTypes: supplierServiceRows, supplierOfferings: offeringRows, supplierContracts: contractRows, users: userRows, tradeCampaigns: tradeCampaignRows, neighborhoods: neighborhoodRows };
  }),
  list: protectedProcedure.input(z.object({ regionalId: z.number().int().positive().optional(), cityId: z.number().int().positive().optional(), channelKind: z.enum(channelKinds).optional(), operationCategory: z.enum(mediaOperationCategories).optional(), status: z.enum(["active", "inactive", "scheduled", "completed", "cancelled"]).optional(), partnershipType: z.enum(partnershipKinds).optional() }).optional()).query(async ({ ctx, input }) => { await assertPermission(ctx.user, "media.read"); const database = await requireDatabase(); const conditions = []; if (input?.regionalId) conditions.push(eq(cities.regionalId, input.regionalId)); if (input?.cityId) conditions.push(eq(mediaPoints.cityId, input.cityId)); if (input?.channelKind) conditions.push(eq(mediaPoints.channelKind, input.channelKind)); if (input?.operationCategory) conditions.push(eq(mediaPoints.operationCategory, input.operationCategory)); const [points, campaigns, evidenceRows, invoiceRows, paymentRows] = await Promise.all([database.select({ point: mediaPoints, supplierName: suppliers.displayName, cityName: cities.name, regionalId: cities.regionalId, regionalName: regionals.name, mediaTypeName: mediaTypes.name, serviceTypeName: serviceTypes.name }).from(mediaPoints).innerJoin(suppliers, eq(mediaPoints.supplierId, suppliers.id)).innerJoin(cities, eq(mediaPoints.cityId, cities.id)).innerJoin(regionals, eq(cities.regionalId, regionals.id)).innerJoin(mediaTypes, eq(mediaPoints.mediaTypeId, mediaTypes.id)).leftJoin(serviceTypes, eq(mediaPoints.serviceTypeId, serviceTypes.id)).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(mediaPoints.name)), database.select().from(mediaCampaigns).orderBy(desc(mediaCampaigns.startsOn)), database.select().from(documents).where(eq(documents.entityType, "media_campaign")).orderBy(desc(documents.createdAt)), database.select({ id: invoices.id, operationId: invoices.operationId, amount: invoices.amount, status: invoices.status }).from(invoices).where(eq(invoices.operationType, "media_campaign")), database.select({ invoiceId: payments.invoiceId, amount: payments.amount }).from(payments)]); return points.map(({ point, ...labels }) => { const pointCampaigns = campaigns.filter(campaign => campaign.mediaPointId === point.id && (!input?.status || campaign.status === input.status) && (!input?.partnershipType || campaign.partnershipType === input.partnershipType)).map(campaign => { const campaignInvoices = invoiceRows.filter(invoice => invoice.operationId === campaign.id && invoice.status !== "cancelled"); const paidAmount = campaignInvoices.reduce((total, invoice) => total + paymentRows.filter(payment => payment.invoiceId === invoice.id).reduce((subtotal, payment) => subtotal + Number(payment.amount), 0), 0); const estimatedAmount = Number(campaign.estimatedCost); return { ...campaign, finance: { estimatedAmount, invoicedAmount: campaignInvoices.reduce((total, invoice) => total + Number(invoice.amount), 0), paidAmount, remainingAmount: estimatedAmount - paidAmount } }; }); const pointCampaignIds = pointCampaigns.map(campaign => campaign.id); const activeCampaign = pointCampaigns.find(campaign => campaign.status === "active") ?? null; const nextCampaign = pointCampaigns.find(campaign => campaign.status === "scheduled") ?? null; const priorityCampaignIds = [activeCampaign?.id, nextCampaign?.id].filter((id): id is number => Boolean(id)); const cover = evidenceRows.find(document => document.kind === "art" && priorityCampaignIds.includes(document.entityId) && document.mimeType.startsWith("image/")) ?? evidenceRows.find(document => document.kind === "evidence" && priorityCampaignIds.includes(document.entityId) && document.mimeType.startsWith("image/")) ?? evidenceRows.find(document => document.kind === "art" && pointCampaignIds.includes(document.entityId) && document.mimeType.startsWith("image/")); return { ...point, ...labels, campaigns: pointCampaigns, coverImageUrl: cover?.url ?? null, activeCampaign, nextCampaign }; }).filter(point => !input?.status && !input?.partnershipType || point.campaigns.length > 0); }),
  pointDetails: protectedProcedure.input(z.object({ mediaPointId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.read");
    const database = await requireDatabase();
    const [row] = await database.select({ point: mediaPoints, supplierName: suppliers.displayName, cityName: cities.name, regionalId: cities.regionalId, regionalName: regionals.name, mediaTypeName: mediaTypes.name, serviceTypeName: serviceTypes.name }).from(mediaPoints).innerJoin(suppliers, eq(mediaPoints.supplierId, suppliers.id)).innerJoin(cities, eq(mediaPoints.cityId, cities.id)).innerJoin(regionals, eq(cities.regionalId, regionals.id)).innerJoin(mediaTypes, eq(mediaPoints.mediaTypeId, mediaTypes.id)).leftJoin(serviceTypes, eq(mediaPoints.serviceTypeId, serviceTypes.id)).where(eq(mediaPoints.id, input.mediaPointId)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Ponto de mídia não encontrado." });
    const campaigns = await database.select().from(mediaCampaigns).where(eq(mediaCampaigns.mediaPointId, input.mediaPointId)).orderBy(desc(mediaCampaigns.startsOn));
    const campaignIds = campaigns.map(campaign => campaign.id);
    const [pointHistory, campaignHistory, evidences, pointDocuments, distributions, neighborhoodDistributions, spotRows, scheduleRows, registrations] = await Promise.all([
      database.select().from(auditLogs).where(and(eq(auditLogs.entityType, "media_point"), eq(auditLogs.entityId, input.mediaPointId))).orderBy(desc(auditLogs.occurredAt)),
      campaignIds.length ? database.select().from(auditLogs).where(and(eq(auditLogs.entityType, "media_campaign"), inArray(auditLogs.entityId, campaignIds))).orderBy(desc(auditLogs.occurredAt)) : Promise.resolve([]),
      campaignIds.length ? database.select().from(documents).where(and(eq(documents.entityType, "media_campaign"), inArray(documents.entityId, campaignIds))).orderBy(desc(documents.createdAt)) : Promise.resolve([]),
      database.select().from(documents).where(and(eq(documents.entityType, "media_point"), eq(documents.entityId, input.mediaPointId))).orderBy(desc(documents.createdAt)),
      campaignIds.length ? database.select({ distribution: mediaCampaignCityDistributions, cityName: cities.name, regionalName: regionals.name }).from(mediaCampaignCityDistributions).innerJoin(cities, eq(mediaCampaignCityDistributions.cityId, cities.id)).innerJoin(regionals, eq(cities.regionalId, regionals.id)).where(inArray(mediaCampaignCityDistributions.mediaCampaignId, campaignIds)).orderBy(asc(cities.name)) : Promise.resolve([]),
      campaignIds.length ? database.select({ distribution: mediaCampaignNeighborhoodDistributions, neighborhoodName: neighborhoods.name, cityName: cities.name }).from(mediaCampaignNeighborhoodDistributions).innerJoin(neighborhoods, eq(mediaCampaignNeighborhoodDistributions.neighborhoodId, neighborhoods.id)).innerJoin(cities, eq(neighborhoods.cityId, cities.id)).where(inArray(mediaCampaignNeighborhoodDistributions.mediaCampaignId, campaignIds)).orderBy(asc(neighborhoods.name)) : Promise.resolve([]),
      database.select({ id: mediaSpots.id, name: mediaSpots.name, active: mediaSpots.active }).from(mediaSpots).orderBy(desc(mediaSpots.active), asc(mediaSpots.name)),
      campaignIds.length ? database.select({ schedule: mediaCampaignSchedules, neighborhoodName: neighborhoods.name }).from(mediaCampaignSchedules).leftJoin(neighborhoods, eq(mediaCampaignSchedules.neighborhoodId, neighborhoods.id)).where(inArray(mediaCampaignSchedules.mediaCampaignId, campaignIds)).orderBy(asc(mediaCampaignSchedules.startsAt)) : Promise.resolve([]),
      database.select({ registration: urbanMediaRegistrations, variationName: mediaTypes.name, contractCode: supplierContracts.contractCode, contractName: supplierContracts.contractType, contractExpectedAmount: supplierContracts.expectedAmount }).from(urbanMediaRegistrations).innerJoin(mediaTypes, eq(urbanMediaRegistrations.mediaVariationTypeId, mediaTypes.id)).leftJoin(supplierContracts, eq(urbanMediaRegistrations.supplierContractId, supplierContracts.id)).where(eq(urbanMediaRegistrations.mediaPointId, input.mediaPointId)).orderBy(desc(urbanMediaRegistrations.createdAt)),
    ]);
    const shapedCampaigns = campaigns.map(campaign => ({ ...campaign, evidences: evidences.filter(document => document.entityId === campaign.id && document.kind === "evidence"), arts: evidences.filter(document => document.entityId === campaign.id && document.kind === "art"), spots: evidences.filter(document => document.entityId === campaign.id && document.kind === "spot"), historyEvidences: evidences.filter(document => document.entityId === campaign.id && document.kind === "history_evidence"), cityDistributions: distributions.filter(item => item.distribution.mediaCampaignId === campaign.id).map(item => ({ ...item.distribution, cityName: item.cityName, regionalName: item.regionalName })), neighborhoodDistributions: neighborhoodDistributions.filter(item => item.distribution.mediaCampaignId === campaign.id).map(item => ({ ...item.distribution, neighborhoodName: item.neighborhoodName, cityName: item.cityName })), schedules: scheduleRows.filter(item => item.schedule.mediaCampaignId === campaign.id).map(item => ({ ...item.schedule, neighborhoodName: item.neighborhoodName })) }));
    return { ...row.point, supplierName: row.supplierName, cityName: row.cityName, regionalId: row.regionalId, regionalName: row.regionalName, mediaTypeName: row.mediaTypeName, serviceTypeName: row.serviceTypeName, statusEvidence: pointDocuments.filter(document => document.kind === "history_evidence" || document.kind === "evidence"), spots: spotRows, campaigns: shapedCampaigns, registrations: registrations.map(item => ({ ...item.registration, variationName: item.variationName, contractCode: item.contractCode, contractName: item.contractName, contractExpectedAmount: item.contractExpectedAmount, veiculations: shapedCampaigns.filter(campaign => campaign.urbanMediaRegistrationId === item.registration.id) })), history: [...pointHistory.map(item => ({ ...item, scope: "point" as const })), ...campaignHistory.map(item => ({ ...item, scope: "campaign" as const }))].sort((first, second) => second.occurredAt.getTime() - first.occurredAt.getTime()) };
  }),
  createPoint: protectedProcedure.input(z.object({ supplierId: z.number().int().positive(), cityId: z.number().int().positive(), mediaTypeId: z.number().int().positive(), mediaVariationTypeId: z.number().int().positive().nullable().optional(), serviceTypeId: z.number().int().positive().nullable(), name: z.string().trim().min(2).max(180), operationCategory: z.enum(mediaOperationCategories).default("graphics"), replacementFrequency: z.enum(replacementFrequencies).nullable().optional(), contractStartsOn: z.string().date().nullable().optional(), contractEndsOn: z.string().date().nullable().optional(), partnershipType: z.enum(partnershipKinds).default("paid"), address: z.string().trim().max(2000).optional(), latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(), signalRangeKm: z.number().min(0).max(1000).nullable().optional(), confirmReplaceExisting: z.boolean().default(false) })).mutation(async ({ ctx, input }) => { await assertPermission(ctx.user, "media.write"); if (input.contractStartsOn && input.contractEndsOn && input.contractEndsOn < input.contractStartsOn) throw new TRPCError({ code: "BAD_REQUEST", message: "A data final do contrato deve ser posterior à data inicial." }); const database = await requireDatabase(); await assertPointRelationships(database, input); const addressKey = input.address?.trim().toLocaleLowerCase("pt-BR") || null; const latitude = input.latitude?.toFixed(7) ?? null; const longitude = input.longitude?.toFixed(7) ?? null; const signalRangeKm = input.signalRangeKm?.toFixed(2) ?? null; const activePoints = await database.select().from(mediaPoints).where(and(eq(mediaPoints.cityId, input.cityId), eq(mediaPoints.status, "active"))); const existing = activePoints.find(row => { const rowAddress = row.address?.trim().toLocaleLowerCase("pt-BR") || null; if (addressKey && rowAddress) return addressKey === rowAddress; return Boolean(latitude && longitude && row.latitude === latitude && row.longitude === longitude); }); if (existing && !input.confirmReplaceExisting) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma mídia ativa neste local. Confirme se deseja concluir a anterior e criar a nova." }); const result = await database.transaction(async transaction => { if (existing) { await transaction.update(mediaCampaigns).set({ status: "completed", updatedAt: new Date() }).where(and(eq(mediaCampaigns.mediaPointId, existing.id), eq(mediaCampaigns.status, "active"))); await transaction.update(mediaPoints).set({ status: "inactive" }).where(eq(mediaPoints.id, existing.id)); } const [created] = await transaction.insert(mediaPoints).values({ supplierId: input.supplierId, cityId: input.cityId, mediaTypeId: input.mediaTypeId, mediaVariationTypeId: input.mediaVariationTypeId ?? null, serviceTypeId: input.serviceTypeId ?? null, name: input.name, channelKind: input.operationCategory === "graphics" || input.operationCategory === "audio_video" || input.operationCategory === "influencers" ? "standard" : "external", operationCategory: input.operationCategory, replacementFrequency: input.replacementFrequency ?? null, contractStartsOn: input.contractStartsOn ?? null, contractEndsOn: input.contractEndsOn ?? null, partnershipType: input.partnershipType, address: input.address || null, latitude, longitude, signalRangeKm }).returning(); return created; }); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_point", entityId: result.id, action: "create", afterData: result }); if (existing) await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_point", entityId: existing.id, action: "replace", afterData: { status: "inactive", replacedByMediaPointId: result.id } }); return result; }),
  updatePoint: protectedProcedure.input(z.object({ mediaPointId: z.number().int().positive(), supplierId: z.number().int().positive(), cityId: z.number().int().positive(), mediaTypeId: z.number().int().positive(), mediaVariationTypeId: z.number().int().positive().nullable().optional(), serviceTypeId: z.number().int().positive().nullable(), name: z.string().trim().min(2).max(180), operationCategory: z.enum(mediaOperationCategories).default("graphics"), replacementFrequency: z.enum(replacementFrequencies).nullable().optional(), contractStartsOn: z.string().date().nullable().optional(), contractEndsOn: z.string().date().nullable().optional(), partnershipType: z.enum(partnershipKinds).default("paid"), address: z.string().trim().max(2000).optional(), latitude: z.number().min(-90).max(90).nullable(), longitude: z.number().min(-180).max(180).nullable(), signalRangeKm: z.number().min(0).max(1000).nullable().optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    if (input.contractStartsOn && input.contractEndsOn && input.contractEndsOn < input.contractStartsOn) throw new TRPCError({ code: "BAD_REQUEST", message: "A data final do contrato deve ser posterior à data inicial." });
    const database = await requireDatabase();
    const [before] = await database.select().from(mediaPoints).where(eq(mediaPoints.id, input.mediaPointId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Ponto de mídia não encontrado." });
    await assertPointRelationships(database, input, before);
    const [updated] = await database.update(mediaPoints).set({ supplierId: input.supplierId, cityId: input.cityId, mediaTypeId: input.mediaTypeId, mediaVariationTypeId: input.mediaVariationTypeId ?? before.mediaVariationTypeId ?? null, serviceTypeId: input.serviceTypeId ?? null, name: input.name, channelKind: input.operationCategory === "graphics" || input.operationCategory === "audio_video" || input.operationCategory === "influencers" ? "standard" : "external", operationCategory: input.operationCategory, replacementFrequency: input.replacementFrequency ?? null, contractStartsOn: input.contractStartsOn ?? null, contractEndsOn: input.contractEndsOn ?? null, partnershipType: input.partnershipType, address: input.address?.trim() || null, latitude: input.latitude?.toFixed(7) ?? null, longitude: input.longitude?.toFixed(7) ?? null, signalRangeKm: input.signalRangeKm?.toFixed(2) ?? null }).where(eq(mediaPoints.id, input.mediaPointId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_point", entityId: updated.id, action: "update", beforeData: before, afterData: updated });
    return updated;
  }),
  updatePointStatus: protectedProcedure.input(z.object({ mediaPointId: z.number().int().positive(), status: z.enum(["active", "inactive", "maintenance", "cancelled"]), reason: z.string().trim().max(3000).optional(), evidenceDocumentIds: z.array(z.number().int().positive()).max(10).default([]) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    if (["inactive", "cancelled"].includes(input.status) && (!input.reason || input.reason.length < 3)) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe a justificativa para inativar ou cancelar a mídia." });
    if (["inactive", "cancelled"].includes(input.status) && input.evidenceDocumentIds.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Anexe pelo menos uma evidência para inativar ou cancelar a mídia." });
    const database = await requireDatabase();
    const [before] = await database.select().from(mediaPoints).where(eq(mediaPoints.id, input.mediaPointId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Ponto de mídia não encontrado." });
    if (input.evidenceDocumentIds.length) {
      const evidenceRows = await database.select({ id: documents.id }).from(documents).where(and(eq(documents.entityType, "media_point"), eq(documents.entityId, input.mediaPointId), inArray(documents.id, input.evidenceDocumentIds), inArray(documents.kind, ["history_evidence", "evidence"])));
      if (evidenceRows.length !== input.evidenceDocumentIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "As evidências precisam estar anexadas a este ponto de mídia." });
    }
    const [updated] = await database.update(mediaPoints).set({ status: input.status }).where(eq(mediaPoints.id, input.mediaPointId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_point", entityId: input.mediaPointId, action: `status_${input.status}`, beforeData: before, afterData: { ...updated, reason: input.reason || null, evidenceDocumentIds: input.evidenceDocumentIds } });
    return updated;
  }),
  savePointDebrief: protectedProcedure.input(z.object({ mediaPointId: z.number().int().positive(), rating: z.number().int().min(1).max(5), notes: z.string().trim().max(4000).optional(), result: z.string().trim().max(4000).optional(), completedAt: z.string().datetime().optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    const database = await requireDatabase();
    const [before] = await database.select().from(mediaPoints).where(eq(mediaPoints.id, input.mediaPointId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Programa audiovisual não encontrado." });
    const [updated] = await database.update(mediaPoints).set({ debriefRating: input.rating, debriefNotes: input.notes || null, debriefResult: input.result || null, debriefAt: input.completedAt ? new Date(input.completedAt) : new Date() }).where(eq(mediaPoints.id, input.mediaPointId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_point", entityId: input.mediaPointId, action: "save_debrief", beforeData: { debriefRating: before.debriefRating, debriefAt: before.debriefAt }, afterData: { debriefRating: updated.debriefRating, debriefAt: updated.debriefAt } });
    return updated;
  }),
  createUrbanRegistration: protectedProcedure.input(z.object({ mediaPointId: z.number().int().positive(), mediaVariationTypeId: z.number().int().positive(), supplierContractId: z.number().int().positive().nullable().optional(), replacementFrequency: z.enum(replacementFrequencies), contractReference: z.string().trim().max(180).optional(), contractValue: z.number().min(0).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    const database = await requireDatabase();
    const [point, variation] = await Promise.all([
      database.select().from(mediaPoints).where(and(eq(mediaPoints.id, input.mediaPointId), eq(mediaPoints.operationCategory, "graphics"))).limit(1),
      database.select().from(mediaTypes).where(eq(mediaTypes.id, input.mediaVariationTypeId)).limit(1),
    ]);
    if (!point[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Ponto de Mídia Urbana não encontrado." });
    if (!variation[0] || variation[0].parentMediaTypeId !== point[0].mediaTypeId || variation[0].operationCategory !== "graphics") throw new TRPCError({ code: "BAD_REQUEST", message: "A variação não pertence ao tipo de mídia deste ponto." });
    let contract = null;
    if (input.supplierContractId) {
      const [row] = await database.select().from(supplierContracts).where(and(eq(supplierContracts.id, input.supplierContractId), eq(supplierContracts.supplierId, point[0].supplierId))).limit(1);
      if (!row) throw new TRPCError({ code: "BAD_REQUEST", message: "O contrato selecionado não pertence ao fornecedor do ponto." });
      contract = row;
    }
    const [created] = await database.insert(urbanMediaRegistrations).values({ mediaPointId: input.mediaPointId, mediaVariationTypeId: input.mediaVariationTypeId, supplierContractId: input.supplierContractId ?? null, replacementFrequency: input.replacementFrequency, contractReference: input.contractReference || contract?.contractCode || null, contractValue: (input.contractValue ?? Number(contract?.expectedAmount ?? 0)).toFixed(2), createdByUserId: ctx.user.id }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "urban_media_registration", entityId: created.id, action: "create", afterData: created });
    return created;
  }),
  createUrbanVeiculation: protectedProcedure.input(z.object({ mediaPointId: z.number().int().positive(), urbanMediaRegistrationId: z.number().int().positive().optional(), serviceTypeId: z.number().int().positive(), subserviceTypeId: z.number().int().positive(), mediaServiceCatalogId: z.number().int().positive().nullable().optional(), productTypeId: z.number().int().positive().nullable().optional(), responsibleUserId: z.number().int().positive().nullable().optional(), tradeCampaignId: z.number().int().positive().nullable().optional(), name: z.string().trim().min(2).max(180), objective: z.string().trim().max(180).optional(), startsOn: z.string().date(), endsOn: z.string().date(), partnershipType: z.enum(partnershipKinds).default("paid"), estimatedCost: z.number().min(0).default(0), notes: z.string().trim().max(2000).optional(), campaignDetails: z.string().trim().max(4000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    if (input.endsOn < input.startsOn) throw new TRPCError({ code: "BAD_REQUEST", message: "A data final deve ser posterior à data inicial." });
    const database = await requireDatabase();
    let registration: typeof urbanMediaRegistrations.$inferSelect | null = null;
    if (input.urbanMediaRegistrationId) {
      const [legacyRegistration] = await database.select().from(urbanMediaRegistrations).where(and(eq(urbanMediaRegistrations.id, input.urbanMediaRegistrationId), eq(urbanMediaRegistrations.active, true))).limit(1);
      if (!legacyRegistration) throw new TRPCError({ code: "NOT_FOUND", message: "Registro operacional legado não encontrado ou inativo." });
      if (legacyRegistration.mediaPointId !== input.mediaPointId) throw new TRPCError({ code: "BAD_REQUEST", message: "O registro operacional não pertence ao ponto informado." });
      registration = legacyRegistration;
    }
    const [point] = await database.select({ id: mediaPoints.id, mediaTypeId: mediaPoints.mediaTypeId, supplierId: mediaPoints.supplierId }).from(mediaPoints).where(and(eq(mediaPoints.id, input.mediaPointId), eq(mediaPoints.operationCategory, "graphics"), eq(mediaPoints.status, "active"))).limit(1);
    if (!point) throw new TRPCError({ code: "NOT_FOUND", message: "Ponto de Mídia Urbana não encontrado ou inativo." });
    const [service] = await database.select().from(serviceTypes).where(and(eq(serviceTypes.id, input.serviceTypeId), eq(serviceTypes.active, true))).limit(1);
    if (!service || service.parentServiceTypeId) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um Serviço principal ativo." });
    if (input.subserviceTypeId) {
      const [subservice] = await database.select().from(subserviceTypes).where(and(eq(subserviceTypes.id, input.subserviceTypeId), eq(subserviceTypes.active, true))).limit(1);
      if (!subservice) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um SubServiço ativo." });
      const [link] = await database.select({ id: serviceSubservices.id }).from(serviceSubservices).where(and(eq(serviceSubservices.serviceTypeId, input.serviceTypeId), eq(serviceSubservices.subserviceTypeId, input.subserviceTypeId), eq(serviceSubservices.active, true))).limit(1);
      if (!link) throw new TRPCError({ code: "BAD_REQUEST", message: "O SubServiço selecionado não está vinculado ao Serviço informado." });
    }
    if (input.responsibleUserId) {
      const [responsible] = await database.select({ id: users.id }).from(users).where(and(eq(users.id, input.responsibleUserId), eq(users.isActive, true))).limit(1);
      if (!responsible) throw new TRPCError({ code: "BAD_REQUEST", message: "O responsável selecionado não está ativo." });
    }
    if (input.tradeCampaignId) {
      const [tradeCampaign] = await database.select({ id: tradeCampaigns.id }).from(tradeCampaigns).where(eq(tradeCampaigns.id, input.tradeCampaignId)).limit(1);
      if (!tradeCampaign) throw new TRPCError({ code: "BAD_REQUEST", message: "Campanha comercial inexistente." });
    }
    const status = campaignStatusFor(input.startsOn);
    if (status === "active") {
      const [existing] = await database.select({ id: mediaCampaigns.id }).from(mediaCampaigns).where(and(eq(mediaCampaigns.mediaPointId, input.mediaPointId), eq(mediaCampaigns.status, "active"))).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Este ponto já possui uma veiculação ativa. Reagende a atual ou cadastre uma futura." });
    }
    const [created] = await database.insert(mediaCampaigns).values({ mediaPointId: input.mediaPointId, urbanMediaRegistrationId: registration?.id ?? null, mediaVariationTypeId: registration?.mediaVariationTypeId ?? null, serviceTypeId: input.serviceTypeId, subserviceTypeId: input.subserviceTypeId ?? null, mediaServiceCatalogId: input.mediaServiceCatalogId ?? null, productTypeId: input.productTypeId ?? null, responsibleUserId: input.responsibleUserId ?? null, tradeCampaignId: input.tradeCampaignId ?? null, name: input.name, objective: input.objective || null, startsOn: input.startsOn, endsOn: input.endsOn, partnershipType: input.partnershipType, estimatedCost: input.estimatedCost.toFixed(2), notes: input.notes || null, campaignDetails: input.campaignDetails, status }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_campaign", entityId: created.id, action: status === "scheduled" ? "schedule" : "create", afterData: created });
    return created;
  }),
  updateUrbanVeiculation: protectedProcedure.input(z.object({ campaignId: z.number().int().positive(), serviceTypeId: z.number().int().positive(), subserviceTypeId: z.number().int().positive().nullable().optional(), mediaServiceCatalogId: z.number().int().positive().nullable().optional(), productTypeId: z.number().int().positive().nullable().optional(), responsibleUserId: z.number().int().positive().nullable().optional(), tradeCampaignId: z.number().int().positive().nullable().optional(), name: z.string().trim().min(2).max(180), startsOn: z.string().date(), endsOn: z.string().date(), campaignDetails: z.string().trim().max(4000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    if (input.endsOn < input.startsOn) throw new TRPCError({ code: "BAD_REQUEST", message: "A data final deve ser posterior à data inicial." });
    const database = await requireDatabase();
    const [current] = await database.select({ campaign: mediaCampaigns, point: mediaPoints }).from(mediaCampaigns).innerJoin(mediaPoints, eq(mediaCampaigns.mediaPointId, mediaPoints.id)).where(and(eq(mediaCampaigns.id, input.campaignId), eq(mediaPoints.operationCategory, "graphics"))).limit(1);
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Veiculação urbana não encontrada." });
    if (current.point.status !== "active") throw new TRPCError({ code: "CONFLICT", message: "Não é possível editar uma veiculação de um ponto inativo ou cancelado." });
    const [service] = await database.select().from(serviceTypes).where(and(eq(serviceTypes.id, input.serviceTypeId), eq(serviceTypes.active, true))).limit(1);
    if (!service || service.parentServiceTypeId) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um Serviço principal ativo." });
    if (input.subserviceTypeId) {
      const [subservice] = await database.select().from(subserviceTypes).where(and(eq(subserviceTypes.id, input.subserviceTypeId), eq(subserviceTypes.active, true))).limit(1);
      if (!subservice) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um SubServiço ativo." });
      const [link] = await database.select({ id: serviceSubservices.id }).from(serviceSubservices).where(and(eq(serviceSubservices.serviceTypeId, input.serviceTypeId), eq(serviceSubservices.subserviceTypeId, input.subserviceTypeId), eq(serviceSubservices.active, true))).limit(1);
      if (!link) throw new TRPCError({ code: "BAD_REQUEST", message: "O SubServiço selecionado não está vinculado ao Serviço informado." });
    }
    if (input.responsibleUserId) {
      const [responsible] = await database.select({ id: users.id }).from(users).where(and(eq(users.id, input.responsibleUserId), eq(users.isActive, true))).limit(1);
      if (!responsible) throw new TRPCError({ code: "BAD_REQUEST", message: "O responsável selecionado não está ativo." });
    }
    if (input.tradeCampaignId) {
      const [tradeCampaign] = await database.select({ id: tradeCampaigns.id }).from(tradeCampaigns).where(eq(tradeCampaigns.id, input.tradeCampaignId)).limit(1);
      if (!tradeCampaign) throw new TRPCError({ code: "BAD_REQUEST", message: "Campanha comercial inexistente." });
    }
    const status = campaignStatusFor(input.startsOn);
    if (status === "active") {
      const [existing] = await database.select({ id: mediaCampaigns.id }).from(mediaCampaigns).where(and(eq(mediaCampaigns.mediaPointId, current.campaign.mediaPointId), eq(mediaCampaigns.status, "active"))).limit(1);
      if (existing && existing.id !== input.campaignId) throw new TRPCError({ code: "CONFLICT", message: "Este ponto já possui outra veiculação ativa." });
    }
    const [updated] = await database.update(mediaCampaigns).set({ serviceTypeId: input.serviceTypeId, subserviceTypeId: input.subserviceTypeId ?? current.campaign.subserviceTypeId ?? null, mediaServiceCatalogId: input.mediaServiceCatalogId ?? null, productTypeId: input.productTypeId ?? null, responsibleUserId: input.responsibleUserId ?? null, tradeCampaignId: input.tradeCampaignId ?? null, name: input.name, startsOn: input.startsOn, endsOn: input.endsOn, campaignDetails: input.campaignDetails, status, updatedAt: new Date() }).where(eq(mediaCampaigns.id, input.campaignId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_campaign", entityId: updated.id, action: "update", beforeData: current.campaign, afterData: updated });
    return updated;
  }),
  updateTraditionalVeiculation: protectedProcedure.input(z.object({ campaignId: z.number().int().positive(), serviceTypeId: z.number().int().positive().nullable().optional(), responsibleUserId: z.number().int().positive().nullable().optional(), tradeCampaignId: z.number().int().positive().nullable().optional(), name: z.string().trim().min(2).max(180), startsOn: z.string().date(), endsOn: z.string().date(), campaignDetails: z.string().trim().max(4000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    if (input.endsOn < input.startsOn) throw new TRPCError({ code: "BAD_REQUEST", message: "A data final deve ser posterior à data inicial." });
    const database = await requireDatabase();
    const [current] = await database.select({ campaign: mediaCampaigns, point: mediaPoints }).from(mediaCampaigns).innerJoin(mediaPoints, eq(mediaCampaigns.mediaPointId, mediaPoints.id)).where(and(eq(mediaCampaigns.id, input.campaignId), inArray(mediaPoints.operationCategory, ["audio_video", "sound_car"]))).limit(1);
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Veiculação audiovisual ou de mídia volante não encontrada." });
    if (current.point.status !== "active") throw new TRPCError({ code: "CONFLICT", message: "Não é possível editar uma veiculação de um programa inativo ou cancelado." });
    if (input.serviceTypeId) {
      const [service] = await database.select({ id: serviceTypes.id }).from(serviceTypes).where(and(eq(serviceTypes.id, input.serviceTypeId), eq(serviceTypes.active, true))).limit(1);
      if (!service) throw new TRPCError({ code: "BAD_REQUEST", message: "O tipo de serviço selecionado não está ativo." });
    }
    if (input.responsibleUserId) {
      const [responsible] = await database.select({ id: users.id }).from(users).where(and(eq(users.id, input.responsibleUserId), eq(users.isActive, true))).limit(1);
      if (!responsible) throw new TRPCError({ code: "BAD_REQUEST", message: "O responsável selecionado não está ativo." });
    }
    if (input.tradeCampaignId) {
      const [tradeCampaign] = await database.select({ id: tradeCampaigns.id }).from(tradeCampaigns).where(eq(tradeCampaigns.id, input.tradeCampaignId)).limit(1);
      if (!tradeCampaign) throw new TRPCError({ code: "BAD_REQUEST", message: "Campanha comercial inexistente." });
    }
    const status = campaignStatusFor(input.startsOn);
    if (status === "active") {
      const [existing] = await database.select({ id: mediaCampaigns.id }).from(mediaCampaigns).where(and(eq(mediaCampaigns.mediaPointId, current.campaign.mediaPointId), eq(mediaCampaigns.status, "active"))).limit(1);
      if (existing && existing.id !== input.campaignId) throw new TRPCError({ code: "CONFLICT", message: "Este programa já possui outra veiculação ativa." });
    }
    const [updated] = await database.update(mediaCampaigns).set({ serviceTypeId: input.serviceTypeId, responsibleUserId: input.responsibleUserId ?? null, tradeCampaignId: input.tradeCampaignId ?? null, name: input.name, startsOn: input.startsOn, endsOn: input.endsOn, campaignDetails: input.campaignDetails?.trim() || null, status, updatedAt: new Date() }).where(eq(mediaCampaigns.id, input.campaignId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_campaign", entityId: updated.id, action: "update", beforeData: current.campaign, afterData: updated });
    return updated;
  }),
  createTraditionalVeiculation: protectedProcedure.input(z.object({ mediaPointId: z.number().int().positive(), serviceTypeId: z.number().int().positive().nullable().optional(), subserviceTypeId: z.number().int().positive().nullable().optional(), mediaServiceCatalogId: z.number().int().positive().nullable().optional(), productTypeId: z.number().int().positive().nullable().optional(), responsibleUserId: z.number().int().positive().nullable().optional(), tradeCampaignId: z.number().int().positive().nullable().optional(), name: z.string().trim().min(2).max(180), startsOn: z.string().date(), endsOn: z.string().date(), partnershipType: z.enum(partnershipKinds).default("paid"), estimatedCost: z.number().min(0).default(0), notes: z.string().trim().max(2000).optional(), campaignDetails: z.string().trim().max(4000).optional(), airingSchedule: z.string().trim().max(2000).optional(), signalNotes: z.string().trim().max(3000).optional(), signalCityIds: z.array(z.number().int().positive()).max(100).default([]), signalNeighborhoodIds: z.array(z.number().int().positive()).max(500).default([]), schedules: z.array(traditionalScheduleSchema).max(100).default([]), allowConcurrent: z.boolean().default(false), confirmReplaceExisting: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    if (input.endsOn < input.startsOn) throw new TRPCError({ code: "BAD_REQUEST", message: "A data final deve ser posterior à data inicial." });
    if (new Set(input.signalCityIds).size !== input.signalCityIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe cada cidade de sinal apenas uma vez." });
    if (new Set(input.signalNeighborhoodIds).size !== input.signalNeighborhoodIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe cada bairro de circulação apenas uma vez." });
    const database = await requireDatabase();
    const [point] = await database.select().from(mediaPoints).where(and(eq(mediaPoints.id, input.mediaPointId), inArray(mediaPoints.operationCategory, ["audio_video", "sound_car"]), eq(mediaPoints.status, "active"))).limit(1);
    if (!point) throw new TRPCError({ code: "NOT_FOUND", message: "Ponto audiovisual ou de mídia volante não encontrado ou inativo." });
    if (input.serviceTypeId) {
      const [service] = await database.select({ id: serviceTypes.id, mediaTypeId: serviceTypes.mediaTypeId }).from(serviceTypes).where(and(eq(serviceTypes.id, input.serviceTypeId), eq(serviceTypes.active, true))).limit(1);
      if (!service) throw new TRPCError({ code: "BAD_REQUEST", message: "O tipo de serviço selecionado não está ativo." });
      const [catalogLink] = await database.select({ id: mediaServiceCatalog.id }).from(mediaServiceCatalog).where(and(eq(mediaServiceCatalog.mediaTypeId, point.mediaTypeId), eq(mediaServiceCatalog.serviceTypeId, input.serviceTypeId), eq(mediaServiceCatalog.active, true))).limit(1);
      if (service.mediaTypeId !== point.mediaTypeId && !catalogLink) throw new TRPCError({ code: "BAD_REQUEST", message: "O tipo de serviço não está vinculado ao tipo de mídia deste programa." });
    }
    if (input.responsibleUserId) {
      const [responsible] = await database.select({ id: users.id }).from(users).where(and(eq(users.id, input.responsibleUserId), eq(users.isActive, true))).limit(1);
      if (!responsible) throw new TRPCError({ code: "BAD_REQUEST", message: "O responsável selecionado não está ativo." });
    }
    if (input.tradeCampaignId) {
      const [tradeCampaign] = await database.select({ id: tradeCampaigns.id }).from(tradeCampaigns).where(eq(tradeCampaigns.id, input.tradeCampaignId)).limit(1);
      if (!tradeCampaign) throw new TRPCError({ code: "BAD_REQUEST", message: "Campanha comercial inexistente." });
    }
    if (input.signalCityIds.length) {
      const activeCities = await database.select({ id: cities.id }).from(cities).where(and(eq(cities.active, true), inArray(cities.id, input.signalCityIds)));
      if (activeCities.length !== input.signalCityIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione apenas cidades ativas para o alcance do sinal." });
    }
    if (input.signalNeighborhoodIds.length) {
      const validNeighborhoods = await database.select({ id: neighborhoods.id, cityId: neighborhoods.cityId }).from(neighborhoods).innerJoin(cities, eq(neighborhoods.cityId, cities.id)).where(and(eq(neighborhoods.active, true), eq(cities.active, true), eq(neighborhoods.cityId, point.cityId), inArray(neighborhoods.id, input.signalNeighborhoodIds)));
      if (validNeighborhoods.length !== input.signalNeighborhoodIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione apenas bairros ativos da cidade do programa." });
    }
    const status = campaignStatusFor(input.startsOn);
    let activeCampaigns: Array<{ id: number; serviceTypeName: string | null }> = [];
    let blockingCampaignIds: number[] = [];
    if (status === "active") {
      activeCampaigns = await database.select({ id: mediaCampaigns.id, serviceTypeName: serviceTypes.name }).from(mediaCampaigns).leftJoin(serviceTypes, eq(mediaCampaigns.serviceTypeId, serviceTypes.id)).where(and(eq(mediaCampaigns.mediaPointId, point.id), eq(mediaCampaigns.status, "active")));
      const currentServiceConcurrent = input.allowConcurrent || canTraditionalServiceRunConcurrently(input.serviceTypeId ? (await database.select({ name: serviceTypes.name }).from(serviceTypes).where(eq(serviceTypes.id, input.serviceTypeId)).limit(1))[0]?.name : null);
      blockingCampaignIds = activeCampaigns.filter(campaign => !currentServiceConcurrent && !canTraditionalServiceRunConcurrently(campaign.serviceTypeName)).map(campaign => campaign.id);
      if (blockingCampaignIds.length > 0 && !input.confirmReplaceExisting) throw new TRPCError({ code: "CONFLICT", message: "Este programa já possui uma veiculação ativa. Confirme se deseja encerrá-la antes de cadastrar a nova. Entrevistas podem coexistir com spots ativos." });
    }
    const created = await database.transaction(async transaction => {
      if (blockingCampaignIds.length > 0 && input.confirmReplaceExisting) {
        await transaction.update(mediaCampaigns).set({ status: "completed", updatedAt: new Date() }).where(inArray(mediaCampaigns.id, blockingCampaignIds));
      }
      const [campaign] = await transaction.insert(mediaCampaigns).values({ mediaPointId: point.id, mediaVariationTypeId: point.mediaVariationTypeId, serviceTypeId: input.serviceTypeId ?? null, subserviceTypeId: input.subserviceTypeId ?? null, mediaServiceCatalogId: input.mediaServiceCatalogId ?? null, productTypeId: input.productTypeId ?? null, responsibleUserId: input.responsibleUserId ?? null, tradeCampaignId: input.tradeCampaignId ?? null, name: input.name, objective: "Veiculação tradicional", startsOn: input.startsOn, endsOn: input.endsOn, partnershipType: input.partnershipType, estimatedCost: input.estimatedCost.toFixed(2), notes: input.notes || null, campaignDetails: input.campaignDetails || null, campaignConfig: { airingSchedule: input.airingSchedule || undefined, signalNotes: input.signalNotes || undefined, allowConcurrent: input.allowConcurrent || undefined }, status }).returning();
      if (input.signalCityIds.length) await transaction.insert(mediaCampaignCityDistributions).values(input.signalCityIds.map(cityId => ({ mediaCampaignId: campaign.id, cityId, quantity: 1, notes: "Cidade que recebe o sinal" })));
      if (input.signalNeighborhoodIds.length) await transaction.insert(mediaCampaignNeighborhoodDistributions).values(input.signalNeighborhoodIds.map(neighborhoodId => ({ mediaCampaignId: campaign.id, neighborhoodId, quantity: 1, notes: "Bairro de circulação" })));
      if (input.schedules.length) await transaction.insert(mediaCampaignSchedules).values(input.schedules.map(schedule => ({ mediaCampaignId: campaign.id, programName: schedule.programName, weekday: schedule.weekday ?? null, specificDate: schedule.specificDate ?? null, neighborhoodId: schedule.neighborhoodId ?? null, startsAt: schedule.startsAt, endsAt: schedule.endsAt, notes: schedule.notes || null, createdByUserId: ctx.user.id })));
      return campaign;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_campaign", entityId: created.id, action: status === "scheduled" ? "schedule" : "create", afterData: { ...created, signalCityIds: input.signalCityIds, signalNeighborhoodIds: input.signalNeighborhoodIds, replacedCampaignIds: input.confirmReplaceExisting ? blockingCampaignIds : [], schedules: input.schedules } });
    return created;
  }),
  campaignDetails: protectedProcedure.input(z.object({ campaignId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.read");
    const database = await requireDatabase();
    const [row] = await database.select({ campaign: mediaCampaigns, point: mediaPoints, supplierName: suppliers.displayName, cityName: cities.name, regionalName: regionals.name, mediaTypeName: mediaTypes.name, variationName: mediaTypes.name, serviceTypeName: serviceTypes.name, responsibleUserName: users.name, tradeCampaignName: tradeCampaigns.name, registration: urbanMediaRegistrations, contract: supplierContracts }).from(mediaCampaigns).innerJoin(mediaPoints, eq(mediaCampaigns.mediaPointId, mediaPoints.id)).innerJoin(suppliers, eq(mediaPoints.supplierId, suppliers.id)).innerJoin(cities, eq(mediaPoints.cityId, cities.id)).innerJoin(regionals, eq(cities.regionalId, regionals.id)).innerJoin(mediaTypes, eq(mediaPoints.mediaTypeId, mediaTypes.id)).leftJoin(urbanMediaRegistrations, eq(mediaCampaigns.urbanMediaRegistrationId, urbanMediaRegistrations.id)).leftJoin(supplierContracts, eq(urbanMediaRegistrations.supplierContractId, supplierContracts.id)).leftJoin(serviceTypes, eq(mediaCampaigns.serviceTypeId, serviceTypes.id)).leftJoin(users, eq(mediaCampaigns.responsibleUserId, users.id)).leftJoin(tradeCampaigns, eq(mediaCampaigns.tradeCampaignId, tradeCampaigns.id)).where(eq(mediaCampaigns.id, input.campaignId)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Veiculação não encontrada." });
    const [evidences, distributions, neighborhoodDistributions, schedules, history] = await Promise.all([database.select().from(documents).where(and(eq(documents.entityType, "media_campaign"), eq(documents.entityId, input.campaignId))).orderBy(desc(documents.createdAt)), database.select({ distribution: mediaCampaignCityDistributions, cityName: cities.name, regionalName: regionals.name }).from(mediaCampaignCityDistributions).innerJoin(cities, eq(mediaCampaignCityDistributions.cityId, cities.id)).innerJoin(regionals, eq(cities.regionalId, regionals.id)).where(eq(mediaCampaignCityDistributions.mediaCampaignId, input.campaignId)).orderBy(asc(cities.name)), database.select({ distribution: mediaCampaignNeighborhoodDistributions, neighborhoodName: neighborhoods.name, cityName: cities.name }).from(mediaCampaignNeighborhoodDistributions).innerJoin(neighborhoods, eq(mediaCampaignNeighborhoodDistributions.neighborhoodId, neighborhoods.id)).innerJoin(cities, eq(neighborhoods.cityId, cities.id)).where(eq(mediaCampaignNeighborhoodDistributions.mediaCampaignId, input.campaignId)).orderBy(asc(neighborhoods.name)), database.select().from(mediaCampaignSchedules).where(eq(mediaCampaignSchedules.mediaCampaignId, input.campaignId)).orderBy(asc(mediaCampaignSchedules.startsAt)), database.select().from(auditLogs).where(and(eq(auditLogs.entityType, "media_campaign"), eq(auditLogs.entityId, input.campaignId))).orderBy(desc(auditLogs.occurredAt))]);
    return { ...row.campaign, point: { ...row.point, supplierName: row.supplierName, cityName: row.cityName, regionalName: row.regionalName, mediaTypeName: row.mediaTypeName }, registration: row.registration ? { ...row.registration, variationName: row.campaign.mediaVariationTypeId ? (await database.select({ name: mediaTypes.name }).from(mediaTypes).where(eq(mediaTypes.id, row.campaign.mediaVariationTypeId)).limit(1))[0]?.name ?? null : null, contract: row.contract } : null, tradeCampaignName: row.tradeCampaignName, serviceTypeName: row.serviceTypeName, responsibleUserName: row.responsibleUserName, evidences: evidences.filter(document => document.kind === "evidence"), arts: evidences.filter(document => document.kind === "art"), spots: evidences.filter(document => document.kind === "spot"), historyEvidences: evidences.filter(document => document.kind === "history_evidence"), cityDistributions: distributions.map(item => ({ ...item.distribution, cityName: item.cityName, regionalName: item.regionalName })), neighborhoodDistributions: neighborhoodDistributions.map(item => ({ ...item.distribution, neighborhoodName: item.neighborhoodName, cityName: item.cityName })), schedules, history };
  }),
  updateCampaignStatus: protectedProcedure.input(z.object({ campaignId: z.number().int().positive(), status: z.enum(["scheduled", "active", "inactive", "completed", "cancelled"]), reason: z.string().trim().max(2000).optional(), evidenceDocumentIds: z.array(z.number().int().positive()).max(20).default([]) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write"); const database = await requireDatabase(); const [before] = await database.select().from(mediaCampaigns).where(eq(mediaCampaigns.id, input.campaignId)).limit(1); if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Veiculação não encontrada." }); const evidenceDocumentIds = Array.from(new Set(input.evidenceDocumentIds)); if (evidenceDocumentIds.length) { const validEvidence = await database.select({ id: documents.id }).from(documents).where(and(eq(documents.entityType, "media_campaign"), eq(documents.entityId, input.campaignId), inArray(documents.id, evidenceDocumentIds), eq(documents.kind, "history_evidence"))); if (validEvidence.length !== evidenceDocumentIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Uma ou mais evidências não pertencem à pasta de histórico desta veiculação." }); } const [updated] = await database.update(mediaCampaigns).set({ status: input.status, notes: input.reason ? `${before.notes ? `${before.notes}\n\n` : ""}${input.reason}` : before.notes, updatedAt: new Date() }).where(eq(mediaCampaigns.id, input.campaignId)).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_campaign", entityId: input.campaignId, action: `status_${input.status}`, beforeData: before, afterData: { ...updated, reason: input.reason || null, evidenceDocumentIds } }); return updated;
  }),
  createCampaign: protectedProcedure.input(z.object({ mediaPointId: z.number().int().positive(), tradeCampaignId: z.number().int().positive().nullable().optional(), mediaServiceCatalogId: z.number().int().positive().nullable().optional(), subserviceTypeId: z.number().int().positive().nullable().optional(), productTypeId: z.number().int().positive().nullable().optional(), name: z.string().trim().min(2).max(180), startsOn: z.string().date(), endsOn: z.string().date(), partnershipType: z.enum(partnershipKinds).default("paid"), estimatedCost: z.number().min(0).default(0), notes: z.string().trim().max(2000).optional(), campaignDetails: z.string().trim().max(4000).optional() })).mutation(async ({ ctx, input }) => { await assertPermission(ctx.user, "media.write"); if (input.endsOn < input.startsOn) throw new TRPCError({ code: "BAD_REQUEST", message: "A data de término deve ser posterior à data de início." }); const database = await requireDatabase(); if (input.tradeCampaignId) { const [tradeCampaign] = await database.select({ id: tradeCampaigns.id }).from(tradeCampaigns).where(eq(tradeCampaigns.id, input.tradeCampaignId)); if (!tradeCampaign) throw new TRPCError({ code: "BAD_REQUEST", message: "Campanha comercial inexistente." }); } const status = campaignStatusFor(input.startsOn); if (status === "active") { const [existing] = await database.select({ id: mediaCampaigns.id }).from(mediaCampaigns).where(and(eq(mediaCampaigns.mediaPointId, input.mediaPointId), eq(mediaCampaigns.status, "active"))); if (existing) throw new TRPCError({ code: "CONFLICT", message: "Este ponto já possui uma campanha ativa. Agende a próxima campanha ou reagende a atual." }); } const [created] = await database.insert(mediaCampaigns).values({ ...input, estimatedCost: input.estimatedCost.toFixed(2), notes: input.notes || null, campaignDetails: input.campaignDetails || null, status }).returning(); await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_campaign", entityId: created.id, action: status === "scheduled" ? "schedule" : "create", afterData: created }); return created; }),
  createConfiguredCampaign: protectedProcedure.input(z.object({ mediaPointId: z.number().int().positive(), tradeCampaignId: z.number().int().positive().nullable().optional(), mediaServiceCatalogId: z.number().int().positive().nullable().optional(), subserviceTypeId: z.number().int().positive().nullable().optional(), productTypeId: z.number().int().positive().nullable().optional(), name: z.string().trim().min(2).max(180), startsOn: z.string().date(), endsOn: z.string().date(), partnershipType: z.enum(partnershipKinds).default("paid"), estimatedCost: z.number().min(0).default(0), notes: z.string().trim().max(2000).optional(), campaignDetails: z.string().trim().max(4000).optional(), campaignConfig: z.object({ dailyRate: z.number().min(0).optional(), circulationDays: z.number().int().min(1).max(366).optional(), dailyRoute: z.string().trim().max(2000).optional(), audioBrief: z.string().trim().max(4000).optional(), vehicleOperation: z.string().trim().max(2000).optional(), airingSchedule: z.string().trim().max(4000).optional(), activeSpotId: z.number().int().positive().optional(), materialFormat: z.string().trim().max(160).optional(), materialQuantity: z.number().int().min(1).optional(), deadlineDays: z.number().int().min(0).max(730).optional(), deliveryInstructions: z.string().trim().max(4000).optional() }).default({}), cityDistributions: z.array(z.object({ cityId: z.number().int().positive(), quantity: z.number().int().min(1), notes: z.string().trim().max(1000).optional() })).max(100).default([]) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    if (input.endsOn < input.startsOn) throw new TRPCError({ code: "BAD_REQUEST", message: "A data de término deve ser posterior à data de início." });
    if (new Set(input.cityDistributions.map(item => item.cityId)).size !== input.cityDistributions.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe apenas uma distribuição por cidade." });
    const database = await requireDatabase();
    const status = campaignStatusFor(input.startsOn);
    const [point] = await database.select().from(mediaPoints).where(eq(mediaPoints.id, input.mediaPointId)).limit(1);
    if (!point) throw new TRPCError({ code: "NOT_FOUND", message: "Ponto de mídia não encontrado." });
    if (input.campaignConfig.activeSpotId) {
      const [spot] = await database.select({ id: mediaSpots.id }).from(mediaSpots).where(eq(mediaSpots.id, input.campaignConfig.activeSpotId)).limit(1);
      if (!spot) throw new TRPCError({ code: "BAD_REQUEST", message: "O spot selecionado não existe mais." });
    }
    if (status === "active") { const [existing] = await database.select({ id: mediaCampaigns.id }).from(mediaCampaigns).where(and(eq(mediaCampaigns.mediaPointId, input.mediaPointId), eq(mediaCampaigns.status, "active"))); if (existing) throw new TRPCError({ code: "CONFLICT", message: "Este ponto já possui uma campanha ativa. Agende a próxima campanha ou reagende a atual." }); }
    if (input.cityDistributions.length) { const allowed = await database.select({ cityId: supplierCities.cityId }).from(supplierCities).innerJoin(cities, eq(supplierCities.cityId, cities.id)).where(and(eq(supplierCities.supplierId, point.supplierId), eq(cities.active, true), inArray(supplierCities.cityId, input.cityDistributions.map(item => item.cityId)))); if (allowed.length !== input.cityDistributions.length) throw new TRPCError({ code: "BAD_REQUEST", message: "A distribuição deve usar somente cidades ativas atendidas pelo fornecedor selecionado." }); }
    if (input.tradeCampaignId) { const [tradeCampaign] = await database.select({ id: tradeCampaigns.id }).from(tradeCampaigns).where(eq(tradeCampaigns.id, input.tradeCampaignId)); if (!tradeCampaign) throw new TRPCError({ code: "BAD_REQUEST", message: "Campanha comercial inexistente." }); }
    const created = await database.transaction(async transaction => { const [campaign] = await transaction.insert(mediaCampaigns).values({ mediaPointId: input.mediaPointId, tradeCampaignId: input.tradeCampaignId ?? null, mediaServiceCatalogId: input.mediaServiceCatalogId ?? null, subserviceTypeId: input.subserviceTypeId ?? null, productTypeId: input.productTypeId ?? null, name: input.name, startsOn: input.startsOn, endsOn: input.endsOn, partnershipType: input.partnershipType, estimatedCost: input.estimatedCost.toFixed(2), notes: input.notes || null, campaignDetails: input.campaignDetails || null, campaignConfig: input.campaignConfig, status }).returning(); if (input.cityDistributions.length) await transaction.insert(mediaCampaignCityDistributions).values(input.cityDistributions.map(item => ({ mediaCampaignId: campaign.id, cityId: item.cityId, quantity: item.quantity, notes: item.notes || null }))); return campaign; });
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_campaign", entityId: created.id, action: status === "scheduled" ? "schedule" : "create", afterData: { ...created, cityDistributions: input.cityDistributions } });
    return created;
  }),
  renewCampaign: protectedProcedure.input(z.object({ sourceCampaignId: z.number().int().positive(), mediaServiceCatalogId: z.number().int().positive().nullable().optional(), subserviceTypeId: z.number().int().positive().nullable().optional(), productTypeId: z.number().int().positive().nullable().optional(), name: z.string().trim().min(2).max(180), startsOn: z.string().date(), endsOn: z.string().date(), partnershipType: z.enum(partnershipKinds).default("paid"), estimatedCost: z.number().min(0).default(0), notes: z.string().trim().max(2000).optional(), campaignDetails: z.string().trim().max(4000).optional(), rescheduleReason: z.string().trim().min(3).max(2000).optional(), evidenceDocumentIds: z.array(z.number().int().positive()).max(10).default([]) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    if (input.endsOn < input.startsOn) throw new TRPCError({ code: "BAD_REQUEST", message: "A vigência do reagendamento é inválida." });
    const database = await requireDatabase();
    const result = await database.transaction(async transaction => {
      const [source] = await transaction.select().from(mediaCampaigns).where(eq(mediaCampaigns.id, input.sourceCampaignId)).limit(1);
      if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Veiculação de origem não encontrada." });
      if (!["active", "scheduled"].includes(source.status)) throw new TRPCError({ code: "CONFLICT", message: "Apenas veiculações ativas ou agendadas podem ser reagendadas." });
      if (input.evidenceDocumentIds.length) {
        const evidenceRows = await transaction.select({ id: documents.id }).from(documents).where(and(eq(documents.entityType, "media_campaign"), eq(documents.entityId, source.id), inArray(documents.kind, ["history_evidence", "evidence"]), inArray(documents.id, input.evidenceDocumentIds)));
        if (evidenceRows.length !== input.evidenceDocumentIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "As evidências do reagendamento precisam estar anexadas a esta veiculação." });
      }
      const [updated] = await transaction.update(mediaCampaigns).set({ name: input.name, startsOn: input.startsOn, endsOn: input.endsOn, partnershipType: input.partnershipType, estimatedCost: input.estimatedCost.toFixed(2), notes: input.notes || null, campaignDetails: input.campaignDetails || null, mediaServiceCatalogId: input.mediaServiceCatalogId ?? source.mediaServiceCatalogId, subserviceTypeId: input.subserviceTypeId ?? source.subserviceTypeId, productTypeId: input.productTypeId ?? source.productTypeId, rescheduleReason: input.rescheduleReason || "Reagendamento de veiculação", status: campaignStatusFor(input.startsOn), updatedAt: new Date() }).where(eq(mediaCampaigns.id, source.id)).returning();
      return { source, updated };
    });
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_campaign", entityId: result.updated.id, action: "reschedule", beforeData: result.source, afterData: { ...result.updated, rescheduleReason: input.rescheduleReason || "Reagendamento de veiculação", evidenceDocumentIds: input.evidenceDocumentIds } });
    return result.updated;
  }),
  saveDebrief: protectedProcedure.input(z.object({ campaignId: z.number().int().positive(), rating: z.number().int().min(1).max(5), resultAchieved: z.boolean(), feedback: z.string().trim().min(3).max(4000), debriefHistory: z.string().trim().max(4000).optional(), debriefResult: z.string().trim().max(4000).optional(), debriefEvaluation: z.string().trim().max(4000).optional(), debriefLearnings: z.string().trim().max(4000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    const database = await requireDatabase();
    const [before] = await database.select().from(mediaCampaigns).where(eq(mediaCampaigns.id, input.campaignId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada." });
    const [saved] = await database.update(mediaCampaigns).set({ rating: input.rating, resultAchieved: input.resultAchieved, feedback: input.feedback, debriefHistory: input.debriefHistory || null, debriefResult: input.debriefResult || null, debriefEvaluation: input.debriefEvaluation || null, debriefLearnings: input.debriefLearnings || null, debriefAt: new Date(), updatedAt: new Date() }).where(eq(mediaCampaigns.id, input.campaignId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_campaign", entityId: saved.id, action: "save_debrief", beforeData: before, afterData: saved });
    return saved;
  }),
  listSpecializedData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "media.read");
    const database = await requireDatabase();
    const [spots, runs, influencerRows, groups, memberships, posts, campaignRows] = await Promise.all([
      database.select().from(mediaSpots).orderBy(desc(mediaSpots.active), desc(mediaSpots.updatedAt)),
      database.select().from(soundCarRuns).orderBy(desc(soundCarRuns.drivenOn), desc(soundCarRuns.createdAt)),
      database.select().from(influencers).orderBy(desc(influencers.active), asc(influencers.name)),
      database.select().from(influencerGroups).orderBy(desc(influencerGroups.active), asc(influencerGroups.name)),
      database.select().from(influencerGroupMembers),
      database.select().from(influencerPosts).orderBy(desc(influencerPosts.scheduledFor)),
      database.select({ id: tradeCampaigns.id, name: tradeCampaigns.name }).from(tradeCampaigns).orderBy(desc(tradeCampaigns.startsAt)),
    ]);
    return { spots, runs, influencers: influencerRows, groups, memberships, posts, campaigns: campaignRows };
  }),
  createSpot: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(180), notes: z.string().trim().max(2000).optional(), active: z.boolean().default(true) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    const database = await requireDatabase();
    const [created] = await database.insert(mediaSpots).values({ name: input.name, notes: input.notes || null, active: input.active, createdByUserId: ctx.user.id }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_spot", entityId: created.id, action: "create", afterData: created });
    return created;
  }),
  uploadSpot: protectedProcedure.input(z.object({ spotId: z.number().int().positive(), originalName: z.string().trim().min(1).max(255), mimeType: z.enum(spotMimeTypes), dataBase64: z.string().min(1).max(70_000_000) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    const database = await requireDatabase();
    const [spot] = await database.select().from(mediaSpots).where(eq(mediaSpots.id, input.spotId)).limit(1);
    if (!spot) throw new TRPCError({ code: "NOT_FOUND", message: "Spot não encontrado." });
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (!bytes.length || bytes.length > 50 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "O spot deve ter até 50 MB." });
    const stored = await storagePut(`trade/media/spots/${spot.id}/${Date.now()}-${safeFileName(input.originalName)}`, bytes, input.mimeType);
    const [updated] = await database.update(mediaSpots).set({ storageKey: stored.key, url: stored.url, mimeType: input.mimeType, updatedAt: new Date() }).where(eq(mediaSpots.id, spot.id)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_spot", entityId: spot.id, action: "upload", beforeData: spot, afterData: updated });
    return updated;
  }),
  uploadEvidenceFile: protectedProcedure.input(z.object({ originalName: z.string().trim().min(1).max(255), mimeType: z.enum(mediaEvidenceMimeTypes), dataBase64: z.string().min(1).max(70_000_000) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (!bytes.length || bytes.length > 50 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "A evidência deve ter até 50 MB." });
    const stored = await storagePut(`trade/media/evidence/${ctx.user.id}/${Date.now()}-${safeFileName(input.originalName)}`, bytes, input.mimeType);
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_evidence_upload", entityId: ctx.user.id, action: "upload", afterData: { originalName: input.originalName, mimeType: input.mimeType, storageKey: stored.key } });
    return { url: stored.url, storageKey: stored.key, originalName: input.originalName, mimeType: input.mimeType };
  }),
  updateSpot: protectedProcedure.input(z.object({ spotId: z.number().int().positive(), name: z.string().trim().min(2).max(180).optional(), notes: z.string().trim().max(2000).nullable().optional(), active: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    const database = await requireDatabase();
    const [before] = await database.select().from(mediaSpots).where(eq(mediaSpots.id, input.spotId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Spot não encontrado." });
    const [updated] = await database.update(mediaSpots).set({ name: input.name ?? before.name, notes: input.notes === undefined ? before.notes : input.notes, active: input.active ?? before.active, updatedAt: new Date() }).where(eq(mediaSpots.id, before.id)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "media_spot", entityId: before.id, action: "update", beforeData: before, afterData: updated });
    return updated;
  }),
  createSoundCarRun: protectedProcedure.input(z.object({ mediaCampaignId: z.number().int().positive(), drivenOn: z.string().date(), startsAt: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(), endsAt: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(), route: z.string().trim().max(3000).optional(), notes: z.string().trim().max(3000).optional(), evidenceUrls: z.array(z.string().url()).max(12).default([]) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    const database = await requireDatabase();
    const [campaign] = await database.select({ id: mediaCampaigns.id }).from(mediaCampaigns).where(eq(mediaCampaigns.id, input.mediaCampaignId)).limit(1);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha de mídia não encontrada." });
    const [created] = await database.insert(soundCarRuns).values({ ...input, startsAt: input.startsAt || null, endsAt: input.endsAt || null, route: input.route || null, notes: input.notes || null, createdByUserId: ctx.user.id }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "sound_car_run", entityId: created.id, action: "create", afterData: created });
    return created;
  }),
  createInfluencer: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(180), phone: z.string().trim().max(32).optional(), email: z.string().trim().email().max(320).optional(), socialHandle: z.string().trim().max(180).optional(), paymentMethod: z.string().trim().max(80).optional(), paymentFrequency: z.string().trim().max(80).optional(), paymentDay: z.number().int().min(1).max(31).nullable().optional(), notes: z.string().trim().max(3000).optional(), active: z.boolean().default(true) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    const database = await requireDatabase();
    const [created] = await database.insert(influencers).values({ ...input, phone: input.phone || null, email: input.email || null, socialHandle: input.socialHandle || null, paymentMethod: input.paymentMethod || null, paymentFrequency: input.paymentFrequency || null, paymentDay: input.paymentDay ?? null, notes: input.notes || null }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "influencer", entityId: created.id, action: "create", afterData: created });
    return created;
  }),
  updateInfluencer: protectedProcedure.input(z.object({ influencerId: z.number().int().positive(), name: z.string().trim().min(2).max(180), phone: z.string().trim().max(32).nullable().optional(), email: z.string().trim().email().max(320).nullable().optional(), socialHandle: z.string().trim().max(180).nullable().optional(), paymentMethod: z.string().trim().max(80).nullable().optional(), paymentFrequency: z.string().trim().max(80).nullable().optional(), paymentDay: z.number().int().min(1).max(31).nullable().optional(), notes: z.string().trim().max(3000).nullable().optional(), active: z.boolean() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    const database = await requireDatabase();
    const [before] = await database.select().from(influencers).where(eq(influencers.id, input.influencerId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Influencer não encontrado." });
    const { influencerId: _influencerId, ...changes } = input;
    const [updated] = await database.update(influencers).set({ ...changes, updatedAt: new Date() }).where(eq(influencers.id, before.id)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "influencer", entityId: before.id, action: "update", beforeData: before, afterData: updated });
    return updated;
  }),
  createInfluencerGroup: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(180), weekday: z.number().int().min(0).max(6).nullable().optional(), notes: z.string().trim().max(2000).optional(), influencerIds: z.array(z.number().int().positive()).max(100).default([]) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    const database = await requireDatabase();
    if (new Set(input.influencerIds).size !== input.influencerIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Inclua cada influencer apenas uma vez no grupo." });
    const [group] = await database.insert(influencerGroups).values({ name: input.name, weekday: input.weekday ?? null, notes: input.notes || null }).returning();
    if (input.influencerIds.length) await database.insert(influencerGroupMembers).values(input.influencerIds.map(influencerId => ({ influencerGroupId: group.id, influencerId })));
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "influencer_group", entityId: group.id, action: "create", afterData: { ...group, influencerIds: input.influencerIds } });
    return group;
  }),
  createInfluencerPost: protectedProcedure.input(z.object({ influencerId: z.number().int().positive(), influencerGroupId: z.number().int().positive().nullable().optional(), tradeCampaignId: z.number().int().positive().nullable().optional(), scheduledFor: z.coerce.date(), platform: z.string().trim().max(80).optional(), deliverable: z.string().trim().max(3000).optional(), notes: z.string().trim().max(3000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    const database = await requireDatabase();
    const [created] = await database.insert(influencerPosts).values({ ...input, influencerGroupId: input.influencerGroupId ?? null, tradeCampaignId: input.tradeCampaignId ?? null, platform: input.platform || null, deliverable: input.deliverable || null, notes: input.notes || null }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "influencer_post", entityId: created.id, action: "schedule", afterData: created });
    return created;
  }),
  confirmInfluencerPost: protectedProcedure.input(z.object({ postId: z.number().int().positive(), publicationConfirmed: z.boolean(), evidenceUrls: z.array(z.string().url()).max(12).default([]), notes: z.string().trim().max(3000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "media.write");
    const database = await requireDatabase();
    const [before] = await database.select().from(influencerPosts).where(eq(influencerPosts.id, input.postId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Postagem não encontrada." });
    const [updated] = await database.update(influencerPosts).set({ publicationConfirmed: input.publicationConfirmed, status: input.publicationConfirmed ? "published" : before.status, publishedAt: input.publicationConfirmed ? new Date() : null, evidenceUrls: input.evidenceUrls, notes: input.notes || before.notes, updatedAt: new Date() }).where(eq(influencerPosts.id, before.id)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "influencer_post", entityId: before.id, action: "confirm_publication", beforeData: before, afterData: updated });
    return updated;
  }),
});
