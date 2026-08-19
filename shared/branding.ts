export const BRANDING_FONT_OPTIONS = [
  {
    id: "montserrat",
    label: "Montserrat",
    family: "Montserrat",
    googleFamily:
      "Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500;1,600",
  },
  {
    id: "inter",
    label: "Inter",
    family: "Inter",
    googleFamily: "Inter:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500",
  },
  {
    id: "poppins",
    label: "Poppins",
    family: "Poppins",
    googleFamily: "Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500;1,600",
  },
  {
    id: "roboto",
    label: "Roboto",
    family: "Roboto",
    googleFamily: "Roboto:ital,wght@0,400;0,500;0,700;1,400;1,500",
  },
  {
    id: "nunito-sans",
    label: "Nunito Sans",
    family: "Nunito Sans",
    googleFamily:
      "Nunito+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400;1,500",
  },
] as const;

export type BrandingFontId = (typeof BRANDING_FONT_OPTIONS)[number]["id"];

export type BrandingTheme = {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  cardColor: string;
  foregroundColor: string;
  logoUrl: string;
  faviconUrl: string;
};

export type AppBranding = {
  appName: string;
  appSubtitle: string;
  fontFamily: BrandingFontId;
  light: BrandingTheme;
  dark: BrandingTheme;
  /** Campos legados mantidos para compatibilidade com integrações antigas. */
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  darkBackgroundColor: string;
  cardColor: string;
  foregroundColor: string;
  logoUrl: string;
  faviconUrl: string;
};

const DEFAULT_LIGHT_THEME: BrandingTheme = {
  primaryColor: "#0E723B",
  accentColor: "#F45103",
  backgroundColor: "#F7FAF7",
  cardColor: "#FFFFFF",
  foregroundColor: "#133523",
  logoUrl: "/brand/logo.svg",
  faviconUrl: "/favicon.ico",
};

const DEFAULT_DARK_THEME: BrandingTheme = {
  primaryColor: "#55C98A",
  accentColor: "#FF8A52",
  backgroundColor: "#07100A",
  cardColor: "#102117",
  foregroundColor: "#E7F5EB",
  logoUrl: "/brand/logo.svg",
  faviconUrl: "/favicon.ico",
};

export const DEFAULT_APP_BRANDING: AppBranding = {
  appName: "MARKETING HUB",
  appSubtitle: "CLUSTER MG",
  fontFamily: "montserrat",
  light: DEFAULT_LIGHT_THEME,
  dark: DEFAULT_DARK_THEME,
  primaryColor: DEFAULT_LIGHT_THEME.primaryColor,
  accentColor: DEFAULT_LIGHT_THEME.accentColor,
  backgroundColor: DEFAULT_LIGHT_THEME.backgroundColor,
  darkBackgroundColor: DEFAULT_DARK_THEME.backgroundColor,
  cardColor: DEFAULT_LIGHT_THEME.cardColor,
  foregroundColor: DEFAULT_LIGHT_THEME.foregroundColor,
  logoUrl: DEFAULT_LIGHT_THEME.logoUrl,
  faviconUrl: DEFAULT_LIGHT_THEME.faviconUrl,
};

export function getBrandingFont(fontFamily: BrandingFontId) {
  return (
    BRANDING_FONT_OPTIONS.find(option => option.id === fontFamily) ??
    BRANDING_FONT_OPTIONS[0]
  );
}

export function getBrandingTheme(
  branding: AppBranding,
  theme: "light" | "dark"
): BrandingTheme {
  return theme === "dark" ? branding.dark : branding.light;
}
