import { describe, expect, it } from "vitest";
import { isEffectivePermissionAllowed } from "./useEffectivePermissions";

describe("permissões efetivas do usuário", () => {
  it("reconhece a escrita quando há uma ação granular concedida", () => {
    expect(isEffectivePermissionAllowed(["actions.read", "actions.create"], "actions.write")).toBe(true);
  });

  it("mantém bloqueada uma permissão removida individualmente", () => {
    expect(isEffectivePermissionAllowed(["finance.read"], "finance.write")).toBe(false);
    expect(isEffectivePermissionAllowed(["dashboard.read"], "settings.read")).toBe(false);
  });
});
