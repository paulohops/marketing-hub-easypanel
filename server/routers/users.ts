import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { cities, rolePermissions, userCities, userModuleSettings, userPermissions, userRegionals, userRoles, users, userTrelloBoards } from "../../drizzle/schema";
import { effectivePermissionKeys, permissionActions, permissionModules } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { storagePut } from "../storage";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";
import { hashLocalPassword, localPasswordInput, verifyLocalPassword } from "../auth/localPasswords";

export const profileInput = z.object({
  name: z.string().trim().min(2, "Informe seu nome.").max(160),
  phone: z.string().trim().min(8, "Informe um telefone válido.").max(32).regex(/^[0-9+()\s-]+$/, "Informe apenas números e símbolos de telefone.").optional().or(z.literal("")),
});
export const roleInput = z.enum(userRoles);
export const permissionInput = z.object({ role: roleInput, module: z.enum(permissionModules), action: z.enum(permissionActions), allowed: z.boolean() });
export const userPermissionInput = z.object({ userId: z.number().int().positive(), module: z.enum(permissionModules), action: z.enum(permissionActions), allowed: z.boolean() });
export const userModuleInput = z.object({ userId: z.number().int().positive(), module: z.enum(permissionModules), enabled: z.boolean() });
const avatarMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const adminUserFields = z.object({
  name: z.string().trim().min(2, "Informe o nome.").max(160),
  email: z.string().trim().email("Informe um e-mail válido.").max(320),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  managerUserId: z.number().int().positive().nullable().optional(),
  role: roleInput,
  regionalIds: z.array(z.number().int().positive()).max(100).optional(),
  cityIds: z.array(z.number().int().positive()).max(300).optional(),
});
const createLocalUserInput = adminUserFields.extend({ password: localPasswordInput });
const updateAdminUserInput = adminUserFields.extend({ userId: z.number().int().positive() });

export function allowedPermissionKeys(rows: Array<{ module: string; action: string; allowed: boolean }>) {
  return rows.filter(row => row.allowed).map(row => `${row.module}.${row.action}`);
}

function redactUser<T extends { passwordHash?: string | null }>(user: T) {
  const { passwordHash, ...safeUser } = user;
  return { ...safeUser, hasLocalPassword: Boolean(passwordHash) };
}

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

async function findUserOrFail(database: Awaited<ReturnType<typeof requireDatabase>>, userId: number) {
  const [user] = await database.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado." });
  return user;
}

async function resolveManager(database: Awaited<ReturnType<typeof requireDatabase>>, userId: number, managerUserId: number | null | undefined) {
  if (managerUserId === undefined) return undefined;
  if (managerUserId === null) return null;
  if (managerUserId === userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Uma pessoa não pode ser supervisora de si mesma." });
  const manager = await findUserOrFail(database, managerUserId);
  if (!manager.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma pessoa ativa para a supervisão da equipe." });
  return manager.id;
}

function normalizeTrelloBoardUrl(value: string) {
  let parsed: URL;
  try { parsed = new URL(value); } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "Informe uma URL válida do Trello." }); }
  if (!["trello.com", "www.trello.com"].includes(parsed.hostname)) throw new TRPCError({ code: "BAD_REQUEST", message: "O quadro deve usar uma URL do Trello." });
  return parsed.toString();
}

async function resolveTerritoryAssignments(database: Awaited<ReturnType<typeof requireDatabase>>, regionalIds: number[], cityIds: number[]) {
  const uniqueCityIds = Array.from(new Set(cityIds));
  const cityRows = uniqueCityIds.length
    ? await database.select({ id: cities.id, regionalId: cities.regionalId }).from(cities).where(inArray(cities.id, uniqueCityIds))
    : [];
  if (cityRows.length !== uniqueCityIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Uma ou mais cidades selecionadas não existem mais." });
  return { cityIds: uniqueCityIds, regionalIds: Array.from(new Set([...regionalIds, ...cityRows.map(city => city.regionalId)])) };
}

async function replaceUserRegionals(database: Awaited<ReturnType<typeof requireDatabase>>, userId: number, regionalIds: number[]) {
  const uniqueRegionalIds = Array.from(new Set(regionalIds));
  await database.transaction(async transaction => {
    await transaction.delete(userRegionals).where(eq(userRegionals.userId, userId));
    if (uniqueRegionalIds.length) await transaction.insert(userRegionals).values(uniqueRegionalIds.map(regionalId => ({ userId, regionalId })));
  });
  return uniqueRegionalIds;
}

async function replaceUserCities(database: Awaited<ReturnType<typeof requireDatabase>>, userId: number, cityIds: number[]) {
  const uniqueCityIds = Array.from(new Set(cityIds));
  await database.transaction(async transaction => {
    await transaction.delete(userCities).where(eq(userCities.userId, userId));
    if (uniqueCityIds.length) await transaction.insert(userCities).values(uniqueCityIds.map(cityId => ({ userId, cityId })));
  });
  return uniqueCityIds;
}

export const usersRouter = router({
  profile: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    name: ctx.user.name,
    email: ctx.user.email,
    phone: ctx.user.phone,
    avatarUrl: ctx.user.avatarUrl,
    jobTitle: ctx.user.jobTitle,
    managerUserId: ctx.user.managerUserId,
    role: ctx.user.role,
    loginMethod: ctx.user.loginMethod,
    hasLocalPassword: Boolean(ctx.user.passwordHash),
    lastSignedIn: ctx.user.lastSignedIn,
  })),

  updateProfile: protectedProcedure.input(profileInput).mutation(async ({ ctx, input }) => {
    const database = await requireDatabase();
    const before = await findUserOrFail(database, ctx.user.id);
    const [updated] = await database.update(users).set({ name: input.name, phone: input.phone || null, updatedAt: new Date() }).where(eq(users.id, ctx.user.id)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "user_profile", entityId: ctx.user.id, action: "update", beforeData: { name: before.name, phone: before.phone }, afterData: { name: updated.name, phone: updated.phone } });
    return redactUser(updated);
  }),

  uploadAvatar: protectedProcedure.input(z.object({ originalName: z.string().trim().min(1).max(255), mimeType: z.enum(avatarMimeTypes), dataBase64: z.string().min(1).max(4_000_000) })).mutation(async ({ ctx, input }) => {
    const bytes = Buffer.from(input.dataBase64, "base64");
    if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "A foto de perfil deve ter até 2 MB." });
    const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType === "image/png" ? "png" : "webp";
    const stored = await storagePut(`trade/profiles/${ctx.user.id}/avatar-${Date.now()}.${extension}`, bytes, input.mimeType);
    const database = await requireDatabase();
    const before = await findUserOrFail(database, ctx.user.id);
    const [updated] = await database.update(users).set({ avatarStorageKey: stored.key, avatarUrl: stored.url, updatedAt: new Date() }).where(eq(users.id, ctx.user.id)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "user_profile", entityId: ctx.user.id, action: "upload_avatar", beforeData: { avatarStorageKey: before.avatarStorageKey }, afterData: { avatarStorageKey: updated.avatarStorageKey } });
    return { avatarUrl: updated.avatarUrl };
  }),

  passwordPolicy: protectedProcedure.query(({ ctx }) => ({
    providerManaged: !ctx.user.passwordHash,
    canChangePasswordHere: Boolean(ctx.user.passwordHash),
    message: ctx.user.passwordHash
      ? "Sua conta possui senha local. Use a troca de senha com sua senha atual para manter o acesso protegido."
      : "A senha é gerenciada pelo provedor de acesso Manus OAuth. Para sua segurança, não armazenamos senhas locais nesta conta.",
  })),

  changeOwnLocalPassword: protectedProcedure.input(z.object({ currentPassword: z.string().min(1).max(128), newPassword: localPasswordInput })).mutation(async ({ ctx, input }) => {
    const database = await requireDatabase();
    const account = await findUserOrFail(database, ctx.user.id);
    if (!account.passwordHash) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta conta usa autenticação institucional e não possui senha local." });
    if (!await verifyLocalPassword(input.currentPassword, account.passwordHash)) throw new TRPCError({ code: "UNAUTHORIZED", message: "A senha atual está incorreta." });
    const passwordHash = await hashLocalPassword(input.newPassword);
    await database.update(users).set({ passwordHash, passwordUpdatedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, account.id));
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "user_access", entityId: account.id, action: "change_own_password", beforeData: null, afterData: { passwordUpdated: true } });
    return { success: true } as const;
  }),

  effectivePermissions: protectedProcedure.query(async ({ ctx }) => effectivePermissionKeys(ctx.user)),

  adminList: adminProcedure.query(async () => {
    const database = await requireDatabase();
    const rows = await database.select().from(users).orderBy(asc(users.name), asc(users.email));
    return rows.map(redactUser);
  }),

  adminDetail: adminProcedure.input(z.object({ userId: z.number().int().positive() })).query(async ({ input }) => {
    const database = await requireDatabase();
    const user = await findUserOrFail(database, input.userId);
    const [permissions, moduleSettings, regionalAssignments, cityAssignments, trelloAssignment] = await Promise.all([
      database.select().from(userPermissions).where(eq(userPermissions.userId, input.userId)),
      database.select().from(userModuleSettings).where(eq(userModuleSettings.userId, input.userId)),
      database.select().from(userRegionals).where(eq(userRegionals.userId, input.userId)),
      database.select().from(userCities).where(eq(userCities.userId, input.userId)),
      database.select().from(userTrelloBoards).where(eq(userTrelloBoards.userId, input.userId)).limit(1),
    ]);
    return { user: redactUser(user), permissions, moduleSettings, regionalIds: regionalAssignments.map(row => row.regionalId), cityIds: cityAssignments.map(row => row.cityId), trelloBoardUrl: trelloAssignment[0]?.boardUrl ?? null };
  }),

  adminPermissions: adminProcedure.query(async () => {
    const database = await requireDatabase();
    return database.select().from(rolePermissions).orderBy(asc(rolePermissions.role), asc(rolePermissions.module), asc(rolePermissions.action));
  }),

  adminModuleSettings: adminProcedure.query(async () => {
    const database = await requireDatabase();
    return database.select().from(userModuleSettings).orderBy(asc(userModuleSettings.userId), asc(userModuleSettings.module));
  }),

  createLocalUser: adminProcedure.input(createLocalUserInput).mutation(async ({ ctx, input }) => {
    const database = await requireDatabase();
    const email = input.email.toLowerCase();
    const [existing] = await database.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe uma conta com este e-mail." });
    const passwordHash = await hashLocalPassword(input.password);
    const now = new Date();
    const [created] = await database.insert(users).values({ openId: `local_${randomUUID()}`, name: input.name, email, phone: input.phone || null, jobTitle: input.jobTitle || null, role: input.role, loginMethod: "local", passwordHash, passwordUpdatedAt: now, isActive: true, lastSignedIn: now, updatedAt: now }).returning();
    const managerUserId = await resolveManager(database, created.id, input.managerUserId);
    if (managerUserId !== undefined) await database.update(users).set({ managerUserId, updatedAt: now }).where(eq(users.id, created.id));
    const territory = await resolveTerritoryAssignments(database, input.regionalIds ?? [], input.cityIds ?? []);
    const regionalIds = await replaceUserRegionals(database, created.id, territory.regionalIds);
    const cityIds = await replaceUserCities(database, created.id, territory.cityIds);
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "user_access", entityId: created.id, action: "create_local_user", afterData: { ...redactUser(created), regionalIds, cityIds } });
    return redactUser(created);
  }),

  updateAdminUser: adminProcedure.input(updateAdminUserInput).mutation(async ({ ctx, input }) => {
    const database = await requireDatabase();
    const before = await findUserOrFail(database, input.userId);
    if (input.userId === ctx.user.id && input.role !== before.role) throw new TRPCError({ code: "BAD_REQUEST", message: "Para preservar o acesso administrativo, não é permitido alterar seu próprio papel nesta tela." });
    const email = input.email.toLowerCase();
    const [sameEmail] = await database.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${email} AND ${users.id} <> ${input.userId}`).limit(1);
    if (sameEmail) throw new TRPCError({ code: "CONFLICT", message: "Já existe outra conta com este e-mail." });
    const managerUserId = await resolveManager(database, input.userId, input.managerUserId);
    const [updated] = await database.update(users).set({ name: input.name, email, phone: input.phone || null, jobTitle: input.jobTitle || null, role: input.role, ...(managerUserId === undefined ? {} : { managerUserId }), updatedAt: new Date() }).where(eq(users.id, input.userId)).returning();
    const existingRegionals = input.regionalIds === undefined ? await database.select().from(userRegionals).where(eq(userRegionals.userId, input.userId)) : [];
    const existingCities = input.cityIds === undefined ? await database.select().from(userCities).where(eq(userCities.userId, input.userId)) : [];
    const territory = await resolveTerritoryAssignments(database, input.regionalIds ?? existingRegionals.map(row => row.regionalId), input.cityIds ?? existingCities.map(row => row.cityId));
    const regionalIds = await replaceUserRegionals(database, input.userId, territory.regionalIds);
    const cityIds = await replaceUserCities(database, input.userId, territory.cityIds);
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "user_access", entityId: updated.id, action: "update_user", beforeData: redactUser(before), afterData: { ...redactUser(updated), regionalIds, cityIds } });
    return redactUser(updated);
  }),

  setTrelloBoard: adminProcedure.input(z.object({ userId: z.number().int().positive(), boardUrl: z.string().trim().url().max(2000).nullable() })).mutation(async ({ ctx, input }) => {
    const database = await requireDatabase();
    await findUserOrFail(database, input.userId);
    const existing = await database.select().from(userTrelloBoards).where(eq(userTrelloBoards.userId, input.userId)).limit(1);
    if (!input.boardUrl) {
      if (existing[0]) await database.delete(userTrelloBoards).where(eq(userTrelloBoards.userId, input.userId));
      await writeAuditLog({ actorUserId: ctx.user.id, entityType: "user_trello_board", entityId: input.userId, action: "remove", beforeData: existing[0] ?? null, afterData: null });
      return { boardUrl: null };
    }
    const boardUrl = normalizeTrelloBoardUrl(input.boardUrl);
    const [assignment] = await database.insert(userTrelloBoards).values({ userId: input.userId, boardUrl, assignedByUserId: ctx.user.id, updatedAt: new Date() }).onConflictDoUpdate({ target: userTrelloBoards.userId, set: { boardUrl, assignedByUserId: ctx.user.id, updatedAt: new Date() } }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "user_trello_board", entityId: input.userId, action: "assign", beforeData: existing[0] ?? null, afterData: assignment });
    return { boardUrl: assignment.boardUrl };
  }),

  setUserActive: adminProcedure.input(z.object({ userId: z.number().int().positive(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.user.id && !input.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Não é permitido inativar a própria conta." });
    const database = await requireDatabase();
    const before = await findUserOrFail(database, input.userId);
    const [updated] = await database.update(users).set({ isActive: input.isActive, updatedAt: new Date() }).where(eq(users.id, input.userId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "user_access", entityId: updated.id, action: input.isActive ? "activate_user" : "deactivate_user", beforeData: { isActive: before.isActive }, afterData: { isActive: updated.isActive } });
    return redactUser(updated);
  }),

  setUserManager: adminProcedure.input(z.object({ userId: z.number().int().positive(), managerUserId: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => {
    const database = await requireDatabase();
    const before = await findUserOrFail(database, input.userId);
    const managerUserId = await resolveManager(database, input.userId, input.managerUserId);
    const [updated] = await database.update(users).set({ managerUserId: managerUserId ?? null, updatedAt: new Date() }).where(eq(users.id, input.userId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "user_access", entityId: updated.id, action: "set_manager", beforeData: { managerUserId: before.managerUserId }, afterData: { managerUserId: updated.managerUserId } });
    return redactUser(updated);
  }),

  resetLocalPassword: adminProcedure.input(z.object({ userId: z.number().int().positive(), password: localPasswordInput })).mutation(async ({ ctx, input }) => {
    const database = await requireDatabase();
    const account = await findUserOrFail(database, input.userId);
    if (!account.passwordHash) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta conta usa autenticação institucional e não possui senha local para redefinir." });
    const passwordHash = await hashLocalPassword(input.password);
    await database.update(users).set({ passwordHash, passwordUpdatedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, account.id));
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "user_access", entityId: account.id, action: "reset_local_password", beforeData: null, afterData: { passwordReset: true } });
    return { success: true } as const;
  }),

  updateRole: adminProcedure.input(z.object({ userId: z.number().int().positive(), role: roleInput })).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Para preservar o acesso administrativo, não é permitido alterar sua própria função nesta tela." });
    const database = await requireDatabase();
    const before = await findUserOrFail(database, input.userId);
    const [updated] = await database.update(users).set({ role: input.role, updatedAt: new Date() }).where(eq(users.id, input.userId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "user_access", entityId: updated.id, action: "update_role", beforeData: { role: before.role }, afterData: { role: updated.role } });
    return redactUser(updated);
  }),

  updateRolePermission: adminProcedure.input(permissionInput).mutation(async ({ ctx, input }) => {
    const database = await requireDatabase();
    const entries = await database.select().from(rolePermissions).where(eq(rolePermissions.role, input.role));
    const before = entries.find(entry => entry.module === input.module && entry.action === input.action) ?? null;
    const [updated] = await database.insert(rolePermissions).values({ ...input, updatedAt: new Date() }).onConflictDoUpdate({ target: [rolePermissions.role, rolePermissions.module, rolePermissions.action], set: { allowed: input.allowed, updatedAt: new Date() } }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "role_permission", entityId: updated.id, action: "update_permission", beforeData: before, afterData: updated });
    return updated;
  }),

  updateUserPermission: adminProcedure.input(userPermissionInput).mutation(async ({ ctx, input }) => {
    const database = await requireDatabase();
    await findUserOrFail(database, input.userId);
    const [before] = await database.select().from(userPermissions).where(sql`${userPermissions.userId} = ${input.userId} AND ${userPermissions.module} = ${input.module} AND ${userPermissions.action} = ${input.action}`).limit(1);
    const [updated] = await database.insert(userPermissions).values({ ...input, updatedAt: new Date() }).onConflictDoUpdate({ target: [userPermissions.userId, userPermissions.module, userPermissions.action], set: { allowed: input.allowed, updatedAt: new Date() } }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "user_permission", entityId: updated.id, action: "update_user_permission", beforeData: before ?? null, afterData: updated });
    return updated;
  }),

  clearUserPermission: adminProcedure.input(z.object({ userId: z.number().int().positive(), module: z.enum(permissionModules), action: z.enum(permissionActions) })).mutation(async ({ ctx, input }) => {
    const database = await requireDatabase();
    const [before] = await database.select().from(userPermissions).where(sql`${userPermissions.userId} = ${input.userId} AND ${userPermissions.module} = ${input.module} AND ${userPermissions.action} = ${input.action}`).limit(1);
    if (!before) return { success: true } as const;
    await database.delete(userPermissions).where(eq(userPermissions.id, before.id));
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "user_permission", entityId: before.id, action: "clear_user_permission", beforeData: before, afterData: null });
    return { success: true } as const;
  }),

  setUserModuleEnabled: adminProcedure.input(userModuleInput).mutation(async ({ ctx, input }) => {
    if (input.userId === ctx.user.id && !input.enabled) throw new TRPCError({ code: "BAD_REQUEST", message: "Não é permitido ocultar um módulo da sua própria conta administrativa." });
    const database = await requireDatabase();
    await findUserOrFail(database, input.userId);
    const [before] = await database.select().from(userModuleSettings).where(sql`${userModuleSettings.userId} = ${input.userId} AND ${userModuleSettings.module} = ${input.module}`).limit(1);
    const [updated] = await database.insert(userModuleSettings).values({ ...input, updatedAt: new Date() }).onConflictDoUpdate({ target: [userModuleSettings.userId, userModuleSettings.module], set: { enabled: input.enabled, updatedAt: new Date() } }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "user_module_setting", entityId: updated.id, action: input.enabled ? "enable_module" : "disable_module", beforeData: before ?? null, afterData: updated });
    return updated;
  }),
});
