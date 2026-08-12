import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { assertPermission } from "./authorization";

describe("controle de permissões", () => {
  it("permite que o administrador acesse permissões administrativas", async () => {
    await expect(assertPermission({ role: "admin" }, "settings.write")).resolves.toBeUndefined();
  });

  it("impede que o visualizador altere o estoque", async () => {
    await expect(assertPermission({ role: "viewer" }, "inventory.write")).rejects.toThrow(TRPCError);
  });

  it("permite que o operador registre movimentações de estoque", async () => {
    await expect(assertPermission({ role: "operator" }, "inventory.write")).resolves.toBeUndefined();
  });
});
