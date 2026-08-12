import { asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { actionDebriefs, actions, actionSuppliers, actionTypes, cities, eventSuppliers, eventTypes, events, mediaCampaigns, mediaPoints, mediaTypes, regionals, suppliers } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

async function requireDatabase() { const database = await getDb(); if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." }); return database; }

export const mapRouter = router({
  locations: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "dashboard.read");
    const database = await requireDatabase();
    const [pointRows, actionRows, eventRows, campaignRows, actionSupplierRows, eventSupplierRows] = await Promise.all([
      database.select({ point: mediaPoints, cityName: cities.name, regionalName: regionals.name, supplierName: suppliers.displayName, typeName: mediaTypes.name }).from(mediaPoints).innerJoin(cities, eq(mediaPoints.cityId, cities.id)).innerJoin(regionals, eq(cities.regionalId, regionals.id)).innerJoin(suppliers, eq(mediaPoints.supplierId, suppliers.id)).innerJoin(mediaTypes, eq(mediaPoints.mediaTypeId, mediaTypes.id)).orderBy(asc(mediaPoints.name)),
      database.select({ action: actions, cityName: cities.name, regionalName: regionals.name, typeName: actionTypes.name, debrief: actionDebriefs }).from(actions).innerJoin(cities, eq(actions.cityId, cities.id)).innerJoin(regionals, eq(cities.regionalId, regionals.id)).innerJoin(actionTypes, eq(actions.actionTypeId, actionTypes.id)).leftJoin(actionDebriefs, eq(actions.id, actionDebriefs.actionId)).orderBy(asc(actions.scheduledFor)),
      database.select({ event: events, cityName: cities.name, regionalName: regionals.name, typeName: eventTypes.name }).from(events).innerJoin(cities, eq(events.cityId, cities.id)).innerJoin(regionals, eq(cities.regionalId, regionals.id)).innerJoin(eventTypes, eq(events.eventTypeId, eventTypes.id)).orderBy(asc(events.startsAt)),
      database.select().from(mediaCampaigns),
      database.select({ actionId: actionSuppliers.actionId, supplierName: suppliers.displayName }).from(actionSuppliers).innerJoin(suppliers, eq(actionSuppliers.supplierId, suppliers.id)),
      database.select({ eventId: eventSuppliers.eventId, supplierName: suppliers.displayName }).from(eventSuppliers).innerJoin(suppliers, eq(eventSuppliers.supplierId, suppliers.id)),
    ]);
    return [
      ...pointRows.filter(({ point }) => point.latitude !== null && point.longitude !== null).map(({ point, cityName, regionalName, supplierName, typeName }) => ({ id: point.id, kind: "media" as const, label: point.name, cityName, regionalName, latitude: Number(point.latitude), longitude: Number(point.longitude), status: point.status, supplierNames: [supplierName], typeName, address: point.address, date: null, resultAchieved: null, campaign: campaignRows.find(campaign => campaign.mediaPointId === point.id && campaign.status === "active") ?? null })),
      ...actionRows.filter(({ action }) => action.latitude !== null && action.longitude !== null).map(({ action, cityName, regionalName, typeName, debrief }) => ({ id: action.id, kind: "action" as const, label: action.name, cityName, regionalName, latitude: Number(action.latitude), longitude: Number(action.longitude), status: action.status, supplierNames: actionSupplierRows.filter(row => row.actionId === action.id).map(row => row.supplierName), typeName, address: action.address, date: action.scheduledFor, resultAchieved: debrief?.resultAchieved ?? null, campaign: null })),
      ...eventRows.filter(({ event }) => event.latitude !== null && event.longitude !== null).map(({ event, cityName, regionalName, typeName }) => ({ id: event.id, kind: "event" as const, label: event.name, cityName, regionalName, latitude: Number(event.latitude), longitude: Number(event.longitude), status: event.status, supplierNames: eventSupplierRows.filter(row => row.eventId === event.id).map(row => row.supplierName), typeName, address: event.address, date: event.startsAt, resultAchieved: event.resultAchieved, campaign: null })),
    ];
  }),
});
