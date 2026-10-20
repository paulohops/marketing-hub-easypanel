import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  actionDebriefs,
  actionTypes,
  actions,
  appSettings,
  campaignCities,
  campaignPromotionPlans,
  campaignPromotions,
  campaignRegionals,
  campaignSectors,
  campaignTypes,
  cities,
  commercialSupervisors,
  events,
  eventServices,
  eventStockItems,
  eventSuppliers,
  eventTeamMembers,
  eventTypes,
  influencerGroupMembers,
  influencers,
  mediaCampaignCityDistributions,
  mediaCampaignNeighborhoodDistributions,
  mediaCampaignSchedules,
  mediaCampaigns,
  mediaPoints,
  mediaSpots,
  mediaTypes,
  neighborhoods,
  operationCosts,
  providers,
  regionals,
  soundCarRuns,
  stockBalances,
  stockItems,
  stockMovements,
  suppliers,
  tradeCampaigns,
  type User,
} from "../../drizzle/schema";
import { writeAuditLog } from "../audit";
import { assertPermission, effectivePermissionKeys } from "../authorization";
import { getDb } from "../db";
import { canUpdateActionStatus } from "../routers/actions";
import { normalizeAppBranding } from "../routers/settingsBranding";

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: any, user: User) => Promise<unknown>;
};

function uniqueNumbers(items: number[]): number[] {
  return Array.from(new Set(items.filter(n => Number.isInteger(n) && n > 0)));
}

function campaignStatusFor(startsOn?: string | null): "scheduled" | "active" {
  if (!startsOn) return "active";
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  const start = new Date(`${startsOn.slice(0, 10)}T00:00:00.000Z`);
  return start > now ? "scheduled" : "active";
}

export const mcpTools: McpToolDefinition[] = [
  {
    name: "mcp_status",
    description: "Retorna o status da instância do Marketing HUB, a versão, o usuário autenticado e suas permissões ativas.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async (_args, user) => {
      let permissions: string[] = [];
      try {
        permissions = await effectivePermissionKeys(user);
      } catch {
        permissions = user.role === "admin" ? ["*"] : [];
      }
      return {
        status: "online",
        service: "marketing-hub-mcp",
        version: "1.0.0",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        permissions,
        serverTime: new Date().toISOString(),
      };
    },
  },

  {
    name: "consultar_territorio",
    description: "Consulta empresas, regionais e cidades cadastradas no Marketing HUB. Essencial para mapear nomes de cidades ou códigos de regional vindos de planilhas de trade.",
    inputSchema: {
      type: "object",
      properties: {
        providerId: { type: "number", description: "Opcional: filtrar por ID da empresa" },
        regionalId: { type: "number", description: "Opcional: filtrar por ID da regional" },
      },
    },
    handler: async (args, user) => {
      await assertPermission(user, "dashboard.read");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      const [providerRows, regionalRows, cityRows] = await Promise.all([
        database.select().from(providers).where(eq(providers.active, true)).orderBy(asc(providers.name)),
        database.select().from(regionals).where(eq(regionals.active, true)).orderBy(asc(regionals.name)),
        database.select().from(cities).where(eq(cities.active, true)).orderBy(asc(cities.name)),
      ]);

      const filteredRegionals = args.providerId
        ? regionalRows.filter(r => r.providerId === args.providerId)
        : regionalRows;

      const filteredCities = args.regionalId
        ? cityRows.filter(c => c.regionalId === args.regionalId)
        : cityRows;

      return {
        totalEmpresas: providerRows.length,
        totalRegionais: filteredRegionals.length,
        totalCidades: filteredCities.length,
        empresas: providerRows.map(p => ({ id: p.id, nome: p.name, cnpj: p.billingCnpj })),
        regionais: filteredRegionals.map(r => ({ id: r.id, nome: r.name, codigo: r.code, empresaId: r.providerId })),
        cidades: filteredCities.map(c => ({ id: c.id, nome: c.name, uf: c.state, regionalId: c.regionalId })),
      };
    },
  },

  {
    name: "consultar_tipos_operacao",
    description: "Retorna as taxonomias e tipos de operação cadastrados: tipos de ação, tipos de campanha, tipos de evento, supervisores comerciais e tipos de mídia.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async (_args, user) => {
      await assertPermission(user, "dashboard.read");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      const [actionTypeRows, campaignTypeRows, eventTypeRows, mediaTypeRows, campaignSectorRows, supervisorRows] =
        await Promise.all([
          database.select().from(actionTypes).where(eq(actionTypes.active, true)).orderBy(asc(actionTypes.name)),
          database.select().from(campaignTypes).where(eq(campaignTypes.active, true)).orderBy(asc(campaignTypes.name)),
          database.select().from(eventTypes).where(eq(eventTypes.active, true)).orderBy(asc(eventTypes.name)),
          database.select().from(mediaTypes).where(eq(mediaTypes.active, true)).orderBy(asc(mediaTypes.name)),
          database.select().from(campaignSectors).where(eq(campaignSectors.active, true)).orderBy(asc(campaignSectors.name)),
          database.select().from(commercialSupervisors).where(eq(commercialSupervisors.active, true)).orderBy(asc(commercialSupervisors.name)),
        ]);

      return {
        tiposDeAcao: actionTypeRows.map(t => ({ id: t.id, nome: t.name })),
        tiposDeCampanha: campaignTypeRows.map(t => ({ id: t.id, nome: t.name })),
        tiposDeEvento: eventTypeRows.map(t => ({ id: t.id, nome: t.name })),
        tiposDeMidia: mediaTypeRows.map(t => ({ id: t.id, nome: t.name })),
        setoresDeCampanha: campaignSectorRows.map(s => ({ id: s.id, nome: s.name })),
        supervisoresComerciais: supervisorRows.map(s => ({ id: s.id, nome: s.name, email: s.email, telefone: s.phone })),
      };
    },
  },

  {
    name: "listar_campanhas",
    description: "Lista as campanhas de trade marketing com opção de filtros por status, empresa, datas e busca textual.",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["scheduled", "active", "completed", "cancelled"],
          description: "Status da campanha",
        },
        providerId: { type: "number", description: "ID da empresa" },
        search: { type: "string", description: "Busca textual no nome ou objetivo da campanha" },
        limit: { type: "number", description: "Limite de resultados (padrão: 50)" },
      },
    },
    handler: async (args, user) => {
      await assertPermission(user, "actions.read");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      const rows = await database
        .select({
          campaign: tradeCampaigns,
          providerName: providers.name,
          campaignTypeName: campaignTypes.name,
          campaignSectorName: campaignSectors.name,
        })
        .from(tradeCampaigns)
        .leftJoin(providers, eq(tradeCampaigns.providerId, providers.id))
        .leftJoin(campaignTypes, eq(tradeCampaigns.campaignTypeId, campaignTypes.id))
        .leftJoin(campaignSectors, eq(tradeCampaigns.campaignSectorId, campaignSectors.id))
        .orderBy(desc(tradeCampaigns.startsAt), desc(tradeCampaigns.id))
        .limit(args.limit ? Math.min(args.limit, 200) : 50);

      let filtered = rows;
      if (args.status) {
        filtered = filtered.filter(r => r.campaign.status === args.status);
      }
      if (args.providerId) {
        filtered = filtered.filter(r => r.campaign.providerId === args.providerId);
      }
      if (args.search) {
        const term = args.search.toLowerCase();
        filtered = filtered.filter(
          r =>
            r.campaign.name.toLowerCase().includes(term) ||
            (r.campaign.objective && r.campaign.objective.toLowerCase().includes(term))
        );
      }

      return {
        total: filtered.length,
        campanhas: filtered.map(row => ({
          id: row.campaign.id,
          nome: row.campaign.name,
          status: row.campaign.status,
          empresa: row.providerName,
          tipo: row.campaignTypeName,
          setor: row.campaignSectorName,
          inicio: row.campaign.startsAt,
          fim: row.campaign.endsAt,
          objetivo: row.campaign.objective,
          debriefRating: row.campaign.debriefRating,
          debriefResult: row.campaign.debriefResult,
        })),
      };
    },
  },

  {
    name: "obter_detalhe_campanha",
    description: "Obtém todos os detalhes de uma campanha específica, incluindo regionais, cidades atendidas, promoções, planos e ações vinculadas.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "number", description: "ID da campanha" },
      },
      required: ["campaignId"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "actions.read");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      const [row] = await database
        .select({
          campaign: tradeCampaigns,
          providerName: providers.name,
          campaignTypeName: campaignTypes.name,
          campaignSectorName: campaignSectors.name,
        })
        .from(tradeCampaigns)
        .leftJoin(providers, eq(tradeCampaigns.providerId, providers.id))
        .leftJoin(campaignTypes, eq(tradeCampaigns.campaignTypeId, campaignTypes.id))
        .leftJoin(campaignSectors, eq(tradeCampaigns.campaignSectorId, campaignSectors.id))
        .where(eq(tradeCampaigns.id, args.campaignId))
        .limit(1);

      if (!row) throw new Error(`Campanha #${args.campaignId} não encontrada.`);

      const [regionalsLinked, citiesLinked, promotionsLinked, actionsLinked] = await Promise.all([
        database
          .select({ id: regionals.id, name: regionals.name, code: regionals.code })
          .from(campaignRegionals)
          .innerJoin(regionals, eq(campaignRegionals.regionalId, regionals.id))
          .where(eq(campaignRegionals.campaignId, args.campaignId)),
        database
          .select({ id: cities.id, name: cities.name, state: cities.state })
          .from(campaignCities)
          .innerJoin(cities, eq(campaignCities.cityId, cities.id))
          .where(eq(campaignCities.campaignId, args.campaignId)),
        database
          .select()
          .from(campaignPromotions)
          .where(eq(campaignPromotions.campaignId, args.campaignId))
          .orderBy(asc(campaignPromotions.sortOrder)),
        database
          .select({
            id: actions.id,
            name: actions.name,
            status: actions.status,
            scheduledFor: actions.scheduledFor,
            cityName: cities.name,
            actionTypeName: actionTypes.name,
          })
          .from(actions)
          .leftJoin(cities, eq(actions.cityId, cities.id))
          .leftJoin(actionTypes, eq(actions.actionTypeId, actionTypes.id))
          .where(eq(actions.tradeCampaignId, args.campaignId)),
      ]);

      const promotionIds = promotionsLinked.map(p => p.id);
      const plansLinked = promotionIds.length
        ? await database
            .select()
            .from(campaignPromotionPlans)
            .where(inArray(campaignPromotionPlans.campaignPromotionId, promotionIds))
            .orderBy(asc(campaignPromotionPlans.sortOrder))
        : [];

      return {
        id: row.campaign.id,
        nome: row.campaign.name,
        status: row.campaign.status,
        empresa: row.providerName,
        tipo: row.campaignTypeName,
        setor: row.campaignSectorName,
        inicio: row.campaign.startsAt,
        fim: row.campaign.endsAt,
        objetivo: row.campaign.objective,
        regionais: regionalsLinked,
        cidades: citiesLinked,
        promocoes: promotionsLinked.map(promo => ({
          id: promo.id,
          nome: promo.name,
          descricao: promo.description,
          planos: plansLinked
            .filter(plan => plan.campaignPromotionId === promo.id)
            .map(pl => ({
              id: pl.id,
              nome: pl.name,
              velocidade: pl.speed,
              preco: pl.price,
            })),
        })),
        acoesVinculadas: actionsLinked,
        debriefing: {
          rating: row.campaign.debriefRating,
          resultado: row.campaign.debriefResult,
          notas: row.campaign.debriefNotes,
          realizadoEm: row.campaign.debriefAt,
        },
      };
    },
  },

  {
    name: "criar_campanha",
    description: "Cria uma nova campanha de trade marketing com suporte a regionais, cidades, promoções e planos.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome da campanha (obrigatório)" },
        objective: { type: "string", description: "Objetivo ou descrição da campanha" },
        providerId: { type: "number", description: "ID da empresa parceira" },
        campaignTypeId: { type: "number", description: "ID do tipo de campanha" },
        campaignSectorId: { type: "number", description: "ID do setor da campanha" },
        regionalIds: {
          type: "array",
          items: { type: "number" },
          description: "Lista de IDs das regionais atendidas",
        },
        cityIds: {
          type: "array",
          items: { type: "number" },
          description: "Lista de IDs das cidades atendidas",
        },
        startsAt: { type: "string", description: "Data de início (formato ISO YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ssZ)" },
        endsAt: { type: "string", description: "Data de término (formato ISO)" },
        status: {
          type: "string",
          enum: ["scheduled", "active", "completed", "cancelled"],
          description: "Status da campanha (padrão: scheduled)",
        },
        promotions: {
          type: "array",
          description: "Lista de promoções e planos da campanha",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              cityIds: { type: "array", items: { type: "number" } },
              plans: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    speed: { type: "string" },
                    price: { type: "number" },
                  },
                  required: ["name", "price"],
                },
              },
            },
            required: ["name"],
          },
        },
      },
      required: ["name"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "actions.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      const startsAt = args.startsAt ? new Date(args.startsAt) : null;
      const endsAt = args.endsAt ? new Date(args.endsAt) : null;
      if (startsAt && endsAt && endsAt < startsAt) {
        throw new Error("O término da campanha deve ser posterior à data de início.");
      }

      const regionalIds = uniqueNumbers(args.regionalIds || []);
      const cityIds = uniqueNumbers(args.cityIds || []);

      const created = await database.transaction(async (tx) => {
        const [campaign] = await tx
          .insert(tradeCampaigns)
          .values({
            name: args.name.trim(),
            objective: args.objective?.trim() || null,
            providerId: args.providerId || null,
            campaignTypeId: args.campaignTypeId || null,
            campaignSectorId: args.campaignSectorId || null,
            regionalId: regionalIds[0] || null,
            startsAt,
            endsAt,
            status: args.status || "scheduled",
            createdByUserId: user.id,
          })
          .returning();

        if (regionalIds.length) {
          await tx
            .insert(campaignRegionals)
            .values(regionalIds.map(rId => ({ campaignId: campaign.id, regionalId: rId })));
        }

        if (cityIds.length) {
          await tx
            .insert(campaignCities)
            .values(cityIds.map(cId => ({ campaignId: campaign.id, cityId: cId })));
        }

        if (Array.isArray(args.promotions) && args.promotions.length > 0) {
          for (let i = 0; i < args.promotions.length; i++) {
            const promo = args.promotions[i];
            const [createdPromo] = await tx
              .insert(campaignPromotions)
              .values({
                campaignId: campaign.id,
                name: promo.name.trim(),
                description: promo.description || null,
                sortOrder: i,
              })
              .returning();

            if (Array.isArray(promo.plans) && promo.plans.length > 0) {
              for (let j = 0; j < promo.plans.length; j++) {
                const plan = promo.plans[j];
                await tx.insert(campaignPromotionPlans).values({
                  campaignPromotionId: createdPromo.id,
                  name: plan.name.trim(),
                  speed: plan.speed || null,
                  price: String(plan.price),
                  sortOrder: j,
                });
              }
            }
          }
        }

        return campaign;
      });

      await writeAuditLog({
        actorUserId: user.id,
        entityType: "trade_campaign",
        entityId: created.id,
        action: "create",
        afterData: { ...created, regionalIds, cityIds },
      });

      return {
        sucesso: true,
        mensagem: `Campanha "${created.name}" criada com sucesso!`,
        id: created.id,
      };
    },
  },

  {
    name: "atualizar_status_campanha",
    description: "Atualiza o status de uma campanha e opcionalmente adiciona notas de debriefing e avaliação de resultado.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "number", description: "ID da campanha" },
        status: {
          type: "string",
          enum: ["scheduled", "active", "completed", "cancelled"],
          description: "Novo status da campanha",
        },
        debriefNotes: { type: "string", description: "Notas do debriefing da campanha" },
        debriefRating: { type: "number", description: "Nota de avaliação (1 a 5)" },
        debriefResult: { type: "string", description: "Resultado alcançado (ex: superou_meta, atingiu_meta, abaixo_meta)" },
      },
      required: ["campaignId", "status"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "actions.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      const [before] = await database
        .select()
        .from(tradeCampaigns)
        .where(eq(tradeCampaigns.id, args.campaignId))
        .limit(1);

      if (!before) throw new Error(`Campanha #${args.campaignId} não encontrada.`);

      const updateData: Record<string, unknown> = {
        status: args.status,
        updatedAt: new Date(),
      };

      if (args.status === "completed" || args.debriefNotes || args.debriefRating != null) {
        updateData.debriefAt = new Date();
        if (args.debriefNotes) updateData.debriefNotes = args.debriefNotes;
        if (args.debriefRating != null) updateData.debriefRating = Math.max(1, Math.min(5, args.debriefRating));
        if (args.debriefResult) updateData.debriefResult = args.debriefResult;
      }

      const [updated] = await database
        .update(tradeCampaigns)
        .set(updateData)
        .where(eq(tradeCampaigns.id, args.campaignId))
        .returning();

      await writeAuditLog({
        actorUserId: user.id,
        entityType: "trade_campaign",
        entityId: updated.id,
        action: "update_status",
        beforeData: before,
        afterData: updated,
      });

      return {
        sucesso: true,
        mensagem: `Status da campanha #${updated.id} alterado de "${before.status}" para "${updated.status}".`,
        campanha: updated,
      };
    },
  },

  {
    name: "listar_acoes",
    description: "Lista as ações de trade marketing com filtros por campanha, cidade, tipo de ação, status e datas.",
    inputSchema: {
      type: "object",
      properties: {
        tradeCampaignId: { type: "number", description: "Filtrar por campanha" },
        cityId: { type: "number", description: "Filtrar por cidade" },
        actionTypeId: { type: "number", description: "Filtrar por tipo de ação" },
        status: {
          type: "string",
          enum: ["planned", "in_progress", "paused", "completed", "cancelled"],
          description: "Status da ação",
        },
        limit: { type: "number", description: "Limite de resultados (padrão: 50)" },
      },
    },
    handler: async (args, user) => {
      await assertPermission(user, "actions.read");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      const rows = await database
        .select({
          action: actions,
          cityName: cities.name,
          cityState: cities.state,
          actionTypeName: actionTypes.name,
          campaignName: tradeCampaigns.name,
          supervisorName: commercialSupervisors.name,
          debrief: actionDebriefs,
        })
        .from(actions)
        .leftJoin(cities, eq(actions.cityId, cities.id))
        .leftJoin(actionTypes, eq(actions.actionTypeId, actionTypes.id))
        .leftJoin(tradeCampaigns, eq(actions.tradeCampaignId, tradeCampaigns.id))
        .leftJoin(commercialSupervisors, eq(actions.commercialSupervisorId, commercialSupervisors.id))
        .leftJoin(actionDebriefs, eq(actionDebriefs.actionId, actions.id))
        .orderBy(desc(actions.scheduledFor), desc(actions.id))
        .limit(args.limit ? Math.min(args.limit, 200) : 50);

      let filtered = rows;
      if (args.tradeCampaignId) {
        filtered = filtered.filter(r => r.action.tradeCampaignId === args.tradeCampaignId);
      }
      if (args.cityId) {
        filtered = filtered.filter(r => r.action.cityId === args.cityId);
      }
      if (args.actionTypeId) {
        filtered = filtered.filter(r => r.action.actionTypeId === args.actionTypeId);
      }
      if (args.status) {
        filtered = filtered.filter(r => r.action.status === args.status);
      }

      return {
        total: filtered.length,
        acoes: filtered.map(row => ({
          id: row.action.id,
          nome: row.action.name,
          status: row.action.status,
          campanha: row.campaignName,
          campanhaId: row.action.tradeCampaignId,
          cidade: `${row.cityName} - ${row.cityState}`,
          tipo: row.actionTypeName,
          agendadaPara: row.action.scheduledFor,
          custoEstimado: row.action.estimatedCost,
          supervisor: row.supervisorName,
          objetivo: row.action.objective,
          debrief: row.debrief
            ? {
                rating: row.debrief.rating,
                notas: row.debrief.notes,
                leadCount: row.debrief.leadCount,
                saleCount: row.debrief.saleCount,
              }
            : null,
        })),
      };
    },
  },

  {
    name: "criar_acao",
    description: "Cria uma nova ação de trade marketing vinculada a uma cidade, data e opcionalmente a uma campanha.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome da ação (obrigatório)" },
        tradeCampaignId: { type: "number", description: "ID da campanha vinculada (opcional)" },
        cityId: { type: "number", description: "ID da cidade (obrigatório)" },
        actionTypeId: { type: "number", description: "ID do tipo de ação (obrigatório)" },
        scheduledFor: { type: "string", description: "Data/hora programada (formato ISO)" },
        commercialSupervisorId: { type: "number", description: "ID do supervisor comercial responsável" },
        objective: { type: "string", description: "Objetivo da ação" },
        estimatedCost: { type: "number", description: "Custo estimado (R$)" },
        status: {
          type: "string",
          enum: ["planned", "in_progress", "paused", "completed", "cancelled"],
          description: "Status inicial (padrão: planned)",
        },
      },
      required: ["name", "cityId", "actionTypeId", "scheduledFor"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "actions.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      const scheduledFor = new Date(args.scheduledFor);
      if (Number.isNaN(scheduledFor.getTime())) {
        throw new Error("Data de agendamento (scheduledFor) inválida.");
      }

      const [created] = await database
        .insert(actions)
        .values({
          name: args.name.trim(),
          tradeCampaignId: args.tradeCampaignId || null,
          cityId: args.cityId,
          actionTypeId: args.actionTypeId,
          scheduledFor,
          objective: args.objective?.trim() || "Ação de trade marketing",
          commercialSupervisorId: args.commercialSupervisorId || null,
          estimatedCost: args.estimatedCost != null ? String(args.estimatedCost) : "0.00",
          status: args.status || "planned",
        })
        .returning();

      await writeAuditLog({
        actorUserId: user.id,
        cityId: args.cityId,
        entityType: "action",
        entityId: created.id,
        action: "create",
        afterData: created,
      });

      return {
        sucesso: true,
        mensagem: `Ação "${created.name}" criada com sucesso!`,
        id: created.id,
      };
    },
  },

  {
    name: "atualizar_status_acao",
    description: "Atualiza o status de uma ação de trade (ex: iniciar execução, pausar, concluir ou cancelar) e opcionalmente adiciona debriefing.",
    inputSchema: {
      type: "object",
      properties: {
        actionId: { type: "number", description: "ID da ação" },
        status: {
          type: "string",
          enum: ["planned", "in_progress", "paused", "completed", "cancelled"],
          description: "Novo status da ação",
        },
        debriefNotes: { type: "string", description: "Notas do debriefing da ação" },
        debriefRating: { type: "number", description: "Nota de avaliação (1 a 5)" },
        leadCount: { type: "number", description: "Quantidade de leads obtidos" },
        saleCount: { type: "number", description: "Quantidade de vendas realizadas" },
      },
      required: ["actionId", "status"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "actions.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      const [before] = await database
        .select()
        .from(actions)
        .where(eq(actions.id, args.actionId))
        .limit(1);

      if (!before) throw new Error(`Ação #${args.actionId} não encontrada.`);

      if (!canUpdateActionStatus(before.status, args.status)) {
        throw new Error(`Transição de status inválida: não é permitido alterar de "${before.status}" para "${args.status}".`);
      }

      const updated = await database.transaction(async (tx) => {
        const [upd] = await tx
          .update(actions)
          .set({
            status: args.status,
            updatedAt: new Date(),
          })
          .where(eq(actions.id, args.actionId))
          .returning();

        if (args.debriefNotes || args.debriefRating != null || args.leadCount != null || args.saleCount != null) {
          const rating = args.debriefRating != null ? Math.max(1, Math.min(5, args.debriefRating)) : 3;
          await tx
            .insert(actionDebriefs)
            .values({
              actionId: args.actionId,
              rating,
              notes: args.debriefNotes || null,
              leadCount: args.leadCount || 0,
              saleCount: args.saleCount || 0,
              completedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: actionDebriefs.actionId,
              set: {
                rating,
                notes: args.debriefNotes || null,
                leadCount: args.leadCount ?? undefined,
                saleCount: args.saleCount ?? undefined,
                completedAt: new Date(),
              },
            });
        }

        return upd;
      });

      await writeAuditLog({
        actorUserId: user.id,
        cityId: before.cityId,
        entityType: "action",
        entityId: updated.id,
        action: "update_status",
        beforeData: before,
        afterData: updated,
      });

      return {
        sucesso: true,
        mensagem: `Status da ação #${updated.id} alterado de "${before.status}" para "${updated.status}".`,
        acao: updated,
      };
    },
  },

  {
    name: "preencher_dados_trade_lote",
    description: "Ferramenta otimizada para importação/preenchimento automático a partir de planilhas de trade. Permite criar múltiplas ações e campanhas em lote, resolvendo nomes de cidades e tipos de ação automaticamente.",
    inputSchema: {
      type: "object",
      properties: {
        campanha: {
          type: "object",
          description: "Opcional: criar uma campanha agregadora para as ações do lote",
          properties: {
            nome: { type: "string" },
            objetivo: { type: "string" },
            empresaNome: { type: "string" },
            dataInicio: { type: "string" },
            dataFim: { type: "string" },
          },
          required: ["nome"],
        },
        acoes: {
          type: "array",
          description: "Lista de ações extraídas da planilha para cadastro",
          items: {
            type: "object",
            properties: {
              nome: { type: "string" },
              cidadeNome: { type: "string", description: "Nome da cidade para resolução automática" },
              cidadeUf: { type: "string", description: "UF da cidade (opcional, ex: MG)" },
              tipoAcaoNome: { type: "string", description: "Nome do tipo de ação (ex: Blitz, Panfletagem)" },
              dataAgendada: { type: "string", description: "Data programada (YYYY-MM-DD ou ISO)" },
              custoEstimado: { type: "number" },
              objetivo: { type: "string" },
            },
            required: ["nome", "cidadeNome", "dataAgendada"],
          },
        },
      },
      required: ["acoes"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "actions.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      const [allCities, allActionTypes, allProviders] = await Promise.all([
        database.select().from(cities).where(eq(cities.active, true)),
        database.select().from(actionTypes).where(eq(actionTypes.active, true)),
        database.select().from(providers).where(eq(providers.active, true)),
      ]);

      const normalize = (txt: string) =>
        txt
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .trim();

      let targetCampaignId: number | null = null;

      if (args.campanha?.nome) {
        let providerId: number | null = null;
        if (args.campanha.empresaNome) {
          const foundProv = allProviders.find(p => normalize(p.name).includes(normalize(args.campanha.empresaNome)));
          if (foundProv) providerId = foundProv.id;
        }

        const [createdCamp] = await database
          .insert(tradeCampaigns)
          .values({
            name: args.campanha.nome.trim(),
            objective: args.campanha.objetivo || null,
            providerId,
            startsAt: args.campanha.dataInicio ? new Date(args.campanha.dataInicio) : null,
            endsAt: args.campanha.dataFim ? new Date(args.campanha.dataFim) : null,
            status: "active",
            createdByUserId: user.id,
          })
          .returning();

        targetCampaignId = createdCamp.id;

        await writeAuditLog({
          actorUserId: user.id,
          entityType: "trade_campaign",
          entityId: createdCamp.id,
          action: "create_batch_header",
          afterData: createdCamp,
        });
      }

      const resultados: Array<{ linha: number; nome: string; status: "sucesso" | "erro"; id?: number; erro?: string }> = [];

      for (let idx = 0; idx < args.acoes.length; idx++) {
        const item = args.acoes[idx];
        try {
          const normCity = normalize(item.cidadeNome);
          const foundCity = allCities.find(c => {
            const matchesName = normalize(c.name) === normCity || normalize(c.name).includes(normCity);
            return item.cidadeUf ? matchesName && c.state.toUpperCase() === item.cidadeUf.toUpperCase() : matchesName;
          });

          if (!foundCity) {
            throw new Error(`Cidade "${item.cidadeNome}" não encontrada na base de território.`);
          }

          let foundTypeId = allActionTypes[0]?.id || 1;
          if (item.tipoAcaoNome) {
            const normType = normalize(item.tipoAcaoNome);
            const matchType = allActionTypes.find(t => normalize(t.name).includes(normType));
            if (matchType) foundTypeId = matchType.id;
          }

          const scheduledFor = new Date(item.dataAgendada);
          if (Number.isNaN(scheduledFor.getTime())) {
            throw new Error(`Data "${item.dataAgendada}" inválida.`);
          }

          const [createdAction] = await database
            .insert(actions)
            .values({
              name: item.nome.trim(),
              tradeCampaignId: targetCampaignId,
              cityId: foundCity.id,
              actionTypeId: foundTypeId,
              scheduledFor,
              objective: item.objetivo?.trim() || "Ação de trade marketing importada via lote",
              estimatedCost: item.custoEstimado != null ? String(item.custoEstimado) : "0.00",
              status: "planned",
            })
            .returning();

          await writeAuditLog({
            actorUserId: user.id,
            cityId: foundCity.id,
            entityType: "action",
            entityId: createdAction.id,
            action: "create_batch_item",
            afterData: createdAction,
          });

          resultados.push({
            linha: idx + 1,
            nome: item.nome,
            status: "sucesso",
            id: createdAction.id,
          });
        } catch (err: any) {
          resultados.push({
            linha: idx + 1,
            nome: item.nome,
            status: "erro",
            erro: err.message || "Erro desconhecido",
          });
        }
      }

      const totalSucesso = resultados.filter(r => r.status === "sucesso").length;
      const totalErros = resultados.filter(r => r.status === "erro").length;

      return {
        sucesso: totalErros === 0,
        resumo: `Lote processado: ${totalSucesso} criados com sucesso, ${totalErros} falhas.`,
        campanhaId: targetCampaignId,
        resultados,
      };
    },
  },

  {
    name: "obter_indicadores_trade",
    description: "Calcula métricas agregadas da operação de trade: total de campanhas por status, ações realizadas vs planejadas, investimentos e cobertura de cidades.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async (_args, user) => {
      await assertPermission(user, "dashboard.read");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      const [campaignRows, actionRows, totalCitiesCount] = await Promise.all([
        database.select().from(tradeCampaigns),
        database.select().from(actions),
        database.select({ count: sql<number>`count(*)` }).from(cities).where(eq(cities.active, true)),
      ]);

      const campStatusCount = campaignRows.reduce((acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const actionStatusCount = actionRows.reduce((acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const totalCustoEstimado = actionRows.reduce((sum, a) => sum + (a.estimatedCost ? Number(a.estimatedCost) : 0), 0);
      const uniqueCitiesWithActions = new Set(actionRows.map(a => a.cityId)).size;
      const totalCidades = Number(totalCitiesCount[0]?.count || 1);

      return {
        campanhas: {
          total: campaignRows.length,
          porStatus: campStatusCount,
          ativas: campStatusCount.active || 0,
          agendadas: campStatusCount.scheduled || 0,
          concluidas: campStatusCount.completed || 0,
        },
        acoes: {
          total: actionRows.length,
          porStatus: actionStatusCount,
          emExecucao: actionStatusCount.in_progress || 0,
          concluidas: actionStatusCount.completed || 0,
          planejadas: actionStatusCount.planned || 0,
        },
        financeiro: {
          custoEstimadoTotal: totalCustoEstimado,
        },
        territorio: {
          cidadesComOperacoes: uniqueCitiesWithActions,
          totalCidadesCadastradas: totalCidades,
          percentualCobertura: Number(((uniqueCitiesWithActions / totalCidades) * 100).toFixed(1)),
        },
      };
    },
  },

  {
    name: "agendar_panfletagem",
    description: "Agenda uma operação de panfletagem (leafleting) com volume de panfletos, rotas, datas, bairros (opcional), equipes de distribuição e vínculo com campanha comercial (tradeCampaignId).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome da operação de panfletagem (obrigatório)" },
        startsOn: { type: "string", description: "Data de início da panfletagem (YYYY-MM-DD, obrigatório)" },
        endsOn: { type: "string", description: "Data de término (YYYY-MM-DD, padrão: mesma de início)" },
        totalVolume: { type: "number", description: "Volume total de panfletos a distribuir" },
        tradeCampaignId: { type: "number", description: "ID da campanha comercial de trade vinculada (opcional)" },
        mediaPointId: { type: "number", description: "ID do ponto/fornecedor de panfletagem em mediaPoints (opcional)" },
        cityId: { type: "number", description: "ID da cidade principal de distribuição (opcional)" },
        supplierId: { type: "number", description: "ID do fornecedor de distribuição (opcional)" },
        dailyRoute: { type: "string", description: "Descrição das rotas ou itinerário de distribuição" },
        deliveryInstructions: { type: "string", description: "Instruções operacionais para as equipes de panfletagem" },
        estimatedCost: { type: "number", description: "Custo estimado total da operação em R$" },
        partnershipType: {
          type: "string",
          enum: ["paid", "barter", "mixed"],
          description: "Tipo de parceria/pagamento (padrão: paid)",
        },
        notes: { type: "string", description: "Observações gerais sobre a operação" },
        cityDistributions: {
          type: "array",
          description: "Distribuição das cotas de panfletos por cidade",
          items: {
            type: "object",
            properties: {
              cityId: { type: "number" },
              quantity: { type: "number" },
              notes: { type: "string" },
            },
            required: ["cityId", "quantity"],
          },
        },
        neighborhoodIds: {
          type: "array",
          items: { type: "number" },
          description: "IDs dos bairros onde haverá panfletagem",
        },
        schedules: {
          type: "array",
          description: "Agendamentos detalhados de equipes e rotas",
          items: {
            type: "object",
            properties: {
              programName: { type: "string" },
              weekday: { type: "number" },
              specificDate: { type: "string" },
              cityId: { type: "number" },
              neighborhoodId: { type: "number" },
              startsAt: { type: "string", description: "Horário de início (HH:mm)" },
              endsAt: { type: "string", description: "Horário de término (HH:mm)" },
              routeDescription: { type: "string" },
              distributionVolume: { type: "number" },
              notes: { type: "string" },
            },
            required: ["startsAt", "endsAt"],
          },
        },
      },
      required: ["name", "startsOn"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "media.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      const startsOn = args.startsOn;
      const endsOn = args.endsOn || startsOn;
      if (endsOn < startsOn) {
        throw new Error("A data de término deve ser igual ou posterior à data de início.");
      }

      let pointId = args.mediaPointId;
      if (!pointId) {
        const points = await database
          .select()
          .from(mediaPoints)
          .where(and(eq(mediaPoints.operationCategory, "leafleting"), eq(mediaPoints.status, "active")))
          .limit(10);

        let match = points.find(p => (!args.cityId || p.cityId === args.cityId) && (!args.supplierId || p.supplierId === args.supplierId));
        if (!match && points.length > 0) {
          match = points[0];
        }

        if (match) {
          pointId = match.id;
        } else {
          const [allSuppliers, allCities, allMediaTypes] = await Promise.all([
            database.select().from(suppliers).where(eq(suppliers.active, true)).limit(1),
            database.select().from(cities).where(eq(cities.active, true)).limit(1),
            database.select().from(mediaTypes).where(eq(mediaTypes.active, true)).limit(1),
          ]);
          const targetSupplierId = args.supplierId || allSuppliers[0]?.id;
          const targetCityId = args.cityId || allCities[0]?.id;
          const targetMediaTypeId = allMediaTypes[0]?.id;

          if (!targetSupplierId || !targetCityId || !targetMediaTypeId) {
            throw new Error("Não foi possível criar o ponto de panfletagem. Cadastre ao menos um fornecedor, cidade e tipo de mídia.");
          }

          const [newPoint] = await database
            .insert(mediaPoints)
            .values({
              supplierId: targetSupplierId,
              cityId: targetCityId,
              mediaTypeId: targetMediaTypeId,
              name: `Panfletagem - ${args.name.trim()}`,
              operationCategory: "leafleting",
              channelKind: "external",
              status: "active",
              partnershipType: args.partnershipType || "paid",
            })
            .returning();
          pointId = newPoint.id;
        }
      }

      const status = campaignStatusFor(startsOn);
      const [campaign] = await database
        .insert(mediaCampaigns)
        .values({
          mediaPointId: pointId,
          tradeCampaignId: args.tradeCampaignId || null,
          name: args.name.trim(),
          objective: "Operação de panfletagem e distribuição",
          startsOn,
          endsOn,
          partnershipType: args.partnershipType || "paid",
          estimatedCost: args.estimatedCost != null ? String(args.estimatedCost) : "0.00",
          notes: args.notes || null,
          campaignConfig: {
            dailyRoute: args.dailyRoute || undefined,
            deliveryInstructions: args.deliveryInstructions || undefined,
            materialQuantity: args.totalVolume || undefined,
          },
          status,
        })
        .returning();

      if (Array.isArray(args.cityDistributions) && args.cityDistributions.length > 0) {
        await database.insert(mediaCampaignCityDistributions).values(
          args.cityDistributions.map((dist: any) => ({
            mediaCampaignId: campaign.id,
            cityId: dist.cityId,
            quantity: dist.quantity,
            notes: dist.notes || null,
          }))
        );
      } else if (args.cityId && args.totalVolume) {
        await database.insert(mediaCampaignCityDistributions).values({
          mediaCampaignId: campaign.id,
          cityId: args.cityId,
          quantity: args.totalVolume,
          notes: "Cota total alocada para a cidade",
        });
      }

      if (Array.isArray(args.neighborhoodIds) && args.neighborhoodIds.length > 0) {
        await database.insert(mediaCampaignNeighborhoodDistributions).values(
          args.neighborhoodIds.map((neighId: number) => ({
            mediaCampaignId: campaign.id,
            neighborhoodId: neighId,
            quantity: 1,
            notes: "Bairro de distribuição",
          }))
        );
      }

      if (Array.isArray(args.schedules) && args.schedules.length > 0) {
        await database.insert(mediaCampaignSchedules).values(
          args.schedules.map((s: any) => ({
            mediaCampaignId: campaign.id,
            programName: s.programName || "Equipe de Panfletagem",
            weekday: s.weekday ?? null,
            specificDate: s.specificDate ?? null,
            cityId: s.cityId || args.cityId || null,
            neighborhoodId: s.neighborhoodId || null,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            routeDescription: s.routeDescription || args.dailyRoute || null,
            distributionVolume: s.distributionVolume ?? null,
            notes: s.notes || null,
            createdByUserId: user.id,
          }))
        );
      }

      await writeAuditLog({
        actorUserId: user.id,
        entityType: "media_campaign",
        entityId: campaign.id,
        action: status === "scheduled" ? "schedule" : "create",
        afterData: { ...campaign, totalVolume: args.totalVolume, cityDistributions: args.cityDistributions },
      });

      return {
        sucesso: true,
        mensagem: `Operação de panfletagem "${campaign.name}" agendada com sucesso!`,
        id: campaign.id,
        status: campaign.status,
      };
    },
  },

  {
    name: "cadastrar_ponto_midia",
    description: "Cadastra ponto de mídia urbana (outdoors, frontlights, painéis, painel de led, etc.), endereço, cidade, fornecedor e valores.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome ou identificação do ponto de mídia (obrigatório)" },
        supplierId: { type: "number", description: "ID do fornecedor do ponto de mídia (obrigatório)" },
        cityId: { type: "number", description: "ID da cidade onde se localiza o ponto (obrigatório)" },
        mediaTypeId: { type: "number", description: "ID do tipo de mídia (obrigatório)" },
        mediaVariationTypeId: { type: "number", description: "ID da variação/subtipo de mídia (opcional)" },
        serviceTypeId: { type: "number", description: "ID do tipo de serviço vinculado (opcional)" },
        operationCategory: {
          type: "string",
          enum: ["graphics", "audio_video", "leafleting", "sound_car", "influencers"],
          description: "Categoria da operação de mídia (padrão: graphics)",
        },
        address: { type: "string", description: "Endereço completo ou localização física" },
        latitude: { type: "number", description: "Latitude geográfica" },
        longitude: { type: "number", description: "Longitude geográfica" },
        signalRangeKm: { type: "number", description: "Alcance do sinal em quilômetros (se aplicável)" },
        replacementFrequency: {
          type: "string",
          enum: ["weekly", "biweekly", "monthly", "quarterly", "semiannual", "annual", "custom"],
          description: "Frequência de troca ou veiculação",
        },
        partnershipType: {
          type: "string",
          enum: ["paid", "barter", "mixed"],
          description: "Tipo de parceria/pagamento (padrão: paid)",
        },
        contractStartsOn: { type: "string", description: "Data de início do contrato (YYYY-MM-DD)" },
        contractEndsOn: { type: "string", description: "Data de término do contrato (YYYY-MM-DD)" },
        contractValue: { type: "number", description: "Valor contratual acordado (mensal ou total)" },
        contractReference: { type: "string", description: "Código ou referência do contrato" },
        status: {
          type: "string",
          enum: ["active", "inactive", "maintenance", "cancelled"],
          description: "Status do ponto de mídia (padrão: active)",
        },
      },
      required: ["name", "supplierId", "cityId", "mediaTypeId"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "media.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      if (args.contractStartsOn && args.contractEndsOn && args.contractEndsOn < args.contractStartsOn) {
        throw new Error("A data final do contrato deve ser posterior à data inicial.");
      }

      const opCat = args.operationCategory || "graphics";
      const channelKind = opCat === "graphics" || opCat === "audio_video" || opCat === "influencers" ? "standard" : "external";

      const [created] = await database
        .insert(mediaPoints)
        .values({
          supplierId: args.supplierId,
          cityId: args.cityId,
          mediaTypeId: args.mediaTypeId,
          mediaVariationTypeId: args.mediaVariationTypeId || null,
          serviceTypeId: args.serviceTypeId || null,
          name: args.name.trim(),
          channelKind,
          operationCategory: opCat,
          replacementFrequency: args.replacementFrequency || null,
          contractStartsOn: args.contractStartsOn || null,
          contractEndsOn: args.contractEndsOn || null,
          partnershipType: args.partnershipType || "paid",
          address: args.address?.trim() || null,
          latitude: args.latitude != null ? args.latitude.toFixed(7) : null,
          longitude: args.longitude != null ? args.longitude.toFixed(7) : null,
          signalRangeKm: args.signalRangeKm != null ? args.signalRangeKm.toFixed(2) : null,
          status: args.status || "active",
        })
        .returning();

      await writeAuditLog({
        actorUserId: user.id,
        entityType: "media_point",
        entityId: created.id,
        action: "create",
        afterData: created,
      });

      return {
        sucesso: true,
        mensagem: `Ponto de mídia "${created.name}" cadastrado com sucesso!`,
        id: created.id,
        ponto: created,
      };
    },
  },

  {
    name: "cadastrar_veiculacao_midia",
    description: "Registra veiculação de campanha em ponto de mídia urbana ou tradicional com datas de início/fim e valores.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome da veiculação (obrigatório)" },
        mediaPointId: { type: "number", description: "ID do ponto de mídia (obrigatório)" },
        startsOn: { type: "string", description: "Data de início da veiculação (YYYY-MM-DD, obrigatório)" },
        endsOn: { type: "string", description: "Data de término da veiculação (YYYY-MM-DD, obrigatório)" },
        tradeCampaignId: { type: "number", description: "ID da campanha comercial de trade vinculada (opcional)" },
        serviceTypeId: { type: "number", description: "ID do serviço vinculado (opcional)" },
        subserviceTypeId: { type: "number", description: "ID do subserviço vinculado (opcional)" },
        productTypeId: { type: "number", description: "ID do tipo de produto divulgado (opcional)" },
        responsibleUserId: { type: "number", description: "ID do usuário responsável (opcional)" },
        estimatedCost: { type: "number", description: "Custo estimado da veiculação em R$" },
        partnershipType: {
          type: "string",
          enum: ["paid", "barter", "mixed"],
          description: "Tipo de parceria/pagamento (padrão: paid)",
        },
        objective: { type: "string", description: "Objetivo da veiculação" },
        notes: { type: "string", description: "Observações gerais" },
        campaignDetails: { type: "string", description: "Detalhes e briefing da veiculação" },
        status: {
          type: "string",
          enum: ["scheduled", "active", "completed", "cancelled"],
          description: "Status da veiculação (se omitido, calculado automaticamente conforme a data)",
        },
      },
      required: ["name", "mediaPointId", "startsOn", "endsOn"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "media.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      if (args.endsOn < args.startsOn) {
        throw new Error("A data de término deve ser posterior à data de início.");
      }

      const [point] = await database
        .select()
        .from(mediaPoints)
        .where(eq(mediaPoints.id, args.mediaPointId))
        .limit(1);

      if (!point) {
        throw new Error(`Ponto de mídia #${args.mediaPointId} não encontrado.`);
      }

      const status = args.status || campaignStatusFor(args.startsOn);

      const [created] = await database
        .insert(mediaCampaigns)
        .values({
          mediaPointId: args.mediaPointId,
          tradeCampaignId: args.tradeCampaignId || null,
          mediaVariationTypeId: point.mediaVariationTypeId || null,
          serviceTypeId: args.serviceTypeId || point.serviceTypeId || null,
          subserviceTypeId: args.subserviceTypeId || null,
          productTypeId: args.productTypeId || null,
          responsibleUserId: args.responsibleUserId || null,
          name: args.name.trim(),
          objective: args.objective?.trim() || null,
          startsOn: args.startsOn,
          endsOn: args.endsOn,
          partnershipType: args.partnershipType || "paid",
          estimatedCost: args.estimatedCost != null ? String(args.estimatedCost) : "0.00",
          notes: args.notes || null,
          campaignDetails: args.campaignDetails || null,
          status,
        })
        .returning();

      await writeAuditLog({
        actorUserId: user.id,
        entityType: "media_campaign",
        entityId: created.id,
        action: status === "scheduled" ? "schedule" : "create",
        afterData: created,
      });

      return {
        sucesso: true,
        mensagem: `Veiculação de mídia "${created.name}" cadastrada com sucesso!`,
        id: created.id,
        status: created.status,
      };
    },
  },

  {
    name: "cadastrar_midia_audiovisual",
    description: "Cadastra veiculação audiovisual (emissoras de rádio e TV, programas, quantidade de spots, horários e custos de veiculação).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome da veiculação audiovisual (obrigatório)" },
        startsOn: { type: "string", description: "Data de início da veiculação (YYYY-MM-DD, obrigatório)" },
        endsOn: { type: "string", description: "Data de término da veiculação (YYYY-MM-DD, obrigatório)" },
        mediaPointId: { type: "number", description: "ID do ponto/programa audiovisual em mediaPoints (opcional)" },
        supplierId: { type: "number", description: "ID da emissora / fornecedor (opcional)" },
        cityId: { type: "number", description: "ID da cidade sede da emissora (opcional)" },
        tradeCampaignId: { type: "number", description: "ID da campanha comercial vinculada (opcional)" },
        programName: { type: "string", description: "Nome do programa na grade da emissora" },
        airingSchedule: { type: "string", description: "Horários e frequência de exibição (ex: Seg a Sex às 12h e 19h)" },
        spotCount: { type: "number", description: "Quantidade total de inserções / spots contratados" },
        spotName: { type: "string", description: "Nome ou título da peça/spot de áudio ou vídeo" },
        activeSpotId: { type: "number", description: "ID de spot já existente no catálogo mediaSpots" },
        estimatedCost: { type: "number", description: "Custo total estimado da veiculação em R$" },
        partnershipType: {
          type: "string",
          enum: ["paid", "barter", "mixed"],
          description: "Tipo de parceria/pagamento (padrão: paid)",
        },
        signalCityIds: {
          type: "array",
          items: { type: "number" },
          description: "IDs das cidades atendidas pelo alcance do sinal",
        },
        schedules: {
          type: "array",
          description: "Grade de inserções e programas",
          items: {
            type: "object",
            properties: {
              programName: { type: "string" },
              weekday: { type: "number", description: "Dia da semana (0=Domingo, 1=Segunda, etc.)" },
              specificDate: { type: "string" },
              startsAt: { type: "string", description: "Horário inicial (HH:mm)" },
              endsAt: { type: "string", description: "Horário final (HH:mm)" },
              notes: { type: "string" },
            },
            required: ["startsAt", "endsAt"],
          },
        },
        notes: { type: "string", description: "Observações adicionais" },
      },
      required: ["name", "startsOn", "endsOn"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "media.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      if (args.endsOn < args.startsOn) {
        throw new Error("A data de término deve ser posterior à data de início.");
      }

      let pointId = args.mediaPointId;
      if (!pointId) {
        const points = await database
          .select()
          .from(mediaPoints)
          .where(and(eq(mediaPoints.operationCategory, "audio_video"), eq(mediaPoints.status, "active")))
          .limit(10);

        let match = points.find(p => (!args.cityId || p.cityId === args.cityId) && (!args.supplierId || p.supplierId === args.supplierId));
        if (!match && points.length > 0) match = points[0];

        if (match) {
          pointId = match.id;
        } else {
          const [allSuppliers, allCities, allMediaTypes] = await Promise.all([
            database.select().from(suppliers).where(eq(suppliers.active, true)).limit(1),
            database.select().from(cities).where(eq(cities.active, true)).limit(1),
            database.select().from(mediaTypes).where(eq(mediaTypes.active, true)).limit(1),
          ]);
          const targetSupplierId = args.supplierId || allSuppliers[0]?.id;
          const targetCityId = args.cityId || allCities[0]?.id;
          const targetMediaTypeId = allMediaTypes[0]?.id;

          if (!targetSupplierId || !targetCityId || !targetMediaTypeId) {
            throw new Error("Não foi possível criar o ponto audiovisual. Cadastre fornecedor, cidade e tipo de mídia.");
          }

          const [newPoint] = await database
            .insert(mediaPoints)
            .values({
              supplierId: targetSupplierId,
              cityId: targetCityId,
              mediaTypeId: targetMediaTypeId,
              name: `Emissora - ${args.programName || args.name.trim()}`,
              operationCategory: "audio_video",
              channelKind: "standard",
              status: "active",
              partnershipType: args.partnershipType || "paid",
            })
            .returning();
          pointId = newPoint.id;
        }
      }

      let activeSpotId = args.activeSpotId || null;
      if (!activeSpotId && args.spotName) {
        const [spot] = await database
          .insert(mediaSpots)
          .values({
            name: args.spotName.trim(),
            active: true,
            createdByUserId: user.id,
          })
          .returning();
        activeSpotId = spot.id;
      }

      const status = campaignStatusFor(args.startsOn);
      const [campaign] = await database
        .insert(mediaCampaigns)
        .values({
          mediaPointId: pointId,
          tradeCampaignId: args.tradeCampaignId || null,
          name: args.name.trim(),
          objective: "Veiculação de mídia audiovisual (Rádio / TV)",
          startsOn: args.startsOn,
          endsOn: args.endsOn,
          partnershipType: args.partnershipType || "paid",
          estimatedCost: args.estimatedCost != null ? String(args.estimatedCost) : "0.00",
          notes: args.notes || null,
          campaignConfig: {
            airingSchedule: args.airingSchedule || undefined,
            activeSpotId: activeSpotId || undefined,
            materialQuantity: args.spotCount || undefined,
          },
          status,
        })
        .returning();

      if (Array.isArray(args.signalCityIds) && args.signalCityIds.length > 0) {
        await database.insert(mediaCampaignCityDistributions).values(
          args.signalCityIds.map((cId: number) => ({
            mediaCampaignId: campaign.id,
            cityId: cId,
            quantity: 1,
            notes: "Alcance de sinal de transmissão",
          }))
        );
      }

      if (Array.isArray(args.schedules) && args.schedules.length > 0) {
        await database.insert(mediaCampaignSchedules).values(
          args.schedules.map((s: any) => ({
            mediaCampaignId: campaign.id,
            programName: s.programName || args.programName || "Programa",
            weekday: s.weekday ?? null,
            specificDate: s.specificDate ?? null,
            cityId: args.cityId || null,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            notes: s.notes || null,
            createdByUserId: user.id,
          }))
        );
      }

      await writeAuditLog({
        actorUserId: user.id,
        entityType: "media_campaign",
        entityId: campaign.id,
        action: status === "scheduled" ? "schedule" : "create",
        afterData: { ...campaign, activeSpotId, signalCityIds: args.signalCityIds, schedules: args.schedules },
      });

      return {
        sucesso: true,
        mensagem: `Veiculação audiovisual "${campaign.name}" cadastrada com sucesso!`,
        id: campaign.id,
        status: campaign.status,
      };
    },
  },

  {
    name: "cadastrar_midia_volante",
    description: "Cadastra veiculação de mídia volante (carros de som, rotas, dias de rodagem, horários e custos).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome da veiculação volante (obrigatório)" },
        startsOn: { type: "string", description: "Data de início da rodagem (YYYY-MM-DD, obrigatório)" },
        endsOn: { type: "string", description: "Data de término da rodagem (YYYY-MM-DD, obrigatório)" },
        mediaPointId: { type: "number", description: "ID do ponto/veículo volante em mediaPoints (opcional)" },
        supplierId: { type: "number", description: "ID do fornecedor de carro de som (opcional)" },
        cityId: { type: "number", description: "ID da cidade de rodagem (opcional)" },
        tradeCampaignId: { type: "number", description: "ID da campanha comercial vinculada (opcional)" },
        dailyRoute: { type: "string", description: "Descrição do itinerário ou rota padrão de rodagem" },
        circulationDays: { type: "number", description: "Quantidade total de dias de circulação" },
        dailyRate: { type: "number", description: "Valor da diária do veículo em R$" },
        estimatedCost: { type: "number", description: "Custo total estimado da veiculação" },
        partnershipType: {
          type: "string",
          enum: ["paid", "barter", "mixed"],
          description: "Tipo de parceria/pagamento (padrão: paid)",
        },
        runs: {
          type: "array",
          description: "Lista de rodagens específicas programadas para soundCarRuns",
          items: {
            type: "object",
            properties: {
              drivenOn: { type: "string", description: "Data da rodagem (YYYY-MM-DD)" },
              startsAt: { type: "string", description: "Horário inicial (HH:mm)" },
              endsAt: { type: "string", description: "Horário final (HH:mm)" },
              route: { type: "string", description: "Itinerário específico do dia" },
              notes: { type: "string" },
            },
            required: ["drivenOn"],
          },
        },
        schedules: {
          type: "array",
          description: "Grade de agendamentos por bairro ou horário em mediaCampaignSchedules",
          items: {
            type: "object",
            properties: {
              programName: { type: "string" },
              weekday: { type: "number" },
              specificDate: { type: "string" },
              cityId: { type: "number" },
              neighborhoodId: { type: "number" },
              startsAt: { type: "string" },
              endsAt: { type: "string" },
              routeDescription: { type: "string" },
              notes: { type: "string" },
            },
            required: ["startsAt", "endsAt"],
          },
        },
        notes: { type: "string", description: "Observações gerais" },
      },
      required: ["name", "startsOn", "endsOn"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "media.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      if (args.endsOn < args.startsOn) {
        throw new Error("A data de término deve ser posterior à data de início.");
      }

      let pointId = args.mediaPointId;
      if (!pointId) {
        const points = await database
          .select()
          .from(mediaPoints)
          .where(and(eq(mediaPoints.operationCategory, "sound_car"), eq(mediaPoints.status, "active")))
          .limit(10);

        let match = points.find(p => (!args.cityId || p.cityId === args.cityId) && (!args.supplierId || p.supplierId === args.supplierId));
        if (!match && points.length > 0) match = points[0];

        if (match) {
          pointId = match.id;
        } else {
          const [allSuppliers, allCities, allMediaTypes] = await Promise.all([
            database.select().from(suppliers).where(eq(suppliers.active, true)).limit(1),
            database.select().from(cities).where(eq(cities.active, true)).limit(1),
            database.select().from(mediaTypes).where(eq(mediaTypes.active, true)).limit(1),
          ]);
          const targetSupplierId = args.supplierId || allSuppliers[0]?.id;
          const targetCityId = args.cityId || allCities[0]?.id;
          const targetMediaTypeId = allMediaTypes[0]?.id;

          if (!targetSupplierId || !targetCityId || !targetMediaTypeId) {
            throw new Error("Não foi possível criar o ponto de carro de som. Cadastre fornecedor, cidade e tipo de mídia.");
          }

          const [newPoint] = await database
            .insert(mediaPoints)
            .values({
              supplierId: targetSupplierId,
              cityId: targetCityId,
              mediaTypeId: targetMediaTypeId,
              name: `Carro de Som - ${args.name.trim()}`,
              operationCategory: "sound_car",
              channelKind: "external",
              status: "active",
              partnershipType: args.partnershipType || "paid",
            })
            .returning();
          pointId = newPoint.id;
        }
      }

      const totalCost = args.estimatedCost != null
        ? args.estimatedCost
        : (args.dailyRate && args.circulationDays ? args.dailyRate * args.circulationDays : 0);

      const status = campaignStatusFor(args.startsOn);
      const [campaign] = await database
        .insert(mediaCampaigns)
        .values({
          mediaPointId: pointId,
          tradeCampaignId: args.tradeCampaignId || null,
          name: args.name.trim(),
          objective: "Veiculação de mídia volante (Carro de Som)",
          startsOn: args.startsOn,
          endsOn: args.endsOn,
          partnershipType: args.partnershipType || "paid",
          estimatedCost: String(totalCost),
          notes: args.notes || null,
          campaignConfig: {
            dailyRoute: args.dailyRoute || undefined,
            circulationDays: args.circulationDays || undefined,
            dailyRate: args.dailyRate || undefined,
          },
          status,
        })
        .returning();

      if (Array.isArray(args.runs) && args.runs.length > 0) {
        await database.insert(soundCarRuns).values(
          args.runs.map((r: any) => ({
            mediaCampaignId: campaign.id,
            drivenOn: r.drivenOn,
            startsAt: r.startsAt || null,
            endsAt: r.endsAt || null,
            route: r.route || args.dailyRoute || null,
            notes: r.notes || null,
            createdByUserId: user.id,
          }))
        );
      }

      if (Array.isArray(args.schedules) && args.schedules.length > 0) {
        await database.insert(mediaCampaignSchedules).values(
          args.schedules.map((s: any) => ({
            mediaCampaignId: campaign.id,
            programName: s.programName || "Carro de Som",
            weekday: s.weekday ?? null,
            specificDate: s.specificDate ?? null,
            cityId: s.cityId || args.cityId || null,
            neighborhoodId: s.neighborhoodId || null,
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            routeDescription: s.routeDescription || args.dailyRoute || null,
            notes: s.notes || null,
            createdByUserId: user.id,
          }))
        );
      }

      await writeAuditLog({
        actorUserId: user.id,
        entityType: "media_campaign",
        entityId: campaign.id,
        action: status === "scheduled" ? "schedule" : "create",
        afterData: { ...campaign, runsCount: args.runs?.length, schedulesCount: args.schedules?.length },
      });

      return {
        sucesso: true,
        mensagem: `Mídia volante "${campaign.name}" cadastrada com sucesso!`,
        id: campaign.id,
        status: campaign.status,
      };
    },
  },

  {
    name: "cadastrar_influenciador",
    description: "Cadastra influenciadores, cidades de atuação, rede social, @, pacotes de postagens/stories e cachês.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do influenciador ou criador de conteúdo (obrigatório)" },
        socialHandle: { type: "string", description: "@ no Instagram, TikTok ou perfil de rede social" },
        phone: { type: "string", description: "Telefone / WhatsApp de contato" },
        email: { type: "string", description: "E-mail de contato" },
        paymentMethod: { type: "string", description: "Forma de pagamento (ex: PIX, Transferência, Boleto)" },
        paymentFrequency: { type: "string", description: "Frequência de pagamento (ex: Mensal, Por entrega, Avulso)" },
        paymentDay: { type: "number", description: "Dia do mês para pagamento (1 a 31)" },
        cacheValue: { type: "number", description: "Valor de cachê ou pacote de divulgação em R$" },
        notes: { type: "string", description: "Observações, pacotes de entregáveis (stories, reels), cidades de atuação" },
        groupId: { type: "number", description: "ID de grupo de influenciadores para vinculação imediata (opcional)" },
        profileImageUrl: { type: "string", description: "URL da foto de perfil ou mídia kit" },
        active: { type: "boolean", description: "Se o cadastro está ativo (padrão: true)" },
      },
      required: ["name"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "media.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      let notes = args.notes?.trim() || "";
      if (args.cacheValue != null) {
        const cacheNote = `Cachê: R$ ${Number(args.cacheValue).toFixed(2)}`;
        notes = notes ? `${notes} | ${cacheNote}` : cacheNote;
      }

      const [created] = await database
        .insert(influencers)
        .values({
          name: args.name.trim(),
          socialHandle: args.socialHandle?.trim() || null,
          phone: args.phone?.trim() || null,
          email: args.email?.trim() || null,
          paymentMethod: args.paymentMethod?.trim() || null,
          paymentFrequency: args.paymentFrequency?.trim() || null,
          paymentDay: args.paymentDay ?? null,
          profileImageUrl: args.profileImageUrl || null,
          notes: notes || null,
          active: args.active !== false,
        })
        .returning();

      if (args.groupId) {
        await database
          .insert(influencerGroupMembers)
          .values({
            influencerGroupId: args.groupId,
            influencerId: created.id,
          })
          .onConflictDoNothing();
      }

      await writeAuditLog({
        actorUserId: user.id,
        entityType: "influencer",
        entityId: created.id,
        action: "create",
        afterData: created,
      });

      return {
        sucesso: true,
        mensagem: `Influenciador "${created.name}" cadastrado com sucesso!`,
        id: created.id,
        influenciador: created,
      };
    },
  },

  {
    name: "cadastrar_evento",
    description: "Cadastra evento de trade/marketing com nome do evento, local/endereço, datas de início/fim, público estimado, alvará e custos.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do evento (obrigatório)" },
        cityId: { type: "number", description: "ID da cidade do evento (obrigatório)" },
        startsAt: { type: "string", description: "Data/hora de início em formato ISO (obrigatório)" },
        endsAt: { type: "string", description: "Data/hora de término em formato ISO" },
        eventTypeId: { type: "number", description: "ID do tipo de evento (opcional, usa padrão se omitido)" },
        tradeCampaignId: { type: "number", description: "ID da campanha comercial vinculada (opcional)" },
        address: { type: "string", description: "Endereço ou local do evento" },
        estimatedCost: { type: "number", description: "Custo total estimado em R$" },
        partnershipType: {
          type: "string",
          enum: ["paid", "barter", "mixed"],
          description: "Tipo de parceria (padrão: paid)",
        },
        commercialSupervisorId: { type: "number", description: "ID do supervisor comercial responsável" },
        estimatedAudience: { type: "number", description: "Público estimado presente no evento" },
        permitInfo: { type: "string", description: "Informações sobre alvará, licenças ou autorizações públicas" },
        preEventNotes: { type: "string", description: "Notas e planejamento pré-evento" },
        partnershipReason: { type: "string", description: "Justificativa da parceria ou investimento" },
        status: {
          type: "string",
          enum: ["planned", "in_progress", "paused", "completed", "cancelled"],
          description: "Status do evento (padrão: planned)",
        },
        supplierIds: {
          type: "array",
          items: { type: "number" },
          description: "IDs de fornecedores vinculados ao evento",
        },
        serviceTypeIds: {
          type: "array",
          items: { type: "number" },
          description: "IDs de tipos de serviço contratados para o evento",
        },
        teamMemberIds: {
          type: "array",
          items: { type: "number" },
          description: "IDs de colaboradores da equipe de trade alocados",
        },
        stockAllocations: {
          type: "array",
          description: "Materiais e brindes de estoque alocados",
          items: {
            type: "object",
            properties: {
              stockItemId: { type: "number" },
              quantity: { type: "number" },
            },
            required: ["stockItemId", "quantity"],
          },
        },
      },
      required: ["name", "cityId", "startsAt"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "events.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      const startsAt = new Date(args.startsAt);
      if (Number.isNaN(startsAt.getTime())) {
        throw new Error("Data de início (startsAt) inválida.");
      }

      const endsAt = args.endsAt ? new Date(args.endsAt) : null;
      if (endsAt && endsAt < startsAt) {
        throw new Error("O término do evento deve ser posterior ao início.");
      }

      let typeId = args.eventTypeId;
      if (!typeId) {
        const types = await database.select().from(eventTypes).where(eq(eventTypes.active, true)).limit(1);
        typeId = types[0]?.id || 1;
      }

      let notes = args.preEventNotes?.trim() || "";
      if (args.estimatedAudience != null) {
        notes = notes ? `${notes} | Público estimado: ${args.estimatedAudience}` : `Público estimado: ${args.estimatedAudience}`;
      }
      if (args.permitInfo) {
        notes = notes ? `${notes} | Alvará: ${args.permitInfo}` : `Alvará: ${args.permitInfo}`;
      }

      const [created] = await database
        .insert(events)
        .values({
          name: args.name.trim(),
          cityId: args.cityId,
          eventTypeId: typeId,
          tradeCampaignId: args.tradeCampaignId || null,
          address: args.address?.trim() || null,
          startsAt,
          endsAt,
          commercialSupervisorId: args.commercialSupervisorId || null,
          partnershipType: args.partnershipType || "paid",
          estimatedCost: args.estimatedCost != null ? String(args.estimatedCost) : "0.00",
          partnershipReason: args.partnershipReason?.trim() || null,
          preEventNotes: notes || null,
          status: args.status || "planned",
        })
        .returning();

      if (Array.isArray(args.supplierIds) && args.supplierIds.length > 0) {
        await database.insert(eventSuppliers).values(
          uniqueNumbers(args.supplierIds).map(sId => ({ eventId: created.id, supplierId: sId }))
        );
      }

      if (Array.isArray(args.serviceTypeIds) && args.serviceTypeIds.length > 0) {
        await database.insert(eventServices).values(
          uniqueNumbers(args.serviceTypeIds).map(stId => ({ eventId: created.id, serviceTypeId: stId }))
        );
      }

      if (Array.isArray(args.teamMemberIds) && args.teamMemberIds.length > 0) {
        await database.insert(eventTeamMembers).values(
          uniqueNumbers(args.teamMemberIds).map(uId => ({ eventId: created.id, userId: uId }))
        );
      }

      if (Array.isArray(args.stockAllocations) && args.stockAllocations.length > 0) {
        await database.insert(eventStockItems).values(
          args.stockAllocations.map((alloc: any) => ({
            eventId: created.id,
            stockItemId: alloc.stockItemId,
            plannedQuantity: Number(alloc.quantity).toFixed(2),
          }))
        );
      }

      await writeAuditLog({
        actorUserId: user.id,
        cityId: args.cityId,
        entityType: "event",
        entityId: created.id,
        action: "create",
        afterData: created,
      });

      return {
        sucesso: true,
        mensagem: `Evento "${created.name}" cadastrado com sucesso!`,
        id: created.id,
        evento: created,
      };
    },
  },

  {
    name: "cadastrar_item_estoque",
    description: "Cadastra item no catálogo de materiais de estoque (tendas, uniformes, brindes, panfletos, faixas) e saldo inicial por cidade/regional.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nome do material ou brinde (obrigatório)" },
        regionalId: { type: "number", description: "ID da regional à qual o item pertence (obrigatório)" },
        cityId: { type: "number", description: "ID da cidade (opcional, caso seja estoque específico de cidade)" },
        sku: { type: "string", description: "Código SKU único do material (opcional, gerado automaticamente se omitido)" },
        category: {
          type: "string",
          enum: ["brinde_relacionamento", "brinde_vip", "material_suporte"],
          description: "Categoria do material (padrão: material_suporte)",
        },
        unit: { type: "string", description: "Unidade de medida (ex: un, kit, cx, pct, m; padrão: un)" },
        minimumQuantity: { type: "number", description: "Estoque mínimo / ponto de ressuprimento (padrão: 0)" },
        initialQuantity: { type: "number", description: "Saldo inicial a creditar no estoque (padrão: 0)" },
        unitCost: { type: "number", description: "Custo unitário em R$" },
        description: { type: "string", description: "Descrição detalhada do material" },
        productTypeId: { type: "number", description: "ID do tipo de produto relacionado (opcional)" },
        stockCategoryId: { type: "number", description: "ID da categoria customizada de estoque (opcional)" },
      },
      required: ["name", "regionalId"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "inventory.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      const sku = (args.sku?.trim() || `MAT-${Date.now().toString(36).toUpperCase()}`).toUpperCase();

      const [item] = await database
        .insert(stockItems)
        .values({
          regionalId: args.regionalId,
          cityId: args.cityId || null,
          productTypeId: args.productTypeId || null,
          stockCategoryId: args.stockCategoryId || null,
          sku,
          name: args.name.trim(),
          description: args.description?.trim() || null,
          unit: args.unit?.trim() || "un",
          category: args.category || "material_suporte",
          minimumQuantity: (args.minimumQuantity || 0).toFixed(2),
          active: true,
        })
        .returning();

      const initialQty = Number(args.initialQuantity || 0);

      await database
        .insert(stockBalances)
        .values({
          stockItemId: item.id,
          quantity: initialQty.toFixed(2),
        })
        .onConflictDoNothing();

      if (initialQty > 0) {
        await database.insert(stockMovements).values({
          stockItemId: item.id,
          movementType: "entry",
          quantity: initialQty.toFixed(2),
          unitCost: args.unitCost != null ? Number(args.unitCost).toFixed(2) : null,
          occurredAt: new Date(),
          reference: "Saldo inicial de implantação",
          notes: "Movimentação inicial gerada no cadastro do item",
          performedByUserId: user.id,
        });
      }

      await writeAuditLog({
        actorUserId: user.id,
        regionalId: args.regionalId,
        entityType: "stock_item",
        entityId: item.id,
        action: "create",
        afterData: { ...item, initialQuantity: initialQty },
      });

      return {
        sucesso: true,
        mensagem: `Item de estoque "${item.name}" (SKU: ${item.sku}) cadastrado com saldo de ${initialQty} ${item.unit}.`,
        id: item.id,
        sku: item.sku,
        saldo: initialQty,
      };
    },
  },

  {
    name: "lancar_movimentacao_estoque",
    description: "Registra movimentação de estoque (entrada, saída, ajuste) de um item para determinada cidade/regional.",
    inputSchema: {
      type: "object",
      properties: {
        stockItemId: { type: "number", description: "ID do item de estoque (obrigatório)" },
        movementType: {
          type: "string",
          enum: ["entry", "exit", "adjustment"],
          description: "Tipo de movimentação: entry=entrada, exit=saída, adjustment=ajuste de inventário (obrigatório)",
        },
        quantity: { type: "number", description: "Quantidade a movimentar (número positivo, obrigatório)" },
        unitCost: { type: "number", description: "Custo unitário em R$ (opcional)" },
        occurredAt: { type: "string", description: "Data/hora da movimentação em formato ISO (padrão: agora)" },
        reference: { type: "string", description: "Referência documental (ex: NF 1234, Ação Centro)" },
        notes: { type: "string", description: "Justificativa ou notas da movimentação" },
        responsibleCommercialSupervisorId: { type: "number", description: "ID do supervisor comercial responsável" },
        recipientCommercialSupervisorId: { type: "number", description: "ID do supervisor comercial destinatário" },
      },
      required: ["stockItemId", "movementType", "quantity"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "inventory.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      if (args.quantity <= 0) {
        throw new Error("A quantidade a movimentar deve ser maior que zero.");
      }

      const occurredAt = args.occurredAt ? new Date(args.occurredAt) : new Date();

      const result = await database.transaction(async tx => {
        const [item] = await tx
          .select()
          .from(stockItems)
          .where(eq(stockItems.id, args.stockItemId))
          .limit(1);

        if (!item) {
          throw new Error(`Item de estoque #${args.stockItemId} não encontrado.`);
        }

        await tx
          .insert(stockBalances)
          .values({ stockItemId: item.id, quantity: "0.00" })
          .onConflictDoNothing();

        const delta = args.movementType === "exit" ? -args.quantity : args.quantity;

        const [balance] = await tx
          .update(stockBalances)
          .set({
            quantity: sql`${stockBalances.quantity} + ${delta}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(stockBalances.stockItemId, item.id),
              sql`${stockBalances.quantity} + ${delta} >= 0`
            )
          )
          .returning();

        if (!balance) {
          throw new Error("A saída informada deixaria o saldo de estoque negativo.");
        }

        const [created] = await tx
          .insert(stockMovements)
          .values({
            stockItemId: item.id,
            movementType: args.movementType,
            quantity: Number(args.quantity).toFixed(2),
            unitCost: args.unitCost != null ? Number(args.unitCost).toFixed(2) : null,
            occurredAt,
            reference: args.reference || null,
            notes: args.notes || null,
            responsibleCommercialSupervisorId: args.responsibleCommercialSupervisorId || null,
            recipientCommercialSupervisorId: args.recipientCommercialSupervisorId || null,
            performedByUserId: user.id,
          })
          .returning();

        return { item, created, balance: Number(balance.quantity) };
      });

      await writeAuditLog({
        actorUserId: user.id,
        regionalId: result.item.regionalId,
        entityType: "stock_movement",
        entityId: result.created.id,
        action: "create",
        afterData: result.created,
      });

      return {
        sucesso: true,
        mensagem: `Movimentação de ${args.movementType} (${args.quantity} ${result.item.unit}) registrada com sucesso. Novo saldo: ${result.balance}.`,
        id: result.created.id,
        novoSaldo: result.balance,
      };
    },
  },

  {
    name: "cadastrar_despesa_financeira",
    description: "Lança despesa financeira/custo operacional vinculada a uma ação, evento ou mídia, com centro de custo, categoria e fornecedor.",
    inputSchema: {
      type: "object",
      properties: {
        operationType: {
          type: "string",
          enum: ["action", "event", "media_campaign", "trade_operation"],
          description: "Tipo de operação vinculada (obrigatório)",
        },
        operationId: { type: "number", description: "ID da operação correspondente (obrigatório)" },
        budgetType: {
          type: "string",
          enum: ["trade_events", "branding_b2c"],
          description: "Centro de verba / categoria orçamentária (padrão: trade_events)",
        },
        investmentBase: { type: "number", description: "Custo de investimento base/produção em R$ (padrão: 0)" },
        permitCost: { type: "number", description: "Custo de alvará/taxas públicas em R$ (padrão: 0)" },
        storeCost: { type: "number", description: "Custo de locação/ponto em R$ (padrão: 0)" },
        otherCosts: { type: "number", description: "Outros custos operacionais em R$ (padrão: 0)" },
        notes: { type: "string", description: "Justificativa, centro de custo, fornecedor ou detalhes da despesa" },
        submitForApproval: {
          type: "boolean",
          description: "Se true, envia a despesa para aprovação (status: pending_approval); se false, salva como rascunho (draft)",
        },
      },
      required: ["operationType", "operationId"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "finance.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      if (args.operationType === "action") {
        const [a] = await database.select({ id: actions.id }).from(actions).where(eq(actions.id, args.operationId)).limit(1);
        if (!a) throw new Error(`Ação #${args.operationId} não encontrada.`);
      } else if (args.operationType === "event") {
        const [e] = await database.select({ id: events.id }).from(events).where(eq(events.id, args.operationId)).limit(1);
        if (!e) throw new Error(`Evento #${args.operationId} não encontrado.`);
      } else if (args.operationType === "media_campaign") {
        const [m] = await database.select({ id: mediaCampaigns.id }).from(mediaCampaigns).where(eq(mediaCampaigns.id, args.operationId)).limit(1);
        if (!m) throw new Error(`Veiculação de mídia #${args.operationId} não encontrada.`);
      }

      const status = args.submitForApproval ? "pending_approval" : "draft";
      const investmentBase = (args.investmentBase || 0).toFixed(2);
      const permitCost = (args.permitCost || 0).toFixed(2);
      const storeCost = (args.storeCost || 0).toFixed(2);
      const otherCosts = (args.otherCosts || 0).toFixed(2);
      const total = Number(investmentBase) + Number(permitCost) + Number(storeCost) + Number(otherCosts);

      const [saved] = await database
        .insert(operationCosts)
        .values({
          operationType: args.operationType,
          operationId: args.operationId,
          budgetType: args.budgetType || "trade_events",
          investmentBase,
          permitCost,
          storeCost,
          otherCosts,
          notes: args.notes || null,
          status,
          createdByUserId: user.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [operationCosts.operationType, operationCosts.operationId],
          set: {
            budgetType: args.budgetType || "trade_events",
            investmentBase,
            permitCost,
            storeCost,
            otherCosts,
            notes: args.notes || null,
            status,
            updatedAt: new Date(),
          },
        })
        .returning();

      await writeAuditLog({
        actorUserId: user.id,
        entityType: "operation_cost",
        entityId: saved.id,
        action: "upsert",
        afterData: saved,
      });

      return {
        sucesso: true,
        mensagem: `Despesa financeira registrada com sucesso! Total: R$ ${total.toFixed(2)}. Status: "${saved.status}".`,
        id: saved.id,
        total,
        status: saved.status,
        despesa: saved,
      };
    },
  },

  {
    name: "obter_configuracoes_sistema",
    description: "Retorna as configurações gerais e de branding ativas no sistema.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async (_args, user) => {
      await assertPermission(user, "settings.read");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      const rows = await database.select().from(appSettings);
      const brandingRow = rows.find(r => r.key === "app_branding");

      let brandingParsed;
      try {
        brandingParsed = brandingRow ? normalizeAppBranding(JSON.parse(brandingRow.value)) : normalizeAppBranding({});
      } catch {
        brandingParsed = normalizeAppBranding({});
      }

      const otherSettings: Record<string, string> = {};
      for (const row of rows) {
        if (row.key !== "app_branding") {
          otherSettings[row.key] = row.value;
        }
      }

      return {
        branding: brandingParsed,
        configuracoesGerais: otherSettings,
        totalConfiguracoes: rows.length,
      };
    },
  },

  {
    name: "atualizar_configuracoes_sistema",
    description: "Atualiza parâmetros de configuração do sistema e branding.",
    inputSchema: {
      type: "object",
      properties: {
        appName: { type: "string", description: "Nome da aplicação / sistema (mínimo 2 caracteres)" },
        appSubtitle: { type: "string", description: "Subtítulo ou slogan da aplicação" },
        fontFamily: { type: "string", description: "Família tipográfica (ex: inter, roboto, outfit)" },
        primaryColor: { type: "string", description: "Cor primária no formato hexadecimal #RRGGBB" },
        accentColor: { type: "string", description: "Cor de destaque no formato hexadecimal #RRGGBB" },
        backgroundColor: { type: "string", description: "Cor de fundo (tema claro) #RRGGBB" },
        darkBackgroundColor: { type: "string", description: "Cor de fundo (tema escuro) #RRGGBB" },
        customSettings: {
          type: "object",
          description: "Dicionário de chaves e valores para outras configurações do sistema em appSettings",
        },
      },
    },
    handler: async (args, user) => {
      await assertPermission(user, "settings.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      let updatedBranding = null;
      const hasBrandingUpdates =
        args.appName ||
        args.appSubtitle ||
        args.fontFamily ||
        args.primaryColor ||
        args.accentColor ||
        args.backgroundColor ||
        args.darkBackgroundColor;

      if (hasBrandingUpdates) {
        const [current] = await database
          .select()
          .from(appSettings)
          .where(eq(appSettings.key, "app_branding"))
          .limit(1);

        let currentVal = {};
        try {
          if (current?.value) currentVal = JSON.parse(current.value);
        } catch {
          currentVal = {};
        }

        const next = normalizeAppBranding({
          ...currentVal,
          ...(args.appName ? { appName: args.appName } : {}),
          ...(args.appSubtitle ? { appSubtitle: args.appSubtitle } : {}),
          ...(args.fontFamily ? { fontFamily: args.fontFamily } : {}),
          ...(args.primaryColor ? { primaryColor: args.primaryColor } : {}),
          ...(args.accentColor ? { accentColor: args.accentColor } : {}),
          ...(args.backgroundColor ? { backgroundColor: args.backgroundColor } : {}),
          ...(args.darkBackgroundColor ? { darkBackgroundColor: args.darkBackgroundColor } : {}),
        });

        await database
          .insert(appSettings)
          .values({
            key: "app_branding",
            value: JSON.stringify(next),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: appSettings.key,
            set: { value: JSON.stringify(next), updatedAt: new Date() },
          });

        updatedBranding = next;

        await writeAuditLog({
          actorUserId: user.id,
          entityType: "app_setting",
          entityId: 0,
          action: "update_branding",
          afterData: next,
        });
      }

      if (args.customSettings && typeof args.customSettings === "object") {
        for (const [k, v] of Object.entries(args.customSettings)) {
          if (typeof k === "string" && k.trim()) {
            const strVal = typeof v === "string" ? v : JSON.stringify(v);
            await database
              .insert(appSettings)
              .values({
                key: k.trim(),
                value: strVal,
                updatedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: appSettings.key,
                set: { value: strVal, updatedAt: new Date() },
              });

            await writeAuditLog({
              actorUserId: user.id,
              entityType: "app_setting",
              entityId: 0,
              action: `update_setting_${k.trim()}`,
              afterData: { key: k.trim(), value: strVal },
            });
          }
        }
      }

      return {
        sucesso: true,
        mensagem: "Configurações do sistema atualizadas com sucesso!",
        branding: updatedBranding,
      };
    },
  },

  {
    name: "cadastrar_bairro",
    description: "Cadastra um novo bairro vinculado a uma cidade (cityId, name).",
    inputSchema: {
      type: "object",
      properties: {
        cityId: { type: "number", description: "ID da cidade à qual o bairro pertence (obrigatório)" },
        name: { type: "string", description: "Nome do bairro (obrigatório)" },
        code: { type: "string", description: "Código ou identificador do bairro (opcional)" },
      },
      required: ["cityId", "name"],
    },
    handler: async (args, user) => {
      await assertPermission(user, "settings.write");
      const database = await getDb();
      if (!database) throw new Error("Banco de dados indisponível.");

      const [city] = await database
        .select({ id: cities.id, name: cities.name, active: cities.active })
        .from(cities)
        .where(eq(cities.id, args.cityId))
        .limit(1);

      if (!city || !city.active) {
        throw new Error(`Cidade #${args.cityId} não encontrada ou inativa.`);
      }

      const [existing] = await database
        .select({ id: neighborhoods.id, name: neighborhoods.name })
        .from(neighborhoods)
        .where(
          and(
            eq(neighborhoods.cityId, args.cityId),
            sql`lower(${neighborhoods.name}) = lower(${args.name.trim()})`
          )
        )
        .limit(1);

      if (existing) {
        throw new Error(`O bairro "${existing.name}" já está cadastrado nesta cidade.`);
      }

      const [created] = await database
        .insert(neighborhoods)
        .values({
          cityId: args.cityId,
          name: args.name.trim(),
          code: args.code?.trim() || null,
          active: true,
        })
        .returning();

      await writeAuditLog({
        actorUserId: user.id,
        cityId: args.cityId,
        entityType: "neighborhood",
        entityId: created.id,
        action: "create",
        afterData: created,
      });

      return {
        sucesso: true,
        mensagem: `Bairro "${created.name}" cadastrado com sucesso em ${city.name}!`,
        id: created.id,
        bairro: created,
      };
    },
  },
];
