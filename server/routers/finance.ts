import { and, asc, eq, gte, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { actions, documents, events, invoices, mediaCampaigns, payments, suppliers } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { writeAuditLog } from "../audit";

export function paymentStatus(total: number, paid: number) {
  if (paid <= 0) return "open" as const;
  if (paid >= total) return "paid" as const;
  return "partially_paid" as const;
}

export const invoiceListFiltersInput = z.object({
  status: z.enum(["open", "partially_paid", "paid", "overdue", "cancelled"]).optional(),
  dueStartsAt: z.string().date().optional(),
  dueEndsAt: z.string().date().optional(),
  supplierId: z.number().int().positive().optional(),
  operationType: z.enum(["media_campaign", "action", "event", "other"]).optional(),
  operationId: z.number().int().positive().optional(),
});

export function deriveInvoiceStatus(status: string, dueDate: string, today = new Date().toISOString().slice(0, 10)) {
  if (status === "cancelled" || status === "paid") return status;
  return dueDate < today ? "overdue" : status;
}

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

async function operationCatalog(database: Awaited<ReturnType<typeof getDb>>) {
  if (!database) return [];
  const [campaignRows, actionRows, eventRows] = await Promise.all([
    database.select({ id: mediaCampaigns.id, name: mediaCampaigns.name }).from(mediaCampaigns).orderBy(asc(mediaCampaigns.name)),
    database.select({ id: actions.id, name: actions.name }).from(actions).orderBy(asc(actions.name)),
    database.select({ id: events.id, name: events.name }).from(events).orderBy(asc(events.name)),
  ]);
  return [
    ...campaignRows.map(row => ({ ...row, type: "media_campaign" as const, label: `Campanha · ${row.name}` })),
    ...actionRows.map(row => ({ ...row, type: "action" as const, label: `Ação · ${row.name}` })),
    ...eventRows.map(row => ({ ...row, type: "event" as const, label: `Evento · ${row.name}` })),
  ];
}

export const financeRouter = router({
  referenceData: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "finance.read");
    const database = await requireDatabase();
    return database.select().from(suppliers).where(eq(suppliers.active, true)).orderBy(asc(suppliers.displayName));
  }),

  operationOptions: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "finance.read");
    return operationCatalog(await requireDatabase());
  }),

  listInvoices: protectedProcedure.input(invoiceListFiltersInput.optional()).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.read");
    const database = await requireDatabase();
    const conditions = [];
    if (input?.supplierId) conditions.push(eq(invoices.supplierId, input.supplierId));
    if (input?.dueStartsAt) conditions.push(gte(invoices.dueDate, input.dueStartsAt));
    if (input?.dueEndsAt) conditions.push(lte(invoices.dueDate, input.dueEndsAt));
    if (input?.operationType) conditions.push(eq(invoices.operationType, input.operationType));
    if (input?.operationId) conditions.push(eq(invoices.operationId, input.operationId));
    const [invoiceRows, paymentRows, documentRows, operations] = await Promise.all([
      database.select({ invoice: invoices, supplierName: suppliers.displayName }).from(invoices).innerJoin(suppliers, eq(invoices.supplierId, suppliers.id)).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(invoices.dueDate)),
      database.select().from(payments),
      database.select().from(documents).where(eq(documents.entityType, "invoice")),
      operationCatalog(database),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const result = invoiceRows.map(({ invoice, supplierName }) => {
      const totalPaid = paymentRows.filter(payment => payment.invoiceId === invoice.id).reduce((total, payment) => total + Number(payment.amount), 0);
      const attachedDocuments = documentRows.filter(document => document.entityId === invoice.id);
      const operation = operations.find(row => row.type === invoice.operationType && row.id === invoice.operationId);
      const status = deriveInvoiceStatus(invoice.status, invoice.dueDate, today);
      return { ...invoice, status, supplierName, totalPaid, outstandingAmount: Math.max(0, Number(invoice.amount) - totalPaid), operationLabel: operation?.label ?? (invoice.operationType === "other" ? "Outra operação" : null), attachedDocuments };
    });
    return input?.status ? result.filter(invoice => invoice.status === input.status) : result;
  }),

  createInvoice: protectedProcedure.input(z.object({ supplierId: z.number().int().positive(), invoiceNumber: z.string().trim().min(1).max(80), issueDate: z.string().date(), dueDate: z.string().date(), amount: z.number().positive().max(10_000_000), operationType: z.enum(["media_campaign", "action", "event", "other"]).nullable(), operationId: z.number().int().positive().nullable(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.write");
    const database = await requireDatabase();
    if (input.operationType === null && input.operationId !== null) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione o tipo da operação vinculada." });
    if (["media_campaign", "action", "event"].includes(input.operationType ?? "") && input.operationId === null) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione a operação vinculada à nota fiscal." });
    if (input.operationType === "other" && input.operationId !== null) throw new TRPCError({ code: "BAD_REQUEST", message: "Uma operação genérica não deve apontar para uma entidade específica." });
    if (input.operationId && input.operationType) {
      const operations = await operationCatalog(database);
      if (!operations.some(row => row.type === input.operationType && row.id === input.operationId)) throw new TRPCError({ code: "NOT_FOUND", message: "A operação selecionada não foi encontrada." });
    }
    const [created] = await database.insert(invoices).values({ ...input, amount: input.amount.toFixed(2), notes: input.notes || null }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "invoice", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  registerPayment: protectedProcedure.input(z.object({ invoiceId: z.number().int().positive(), paidAt: z.coerce.date(), amount: z.number().positive().max(10_000_000), method: z.string().trim().min(2).max(80), reference: z.string().trim().max(140).optional(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.write");
    const database = await requireDatabase();
    const [invoice] = await database.select().from(invoices).where(eq(invoices.id, input.invoiceId));
    if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Nota fiscal não encontrada." });
    if (invoice.status === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível pagar uma nota fiscal cancelada." });
    const existingPayments = await database.select().from(payments).where(eq(payments.invoiceId, input.invoiceId));
    const paidBefore = existingPayments.reduce((total, payment) => total + Number(payment.amount), 0);
    if (paidBefore + input.amount > Number(invoice.amount) + 0.0001) throw new TRPCError({ code: "BAD_REQUEST", message: "O pagamento excede o saldo da nota fiscal." });
    const [created] = await database.insert(payments).values({ ...input, amount: input.amount.toFixed(2), reference: input.reference || null, notes: input.notes || null, performedByUserId: ctx.user.id }).returning();
    const nextStatus = paymentStatus(Number(invoice.amount), paidBefore + input.amount);
    await database.update(invoices).set({ status: nextStatus, updatedAt: new Date() }).where(eq(invoices.id, input.invoiceId));
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "payment", entityId: created.id, action: "create", afterData: created });
    return { payment: created, invoiceStatus: nextStatus };
  }),
});
