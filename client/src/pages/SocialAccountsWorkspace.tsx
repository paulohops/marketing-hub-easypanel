import { useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Edit2,
  ExternalLink,
  ShieldCheck,
  Building2,
  Share2,
  Info,
  HelpCircle,
  KeyRound,
} from "lucide-react";
import { WorkspaceHeader, WorkspaceShell, WorkspaceSection } from "@/components/WorkspaceChrome";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

type PlatformType = "instagram" | "facebook" | "linkedin" | "tiktok" | "google_business";

interface PlatformInfo {
  label: string;
  badgeClass: string;
  iconText: string;
  color: string;
  handleLabel: string;
  handlePlaceholder: string;
  extIdLabel: string;
  extIdPlaceholder: string;
  tokenLabel: string;
  instructions: string;
  docUrl: string;
}

const platformConfig: Record<PlatformType, PlatformInfo> = {
  instagram: {
    label: "Instagram Business",
    badgeClass: "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-none",
    iconText: "IG",
    color: "#E1306C",
    handleLabel: "Instagram Business Account ID ou @perfil",
    handlePlaceholder: "Ex: 17841400000000000 ou @onnettelecom",
    extIdLabel: "Facebook Page ID Vinculada",
    extIdPlaceholder: "Ex: 109283746501928",
    tokenLabel: "Page / User Access Token (Long-Lived)",
    instructions:
      "Necessita de uma conta Instagram Business vinculada a uma Página do Facebook. Permissões necessárias no Meta for Developers: instagram_basic, instagram_content_publish, pages_show_list, pages_read_engagement.",
    docUrl: "https://developers.facebook.com/docs/instagram-platform",
  },
  facebook: {
    label: "Facebook Page",
    badgeClass: "bg-blue-600 text-white border-none",
    iconText: "FB",
    color: "#1877F2",
    handleLabel: "Facebook Page ID",
    handlePlaceholder: "Ex: 109283746501928",
    extIdLabel: "Facebook App ID (Opcional)",
    extIdPlaceholder: "Ex: 987654321012345",
    tokenLabel: "Page Access Token da Página",
    instructions:
      "Utilize o Page Access Token gerado no Graph API Explorer selecionando a sua página. Permissões: pages_manage_posts, pages_read_engagement.",
    docUrl: "https://developers.facebook.com/tools/explorer",
  },
  linkedin: {
    label: "LinkedIn (Company Page)",
    badgeClass: "bg-sky-700 text-white border-none",
    iconText: "IN",
    color: "#0A66C2",
    handleLabel: "LinkedIn Organization URN ou ID",
    handlePlaceholder: "Ex: urn:li:organization:12345678 ou 12345678",
    extIdLabel: "Author URN (Opcional para perfil pessoal)",
    extIdPlaceholder: "Ex: urn:li:person:abcdef123",
    tokenLabel: "OAuth 2.0 Access Token",
    instructions:
      "Gere o token com os scopes w_member_social e w_organization_social na sua LinkedIn Developer App. O Organization ID está na URL da página da empresa no LinkedIn.",
    docUrl: "https://www.linkedin.com/developers/apps",
  },
  tiktok: {
    label: "TikTok (Comercial ou Criador)",
    badgeClass: "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-none",
    iconText: "TT",
    color: "#000000",
    handleLabel: "Nome de Usuário (@perfil) ou Open ID",
    handlePlaceholder: "Ex: @onnettelecom ou open_id_abc123",
    extIdLabel: "Client Key / App Key",
    extIdPlaceholder: "Ex: aw12345678abcdef",
    tokenLabel: "User Access Token (Content Posting API)",
    instructions:
      "Necessita de autorização OAuth na TikTok Content Posting API com o scope video.upload e video.publish.",
    docUrl: "https://developers.tiktok.com/",
  },
  google_business: {
    label: "Google Meu Negócio",
    badgeClass: "bg-amber-600 text-white border-none",
    iconText: "GMB",
    color: "#EA4335",
    handleLabel: "Google Location ID (Ficha da Unidade)",
    handlePlaceholder: "Ex: locations/1827364556473829",
    extIdLabel: "Google Account ID",
    extIdPlaceholder: "Ex: accounts/109283746501928",
    tokenLabel: "OAuth 2.0 Access Token (Google Business Profile API)",
    instructions:
      "Permite sincronizar dados da ficha, horários, fotos e coletar métricas de rotas, chamadas telefônicas e visitas ao site. Scope: https://www.googleapis.com/auth/business.manage.",
    docUrl: "https://developers.google.com/my-business",
  },
};

export default function SocialAccountsWorkspace() {
  const utils = trpc.useUtils();
  const accountsQuery = trpc.social.listAccounts.useQuery();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const [form, setForm] = useState<{
    platform: PlatformType;
    accountName: string;
    accountIdentifier: string;
    externalId: string;
    accessToken: string;
    refreshToken: string;
    avatarUrl: string;
    isActive: boolean;
  }>({
    platform: "instagram",
    accountName: "",
    accountIdentifier: "",
    externalId: "",
    accessToken: "",
    refreshToken: "",
    avatarUrl: "",
    isActive: true,
  });

  const createMutation = trpc.social.createAccount.useMutation({
    onSuccess: () => {
      utils.social.listAccounts.invalidate();
      setCreateModalOpen(false);
      resetForm();
      toast.success("Conta cadastrada e integrada com sucesso!");
    },
    onError: err => toast.error(err.message || "Erro ao cadastrar conta."),
  });

  const updateMutation = trpc.social.updateAccount.useMutation({
    onSuccess: () => {
      utils.social.listAccounts.invalidate();
      setEditingAccount(null);
      resetForm();
      toast.success("Conta atualizada com sucesso!");
    },
    onError: err => toast.error(err.message || "Erro ao atualizar conta."),
  });

  const deleteMutation = trpc.social.deleteAccount.useMutation({
    onSuccess: () => {
      utils.social.listAccounts.invalidate();
      setAccountToDelete(null);
      toast.success("Conta desconectada.");
    },
    onError: err => toast.error(err.message),
  });

  const testConnectionMutation = trpc.social.testConnection.useMutation();
  const syncAccountMutation = trpc.social.syncAccount.useMutation();
  const syncAllMutation = trpc.social.syncAllAccounts.useMutation({
    onSuccess: res => {
      utils.social.listAccounts.invalidate();
      toast.success(`Sincronização concluída: ${res.synced} de ${res.total} contas atualizadas.`);
    },
  });

  const resetForm = () => {
    setForm({
      platform: "instagram",
      accountName: "",
      accountIdentifier: "",
      externalId: "",
      accessToken: "",
      refreshToken: "",
      avatarUrl: "",
      isActive: true,
    });
  };

  const handleTestConnection = async (id: number) => {
    setTestingId(id);
    try {
      const res = await testConnectionMutation.mutateAsync({ id });
      if (res.success) {
        toast.success(`Conexão OK! ${res.message}`);
      } else {
        toast.error(`Falha na conexão: ${res.message}`);
      }
      utils.social.listAccounts.invalidate();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao testar conexão.");
    } finally {
      setTestingId(null);
    }
  };

  const handleSyncAccount = async (id: number) => {
    setSyncingId(id);
    try {
      const res = await syncAccountMutation.mutateAsync({ id });
      if (res.success) {
        toast.success("Métricas e status da conta sincronizados via API!");
      } else {
        toast.error("Aviso na sincronização.");
      }
      utils.social.listAccounts.invalidate();
    } catch (e: any) {
      toast.error(e?.message || "Erro na sincronização.");
    } finally {
      setSyncingId(null);
    }
  };

  const accounts = accountsQuery.data || [];
  const filteredAccounts =
    platformFilter === "all"
      ? accounts
      : accounts.filter(a => a.platform === platformFilter);

  const currentPlatformInfo = platformConfig[form.platform] || platformConfig.instagram;

  return (
    <WorkspaceShell>
      <WorkspaceHeader
        title="Contas Conectadas & Redes Sociais"
        description="Gerencie múltiplos perfis e páginas do Instagram, Facebook, LinkedIn, TikTok e Google Meu Negócio."
        eyebrow="Social Media Hub"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncAllMutation.mutate()}
              disabled={syncAllMutation.isPending || accounts.length === 0}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncAllMutation.isPending ? "animate-spin" : ""}`} />
              Sincronizar Todas
            </Button>
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setCreateModalOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Conectar Nova Conta
            </Button>
          </div>
        }
      />

      <WorkspaceSection>
        {/* Quick Platform Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6">
          <Button
            variant={platformFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setPlatformFilter("all")}
            className="rounded-full text-xs"
          >
            Todas ({accounts.length})
          </Button>
          {(Object.keys(platformConfig) as PlatformType[]).map(key => {
            const count = accounts.filter(a => a.platform === key).length;
            const cfg = platformConfig[key];
            return (
              <Button
                key={key}
                variant={platformFilter === key ? "default" : "outline"}
                size="sm"
                onClick={() => setPlatformFilter(key)}
                className="rounded-full text-xs gap-1.5"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                {cfg.label} ({count})
              </Button>
            );
          })}
        </div>

        {/* Empty state */}
        {accounts.length === 0 && !accountsQuery.isLoading && (
          <Card className="text-center py-12 border-dashed">
            <CardContent className="space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Share2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Nenhuma conta conectada ainda</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                  Conecte as páginas da Sempre Internet, OnNet Telecom e unidades do Google Meu Negócio para habilitar agendamento de posts e relatórios automáticos.
                </p>
              </div>
              <Button
                onClick={() => {
                  resetForm();
                  setCreateModalOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Conectar Primeira Conta
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Accounts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map(account => {
            const cfg = platformConfig[account.platform as PlatformType] || platformConfig.instagram;
            const isSyncing = syncingId === account.id;
            const isTesting = testingId === account.id;

            return (
              <Card key={account.id} className="relative overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                <div
                  className="h-1.5 w-full"
                  style={{ backgroundColor: cfg.color }}
                />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {account.avatarUrl ? (
                        <img
                          src={account.avatarUrl}
                          alt={account.accountName}
                          className="w-11 h-11 rounded-full object-cover border border-border"
                        />
                      ) : (
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-sm shadow-sm"
                          style={{ backgroundColor: cfg.color }}
                        >
                          {cfg.iconText}
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-base font-semibold leading-tight line-clamp-1">
                          {account.accountName}
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5 line-clamp-1">
                          {account.accountIdentifier}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={cfg.badgeClass}>
                      {cfg.label}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pb-3 text-xs">
                  {/* Status Indicator */}
                  <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" /> Status da Conexão:
                    </span>
                    {account.lastSyncStatus === "connected" ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Conectado via API
                      </span>
                    ) : account.lastSyncStatus === "error" ? (
                      <span className="flex items-center gap-1 text-rose-600 font-medium" title={account.lastSyncError || "Erro de autenticação"}>
                        <AlertCircle className="h-3.5 w-3.5" /> Erro no Token
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600 font-medium">
                        <Clock className="h-3.5 w-3.5" /> Pendente de Teste
                      </span>
                    )}
                  </div>

                  {/* Metrics preview */}
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div className="p-2 rounded bg-muted/20 border border-border/40">
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">Seguidores</div>
                      <div className="text-sm font-bold text-foreground">
                        {Number(account.followersCount || 0).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-muted/20 border border-border/40">
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">Alcance</div>
                      <div className="text-sm font-bold text-foreground">
                        {Number(account.reach || 0).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <div className="p-2 rounded bg-muted/20 border border-border/40">
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">Impressões</div>
                      <div className="text-sm font-bold text-foreground">
                        {Number(account.impressions || 0).toLocaleString("pt-BR")}
                      </div>
                    </div>
                  </div>

                  {account.lastSyncAt && (
                    <div className="text-[11px] text-muted-foreground text-right">
                      Última sincronização: {new Date(account.lastSyncAt).toLocaleString("pt-BR")}
                    </div>
                  )}
                </CardContent>

                {/* Card Actions */}
                <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestConnection(account.id)}
                      disabled={isTesting}
                      className="text-xs h-8 px-2"
                      title="Testar Conexão Oficial"
                    >
                      <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isTesting ? "animate-spin" : ""}`} />
                      Testar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSyncAccount(account.id)}
                      disabled={isSyncing}
                      className="text-xs h-8 px-2"
                      title="Sincronizar Métricas Agora"
                    >
                      <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                      Sincronizar
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingAccount(account);
                        setForm({
                          platform: account.platform as PlatformType,
                          accountName: account.accountName,
                          accountIdentifier: account.accountIdentifier,
                          externalId: account.externalId || "",
                          accessToken: "",
                          refreshToken: "",
                          avatarUrl: account.avatarUrl || "",
                          isActive: account.isActive,
                        });
                      }}
                      className="text-xs h-8 w-8 p-0"
                      title="Editar Configurações"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAccountToDelete(account.id)}
                      className="text-xs h-8 w-8 p-0 text-destructive hover:text-destructive"
                      title="Desconectar Conta"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </WorkspaceSection>

      {/* Modal Conectar / Editar Conta com Campos Dinâmicos por Plataforma */}
      <Dialog
        open={createModalOpen || Boolean(editingAccount)}
        onOpenChange={open => {
          if (!open) {
            setCreateModalOpen(false);
            setEditingAccount(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: currentPlatformInfo.color }} />
              {editingAccount ? `Editar Conta: ${editingAccount.accountName}` : "Conectar Nova Conta Social"}
            </DialogTitle>
            <DialogDescription>
              Selecione a plataforma para que os campos específicos de integração sejam exibidos automaticamente.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={e => {
              e.preventDefault();
              if (editingAccount) {
                updateMutation.mutate({
                  id: editingAccount.id,
                  accountName: form.accountName,
                  accountIdentifier: form.accountIdentifier,
                  externalId: form.externalId,
                  accessToken: form.accessToken || undefined,
                  refreshToken: form.refreshToken || undefined,
                  avatarUrl: form.avatarUrl,
                  isActive: form.isActive,
                });
              } else {
                createMutation.mutate({
                  platform: form.platform,
                  accountName: form.accountName,
                  accountIdentifier: form.accountIdentifier,
                  externalId: form.externalId,
                  accessToken: form.accessToken,
                  refreshToken: form.refreshToken,
                  avatarUrl: form.avatarUrl,
                  isActive: form.isActive,
                });
              }
            }}
            className="space-y-4 pt-2"
          >
            {/* Platform Selector Cards */}
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                1. Escolha a Plataforma
              </Label>
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(platformConfig) as PlatformType[]).map(key => {
                  const cfg = platformConfig[key];
                  const isSelected = form.platform === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={Boolean(editingAccount)}
                      onClick={() => setForm(f => ({ ...f, platform: key }))}
                      className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
                          : "border-border hover:bg-muted/50 opacity-70 hover:opacity-100"
                      } ${editingAccount ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: cfg.color }}
                      >
                        {cfg.iconText}
                      </div>
                      <span className="text-[11px] font-medium leading-tight">
                        {cfg.label.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Instruction Box */}
            <div className="p-3 rounded-lg bg-muted/40 border border-border text-xs flex gap-2.5 items-start">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground mb-0.5">Como integrar com {currentPlatformInfo.label}:</p>
                <p className="text-muted-foreground leading-relaxed">{currentPlatformInfo.instructions}</p>
                <a
                  href={currentPlatformInfo.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium mt-1"
                >
                  Abrir documentação oficial da API <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            {/* Account Friendly Name */}
            <div>
              <Label htmlFor="acc-name">Nome Amigável / Rótulo da Conta</Label>
              <Input
                id="acc-name"
                required
                placeholder="Ex: Sempre Internet Oficial, OnNet Patrocínio ou Loja Centro"
                value={form.accountName}
                onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Nome para identificação interna na equipe ao agendar posts ou emitir relatórios.
              </p>
            </div>

            {/* Dynamic Specific Identifiers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="acc-handle">{currentPlatformInfo.handleLabel}</Label>
                <Input
                  id="acc-handle"
                  required
                  placeholder={currentPlatformInfo.handlePlaceholder}
                  value={form.accountIdentifier}
                  onChange={e => setForm(f => ({ ...f, accountIdentifier: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="acc-ext-id">{currentPlatformInfo.extIdLabel}</Label>
                <Input
                  id="acc-ext-id"
                  placeholder={currentPlatformInfo.extIdPlaceholder}
                  value={form.externalId}
                  onChange={e => setForm(f => ({ ...f, externalId: e.target.value }))}
                />
              </div>
            </div>

            {/* Access Token Field */}
            <div>
              <Label htmlFor="acc-token" className="flex items-center justify-between">
                <span>{currentPlatformInfo.tokenLabel}</span>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <KeyRound className="h-3 w-3" /> Criptografado no banco
                </span>
              </Label>
              <Input
                id="acc-token"
                type="password"
                placeholder={editingAccount ? "Deixe em branco para manter o token atual" : "Cole o Bearer / Access Token gerado na plataforma"}
                value={form.accessToken}
                onChange={e => setForm(f => ({ ...f, accessToken: e.target.value }))}
              />
            </div>

            {/* Avatar URL */}
            <div>
              <Label htmlFor="acc-avatar">URL da Logo / Foto de Perfil (Opcional)</Label>
              <Input
                id="acc-avatar"
                placeholder="https://sua-empresa.com/logo.png"
                value={form.avatarUrl}
                onChange={e => setForm(f => ({ ...f, avatarUrl: e.target.value }))}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateModalOpen(false);
                  setEditingAccount(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                {editingAccount ? "Salvar Alterações" : "Salvar & Conectar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog
        open={accountToDelete !== null}
        onOpenChange={open => !open && setAccountToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar conta social?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá a conexão desta conta com o Marketing HUB. Os posts já publicados nas redes continuarão online, mas nenhum novo agendamento ou métrica será processado para esta conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (accountToDelete) deleteMutation.mutate({ id: accountToDelete });
              }}
            >
              Sim, Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspaceShell>
  );
}
