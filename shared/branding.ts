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

export type AppBranding = {
  appName: string;
  appSubtitle: string;
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  darkBackgroundColor: string;
  cardColor: string;
  foregroundColor: string;
  fontFamily: BrandingFontId;
  logoUrl: string;
};

export const DEFAULT_APP_BRANDING: AppBranding = {
  appName: "MARKETING HUB",
  appSubtitle: "CLUSTER MG",
  primaryColor: "#0E723B",
  accentColor: "#F45103",
  backgroundColor: "#F7FAF7",
  darkBackgroundColor: "#07100A",
  cardColor: "#FFFFFF",
  foregroundColor: "#133523",
  fontFamily: "montserrat",
  logoUrl: "/brand/logo.svg",
};

export function getBrandingFont(fontFamily: BrandingFontId) {
  return (
    BRANDING_FONT_OPTIONS.find(option => option.id === fontFamily) ??
    BRANDING_FONT_OPTIONS[0]
  );
}
