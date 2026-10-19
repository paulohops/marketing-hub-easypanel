import { describe, expect, it, vi, beforeEach } from "vitest";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";

const authenticateRequestMock = vi.hoisted(() => vi.fn());

vi.mock("./sdk", () => ({
  sdk: {
    authenticateRequest: authenticateRequestMock,
  },
}));

import { createContext } from "./context";

function makeOptions(): CreateExpressContextOptions {
  return {
    req: { headers: {}, protocol: "https" } as any,
    res: { cookie: vi.fn() } as any,
  };
}

describe("context resolution & SEC-04 session invalidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna o usuário autenticado quando não há passwordUpdatedAt", async () => {
    const fakeUser = {
      id: 1,
      openId: "user-1",
      name: "Teste",
      passwordUpdatedAt: null,
      tokenPayload: { iat: Math.floor(Date.now() / 1000) },
    };
    authenticateRequestMock.mockResolvedValue(fakeUser);

    const ctx = await createContext(makeOptions());
    expect(ctx.user).toEqual(fakeUser);
  });

  it("retorna o usuário autenticado quando o token foi emitido após a alteração de senha", async () => {
    const passwordUpdatedTime = 1700000000000;
    const tokenIatSeconds = 1700001000; // token posterior à alteração de senha

    const fakeUser = {
      id: 2,
      openId: "user-2",
      name: "Teste 2",
      passwordUpdatedAt: new Date(passwordUpdatedTime),
      tokenPayload: { iat: tokenIatSeconds },
    };
    authenticateRequestMock.mockResolvedValue(fakeUser);

    const ctx = await createContext(makeOptions());
    expect(ctx.user).toEqual(fakeUser);
  });

  it("invalida a sessão (user = null) se a senha foi alterada após a emissão do token (SEC-04)", async () => {
    const tokenIatSeconds = 1700000000; // token emitido às 1700000000000 ms
    const passwordUpdatedTime = 1700005000000; // senha alterada depois!

    const fakeUser = {
      id: 3,
      openId: "user-3",
      name: "Teste 3",
      passwordUpdatedAt: new Date(passwordUpdatedTime),
      tokenPayload: { iat: tokenIatSeconds },
    };
    authenticateRequestMock.mockResolvedValue(fakeUser);

    const ctx = await createContext(makeOptions());
    expect(ctx.user).toBeNull();
  });

  it("retorna user null quando sdk.authenticateRequest lança erro", async () => {
    authenticateRequestMock.mockRejectedValue(new Error("Token inválido"));

    const ctx = await createContext(makeOptions());
    expect(ctx.user).toBeNull();
  });
});
