import { and, asc, desc, eq, ilike, ne, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { processSteps, processes, regionals, users } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const processStatuses = ["draft", "active", "under_review", "archived"] as const;

const processStepFields = z.object({
  stepOrder: z.number().int().positive(),
  sectorName: z.string().trim().min(1).max(160),
  description: z.string().trim().min(3).max(8_000),
});

const processFields = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9._-]+$/, "Use apenas letras, números, ponto, hífen ou sublinhado no código."),
  name: z.string().trim().min(2).max(180),
  category: z.string().trim().min(2).max(120),
  version: z.string().trim().min(1).max(32),
  status: z.enum(processStatuses),
  ownerUserId: z.number().int().positive().nullable(),
  regionalId: z.number().int().positive().nullable(),
  objective: z.string().trim().max(4_000).nullable(),
  scope: z.string().trim().max(4_000).nullable(),
  description: z.string().trim().min(20, "Descreva o processo com pelo menos 20 caracteres.").max(20_000),
  inputs: z.string().trim().max(4_000).nullable(),
  outputs: z.string().trim().max(4_000).nullable(),
  controls: z.string().trim().max(4_000).nullable(),
  exceptions: z.string().trim().max(4_000).nullable(),
  sla: z.string().trim().max(2_000).nullable(),
  relatedModules: z.string().trim().max(2_000).nullable(),
  kpis: z.string().trim().max(4_000).nullable(),
  effectiveFrom: z.string().trim().max(10).nullable(),
  reviewDate: z.string().trim().max(10).nullable(),
  steps: z.array(processStepFields).max(50).default([]),
});

type ProcessInput = z.infer<typeof processFields>;

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

function nullable(value: string | null) {
  return value?.trim() || null;
}

function normaliseInput(input: ProcessInput) {
  const { steps: _steps, ...fields } = input;
  return {
    ...fields,
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    category: input.category.trim(),
    version: input.version.trim(),
    objective: nullable(input.objective),
    scope: nullable(input.scope),
    description: input.description.trim(),
    inputs: nullable(input.inputs),
    outputs: nullable(input.outputs),
    controls: nullable(input.controls),
    exceptions: nullable(input.exceptions),
    sla: nullable(input.sla),
    relatedModules: nullable(input.relatedModules),
    kpis: nullable(input.kpis),
    effectiveFrom: nullable(input.effectiveFrom),
    reviewDate: nullable(input.reviewDate),
  };
}

async function validateReferences(database: Awaited<ReturnType<typeof requireDatabase>>, input: Pick<ProcessInput, "ownerUserId" | "regionalId">) {
  if (input.ownerUserId) {
    const [owner] = await database.select({ id: users.id }).from(users).where(and(eq(users.id, input.ownerUserId), eq(users.isActive, true))).limit(1);
    if (!owner) throw new TRPCError({ code: "BAD_REQUEST", message: "O responsável selecionado não existe ou está inativo." });
  }
  if (input.regionalId) {
    const [regional] = await database.select({ id: regionals.id }).from(regionals).where(and(eq(regionals.id, input.regionalId), eq(regionals.active, true))).limit(1);
    if (!regional) throw new TRPCError({ code: "BAD_REQUEST", message: "A regional selecionada não existe ou está inativa." });
  }
}

export const processesRouter = router({
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "operations.read");
    const database = await requireDatabase();
    const [owners, regionalRows] = await Promise.all([
      database.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)),
      database.select({ id: regionals.id, name: regionals.name }).from(regionals).where(eq(regionals.active, true)).orderBy(asc(regionals.name)),
    ]);
    return { owners, regionals: regionalRows };
  }),

  list: protectedProcedure.input(z.object({ search: z.string().trim().max(120).optional(), status: z.enum(processStatuses).optional() }).optional()).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "operations.read");
    const database = await requireDatabase();
    const filters = [];
    if (input?.status) filters.push(eq(processes.status, input.status));
    if (input?.search) {
      const search = `%${input.search}%`;
      filters.push(or(ilike(processes.name, search), ilike(processes.code, search), ilike(processes.category, search)));
    }
    const [rows, steps] = await Promise.all([
      database.select({ process: processes, ownerName: users.name, regionalName: regionals.name }).from(processes).leftJoin(users, eq(processes.ownerUserId, users.id)).leftJoin(regionals, eq(processes.regionalId, regionals.id)).where(filters.length ? and(...filters) : undefined).orderBy(desc(processes.updatedAt), asc(processes.name)),
      database.select().from(processSteps).orderBy(asc(processSteps.processId), asc(processSteps.stepOrder)),
    ]);
    return rows.map(row => ({ ...row.process, ownerName: row.ownerName ?? null, regionalName: row.regionalName ?? null, steps: steps.filter(step => step.processId === row.process.id) }));
  }),

  get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "operations.read");
    const database = await requireDatabase();
    const [row] = await database.select({ process: processes, ownerName: users.name, regionalName: regionals.name }).from(processes).leftJoin(users, eq(processes.ownerUserId, users.id)).leftJoin(regionals, eq(processes.regionalId, regionals.id)).where(eq(processes.id, input.id)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Processo não encontrado." });
    const steps = await database.select().from(processSteps).where(eq(processSteps.processId, input.id)).orderBy(asc(processSteps.stepOrder));
    return { ...row.process, ownerName: row.ownerName ?? null, regionalName: row.regionalName ?? null, steps };
  }),

  create: protectedProcedure.input(processFields).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "operations.create");
    const database = await requireDatabase();
    const data = normaliseInput(input);
    await validateReferences(database, data);
    const [existing] = await database.select({ id: processes.id }).from(processes).where(eq(processes.code, data.code)).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe um processo com este código." });
    const created = await database.transaction(async tx => {
      const [process] = await tx.insert(processes).values({ ...data, createdByUserId: ctx.user.id }).returning();
      if (input.steps.length) await tx.insert(processSteps).values(input.steps.map(step => ({ ...step, processId: process.id })));
      return process;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: created.regionalId, entityType: "process", entityId: created.id, action: "create", afterData: { ...data, steps: input.steps } });
    return { ...created, steps: input.steps };
  }),

  update: protectedProcedure.input(processFields.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "operations.update");
    const database = await requireDatabase();
    const { id, steps, ...fields } = input;
    const data = normaliseInput({ ...fields, steps });
    const [before] = await database.select().from(processes).where(eq(processes.id, id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Processo não encontrado." });
    await validateReferences(database, data);
    const [duplicate] = await database.select({ id: processes.id }).from(processes).where(and(eq(processes.code, data.code), ne(processes.id, id))).limit(1);
    if (duplicate && duplicate.id !== id) throw new TRPCError({ code: "CONFLICT", message: "Já existe um processo com este código." });
    const updated = await database.transaction(async tx => {
      const [process] = await tx.update(processes).set({ ...data, updatedAt: new Date() }).where(eq(processes.id, id)).returning();
      await tx.delete(processSteps).where(eq(processSteps.processId, id));
      if (steps.length) await tx.insert(processSteps).values(steps.map(step => ({ ...step, processId: id })));
      return process;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: updated.regionalId, entityType: "process", entityId: updated.id, action: "update", beforeData: before, afterData: { ...data, steps } });
    return { ...updated, steps };
  }),
});
