import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { notifications, taskHistory, tasks, users } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const taskStatuses = ["backlog", "todo", "in_progress", "blocked", "done", "cancelled"] as const;
const taskPriorities = ["low", "normal", "high", "urgent"] as const;
const taskSources = ["manual", "notification", "context"] as const;

const taskInput = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(10000).optional().nullable(),
  status: z.enum(taskStatuses).default("todo"),
  priority: z.enum(taskPriorities).default("normal"),
  assignedToUserId: z.number().int().positive().optional().nullable(),
  dueDate: z.string().date().optional().nullable(),
  entityType: z.string().trim().max(64).optional().nullable(),
  entityId: z.number().int().positive().optional().nullable(),
  source: z.enum(taskSources).default("manual"),
});

async function databaseOrThrow() {
  const database = await getDb();
  if (!database) throw new Error("Banco de dados indisponível.");
  return database;
}

async function assertAssignee(database: Awaited<ReturnType<typeof databaseOrThrow>>, userId: number | null | undefined) {
  if (!userId) return;
  const [user] = await database.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.isActive, true))).limit(1);
  if (!user) throw new Error("Responsável não encontrado ou inativo.");
}

const selectTask = {
  id: tasks.id,
  title: tasks.title,
  description: tasks.description,
  status: tasks.status,
  priority: tasks.priority,
  source: tasks.source,
  assignedToUserId: tasks.assignedToUserId,
  createdByUserId: tasks.createdByUserId,
  sourceNotificationId: tasks.sourceNotificationId,
  entityType: tasks.entityType,
  entityId: tasks.entityId,
  dueDate: tasks.dueDate,
  position: tasks.position,
  completedAt: tasks.completedAt,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  assignedToName: users.name,
};

export const tasksRouter = router({
  list: protectedProcedure.input(z.object({ scope: z.enum(["mine", "team"]).default("team"), status: z.enum(taskStatuses).optional(), assignedToUserId: z.number().int().positive().optional().nullable() }).optional()).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "tasks.read");
    const database = await databaseOrThrow();
    const conditions = [];
    if (input?.scope === "mine") {
      conditions.push(eq(tasks.assignedToUserId, ctx.user.id));
    } else if (ctx.user.role !== "admin") {
      conditions.push(or(eq(tasks.assignedToUserId, ctx.user.id), eq(tasks.createdByUserId, ctx.user.id)));
    }
    if (input?.status) conditions.push(eq(tasks.status, input.status));
    if (input?.scope !== "mine" && input?.assignedToUserId) conditions.push(eq(tasks.assignedToUserId, input.assignedToUserId));
    return database.select(selectTask).from(tasks).leftJoin(users, eq(tasks.assignedToUserId, users.id)).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(tasks.createdAt));
  }),

  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "tasks.read");
    const database = await databaseOrThrow();
    const rows = await database.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.isActive, true)).orderBy(users.name);
    return { users: rows, statuses: taskStatuses, priorities: taskPriorities, sources: taskSources };
  }),

  create: protectedProcedure.input(taskInput).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "tasks.create");
    const database = await databaseOrThrow();
    await assertAssignee(database, input.assignedToUserId);
    return database.transaction(async tx => {
      const [created] = await tx.insert(tasks).values({
        title: input.title,
        description: input.description || null,
        status: input.status,
        priority: input.priority,
        source: input.source,
        assignedToUserId: input.assignedToUserId || null,
        createdByUserId: ctx.user.id,
        dueDate: input.dueDate || null,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
      }).returning();
      await tx.insert(taskHistory).values({ taskId: created.id, actorUserId: ctx.user.id, action: "created", toStatus: created.status, note: input.source === "context" ? "Tarefa contextual criada" : "Tarefa criada" });
      await writeAuditLog({ actorUserId: ctx.user.id, regionalId: null, entityType: "task", entityId: created.id, action: "create", afterData: created }, tx);
      return created;
    });
  }),

  createFromNotification: protectedProcedure.input(z.object({ notificationId: z.number().int().positive(), assignedToUserId: z.number().int().positive().optional().nullable() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "tasks.create");
    const database = await databaseOrThrow();
    await assertAssignee(database, input.assignedToUserId);
    const [notification] = await database.select().from(notifications).where(eq(notifications.id, input.notificationId)).limit(1);
    if (!notification) throw new Error("Notificação não encontrada.");
    const [existing] = await database.select({ id: tasks.id }).from(tasks).where(eq(tasks.sourceNotificationId, input.notificationId)).limit(1);
    if (existing) return existing;
    return database.transaction(async tx => {
      const [created] = await tx.insert(tasks).values({
        title: notification.title,
        description: notification.message,
        status: "todo",
        priority: "normal",
        source: "notification",
        assignedToUserId: input.assignedToUserId || notification.userId || ctx.user.id,
        createdByUserId: ctx.user.id,
        sourceNotificationId: notification.id,
        entityType: notification.entityType,
        entityId: notification.entityId,
      }).returning();
      await tx.insert(taskHistory).values({ taskId: created.id, actorUserId: ctx.user.id, action: "created_from_notification", toStatus: created.status, note: "Tarefa criada a partir de notificação" });
      await writeAuditLog({ actorUserId: ctx.user.id, entityType: "task", entityId: created.id, action: "create", afterData: created }, tx);
      return created;
    });
  }),

  update: protectedProcedure.input(z.object({ id: z.number().int().positive(), title: z.string().trim().min(1).max(180).optional(), description: z.string().trim().max(10000).optional().nullable(), status: z.enum(taskStatuses).optional(), priority: z.enum(taskPriorities).optional(), assignedToUserId: z.number().int().positive().optional().nullable(), dueDate: z.string().date().optional().nullable(), position: z.number().int().min(0).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "tasks.update");
    const database = await databaseOrThrow();
    await assertAssignee(database, input.assignedToUserId);
    const [current] = await database.select().from(tasks).where(eq(tasks.id, input.id)).limit(1);
    if (!current) throw new Error("Tarefa não encontrada.");
    if (ctx.user.role !== "admin" && current.assignedToUserId !== ctx.user.id && current.createdByUserId !== ctx.user.id) throw new Error("Sem acesso à tarefa.");
    const nextStatus = input.status ?? current.status;
    const completedAt = nextStatus === "done" ? current.completedAt ?? new Date() : null;
    const [updated] = await database.update(tasks).set({
      title: input.title ?? current.title,
      description: input.description === undefined ? current.description : input.description,
      status: nextStatus,
      priority: input.priority ?? current.priority,
      assignedToUserId: input.assignedToUserId === undefined ? current.assignedToUserId : input.assignedToUserId,
      dueDate: input.dueDate === undefined ? current.dueDate : input.dueDate,
      position: input.position ?? current.position,
      completedAt,
      updatedAt: new Date(),
    }).where(eq(tasks.id, input.id)).returning();
    if (current.status !== updated.status || current.assignedToUserId !== updated.assignedToUserId) {
      await database.insert(taskHistory).values({ taskId: updated.id, actorUserId: ctx.user.id, action: current.status !== updated.status ? "status_changed" : "assigned", fromStatus: current.status, toStatus: updated.status, note: current.assignedToUserId !== updated.assignedToUserId ? "Responsável atualizado" : null });
    }
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "task", entityId: updated.id, action: current.assignedToUserId !== updated.assignedToUserId ? "assigned" : current.status !== updated.status ? "status_changed" : "update", beforeData: current, afterData: updated });
    return updated;
  }),

  history: protectedProcedure.input(z.object({ taskId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "tasks.read");
    const database = await databaseOrThrow();
    return database.select({ id: taskHistory.id, taskId: taskHistory.taskId, action: taskHistory.action, fromStatus: taskHistory.fromStatus, toStatus: taskHistory.toStatus, note: taskHistory.note, createdAt: taskHistory.createdAt, actorUserId: taskHistory.actorUserId, actorName: users.name }).from(taskHistory).leftJoin(users, eq(taskHistory.actorUserId, users.id)).where(eq(taskHistory.taskId, input.taskId)).orderBy(desc(taskHistory.createdAt));
  }),

  delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "tasks.delete");
    const database = await databaseOrThrow();
    const [current] = await database.select().from(tasks).where(eq(tasks.id, input.id)).limit(1);
    if (!current) throw new Error("Tarefa não encontrada.");
    if (ctx.user.role !== "admin" && current.createdByUserId !== ctx.user.id) throw new Error("Somente o criador ou administrador pode excluir a tarefa.");
    await database.transaction(async tx => {
      await tx.delete(tasks).where(eq(tasks.id, input.id));
      await writeAuditLog({ actorUserId: ctx.user.id, entityType: "task", entityId: input.id, action: "delete", beforeData: current }, tx);
    });
    return { success: true as const };
  }),
});
