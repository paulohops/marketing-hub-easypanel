import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { notifications, taskHistory, taskParticipants, tasks, users } from "../../drizzle/schema";
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
  assignedUserIds: z.array(z.number().int().positive()).optional(),
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

async function assertAssignees(database: Awaited<ReturnType<typeof databaseOrThrow>>, userIds: number[]) {
  if (!userIds.length) return;
  const found = await database
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, userIds), eq(users.isActive, true)));
  if (found.length !== userIds.length) {
    throw new Error("Um ou mais responsáveis selecionados não foram encontrados ou estão inativos.");
  }
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
  list: protectedProcedure
    .input(
      z
        .object({
          scope: z.enum(["mine", "team"]).default("team"),
          status: z.enum(taskStatuses).optional(),
          assignedToUserId: z.number().int().positive().optional().nullable(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "tasks.read");
      const database = await databaseOrThrow();

      let myTaskIds: number[] = [];
      if (input?.scope === "mine") {
        const participantRows = await database
          .select({ taskId: taskParticipants.taskId })
          .from(taskParticipants)
          .where(eq(taskParticipants.userId, ctx.user.id));
        myTaskIds = participantRows.map(p => p.taskId);
      }

      let filterUserTaskIds: number[] = [];
      if (input?.scope !== "mine" && input?.assignedToUserId) {
        const participantRows = await database
          .select({ taskId: taskParticipants.taskId })
          .from(taskParticipants)
          .where(eq(taskParticipants.userId, input.assignedToUserId));
        filterUserTaskIds = participantRows.map(p => p.taskId);
      }

      const conditions = [];
      if (input?.scope === "mine") {
        if (myTaskIds.length > 0) {
          conditions.push(or(eq(tasks.assignedToUserId, ctx.user.id), inArray(tasks.id, myTaskIds)));
        } else {
          conditions.push(eq(tasks.assignedToUserId, ctx.user.id));
        }
      } else if (ctx.user.role !== "admin") {
        const myRows = await database
          .select({ taskId: taskParticipants.taskId })
          .from(taskParticipants)
          .where(eq(taskParticipants.userId, ctx.user.id));
        const nonAdminTaskIds = myRows.map(p => p.taskId);
        if (nonAdminTaskIds.length > 0) {
          conditions.push(
            or(
              eq(tasks.assignedToUserId, ctx.user.id),
              eq(tasks.createdByUserId, ctx.user.id),
              inArray(tasks.id, nonAdminTaskIds)
            )
          );
        } else {
          conditions.push(or(eq(tasks.assignedToUserId, ctx.user.id), eq(tasks.createdByUserId, ctx.user.id)));
        }
      }

      if (input?.status) conditions.push(eq(tasks.status, input.status));
      if (input?.scope !== "mine" && input?.assignedToUserId) {
        if (filterUserTaskIds.length > 0) {
          conditions.push(or(eq(tasks.assignedToUserId, input.assignedToUserId), inArray(tasks.id, filterUserTaskIds)));
        } else {
          conditions.push(eq(tasks.assignedToUserId, input.assignedToUserId));
        }
      }

      const taskRows = await database
        .select(selectTask)
        .from(tasks)
        .leftJoin(users, eq(tasks.assignedToUserId, users.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(tasks.createdAt));

      const taskIds = taskRows.map(t => t.id);
      const participantsMap: Record<number, Array<{ id: number; name: string | null; email: string; role: string }>> = {};

      if (taskIds.length > 0) {
        const participantRows = await database
          .select({
            taskId: taskParticipants.taskId,
            userId: users.id,
            userName: users.name,
            userEmail: users.email,
            role: taskParticipants.role,
          })
          .from(taskParticipants)
          .innerJoin(users, eq(taskParticipants.userId, users.id))
          .where(inArray(taskParticipants.taskId, taskIds));

        for (const p of participantRows) {
          if (!participantsMap[p.taskId]) {
            participantsMap[p.taskId] = [];
          }
          participantsMap[p.taskId].push({
            id: p.userId,
            name: p.userName,
            email: p.userEmail ?? "",
            role: p.role,
          });
        }
      }

      return taskRows.map(t => ({
        ...t,
        participants:
          participantsMap[t.id] && participantsMap[t.id].length > 0
            ? participantsMap[t.id]
            : t.assignedToUserId
            ? [{ id: t.assignedToUserId, name: t.assignedToName, email: "", role: "assignee" }]
            : [],
      }));
    }),

  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "tasks.read");
    const database = await databaseOrThrow();
    const rows = await database
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(users.name);
    return { users: rows, statuses: taskStatuses, priorities: taskPriorities, sources: taskSources };
  }),

  create: protectedProcedure.input(taskInput).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "tasks.create");
    const database = await databaseOrThrow();

    const targetUserIds = input.assignedUserIds
      ? Array.from(new Set(input.assignedUserIds))
      : input.assignedToUserId
      ? [input.assignedToUserId]
      : [];

    await assertAssignees(database, targetUserIds);
    const primaryAssigneeId = targetUserIds[0] ?? input.assignedToUserId ?? null;

    return database.transaction(async tx => {
      const [created] = await tx
        .insert(tasks)
        .values({
          title: input.title,
          description: input.description || null,
          status: input.status,
          priority: input.priority,
          source: input.source,
          assignedToUserId: primaryAssigneeId,
          createdByUserId: ctx.user.id,
          dueDate: input.dueDate || null,
          entityType: input.entityType || null,
          entityId: input.entityId || null,
        })
        .returning();

      for (const uid of targetUserIds) {
        await tx
          .insert(taskParticipants)
          .values({
            taskId: created.id,
            userId: uid,
            role: "assignee",
          })
          .onConflictDoNothing();
      }

      await tx.insert(taskHistory).values({
        taskId: created.id,
        actorUserId: ctx.user.id,
        action: "created",
        toStatus: created.status,
        note: input.source === "context" ? "Tarefa contextual criada" : "Tarefa criada",
      });

      await writeAuditLog(
        {
          actorUserId: ctx.user.id,
          regionalId: null,
          entityType: "task",
          entityId: created.id,
          action: "create",
          afterData: created,
        },
        tx
      );

      return created;
    });
  }),

  createFromNotification: protectedProcedure
    .input(
      z.object({
        notificationId: z.number().int().positive(),
        assignedToUserId: z.number().int().positive().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "tasks.create");
      const database = await databaseOrThrow();
      if (input.assignedToUserId) {
        await assertAssignees(database, [input.assignedToUserId]);
      }
      const [notification] = await database.select().from(notifications).where(eq(notifications.id, input.notificationId)).limit(1);
      if (!notification) throw new Error("Notificação não encontrada.");
      const [existing] = await database.select({ id: tasks.id }).from(tasks).where(eq(tasks.sourceNotificationId, input.notificationId)).limit(1);
      if (existing) return existing;

      return database.transaction(async tx => {
        const assignedToUserId = input.assignedToUserId || notification.userId || ctx.user.id;
        const [created] = await tx
          .insert(tasks)
          .values({
            title: notification.title,
            description: notification.message,
            status: "todo",
            priority: "normal",
            source: "notification",
            assignedToUserId,
            createdByUserId: ctx.user.id,
            sourceNotificationId: notification.id,
            entityType: notification.entityType,
            entityId: notification.entityId,
          })
          .returning();

        if (assignedToUserId) {
          await tx
            .insert(taskParticipants)
            .values({
              taskId: created.id,
              userId: assignedToUserId,
              role: "assignee",
            })
            .onConflictDoNothing();
        }

        await tx.insert(taskHistory).values({
          taskId: created.id,
          actorUserId: ctx.user.id,
          action: "created_from_notification",
          toStatus: created.status,
          note: "Tarefa criada a partir de notificação",
        });

        await writeAuditLog({ actorUserId: ctx.user.id, entityType: "task", entityId: created.id, action: "create", afterData: created }, tx);
        return created;
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().trim().min(1).max(180).optional(),
        description: z.string().trim().max(10000).optional().nullable(),
        status: z.enum(taskStatuses).optional(),
        priority: z.enum(taskPriorities).optional(),
        assignedToUserId: z.number().int().positive().optional().nullable(),
        assignedUserIds: z.array(z.number().int().positive()).optional(),
        dueDate: z.string().date().optional().nullable(),
        position: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "tasks.update");
      const database = await databaseOrThrow();
      const [current] = await database.select().from(tasks).where(eq(tasks.id, input.id)).limit(1);
      if (!current) throw new Error("Tarefa não encontrada.");

      if (ctx.user.role !== "admin" && current.assignedToUserId !== ctx.user.id && current.createdByUserId !== ctx.user.id) {
        const [isParticipant] = await database
          .select({ id: taskParticipants.id })
          .from(taskParticipants)
          .where(and(eq(taskParticipants.taskId, input.id), eq(taskParticipants.userId, ctx.user.id)))
          .limit(1);
        if (!isParticipant) throw new Error("Sem acesso à tarefa.");
      }

      let finalAssignedToUserId = input.assignedToUserId;
      let finalUserIds: number[] | undefined;
      if (input.assignedUserIds !== undefined) {
        finalUserIds = Array.from(new Set(input.assignedUserIds));
        finalAssignedToUserId = finalUserIds[0] ?? null;
      } else if (input.assignedToUserId !== undefined && input.assignedToUserId !== null) {
        finalUserIds = [input.assignedToUserId];
      }

      if (finalUserIds && finalUserIds.length > 0) {
        await assertAssignees(database, finalUserIds);
      }

      return database.transaction(async tx => {
        const nextStatus = input.status ?? current.status;
        const completedAt = nextStatus === "done" ? current.completedAt ?? new Date() : null;

        const [updated] = await tx
          .update(tasks)
          .set({
            title: input.title ?? current.title,
            description: input.description === undefined ? current.description : input.description,
            status: nextStatus,
            priority: input.priority ?? current.priority,
            assignedToUserId: finalAssignedToUserId === undefined ? current.assignedToUserId : finalAssignedToUserId,
            dueDate: input.dueDate === undefined ? current.dueDate : input.dueDate,
            position: input.position ?? current.position,
            completedAt,
            updatedAt: new Date(),
          })
          .where(eq(tasks.id, input.id))
          .returning();

        if (finalUserIds !== undefined) {
          await tx.delete(taskParticipants).where(eq(taskParticipants.taskId, input.id));
          for (const uid of finalUserIds) {
            await tx
              .insert(taskParticipants)
              .values({
                taskId: input.id,
                userId: uid,
                role: "assignee",
              })
              .onConflictDoNothing();
          }
        }

        if (current.status !== updated.status || current.assignedToUserId !== updated.assignedToUserId) {
          await tx.insert(taskHistory).values({
            taskId: updated.id,
            actorUserId: ctx.user.id,
            action: current.status !== updated.status ? "status_changed" : "assigned",
            fromStatus: current.status,
            toStatus: updated.status,
            note:
              current.status !== updated.status
                ? `Status alterado de ${current.status} para ${updated.status}`
                : "Responsável atualizado",
          });
        }

        await writeAuditLog(
          {
            actorUserId: ctx.user.id,
            entityType: "task",
            entityId: updated.id,
            action:
              current.assignedToUserId !== updated.assignedToUserId
                ? "assigned"
                : current.status !== updated.status
                ? "status_changed"
                : "update",
            beforeData: current,
            afterData: updated,
          },
          tx
        );

        return updated;
      });
    }),

  history: protectedProcedure
    .input(z.object({ taskId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "tasks.read");
      const database = await databaseOrThrow();
      return database
        .select({
          id: taskHistory.id,
          taskId: taskHistory.taskId,
          action: taskHistory.action,
          fromStatus: taskHistory.fromStatus,
          toStatus: taskHistory.toStatus,
          note: taskHistory.note,
          createdAt: taskHistory.createdAt,
          actorUserId: taskHistory.actorUserId,
          actorName: users.name,
        })
        .from(taskHistory)
        .leftJoin(users, eq(taskHistory.actorUserId, users.id))
        .where(eq(taskHistory.taskId, input.taskId))
        .orderBy(desc(taskHistory.createdAt));
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "tasks.delete");
      const database = await databaseOrThrow();
      const [current] = await database.select().from(tasks).where(eq(tasks.id, input.id)).limit(1);
      if (!current) throw new Error("Tarefa não encontrada.");
      if (ctx.user.role !== "admin" && current.createdByUserId !== ctx.user.id) {
        throw new Error("Somente o criador ou administrador pode excluir a tarefa.");
      }
      return database.transaction(async tx => {
        await tx.delete(tasks).where(eq(tasks.id, input.id));
        await writeAuditLog(
          {
            actorUserId: ctx.user.id,
            entityType: "task",
            entityId: input.id,
            action: "delete",
            beforeData: current,
          },
          tx
        );
        return { success: true as const };
      });
    }),
});
