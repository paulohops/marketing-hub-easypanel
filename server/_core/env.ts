import "dotenv/config";

export const ENV = {
  appId: process.env.APP_ID ?? process.env.VITE_APP_ID ?? "trade-hub-standalone",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  storageDir: process.env.STORAGE_DIR ?? "./data/storage",
  publicAppUrl: process.env.PUBLIC_APP_URL ?? "",

  // Integrações opcionais. A aplicação não depende delas para iniciar.
  trelloApiKey: process.env.TRELLO_API_KEY ?? "",
  trelloToken: process.env.TRELLO_TOKEN ?? "",
  trelloBoardId: process.env.TRELLO_BOARD_ID ?? "",
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  notificationWebhookUrl: process.env.NOTIFICATION_WEBHOOK_URL ?? "",
  notificationWebhookToken: process.env.NOTIFICATION_WEBHOOK_TOKEN ?? "",

};

export function assertRuntimeEnvironment() {
  const missing: string[] = [];
  if (!ENV.cookieSecret) missing.push("JWT_SECRET");
  if (ENV.isProduction && !ENV.databaseUrl) missing.push("DATABASE_URL");

  if (missing.length > 0) {
    throw new Error(`Variáveis obrigatórias ausentes: ${missing.join(", ")}`);
  }
}
