export type TradeRole = "user" | "admin" | "regional_manager" | "operator" | "viewer";

const permissions: Record<TradeRole, readonly string[]> = {
  admin: ["*"],
  regional_manager: ["dashboard.read", "inventory.read", "finance.read", "media.read", "actions.read", "events.read", "operations.read", "operations.create", "operations.update", "settings.read"],
  operator: ["dashboard.read", "inventory.read", "media.read", "actions.read", "events.read", "operations.read", "operations.create", "operations.update"],
  viewer: ["dashboard.read", "inventory.read", "finance.read", "media.read", "actions.read", "events.read", "operations.read"],
  user: ["dashboard.read", "inventory.read", "finance.read", "media.read", "actions.read", "events.read", "operations.read"],
};

export function hasModulePermission(role: string | null | undefined, permission: string) {
  const assigned = permissions[role as TradeRole] ?? [];
  return assigned.includes("*") || assigned.includes(permission);
}
