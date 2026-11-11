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

const platformConfig: Record<string, { label: string; badgeClass: string; iconText: string; color: string }> = {
  instagram: {
    label: "Instagram",
    badgeClass: "bg-gradient-to-r from-purple-500 to-pink-500 text-white border-none",
    iconText: "IG",
    color: "#E1306C",
  },
  facebook: {
    label: "Facebook",
    badgeClass: "bg-blue-600 text-white border-none",
    iconText: "FB",
    color: "#1877F2",
  },
  linkedin: {
    label: "LinkedIn",
    badgeClass: "bg-sky-700 text-white border-none",
    iconText: "IN",
    color: "#0A66C2",
  },
  tiktok: {
    label: "TikTok",
    badgeClass: "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-none",
    iconText: "TT",
    color: "#000000",
  },
  google_business: {
    label: "Google Meu Negócio",
    badgeClass: "bg-amber-600 text-white border-none",
    iconText: "GMB",
    color: "#EA4335",
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

  const [form, setForm] = useState({
    platform: "instagram" as const,
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
      toast.success("Conta cadastrada com sucesso!");
    },
    onError: err => toast.error(err.message || "Erro ao cadastrar conta."),
  });

  const updateMutation = trpc.social.updateAccount.useMutation({
    onSuccess: () => {
      utils.social.listAccounts.invalidate();
      setEditingAccount(null);
      resetForm();
      toast.success("Conta atualizada!");
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

  const handleOpenEdit = (acc: any) => {
    setEditingAccount(acc);
    setForm({
      platform: acc.platform,
      accountName: acc.accountName,
      accountIdentifier: acc.accountIdentifier,
      externalId: acc.externalId || "",
      accessToken: "",
      refreshToken: "",
      avatarUrl: acc.avatarUrl || "",
      isActive: acc.isActive,
    });
  };

  const handleTestConnection = async (id: number) => {
    setTestingId(id);
    try {
      const res = await testConnectionMutation.mutateAsync({ id });
      if (res.success) {
        toast.success(res.message);
        utils.social.listAccounts.invalidate();
      } else {
        toast.error(`Falha: ${res.message}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao testar conexão.");
    } finally {
      setTestingId(null);
    }
  };

  const handleSyncAccount = async (id: number) => {
    setSyncingId(id);
    try {
      const res = await syncAccountMutation.mutateAsync({ id });
      if (res.success) {
        toast.success("Métricas da conta atualizadas via API!");
        utils.social.listAccounts.invalidate();
      } else {
        toast.error("Falha ao puxar métricas da rede.");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const accounts = accountsQuery.data || [];

  return (
    <WorkspaceShell>
      <WorkspaceHeader
        eyebrow="Social Media Hub"
        title="Contas Conectadas"
        description="Gerencie os múltiplos perfis de Instagram, Páginas do Facebook, Canais do TikTok, Company Pages do LinkedIn e Unidades do Google Meu Negócio."
        icon={Users}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={syncAllMutation.isPending || accounts.length === 0}
              onClick={() => syncAllMutation.mutate()}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncAllMutation.isPending ? "animate-spin" : ""}`} />
              Sincronizar Todas
            </Button>
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setCreateModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Conectar Nova Conta
            </Button>
          </div>
        }
      />

      <div className="mt-6 space-y-6">
        {accounts.length === 0 && !accountsQuery.isLoading ? (
          <Card className="border-dashed border-2 border-border p-8 text-center bg-card/40">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary mb-4">
              <Share2 className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Nenhuma conta conectada</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
              Adicione suas contas do Instagram, Facebook, TikTok, LinkedIn ou Google Meu Negócio para habilitar o agendamento de posts e relatórios automáticos.
            </p>
            <Button
              className="mt-5"
              onClick={() => {
                resetForm();
                setCreateModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Conectar Primeira Conta
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map(acc => {
              const conf = platformConfig[acc.platform] || {
                label: acc.platform,
                badgeClass: "bg-muted",
                iconText: "SOC",
                color: "#666",
              };
              const isTesting = testingId === acc.id;
              const isSyncing = syncingId === acc.id;

              return (
                <Card key={acc.id} className="border-border bg-card flex flex-col justify-between shadow-sm hover:shadow-md transition">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {acc.avatarUrl ? (
                          <img
                            src={acc.avatarUrl}
                            alt={acc.accountName}
                            className="h-10 w-10 rounded-full object-cover border border-border"
                          />
                        ) : (
                          <span
                            className="grid h-10 w-10 place-items-center rounded-full font-bold text-xs text-white"
                            style={{ backgroundColor: conf.color }}
                          >
                            {conf.iconText}
                          </span>
                        )}
                        <div>
                          <CardTitle className="text-base font-semibold leading-tight line-clamp-1">
                            {acc.accountName}
                          </CardTitle>
                          <CardDescription className="text-xs mt-0.5">
                            {acc.accountIdentifier}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge className={conf.badgeClass}>
                        {conf.label}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 pb-3">
                    {/* Status & Followers */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-muted/40 text-xs">
                      <div>
                        <span className="text-muted-foreground block">Seguidores / Fãs</span>
                        <span className="font-semibold text-sm text-foreground">
                          {acc.followersCount?.toLocaleString("pt-BR") || "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Status Conexão</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {acc.lastSyncStatus === "success" ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Ativo
                            </span>
                          ) : acc.lastSyncStatus === "error" ? (
                            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium" title={acc.lastSyncError || "Erro"}>
                              <AlertCircle className="h-3.5 w-3.5" /> Erro Token
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                              <Clock className="h-3.5 w-3.5" /> Pendente
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                      <span>Última sincronização:</span>
                      <span>
                        {acc.lastSyncAt ? new Date(acc.lastSyncAt).toLocaleString("pt-BR") : "Nunca"}
                      </span>
                    </div>
                  </CardContent>

                  {/* Actions Footer */}
                  <div className="p-3 border-t border-border flex items-center justify-between bg-muted/20">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs px-2"
                        disabled={isTesting}
                        onClick={() => handleTestConnection(acc.id)}
                      >
                        {isTesting ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <ShieldCheck className="h-3.5 w-3.5 mr-1 text-primary" />
                        )}
                        Testar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs px-2"
                        disabled={isSyncing}
                        onClick={() => handleSyncAccount(acc.id)}
                      >
                        <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isSyncing ? "animate-spin" : ""}`} />
                        Sync
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => handleOpenEdit(acc)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                        onClick={() => setAccountToDelete(acc.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Create or Edit Account */}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "Editar Conta Conectada" : "Conectar Nova Conta Social"}
            </DialogTitle>
            <DialogDescription>
              Insira os dados e o Access Token gerado na plataforma oficial para habilitar postagens e coleta de métricas.
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
            <div>
              <Label>Rede / Plataforma</Label>
              <Select
                disabled={Boolean(editingAccount)}
                value={form.platform}
                onValueChange={(val: any) => setForm(f => ({ ...f, platform: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instagram">Instagram Business</SelectItem>
                  <SelectItem value="facebook">Facebook Page</SelectItem>
                  <SelectItem value="linkedin">LinkedIn (Company Page ou Perfil)</SelectItem>
                  <SelectItem value="tiktok">TikTok (Conta Comercial ou Criador)</SelectItem>
                  <SelectItem value="google_business">Google Meu Negócio (Unidade/Loja)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="acc-name">Nome Amigável / Rótulo</Label>
              <Input
                id="acc-name"
                required
                placeholder="Ex: OnNet Telecom Oficial ou Sempre Internet Matriz"
                value={form.accountName}
                onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="acc-handle">Identificador / @Handle</Label>
                <Input
                  id="acc-handle"
                  required
                  placeholder="Ex: @onnettelecom"
                  value={form.accountIdentifier}
                  onChange={e => setForm(f => ({ ...f, accountIdentifier: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="acc-ext-id">ID Externo (Page/Account ID)</Label>
                <Input
                  id="acc-ext-id"
                  placeholder="Ex: 109283019283"
                  value={form.externalId}
                  onChange={e => setForm(f => ({ ...f, externalId: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="acc-token">Access Token da API</Label>
              <Input
                id="acc-token"
                type="password"
                placeholder={editingAccount ? "Deixe em branco para manter o token atual" : "Cole o Bearer / Access Token aqui"}
                value={form.accessToken}
                onChange={e => setForm(f => ({ ...f, accessToken: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Token gerado no Meta Graph API Explorer, LinkedIn Developers, TikTok Developer ou Google OAuth.
              </p>
            </div>

            <div>
              <Label htmlFor="acc-avatar">URL do Avatar / Foto do Perfil (Opcional)</Label>
              <Input
                id="acc-avatar"
                placeholder="https://exemplo.com/logo.png"
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
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingAccount ? "Salvar Alterações" : "Salvar Conta"}
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
            <AlertDialogTitle>Desconectar esta conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso interromperá o agendamento de posts e a coleta de relatórios automáticos para esta conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => {
                if (accountToDelete) deleteMutation.mutate({ id: accountToDelete });
              }}
            >
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WorkspaceShell>
  );
}
