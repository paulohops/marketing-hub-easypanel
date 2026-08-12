import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import { assertPermission } from "./authorization";

describe("controle de permissões", () => {
  it("permite que o administrador acesse permissões administrativas", () => {
    expect(() => assertPermission({ role: "admin" }, "settings.write")).not.toThrow();
  });

  it("impede que o visualizador altere o estoque", () => {
    expect(() => assertPermission({ role: "viewer" }, "inventory.write")).toThrow(TRPCError);
  });

  it("permite que o operador registre movimentações de estoque", () => {
    expect(() => assertPermission({ role: "operator" }, "inventory.write")).not.toThrow();
  });
});
