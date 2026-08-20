import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  actionSuppliers,
  actions,
  documents,
  eventSuppliers,
  events,
  financeAccounts,
  financeBudgetLines,
  financeBudgetMonths,
  financeBudgetPlans,
  financeCompanies,
  providerFiscalEntities,
  financeDivisions,
  financeMediums,
  financeSectors,
  financialCostAllocations,
  financeBillings,
  invoiceItems,
  invoices,
  mediaCampaigns,
  mediaPoints,
  mediaTypes,
  serviceTypes,
  payments,
  purchaseOrderItems,
  purchaseOrders,
  providers,
  regionals,
  stockBalances,
  stockItems,
  stockMovements,
  supplierContracts,
  supplierContractItems,
  supplierOfferings,
  suppliers,
  subserviceTypes,
  mediaServiceCatalog,
  productTypes,
} from "../../drizzle/schema";
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

const financeItemInput = z.object({
  kind: z.enum(["product", "service", "media", "other"]),
  description: z.string().trim().min(1).max(240),
  quantity: z.number().positive(),
  unit: z.string().trim().min(1).max(40),
  unitPrice: z.number().min(0),
  supplierOfferingId: z.number().int().positive().nullable().optional(),
  stockItemId: z.number().int().positive().nullable().optional(),
  mediaServiceCatalogId: z.number().int().positive().nullable().optional(),
  subserviceTypeId: z.number().int().positive().nullable().optional(),
  productTypeId: z.number().int().positive().nullable().optional(),
  operationType: z.enum(["media_campaign", "action", "event", "trade_operation", "other"]).nullable().optional(),
  operationId: z.number().int().positive().nullable().optional(),
});

const supplierContractInput = z.object({
  supplierId: z.number().int().positive(),
  companyId: z.number().int().positive().nullable().optional(),
  fiscalEntityId: z.number().int().positive().nullable().optional(),
  purchaseOrderCode: z.string().trim().max(96).optional(),
  contractType: z.string().trim().min(2).max(120),
  objectDescription: z.string().trim().max(2000).optional(),
  signatureDate: z.string().date().optional(),
  contractCode: z.string().trim().max(120).optional(),
  billingNames: z.array(z.string().trim().min(1).max(180)).max(12).default([]),
  startsOn: z.string().date(),
  endsOn: z.string().date().optional(),
  termMonths: z.number().int().positive().max(240).optional(),
  recurrence: z.string().trim().min(2).max(80),
  billingMode: z.enum(["single", "recurring"]).default("recurring"),
  billingRecurrence: z.enum(["one_time", "weekly", "biweekly", "monthly", "bimonthly", "quarterly", "semiannual", "annual"]).default("monthly"),
  billingStartsOn: z.string().date().optional(),
  billingEndsOn: z.string().date().optional(),
  autoRenew: z.boolean().default(false),
  paymentDay: z.number().int().min(1).max(31).optional(),
  expectedAmount: z.number().min(0).max(10_000_000),
  paymentMethod: z.string().trim().max(80).optional(),
  bankName: z.string().trim().max(120).optional(),
  bankBranch: z.string().trim().max(40).optional(),
  bankAccount: z.string().trim().max(80).optional(),
  bankHolder: z.string().trim().max(180).optional(),
  pixKey: z.string().trim().max(180).optional(),
  status: z.enum(["draft", "active", "expired", "terminated"]).default("draft"),
  notes: z.string().trim().max(3000).optional(),
  items: z.array(financeItemInput).optional().default([]),
});

export function deriveInvoiceStatus(status: string, dueDate: string, today = new Date().toISOString().slice(0, 10)) {
  if (status === "cancelled" || status === "paid") return status;
  return dueDate < today ? "overdue" : status;
}

type FinanceRecurrence = "one_time" | "weekly" | "biweekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";

function toUtcDate(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

function toDateString(value: Date) {
  return value.toISOString().slice(0, 10);
}

function addMonthsClamped(value: Date, months: number) {
  const target = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1, 12));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
  target.setUTCDate(Math.min(value.getUTCDate(), lastDay));
  return target;
}

function addRecurrence(value: Date, recurrence: FinanceRecurrence) {
  if (recurrence === "weekly") return new Date(value.getTime() + 7 * 86400000);
  if (recurrence === "biweekly") return new Date(value.getTime() + 14 * 86400000);
  if (recurrence === "monthly") return addMonthsClamped(value, 1);
  if (recurrence === "bimonthly") return addMonthsClamped(value, 2);
  if (recurrence === "quarterly") return addMonthsClamped(value, 3);
  if (recurrence === "semiannual") return addMonthsClamped(value, 6);
  return addMonthsClamped(value, 12);
}

function recurrencePeriodEnd(start: Date, recurrence: FinanceRecurrence, boundary: Date) {
  if (recurrence === "one_time") return boundary;
  const next = addRecurrence(start, recurrence);
  return new Date(Math.min(next.getTime() - 86400000, boundary.getTime()));
}

function dueDateForPeriod(periodEnd: Date, paymentDay?: number | null) {
  if (!paymentDay) return periodEnd;
  const day = Math.min(Math.max(paymentDay, 1), 31);
  const lastDay = new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + 1, 0, 12)).getUTCDate();
  return new Date(Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), Math.min(day, lastDay), 12));
}

function buildBillingPeriods(startOn: string, endOn: string | null | undefined, recurrence: FinanceRecurrence, paymentDay?: number | null) {
  const start = toUtcDate(startOn);
  const boundary = toUtcDate(endOn || startOn);
  if (boundary.getTime() < start.getTime()) throw new TRPCError({ code: "BAD_REQUEST", message: "O fim da recorrência não pode ser anterior ao início." });
  if (recurrence !== "one_time" && !endOn) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o fim da recorrência para gerar competências." });
  const periods: Array<{ sequence: number; competenceStart: string; competenceEnd: string; dueDate: string }> = [];
  let cursor = start;
  let sequence = 1;
  while (cursor.getTime() <= boundary.getTime() && sequence <= 2400) {
    const end = recurrencePeriodEnd(cursor, recurrence, boundary);
    periods.push({ sequence, competenceStart: toDateString(cursor), competenceEnd: toDateString(end), dueDate: toDateString(dueDateForPeriod(end, paymentDay)) });
    if (recurrence === "one_time") break;
    const next = addRecurrence(cursor, recurrence);
    if (next.getTime() <= cursor.getTime()) break;
    cursor = next;
    sequence += 1;
  }
  return periods;
}

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

async function validateFinancialEntity(
  database: Awaited<ReturnType<typeof getDb>>,
  companyId: number | null | undefined,
  fiscalEntityId: number | null | undefined,
) {
  if (!database) return;
  let companyProviderId: number | null = null;
  if (companyId) {
    const [company] = await database
      .select({ id: financeCompanies.id, providerId: financeCompanies.providerId })
      .from(financeCompanies)
      .where(eq(financeCompanies.id, companyId))
      .limit(1);
    if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa operacional financeira não encontrada." });
    companyProviderId = company.providerId;
  }
  if (!fiscalEntityId) return;
  const [fiscalEntity] = await database
    .select({ id: providerFiscalEntities.id, providerId: providerFiscalEntities.providerId })
    .from(providerFiscalEntities)
    .where(eq(providerFiscalEntities.id, fiscalEntityId))
    .limit(1);
  if (!fiscalEntity) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa fiscal não encontrada." });
  if (companyProviderId && fiscalEntity.providerId !== companyProviderId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "A empresa fiscal selecionada não pertence à empresa operacional informada." });
  }
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

  listSupplierContracts: protectedProcedure.input(z.object({ supplierId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.read");
    const database = await requireDatabase();
    const [contracts, invoiceRows, paymentRows, documentRows] = await Promise.all([
      database.select({ contract: supplierContracts, supplierName: suppliers.displayName }).from(supplierContracts).innerJoin(suppliers, eq(supplierContracts.supplierId, suppliers.id)).where(input?.supplierId ? eq(supplierContracts.supplierId, input.supplierId) : undefined).orderBy(asc(supplierContracts.startsOn)),
      database.select().from(invoices),
      database.select().from(payments),
      database.select().from(documents).where(eq(documents.entityType, "supplier_contract")),
    ]);
    return contracts.map(({ contract, supplierName }) => {
      const relatedInvoices = invoiceRows.filter(invoice => invoice.supplierContractId === contract.id);
      const paidAmount = relatedInvoices.reduce((sum, invoice) => sum + paymentRows.filter(payment => payment.invoiceId === invoice.id).reduce((subtotal, payment) => subtotal + Number(payment.amount), 0), 0);
      const billedAmount = relatedInvoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
      return { ...contract, supplierName, billedAmount, paidAmount, outstandingAmount: Math.max(0, billedAmount - paidAmount), invoices: relatedInvoices, attachedDocuments: documentRows.filter(document => document.entityId === contract.id) };
    });
  }),

  createSupplierContract: protectedProcedure.input(supplierContractInput).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.write");
    const database = await requireDatabase();
    const [supplier] = await database.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, input.supplierId));
    if (!supplier) throw new TRPCError({ code: "NOT_FOUND", message: "Fornecedor não encontrado." });
    await validateFinancialEntity(database, input.companyId, input.fiscalEntityId);
    if (input.endsOn && input.endsOn < input.startsOn) throw new TRPCError({ code: "BAD_REQUEST", message: "A vigência final não pode ser anterior ao início do contrato." });
    const billingStart = input.billingStartsOn || input.startsOn;
    const billingEnd = input.billingEndsOn || input.endsOn;
    const billingRecurrence = input.billingMode === "single" ? "one_time" : input.billingRecurrence;
    const periods = buildBillingPeriods(billingStart, billingEnd, billingRecurrence, input.paymentDay);
    for (const item of input.items) {
      if (item.kind === "product" && !item.stockItemId) throw new TRPCError({ code: "BAD_REQUEST", message: "Vincule o produto ao estoque nos itens de produto do contrato." });
    }
    const itemsTotal = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const amountPerBilling = itemsTotal > 0 ? itemsTotal : input.expectedAmount;
    return database.transaction(async tx => {
      const [created] = await tx.insert(supplierContracts).values({
        supplierId: input.supplierId,
        companyId: input.companyId || null,
        fiscalEntityId: input.fiscalEntityId || null,
        purchaseOrderCode: input.purchaseOrderCode || null,
        contractType: input.contractType,
        objectDescription: input.objectDescription || null,
        signatureDate: input.signatureDate || null,
        contractCode: input.contractCode || null,
        billingNames: input.billingNames,
        startsOn: input.startsOn,
        endsOn: input.endsOn || null,
        termMonths: input.termMonths || null,
        recurrence: input.recurrence,
        billingMode: input.billingMode,
        billingRecurrence,
        billingStartsOn: billingStart,
        billingEndsOn: billingEnd || null,
        autoRenew: input.autoRenew,
        paymentDay: input.paymentDay || null,
        expectedAmount: input.expectedAmount.toFixed(2),
        paymentMethod: input.paymentMethod || null,
        bankName: input.bankName || null,
        bankBranch: input.bankBranch || null,
        bankAccount: input.bankAccount || null,
        bankHolder: input.bankHolder || null,
        pixKey: input.pixKey || null,
        status: input.status,
        notes: input.notes || null,
      }).returning();
      if (input.items.length) {
        await tx.insert(supplierContractItems).values(input.items.map(item => ({
          supplierContractId: created.id,
          kind: item.kind,
          description: item.description,
          quantity: item.quantity.toFixed(2),
          unit: item.unit,
          unitPrice: item.unitPrice.toFixed(2),
          totalAmount: (item.quantity * item.unitPrice).toFixed(2),
          supplierOfferingId: item.supplierOfferingId || null,
          stockItemId: item.stockItemId || null,
          mediaServiceCatalogId: item.mediaServiceCatalogId || null,
          subserviceTypeId: item.subserviceTypeId || null,
          productTypeId: item.productTypeId || null,
          operationType: item.operationType || null,
          operationId: item.operationId || null,
        })));
      }
      await tx.insert(financeBillings).values(periods.map(period => ({
        source: "contract" as const,
        supplierContractId: created.id,
        purchaseOrderId: null,
        companyId: input.companyId || null,
        fiscalEntityId: input.fiscalEntityId || null,
        billingCode: `CTR-${created.id}-${period.sequence}`,
        sequence: period.sequence,
        competenceStart: period.competenceStart,
        competenceEnd: period.competenceEnd,
        dueDate: period.dueDate,
        amount: amountPerBilling.toFixed(2),
        status: "planned" as const,
        description: input.objectDescription || input.contractType,
        notes: null,
      })));
      await writeAuditLog({ actorUserId: ctx.user.id, entityType: "supplier_contract", entityId: created.id, action: "create", afterData: { ...created, billingCount: periods.length, itemCount: input.items.length } });
      return created;
    });
  }),

  operationForecasts: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "finance.read");
    const database = await requireDatabase();
    const [actionRows, eventRows, mediaCampaignRows, actionSupplierRows, eventSupplierRows, supplierRows] = await Promise.all([
      database.select({ id: actions.id, name: actions.name, startsAt: actions.scheduledFor, estimatedCost: actions.estimatedCost }).from(actions).orderBy(asc(actions.scheduledFor)),
      database.select({ id: events.id, name: events.name, startsAt: events.startsAt, estimatedCost: events.estimatedCost }).from(events).orderBy(asc(events.startsAt)),
      database.select({ id: mediaCampaigns.id, name: mediaCampaigns.name, startsOn: mediaCampaigns.startsOn, estimatedCost: mediaCampaigns.estimatedCost, supplierId: mediaPoints.supplierId }).from(mediaCampaigns).innerJoin(mediaPoints, eq(mediaCampaigns.mediaPointId, mediaPoints.id)).orderBy(asc(mediaCampaigns.startsOn)),
      database.select().from(actionSuppliers),
      database.select().from(eventSuppliers),
      database.select({ id: suppliers.id, displayName: suppliers.displayName }).from(suppliers),
    ]);
    const supplierDetails = (supplierId: number) => {
      const supplier = supplierRows.find(row => row.id === supplierId);
      return { id: supplierId, name: supplier?.displayName ?? "Fornecedor não localizado" };
    };
    const result = [
      ...actionRows.map(row => ({ ...row, type: "action" as const, label: `Ação · ${row.name}`, suppliers: actionSupplierRows.filter(link => link.actionId === row.id).map(link => supplierDetails(link.supplierId)) })),
      ...eventRows.map(row => ({ ...row, type: "event" as const, label: `Evento · ${row.name}`, suppliers: eventSupplierRows.filter(link => link.eventId === row.id).map(link => supplierDetails(link.supplierId)) })),
      ...mediaCampaignRows.map(row => ({ id: row.id, name: row.name, startsAt: new Date(`${row.startsOn}T12:00:00.000Z`), estimatedCost: row.estimatedCost, type: "media_campaign" as const, label: `Mídia · ${row.name}`, suppliers: [supplierDetails(row.supplierId)] })),
    ];
    return result.filter(row => Number(row.estimatedCost) > 0).sort((first, second) => first.startsAt.getTime() - second.startsAt.getTime());
  }),

  financeDimensions: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "finance.read");
    const database = await requireDatabase();
    const [companies, divisions, sectors, mediums, accounts, offerings, stock, fiscalEntities, regionalsList, subservices, catalog, products] = await Promise.all([
      database.select().from(financeCompanies).where(eq(financeCompanies.active, true)).orderBy(asc(financeCompanies.name)),
      database.select().from(financeDivisions).where(eq(financeDivisions.active, true)).orderBy(asc(financeDivisions.name)),
      database.select().from(financeSectors).where(eq(financeSectors.active, true)).orderBy(asc(financeSectors.name)),
      database.select().from(financeMediums).where(eq(financeMediums.active, true)).orderBy(asc(financeMediums.name)),
      database.select().from(financeAccounts).where(eq(financeAccounts.active, true)).orderBy(asc(financeAccounts.name)),
      database.select({ offering: supplierOfferings, supplierName: suppliers.displayName }).from(supplierOfferings).innerJoin(suppliers, eq(supplierOfferings.supplierId, suppliers.id)).where(eq(supplierOfferings.active, true)).orderBy(asc(supplierOfferings.name)),
      database.select().from(stockItems).where(eq(stockItems.active, true)).orderBy(asc(stockItems.name)),
      database.select({ fiscalEntity: providerFiscalEntities, providerName: providers.name }).from(providerFiscalEntities).innerJoin(providers, eq(providerFiscalEntities.providerId, providers.id)).where(eq(providerFiscalEntities.active, true)).orderBy(asc(providers.name), asc(providerFiscalEntities.name)),
      database.select().from(regionals).where(eq(regionals.active, true)).orderBy(asc(regionals.name)),
      database.select().from(subserviceTypes).where(eq(subserviceTypes.active, true)).orderBy(asc(subserviceTypes.name)),
      database.select({ catalog: mediaServiceCatalog, mediaTypeName: mediaTypes.name, serviceName: serviceTypes.name, subserviceName: subserviceTypes.name }).from(mediaServiceCatalog).innerJoin(mediaTypes, eq(mediaServiceCatalog.mediaTypeId, mediaTypes.id)).innerJoin(serviceTypes, eq(mediaServiceCatalog.serviceTypeId, serviceTypes.id)).innerJoin(subserviceTypes, eq(mediaServiceCatalog.subserviceTypeId, subserviceTypes.id)).where(eq(mediaServiceCatalog.active, true)).orderBy(asc(mediaTypes.name), asc(serviceTypes.name), asc(subserviceTypes.name)),
      database.select().from(productTypes).where(eq(productTypes.active, true)).orderBy(asc(productTypes.name)),
    ]);
    return { companies, divisions, sectors, mediums, accounts, offerings, stock, fiscalEntities, regionals: regionalsList, subservices, catalog, products };
  }),

  budgetSnapshot: protectedProcedure.input(z.object({ year: z.number().int().min(2020).max(2200) })).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.read");
    const database = await requireDatabase();
    const [plans, lineRows] = await Promise.all([
      database.select().from(financeBudgetPlans).where(eq(financeBudgetPlans.year, input.year)).orderBy(asc(financeBudgetPlans.createdAt)),
      database.select({ line: financeBudgetLines, month: financeBudgetMonths }).from(financeBudgetLines).innerJoin(financeBudgetPlans, eq(financeBudgetLines.planId, financeBudgetPlans.id)).leftJoin(financeBudgetMonths, eq(financeBudgetMonths.budgetLineId, financeBudgetLines.id)).where(eq(financeBudgetPlans.year, input.year)).orderBy(asc(financeBudgetLines.id), asc(financeBudgetMonths.month)),
    ]);
    const lines = lineRows.reduce<Array<typeof financeBudgetLines.$inferSelect & { months: typeof financeBudgetMonths.$inferSelect[] }>>((result, row) => {
      const current = result.find(item => item.id === row.line.id);
      if (current) {
        if (row.month) current.months.push(row.month);
      } else {
        result.push({ ...row.line, months: row.month ? [row.month] : [] });
      }
      return result;
    }, []);
    return { plans, lines };
  }),

  createBudgetPlan: protectedProcedure.input(z.object({ year: z.number().int().min(2020).max(2200), name: z.string().trim().min(2).max(180), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.write");
    const database = await requireDatabase();
    const [created] = await database.insert(financeBudgetPlans).values({ ...input, notes: input.notes || null, createdByUserId: ctx.user.id }).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "finance_budget_plan", entityId: created.id, action: "create", afterData: created });
    return created;
  }),

  upsertBudgetLine: protectedProcedure.input(z.object({
    lineId: z.number().int().positive().optional(),
    planId: z.number().int().positive(),
    companyId: z.number().int().positive().nullable().optional(),
    fiscalEntityId: z.number().int().positive().nullable().optional(),
    regionalId: z.number().int().positive().nullable().optional(),
    supplierId: z.number().int().positive().nullable().optional(),
    divisionId: z.number().int().positive().nullable().optional(),
    sectorId: z.number().int().positive().nullable().optional(),
    mediumId: z.number().int().positive().nullable().optional(),
    accountId: z.number().int().positive().nullable().optional(),
    allocationRule: z.string().trim().max(40).default("manual"),
    percentage: z.number().min(0).max(100).nullable().optional(),
    months: z.array(z.number().min(0).max(100_000_000)).length(12),
    notes: z.string().trim().max(2000).optional(),
  })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.write");
    const database = await requireDatabase();
    await validateFinancialEntity(database, input.companyId, input.fiscalEntityId);
    const annualAmount = input.months.reduce((sum, amount) => sum + amount, 0).toFixed(2);
    const lineValues = {
      planId: input.planId,
      companyId: input.companyId || null,
      fiscalEntityId: input.fiscalEntityId || null,
      regionalId: input.regionalId || null,
      supplierId: input.supplierId || null,
      divisionId: input.divisionId || null,
      sectorId: input.sectorId || null,
      mediumId: input.mediumId || null,
      accountId: input.accountId || null,
      allocationRule: input.allocationRule,
      percentage: input.percentage === null || input.percentage === undefined ? null : input.percentage.toFixed(4),
      annualAmount,
      notes: input.notes || null,
      updatedAt: new Date(),
    };
    return database.transaction(async tx => {
      let lineId = input.lineId;
      if (lineId) {
        const [existing] = await tx.update(financeBudgetLines).set(lineValues).where(eq(financeBudgetLines.id, lineId)).returning();
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Linha orçamentária não encontrada." });
        await tx.delete(financeBudgetMonths).where(eq(financeBudgetMonths.budgetLineId, lineId));
      } else {
        const [created] = await tx.insert(financeBudgetLines).values(lineValues).returning();
        lineId = created.id;
      }
      await tx.insert(financeBudgetMonths).values(input.months.map((amount, index) => ({ budgetLineId: lineId!, month: index + 1, plannedAmount: amount.toFixed(2) })));
      return { lineId, annualAmount };
    });
  }),

  listPurchaseOrders: protectedProcedure.input(z.object({ status: z.enum(["draft", "pending_approval", "approved", "rejected", "partially_received", "received", "cancelled"]).optional() }).optional()).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.read");
    const database = await requireDatabase();
    const rows = await database.select({ order: purchaseOrders, supplierName: suppliers.displayName }).from(purchaseOrders).innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id)).where(input?.status ? eq(purchaseOrders.status, input.status) : undefined).orderBy(asc(purchaseOrders.requestedAt));
    const items = await database.select().from(purchaseOrderItems);
    return rows.map(row => ({ ...row.order, supplierName: row.supplierName, items: items.filter(item => item.purchaseOrderId === row.order.id) }));
  }),

  createPurchaseOrder: protectedProcedure.input(z.object({
    orderNumber: z.string().trim().min(1).max(100),
    supplierId: z.number().int().positive(),
    budgetPlanId: z.number().int().positive().nullable().optional(),
    companyId: z.number().int().positive().nullable().optional(),
    fiscalEntityId: z.number().int().positive().nullable().optional(),
    divisionId: z.number().int().positive().nullable().optional(),
    sectorId: z.number().int().positive().nullable().optional(),
    mediumId: z.number().int().positive().nullable().optional(),
    expectedDeliveryOn: z.string().date().nullable().optional(),
    billingMode: z.enum(["single", "recurring"]).default("single"),
    billingRecurrence: z.enum(["one_time", "weekly", "biweekly", "monthly", "bimonthly", "quarterly", "semiannual", "annual"]).default("one_time"),
    billingStartsOn: z.string().date().nullable().optional(),
    billingEndsOn: z.string().date().nullable().optional(),
    paymentDay: z.number().int().min(1).max(31).nullable().optional(),
    notes: z.string().trim().max(3000).optional(),
    items: z.array(financeItemInput).min(1),
  })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.write");
    const database = await requireDatabase();
    await validateFinancialEntity(database, input.companyId, input.fiscalEntityId);
    const supplier = await database.select({ id: suppliers.id }).from(suppliers).where(eq(suppliers.id, input.supplierId));
    if (!supplier.length) throw new TRPCError({ code: "NOT_FOUND", message: "Fornecedor não encontrado." });
    const totalAmount = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const billingMode = input.billingMode;
    const billingRecurrence = billingMode === "single" ? "one_time" : input.billingRecurrence;
    const billingStart = input.billingStartsOn || input.expectedDeliveryOn || toDateString(new Date());
    const billingEnd = input.billingEndsOn || (billingMode === "single" ? billingStart : null);
    const periods = buildBillingPeriods(billingStart, billingEnd, billingRecurrence, input.paymentDay);
    for (const item of input.items) {
      if (item.kind === "product" && !item.stockItemId) throw new TRPCError({ code: "BAD_REQUEST", message: "Vincule o produto ao estoque nos itens de produto do pedido." });
    }
    return database.transaction(async tx => {
      const [created] = await tx.insert(purchaseOrders).values({
        orderNumber: input.orderNumber,
        supplierId: input.supplierId,
        budgetPlanId: input.budgetPlanId || null,
        companyId: input.companyId || null,
        fiscalEntityId: input.fiscalEntityId || null,
        divisionId: input.divisionId || null,
        sectorId: input.sectorId || null,
        mediumId: input.mediumId || null,
        expectedDeliveryOn: input.expectedDeliveryOn || null,
        billingMode,
        billingRecurrence,
        billingStartsOn: input.billingStartsOn || null,
        billingEndsOn: input.billingEndsOn || null,
        paymentDay: input.paymentDay || null,
        notes: input.notes || null,
        totalAmount: totalAmount.toFixed(2),
        requestedByUserId: ctx.user.id,
      }).returning();
      await tx.insert(purchaseOrderItems).values(input.items.map(item => ({
        purchaseOrderId: created.id,
        kind: item.kind,
        description: item.description,
        quantity: item.quantity.toFixed(2),
        unit: item.unit,
        unitPrice: item.unitPrice.toFixed(2),
        totalAmount: (item.quantity * item.unitPrice).toFixed(2),
        supplierOfferingId: item.supplierOfferingId || null,
        stockItemId: item.stockItemId || null,
        mediaServiceCatalogId: item.mediaServiceCatalogId || null,
        subserviceTypeId: item.subserviceTypeId || null,
        productTypeId: item.productTypeId || null,
        operationType: item.operationType || null,
        operationId: item.operationId || null,
      })));
      await tx.insert(financeBillings).values(periods.map(period => ({
        source: "purchase_order" as const,
        supplierContractId: null,
        purchaseOrderId: created.id,
        companyId: input.companyId || null,
        fiscalEntityId: input.fiscalEntityId || null,
        billingCode: `OC-${created.id}-${period.sequence}`,
        sequence: period.sequence,
        competenceStart: period.competenceStart,
        competenceEnd: period.competenceEnd,
        dueDate: period.dueDate,
        amount: (totalAmount / periods.length).toFixed(2),
        status: "planned" as const,
        description: `Ordem de compra ${input.orderNumber}`,
        notes: null,
      })));
      await writeAuditLog({ actorUserId: ctx.user.id, entityType: "purchase_order", entityId: created.id, action: "create", afterData: { ...created, billingCount: periods.length, itemCount: input.items.length } });
      return created;
    });
  }),

  reviewPurchaseOrder: protectedProcedure.input(z.object({ purchaseOrderId: z.number().int().positive(), status: z.enum(["approved", "rejected", "cancelled"]) })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.update");
    const database = await requireDatabase();
    const [existing] = await database.select().from(purchaseOrders).where(eq(purchaseOrders.id, input.purchaseOrderId));
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Pedido de compra não encontrado." });
    const [updated] = await database.update(purchaseOrders).set({ status: input.status, approvedByUserId: input.status === "approved" ? ctx.user.id : existing.approvedByUserId, approvedAt: input.status === "approved" ? new Date() : existing.approvedAt, updatedAt: new Date() }).where(eq(purchaseOrders.id, input.purchaseOrderId)).returning();
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "purchase_order", entityId: updated.id, action: `status_${input.status}`, beforeData: existing, afterData: updated });
    return updated;
  }),

  cashAnalysis: protectedProcedure.input(z.object({ year: z.number().int().min(2020).max(2200), month: z.number().int().min(1).max(12).optional() })).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.read");
    const database = await requireDatabase();
    const [budgetRows, orders, invoiceRows, paymentRows] = await Promise.all([
      database.select({ month: financeBudgetMonths.month, amount: financeBudgetMonths.plannedAmount }).from(financeBudgetMonths).innerJoin(financeBudgetLines, eq(financeBudgetMonths.budgetLineId, financeBudgetLines.id)).innerJoin(financeBudgetPlans, eq(financeBudgetLines.planId, financeBudgetPlans.id)).where(eq(financeBudgetPlans.year, input.year)),
      database.select().from(purchaseOrders),
      database.select().from(invoices),
      database.select().from(payments),
    ]);
    const monthly = Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const planned = budgetRows.filter(row => row.month === month).reduce((sum, row) => sum + Number(row.amount), 0);
      const monthOrders = orders.filter(order => order.status !== "cancelled" && order.status !== "rejected" && new Date(order.expectedDeliveryOn || order.requestedAt).getUTCFullYear() === input.year && new Date(order.expectedDeliveryOn || order.requestedAt).getUTCMonth() + 1 === month);
      const committed = monthOrders.reduce((sum, order) => sum + Number(order.totalAmount), 0);
      const monthInvoices = invoiceRows.filter(invoice => new Date(`${invoice.dueDate}T12:00:00Z`).getUTCFullYear() === input.year && new Date(`${invoice.dueDate}T12:00:00Z`).getUTCMonth() + 1 === month);
      const realized = monthInvoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
      const paid = paymentRows.filter(payment => payment.paidAt.getUTCFullYear() === input.year && payment.paidAt.getUTCMonth() + 1 === month).reduce((sum, payment) => sum + Number(payment.amount), 0);
      return { month, planned, committed, realized, paid, pending: Math.max(0, realized - paid), balance: planned - Math.max(committed, realized) };
    });
    return input.month ? monthly[input.month - 1] : { monthly, totals: monthly.reduce((result, item) => ({ planned: result.planned + item.planned, committed: result.committed + item.committed, realized: result.realized + item.realized, paid: result.paid + item.paid, pending: result.pending + item.pending, balance: result.balance + item.balance }), { planned: 0, committed: 0, realized: 0, paid: 0, pending: 0, balance: 0 }) };
  }),

  receiveInvoiceItem: protectedProcedure.input(z.object({ invoiceItemId: z.number().int().positive(), quantity: z.number().positive(), occurredAt: z.coerce.date(), reference: z.string().trim().max(120).optional(), notes: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.write");
    const database = await requireDatabase();
    return database.transaction(async tx => {
      const [item] = await tx.select().from(invoiceItems).where(eq(invoiceItems.id, input.invoiceItemId));
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "Item da nota fiscal não encontrado." });
      if (item.kind !== "product" || !item.stockItemId) throw new TRPCError({ code: "BAD_REQUEST", message: "Somente itens de produto vinculados ao estoque podem ser recebidos." });
      const remaining = Number(item.quantity) - Number(item.receivedQuantity);
      if (input.quantity > remaining + 0.0001) throw new TRPCError({ code: "BAD_REQUEST", message: "A quantidade recebida excede o saldo do item." });
      const stockItem = await tx.select({ id: stockItems.id }).from(stockItems).where(eq(stockItems.id, item.stockItemId));
      if (!stockItem.length) throw new TRPCError({ code: "NOT_FOUND", message: "Item de estoque não encontrado." });
      await tx.insert(stockMovements).values({ stockItemId: item.stockItemId, movementType: "entry", quantity: input.quantity.toFixed(2), unitCost: item.unitPrice, occurredAt: input.occurredAt, reference: input.reference || `NF item ${item.id}`, notes: input.notes || null, performedByUserId: ctx.user.id });
      await tx.insert(stockBalances).values({ stockItemId: item.stockItemId, quantity: input.quantity.toFixed(2), updatedAt: new Date() }).onConflictDoUpdate({ target: stockBalances.stockItemId, set: { quantity: sql`${stockBalances.quantity} + ${input.quantity.toFixed(2)}`, updatedAt: new Date() } });
      const [updated] = await tx.update(invoiceItems).set({ receivedQuantity: (Number(item.receivedQuantity) + input.quantity).toFixed(2) }).where(eq(invoiceItems.id, item.id)).returning();
      return updated;
    });
  }),

  listBillings: protectedProcedure.input(z.object({
    year: z.number().int().min(2020).max(2200).optional(),
    month: z.number().int().min(1).max(12).optional(),
    status: z.enum(["planned", "awaiting_invoice", "invoiced", "partially_paid", "paid", "overdue", "cancelled"]).optional(),
    source: z.enum(["contract", "purchase_order", "manual"]).optional(),
    supplierId: z.number().int().positive().optional(),
    companyId: z.number().int().positive().optional(),
    fiscalEntityId: z.number().int().positive().optional(),
  }).optional()).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.read");
    const database = await requireDatabase();
    const [billingRows, invoiceRows, paymentRows, contractRows, orderRows] = await Promise.all([
      database.select().from(financeBillings).orderBy(asc(financeBillings.dueDate), asc(financeBillings.sequence)),
      database.select().from(invoices),
      database.select().from(payments),
      database.select({ id: supplierContracts.id, supplierId: supplierContracts.supplierId, contractCode: supplierContracts.contractCode, supplierName: suppliers.displayName }).from(supplierContracts).innerJoin(suppliers, eq(supplierContracts.supplierId, suppliers.id)),
      database.select({ id: purchaseOrders.id, supplierId: purchaseOrders.supplierId, orderNumber: purchaseOrders.orderNumber, supplierName: suppliers.displayName }).from(purchaseOrders).innerJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id)),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const result = billingRows.map(billing => {
      const invoice = invoiceRows.find(row => row.billingId === billing.id);
      const paidAmount = invoice ? paymentRows.filter(payment => payment.invoiceId === invoice.id).reduce((sum, payment) => sum + Number(payment.amount), 0) : 0;
      const contractRecord = billing.source === "contract" ? contractRows.find(row => row.id === billing.supplierContractId) : undefined;
      const orderRecord = billing.source === "purchase_order" ? orderRows.find(row => row.id === billing.purchaseOrderId) : undefined;
      const sourceRecord = contractRecord || orderRecord;
      const status = invoice ? (invoice.status === "paid" ? "paid" : paidAmount > 0 ? "partially_paid" : deriveInvoiceStatus("invoiced", invoice.dueDate, today)) : deriveInvoiceStatus(billing.status, billing.dueDate, today);
      return { ...billing, status, invoice: invoice || null, totalPaid: paidAmount, outstandingAmount: Math.max(0, Number(billing.amount) - paidAmount), supplierId: sourceRecord?.supplierId || invoice?.supplierId || null, supplierName: sourceRecord?.supplierName || null, sourceReference: contractRecord?.contractCode || orderRecord?.orderNumber || null };
    }).filter(row => !input?.year || row.dueDate.startsWith(`${input.year}-`)).filter(row => !input?.month || Number(row.dueDate.slice(5, 7)) === input.month).filter(row => !input?.status || row.status === input.status).filter(row => !input?.source || row.source === input.source).filter(row => !input?.supplierId || row.supplierId === input.supplierId).filter(row => !input?.companyId || row.companyId === input.companyId).filter(row => !input?.fiscalEntityId || row.fiscalEntityId === input.fiscalEntityId);
    return result;
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
    const [invoiceRows, paymentRows, documentRows, itemRows, operations] = await Promise.all([
      database.select({ invoice: invoices, supplierName: suppliers.displayName }).from(invoices).innerJoin(suppliers, eq(invoices.supplierId, suppliers.id)).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(invoices.dueDate)),
      database.select().from(payments),
      database.select().from(documents).where(eq(documents.entityType, "invoice")),
      database.select().from(invoiceItems),
      operationCatalog(database),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const result = invoiceRows.map(({ invoice, supplierName }) => {
      const totalPaid = paymentRows.filter(payment => payment.invoiceId === invoice.id).reduce((total, payment) => total + Number(payment.amount), 0);
      const attachedDocuments = documentRows.filter(document => document.entityId === invoice.id);
      const items = itemRows.filter(item => item.invoiceId === invoice.id);
      const operation = operations.find(row => row.type === invoice.operationType && row.id === invoice.operationId);
      const status = deriveInvoiceStatus(invoice.status, invoice.dueDate, today);
      return { ...invoice, status, supplierName, totalPaid, outstandingAmount: Math.max(0, Number(invoice.amount) - totalPaid), operationLabel: operation?.label ?? (invoice.operationType === "other" ? "Outra operação" : null), attachedDocuments, items };
    });
    return input?.status ? result.filter(invoice => invoice.status === input.status) : result;
  }),

  createInvoice: protectedProcedure.input(z.object({ supplierId: z.number().int().positive(), supplierContractId: z.number().int().positive().nullable().optional(), billingId: z.number().int().positive().nullable().optional(), companyId: z.number().int().positive().nullable().optional(), fiscalEntityId: z.number().int().positive().nullable().optional(), invoiceNumber: z.string().trim().min(1).max(80), issueDate: z.string().date(), dueDate: z.string().date(), amount: z.number().positive().max(10_000_000), operationType: z.enum(["media_campaign", "action", "event", "other"]).nullable(), operationId: z.number().int().positive().nullable(), notes: z.string().trim().max(2000).optional(), items: z.array(z.object({ kind: z.enum(["product", "service", "media", "other"]), description: z.string().trim().min(1).max(240), quantity: z.number().positive(), unit: z.string().trim().min(1).max(40), unitPrice: z.number().min(0), mediaServiceCatalogId: z.number().int().positive().nullable().optional(), subserviceTypeId: z.number().int().positive().nullable().optional(), productTypeId: z.number().int().positive().nullable().optional(), stockItemId: z.number().int().positive().nullable().optional() })).optional() })).mutation(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "finance.write");
    const database = await requireDatabase();
    await validateFinancialEntity(database, input.companyId, input.fiscalEntityId);
    if (input.operationType === null && input.operationId !== null) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione o tipo da operação vinculada." });
    if (["media_campaign", "action", "event"].includes(input.operationType ?? "") && input.operationId === null) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione a operação vinculada à nota fiscal." });
    if (input.operationType === "other" && input.operationId !== null) throw new TRPCError({ code: "BAD_REQUEST", message: "Uma operação genérica não deve apontar para uma entidade específica." });
    if (input.operationId && input.operationType) {
      const operations = await operationCatalog(database);
      if (!operations.some(row => row.type === input.operationType && row.id === input.operationId)) throw new TRPCError({ code: "NOT_FOUND", message: "A operação selecionada não foi encontrada." });
    }
    if (input.supplierContractId) {
      const [contract] = await database.select().from(supplierContracts).where(eq(supplierContracts.id, input.supplierContractId));
      if (!contract || contract.supplierId !== input.supplierId) throw new TRPCError({ code: "BAD_REQUEST", message: "O contrato informado não pertence ao fornecedor da nota fiscal." });
    }
    if (input.billingId) {
      const [billing] = await database.select().from(financeBillings).where(eq(financeBillings.id, input.billingId));
      if (!billing) throw new TRPCError({ code: "NOT_FOUND", message: "Competência financeira não encontrada." });
      if (billing.supplierContractId && input.supplierContractId !== billing.supplierContractId) throw new TRPCError({ code: "BAD_REQUEST", message: "A competência não pertence ao contrato informado." });
      if (billing.companyId && input.companyId !== billing.companyId) throw new TRPCError({ code: "BAD_REQUEST", message: "A competência não pertence à empresa operacional informada." });
      if (billing.fiscalEntityId && input.fiscalEntityId !== billing.fiscalEntityId) throw new TRPCError({ code: "BAD_REQUEST", message: "A competência não pertence à empresa fiscal informada." });
    }
    const items = input.items ?? [];
    for (const item of items) {
      if (item.kind === "product" && !item.stockItemId) throw new TRPCError({ code: "BAD_REQUEST", message: "Vincule o produto a um item de estoque antes de salvar a nota." });
      if (item.stockItemId) {
        const [stockItem] = await database.select({ id: stockItems.id }).from(stockItems).where(eq(stockItems.id, item.stockItemId));
        if (!stockItem) throw new TRPCError({ code: "NOT_FOUND", message: "Item de estoque não encontrado." });
      }
    }
    return database.transaction(async tx => {
      const [created] = await tx.insert(invoices).values({ supplierId: input.supplierId, supplierContractId: input.supplierContractId || null, billingId: input.billingId || null, companyId: input.companyId || null, fiscalEntityId: input.fiscalEntityId || null, invoiceNumber: input.invoiceNumber, issueDate: input.issueDate, dueDate: input.dueDate, amount: input.amount.toFixed(2), operationType: input.operationType, operationId: input.operationId, notes: input.notes || null }).returning();
      if (items.length) {
        await tx.insert(invoiceItems).values(items.map(item => ({ invoiceId: created.id, kind: item.kind, description: item.description, quantity: item.quantity.toFixed(2), unit: item.unit, unitPrice: item.unitPrice.toFixed(2), totalAmount: (item.quantity * item.unitPrice).toFixed(2), mediaServiceCatalogId: item.mediaServiceCatalogId || null, subserviceTypeId: item.subserviceTypeId || null, productTypeId: item.productTypeId || null, stockItemId: item.stockItemId || null })));
      }
      if (input.billingId) {
        await tx.update(financeBillings).set({ status: "invoiced", updatedAt: new Date() }).where(eq(financeBillings.id, input.billingId));
      }
      await writeAuditLog({ actorUserId: ctx.user.id, entityType: "invoice", entityId: created.id, action: "create", afterData: { ...created, itemCount: items.length } });
      return created;
    });
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
    if (invoice.billingId) {
      await database.update(financeBillings).set({ status: nextStatus === "paid" ? "paid" : "partially_paid", updatedAt: new Date() }).where(eq(financeBillings.id, invoice.billingId));
    }
    await writeAuditLog({ actorUserId: ctx.user.id, entityType: "payment", entityId: created.id, action: "create", afterData: created });
    return { payment: created, invoiceStatus: nextStatus };
  }),
});
