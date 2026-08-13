import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { cities, notifications, regionals, userCities, userRegionals, users } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

async function requireDatabase() { const database = await getDb(); if (!database) throw new Error("Banco de dados indisponível."); return database; }

const notificationCategories = ["campaign_expiry", "payment_due", "action_pending", "stock_minimum"] as const;
const listInput = z.object({
  userId: z.number().int().positive().optional(),
  regionalId: z.number().int().positive().optional(),
  cityId: z.number().int().positive().optional(),
  category: z.enum(notificationCategories).optional(),
  unreadOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
}).optional();

const notificationSelect = {
  id: notifications.id,
  userId: notifications.userId,
  regionalId: notifications.regionalId,
  cityId: notifications.cityId,
  category: notifications.category,
  title: notifications.title,
  message: notifications.message,
  entityType: notifications.entityType,
  entityId: notifications.entityId,
  readAt: notifications.readAt,
  createdAt: notifications.createdAt,
  userName: users.name,
  userEmail: users.email,
  regionalName: regionals.name,
  cityName: cities.name,
  cityState: cities.state,
};

async function notificationScope(database: Awaited<ReturnType<typeof requireDatabase>>, userId: number) {
  const [regionalAssignments, cityAssignments] = await Promise.all([
    database.select({ regionalId: userRegionals.regionalId }).from(userRegionals).where(eq(userRegionals.userId, userId)),
    database.select({ cityId: userCities.cityId }).from(userCities).where(eq(userCities.userId, userId)),
  ]);
  return { regionalIds: regionalAssignments.map(item => item.regionalId), cityIds: cityAssignments.map(item => item.cityId) };
}

function notificationScopeCondition(userId: number, regionalIds: number[], cityIds: number[]) {
  const territorialClauses = [eq(notifications.userId, userId), and(isNull(notifications.userId), isNull(notifications.regionalId), isNull(notifications.cityId))];
  if (regionalIds.length) territorialClauses.push(inArray(notifications.regionalId, regionalIds));
  if (cityIds.length) territorialClauses.push(inArray(notifications.cityId, cityIds));
  return or(...territorialClauses);
}

export const notificationsRouter = router({
  list: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "dashboard.read"); const database = await requireDatabase();
    const conditions = [];
    if (ctx.user.role === "admin") {
      if (input?.userId) conditions.push(eq(notifications.userId, input.userId));
      if (input?.regionalId) conditions.push(eq(notifications.regionalId, input.regionalId));
      if (input?.cityId) conditions.push(eq(notifications.cityId, input.cityId));
    } else {
      const { regionalIds, cityIds } = await notificationScope(database, ctx.user.id);
      conditions.push(notificationScopeCondition(ctx.user.id, regionalIds, cityIds));
    }
    if (input?.category) conditions.push(eq(notifications.category, input.category));
    if (input?.unreadOnly) conditions.push(isNull(notifications.readAt));
    return database.select(notificationSelect).from(notifications)
      .leftJoin(users, eq(notifications.userId, users.id))
      .leftJoin(regionals, eq(notifications.regionalId, regionals.id))
      .leftJoin(cities, eq(notifications.cityId, cities.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(notifications.createdAt)).limit(input?.limit ?? 100);
  }),
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "dashboard.read"); const database = await requireDatabase();
    if (ctx.user.role !== "admin") return { users: [], regionals: [], cities: [], categories: notificationCategories };
    const [userRows, regionalRows, cityRows] = await Promise.all([
      database.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.isActive, true)).orderBy(users.name),
      database.select({ id: regionals.id, name: regionals.name }).from(regionals).where(eq(regionals.active, true)).orderBy(regionals.name),
      database.select({ id: cities.id, regionalId: cities.regionalId, name: cities.name, state: cities.state }).from(cities).where(eq(cities.active, true)).orderBy(cities.name),
    ]);
    return { users: userRows, regionals: regionalRows, cities: cityRows, categories: notificationCategories };
  }),
  markRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "dashboard.read"); const database = await requireDatabase();
    const [notification] = await database.select().from(notifications).where(eq(notifications.id, input.notificationId)).limit(1);
    if (!notification) throw new Error("Notificação não encontrada.");
    if (ctx.user.role !== "admin") {
      const { regionalIds, cityIds } = await notificationScope(database, ctx.user.id);
      const isGlobal = !notification.userId && !notification.regionalId && !notification.cityId;
      const isAssignedRegional = notification.regionalId !== null && regionalIds.includes(notification.regionalId);
      const isAssignedCity = notification.cityId !== null && cityIds.includes(notification.cityId);
      if (notification.userId !== ctx.user.id && !isGlobal && !isAssignedRegional && !isAssignedCity) throw new Error("Sem acesso à notificação.");
    }
    const [updated] = await database.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, input.notificationId)).returning(); return updated;
  }),
});
