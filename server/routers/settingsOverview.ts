import { asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  actionPoints,
  actions,
  actionSuppliers,
  actionTypes,
  cities,
  commercialSupervisorCities,
  commercialSupervisorStores,
  commercialSupervisors,
  eventSuppliers,
  eventTypes,
  events,
  financialCategories,
  mediaCampaigns,
  mediaPoints,
  mediaServiceCatalog,
  mediaTypes,
  neighborhoods,
  partners,
  productMediaTypes,
  productTypes,
  providerDocuments,
  providerFiscalEntities,
  providers,
  regionals,
  serviceSubservices,
  serviceTypeRelations,
  serviceTypes,
  stores,
  subserviceTypes,
  supplierOfferings,
  suppliers,
  campaignSectors,
  campaignTypes,
  stockCategories,
  financeCompanies,
} from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { getDb } from "../db";
import { protectedProcedure } from "../_core/trpc";

async function requireDatabase() {
  const database = await getDb();
  if (!database) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  }
  return database;
}

export const settingsOverviewProcedure = protectedProcedure.query(async ({ ctx }) => {
    try {
      await assertPermission(ctx.user, "settings.read");
    const database = await requireDatabase();
    const [
      providerRows,
      regionalRows,
      cityRows,
      neighborhoodRows,
      supplierRows,
      storeRows,
      partnerRows,
      serviceRows,
      serviceRelationRows,
      subserviceRows,
      serviceSubserviceRows,
      mediaServiceCatalogRows,
      mediaTypeRows,
      productTypeRows,
      actionTypeRows,
      eventTypeRows,
      campaignTypeRows,
      campaignSectorRows,
      financialCategoryRows,
      stockCategoryRows,
      financeCompanyRows,
      supplierOfferingRows,
      supervisorRows,
      actionPointRows,
      supervisorStoreRows,
      supervisorCityRows,
      productMediaRows,
      actionRows,
      eventRows,
      mediaPointRows,
      mediaCampaignRows,
      actionSupplierRows,
      eventSupplierRows,
      providerDocumentRows,
      fiscalEntityRows,
    ] = await Promise.all([
      database
        .select()
        .from(providers)
        .orderBy(asc(providers.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(regionals)
        .orderBy(asc(regionals.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(cities)
        .orderBy(asc(cities.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(neighborhoods)
        .orderBy(asc(neighborhoods.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(suppliers)
        .orderBy(asc(suppliers.displayName))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(stores)
        .orderBy(asc(stores.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(partners)
        .orderBy(asc(partners.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(serviceTypes)
        .orderBy(asc(serviceTypes.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(serviceTypeRelations)
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(subserviceTypes)
        .orderBy(asc(subserviceTypes.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(serviceSubservices)
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(mediaServiceCatalog)
        .where(eq(mediaServiceCatalog.active, true))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(mediaTypes)
        .orderBy(asc(mediaTypes.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(productTypes)
        .orderBy(asc(productTypes.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(actionTypes)
        .orderBy(asc(actionTypes.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(eventTypes)
        .orderBy(asc(eventTypes.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(campaignTypes)
        .orderBy(asc(campaignTypes.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(campaignSectors)
        .orderBy(asc(campaignSectors.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(financialCategories)
        .orderBy(asc(financialCategories.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(stockCategories)
        .orderBy(asc(stockCategories.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select({ id: financeCompanies.id, name: financeCompanies.name, code: financeCompanies.code, active: financeCompanies.active })
        .from(financeCompanies)
        .orderBy(asc(financeCompanies.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(supplierOfferings)
        .orderBy(asc(supplierOfferings.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(commercialSupervisors)
        .orderBy(asc(commercialSupervisors.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(actionPoints)
        .orderBy(asc(actionPoints.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(commercialSupervisorStores)
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(commercialSupervisorCities)
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(productMediaTypes)
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select({ id: actions.id, name: actions.name, cityId: actions.cityId })
        .from(actions)
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select({ id: events.id, name: events.name, cityId: events.cityId })
        .from(events)
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select({
          id: mediaPoints.id,
          name: mediaPoints.name,
          cityId: mediaPoints.cityId,
          supplierId: mediaPoints.supplierId,
        })
        .from(mediaPoints)
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select({ mediaPointId: mediaCampaigns.mediaPointId })
        .from(mediaCampaigns)
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select({
          actionId: actionSuppliers.actionId,
          supplierId: actionSuppliers.supplierId,
        })
        .from(actionSuppliers)
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select({
          eventId: eventSuppliers.eventId,
          supplierId: eventSuppliers.supplierId,
        })
        .from(eventSuppliers)
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(providerDocuments)
        .orderBy(asc(providerDocuments.createdAt))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
      database
        .select()
        .from(providerFiscalEntities)
        .orderBy(asc(providerFiscalEntities.name))
        .catch((error) => {
          console.error("[settings.overview] Falha ao carregar catálogo opcional; resultado parcial mantido.", error);
          return [];
        }),
    ]);
    return {
      providers: providerRows,
      regionals: regionalRows,
      cities: cityRows,
      neighborhoods: neighborhoodRows,
      suppliers: supplierRows,
      stores: storeRows,
      partners: partnerRows,
      serviceTypes: serviceRows,
      serviceTypeRelations: serviceRelationRows,
      subserviceTypes: subserviceRows,
      serviceSubservices: serviceSubserviceRows,
      mediaServiceCatalog: mediaServiceCatalogRows,
      mediaTypes: mediaTypeRows,
      productTypes: productTypeRows,
      actionTypes: actionTypeRows,
      eventTypes: eventTypeRows,
      campaignTypes: campaignTypeRows,
      campaignSectors: campaignSectorRows,
      financialCategories: financialCategoryRows,
      stockCategories: stockCategoryRows,
      financeCompanies: financeCompanyRows,
      supplierOfferings: supplierOfferingRows,
      commercialSupervisors: supervisorRows,
      actionPoints: actionPointRows,
      commercialSupervisorStores: supervisorStoreRows,
      commercialSupervisorCities: supervisorCityRows,
      productMediaTypes: productMediaRows,
      providerDocuments: providerDocumentRows,
      fiscalEntities: fiscalEntityRows,
      operationalFootprint: {
        actions: actionRows,
        events: eventRows,
        mediaPoints: mediaPointRows,
        mediaCampaigns: mediaCampaignRows,
        actionSuppliers: actionSupplierRows,
        eventSuppliers: eventSupplierRows,
      },
      };
    } catch (error) {
      console.error("[settings.overview] Falha ao carregar os catálogos de configurações.", error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível carregar os catálogos de configurações." });
    }
  });
