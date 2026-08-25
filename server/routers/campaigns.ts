import { and, asc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { actionTypes, actions, campaignCities, campaignPromotionCities, campaignPromotionPlans, campaignPromotions, campaignRegionals, campaignSectors, campaignTemplatePromotionPlans, campaignTemplatePromotions, campaignTemplates, campaignTypes, cities, documents, events, eventTypes, mediaCampaigns, mediaPoints, mediaTypes, providers, regionals, tradeCampaigns } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { hasSupportedFileSignature, storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

const campaignStatus = ["scheduled", "active", "completed", "cancelled"] as const;
const imageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

const planInput = z.object({
  name: z.string().trim().min(2).max(160),
  speed: z.string().trim().max(96).optional(),
  description: z.string().trim().max(1_000).optional(),
  price: z.coerce.number().min(0).max(99_999_999),
  unit: z.string().trim().min(1).max(48).optional(),
  active: z.boolean().default(true),
});
const promotionInput = z.object({
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2_000).optional(),
  active: z.boolean().default(true),
  cityIds: z.array(z.number().int().positive()).max(200).default([]),
  plans: z.array(planInput).max(24).default([]),
});

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

function validateDateRange(startsAt: Date | null, endsAt: Date | null) {
  return !startsAt || !endsAt || endsAt >= startsAt;
}

const campaignInput = z.object({
  name: z.string().trim().min(2).max(180),
  objective: z.string().trim().max(2_000).optional(),
  providerId: z.number().int().positive().nullable().default(null),
  campaignTypeId: z.number().int().positive().nullable().default(null),
  campaignSectorId: z.number().int().positive().nullable().default(null),
  regionalId: z.number().int().positive().nullable(),
  regionalIds: z.array(z.number().int().positive()).max(40).default([]),
  cityIds: z.array(z.number().int().positive()).max(200).default([]),
  campaignTemplateId: z.number().int().positive().nullable().optional(),
  startsAt: z.coerce.date().nullable(),
  endsAt: z.coerce.date().nullable(),
  status: z.enum(campaignStatus),
  promotions: z.array(promotionInput).max(30).default([]),
});

const templateInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2_000).optional(),
  objective: z.string().trim().max(2_000).optional(),
  defaultStatus: z.enum(campaignStatus),
  defaultDurationDays: z.coerce.number().int().min(1).max(730).nullable(),
  active: z.boolean().default(true),
  promotions: z.array(promotionInput).max(30).default([]),
});

function uniqueIds(ids: number[]) {
  return Array.from(new Set(ids));
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-").slice(0, 160) || "identidade-visual";
}

async function validateContext(database: Awaited<ReturnType<typeof requireDatabase>>, input: z.infer<typeof campaignInput>) {
  if (input.providerId) {
    const [provider] = await database.select({ id: providers.id }).from(providers).where(and(eq(providers.id, input.providerId), eq(providers.active, true))).limit(1);
    if (!provider) throw new TRPCError({ code: "BAD_REQUEST", message: "Empresa inexistente ou inativa." });
  }
  if (input.campaignTypeId) {
    const [campaignType] = await database.select({ id: campaignTypes.id }).from(campaignTypes).where(and(eq(campaignTypes.id, input.campaignTypeId), eq(campaignTypes.active, true))).limit(1);
    if (!campaignType) throw new TRPCError({ code: "BAD_REQUEST", message: "Tipo de campanha inexistente ou inativo." });
  }
  if (input.campaignSectorId) {
    const [campaignSector] = await database.select({ id: campaignSectors.id }).from(campaignSectors).where(and(eq(campaignSectors.id, input.campaignSectorId), eq(campaignSectors.active, true))).limit(1);
    if (!campaignSector) throw new TRPCError({ code: "BAD_REQUEST", message: "Setor de campanha inexistente ou inativo." });
  }
  const regionalIds = uniqueIds([...input.regionalIds, ...(input.regionalId ? [input.regionalId] : [])]);
  if (regionalIds.length) {
    const regionalRows = await database.select({ id: regionals.id, providerId: regionals.providerId }).from(regionals).where(and(inArray(regionals.id, regionalIds), eq(regionals.active, true)));
    if (regionalRows.length !== regionalIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Uma ou mais regionais selecionadas não existem ou estão inativas." });
    if (input.providerId && regionalRows.some(regional => regional.providerId !== input.providerId)) throw new TRPCError({ code: "BAD_REQUEST", message: "Todas as regionais precisam pertencer à empresa selecionada." });
  }
  const cityIds = uniqueIds(input.cityIds);
  if (cityIds.length) {
    const cityRows = await database.select({ id: cities.id, regionalId: cities.regionalId, providerId: regionals.providerId }).from(cities).innerJoin(regionals, eq(cities.regionalId, regionals.id)).where(and(inArray(cities.id, cityIds), eq(cities.active, true)));
    if (cityRows.length !== cityIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Uma ou mais cidades selecionadas não existem ou estão inativas." });
    if (regionalIds.length && cityRows.some(city => !regionalIds.includes(city.regionalId))) throw new TRPCError({ code: "BAD_REQUEST", message: "Todas as cidades precisam pertencer a uma das regionais selecionadas." });
    if (input.providerId && cityRows.some(city => city.providerId !== input.providerId)) throw new TRPCError({ code: "BAD_REQUEST", message: "Todas as cidades precisam pertencer à empresa selecionada." });
  }
  if (input.campaignTemplateId) {
    const [template] = await database.select({ id: campaignTemplates.id }).from(campaignTemplates).where(and(eq(campaignTemplates.id, input.campaignTemplateId), eq(campaignTemplates.active, true))).limit(1);
    if (!template) throw new TRPCError({ code: "BAD_REQUEST", message: "Modelo de campanha inexistente ou inativo." });
  }
  const campaignCityIds = new Set(uniqueIds(input.cityIds));
  if (!campaignCityIds.size) {
    const allScopedCities = await database.select({ id: cities.id, regionalId: cities.regionalId, providerId: regionals.providerId }).from(cities).innerJoin(regionals, eq(cities.regionalId, regionals.id)).where(eq(cities.active, true));
    for (const city of allScopedCities) {
      if ((!input.providerId || city.providerId === input.providerId) && (!regionalIds.length || regionalIds.includes(city.regionalId))) campaignCityIds.add(city.id);
    }
  }
  for (const promotion of input.promotions) {
    const promotionCityIds = uniqueIds(promotion.cityIds);
    if (promotionCityIds.some(cityId => !campaignCityIds.has(cityId))) throw new TRPCError({ code: "BAD_REQUEST", message: "As cidades de uma promoção precisam estar entre as cidades atendidas pela campanha." });
  }
}

type MutationDatabase = Pick<Awaited<ReturnType<typeof requireDatabase>>, "delete" | "insert">;

async function replaceCampaignStructure(database: MutationDatabase, campaignId: number, regionalIds: number[], cityIds: number[], promotions: z.infer<typeof promotionInput>[]) {
  await database.delete(campaignRegionals).where(eq(campaignRegionals.campaignId, campaignId));
  const uniqueRegionalIds = uniqueIds(regionalIds);
  if (uniqueRegionalIds.length) await database.insert(campaignRegionals).values(uniqueRegionalIds.map(regionalId => ({ campaignId, regionalId })));
  await database.delete(campaignCities).where(eq(campaignCities.campaignId, campaignId));
  const uniqueCityIds = uniqueIds(cityIds);
  if (uniqueCityIds.length) await database.insert(campaignCities).values(uniqueCityIds.map(cityId => ({ campaignId, cityId })));
  await database.delete(campaignPromotions).where(eq(campaignPromotions.campaignId, campaignId));
  for (let promotionIndex = 0; promotionIndex < promotions.length; promotionIndex += 1) {
    const promotion = promotions[promotionIndex];
    const [createdPromotion] = await database.insert(campaignPromotions).values({ campaignId, name: promotion.name, description: promotion.description || null, active: promotion.active, sortOrder: promotionIndex }).returning();
    const promotionCityIds = uniqueIds(promotion.cityIds);
    if (promotionCityIds.length) await database.insert(campaignPromotionCities).values(promotionCityIds.map(cityId => ({ campaignPromotionId: createdPromotion.id, cityId })));
    if (promotion.plans.length) await database.insert(campaignPromotionPlans).values(promotion.plans.map((plan, planIndex) => ({ campaignPromotionId: createdPromotion.id, name: plan.name, speed: plan.speed || null, description: plan.description || null, price: String(plan.price), unit: plan.unit || "mês", active: plan.active, sortOrder: planIndex })));
  }
}

async function replaceTemplateStructure(database: MutationDatabase, templateId: number, promotions: z.infer<typeof promotionInput>[]) {
  await database.delete(campaignTemplatePromotions).where(eq(campaignTemplatePromotions.campaignTemplateId, templateId));
  for (let promotionIndex = 0; promotionIndex < promotions.length; promotionIndex += 1) {
    const promotion = promotions[promotionIndex];
    const [createdPromotion] = await database.insert(campaignTemplatePromotions).values({ campaignTemplateId: templateId, name: promotion.name, description: promotion.description || null, active: promotion.active, sortOrder: promotionIndex }).returning();
    if (promotion.plans.length) await database.insert(campaignTemplatePromotionPlans).values(promotion.plans.map((plan, planIndex) => ({ campaignTemplatePromotionId: createdPromotion.id, name: plan.name, speed: plan.speed || null, description: plan.description || null, price: String(plan.price), unit: plan.unit || "mês", active: plan.active, sortOrder: planIndex })));
  }
}

async function templateDetails(database: Awaited<ReturnType<typeof requireDatabase>>) {
  const [templates, promotions, plans] = await Promise.all([
    database.select().from(campaignTemplates).orderBy(asc(campaignTemplates.name)),
    database.select().from(campaignTemplatePromotions).orderBy(asc(campaignTemplatePromotions.sortOrder), asc(campaignTemplatePromotions.name)),
    database.select().from(campaignTemplatePromotionPlans).orderBy(asc(campaignTemplatePromotionPlans.sortOrder), asc(campaignTemplatePromotionPlans.name)),
  ]);
  return templates.map(template => ({ ...template, promotions: promotions.filter(promotion => promotion.campaignTemplateId === template.id).map(promotion => ({ ...promotion, plans: plans.filter(plan => plan.campaignTemplatePromotionId === promotion.id) })) }));
}

export const campaignsRouter = router({
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "actions.read");
    const database = await requireDatabase();
    const [regionalRows, cityRows, providerRows, campaignTypeRows, campaignSectorRows] = await Promise.all([
      database.select({ id: regionals.id, name: regionals.name, providerId: regionals.providerId }).from(regionals).where(eq(regionals.active, true)).orderBy(asc(regionals.name)).catch(() => []),
      database.select({ id: cities.id, name: cities.name, state: cities.state, regionalId: cities.regionalId, regionalName: regionals.name, providerId: regionals.providerId }).from(cities).innerJoin(regionals, eq(cities.regionalId, regionals.id)).where(eq(cities.active, true)).orderBy(asc(cities.name)).catch(() => []),
      database.select({ id: providers.id, name: providers.name, logoUrl: providers.logoUrl }).from(providers).where(eq(providers.active, true)).orderBy(asc(providers.name)).catch(() => []),
      database.select({ id: campaignTypes.id, name: campaignTypes.name }).from(campaignTypes).where(eq(campaignTypes.active, true)).orderBy(asc(campaignTypes.name)).catch(() => []),
      database.select({ id: campaignSectors.id, name: campaignSectors.name }).from(campaignSectors).where(eq(campaignSectors.active, true)).orderBy(asc(campaignSectors.name)).catch(() => []),
    ]);
    return { regionals: regionalRows, cities: cityRows, providers: providerRows, campaignTypes: campaignTypeRows, campaignSectors: campaignSectorRows };
  }),

  list: protectedProcedure.input(z.object({ providerId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.read");
    const database = await requireDatabase();
    const campaignQuery = database.select({ campaign: tradeCampaigns, regionalName: regionals.name, providerName: providers.name, providerLogoUrl: providers.logoUrl, campaignTypeName: campaignTypes.name, campaignSectorName: campaignSectors.name, templateName: campaignTemplates.name }).from(tradeCampaigns).leftJoin(regionals, eq(tradeCampaigns.regionalId, regionals.id)).leftJoin(providers, eq(tradeCampaigns.providerId, providers.id)).leftJoin(campaignTypes, eq(tradeCampaigns.campaignTypeId, campaignTypes.id)).leftJoin(campaignSectors, eq(tradeCampaigns.campaignSectorId, campaignSectors.id)).leftJoin(campaignTemplates, eq(tradeCampaigns.campaignTemplateId, campaignTemplates.id));
    const [campaignRows, actionRows, eventRows, mediaRows, cityRows, campaignRegionalRows, availableCityRows, promotionRows, promotionCityRows, planRows, operationImageRows] = await Promise.all([
      input?.providerId ? campaignQuery.where(eq(tradeCampaigns.providerId, input.providerId)).orderBy(asc(tradeCampaigns.startsAt), asc(tradeCampaigns.name)) : campaignQuery.orderBy(asc(tradeCampaigns.startsAt), asc(tradeCampaigns.name)),
      database.select({ tradeCampaignId: actions.tradeCampaignId, id: actions.id, name: actions.name, status: actions.status, cityName: cities.name, typeName: actionTypes.name, startsAt: actions.scheduledFor }).from(actions).innerJoin(cities, eq(actions.cityId, cities.id)).innerJoin(actionTypes, eq(actions.actionTypeId, actionTypes.id)),
      database.select({ tradeCampaignId: events.tradeCampaignId, id: events.id, name: events.name, status: events.status, cityName: cities.name, typeName: eventTypes.name, startsAt: events.startsAt }).from(events).innerJoin(cities, eq(events.cityId, cities.id)).innerJoin(eventTypes, eq(events.eventTypeId, eventTypes.id)),
      database.select({ tradeCampaignId: mediaCampaigns.tradeCampaignId, id: mediaCampaigns.id, name: mediaCampaigns.name, status: mediaCampaigns.status, startsOn: mediaCampaigns.startsOn, endsOn: mediaCampaigns.endsOn, partnershipType: mediaCampaigns.partnershipType, estimatedCost: mediaCampaigns.estimatedCost, mediaPointId: mediaCampaigns.mediaPointId, notes: mediaCampaigns.notes, campaignDetails: mediaCampaigns.campaignDetails, cityName: cities.name, typeName: mediaTypes.name }).from(mediaCampaigns).innerJoin(mediaPoints, eq(mediaCampaigns.mediaPointId, mediaPoints.id)).innerJoin(cities, eq(mediaPoints.cityId, cities.id)).innerJoin(mediaTypes, eq(mediaPoints.mediaTypeId, mediaTypes.id)),
      database.select({ campaignId: campaignCities.campaignId, id: cities.id, name: cities.name, state: cities.state, regionalId: cities.regionalId }).from(campaignCities).innerJoin(cities, eq(campaignCities.cityId, cities.id)).orderBy(asc(cities.name)),
      database.select({ campaignId: campaignRegionals.campaignId, id: regionals.id, name: regionals.name, providerId: regionals.providerId }).from(campaignRegionals).innerJoin(regionals, eq(campaignRegionals.regionalId, regionals.id)).orderBy(asc(regionals.name)),
      database.select({ id: cities.id, name: cities.name, state: cities.state, regionalId: cities.regionalId, providerId: regionals.providerId }).from(cities).innerJoin(regionals, eq(cities.regionalId, regionals.id)).where(eq(cities.active, true)).orderBy(asc(cities.name)),
      database.select().from(campaignPromotions).orderBy(asc(campaignPromotions.sortOrder), asc(campaignPromotions.name)),
      database.select({ campaignPromotionId: campaignPromotionCities.campaignPromotionId, id: cities.id, name: cities.name, state: cities.state }).from(campaignPromotionCities).innerJoin(cities, eq(campaignPromotionCities.cityId, cities.id)).orderBy(asc(cities.name)),
      database.select().from(campaignPromotionPlans).orderBy(asc(campaignPromotionPlans.sortOrder), asc(campaignPromotionPlans.name)),
      database.select({ entityType: documents.entityType, entityId: documents.entityId, url: documents.url }).from(documents).where(and(inArray(documents.entityType, ["action", "event", "media_campaign"]), inArray(documents.mimeType, [...imageMimeTypes]))).orderBy(asc(documents.createdAt)),
    ]);
    return campaignRows.map(row => {
      const linkedRegionals = campaignRegionalRows.filter(regional => regional.campaignId === row.campaign.id);
      const regionalIds = uniqueIds([...linkedRegionals.map(regional => regional.id), ...(row.campaign.regionalId ? [row.campaign.regionalId] : [])]);
      const explicitCities = cityRows.filter(city => city.campaignId === row.campaign.id);
      const coverageCities = explicitCities.length ? explicitCities : availableCityRows.filter(city => (!row.campaign.providerId || city.providerId === row.campaign.providerId) && (!regionalIds.length || regionalIds.includes(city.regionalId)));
      return {
        ...row.campaign,
        regionalName: row.regionalName,
        regionals: linkedRegionals,
        providerName: row.providerName,
        providerLogoUrl: row.providerLogoUrl,
        campaignTypeName: row.campaignTypeName,
        campaignSectorName: row.campaignSectorName,
        templateName: row.templateName,
        cities: coverageCities,
        hasExplicitCities: explicitCities.length > 0,
        promotions: promotionRows.filter(promotion => promotion.campaignId === row.campaign.id).map(promotion => ({ ...promotion, cities: promotionCityRows.filter(city => city.campaignPromotionId === promotion.id), plans: planRows.filter(plan => plan.campaignPromotionId === promotion.id) })),
        actions: actionRows.filter(action => action.tradeCampaignId === row.campaign.id).map(action => ({ ...action, imageUrl: operationImageRows.find(image => image.entityType === "action" && image.entityId === action.id)?.url ?? null })),
        events: eventRows.filter(event => event.tradeCampaignId === row.campaign.id).map(event => ({ ...event, imageUrl: operationImageRows.find(image => image.entityType === "event" && image.entityId === event.id)?.url ?? null })),
        media: mediaRows.filter(media => media.tradeCampaignId === row.campaign.id).map(media => ({ ...media, imageUrl: operationImageRows.find(image => image.entityType === "media_campaign" && image.entityId === media.id)?.url ?? null })),
      };
    });
  }),

  create: protectedProcedure.input(campaignInput).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.write");
    if (!validateDateRange(input.startsAt, input.endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O término da campanha deve ser posterior ao início." });
    const database = await requireDatabase();
    await validateContext(database, input);
    const created = await database.transaction(async transaction => {
      const regionalIds = uniqueIds([...input.regionalIds, ...(input.regionalId ? [input.regionalId] : [])]);
      const [campaign] = await transaction.insert(tradeCampaigns).values({ name: input.name, objective: input.objective || null, providerId: input.providerId, campaignTypeId: input.campaignTypeId, campaignSectorId: input.campaignSectorId, regionalId: regionalIds[0] ?? null, campaignTemplateId: input.campaignTemplateId || null, startsAt: input.startsAt, endsAt: input.endsAt, status: input.status, createdByUserId: ctx.user.id }).returning();
      await replaceCampaignStructure(transaction, campaign.id, regionalIds, input.cityIds, input.promotions);
      return campaign;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: input.regionalId ?? input.regionalIds[0], entityType: "trade_campaign", entityId: created.id, action: "create", afterData: { ...created, regionalIds: input.regionalIds, cityIds: input.cityIds, promotionCount: input.promotions.length } });
    return created;
  }),

  update: protectedProcedure.input(campaignInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.write");
    if (!validateDateRange(input.startsAt, input.endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O término da campanha deve ser posterior ao início." });
    const database = await requireDatabase();
    const [before] = await database.select().from(tradeCampaigns).where(eq(tradeCampaigns.id, input.id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada." });
    await validateContext(database, input);
    const updated = await database.transaction(async transaction => {
      const regionalIds = uniqueIds([...input.regionalIds, ...(input.regionalId ? [input.regionalId] : [])]);
      const [campaign] = await transaction.update(tradeCampaigns).set({ name: input.name, objective: input.objective || null, providerId: input.providerId, campaignTypeId: input.campaignTypeId, campaignSectorId: input.campaignSectorId, regionalId: regionalIds[0] ?? null, campaignTemplateId: input.campaignTemplateId || null, startsAt: input.startsAt, endsAt: input.endsAt, status: input.status, updatedAt: new Date() }).where(eq(tradeCampaigns.id, input.id)).returning();
      await replaceCampaignStructure(transaction, campaign.id, regionalIds, input.cityIds, input.promotions);
      return campaign;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: input.regionalId ?? input.regionalIds[0], entityType: "trade_campaign", entityId: updated.id, action: "update", beforeData: before, afterData: { ...updated, regionalIds: input.regionalIds, cityIds: input.cityIds, promotionCount: input.promotions.length } });
    return updated;
  }),

  renew: protectedProcedure.input(z.object({ campaignId: z.number().int().positive(), startsAt: z.coerce.date(), endsAt: z.coerce.date() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.write");
    if (!validateDateRange(input.startsAt, input.endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O término da renovação deve ser posterior ao início." });
    const database = await requireDatabase();
    const [before] = await database.select().from(tradeCampaigns).where(eq(tradeCampaigns.id, input.campaignId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada." });
    const [updated] = await database.update(tradeCampaigns).set({ startsAt: input.startsAt, endsAt: input.endsAt, status: "active", updatedAt: new Date() }).where(eq(tradeCampaigns.id, input.campaignId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: before.regionalId ?? undefined, entityType: "trade_campaign", entityId: before.id, action: "renew", beforeData: { startsAt: before.startsAt, endsAt: before.endsAt, status: before.status }, afterData: { startsAt: updated.startsAt, endsAt: updated.endsAt, status: updated.status } });
    return updated;
  }),

  uploadLogo: protectedProcedure.input(z.object({ campaignId: z.number().int().positive(), originalName: z.string().trim().min(1).max(255), mimeType: z.enum(imageMimeTypes), dataBase64: z.string().min(1).max(4_500_000) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.write");
    const database = await requireDatabase();
    const [campaign] = await database.select().from(tradeCampaigns).where(eq(tradeCampaigns.id, input.campaignId)).limit(1);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada." });
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (!bytes.length || bytes.length > 3 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "A identidade visual deve ter até 3 MB." });
    if (!hasSupportedFileSignature(bytes, input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "O conteúdo do logo não corresponde ao formato informado." });
    const stored = await storagePut(`trade/campaigns/${campaign.id}/logo-${Date.now()}-${safeFileName(input.originalName)}`, bytes, input.mimeType);
    const [updated] = await database.update(tradeCampaigns).set({ logoStorageKey: stored.key, logoUrl: stored.url, updatedAt: new Date() }).where(eq(tradeCampaigns.id, campaign.id)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: campaign.regionalId ?? undefined, entityType: "trade_campaign", entityId: campaign.id, action: "upload_logo", beforeData: { logoStorageKey: campaign.logoStorageKey }, afterData: { logoStorageKey: updated.logoStorageKey } });
    return updated;
  }),

  saveDebrief: protectedProcedure.input(z.object({ campaignId: z.number().int().positive(), rating: z.number().int().min(1).max(5), notes: z.string().trim().max(4_000).optional(), result: z.string().trim().max(2_000).optional(), completedAt: z.coerce.date() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.write");
    const database = await requireDatabase();
    const [before] = await database.select().from(tradeCampaigns).where(eq(tradeCampaigns.id, input.campaignId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada." });
    const [updated] = await database.update(tradeCampaigns).set({ debriefRating: input.rating, debriefNotes: input.notes || null, debriefResult: input.result || null, debriefAt: input.completedAt, updatedAt: new Date() }).where(eq(tradeCampaigns.id, input.campaignId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: before.regionalId ?? undefined, entityType: "trade_campaign", entityId: before.id, action: "save_debrief", beforeData: { debriefRating: before.debriefRating, debriefAt: before.debriefAt }, afterData: { debriefRating: updated.debriefRating, debriefAt: updated.debriefAt } });
    return updated;
  }),

  savePromotionCities: protectedProcedure.input(z.object({ promotionId: z.number().int().positive(), cityIds: z.array(z.number().int().positive()).max(200).default([]) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.write");
    const database = await requireDatabase();
    const [promotion] = await database.select({ id: campaignPromotions.id, campaignId: campaignPromotions.campaignId, providerId: tradeCampaigns.providerId, regionalId: tradeCampaigns.regionalId }).from(campaignPromotions).innerJoin(tradeCampaigns, eq(campaignPromotions.campaignId, tradeCampaigns.id)).where(eq(campaignPromotions.id, input.promotionId)).limit(1);
    if (!promotion) throw new TRPCError({ code: "NOT_FOUND", message: "Promoção não encontrada." });
    const cityIds = uniqueIds(input.cityIds);
    if (cityIds.length) {
      const [explicitCities, linkedRegionals, candidateCities] = await Promise.all([
        database.select({ cityId: campaignCities.cityId }).from(campaignCities).where(eq(campaignCities.campaignId, promotion.campaignId)),
        database.select({ regionalId: campaignRegionals.regionalId }).from(campaignRegionals).where(eq(campaignRegionals.campaignId, promotion.campaignId)),
        database.select({ cityId: cities.id, regionalId: cities.regionalId, providerId: regionals.providerId }).from(cities).innerJoin(regionals, eq(cities.regionalId, regionals.id)).where(and(inArray(cities.id, cityIds), eq(cities.active, true))),
      ]);
      const scopedRegionalIds = uniqueIds([...linkedRegionals.map(regional => regional.regionalId), ...(promotion.regionalId ? [promotion.regionalId] : [])]);
      const explicitCityIds = new Set(explicitCities.map(city => city.cityId));
      const eligibleCities = explicitCityIds.size
        ? candidateCities.filter(city => explicitCityIds.has(city.cityId))
        : candidateCities.filter(city => (!promotion.providerId || city.providerId === promotion.providerId) && (!scopedRegionalIds.length || scopedRegionalIds.includes(city.regionalId)));
      if (eligibleCities.length !== cityIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "As cidades escolhidas precisam fazer parte da segmentação da campanha." });
    }
    await database.transaction(async transaction => {
      await transaction.delete(campaignPromotionCities).where(eq(campaignPromotionCities.campaignPromotionId, promotion.id));
      if (cityIds.length) await transaction.insert(campaignPromotionCities).values(cityIds.map(cityId => ({ campaignPromotionId: promotion.id, cityId })));
    });
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "campaign_promotion", entityId: promotion.id, action: "update_cities", afterData: { cityIds } });
    return { success: true, cityIds };
  }),

  listTemplates: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "actions.read");
    return templateDetails(await requireDatabase());
  }),

  applyTemplate: protectedProcedure.input(z.object({ templateId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.read");
    const template = (await templateDetails(await requireDatabase())).find(item => item.id === input.templateId && item.active);
    if (!template) throw new TRPCError({ code: "NOT_FOUND", message: "Modelo de campanha não encontrado ou inativo." });
    return template;
  }),

  saveTemplate: protectedProcedure.input(templateInput).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    if (input.id) {
      const [before] = await database.select().from(campaignTemplates).where(eq(campaignTemplates.id, input.id)).limit(1);
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Modelo de campanha não encontrado." });
      const updated = await database.transaction(async transaction => {
        const [template] = await transaction.update(campaignTemplates).set({ name: input.name, description: input.description || null, objective: input.objective || null, defaultStatus: input.defaultStatus, defaultDurationDays: input.defaultDurationDays, active: input.active, updatedAt: new Date() }).where(eq(campaignTemplates.id, input.id!)).returning();
        await replaceTemplateStructure(transaction, template.id, input.promotions);
        return template;
      });
      await writeAuditLog({ actorUserId: ctx.user.id, entityType: "campaign_template", entityId: updated.id, action: "update", beforeData: before, afterData: { ...updated, promotionCount: input.promotions.length } });
      return updated;
    }
    const created = await database.transaction(async transaction => {
      const [template] = await transaction.insert(campaignTemplates).values({ name: input.name, description: input.description || null, objective: input.objective || null, defaultStatus: input.defaultStatus, defaultDurationDays: input.defaultDurationDays, active: input.active, createdByUserId: ctx.user.id }).returning();
      await replaceTemplateStructure(transaction, template.id, input.promotions);
      return template;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "campaign_template", entityId: created.id, action: "create", afterData: { ...created, promotionCount: input.promotions.length } });
    return created;
  }),

  deleteTemplate: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [before] = await database.select().from(campaignTemplates).where(eq(campaignTemplates.id, input.id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Modelo de campanha não encontrado." });
    await database.delete(campaignTemplates).where(eq(campaignTemplates.id, input.id));
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "campaign_template", entityId: input.id, action: "delete", beforeData: before });
    return { success: true };
  }),
});
