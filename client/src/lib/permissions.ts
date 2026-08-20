export type TradeRole = "user" | "admin" | "regional_manager" | "operator" | "viewer";

const permissions: Record<TradeRole, readonly string[]> = {
  admin: ["*"],
  regional_manager: ["dashboard.read", "inventory.read", "finance.read", "media.read", "actions.read", "events.read", "operations.read", "operations.create", "operations.update", "settings.read", "requests.read", "requests.create", "requests.update"],
  operator: ["dashboard.read", "inventory.read", "media.read", "actions.read", "events.read", "operations.read", "operations.create", "operations.update", "requests.read", "requests.create", "requests.update"],
  viewer: ["dashboard.read", "inventory.read", "finance.read", "media.read", "actions.read", "events.read", "operations.read", "requests.read"],
  user: ["dashboard.read", "inventory.read", "finance.read", "media.read", "actions.read", "events.read", "operations.read", "requests.read", "requests.create"],
};

export function hasModulePermission(role: string | null | undefined, permission: string) {
  const assigned = permissions[role as TradeRole] ?? [];
  return assigned.includes("*") || assigned.includes(permission);
}
