import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const getDbMock = vi.hoisted(() => vi.fn());
const verifyPasswordMock = vi.hoisted(() => vi.fn());
const createSessionTokenMock = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({ getDb: getDbMock }));
vi.mock("../auth/localPasswords", async importOriginal => {
  const actual = await importOriginal<typeof import("../auth/localPasswords")>();
  return { ...actual, verifyLocalPassword: verifyPasswordMock };
});
vi.mock("../_core/sdk", () => ({ sdk: { createSessionToken: createSessionTokenMock } }));
vi.mock("../_core/cookies", () => ({ getSessionCookieOptions: () => ({ httpOnly: true, sameSite: "lax", secure: true }) }));

import { appRouter } from "../routers";

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function accountDatabase(account: Record<string, unknown>) {
  return {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => [account]) })) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
  };
}

describe("localAuthRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cria uma sessão protegida após validar as credenciais locais", async () => {
    const context = createContext();
    getDbMock.mockResolvedValue(accountDatabase({ id: 8, openId: "local:8", name: "Marina Trade", email: "marina@cluster.com", passwordHash: "hash", isActive: true }));
    verifyPasswordMock.mockResolvedValue(true);
    createSessionTokenMock.mockResolvedValue("sessao-local-assinada");
    const caller = appRouter.createCaller(context);

    await expect(caller.auth.local.login({ email: "MARINA@CLUSTER.COM", password: "SenhaSegura123" })).resolves.toEqual({ success: true });
    expect(verifyPasswordMock).toHaveBeenCalledWith("SenhaSegura123", "hash");
    expect(createSessionTokenMock).toHaveBeenCalledWith("local:8", expect.objectContaining({ name: "Marina Trade" }));
    expect((context.res.cookie as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(expect.any(String), "sessao-local-assinada", expect.objectContaining({ httpOnly: true, secure: true }));
  });

  it("não autentica uma conta inativa mesmo quando a senha está correta", async () => {
    getDbMock.mockResolvedValue(accountDatabase({ id: 9, openId: "local:9", name: "Conta inativa", email: "inativa@cluster.com", passwordHash: "hash", isActive: false }));
    verifyPasswordMock.mockResolvedValue(true);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.auth.local.login({ email: "inativa@cluster.com", password: "SenhaSegura123" })).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
    expect(createSessionTokenMock).not.toHaveBeenCalled();
  });
});
