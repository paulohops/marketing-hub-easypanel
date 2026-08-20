import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { actionDebriefs, actionSuppliers, actions, cities, eventSuppliers, events, invoices, mediaCampaigns, mediaPoints, payments, regionals, suppliers } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => typeof value === "number");
  return valid.length ? Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(1)) : null;
}

async function requireDatabase() {
  const database = await getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  return database;
}

const analyticsInput = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  regionalId: z.number().int().positive().optional(),
  cityId: z.number().int().positive().optional(),
  status: z.string().optional(),
}).optional();

type AnalyticsInput = z.infer<typeof analyticsInput>;

function isStatusMatch(status: string | null | undefined, input: AnalyticsInput) {
  return !input?.status || input.status === "all" || status === input.status;
}

function isDateInPeriod(value: string | Date | null | undefined, input: AnalyticsInput) {
  if (!input?.startDate && !input?.endDate) return true;
  if (!value) return false;
  const date = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  return (!input.startDate || date >= input.startDate) && (!input.endDate || date <= input.endDate);
}

function overlapsPeriod(start: string | Date | null | undefined, end: string | Date | null | undefined, input: AnalyticsInput) {
  if (!input?.startDate && !input?.endDate) return true;
  const startDate = start ? String(start instanceof Date ? start.toISOString() : start).slice(0, 10) : "0000-01-01";
  const endDate = end ? String(end instanceof Date ? end.toISOString() : end).slice(0, 10) : "9999-12-31";
  return (!input.startDate || endDate >= input.startDate) && (!input.endDate || startDate <= input.endDate);
}

export const analyticsRouter = router({
  overview: protectedProcedure.input(analyticsInput).query(async ({ ctx, input }) => {
    await assertPermission(ctx.user, "dashboard.read");
    const database = await requireDatabase();
    const [supplierRows, pointRows, campaignRows, actionRows, actionSupplierRows, debriefRows, eventRows, eventSupplierRows, invoiceRows, paymentRows, cityRows, regionalRows] = await Promise.all([
      database.select().from(suppliers),
      database.select().from(mediaPoints),
      database.select().from(mediaCampaigns),
      database.select().from(actions),
      database.select().from(actionSuppliers),
      database.select().from(actionDebriefs),
      database.select().from(events),
      database.select().from(eventSuppliers),
      database.select().from(invoices),
      database.select().from(payments),
      database.select().from(cities),
      database.select().from(regionals),
    ]);

    const cityById = new Map(cityRows.map(city => [city.id, city]));
    const regionalById = new Map(regionalRows.map(regional => [regional.id, regional]));
    const cityMatches = (cityId: number | null | undefined) => {
      const city = cityId ? cityById.get(cityId) : undefined;
      return (!input?.cityId || cityId === input.cityId) && (!input?.regionalId || city?.regionalId === input.regionalId);
    };
    const selectedPoints = pointRows.filter(point => cityMatches(point.cityId) && isStatusMatch(point.status, input) && overlapsPeriod(point.contractStartsOn, point.contractEndsOn, input));
    const selectedPointIds = new Set(selectedPoints.map(point => point.id));
    const selectedCampaigns = campaignRows.filter(campaign => selectedPointIds.has(campaign.mediaPointId) && isStatusMatch(campaign.status, input) && overlapsPeriod(campaign.startsOn, campaign.endsOn, input));
    const selectedCampaignIds = new Set(selectedCampaigns.map(campaign => campaign.id));
    const selectedActions = actionRows.filter(action => cityMatches(action.cityId) && isStatusMatch(action.status, input) && isDateInPeriod(action.scheduledFor, input));
    const selectedActionIds = new Set(selectedActions.map(action => action.id));
    const selectedEvents = eventRows.filter(event => cityMatches(event.cityId) && isStatusMatch(event.status, input) && isDateInPeriod(event.startsAt, input));
    const selectedEventIds = new Set(selectedEvents.map(event => event.id));
    const selectedDebriefs = debriefRows.filter(debrief => selectedActionIds.has(debrief.actionId));
    const selectedInvoices = invoiceRows.filter(invoice => isStatusMatch(invoice.status, input) && isDateInPeriod(invoice.issueDate, input));
    const paidByInvoice = new Map<number, number>();
    for (const payment of paymentRows) paidByInvoice.set(payment.invoiceId, (paidByInvoice.get(payment.invoiceId) ?? 0) + Number(payment.amount));
    const invoicedAmount = selectedInvoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
    const paidAmount = selectedInvoices.reduce((sum, invoice) => sum + (paidByInvoice.get(invoice.id) ?? 0), 0);
    const outstandingAmount = Math.max(invoicedAmount - paidAmount, 0);
    const estimatedCost = selectedCampaigns.reduce((sum, item) => sum + Number(item.estimatedCost), 0) + selectedActions.reduce((sum, item) => sum + Number(item.estimatedCost), 0) + selectedEvents.reduce((sum, item) => sum + Number(item.estimatedCost), 0);
    const debriefRate = selectedActions.length ? Math.round((selectedDebriefs.length / selectedActions.length) * 100) : 0;

    const cityAggregation = new Map<number, { cityId: number; cityName: string; regionalName: string; media: number; campaigns: number; actions: number; events: number; estimatedCost: number }>();
    const ensureCity = (cityId: number) => {
      const city = cityById.get(cityId);
      if (!city) return undefined;
      const existing = cityAggregation.get(cityId);
      if (existing) return existing;
      const row = { cityId, cityName: city.name, regionalName: regionalById.get(city.regionalId)?.name ?? "Sem regional", media: 0, campaigns: 0, actions: 0, events: 0, estimatedCost: 0 };
      cityAggregation.set(cityId, row);
      return row;
    };
    for (const point of selectedPoints) ensureCity(point.cityId)!.media += 1;
    for (const campaign of selectedCampaigns) { const cityId = mediaCampaigns ? pointRows.find(point => point.id === campaign.mediaPointId)?.cityId : undefined; if (cityId) { const row = ensureCity(cityId); if (row) { row.campaigns += 1; row.estimatedCost += Number(campaign.estimatedCost); } } }
    for (const action of selectedActions) { const row = ensureCity(action.cityId); if (row) { row.actions += 1; row.estimatedCost += Number(action.estimatedCost); } }
    for (const event of selectedEvents) { const row = ensureCity(event.cityId); if (row) { row.events += 1; row.estimatedCost += Number(event.estimatedCost); } }

    const supplierPerformance = supplierRows.map(supplier => {
      const invoiceIds = new Set(selectedInvoices.filter(invoice => invoice.supplierId === supplier.id).map(invoice => invoice.id));
      return {
        id: supplier.id,
        name: supplier.displayName,
        mediaPoints: selectedPoints.filter(point => point.supplierId === supplier.id).length,
        campaigns: selectedCampaigns.filter(campaign => pointRows.find(point => point.id === campaign.mediaPointId)?.supplierId === supplier.id).length,
        actions: actionSupplierRows.filter(link => link.supplierId === supplier.id && selectedActionIds.has(link.actionId)).length,
        events: eventSupplierRows.filter(link => link.supplierId === supplier.id && selectedEventIds.has(link.eventId)).length,
        invoicedAmount: selectedInvoices.filter(invoice => invoice.supplierId === supplier.id).reduce((sum, invoice) => sum + Number(invoice.amount), 0),
        paidAmount: selectedInvoices.filter(invoice => invoice.supplierId === supplier.id).reduce((sum, invoice) => sum + (paidByInvoice.get(invoice.id) ?? 0), 0),
      };
    }).filter(row => row.mediaPoints + row.campaigns + row.actions + row.events > 0).sort((a, b) => (b.mediaPoints + b.campaigns + b.actions + b.events) - (a.mediaPoints + a.campaigns + a.actions + a.events)).slice(0, 10);

    return {
      filters: input ?? {},
      summary: {
        mediaPoints: selectedPoints.length,
        activeMediaPoints: selectedPoints.filter(point => point.status === "active").length,
        campaigns: selectedCampaigns.length,
        activeCampaigns: selectedCampaigns.filter(campaign => campaign.status === "active").length,
        actions: selectedActions.length,
        completedActions: selectedActions.filter(action => action.status === "completed").length,
        events: selectedEvents.length,
        completedEvents: selectedEvents.filter(event => event.status === "completed").length,
        estimatedCost,
        invoicedAmount,
        paidAmount,
        outstandingAmount,
        debriefRate,
        averageActionRating: average(selectedDebriefs.map(debrief => debrief.rating)),
        averageEventRating: average(selectedEvents.map(event => event.rating)),
      },
      byModule: [
        { key: "media", label: "Mídias", total: selectedPoints.length, active: selectedPoints.filter(point => point.status === "active").length, cost: 0 },
        { key: "campaigns", label: "Veiculações", total: selectedCampaigns.length, active: selectedCampaigns.filter(campaign => campaign.status === "active").length, cost: selectedCampaigns.reduce((sum, item) => sum + Number(item.estimatedCost), 0) },
        { key: "actions", label: "Ações", total: selectedActions.length, active: selectedActions.filter(action => action.status === "in_progress" || action.status === "planned").length, cost: selectedActions.reduce((sum, item) => sum + Number(item.estimatedCost), 0) },
        { key: "events", label: "Eventos", total: selectedEvents.length, active: selectedEvents.filter(event => event.status === "in_progress" || event.status === "planned").length, cost: selectedEvents.reduce((sum, item) => sum + Number(item.estimatedCost), 0) },
      ],
      byCity: Array.from(cityAggregation.values()).sort((a, b) => (b.estimatedCost + b.campaigns + b.actions + b.events) - (a.estimatedCost + a.campaigns + a.actions + a.events)).slice(0, 10),
      supplierPerformance,
      media: { totalPoints: selectedPoints.length, activeCampaigns: selectedCampaigns.filter(campaign => campaign.status === "active").length, averageRating: average(selectedCampaigns.map(campaign => campaign.rating)) },
      actions: { total: selectedActions.length, completed: selectedActions.filter(action => action.status === "completed").length, debriefed: selectedDebriefs.length, averageRating: average(selectedDebriefs.map(debrief => debrief.rating)) },
      events: { total: selectedEvents.length, completed: selectedEvents.filter(event => event.status === "completed").length, averageRating: average(selectedEvents.map(event => event.rating)) },
      territories: regionalRows.filter(regional => !input?.regionalId || regional.id === input.regionalId).map(regional => ({ id: regional.id, name: regional.name })).filter(regional => Array.from(cityAggregation.values()).some(city => city.regionalName === regional.name)),
    };
  }),
});
