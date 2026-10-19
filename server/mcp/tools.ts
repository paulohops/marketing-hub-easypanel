import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  actionDebriefs,
  actionTypes,
  actions,
  campaignCities,
  campaignPromotionPlans,
  campaignPromotions,
  campaignRegionals,
  campaignSectors,
  campaignTypes,
  cities,
  commercialSupervisors,
  events,
  eventTypes,
  mediaTypes,
  providers,
  regionals,
  tradeCampaigns,
  type User,
} from "../../drizzle/schema";
import { writeAuditLog } from "../audit";
import { assertPermission, effectivePermissionKeys } from "../authorization";
import { getDb } from "../db";
import { canUpdateActionStatus } from "../routers/actions";

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
];
