import "dotenv/config";
import { appLog } from "./logger";

const optionalEnvironmentVariables = [
  "OWNER_OPEN_ID",
  "TRELLO_API_KEY",
  "TRELLO_TOKEN",
  "TRELLO_BOARD_ID",
  "GOOGLE_MAPS_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "OPENAI_API_KEY",
  "BUILT_IN_FORGE_API_URL",
  "BUILT_IN_FORGE_API_KEY",
  "NOTIFICATION_WEBHOOK_URL",
  "NOTIFICATION_WEBHOOK_TOKEN",
] as const;

export const ENV = {
  appId: process.env.APP_ID ?? process.env.VITE_APP_ID ?? "trade-hub-standalone",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "",
  databaseSsl: process.env.DATABASE_SSL === "true",
  databasePoolMax: Number(process.env.DATABASE_POOL_MAX ?? 8),
  databaseSslRejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false",
  isProduction: process.env.NODE_ENV === "production",
  port: process.env.PORT ?? "3000",
  storageDir: process.env.STORAGE_DIR ?? "./data/storage",
  publicAppUrl: process.env.PUBLIC_APP_URL ?? "",

  // Integrações opcionais. A aplicação não depende delas para iniciar.
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  trelloApiKey: process.env.TRELLO_API_KEY ?? "",
  trelloToken: process.env.TRELLO_TOKEN ?? "",
  trelloBoardId: process.env.TRELLO_BOARD_ID ?? "",
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleRedirectUri: process.env.GOOGLE_REDIRECT_URI ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  builtInForgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  builtInForgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  notificationWebhookUrl: process.env.NOTIFICATION_WEBHOOK_URL ?? "",
  notificationWebhookToken: process.env.NOTIFICATION_WEBHOOK_TOKEN ?? "",
} as const;

function validatePort() {
  const port = Number.parseInt(ENV.port, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return `PORT inválida: ${ENV.port}`;
  }
  return null;
}

export function assertRuntimeEnvironment() {
  const missing: string[] = [];
  if (!ENV.databaseUrl) missing.push("DATABASE_URL");
  if (ENV.isProduction && !ENV.cookieSecret) missing.push("JWT_SECRET");
  const invalidPort = validatePort();

  if (missing.length > 0 || invalidPort) {
    const errors = [...missing.map(name => `Variável obrigatória ausente: ${name}`)];
    if (invalidPort) errors.push(invalidPort);
    throw new Error(errors.join("; "));
  }

  const missingOptional = optionalEnvironmentVariables.filter(name => {
    const value = process.env[name];
    return !value?.trim();
  });
  if (missingOptional.length > 0) {
    appLog("WARN", "Integrações ou configurações opcionais ausentes", {
      variables: missingOptional,
    });
  }
}
