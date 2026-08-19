import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranding } from "@/contexts/BrandingContext";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import {
  BRANDING_FONT_OPTIONS,
  DEFAULT_APP_BRANDING,
  getBrandingFont,
  type AppBranding,
  type BrandingTheme,
} from "@shared/branding";
import {
  ImagePlus,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  Type,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Não foi possível preparar a logo."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

const allowedLogoMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const allowedFaviconMimeTypes = ["image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/svg+xml"] as const;

function isHex(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}

export default function BrandingSettingsPanel() {
  const { branding } = useBranding();
  const { can } = useEffectivePermissions();
  const canWrite = can("settings.write");
  const utils = trpc.useUtils();
  const [form, setForm] = useState<AppBranding>(branding);
  const [editingTheme, setEditingTheme] = useState<"light" | "dark">("light");
  const activeTheme = form[editingTheme];

  useEffect(() => {
    setForm(branding);
  }, [branding]);

  const selectedFont = useMemo(
    () => getBrandingFont(form.fontFamily),
    [form.fontFamily]
  );
  const updateField = <K extends keyof AppBranding>(
    field: K,
    value: AppBranding[K]
  ) => {
    setForm(current => ({ ...current, [field]: value }));
  };
  const updateThemeField = <K extends keyof BrandingTheme>(
    field: K,
    value: BrandingTheme[K]
  ) => {
    setForm(current => ({
      ...current,
      [editingTheme]: { ...current[editingTheme], [field]: value },
    }));
  };
  const updateBranding = trpc.settings.updateBranding.useMutation({
    onSuccess: next => {
      setForm(next);
      utils.settings.branding.setData(undefined, next);
      toast.success("Identidade visual atualizada.");
    },
    onError: error => toast.error(error.message),
  });
  const uploadLogo = trpc.settings.uploadAppLogo.useMutation({
    onSuccess: next => {
      setForm(next);
      utils.settings.branding.setData(undefined, next);
      toast.success("Logo do aplicativo atualizada.");
    },
    onError: error => toast.error(error.message),
  });
  const uploadFavicon = trpc.settings.uploadAppFavicon.useMutation({
    onSuccess: next => {
      setForm(next);
      utils.settings.branding.setData(undefined, next);
      toast.success("Favicon atualizado.");
    },
    onError: error => toast.error(error.message),
  });
  const resetBranding = trpc.settings.resetBranding.useMutation({
    onSuccess: next => {
      setForm(next);
      utils.settings.branding.setData(undefined, next);
      toast.success("Identidade visual restaurada para o padrão.");
    },
    onError: error => toast.error(error.message),
  });

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !isHex(form.light.primaryColor) ||
      !isHex(form.light.accentColor) ||
      !isHex(form.light.backgroundColor) ||
      !isHex(form.light.cardColor) ||
      !isHex(form.light.foregroundColor) ||
      !isHex(form.dark.primaryColor) ||
      !isHex(form.dark.accentColor) ||
      !isHex(form.dark.backgroundColor) ||
      !isHex(form.dark.cardColor) ||
      !isHex(form.dark.foregroundColor)
    ) {
      toast.error(
        "Use o formato hexadecimal completo, como #0E723B, em todas as cores."
      );
      return;
    }
    updateBranding.mutate({
      appName: form.appName,
      appSubtitle: form.appSubtitle,
      light: form.light,
      dark: form.dark,
      primaryColor: form.light.primaryColor,
      accentColor: form.light.accentColor,
      backgroundColor: form.light.backgroundColor,
      darkBackgroundColor: form.dark.backgroundColor,
      cardColor: form.light.cardColor,
      foregroundColor: form.light.foregroundColor,
      fontFamily: form.fontFamily,
      faviconUrl: form.light.faviconUrl,
    });
  };

  const chooseFavicon = async (file: File | undefined) => {
    if (!file) return;
    if (!(allowedFaviconMimeTypes as readonly string[]).includes(file.type)) {
      toast.error("Envie um favicon PNG, ICO ou SVG.");
      return;
    }
    try {
      uploadFavicon.mutate({ originalName: file.name, mimeType: file.type as typeof allowedFaviconMimeTypes[number],         dataBase64: await fileToBase64(file),
        theme: editingTheme,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível preparar o favicon.");
    }
  };

  const chooseLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!(allowedLogoMimeTypes as readonly string[]).includes(file.type)) {
      toast.error("Envie uma logo JPEG, PNG ou WEBP.");
      return;
    }
    try {
      uploadLogo.mutate({
        originalName: file.name,
        mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
        dataBase64: await fileToBase64(file),
        theme: editingTheme,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível preparar a logo."
      );
    }
  };

  const restoreDefaults = () => {
    if (
      !window.confirm(
        "Restaurar nome, cores, fonte e logo padrão do aplicativo?"
      )
    )
      return;
    resetBranding.mutate();
  };

  const previewStyle = {
    "--preview-primary": activeTheme.primaryColor,
    "--preview-accent": activeTheme.accentColor,
    "--preview-background": activeTheme.backgroundColor,
    "--preview-dark-background": form.dark.backgroundColor,
    "--preview-card": activeTheme.cardColor,
    "--preview-foreground": activeTheme.foregroundColor,
    fontFamily: `"${selectedFont.family}", ui-sans-serif, system-ui, sans-serif`,
  } as React.CSSProperties;

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="border-b border-border sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Palette className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-[0.14em]">
              Identidade visual
            </span>
          </div>
          <CardTitle className="mt-2 font-display text-2xl">
            Design do aplicativo
          </CardTitle>
          <CardDescription className="mt-1 max-w-2xl">
            Personalize a marca que aparece no login, menu lateral, título da
            página e tutorial inicial. As cores são aplicadas aos tokens globais
            para manter o mesmo padrão em todos os módulos.
          </CardDescription>
        </div>
        {!canWrite && (
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Somente leitura
          </span>
        )}
      </CardHeader>
      <CardContent className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <form className="grid gap-5" onSubmit={save}>
          <section className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-foreground">
                Marca e tipografia
              </h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5 text-sm font-medium">
                <Label htmlFor="branding-app-name">Nome do aplicativo</Label>
                <Input
                  id="branding-app-name"
                  value={form.appName}
                  disabled={!canWrite}
                  maxLength={80}
                  onChange={event => updateField("appName", event.target.value)}
                  placeholder="MARKETING HUB"
                />
              </div>
              <div className="grid gap-1.5 text-sm font-medium">
                <Label htmlFor="branding-app-subtitle">
                  Subtítulo ou organização
                </Label>
                <Input
                  id="branding-app-subtitle"
                  value={form.appSubtitle}
                  disabled={!canWrite}
                  maxLength={80}
                  onChange={event =>
                    updateField("appSubtitle", event.target.value)
                  }
                  placeholder="CLUSTER MG"
                />
              </div>
            </div>
            <div className="grid gap-1.5 text-sm font-medium">
              <Label htmlFor="branding-font">Fonte principal</Label>
              <select
                id="branding-font"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                disabled={!canWrite}
                value={form.fontFamily}
                onChange={event =>
                  updateField(
                    "fontFamily",
                    event.target.value as AppBranding["fontFamily"]
                  )
                }
              >
                {BRANDING_FONT_OPTIONS.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                <div>
                  <h3 className="font-semibold text-foreground">Paletas por tema</h3>
                  <p className="text-xs text-muted-foreground">Cada tema possui cores, superfícies, logo e favicon independentes.</p>
                </div>
              </div>
              <div className="inline-flex rounded-lg border border-border bg-background p-1">
                {(["light", "dark"] as const).map(theme => (
                  <button
                    key={theme}
                    type="button"
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${editingTheme === theme ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                    onClick={() => setEditingTheme(theme)}
                  >
                    {theme === "light" ? "Tema claro" : "Tema escuro"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(
                [
                  "primaryColor",
                  "accentColor",
                  "backgroundColor",
                  "cardColor",
                  "foregroundColor",
                ] as const
              ).map(field => {
                const labels = {
                  primaryColor: "Cor primária",
                  accentColor: "Cor de destaque",
                  backgroundColor: "Fundo da aplicação",
                  cardColor: "Superfícies e cartões",
                  foregroundColor: "Texto principal",
                };
                return (
                  <div key={field} className="grid gap-1.5 text-sm font-medium">
                    <Label htmlFor={`branding-${editingTheme}-${field}`}>{labels[field]}</Label>
                    <div className="flex gap-2">
                      <input
                        aria-label={`Selecionar ${labels[field]} do tema ${editingTheme}`}
                        type="color"
                        value={isHex(activeTheme[field]) ? activeTheme[field] : DEFAULT_APP_BRANDING[editingTheme][field]}
                        disabled={!canWrite}
                        onChange={event => updateThemeField(field, event.target.value.toUpperCase())}
                        className="h-10 w-12 cursor-pointer rounded-md border border-input bg-background p-1 disabled:cursor-not-allowed"
                      />
                      <Input
                        id={`branding-${editingTheme}-${field}`}
                        value={activeTheme[field]}
                        disabled={!canWrite}
                        maxLength={7}
                        onChange={event => updateThemeField(field, event.target.value.toUpperCase())}
                        placeholder="#0E723B"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              A paleta do tema {editingTheme === "light" ? "claro" : "escuro"} é aplicada somente quando esse tema está ativo.
            </p>
          </section>

          <section className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-foreground">
                  Logo do aplicativo — {editingTheme === "light" ? "tema claro" : "tema escuro"}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  JPEG, PNG ou WEBP com até 3 MB. O arquivo é armazenado fora do
                  bundle da aplicação.
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-primary transition hover:bg-secondary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                <ImagePlus className="h-4 w-4" />
                {uploadLogo.isPending ? "Enviando…" : "Enviar nova logo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={!canWrite || uploadLogo.isPending}
                  onChange={event => {
                    void chooseLogo(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            <div className="flex min-h-20 items-center gap-4 rounded-xl border border-border bg-background p-3">
              <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-card p-2">
                <img
                  src={activeTheme.logoUrl}
                  alt={form.appName}
                  className="max-h-full max-w-full object-contain"
                />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {form.appName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {activeTheme.logoUrl === DEFAULT_APP_BRANDING[editingTheme].logoUrl
                    ? "Logo padrão"
                    : "Logo personalizada"}
                </p>
              </div>
            </div>
          </section>

          <section className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-foreground">Favicon do site — {editingTheme === "light" ? "tema claro" : "tema escuro"}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Use PNG, ICO ou SVG. O ícone será aplicado na aba do navegador.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-primary transition hover:bg-secondary has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                <ImagePlus className="h-4 w-4" />
                {uploadFavicon.isPending ? "Enviando…" : "Enviar favicon"}
                <input type="file" accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml" className="hidden" disabled={!canWrite || uploadFavicon.isPending} onChange={event => { void chooseFavicon(event.target.files?.[0]); event.currentTarget.value = ""; }} />
              </label>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
              <img src={activeTheme.faviconUrl || DEFAULT_APP_BRANDING[editingTheme].faviconUrl} alt="Favicon atual" className="h-10 w-10 rounded-lg border border-border bg-card object-contain p-1" />
              <div><p className="text-sm font-semibold text-foreground">Ícone da aba</p><p className="text-xs text-muted-foreground">{activeTheme.faviconUrl === DEFAULT_APP_BRANDING[editingTheme].faviconUrl ? "Favicon padrão" : "Favicon personalizado"}</p></div>
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!canWrite || resetBranding.isPending}
              onClick={restoreDefaults}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurar padrão
            </Button>
            <Button
              type="submit"
              disabled={!canWrite || updateBranding.isPending}
            >
              {updateBranding.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar identidade
            </Button>
          </div>
        </form>

        <aside className="lg:sticky lg:top-5 lg:self-start">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Pré-visualização
          </p>
          <div
            style={previewStyle}
            className="overflow-hidden rounded-2xl border border-border bg-[var(--preview-background)] shadow-sm"
          >
            <div className="flex items-center gap-2 bg-[var(--preview-primary)] p-3 text-white">
              <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-lg bg-[var(--preview-card)] p-1">
                <img
                  src={activeTheme.logoUrl}
                  alt=""
                  className="h-full w-full object-contain"
                />
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-xs">
                  {form.appName || "Nome do aplicativo"}
                </strong>
                <small className="block truncate text-[9px] uppercase tracking-[0.12em] text-white/75">
                  {form.appSubtitle || "Subtítulo"}
                </small>
              </span>
            </div>
            <div className="grid gap-3 p-3">
              <div className="rounded-xl border border-[color-mix(in_srgb,var(--preview-primary)_18%,white)] bg-[var(--preview-card)] p-3">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--preview-accent)]">
                  Operação
                </span>
                <strong className="mt-1 block text-sm text-[var(--preview-foreground)]">
                  Campanhas e ações
                </strong>
                <span className="mt-2 block h-2 w-24 rounded-full bg-[var(--preview-primary)]/20" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="h-10 rounded-lg bg-[var(--preview-primary)]" />
                <span className="h-10 rounded-lg bg-[var(--preview-accent)]" />
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            A prévia mostra a hierarquia visual usada pelo módulo de campanhas e
            ações: navegação, cartão, texto e destaque.
          </p>
        </aside>
      </CardContent>
    </Card>
  );
}
