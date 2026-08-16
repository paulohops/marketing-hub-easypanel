import { createContext, useContext, useEffect } from "react";
import {
  DEFAULT_APP_BRANDING,
  getBrandingFont,
  type AppBranding,
} from "@shared/branding";
import { trpc } from "@/lib/trpc";

type BrandingContextValue = {
  branding: AppBranding;
  isLoading: boolean;
};

const BrandingContext = createContext<BrandingContextValue>({
  branding: DEFAULT_APP_BRANDING,
  isLoading: false,
});

function applyBranding(branding: AppBranding) {
  const root = document.documentElement;
  const font = getBrandingFont(branding.fontFamily);
  const cssVariables: Record<string, string> = {
    "--app-primary": branding.primaryColor,
    "--app-accent": branding.accentColor,
    "--app-background": branding.backgroundColor,
    "--app-dark-background": branding.darkBackgroundColor,
    "--app-card": branding.cardColor,
    "--app-foreground": branding.foregroundColor,
    "--app-font-family": `"${font.family}"`,
  };

  Object.entries(cssVariables).forEach(([name, value]) =>
    root.style.setProperty(name, value)
  );
  document.title = branding.appSubtitle
    ? `${branding.appName} — ${branding.appSubtitle}`
    : branding.appName;

  let fontLink = document.getElementById(
    "app-branding-font"
  ) as HTMLLinkElement | null;
  if (!fontLink) {
    fontLink = document.createElement("link");
    fontLink.id = "app-branding-font";
    fontLink.rel = "stylesheet";
    document.head.appendChild(fontLink);
  }
  fontLink.href = `https://fonts.googleapis.com/css2?family=${font.googleFamily}&display=swap`;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const query = trpc.settings.branding.useQuery(undefined, { retry: false });
  const branding = query.data ?? DEFAULT_APP_BRANDING;

  useEffect(() => {
    applyBranding(branding);
  }, [branding]);

  return (
    <BrandingContext.Provider value={{ branding, isLoading: query.isLoading }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
