import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft,
  Share2,
  KeyRound,
  Save,
  CheckCircle2,
  Copy,
  Info,
  ExternalLink,
  Shield,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";

export default function SocialApiSettingsWorkspace() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const settingsQuery = trpc.social.getApiSettings.useQuery();
  const saveMutation = trpc.social.updateApiSettings.useMutation({
    onSuccess: () => {
      utils.social.getApiSettings.invalidate();
      toast.success("Credenciais de API salvas com sucesso!");
    },
    onError: err => {
      toast.error(err.message || "Erro ao salvar credenciais.");
    },
  });

  const [form, setForm] = useState({
    metaAppId: "",
    metaAppSecret: "",
    metaRedirectUri: "",

    linkedinClientId: "",
    linkedinClientSecret: "",
    linkedinRedirectUri: "",

    tiktokClientKey: "",
    tiktokClientSecret: "",
    tiktokRedirectUri: "",

    googleBusinessClientId: "",
    googleBusinessClientSecret: "",
    googleBusinessApiKey: "",
    googleBusinessRedirectUri: "",
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(prev => ({
        ...prev,
        ...settingsQuery.data,
      }));
    }
  }, [settingsQuery.data]);

  const updateField = (key: keyof typeof form, val: string) => {
    setForm(prev => ({ ...prev, [key]: val }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  const defaultRedirectUri = typeof window !== "undefined"
    ? `${window.location.origin}/api/oauth/social/callback`
    : "https://seu-dominio/api/oauth/social/callback";

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <Button
        type="button"
        variant="outline"
        className="border-border"
        onClick={() => setLocation("/configuracoes")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para Configurações
      </Button>

      {/* Header */}
      <div className="flex gap-4 border-b border-border pb-6">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white shadow-sm">
          <Share2 className="h-6 w-6" />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
            Integrações & Social Media
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">
            Chaves de API das Redes Sociais
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Cadastre as chaves dos aplicativos oficiais de desenvolvedor (Meta, LinkedIn, TikTok e Google Meu Negócio).
            Todas as chaves são salvas no banco de dados e persistem em deploys no Easypanel.
          </p>
        </div>
      </div>

      {/* Quick Setup Card */}
      <Card className="border-border bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            URI de Redirecionamento Recomendada
          </CardTitle>
          <CardDescription>
            Configure esta URL no painel de desenvolvedores de cada plataforma como URL de redirecionamento OAuth autorizada:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 bg-muted/60 p-2.5 rounded-lg border border-border">
            <code className="text-xs text-foreground font-mono flex-1 select-all break-all">
              {form.metaRedirectUri || defaultRedirectUri}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(form.metaRedirectUri || defaultRedirectUri)}
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs by Platform */}
      <Tabs defaultValue="meta" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1">
          <TabsTrigger value="meta" className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-pink-500" />
            Meta (Insta & FB)
          </TabsTrigger>
          <TabsTrigger value="linkedin" className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-600" />
            LinkedIn
          </TabsTrigger>
          <TabsTrigger value="tiktok" className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-neutral-900 dark:bg-white" />
            TikTok
          </TabsTrigger>
          <TabsTrigger value="google" className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Google Negócios
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Meta (Instagram + Facebook) */}
        <TabsContent value="meta" className="space-y-4 pt-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  Meta for Developers (Instagram Business & Facebook Pages)
                </span>
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  Abrir Meta Portal <ExternalLink className="h-3 w-3" />
                </a>
              </CardTitle>
              <CardDescription>
                Utilizado para publicação automática de Reels, Carrossel, Imagens e leitura de métricas e alcance no Instagram e Páginas do Facebook.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="meta-app-id">Meta App ID</Label>
                <Input
                  id="meta-app-id"
                  placeholder="Ex: 1048291049281"
                  value={form.metaAppId}
                  onChange={e => updateField("metaAppId", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="meta-app-secret">Meta App Secret</Label>
                <Input
                  id="meta-app-secret"
                  type="password"
                  placeholder="Deixe em branco para manter"
                  value={form.metaAppSecret}
                  onChange={e => updateField("metaAppSecret", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="meta-redirect-uri">Redirect URI personalizada</Label>
                <Input
                  id="meta-redirect-uri"
                  placeholder={defaultRedirectUri}
                  value={form.metaRedirectUri}
                  onChange={e => updateField("metaRedirectUri", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: LinkedIn */}
        <TabsContent value="linkedin" className="space-y-4 pt-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  LinkedIn Developer Portal
                </span>
                <a
                  href="https://www.linkedin.com/developers/apps"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  Abrir LinkedIn Portal <ExternalLink className="h-3 w-3" />
                </a>
              </CardTitle>
              <CardDescription>
                Permite agendar posts para páginas de empresas (Company Pages) e perfis profissionais, além de colher métricas de impressões e engajamento.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="li-client-id">Client ID</Label>
                <Input
                  id="li-client-id"
                  placeholder="Ex: 78xkz..."
                  value={form.linkedinClientId}
                  onChange={e => updateField("linkedinClientId", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="li-client-secret">Client Secret</Label>
                <Input
                  id="li-client-secret"
                  type="password"
                  placeholder="Deixe em branco para manter"
                  value={form.linkedinClientSecret}
                  onChange={e => updateField("linkedinClientSecret", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="li-redirect-uri">Redirect URI</Label>
                <Input
                  id="li-redirect-uri"
                  placeholder={defaultRedirectUri}
                  value={form.linkedinRedirectUri}
                  onChange={e => updateField("linkedinRedirectUri", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: TikTok */}
        <TabsContent value="tiktok" className="space-y-4 pt-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  TikTok for Developers
                </span>
                <a
                  href="https://developers.tiktok.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  Abrir TikTok Portal <ExternalLink className="h-3 w-3" />
                </a>
              </CardTitle>
              <CardDescription>
                Habilita o Content Posting API para postagem direta de vídeos no feed ou envio para aprovação nos rascunhos do aplicativo TikTok.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="tt-client-key">Client Key</Label>
                <Input
                  id="tt-client-key"
                  placeholder="Ex: aw89x7..."
                  value={form.tiktokClientKey}
                  onChange={e => updateField("tiktokClientKey", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="tt-client-secret">Client Secret</Label>
                <Input
                  id="tt-client-secret"
                  type="password"
                  placeholder="Deixe em branco para manter"
                  value={form.tiktokClientSecret}
                  onChange={e => updateField("tiktokClientSecret", e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="tt-redirect-uri">Redirect URI</Label>
                <Input
                  id="tt-redirect-uri"
                  placeholder={defaultRedirectUri}
                  value={form.tiktokRedirectUri}
                  onChange={e => updateField("tiktokRedirectUri", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Google Meu Negócio */}
        <TabsContent value="google" className="space-y-4 pt-4">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  Google Cloud Console (Business Profile API)
                </span>
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  Abrir Google Console <ExternalLink className="h-3 w-3" />
                </a>
              </CardTitle>
              <CardDescription>
                Utilizado para gerenciar múltiplos locais, atualizar horários de funcionamento, postar novidades/ofertas e coletar métricas de ligações e rotas.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="gbp-client-id">Google Client ID</Label>
                <Input
                  id="gbp-client-id"
                  placeholder="Ex: 123456789-abc.apps.googleusercontent.com"
                  value={form.googleBusinessClientId}
                  onChange={e => updateField("googleBusinessClientId", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="gbp-client-secret">Google Client Secret</Label>
                <Input
                  id="gbp-client-secret"
                  type="password"
                  placeholder="Deixe em branco para manter"
                  value={form.googleBusinessClientSecret}
                  onChange={e => updateField("googleBusinessClientSecret", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="gbp-api-key">Google API Key (Opcional)</Label>
                <Input
                  id="gbp-api-key"
                  type="password"
                  placeholder="Deixe em branco para manter"
                  value={form.googleBusinessApiKey}
                  onChange={e => updateField("googleBusinessApiKey", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="gbp-redirect-uri">Redirect URI</Label>
                <Input
                  id="gbp-redirect-uri"
                  placeholder={defaultRedirectUri}
                  value={form.googleBusinessRedirectUri}
                  onChange={e => updateField("googleBusinessRedirectUri", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end pt-4">
        <Button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate(form)}
          className="px-6"
        >
          <Save className="mr-2 h-4 w-4" />
          {saveMutation.isPending ? "Salvando..." : "Salvar Chaves de API"}
        </Button>
      </div>
    </div>
  );
}
