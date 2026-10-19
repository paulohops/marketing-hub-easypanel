import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const getDbMock = vi.hoisted(() => vi.fn());
const verifyPasswordMock = vi.hoisted(() => vi.fn());
const createSessionTokenMock = vi.hoisted(() => vi.fn());
const sendAuthCodeEmailMock = vi.hoisted(() => vi.fn());

vi.mock("../db", () => ({ getDb: getDbMock }));
vi.mock("../auth/localPasswords", async importOriginal => {
  const actual = await importOriginal<typeof import("../auth/localPasswords")>();
  return { ...actual, verifyLocalPassword: verifyPasswordMock };
});
vi.mock("../_core/sdk", () => ({ sdk: { createSessionToken: createSessionTokenMock } }));
vi.mock("../_core/notification", () => ({ sendAuthCodeEmail: sendAuthCodeEmailMock }));
vi.mock("../_core/cookies", () => ({ getSessionCookieOptions: () => ({ httpOnly: true, sameSite: "lax", secure: true }) }));

import { appRouter } from "../routers";
import { __localAuthInternals, verificationAttempts } from "./localAuth";

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { cookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function accountDatabase(account: Record<string, unknown>) {
  const setFn = vi.fn(() => ({ where: vi.fn() }));
  return {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => [account]) })) })) })),
    update: vi.fn(() => ({ set: setFn })),
    _setFn: setFn,
  };
}

describe("localAuthRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verificationAttempts.clear();
  });

  it("cria uma sessão protegida após validar as credenciais locais", async () => {
    const context = createContext();
    getDbMock.mockResolvedValue(accountDatabase({ id: 8, openId: "local:8", name: "Marina Trade", email: "marina@cluster.com", passwordHash: "hash", isActive: true }));
    verifyPasswordMock.mockResolvedValue(true);
    createSessionTokenMock.mockResolvedValue("sessao-local-assinada");
    sendAuthCodeEmailMock.mockResolvedValue(true);
    const caller = appRouter.createCaller(context);

    await expect(caller.auth.local.login({ email: "MARINA@CLUSTER.COM", password: "SenhaSegura123" })).resolves.toEqual({ success: true, requiresCode: false });
    expect(verifyPasswordMock).toHaveBeenCalledWith("SenhaSegura123", "hash");
    await expect(caller.auth.local.verifyLoginCode({ email: "MARINA@CLUSTER.COM", code: "000000" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("não autentica uma conta inativa mesmo quando a senha está correta", async () => {
    getDbMock.mockResolvedValue(accountDatabase({ id: 9, openId: "local:9", name: "Conta inativa", email: "inativa@cluster.com", passwordHash: "hash", isActive: false }));
    verifyPasswordMock.mockResolvedValue(true);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.auth.local.login({ email: "inativa@cluster.com", password: "SenhaSegura123" })).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
    expect(createSessionTokenMock).not.toHaveBeenCalled();
  });

  it("bloqueia o usuário após 5 tentativas incorretas de código e descarta o código temporário", async () => {
    const dbMock = accountDatabase({
      id: 10,
      openId: "local:10",
      name: "Lockout Test",
      email: "bloqueio@cluster.com",
      isActive: true,
      authCodePurpose: "login",
      authCodeExpiresAt: new Date(Date.now() + 600000),
      authCodeHash: __localAuthInternals.hashCode("123456"),
    });
    getDbMock.mockResolvedValue(dbMock);
    const caller = appRouter.createCaller(createContext());

    // 4 tentativas incorretas -> UNAUTHORIZED com contagem decrescente
    for (let i = 1; i <= 4; i++) {
      await expect(caller.auth.local.verifyLoginCode({ email: "bloqueio@cluster.com", code: "999999" })).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        message: expect.stringContaining(`Restam ${5 - i} tentativa(s)`),
      });
    }

    // 5ª tentativa incorreta -> TOO_MANY_REQUESTS, descarte do código e bloqueio por 15 minutos
    await expect(caller.auth.local.verifyLoginCode({ email: "bloqueio@cluster.com", code: "999999" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });

    // O código temporário no banco foi descartado
    expect(dbMock._setFn).toHaveBeenCalledWith(expect.objectContaining({
      authCodeHash: null,
      authCodePurpose: null,
      authCodeExpiresAt: null,
    }));

    // Tentativa subsequente é bloqueada com TOO_MANY_REQUESTS
    await expect(caller.auth.local.verifyLoginCode({ email: "bloqueio@cluster.com", code: "123456" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("limpa as tentativas após validação correta do código", async () => {
    const validCode = "654321";
    const dbMock = accountDatabase({
      id: 11,
      openId: "local:11",
      name: "Success Test",
      email: "sucesso@cluster.com",
      isActive: true,
      authCodePurpose: "login",
      authCodeExpiresAt: new Date(Date.now() + 600000),
      authCodeHash: __localAuthInternals.hashCode(validCode),
    });
    getDbMock.mockResolvedValue(dbMock);
    createSessionTokenMock.mockResolvedValue("sessao-token");
    const caller = appRouter.createCaller(createContext());

    // Falha uma vez
    await expect(caller.auth.local.verifyLoginCode({ email: "sucesso@cluster.com", code: "000000" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(verificationAttempts.get("sucesso@cluster.com")?.count).toBe(1);

    // Sucesso
    await expect(caller.auth.local.verifyLoginCode({ email: "sucesso@cluster.com", code: validCode })).resolves.toMatchObject({
      success: true,
    });
    expect(verificationAttempts.has("sucesso@cluster.com")).toBe(false);
  });
});
