import { and, asc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { actions, campaignCities, campaignPromotionPlans, campaignPromotions, campaignTemplatePromotionPlans, campaignTemplatePromotions, campaignTemplates, cities, events, mediaCampaigns, providers, regionals, tradeCampaigns } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { protectedProcedure, router } from "../_core/trpc";

const campaignStatus = ["scheduled", "active", "completed", "cancelled"] as const;
const imageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

const planInput = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1_000).optional(),
  price: z.coerce.number().min(0).max(99_999_999),
  unit: z.string().trim().min(1).max(48).optional(),
  active: z.boolean().default(true),
});
const promotionInput = z.object({
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(2_000).optional(),
  active: z.boolean().default(true),
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
  regionalId: z.number().int().positive().nullable(),
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
  if (input.regionalId) {
    const [regional] = await database.select({ id: regionals.id, providerId: regionals.providerId }).from(regionals).where(and(eq(regionals.id, input.regionalId), eq(regionals.active, true))).limit(1);
    if (!regional) throw new TRPCError({ code: "BAD_REQUEST", message: "Regional inexistente ou inativa." });
    if (input.providerId && regional.providerId !== input.providerId) throw new TRPCError({ code: "BAD_REQUEST", message: "A regional selecionada não pertence à empresa informada." });
  }
  const cityIds = uniqueIds(input.cityIds);
  if (cityIds.length) {
    const cityRows = await database.select({ id: cities.id, regionalId: cities.regionalId, providerId: regionals.providerId }).from(cities).innerJoin(regionals, eq(cities.regionalId, regionals.id)).where(and(inArray(cities.id, cityIds), eq(cities.active, true)));
    if (cityRows.length !== cityIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Uma ou mais cidades selecionadas não existem ou estão inativas." });
    if (input.regionalId && cityRows.some(city => city.regionalId !== input.regionalId)) throw new TRPCError({ code: "BAD_REQUEST", message: "Todas as cidades precisam pertencer à regional selecionada." });
    if (input.providerId && cityRows.some(city => city.providerId !== input.providerId)) throw new TRPCError({ code: "BAD_REQUEST", message: "Todas as cidades precisam pertencer à empresa selecionada." });
  }
  if (input.campaignTemplateId) {
    const [template] = await database.select({ id: campaignTemplates.id }).from(campaignTemplates).where(and(eq(campaignTemplates.id, input.campaignTemplateId), eq(campaignTemplates.active, true))).limit(1);
    if (!template) throw new TRPCError({ code: "BAD_REQUEST", message: "Modelo de campanha inexistente ou inativo." });
  }
}

type MutationDatabase = Pick<Awaited<ReturnType<typeof requireDatabase>>, "delete" | "insert">;

async function replaceCampaignStructure(database: MutationDatabase, campaignId: number, cityIds: number[], promotions: z.infer<typeof promotionInput>[]) {
  await database.delete(campaignCities).where(eq(campaignCities.campaignId, campaignId));
  const uniqueCityIds = uniqueIds(cityIds);
  if (uniqueCityIds.length) await database.insert(campaignCities).values(uniqueCityIds.map(cityId => ({ campaignId, cityId })));
  await database.delete(campaignPromotions).where(eq(campaignPromotions.campaignId, campaignId));
  for (let promotionIndex = 0; promotionIndex < promotions.length; promotionIndex += 1) {
    const promotion = promotions[promotionIndex];
    const [createdPromotion] = await database.insert(campaignPromotions).values({ campaignId, name: promotion.name, description: promotion.description || null, active: promotion.active, sortOrder: promotionIndex }).returning();
    if (promotion.plans.length) await database.insert(campaignPromotionPlans).values(promotion.plans.map((plan, planIndex) => ({ campaignPromotionId: createdPromotion.id, name: plan.name, description: plan.description || null, price: String(plan.price), unit: plan.unit || "unidade", active: plan.active, sortOrder: planIndex })));
  }
}

async function replaceTemplateStructure(database: MutationDatabase, templateId: number, promotions: z.infer<typeof promotionInput>[]) {
  await database.delete(campaignTemplatePromotions).where(eq(campaignTemplatePromotions.campaignTemplateId, templateId));
  for (let promotionIndex = 0; promotionIndex < promotions.length; promotionIndex += 1) {
    const promotion = promotions[promotionIndex];
    const [createdPromotion] = await database.insert(campaignTemplatePromotions).values({ campaignTemplateId: templateId, name: promotion.name, description: promotion.description || null, active: promotion.active, sortOrder: promotionIndex }).returning();
    if (promotion.plans.length) await database.insert(campaignTemplatePromotionPlans).values(promotion.plans.map((plan, planIndex) => ({ campaignTemplatePromotionId: createdPromotion.id, name: plan.name, description: plan.description || null, price: String(plan.price), unit: plan.unit || "unidade", active: plan.active, sortOrder: planIndex })));
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
    const [regionalRows, cityRows, providerRows] = await Promise.all([
      database.select({ id: regionals.id, name: regionals.name, providerId: regionals.providerId }).from(regionals).where(eq(regionals.active, true)).orderBy(asc(regionals.name)),
      database.select({ id: cities.id, name: cities.name, state: cities.state, regionalId: cities.regionalId, regionalName: regionals.name, providerId: regionals.providerId }).from(cities).innerJoin(regionals, eq(cities.regionalId, regionals.id)).where(eq(cities.active, true)).orderBy(asc(cities.name)),
      database.select({ id: providers.id, name: providers.name, logoUrl: providers.logoUrl }).from(providers).where(eq(providers.active, true)).orderBy(asc(providers.name)),
    ]);
    return { regionals: regionalRows, cities: cityRows, providers: providerRows };
  }),

  list: protectedProcedure.input(z.object({ providerId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.read");
    const database = await requireDatabase();
    const campaignQuery = database.select({ campaign: tradeCampaigns, regionalName: regionals.name, providerName: providers.name, providerLogoUrl: providers.logoUrl, templateName: campaignTemplates.name }).from(tradeCampaigns).leftJoin(regionals, eq(tradeCampaigns.regionalId, regionals.id)).leftJoin(providers, eq(tradeCampaigns.providerId, providers.id)).leftJoin(campaignTemplates, eq(tradeCampaigns.campaignTemplateId, campaignTemplates.id));
    const [campaignRows, actionRows, eventRows, mediaRows, cityRows, promotionRows, planRows] = await Promise.all([
      input?.providerId ? campaignQuery.where(eq(tradeCampaigns.providerId, input.providerId)).orderBy(asc(tradeCampaigns.startsAt), asc(tradeCampaigns.name)) : campaignQuery.orderBy(asc(tradeCampaigns.startsAt), asc(tradeCampaigns.name)),
      database.select({ tradeCampaignId: actions.tradeCampaignId, id: actions.id, name: actions.name, status: actions.status }).from(actions),
      database.select({ tradeCampaignId: events.tradeCampaignId, id: events.id, name: events.name, status: events.status }).from(events),
      database.select({ tradeCampaignId: mediaCampaigns.tradeCampaignId, id: mediaCampaigns.id, name: mediaCampaigns.name, status: mediaCampaigns.status }).from(mediaCampaigns),
      database.select({ campaignId: campaignCities.campaignId, id: cities.id, name: cities.name, state: cities.state, regionalId: cities.regionalId }).from(campaignCities).innerJoin(cities, eq(campaignCities.cityId, cities.id)).orderBy(asc(cities.name)),
      database.select().from(campaignPromotions).orderBy(asc(campaignPromotions.sortOrder), asc(campaignPromotions.name)),
      database.select().from(campaignPromotionPlans).orderBy(asc(campaignPromotionPlans.sortOrder), asc(campaignPromotionPlans.name)),
    ]);
    return campaignRows.map(row => ({
      ...row.campaign,
      regionalName: row.regionalName,
      providerName: row.providerName,
      providerLogoUrl: row.providerLogoUrl,
      templateName: row.templateName,
      cities: cityRows.filter(city => city.campaignId === row.campaign.id),
      promotions: promotionRows.filter(promotion => promotion.campaignId === row.campaign.id).map(promotion => ({ ...promotion, plans: planRows.filter(plan => plan.campaignPromotionId === promotion.id) })),
      actions: actionRows.filter(action => action.tradeCampaignId === row.campaign.id),
      events: eventRows.filter(event => event.tradeCampaignId === row.campaign.id),
      media: mediaRows.filter(media => media.tradeCampaignId === row.campaign.id),
    }));
  }),

  create: protectedProcedure.input(campaignInput).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.write");
    if (!validateDateRange(input.startsAt, input.endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O término da campanha deve ser posterior ao início." });
    const database = await requireDatabase();
    await validateContext(database, input);
    const created = await database.transaction(async transaction => {
      const [campaign] = await transaction.insert(tradeCampaigns).values({ name: input.name, objective: input.objective || null, providerId: input.providerId, regionalId: input.regionalId, campaignTemplateId: input.campaignTemplateId || null, startsAt: input.startsAt, endsAt: input.endsAt, status: input.status, createdByUserId: ctx.user.id }).returning();
      await replaceCampaignStructure(transaction, campaign.id, input.cityIds, input.promotions);
      return campaign;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: input.regionalId ?? undefined, entityType: "trade_campaign", entityId: created.id, action: "create", afterData: { ...created, cityIds: input.cityIds, promotionCount: input.promotions.length } });
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
      const [campaign] = await transaction.update(tradeCampaigns).set({ name: input.name, objective: input.objective || null, providerId: input.providerId, regionalId: input.regionalId, campaignTemplateId: input.campaignTemplateId || null, startsAt: input.startsAt, endsAt: input.endsAt, status: input.status, updatedAt: new Date() }).where(eq(tradeCampaigns.id, input.id)).returning();
      await replaceCampaignStructure(transaction, campaign.id, input.cityIds, input.promotions);
      return campaign;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: input.regionalId ?? undefined, entityType: "trade_campaign", entityId: updated.id, action: "update", beforeData: before, afterData: { ...updated, cityIds: input.cityIds, promotionCount: input.promotions.length } });
    return updated;
  }),

  uploadLogo: protectedProcedure.input(z.object({ campaignId: z.number().int().positive(), originalName: z.string().trim().min(1).max(255), mimeType: z.enum(imageMimeTypes), dataBase64: z.string().min(1).max(4_500_000) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.write");
    const database = await requireDatabase();
    const [campaign] = await database.select().from(tradeCampaigns).where(eq(tradeCampaigns.id, input.campaignId)).limit(1);
    if (!campaign) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada." });
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (!bytes.length || bytes.length > 3 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "A identidade visual deve ter até 3 MB." });
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
