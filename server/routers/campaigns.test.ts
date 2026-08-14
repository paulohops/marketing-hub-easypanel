import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const getDbMock = vi.hoisted(() => vi.fn());
const assertPermissionMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({ getDb: getDbMock }));
vi.mock("../audit", () => ({ writeAuditLog: writeAuditLogMock }));
vi.mock("../authorization", async importOriginal => {
  const actual = await importOriginal<typeof import("../authorization")>();
  return {
    ...actual,
    permissionModules: ["dashboard", "settings", "inventory", "finance", "media", "actions", "events", "operations", "documents", "map", "notifications"],
    permissionActions: ["read", "create", "update", "delete"],
    assertPermission: assertPermissionMock,
  };
});

import { appRouter } from "../routers";

function context(): TrpcContext {
  return {
    user: { id: 1, openId: "admin-user", name: "Paulo Oliveira", email: "paulo@clustermg.com.br", phone: null, loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  assertPermissionMock.mockResolvedValue(undefined);
});

describe("campaigns router", () => {
  it("persiste campanha, promoções, planos e cidades de forma estruturada", async () => {
    const campaignValues = vi.fn(() => ({ returning: vi.fn(() => [{ id: 77, name: "Volta às aulas" }]) }));
    const promotionValues = vi.fn(() => ({ returning: vi.fn(() => [{ id: 88, name: "Internet em dobro" }]) }));
    const planValues = vi.fn();
    const cityValues = vi.fn();
    const transaction = {
      insert: vi.fn()
        .mockReturnValueOnce({ values: campaignValues })
        .mockReturnValueOnce({ values: cityValues })
        .mockReturnValueOnce({ values: promotionValues })
        .mockReturnValueOnce({ values: planValues }),
      delete: vi.fn(() => ({ where: vi.fn() })),
    };
    const validCities = [{ id: 4, regionalId: 1, providerId: null }, { id: 7, regionalId: 1, providerId: null }];
    getDbMock.mockResolvedValue({
      select: vi.fn()
        .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => [{ id: 4 }]) })) })) })
        .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => [{ id: 7 }]) })) })) })
        .mockReturnValueOnce({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: vi.fn(() => validCities) })) })) }),
      transaction: vi.fn(async callback => callback(transaction)),
    });
    const caller = appRouter.createCaller(context());

    await expect(caller.campaigns.create({
      name: "Volta às aulas",
      objective: "Aumentar adesões",
      providerId: null,
      campaignTypeId: 4,
      campaignSectorId: 7,
      regionalId: null,
      cityIds: [4, 7],
      startsAt: new Date("2026-08-20T09:00:00Z"),
      endsAt: new Date("2026-08-31T22:00:00Z"),
      status: "scheduled",
      promotions: [{ name: "Internet em dobro", description: "Oferta para novos clientes", active: true, plans: [{ name: "300 Mega", speed: "300 Mbps", price: 99.9, unit: "mês", active: true }] }],
    })).resolves.toMatchObject({ id: 77, name: "Volta às aulas" });

    expect(campaignValues).toHaveBeenCalledWith(expect.objectContaining({ campaignTypeId: 4, campaignSectorId: 7 }));
    expect(cityValues).toHaveBeenCalledWith([{ campaignId: 77, cityId: 4 }, { campaignId: 77, cityId: 7 }]);
    expect(promotionValues).toHaveBeenCalledWith(expect.objectContaining({ campaignId: 77, name: "Internet em dobro", sortOrder: 0 }));
    expect(planValues).toHaveBeenCalledWith([{ campaignPromotionId: 88, name: "300 Mega", speed: "300 Mbps", description: null, price: "99.9", unit: "mês", active: true, sortOrder: 0 }]);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "trade_campaign", entityId: 77, action: "create" }));
  });

  it("bloqueia período inválido antes de acessar o banco", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.campaigns.create({ name: "Campanha inválida", providerId: null, regionalId: null, cityIds: [], startsAt: new Date("2026-08-31T10:00:00Z"), endsAt: new Date("2026-08-20T10:00:00Z"), status: "scheduled", promotions: [] })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "O término da campanha deve ser posterior ao início." });
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("renova a vigência, reativa a campanha e registra a alteração", async () => {
    const before = { id: 77, regionalId: 2, startsAt: new Date("2026-08-01T12:00:00Z"), endsAt: new Date("2026-08-31T12:00:00Z"), status: "completed" };
    const updated = { ...before, startsAt: new Date("2026-09-01T12:00:00Z"), endsAt: new Date("2026-09-30T12:00:00Z"), status: "active" };
    const set = vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [updated]) })) }));
    getDbMock.mockResolvedValue({
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => [before]) })) })) })),
      update: vi.fn(() => ({ set })),
    });
    const caller = appRouter.createCaller(context());

    await expect(caller.campaigns.renew({ campaignId: 77, startsAt: new Date("2026-09-01T12:00:00Z"), endsAt: new Date("2026-09-30T12:00:00Z") })).resolves.toEqual(updated);

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "active", startsAt: updated.startsAt, endsAt: updated.endsAt }));
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "trade_campaign", entityId: 77, action: "renew" }));
  });

  it("salva nota e resultado consolidados no debriefing da campanha", async () => {
    const before = { id: 77, regionalId: 2, debriefRating: null, debriefAt: null };
    const updated = { ...before, debriefRating: 5, debriefResult: "Meta superada" };
    const database = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => [before]) })) })) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [updated]) })) })) })),
    };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(context());

    await expect(caller.campaigns.saveDebrief({ campaignId: 77, rating: 5, notes: "Boa adesão", result: "Meta superada", completedAt: new Date("2026-08-31T22:00:00Z") })).resolves.toEqual(updated);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "trade_campaign", entityId: 77, action: "save_debrief" }));
  });

  it("persiste somente cidades pertencentes à segmentação da campanha em uma promoção", async () => {
    const promotion = { id: 88, campaignId: 77, providerId: null, regionalId: null };
    const promotionWhere = vi.fn(() => ({ limit: vi.fn(() => [promotion]) }));
    const explicitCitiesWhere = vi.fn(() => []);
    const regionalLinksWhere = vi.fn(() => []);
    const eligibleCitiesWhere = vi.fn(() => [{ cityId: 4, regionalId: 1, providerId: null }, { cityId: 7, regionalId: 1, providerId: null }]);
    const promotionCitiesValues = vi.fn();
    const transaction = {
      delete: vi.fn(() => ({ where: vi.fn() })),
      insert: vi.fn(() => ({ values: promotionCitiesValues })),
    };
    getDbMock.mockResolvedValue({
      select: vi.fn()
        .mockReturnValueOnce({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: promotionWhere })) })) })
        .mockReturnValueOnce({ from: vi.fn(() => ({ where: explicitCitiesWhere })) })
        .mockReturnValueOnce({ from: vi.fn(() => ({ where: regionalLinksWhere })) })
        .mockReturnValueOnce({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: eligibleCitiesWhere })) })) }),
      transaction: vi.fn(async callback => callback(transaction)),
    });
    const caller = appRouter.createCaller(context());

    await expect(caller.campaigns.savePromotionCities({ promotionId: 88, cityIds: [4, 7, 4] })).resolves.toEqual({ success: true, cityIds: [4, 7] });

    expect(promotionCitiesValues).toHaveBeenCalledWith([{ campaignPromotionId: 88, cityId: 4 }, { campaignPromotionId: 88, cityId: 7 }]);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "campaign_promotion", entityId: 88, action: "update_cities", afterData: { cityIds: [4, 7] } }));
  });

  it("persiste um modelo reutilizável com sua estrutura de promoções e planos", async () => {
    const templateValues = vi.fn(() => ({ returning: vi.fn(() => [{ id: 42, name: "Lançamento regional" }]) }));
    const promotionValues = vi.fn(() => ({ returning: vi.fn(() => [{ id: 43, name: "Fibra em dobro" }]) }));
    const planValues = vi.fn();
    const transaction = {
      insert: vi.fn()
        .mockReturnValueOnce({ values: templateValues })
        .mockReturnValueOnce({ values: promotionValues })
        .mockReturnValueOnce({ values: planValues }),
      delete: vi.fn(() => ({ where: vi.fn() })),
    };
    getDbMock.mockResolvedValue({ transaction: vi.fn(async callback => callback(transaction)) });
    const caller = appRouter.createCaller(context());

    await expect(caller.campaigns.saveTemplate({
      name: "Lançamento regional",
      description: "Base para campanhas de expansão",
      objective: "Gerar adesões",
      defaultStatus: "scheduled",
      defaultDurationDays: 30,
      active: true,
      promotions: [{ name: "Fibra em dobro", active: true, plans: [{ name: "500 Mega", speed: "500 Mbps", price: 109.9, unit: "mês", active: true }] }],
    })).resolves.toMatchObject({ id: 42, name: "Lançamento regional" });

    expect(promotionValues).toHaveBeenCalledWith(expect.objectContaining({ campaignTemplateId: 42, name: "Fibra em dobro", sortOrder: 0 }));
    expect(planValues).toHaveBeenCalledWith([{ campaignTemplatePromotionId: 43, name: "500 Mega", speed: "500 Mbps", description: null, price: "109.9", unit: "mês", active: true, sortOrder: 0 }]);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "campaign_template", entityId: 42, action: "create" }));
  });

  it("retorna dados de identificação completos para as operações vinculadas", async () => {
    const campaignRows = [{ campaign: { id: 77, providerId: null, regionalId: null, name: "Mês dos pais" }, regionalName: null, providerName: "Sempre Internet", providerLogoUrl: null, campaignTypeName: null, campaignSectorName: null, templateName: null }];
    const actionRows = [{ tradeCampaignId: 77, id: 5, name: "Panfletagem centro", status: "planned", cityName: "Belo Horizonte", typeName: "Ação externa", startsAt: new Date("2026-08-18T12:00:00Z") }];
    const eventRows = [{ tradeCampaignId: 77, id: 6, name: "Feira regional", status: "active", cityName: "Contagem", typeName: "Feira", startsAt: new Date("2026-08-20T12:00:00Z") }];
    const mediaRows = [{ tradeCampaignId: 77, id: 7, name: "Outdoor avenida", status: "active", cityName: "Betim", typeName: "Outdoor", startsOn: "2026-08-21", endsOn: "2026-08-31", partnershipType: "paid", estimatedCost: "1000", mediaPointId: 9, notes: null, campaignDetails: null }];
    const campaignQuery = { from: vi.fn(), leftJoin: vi.fn(), orderBy: vi.fn(() => campaignRows) };
    campaignQuery.from.mockReturnValue(campaignQuery);
    campaignQuery.leftJoin.mockReturnValue(campaignQuery);
    const actionQuery = { from: vi.fn(), innerJoin: vi.fn() };
    actionQuery.from.mockReturnValue(actionQuery);
    actionQuery.innerJoin.mockReturnValueOnce(actionQuery).mockReturnValueOnce(actionRows);
    const eventQuery = { from: vi.fn(), innerJoin: vi.fn() };
    eventQuery.from.mockReturnValue(eventQuery);
    eventQuery.innerJoin.mockReturnValueOnce(eventQuery).mockReturnValueOnce(eventRows);
    const mediaQuery = { from: vi.fn(), innerJoin: vi.fn() };
    mediaQuery.from.mockReturnValue(mediaQuery);
    mediaQuery.innerJoin.mockReturnValueOnce(mediaQuery).mockReturnValueOnce(mediaQuery).mockReturnValueOnce(mediaRows);
    const joinOrdered = rows => ({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ orderBy: vi.fn(() => rows) })) })) });
    const joinWhereOrdered = rows => ({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => rows) })) })) })) });
    const ordered = rows => ({ from: vi.fn(() => ({ orderBy: vi.fn(() => rows) })) });
    const documentQuery = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn(() => [
      { entityType: "action", entityId: 5, url: "/acao.png" },
      { entityType: "event", entityId: 6, url: "/evento.png" },
      { entityType: "media_campaign", entityId: 7, url: "/midia.png" },
    ]) };
    documentQuery.from.mockReturnValue(documentQuery);
    documentQuery.where.mockReturnValue(documentQuery);
    getDbMock.mockResolvedValue({
      select: vi.fn()
        .mockReturnValueOnce(campaignQuery)
        .mockReturnValueOnce(actionQuery)
        .mockReturnValueOnce(eventQuery)
        .mockReturnValueOnce(mediaQuery)
        .mockReturnValueOnce(joinOrdered([]))
        .mockReturnValueOnce(joinOrdered([]))
        .mockReturnValueOnce(joinWhereOrdered([]))
        .mockReturnValueOnce(ordered([]))
        .mockReturnValueOnce(joinOrdered([]))
        .mockReturnValueOnce(ordered([]))
        .mockReturnValueOnce(documentQuery),
    });
    const caller = appRouter.createCaller(context());

    await expect(caller.campaigns.list()).resolves.toEqual([
      expect.objectContaining({
        actions: [expect.objectContaining({ cityName: "Belo Horizonte", typeName: "Ação externa", imageUrl: "/acao.png" })],
        events: [expect.objectContaining({ cityName: "Contagem", typeName: "Feira", imageUrl: "/evento.png" })],
        media: [expect.objectContaining({ cityName: "Betim", typeName: "Outdoor", imageUrl: "/midia.png" })],
      }),
    ]);
  });
});
