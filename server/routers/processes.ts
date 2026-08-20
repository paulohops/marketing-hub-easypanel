import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ilike, inArray, ne, or } from "drizzle-orm";
import { z } from "zod";
import { campaignSectors, processSteps, processes, regionals, users } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { writeAuditLog } from "../audit";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const processStatuses = ["draft", "active", "under_review", "archived"] as const;
const processStepTypes = ["task", "gateway"] as const;

const processStepFields = z.object({
  stepOrder: z.number().int().positive(),
  sectorId: z.number().int().positive(),
  stepType: z.enum(processStepTypes).default("task"),
  stepName: z.string().trim().min(2).max(180),
  description: z.string().trim().min(3).max(8_000),
  gatewayQuestion: z.string().trim().max(500).nullable().optional(),
  yesNextStepOrder: z.number().int().positive().nullable().optional(),
  noNextStepOrder: z.number().int().positive().nullable().optional(),
});

const processFields = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9._-]+$/, "Use apenas letras, números, ponto, hífen ou sublinhado no código."),
  name: z.string().trim().min(2).max(180),
  category: z.string().trim().min(2).max(120),
  version: z.string().trim().min(1).max(32).default("1.0"),
  status: z.enum(processStatuses).default("draft"),
  ownerUserId: z.number().int().positive().nullable().default(null),
  regionalId: z.number().int().positive().nullable().default(null),
  objective: z.string().trim().max(4_000).nullable().default(null),
  scope: z.string().trim().max(4_000).nullable().default(null),
  description: z.string().trim().max(20_000).default("Descritivo estruturado por passos operacionais."),
  inputs: z.string().trim().max(4_000).nullable().default(null),
  outputs: z.string().trim().max(4_000).nullable().default(null),
  controls: z.string().trim().max(4_000).nullable().default(null),
  exceptions: z.string().trim().max(4_000).nullable().default(null),
  sla: z.string().trim().max(2_000).nullable().default(null),
  relatedModules: z.string().trim().max(2_000).nullable().default(null),
  kpis: z.string().trim().max(4_000).nullable().default(null),
  effectiveFrom: z.string().trim().max(10).nullable().default(null),
  reviewDate: z.string().trim().max(10).nullable().default(null),
  steps: z.array(processStepFields).max(50).default([]),
});

type ProcessInput = z.infer<typeof processFields>;
type Database = Awaited<ReturnType<typeof getDb>>;

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

function nullable(value: string | null | undefined) {
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
    description: input.description.trim() || "Descritivo estruturado por passos operacionais.",
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

async function validateReferences(database: NonNullable<Database>, input: Pick<ProcessInput, "ownerUserId" | "regionalId">) {
  if (input.ownerUserId) {
    const [owner] = await database.select({ id: users.id }).from(users).where(and(eq(users.id, input.ownerUserId), eq(users.isActive, true))).limit(1);
    if (!owner) throw new TRPCError({ code: "BAD_REQUEST", message: "O responsável selecionado não existe ou está inativo." });
  }
  if (input.regionalId) {
    const [regional] = await database.select({ id: regionals.id }).from(regionals).where(and(eq(regionals.id, input.regionalId), eq(regionals.active, true))).limit(1);
    if (!regional) throw new TRPCError({ code: "BAD_REQUEST", message: "A regional selecionada não existe ou está inativa." });
  }
}

async function normaliseSteps(database: NonNullable<Database>, inputSteps: ProcessInput["steps"]) {
  if (!inputSteps.length) return [];
  const sectorIds = Array.from(new Set(inputSteps.map(step => step.sectorId)));
  const sectors = await database.select({ id: campaignSectors.id, name: campaignSectors.name }).from(campaignSectors).where(and(inArray(campaignSectors.id, sectorIds), eq(campaignSectors.active, true)));
  const sectorMap = new Map(sectors.map(sector => [sector.id, sector.name]));
  const missingSector = sectorIds.find(id => !sectorMap.has(id));
  if (missingSector) throw new TRPCError({ code: "BAD_REQUEST", message: "Um dos Setores selecionados não existe ou está inativo em Cadastros > Operação." });

  const ordered = [...inputSteps].sort((a, b) => a.stepOrder - b.stepOrder);
  const orderMap = new Map(ordered.map((step, index) => [step.stepOrder, index + 1]));
  const normalized = ordered.map((step, index) => ({
    stepOrder: index + 1,
    sectorId: step.sectorId,
    sectorName: sectorMap.get(step.sectorId)!,
    stepType: step.stepType ?? "task",
    stepName: step.stepName.trim(),
    description: step.description.trim(),
    gatewayQuestion: step.stepType === "gateway" ? nullable(step.gatewayQuestion) : null,
    yesNextStepOrder: step.stepType === "gateway" && step.yesNextStepOrder ? orderMap.get(step.yesNextStepOrder) ?? null : null,
    noNextStepOrder: step.stepType === "gateway" && step.noNextStepOrder ? orderMap.get(step.noNextStepOrder) ?? null : null,
  }));

  normalized.forEach(step => {
    if (step.stepType === "gateway") {
      if (!step.gatewayQuestion) throw new TRPCError({ code: "BAD_REQUEST", message: `Informe a pergunta do gateway no passo ${step.stepOrder}.` });
      if (!step.yesNextStepOrder || !step.noNextStepOrder) throw new TRPCError({ code: "BAD_REQUEST", message: `Defina os caminhos Sim e Não no passo ${step.stepOrder}.` });
      if (step.yesNextStepOrder === step.stepOrder || step.noNextStepOrder === step.stepOrder) throw new TRPCError({ code: "BAD_REQUEST", message: `O gateway do passo ${step.stepOrder} não pode apontar para ele mesmo.` });
    }
  });
  return normalized;
}

export const processesRouter = router({
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "operations.read");
    const database = await requireDatabase();
    const [owners, regionalRows, sectors] = await Promise.all([
      database.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.isActive, true)).orderBy(asc(users.name)),
      database.select({ id: regionals.id, name: regionals.name }).from(regionals).where(eq(regionals.active, true)).orderBy(asc(regionals.name)),
      database.select({ id: campaignSectors.id, name: campaignSectors.name }).from(campaignSectors).where(eq(campaignSectors.active, true)).orderBy(asc(campaignSectors.name)),
    ]);
    return { owners, regionals: regionalRows, sectors };
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
    const [rows, stepRows] = await Promise.all([
      database.select({ process: processes, ownerName: users.name, regionalName: regionals.name }).from(processes).leftJoin(users, eq(processes.ownerUserId, users.id)).leftJoin(regionals, eq(processes.regionalId, regionals.id)).where(filters.length ? and(...filters) : undefined).orderBy(desc(processes.updatedAt), asc(processes.name)),
      database.select({ step: processSteps, sectorNameFromRegistry: campaignSectors.name }).from(processSteps).leftJoin(campaignSectors, eq(processSteps.sectorId, campaignSectors.id)).orderBy(asc(processSteps.processId), asc(processSteps.stepOrder)),
    ]);
    return rows.map(row => ({ ...row.process, ownerName: row.ownerName ?? null, regionalName: row.regionalName ?? null, steps: stepRows.filter(({ step }) => step.processId === row.process.id).map(({ step, sectorNameFromRegistry }) => ({ ...step, sectorName: sectorNameFromRegistry ?? step.sectorName })) }));
  }),

  get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "operations.read");
    const database = await requireDatabase();
    const [row] = await database.select({ process: processes, ownerName: users.name, regionalName: regionals.name }).from(processes).leftJoin(users, eq(processes.ownerUserId, users.id)).leftJoin(regionals, eq(processes.regionalId, regionals.id)).where(eq(processes.id, input.id)).limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Processo não encontrado." });
    const steps = await database.select({ step: processSteps, sectorNameFromRegistry: campaignSectors.name }).from(processSteps).leftJoin(campaignSectors, eq(processSteps.sectorId, campaignSectors.id)).where(eq(processSteps.processId, input.id)).orderBy(asc(processSteps.stepOrder));
    return { ...row.process, ownerName: row.ownerName ?? null, regionalName: row.regionalName ?? null, steps: steps.map(({ step, sectorNameFromRegistry }) => ({ ...step, sectorName: sectorNameFromRegistry ?? step.sectorName })) };
  }),

  create: protectedProcedure.input(processFields).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "operations.create");
    const database = await requireDatabase();
    const data = normaliseInput(input);
    await validateReferences(database, data);
    const steps = await normaliseSteps(database, input.steps);
    const [existing] = await database.select({ id: processes.id }).from(processes).where(eq(processes.code, data.code)).limit(1);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Já existe um processo com este código." });
    const created = await database.transaction(async tx => {
      const [process] = await tx.insert(processes).values({ ...data, createdByUserId: ctx.user.id }).returning();
      if (steps.length) await tx.insert(processSteps).values(steps.map(step => ({ ...step, processId: process.id })));
      return process;
    });
    await writeAuditLog({ actorUserId: ctx.user.id, regionalId: created.regionalId, entityType: "process", entityId: created.id, action: "create", afterData: { ...data, steps } });
    return { ...created, steps };
  }),

  update: protectedProcedure.input(processFields.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "operations.update");
    const database = await requireDatabase();
    const { id, steps: inputSteps, ...fields } = input;
    const data = normaliseInput({ ...fields, steps: inputSteps });
    const [before] = await database.select().from(processes).where(eq(processes.id, id)).limit(1);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Processo não encontrado." });
    await validateReferences(database, data);
    const steps = await normaliseSteps(database, inputSteps);
    const [duplicate] = await database.select({ id: processes.id }).from(processes).where(and(eq(processes.code, data.code), ne(processes.id, id))).limit(1);
    if (duplicate) throw new TRPCError({ code: "CONFLICT", message: "Já existe um processo com este código." });
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
