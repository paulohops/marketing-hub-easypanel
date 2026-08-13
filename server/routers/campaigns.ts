import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { actions, events, mediaCampaigns, regionals, tradeCampaigns } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const campaignStatus = ["scheduled", "active", "completed", "cancelled"] as const;

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
  regionalId: z.number().int().positive().nullable(),
  startsAt: z.coerce.date().nullable(),
  endsAt: z.coerce.date().nullable(),
  status: z.enum(campaignStatus),
});

export const campaignsRouter = router({
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "actions.read");
    const database = await requireDatabase();
    const regionalRows = await database.select().from(regionals).where(eq(regionals.active, true)).orderBy(asc(regionals.name));
    return { regionals: regionalRows };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "actions.read");
    const database = await requireDatabase();
    const [campaignRows, actionRows, eventRows, mediaRows] = await Promise.all([
      database.select({ campaign: tradeCampaigns, regionalName: regionals.name }).from(tradeCampaigns).leftJoin(regionals, eq(tradeCampaigns.regionalId, regionals.id)).orderBy(asc(tradeCampaigns.startsAt), asc(tradeCampaigns.name)),
      database.select({ tradeCampaignId: actions.tradeCampaignId, id: actions.id, name: actions.name, status: actions.status }).from(actions),
      database.select({ tradeCampaignId: events.tradeCampaignId, id: events.id, name: events.name, status: events.status }).from(events),
      database.select({ tradeCampaignId: mediaCampaigns.tradeCampaignId, id: mediaCampaigns.id, name: mediaCampaigns.name, status: mediaCampaigns.status }).from(mediaCampaigns),
    ]);
    return campaignRows.map(row => ({
      ...row.campaign,
      regionalName: row.regionalName,
      actions: actionRows.filter(action => action.tradeCampaignId === row.campaign.id),
      events: eventRows.filter(event => event.tradeCampaignId === row.campaign.id),
      media: mediaRows.filter(media => media.tradeCampaignId === row.campaign.id),
    }));
  }),

  create: protectedProcedure.input(campaignInput).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.write");
    if (!validateDateRange(input.startsAt, input.endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O término da campanha deve ser posterior ao início." });
    const database = await requireDatabase();
    if (input.regionalId) {
      const [regional] = await database.select({ id: regionals.id }).from(regionals).where(and(eq(regionals.id, input.regionalId), eq(regionals.active, true))).limit(1);
      if (!regional) throw new TRPCError({ code: "BAD_REQUEST", message: "Regional inexistente ou inativa." });
    }
    const [created] = await database.insert(tradeCampaigns).values({ ...input, objective: input.objective || null, createdByUserId: ctx.user.id }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: input.regionalId ?? undefined, entityType: "trade_campaign", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  update: protectedProcedure.input(campaignInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "actions.write");
    if (!validateDateRange(input.startsAt, input.endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "O término da campanha deve ser posterior ao início." });
    const database = await requireDatabase();
    const [before] = await database.select().from(tradeCampaigns).where(eq(tradeCampaigns.id, input.id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Campanha não encontrada." });
    if (input.regionalId) {
      const [regional] = await database.select({ id: regionals.id }).from(regionals).where(and(eq(regionals.id, input.regionalId), eq(regionals.active, true))).limit(1);
      if (!regional) throw new TRPCError({ code: "BAD_REQUEST", message: "Regional inexistente ou inativa." });
    }
    const [updated] = await database.update(tradeCampaigns).set({ ...input, objective: input.objective || null, updatedAt: new Date() }).where(eq(tradeCampaigns.id, input.id)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: input.regionalId ?? undefined, entityType: "trade_campaign", entityId: updated.id, action: "update", beforeData: before, afterData: updated });
    return updated;
  }),
});
