import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { appSettings } from "../../drizzle/schema";
import { assertPermission } from "../authorization";
import { getDb } from "../db";
import { writeAuditLog } from "../audit";
import { storagePut } from "../storage";
import { publicProcedure, protectedProcedure } from "../_core/trpc";
import {
  BRANDING_FONT_OPTIONS,
  DEFAULT_APP_BRANDING,
  type AppBranding,
  type BrandingFontId,
} from "../../shared/branding";

const contractMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const imageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Informe uma cor no formato hexadecimal #RRGGBB.")
  .transform(value => value.toUpperCase());

async function requireDatabase() {
  const database = await getDb();
  if (!database) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível." });
  }
  return database;
}

const brandingFontIds = BRANDING_FONT_OPTIONS.map(option => option.id) as [
  BrandingFontId,
  ...BrandingFontId[],
];
const brandingThemeInputSchema = z.object({
  primaryColor: hexColorSchema,
  accentColor: hexColorSchema,
  backgroundColor: hexColorSchema,
  cardColor: hexColorSchema,
  foregroundColor: hexColorSchema,
  logoUrl: z.string().trim().max(1000).optional(),
  faviconUrl: z.string().trim().max(1000).optional(),
});

const brandingInputSchema = z.object({
  appName: z.string().trim().min(2).max(80),
  appSubtitle: z.string().trim().max(80),
  fontFamily: z.enum(brandingFontIds),
  light: brandingThemeInputSchema.partial().optional(),
  dark: brandingThemeInputSchema.partial().optional(),
  // Campos legados aceitos para que integrações antigas continuem funcionando.
  primaryColor: hexColorSchema.optional(),
  accentColor: hexColorSchema.optional(),
  backgroundColor: hexColorSchema.optional(),
  darkBackgroundColor: hexColorSchema.optional(),
  cardColor: hexColorSchema.optional(),
  foregroundColor: hexColorSchema.optional(),
  faviconUrl: z.string().trim().max(1000).optional(),
});

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function isBrandingFont(value: unknown): value is BrandingFontId {
  return (
    typeof value === "string" &&
    brandingFontIds.includes(value as BrandingFontId)
  );
}

export function normalizeAppBranding(value: unknown): AppBranding {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const appName =
    typeof source.appName === "string" && source.appName.trim().length >= 2
      ? source.appName.trim().slice(0, 80)
      : DEFAULT_APP_BRANDING.appName;
  const appSubtitle =
    typeof source.appSubtitle === "string"
      ? source.appSubtitle.trim().slice(0, 80)
      : DEFAULT_APP_BRANDING.appSubtitle;
  const sourceTheme = (key: "light" | "dark") => {
    const value = source[key];
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  };
  const isValidAssetUrl = (value: unknown) =>
    typeof value === "string" &&
    ((value.startsWith("/") && !value.startsWith("//")) ||
      /^https?:\/\//i.test(value));
  const normalizeTheme = (
    key: "light" | "dark",
    legacy: Record<string, unknown>
  ) => {
    const input = sourceTheme(key);
    const fallback = DEFAULT_APP_BRANDING[key];
    const color = (field: keyof typeof fallback) =>
      isHexColor(input[field])
        ? String(input[field]).toUpperCase()
        : isHexColor(legacy[field])
          ? String(legacy[field]).toUpperCase()
          : fallback[field];
    const asset = (field: "logoUrl" | "faviconUrl") =>
      isValidAssetUrl(input[field])
        ? String(input[field])
        : isValidAssetUrl(legacy[field])
          ? String(legacy[field])
          : fallback[field];
    return {
      primaryColor: color("primaryColor"),
      accentColor: color("accentColor"),
      backgroundColor: color("backgroundColor"),
      cardColor: color("cardColor"),
      foregroundColor: color("foregroundColor"),
      logoUrl: asset("logoUrl"),
      faviconUrl: asset("faviconUrl"),
    };
  };
  const light = normalizeTheme("light", source);
  const dark = normalizeTheme("dark", {
    ...source,
    backgroundColor: source.darkBackgroundColor,
  });
  const fontFamily = isBrandingFont(source.fontFamily)
    ? source.fontFamily
    : DEFAULT_APP_BRANDING.fontFamily;
  return {
    appName,
    appSubtitle,
    fontFamily,
    light,
    dark,
    primaryColor: light.primaryColor,
    accentColor: light.accentColor,
    backgroundColor: light.backgroundColor,
    darkBackgroundColor: dark.backgroundColor,
    cardColor: light.cardColor,
    foregroundColor: light.foregroundColor,
    logoUrl: light.logoUrl,
    faviconUrl: light.faviconUrl,
  };
}

function parseBrandingValue(value: string | null | undefined): AppBranding {
  if (!value) return DEFAULT_APP_BRANDING;
  try {
    return normalizeAppBranding(JSON.parse(value));
  } catch {
    return DEFAULT_APP_BRANDING;
  }
}

function safeBrandingName(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 160) || "logo-aplicativo"
  );
}
export const settingsBrandingProcedures = {
  branding: publicProcedure.query(async () => {
    const database = await getDb();
    if (!database) return DEFAULT_APP_BRANDING;
    const [setting] = await database
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "app_branding"))
      .limit(1);
    return parseBrandingValue(setting?.value);
  }),

  updateBranding: protectedProcedure
    .input(brandingInputSchema)
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [currentSetting] = await database
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "app_branding"))
        .limit(1);
      let current: AppBranding = DEFAULT_APP_BRANDING;
      if (currentSetting) current = parseBrandingValue(currentSetting.value);
      const next = normalizeAppBranding({ ...current, ...input });
      const [updated] = await database
        .insert(appSettings)
        .values({
          key: "app_branding",
          value: JSON.stringify(next),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: JSON.stringify(next), updatedAt: new Date() },
        })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "app_setting",
        entityId: 0,
        action: "update_branding",
        afterData: { ...next, logoUrl: Boolean(next.logoUrl) },
      });
      return parseBrandingValue(updated.value);
    }),

  uploadAppLogo: protectedProcedure
    .input(
      z.object({
        originalName: z.string().trim().min(1).max(255),
        mimeType: z.enum(imageMimeTypes),
        dataBase64: z.string().min(1).max(4_200_000),
        theme: z.enum(["light", "dark"]).default("light"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (!bytes.length || bytes.length > 3 * 1024 * 1024)
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "A logo do aplicativo deve ter até 3 MB.",
        });
      const stored = await storagePut(
        `trade/app-branding/logo-${Date.now()}-${safeBrandingName(input.originalName)}`,
        bytes,
        input.mimeType
      );
      const [currentSetting] = await database
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "app_branding"))
        .limit(1);
      const current = currentSetting
        ? parseBrandingValue(currentSetting.value)
        : DEFAULT_APP_BRANDING;
      const next = normalizeAppBranding({
        ...current,
        [input.theme]: { ...current[input.theme], logoUrl: stored.url },
      });
      const [updated] = await database
        .insert(appSettings)
        .values({
          key: "app_branding",
          value: JSON.stringify(next),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: JSON.stringify(next), updatedAt: new Date() },
        })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "app_setting",
        entityId: 0,
        action: "upload_branding_logo",
        afterData: { storageKey: stored.key },
      });
      return parseBrandingValue(updated.value);
    }),

  uploadAppFavicon: protectedProcedure
    .input(
      z.object({
        originalName: z.string().trim().min(1).max(255),
        mimeType: z.enum([
          "image/png",
          "image/x-icon",
          "image/vnd.microsoft.icon",
          "image/svg+xml",
        ]),
        dataBase64: z.string().min(1).max(1_500_000),
        theme: z.enum(["light", "dark"]).default("light"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const bytes = Buffer.from(input.dataBase64, "base64");
      if (!bytes.length || bytes.length > 1024 * 1024)
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: "O favicon deve ter até 1 MB.",
        });
      const stored = await storagePut(
        `trade/app-branding/favicon-${Date.now()}-${safeBrandingName(input.originalName)}`,
        bytes,
        input.mimeType
      );
      const [currentSetting] = await database
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "app_branding"))
        .limit(1);
      const current = currentSetting
        ? parseBrandingValue(currentSetting.value)
        : DEFAULT_APP_BRANDING;
      const next = normalizeAppBranding({
        ...current,
        [input.theme]: { ...current[input.theme], faviconUrl: stored.url },
      });
      const [updated] = await database
        .insert(appSettings)
        .values({
          key: "app_branding",
          value: JSON.stringify(next),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: JSON.stringify(next), updatedAt: new Date() },
        })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "app_setting",
        entityId: 0,
        action: "upload_branding_favicon",
        afterData: { storageKey: stored.key },
      });
      return parseBrandingValue(updated.value);
    }),

  resetBranding: protectedProcedure.mutation(async ({ ctx }) => {
    await assertPermission(ctx.user, "settings.write");
    const database = await requireDatabase();
    const [updated] = await database
      .insert(appSettings)
      .values({
        key: "app_branding",
        value: JSON.stringify(DEFAULT_APP_BRANDING),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: JSON.stringify(DEFAULT_APP_BRANDING),
          updatedAt: new Date(),
        },
      })
      .returning();
    await writeAuditLog({
      actorUserId: ctx.user.id,
      entityType: "app_setting",
      entityId: 0,
      action: "reset_branding",
      afterData: { restoredDefaults: true },
    });
    return parseBrandingValue(updated.value);
  }),

  system: protectedProcedure.query(async ({ ctx }) => {
    await assertPermission(ctx.user, "settings.read");
    const database = await requireDatabase();
    const [setting] = await database
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "app_system"))
      .limit(1);
    const source = setting?.value
      ? (JSON.parse(setting.value) as Record<string, unknown>)
      : {};
    return {
      smtpHost: typeof source.smtpHost === "string" ? source.smtpHost : "",
      smtpPort: typeof source.smtpPort === "string" ? source.smtpPort : "587",
      smtpUser: typeof source.smtpUser === "string" ? source.smtpUser : "",
      smtpPassword: "",
      smtpFrom: typeof source.smtpFrom === "string" ? source.smtpFrom : "",
      notificationEmailEnabled: source.notificationEmailEnabled === true,
      openAiApiKey: source.openAiApiKey ? "********" : "",
      googleMapsApiKey: source.googleMapsApiKey ? "********" : "",
      googleClientId:
        typeof source.googleClientId === "string" ? source.googleClientId : "",
      googleClientSecret: source.googleClientSecret ? "********" : "",
      googleRedirectUri:
        typeof source.googleRedirectUri === "string"
          ? source.googleRedirectUri
          : "",
      googleOAuthEnabled: source.googleOAuthEnabled === true,
      emailLoginCodeEnabled: source.emailLoginCodeEnabled === true,
    };
  }),

  updateSystem: protectedProcedure
    .input(
      z.object({
        smtpHost: z.string().trim().max(255),
        smtpPort: z.string().trim().max(8),
        smtpUser: z.string().trim().max(255),
        smtpPassword: z.string().max(500).optional(),
        smtpFrom: z.string().trim().email().or(z.literal("")),
        notificationEmailEnabled: z.boolean(),
        openAiApiKey: z.string().max(500).optional(),
        googleMapsApiKey: z.string().max(500).optional(),
        googleClientId: z.string().trim().max(500).optional(),
        googleClientSecret: z.string().max(500).optional(),
        googleRedirectUri: z.string().trim().max(1000).optional(),
        googleOAuthEnabled: z.boolean(),
        emailLoginCodeEnabled: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertPermission(ctx.user, "settings.write");
      const database = await requireDatabase();
      const [currentSetting] = await database
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "app_system"))
        .limit(1);
      let current: Record<string, unknown> = {};
      if (currentSetting?.value) {
        try {
          current = JSON.parse(currentSetting.value) as Record<string, unknown>;
        } catch {
          current = {};
        }
      }
      const next = {
        ...current,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpUser: input.smtpUser,
        smtpFrom: input.smtpFrom,
        notificationEmailEnabled: input.notificationEmailEnabled,
        ...(input.smtpPassword ? { smtpPassword: input.smtpPassword } : {}),
        ...(input.openAiApiKey && input.openAiApiKey !== "********"
          ? { openAiApiKey: input.openAiApiKey }
          : {}),
        ...(input.googleMapsApiKey && input.googleMapsApiKey !== "********"
          ? { googleMapsApiKey: input.googleMapsApiKey }
          : {}),
        ...(input.googleClientId
          ? { googleClientId: input.googleClientId }
          : {}),
        ...(input.googleClientSecret && input.googleClientSecret !== "********"
          ? { googleClientSecret: input.googleClientSecret }
          : {}),
        ...(input.googleRedirectUri
          ? { googleRedirectUri: input.googleRedirectUri }
          : {}),
        googleOAuthEnabled: input.googleOAuthEnabled,
        emailLoginCodeEnabled: input.emailLoginCodeEnabled,
      };
      const [updated] = await database
        .insert(appSettings)
        .values({
          key: "app_system",
          value: JSON.stringify(next),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSettings.key,
          set: { value: JSON.stringify(next), updatedAt: new Date() },
        })
        .returning();
      await writeAuditLog({
        actorUserId: ctx.user.id,
        entityType: "app_setting",
        entityId: 0,
        action: "update_system_settings",
        afterData: {
          smtpHost: next.smtpHost,
          smtpFrom: next.smtpFrom,
          notificationEmailEnabled: next.notificationEmailEnabled,
          hasApiKeys: Boolean(next.openAiApiKey || next.googleMapsApiKey),
        },
      });
      return {
        smtpHost: String(next.smtpHost ?? ""),
        smtpPort: String(next.smtpPort ?? "587"),
        smtpUser: String(next.smtpUser ?? ""),
        smtpPassword: "",
        smtpFrom: String(next.smtpFrom ?? ""),
        notificationEmailEnabled: next.notificationEmailEnabled === true,
        openAiApiKey: next.openAiApiKey ? "********" : "",
        googleMapsApiKey: next.googleMapsApiKey ? "********" : "",
        googleClientId: String(next.googleClientId ?? ""),
        googleClientSecret: next.googleClientSecret ? "********" : "",
        googleRedirectUri: String(next.googleRedirectUri ?? ""),
        googleOAuthEnabled: next.googleOAuthEnabled === true,
        emailLoginCodeEnabled: next.emailLoginCodeEnabled === true,
      };
    })
};
