import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { notifications, userRegionals } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";

async function requireDatabase() { const database = await getDb(); if (!database) throw new Error("Banco de dados indisponível."); return database; }

export const notificationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "dashboard.read"); const database = await requireDatabase();
    if (ctx.user.role === "admin") return database.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(20);
    const assignments = await database.select({ regionalId: userRegionals.regionalId }).from(userRegionals).where(eq(userRegionals.userId, ctx.user.id));
    const regionalIds = assignments.map(item => item.regionalId);
    const scope = regionalIds.length ? or(eq(notifications.userId, ctx.user.id), isNull(notifications.userId), inArray(notifications.regionalId, regionalIds)) : or(eq(notifications.userId, ctx.user.id), and(isNull(notifications.userId), isNull(notifications.regionalId)));
    return database.select().from(notifications).where(scope).orderBy(desc(notifications.createdAt)).limit(20);
  }),
  markRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "dashboard.read"); const database = await requireDatabase();
    const [notification] = await database.select().from(notifications).where(eq(notifications.id, input.notificationId)).limit(1);
    if (!notification) throw new Error("Notificação não encontrada.");
    if (ctx.user.role !== "admin" && notification.userId && notification.userId !== ctx.user.id) throw new Error("Sem acesso à notificação.");
    const [updated] = await database.update(notifications).set({ readAt: new Date() }).where(eq(notifications.id, input.notificationId)).returning(); return updated;
  }),
});
