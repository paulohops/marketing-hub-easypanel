import { router } from "../_core/trpc";
import { settingsOverviewProcedure } from "./settingsOverview";
import { settingsBrandingProcedures } from "./settingsBranding";
import { settingsRegistryProcedures, getTrelloEmbedUrl, normalizeCnpj, normalizeTrelloUrl, normalizeWebsiteUrl, uniqueIds } from "./settingsRegistry";
import { settingsImportProcedures, normalizeSpreadsheetKey } from "./settingsImport";
import { normalizeAppBranding } from "./settingsBranding";

export { getTrelloEmbedUrl, normalizeAppBranding, normalizeCnpj, normalizeSpreadsheetKey, normalizeTrelloUrl, normalizeWebsiteUrl, uniqueIds };

export const settingsRouter = router({
  overview: settingsOverviewProcedure,
  ...settingsBrandingProcedures,
  ...settingsRegistryProcedures,
  ...settingsImportProcedures,
});
