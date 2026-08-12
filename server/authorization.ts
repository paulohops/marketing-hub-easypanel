import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import type { User } from "../drizzle/schema";
import { rolePermissions as rolePermissionRows } from "../drizzle/schema";
import { getDb } from "./db";

export type TradeRole = "user" | "admin" | "regional_manager" | "operator" | "viewer";
export type PermissionModule = "dashboard" | "settings" | "inventory" | "finance" | "media" | "actions" | "events" | "documents" | "map" | "notifications";
export type PermissionAction = "read" | "create" | "update" | "delete";

export const permissionModules: PermissionModule[] = ["dashboard", "settings", "inventory", "finance", "media", "actions", "events", "documents", "map", "notifications"];
export const permissionActions: PermissionAction[] = ["read", "create", "update", "delete"];

const legacyRolePermissions: Record<TradeRole, readonly string[]> = {
  user: ["dashboard.read", "inventory.read", "finance.read", "media.read", "actions.read", "events.read"],
  admin: ["*"],
  regional_manager: ["dashboard.read", "settings.read", "settings.write", "inventory.read", "inventory.write", "finance.read", "finance.write", "media.read", "media.write", "actions.read", "actions.write", "events.read", "events.write", "documents.write"],
  operator: ["dashboard.read", "inventory.read", "inventory.write", "media.read", "media.write", "actions.read", "actions.write", "events.read", "events.write", "documents.write"],
  viewer: ["dashboard.read", "inventory.read", "finance.read", "media.read", "actions.read", "events.read"],
};

function splitPermission(permission: string) {
  const [module, action] = permission.split(".");
  if (!permissionModules.includes(module as PermissionModule)) throw new TRPCError({ code: "BAD_REQUEST", message: "Permissão inválida." });
  if (!permissionActions.includes(action as PermissionAction) && action !== "write") throw new TRPCError({ code: "BAD_REQUEST", message: "Ação de permissão inválida." });
  return { module: module as PermissionModule, action: action as PermissionAction | "write" };
}

function hasLegacyPermission(role: TradeRole, permission: string) {
  const assigned = legacyRolePermissions[role] ?? [];
  return assigned.includes("*") || assigned.includes(permission);
}

export async function assertPermission(user: Pick<User, "role">, permission: string) {
  if (user.role === "admin") return;
  const { module, action } = splitPermission(permission);
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });

  const entries = await database.select({ action: rolePermissionRows.action, allowed: rolePermissionRows.allowed })
    .from(rolePermissionRows)
    .where(and(eq(rolePermissionRows.role, user.role), eq(rolePermissionRows.module, module)));

  const allowed = action === "write"
    ? entries.some(entry => entry.allowed && ["create", "update", "delete"].includes(entry.action))
    : entries.some(entry => entry.action === action && entry.allowed);

  if (!allowed && !(entries.length === 0 && hasLegacyPermission(user.role as TradeRole, permission))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você não possui permissão para esta operação." });
  }
}

export async function canPermission(user: Pick<User, "role">, permission: string) {
  try {
    await assertPermission(user, permission);
    return true;
  } catch {
    return false;
  }
}
