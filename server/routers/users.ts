import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { rolePermissions, userRoles, users } from "../../drizzle/schema";
import { permissionActions, permissionModules } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

export const profileInput = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(160),
  phone: z.string().trim().min(8, "Informe um telefone válido.").max(32).regex(/^[0-9+()\s-]+$/, "Informe apenas números e símbolos de telefone.").optional().or(z.literal("")),
});
export const roleInput = z.enum(userRoles);
export const permissionInput = z.object({ role: roleInput, module: z.enum(permissionModules), action: z.enum(permissionActions), allowed: z.boolean() });

export function allowedPermissionKeys(rows: Array<{ module: string; action: string; allowed: boolean }>) {
  return rows.filter(row => row.allowed).map(row => `${row.module}.${row.action}`);
}

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

export const usersRouter = router({
  profile: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    name: ctx.user.name,
    email: ctx.user.email,
    phone: ctx.user.phone,
    role: ctx.user.role,
    loginMethod: ctx.user.loginMethod,
    lastSignedIn: ctx.user.lastSignedIn,
  })),

  updateProfile: protectedProcedure.input(profileInput).mutation(async ({ ctx, input }) => {
    const database = await requireDatabase();
    const [before] = await database.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
    const [updated] = await database.update(users).set({ name: input.name, phone: input.phone || null, updatedAt: new Date() }).where(eq(users.id, ctx.user.id)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "user_profile", entityId: ctx.user.id, action: "update", beforeData: { name: before.name, phone: before.phone }, afterData: { name: updated.name, phone: updated.phone } });
    return updated;
  }),

  passwordPolicy: protectedProcedure.query(() => ({
    providerManaged: true,
    canChangePasswordHere: false,
    message: "A senha é gerenciada pelo provedor de acesso Manus OAuth. Para sua segurança, não armazenamos senhas locais no Trade HUB.",
  })),

  effectivePermissions: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin") return permissionModules.flatMap(module => permissionActions.map(action => `${module}.${action}`));
    const database = await requireDatabase();
    const rows = await database.select({ module: rolePermissions.module, action: rolePermissions.action, allowed: rolePermissions.allowed }).from(rolePermissions).where(eq(rolePermissions.role, ctx.user.role));
    return allowedPermissionKeys(rows);
  }),

  adminList: adminProcedure.query(async () => {
    const database = await requireDatabase();
    return database.select({ id: users.id, name: users.name, email: users.email, phone: users.phone, role: users.role, loginMethod: users.loginMethod, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).orderBy(asc(users.name), asc(users.email));
  }),

  adminPermissions: adminProcedure.query(async () => {
    const database = await requireDatabase();
    return database.select().from(rolePermissions).orderBy(asc(rolePermissions.role), asc(rolePermissions.module), asc(rolePermissions.action));
  }),

  updateRole: adminProcedure.input(z.object({ userId: z.number().int().positive(), role: roleInput })).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Para preservar o acesso administrativo, não é permitido alterar sua própria função nesta tela." });
    const database = await requireDatabase();
    const [before] = await database.select().from(users).where(eq(users.id, input.userId)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
    const [updated] = await database.update(users).set({ role: input.role, updatedAt: new Date() }).where(eq(users.id, input.userId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "user_access", entityId: updated.id, action: "update_role", beforeData: { role: before.role }, afterData: { role: updated.role } });
    return updated;
  }),

  updateRolePermission: adminProcedure.input(permissionInput).mutation(async ({ ctx, input }) => {
    const database = await requireDatabase();
    const entries = await database.select().from(rolePermissions).where(eq(rolePermissions.role, input.role));
    const before = entries.find(entry => entry.module === input.module && entry.action === input.action) ?? null;
    const [updated] = await database.insert(rolePermissions).values({ ...input, updatedAt: new Date() }).onConflictDoUpdate({ target: [rolePermissions.role, rolePermissions.module, rolePermissions.action], set: { allowed: input.allowed, updatedAt: new Date() } }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "role_permission", entityId: updated.id, action: "update_permission", beforeData: before, afterData: updated });
    return updated;
  }),
});
