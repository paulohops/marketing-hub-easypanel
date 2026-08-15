import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { actionTypes, campaignSectors, campaignTypes, cities, commercialSupervisors, eventTypes, financialCategories, mediaTypes, partners, providers, regionals, serviceTypes, stores, supplierOfferings, suppliers } from "../../drizzle/schema";

const getDbMock = vi.hoisted(() => vi.fn());
const assertPermissionMock = vi.hoisted(() => vi.fn());
const writeAuditLogMock = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({ getDb: getDbMock }));
vi.mock("../audit", () => ({ writeAuditLog: writeAuditLogMock }));
const storagePutMock = vi.hoisted(() => vi.fn());
vi.mock("../storage", () => ({ storagePut: storagePutMock }));
vi.mock("../authorization", async importOriginal => ({
  ...(await importOriginal<typeof import("../authorization")>()),
  assertPermission: assertPermissionMock,
}));

import { appRouter } from "../routers";

function createContext(): TrpcContext {
  return {
    user: {
      id: 1, openId: "admin-user", name: "Paulo Oliveira", email: "paulo@clustermg.com.br", phone: null,
      loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  assertPermissionMock.mockResolvedValue(undefined);
});

describe("settingsRouter via tRPC", () => {
  it("exclui Empresa por transação, preservando regionais e fornecedores com desvinculação segura", async () => {
    const provider = { id: 51, name: "Paulo", active: true };
    const linkedRegionals = [{ id: 12, name: "Triângulo" }];
    const linkedSuppliers = [{ id: 22, name: "Fornecedor Paulo" }];
    const selectMock = vi.fn()
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => [provider]) })) })) })
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => linkedRegionals) })) })
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => linkedSuppliers) })) });
    const detachRegionalSet = vi.fn(() => ({ where: vi.fn() }));
    const detachSupplierSet = vi.fn(() => ({ where: vi.fn() }));
    const deleteWhere = vi.fn();
    const transaction = {
      update: vi.fn()
        .mockReturnValueOnce({ set: detachRegionalSet })
        .mockReturnValueOnce({ set: detachSupplierSet }),
      delete: vi.fn(() => ({ where: deleteWhere })),
    };
    const database = { select: selectMock, transaction: vi.fn(async callback => callback(transaction)) };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.settings.deleteRegistry({ kind: "provider", id: 51 })).resolves.toEqual({ success: true });
    expect(database.transaction).toHaveBeenCalledTimes(1);
    expect(detachRegionalSet).toHaveBeenCalledWith({ providerId: null });
    expect(detachSupplierSet).toHaveBeenCalledWith(expect.objectContaining({ providerId: null }));
    expect(transaction.delete).toHaveBeenCalledWith(providers);
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "provider", entityId: 51, action: "delete",
      beforeData: expect.objectContaining({ detachedRegionalIds: [12], detachedSupplierIds: [22] }),
    }));
  });

  it("persiste o novo status para todos os domínios de Cadastro que o suportam", async () => {
    const domains = [
      ["provider", providers], ["regional", regionals], ["city", cities], ["store", stores], ["supplier", suppliers],
      ["partner", partners], ["supervisor", commercialSupervisors], ["service", serviceTypes], ["media", mediaTypes],
      ["action", actionTypes], ["event", eventTypes], ["campaign", campaignTypes], ["campaign_sector", campaignSectors],
      ["financial_category", financialCategories], ["supplier_offering", supplierOfferings],
    ] as const;
    let updateIndex = 0;
    const setMocks: ReturnType<typeof vi.fn>[] = [];
    const database = {
      update: vi.fn(table => {
        const expected = { id: updateIndex + 1, active: false };
        updateIndex += 1;
        const setMock = vi.fn((values: { active: boolean }) => ({
          where: vi.fn(() => ({ returning: vi.fn(() => [{ id: expected.id, active: values.active }]) })),
        }));
        setMocks.push(setMock);
        return { set: setMock, table };
      }),
    };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    for (const [kind] of domains) {
      await expect(caller.settings.setRegistryActive({ kind, id: updateIndex + 1, active: false })).resolves.toEqual({ success: true, active: false });
    }
    domains.forEach(([kind, table], index) => {
      expect(database.update).toHaveBeenNthCalledWith(index + 1, table);
      expect(setMocks[index]).toHaveBeenCalledWith(expect.objectContaining({ active: false }));
      expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: kind, action: "deactivate", afterData: { active: false } }));
    });
  });

  it("não registra auditoria quando o cadastro não existe para alteração de status", async () => {
    const database = {
      update: vi.fn(() => ({
        set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => []) })) })),
      })),
    };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.settings.setRegistryActive({ kind: "provider", id: 999, active: false })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });

  it("persiste cidade-matriz e paleta hexadecimal em uma Empresa vinculada ao território", async () => {
    const before = { id: 1, name: "Sempre Internet", brandColors: [], headquartersCityId: null };
    const updated = { ...before, headquartersCityId: 3, brandColors: ["#F45103", "#0E723B"] };
    const providerLimit = vi.fn(() => [before]);
    const headquartersLimit = vi.fn(() => [{ id: 3, providerId: 1 }]);
    const setProvider = vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [updated]) })) }));
    const database = {
      select: vi.fn()
        .mockReturnValueOnce({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: providerLimit })) })) })
        .mockReturnValueOnce({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: vi.fn(() => ({ limit: headquartersLimit })) })) })) }),
      update: vi.fn(() => ({ set: setProvider })),
    };
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.settings.updateProvider({ id: 1, name: "Sempre Internet", headquartersCityId: 3, brandColors: ["#f45103", "#0e723b"] })).resolves.toEqual(updated);
    expect(setProvider).toHaveBeenCalledWith(expect.objectContaining({ headquartersCityId: 3, brandColors: ["#F45103", "#0E723B"] }));
    expect(writeAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({ entityType: "provider", entityId: 1, action: "update" }));
  });

  it("armazena o Cartão CNPJ e o Manual da marca em chaves institucionais separadas", async () => {
    const provider = { id: 7, name: "OnNet Telecom", cnpjCardStorageKey: null, brandManualStorageKey: null };
    const cnpjUpdated = { ...provider, cnpjCardStorageKey: "trade/providers/7/cnpj-card-cartao.pdf", cnpjCardUrl: "https://files.example/cnpj.pdf" };
    const manualUpdated = { ...cnpjUpdated, brandManualStorageKey: "trade/providers/7/brand-manual-manual.pdf", brandManualUrl: "https://files.example/manual.pdf" };
    const selectProvider = () => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => [provider]) })) })) });
    const updateCnpj = vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [cnpjUpdated]) })) }));
    const updateManual = vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => [manualUpdated]) })) }));
    const database = { select: vi.fn().mockImplementation(selectProvider), update: vi.fn().mockReturnValueOnce({ set: updateCnpj }).mockReturnValueOnce({ set: updateManual }) };
    storagePutMock.mockResolvedValueOnce({ key: cnpjUpdated.cnpjCardStorageKey, url: cnpjUpdated.cnpjCardUrl }).mockResolvedValueOnce({ key: manualUpdated.brandManualStorageKey, url: manualUpdated.brandManualUrl });
    getDbMock.mockResolvedValue(database);
    const caller = appRouter.createCaller(createContext());
    const payload = Buffer.from("documento").toString("base64");

    await expect(caller.settings.uploadProviderCnpjCard({ providerId: 7, originalName: "cartão cnpj.pdf", mimeType: "application/pdf", dataBase64: payload })).resolves.toEqual(cnpjUpdated);
    await expect(caller.settings.uploadProviderBrandManual({ providerId: 7, originalName: "manual da marca.pdf", mimeType: "application/pdf", dataBase64: payload })).resolves.toEqual(manualUpdated);
    expect(storagePutMock).toHaveBeenNthCalledWith(1, expect.stringMatching(/^trade\/providers\/7\/cnpj-card-/), expect.any(Buffer), "application/pdf");
    expect(storagePutMock).toHaveBeenNthCalledWith(2, expect.stringMatching(/^trade\/providers\/7\/brand-manual-/), expect.any(Buffer), "application/pdf");
    expect(updateCnpj).toHaveBeenCalledWith(expect.objectContaining({ cnpjCardStorageKey: cnpjUpdated.cnpjCardStorageKey, cnpjCardUrl: cnpjUpdated.cnpjCardUrl }));
    expect(updateManual).toHaveBeenCalledWith(expect.objectContaining({ brandManualStorageKey: manualUpdated.brandManualStorageKey, brandManualUrl: manualUpdated.brandManualUrl }));
  });
});
