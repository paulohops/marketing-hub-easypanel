import { TRPCError } from "@trpc/server";
import { actionDebriefs, actionSuppliers, actions, eventSuppliers, events, invoices, mediaCampaigns, mediaPoints, payments, suppliers } from "../../drizzle/schema";
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

export const analyticsRouter = router({
  overview: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "dashboard.read");
    const database = await requireDatabase();
    const [supplierRows, pointRows, campaignRows, actionRows, actionSupplierRows, debriefRows, eventRows, eventSupplierRows, invoiceRows, paymentRows] = await Promise.all([
      database.select().from(suppliers), database.select().from(mediaPoints), database.select().from(mediaCampaigns), database.select().from(actions), database.select().from(actionSuppliers), database.select().from(actionDebriefs), database.select().from(events), database.select().from(eventSuppliers), database.select().from(invoices), database.select().from(payments),
    ]);
    const supplierPerformance = supplierRows.map(supplier => {
      const invoiceIds = new Set(invoiceRows.filter(invoice => invoice.supplierId === supplier.id).map(invoice => invoice.id));
      return {
        id: supplier.id,
        name: supplier.displayName,
        mediaPoints: pointRows.filter(point => point.supplierId === supplier.id).length,
        actions: actionSupplierRows.filter(link => link.supplierId === supplier.id).length,
        events: eventSupplierRows.filter(link => link.supplierId === supplier.id).length,
        invoicedAmount: invoiceRows.filter(invoice => invoice.supplierId === supplier.id).reduce((sum, invoice) => sum + Number(invoice.amount), 0),
        paidAmount: paymentRows.filter(payment => invoiceIds.has(payment.invoiceId)).reduce((sum, payment) => sum + Number(payment.amount), 0),
      };
    }).sort((a, b) => (b.mediaPoints + b.actions + b.events) - (a.mediaPoints + a.actions + a.events)).slice(0, 8);
    return {
      supplierPerformance,
      media: { totalPoints: pointRows.length, activeCampaigns: campaignRows.filter(campaign => campaign.status === "active").length, averageRating: average(campaignRows.map(campaign => campaign.rating)) },
      actions: { total: actionRows.length, completed: actionRows.filter(action => action.status === "completed").length, debriefed: debriefRows.length, averageRating: average(debriefRows.map(debrief => debrief.rating)) },
      events: { total: eventRows.length, completed: eventRows.filter(event => event.status === "completed").length, averageRating: average(eventRows.map(event => event.rating)) },
    };
  }),
});
