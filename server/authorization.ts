import { TRPCError } from "@trpc/server";
import type { User } from "../drizzle/schema";

export type TradeRole = "user" | "admin" | "regional_manager" | "operator" | "viewer";

export const rolePermissions: Record<TradeRole, readonly string[]> = {
  user: [
    "dashboard.read",
    "inventory.read",
    "finance.read",
    "media.read",
    "actions.read",
    "events.read",
  ],
  admin: ["*"],
  regional_manager: [
    "dashboard.read",
    "settings.read",
    "settings.write",
    "inventory.read",
    "inventory.write",
    "finance.read",
    "finance.write",
    "media.read",
    "media.write",
    "actions.read",
    "actions.write",
    "events.read",
    "events.write",
    "documents.write",
  ],
  operator: [
    "dashboard.read",
    "inventory.read",
    "inventory.write",
    "media.read",
    "media.write",
    "actions.read",
    "actions.write",
    "events.read",
    "events.write",
    "documents.write",
  ],
  viewer: [
    "dashboard.read",
    "inventory.read",
    "finance.read",
    "media.read",
    "actions.read",
    "events.read",
  ],
};

export function assertPermission(user: Pick<User, "role">, permission: string) {
  const permissions = rolePermissions[user.role as TradeRole] ?? [];
  if (!permissions.includes("*") && !permissions.includes(permission)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Você não possui permissão para esta operação." });
  }
}
