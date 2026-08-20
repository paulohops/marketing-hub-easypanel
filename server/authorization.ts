import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import type { User } from "../drizzle/schema";
import { rolePermissions as rolePermissionRows, userModuleSettings as userModuleSettingRows, userPermissions as userPermissionRows } from "../drizzle/schema";
import { getDb } from "./db";

export type TradeRole = "user" | "team_member" | "admin" | "regional_manager" | "operator" | "viewer";
export type PermissionModule = "dashboard" | "settings" | "inventory" | "finance" | "media" | "actions" | "events" | "operations" | "documents" | "map" | "notifications" | "tasks" | "requests";
export type PermissionAction = "read" | "create" | "update" | "delete";

export const permissionModules: PermissionModule[] = ["dashboard", "settings", "inventory", "finance", "media", "actions", "events", "operations", "documents", "map", "notifications", "tasks", "requests"];
export const permissionActions: PermissionAction[] = ["read", "create", "update", "delete"];

const legacyRolePermissions: Record<TradeRole, readonly string[]> = {
  user: ["dashboard.read", "inventory.read", "finance.read", "media.read", "actions.read", "events.read", "tasks.read", "requests.read", "requests.create"],
  team_member: ["dashboard.read", "inventory.read", "media.read", "actions.read", "events.read", "notifications.read", "tasks.read", "tasks.create", "tasks.update", "requests.read", "requests.create", "requests.update"],
  admin: ["*"],
  regional_manager: ["dashboard.read", "settings.read", "settings.write", "inventory.read", "inventory.write", "finance.read", "finance.write", "media.read", "media.write", "actions.read", "actions.write", "events.read", "events.write", "operations.read", "operations.create", "operations.update", "documents.write", "tasks.read", "tasks.create", "tasks.update", "requests.read", "requests.create", "requests.update"],
  operator: ["dashboard.read", "inventory.read", "inventory.write", "media.read", "media.write", "actions.read", "actions.write", "events.read", "events.write", "operations.read", "operations.create", "operations.update", "documents.write", "tasks.read", "tasks.create", "tasks.update", "requests.read", "requests.create", "requests.update"],
  viewer: ["dashboard.read", "inventory.read", "finance.read", "media.read", "actions.read", "events.read", "operations.read", "tasks.read", "requests.read"],
};

function splitPermission(permission: string) {
  const [module, action] = permission.split(".");
  if (!permissionModules.includes(module as PermissionModule)) throw new TRPCError({ code: "BAD_REQUEST", message: "Permissão inválida." });
  if (!permissionActions.includes(action as PermissionAction) && action !== "write") throw new TRPCError({ code: "BAD_REQUEST", message: "Ação de permissão inválida." });
  return { module: module as PermissionModule, action: action as PermissionAction | "write" };
}

function hasLegacyPermission(role: TradeRole, permission: string) {
  const assigned = legacyRolePermissions[role] ?? [];
  const [module, action] = permission.split(".");
  return assigned.includes("*") || assigned.includes(permission) || (["create", "update", "delete"].includes(action) && assigned.includes(`${module}.write`));
}

export async function effectivePermissionKeys(user: Pick<User, "id" | "role" | "isActive">) {
  if (user.isActive === false) return [];
  if (!user.id) {
    return permissionModules.flatMap(module => permissionActions.flatMap(action => hasLegacyPermission(user.role as TradeRole, `${module}.${action}`) ? [`${module}.${action}`] : []));
  }
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  const [roleEntries, userEntries, moduleSettings] = await Promise.all([
    user.role === "admin"
      ? Promise.resolve(permissionModules.flatMap(module => permissionActions.map(action => ({ module, action, allowed: true }))))
      : database.select({ module: rolePermissionRows.module, action: rolePermissionRows.action, allowed: rolePermissionRows.allowed }).from(rolePermissionRows).where(eq(rolePermissionRows.role, user.role)),
    database.select({ module: userPermissionRows.module, action: userPermissionRows.action, allowed: userPermissionRows.allowed }).from(userPermissionRows).where(eq(userPermissionRows.userId, user.id)),
    database.select({ module: userModuleSettingRows.module, enabled: userModuleSettingRows.enabled }).from(userModuleSettingRows).where(eq(userModuleSettingRows.userId, user.id)),
  ]);
  return permissionModules.flatMap(module => permissionActions.flatMap(action => {
    const isModuleEnabled = moduleSettings.find(entry => entry.module === module)?.enabled ?? true;
    if (!isModuleEnabled) return [];
    const override = userEntries.find(entry => entry.module === module && entry.action === action);
    const rolePermission = roleEntries.find(entry => entry.module === module && entry.action === action);
    const inherited = rolePermission?.allowed ?? hasLegacyPermission(user.role as TradeRole, `${module}.${action}`);
    return (override?.allowed ?? inherited) ? [`${module}.${action}`] : [];
  }));
}

export async function assertPermission(user: Pick<User, "id" | "role" | "isActive">, permission: string) {
  const { module, action } = splitPermission(permission);
  const effective = await effectivePermissionKeys(user);
  const allowed = action === "write"
    ? ["create", "update", "delete"].some(writeAction => effective.includes(`${module}.${writeAction}`))
    : effective.includes(`${module}.${action}`);
  if (!allowed) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você não possui permissão para esta operação." });
  }
}

export async function canPermission(user: Pick<User, "id" | "role" | "isActive">, permission: string) {
  try {
    await assertPermission(user, permission);
    return true;
  } catch {
    return false;
  }
}
