import { describe, expect, it } from "vitest";
import { allowedPermissionKeys, permissionInput, profileInput } from "./users";

describe("regras de perfil e administração de usuários", () => {
  it("aceita perfil próprio com nome e telefone válidos e rejeita telefone inválido", () => {
    expect(profileInput.parse({ name: "Paulo Oliveira", phone: "+55 (31) 99999-0000" })).toMatchObject({ name: "Paulo Oliveira" });
    expect(profileInput.safeParse({ name: "P", phone: "telefone" }).success).toBe(false);
  });

  it("aceita somente módulos e ações administráveis previstos na matriz de permissão", () => {
    expect(permissionInput.parse({ role: "viewer", module: "inventory", action: "read", allowed: true })).toMatchObject({ role: "viewer", module: "inventory", action: "read", allowed: true });
    expect(permissionInput.safeParse({ role: "viewer", module: "inexistente", action: "delete", allowed: true }).success).toBe(false);
  });

  it("expõe somente permissões explicitamente autorizadas para a navegação e as rotas", () => {
    expect(allowedPermissionKeys([{ module: "inventory", action: "read", allowed: true }, { module: "inventory", action: "write", allowed: false }])).toEqual(["inventory.read"]);
  });
});
