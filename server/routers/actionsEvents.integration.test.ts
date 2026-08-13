import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

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

function referenceBuilder(rows: Array<Record<string, number | null>> = [{ id: 1, regionalId: 1, cityId: null, supplierId: 4 }]) {
  return { from: vi.fn(() => ({ where: vi.fn(() => rows) })) };
}

function operationalDatabase(created: { id: number }) {
  const entityValues = vi.fn(() => ({ returning: vi.fn(() => [created]) }));
  const supplierValues = vi.fn();
  const serviceValues = vi.fn();
  const teamValues = vi.fn();
  const stockValues = vi.fn();
  const transaction = {
    insert: vi.fn()
      .mockReturnValueOnce({ values: entityValues })
      .mockReturnValueOnce({ values: supplierValues })
      .mockReturnValueOnce({ values: serviceValues })
      .mockReturnValueOnce({ values: teamValues })
      .mockReturnValueOnce({ values: stockValues }),
  };
  return {
    database: { select: vi.fn(() => referenceBuilder()), transaction: vi.fn(async callback => callback(transaction)) },
    transaction,
    values: { entityValues, supplierValues, serviceValues, teamValues, stockValues },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  assertPermissionMock.mockResolvedValue(undefined);
});

describe("actions and events routers via tRPC", () => {
  it("persiste ação com supervisor, equipe, serviços, fornecedores e recursos planejados", async () => {
    const { database, transaction, values } = operationalDatabase({ id: 91 });
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.actions.create({ cityId: 1, actionTypeId: 2, name: "Blitz Centro", address: "Praça Sete", latitude: null, longitude: null, scheduledFor: new Date("2026-08-14T09:00:00Z"), endsAt: new Date("2026-08-14T12:00:00Z"), objective: "Gerar experimentação", commercialSupervisorId: 6, partnershipType: "mixed", estimatedCost: 1250.5, supplierIds: [4], serviceTypeIds: [5], teamMemberIds: [7], stockAllocations: [{ stockItemId: 8, quantity: 2 }] })).resolves.toEqual({ id: 91 });

    expect(transaction.insert).toHaveBeenCalledTimes(5);
    expect(values.entityValues).toHaveBeenCalledWith(expect.objectContaining({ commercialSupervisorId: 6, partnershipType: "mixed", estimatedCost: "1250.50" }));
    expect(values.supplierValues).toHaveBeenCalledWith([{ actionId: 91, supplierId: 4 }]);
    expect(values.serviceValues).toHaveBeenCalledWith([{ actionId: 91, serviceTypeId: 5 }]);
    expect(values.teamValues).toHaveBeenCalledWith([{ actionId: 91, userId: 7 }]);
    expect(values.stockValues).toHaveBeenCalledWith([{ actionId: 91, stockItemId: 8, plannedQuantity: "2.00" }]);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "action", entityId: 91, action: "create" }));
  });

  it("persiste evento com modalidade, custo, supervisor e recursos planejados", async () => {
    const { database, transaction, values } = operationalDatabase({ id: 92 });
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.events.create({ cityId: 1, eventTypeId: 3, name: "Feira Minas", address: "Expominas", latitude: null, longitude: null, startsAt: new Date("2026-08-20T10:00:00Z"), endsAt: new Date("2026-08-20T18:00:00Z"), commercialSupervisorId: 6, partnershipType: "barter", estimatedCost: 300, partnershipReason: "Cobertura regional", preEventNotes: "Levar materiais", supplierIds: [4], serviceTypeIds: [5], teamMemberIds: [7], stockAllocations: [{ stockItemId: 8, quantity: 1 }] })).resolves.toEqual({ id: 92 });

    expect(transaction.insert).toHaveBeenCalledTimes(5);
    expect(values.entityValues).toHaveBeenCalledWith(expect.objectContaining({ commercialSupervisorId: 6, partnershipType: "barter", estimatedCost: "300.00", partnershipReason: "Cobertura regional" }));
    expect(values.supplierValues).toHaveBeenCalledWith([{ eventId: 92, supplierId: 4 }]);
    expect(values.serviceValues).toHaveBeenCalledWith([{ eventId: 92, serviceTypeId: 5 }]);
    expect(values.teamValues).toHaveBeenCalledWith([{ eventId: 92, userId: 7 }]);
    expect(values.stockValues).toHaveBeenCalledWith([{ eventId: 92, stockItemId: 8, plannedQuantity: "1.00" }]);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "event", entityId: 92, action: "create" }));
  });

  it("persiste a decisão de repetição no debriefing de ação", async () => {
    const saved = { id: 31, actionId: 91, worthRepeating: false };
    const database = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => []) })) })),
      insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => [saved]) })) })),
    };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.actions.saveDebrief({ actionId: 91, rating: 4, notes: "Boa conversão", positives: "Abordagem", negatives: "Chuva", resultAchieved: true, worthRepeating: false, completedAt: new Date("2026-08-14T12:00:00Z") })).resolves.toEqual(saved);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "action_debrief", entityId: 31, action: "create" }));
  });

  it("persiste avaliação e decisão de renovação no pós-evento", async () => {
    const updated = { id: 92, status: "completed", rating: 5, worthRenewing: true };
    const database = { update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [updated]) })) })) })) };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.events.savePostEvent({ eventId: 92, postEventNotes: "Entrega integral", rating: 5, resultAchieved: true, worthRenewing: true, status: "completed" })).resolves.toEqual(updated);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "event", entityId: 92, action: "update" }));
  });

  it("bloqueia durações inválidas e recursos com quantidade inválida antes da persistência", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.actions.create({ cityId: 1, actionTypeId: 2, name: "Blitz", address: undefined, latitude: null, longitude: null, scheduledFor: new Date("2026-08-14T12:00:00Z"), endsAt: new Date("2026-08-14T09:00:00Z"), objective: "Gerar experimentação", commercialSupervisorId: null, partnershipType: "paid", estimatedCost: 0, supplierIds: [], serviceTypeIds: [], teamMemberIds: [], stockAllocations: [] })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "O término da ação deve ser posterior ao início." });
    await expect(caller.events.create({ cityId: 1, eventTypeId: 3, name: "Feira", address: undefined, latitude: null, longitude: null, startsAt: new Date("2026-08-20T10:00:00Z"), endsAt: null, commercialSupervisorId: null, partnershipType: "paid", estimatedCost: 0, partnershipReason: undefined, preEventNotes: undefined, supplierIds: [], serviceTypeIds: [], teamMemberIds: [], stockAllocations: [{ stockItemId: 8, quantity: 0 }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it("bloqueia vínculo operacional inexistente antes de iniciar a transação", async () => {
    const database = { select: vi.fn(() => referenceBuilder([])), transaction: vi.fn() };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.events.create({ cityId: 999, eventTypeId: 3, name: "Feira", address: undefined, latitude: null, longitude: null, startsAt: new Date("2026-08-20T10:00:00Z"), endsAt: null, commercialSupervisorId: null, partnershipType: "paid", estimatedCost: 0, partnershipReason: undefined, preEventNotes: undefined, supplierIds: [], serviceTypeIds: [], teamMemberIds: [], stockAllocations: [] })).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Vínculo de cidade inexistente ou indisponível." });
    expect(database.transaction).not.toHaveBeenCalled();
  });
});
