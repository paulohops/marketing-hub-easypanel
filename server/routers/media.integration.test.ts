import type { TrpcContext } from "../_core/context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getDbMock = vi.hoisted(() => vi.fn());
const assertPermissionMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({ getDb: getDbMock }));
vi.mock("../audit", () => ({ writeAuditLog: writeAuditLogMock }));
vi.mock("../authorization", async importOriginal => ({
  ...(await importOriginal<typeof import("../authorization")>()),
  assertPermission: assertPermissionMock,
}));

import { appRouter } from "../routers";

function createContext(): TrpcContext {
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

describe("media router via tRPC", () => {
  it("valida o spot selecionado na configuração de veiculação antes de acessar o banco", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.media.createConfiguredCampaign({
      mediaPointId: 12,
      name: "Veiculação rádio regional",
      startsOn: "2026-08-20",
      endsOn: "2026-08-31",
      estimatedCost: 2500,
      campaignConfig: {
        vehicleOperation: "Programa regional com inserções comerciais.",
        airingSchedule: "Segunda a sexta, às 07h15, 12h30 e 18h45.",
        activeSpotId: 0,
      },
    })).rejects.toThrow();

    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("persiste a nota, o resultado e o debriefing de uma campanha", async () => {
    const before = { id: 81, name: "Campanha Centro", rating: null, resultAchieved: null, feedback: null };
    const saved = { ...before, rating: 5, resultAchieved: true, feedback: "Ótimo alcance local e boa lembrança de marca." };
    const returning = vi.fn(() => [saved]);
    const whereUpdate = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where: whereUpdate }));
    const database = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => [before]) })) })) })),
      update: vi.fn(() => ({ set })),
    };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.media.saveDebrief({ campaignId: 81, rating: 5, resultAchieved: true, feedback: saved.feedback })).resolves.toEqual(saved);

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ rating: 5, resultAchieved: true, feedback: saved.feedback }));
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "media_campaign", entityId: 81, action: "save_debrief", beforeData: before, afterData: saved }));
  });
});
