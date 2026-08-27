import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  cities,
  financeCompanies,
  notificationRuleRecipients,
  notificationRules,
  regionals,
  users,
} from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const eventTypes = ["created", "updated", "status_changed", "deleted", "due", "expiry", "*"] as const;
const categories = ["campaign_expiry", "payment_due", "action_pending", "stock_minimum", "entity_created", "entity_updated", "entity_status_changed", "entity_deleted", "task_assigned", "task_due"] as const;
const recipientTypes = ["user", "regional", "city", "company"] as const;
const entityOptions = [
  { value: "*", label: "Todos os módulos" },
  { value: "trade_campaign", label: "Campanhas" },
  { value: "media_campaign", label: "Mídias e veiculações" },
  { value: "media_point", label: "Pontos de mídia" },
  { value: "action", label: "Ações" },
  { value: "event", label: "Eventos" },
  { value: "action_point", label: "Pontos de ação" },
  { value: "trade_operation", label: "Operações de trade" },
  { value: "sound_car_run", label: "Veiculações de carro de som" },
  { value: "stock_item", label: "Itens de estoque" },
  { value: "stock_movement", label: "Movimentações de estoque" },
  { value: "invoice", label: "Notas fiscais" },
  { value: "payment", label: "Pagamentos" },
  { value: "purchase_order", label: "Ordens de compra" },
  { value: "supplier_contract", label: "Contratos" },
  { value: "operation_cost", label: "Custos operacionais" },
  { value: "task", label: "Tarefas" },
] as const;

const recipientSchema = z.object({ type: z.enum(recipientTypes), id: z.number().int().positive() });
const ruleInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(1_000).optional(),
  entityType: z.string().trim().min(1).max(64).refine(value => entityOptions.some(option => option.value === value), "Módulo operacional inválido."),
  eventType: z.enum(eventTypes),
  titleTemplate: z.string().trim().min(2).max(240),
  messageTemplate: z.string().trim().min(2).max(4_000),
  category: z.enum(categories),
  active: z.boolean().default(true),
  inAppEnabled: z.boolean().default(true),
  emailEnabled: z.boolean().default(false),
  excludeActor: z.boolean().default(true),
  recipients: z.array(recipientSchema).min(1).max(100),
});

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

function recipientValues(ruleId: number, recipients: Array<z.infer<typeof recipientSchema>>) {
  return recipients.map(recipient => ({
    ruleId,
    userId: recipient.type === "user" ? recipient.id : null,
    regionalId: recipient.type === "regional" ? recipient.id : null,
    cityId: recipient.type === "city" ? recipient.id : null,
    companyId: recipient.type === "company" ? recipient.id : null,
  }));
}

export const notificationSettingsRouter = router({
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "settings.read");
    const database = await requireDatabase();
    const [userRows, regionalRows, cityRows, companyRows] = await Promise.all([
      database.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)),
      database.select({ id: regionals.id, name: regionals.name }).from(regionals).where(eq(regionals.active, true)).orderBy(asc(regionals.name)),
      database.select({ id: cities.id, regionalId: cities.regionalId, name: cities.name, state: cities.state }).from(cities).where(eq(cities.active, true)).orderBy(asc(cities.name)),
      database.select({ id: financeCompanies.id, name: financeCompanies.name, code: financeCompanies.code }).from(financeCompanies).where(eq(financeCompanies.active, true)).orderBy(asc(financeCompanies.name)),
    ]);
    return { users: userRows, regionals: regionalRows, cities: cityRows, companies: companyRows, entityOptions, eventTypes, categories, recipientTypes };
  }),

  listRules: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "settings.read");
    const database = await requireDatabase();
    const [rules, recipients] = await Promise.all([
      database.select().from(notificationRules).orderBy(asc(notificationRules.entityType), asc(notificationRules.name)),
      database.select().from(notificationRuleRecipients),
    ]);
    return rules.map(rule => ({
      ...rule,
      recipients: recipients.filter(recipient => recipient.ruleId === rule.id).map(recipient => ({
        type: recipient.userId ? "user" as const : recipient.regionalId ? "regional" as const : recipient.cityId ? "city" as const : "company" as const,
        id: recipient.userId ?? recipient.regionalId ?? recipient.cityId ?? recipient.companyId!,
      })),
    }));
  }),

  saveRule: protectedProcedure.input(ruleInput).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const uniqueTargets = new Set(input.recipients.map(recipient => `${recipient.type}:${recipient.id}`));
    if (uniqueTargets.size !== input.recipients.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Não repita destinatários na mesma regra." });
    if (!input.inAppEnabled && !input.emailEnabled) throw new TRPCError({ code: "BAD_REQUEST", message: "Ative pelo menos um canal de notificação." });
    const userIds = input.recipients.filter(recipient => recipient.type === "user").map(recipient => recipient.id);
    const regionalIds = input.recipients.filter(recipient => recipient.type === "regional").map(recipient => recipient.id);
    const cityIds = input.recipients.filter(recipient => recipient.type === "city").map(recipient => recipient.id);
    const companyIds = input.recipients.filter(recipient => recipient.type === "company").map(recipient => recipient.id);
    const [userRows, regionalRows, cityRows, companyRows] = await Promise.all([
      userIds.length ? database.select({ id: users.id }).from(users).where(and(inArray(users.id, userIds), eq(users.isActive, true))) : [],
      regionalIds.length ? database.select({ id: regionals.id }).from(regionals).where(and(inArray(regionals.id, regionalIds), eq(regionals.active, true))) : [],
      cityIds.length ? database.select({ id: cities.id }).from(cities).where(and(inArray(cities.id, cityIds), eq(cities.active, true))) : [],
      companyIds.length ? database.select({ id: financeCompanies.id }).from(financeCompanies).where(and(inArray(financeCompanies.id, companyIds), eq(financeCompanies.active, true))) : [],
    ]);
    if (userRows.length !== userIds.length || regionalRows.length !== regionalIds.length || cityRows.length !== cityIds.length || companyRows.length !== companyIds.length) throw new TRPCError({ code: "NOT_FOUND", message: "Um ou mais destinatários não estão ativos ou não existem." });
    return database.transaction(async tx => {
      let saved;
      let before;
      if (input.id) {
        [before] = await tx.select().from(notificationRules).where(eq(notificationRules.id, input.id)).limit(1);
        if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Regra de notificação não encontrada." });
        [saved] = await tx.update(notificationRules).set({ name: input.name, description: input.description || null, entityType: input.entityType, eventType: input.eventType, titleTemplate: input.titleTemplate, messageTemplate: input.messageTemplate, category: input.category, active: input.active, inAppEnabled: input.inAppEnabled, emailEnabled: input.emailEnabled, excludeActor: input.excludeActor, updatedAt: new Date() }).where(eq(notificationRules.id, input.id)).returning();
        await tx.delete(notificationRuleRecipients).where(eq(notificationRuleRecipients.ruleId, input.id));
      } else {
        [saved] = await tx.insert(notificationRules).values({ name: input.name, description: input.description || null, entityType: input.entityType, eventType: input.eventType, titleTemplate: input.titleTemplate, messageTemplate: input.messageTemplate, category: input.category, active: input.active, inAppEnabled: input.inAppEnabled, emailEnabled: input.emailEnabled, excludeActor: input.excludeActor, createdByUserId: ctx.user.id }).returning();
      }
      await tx.insert(notificationRuleRecipients).values(recipientValues(saved.id, input.recipients));
      await writeAuditLog({ actorUserId: ctx.user.id, entityType: "notification_rule", entityId: saved.id, action: before ? "update" : "create", beforeData: before, afterData: saved }, tx);
      return saved;
    });
  }),

  setRuleActive: protectedProcedure.input(z.object({ id: z.number().int().positive(), active: z.boolean() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [updated] = await database.update(notificationRules).set({ active: input.active, updatedAt: new Date() }).where(eq(notificationRules.id, input.id)).returning();
    if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Regra de notificação não encontrada." });
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "notification_rule", entityId: input.id, action: input.active ? "activate" : "deactivate", afterData: updated });
    return updated;
  }),

  deleteRule: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [before] = await database.select().from(notificationRules).where(eq(notificationRules.id, input.id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Regra de notificação não encontrada." });
    await database.transaction(async tx => {
      await tx.delete(notificationRules).where(eq(notificationRules.id, input.id));
      await writeAuditLog({ actorUserId: ctx.user.id, entityType: "notification_rule", entityId: input.id, action: "delete", beforeData: before }, tx);
    });
    return { success: true as const };
  }),
});
