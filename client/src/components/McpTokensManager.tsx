import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import { Bot, Check, Copy, KeyRound, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function McpTokensManager() {
  const utils = trpc.useUtils();
  const tokensQuery = trpc.mcp.list.useQuery();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState<string>("90");
  const [tokenToRevoke, setTokenToRevoke] = useState<{
    id: number;
    name: string;
  } | null>(null);

  const [createdTokenData, setCreatedTokenData] = useState<{
    token: string;
    name: string;
  } | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);

  const createMutation = trpc.mcp.create.useMutation({
    onSuccess: data => {
      utils.mcp.list.invalidate();
      setIsCreateOpen(false);
      setName("");
      setCreatedTokenData({ token: data.token, name: data.name });
      toast.success("Token MCP gerado com sucesso!");
    },
    onError: error => toast.error(error.message),
  });

  const revokeMutation = trpc.mcp.revoke.useMutation({
    onSuccess: () => {
      utils.mcp.list.invalidate();
      toast.success("Token MCP revogado.");
    },
    onError: error => toast.error(error.message),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Informe um nome para identificar o token.");
      return;
    }
    const days = expiresInDays === "never" ? null : Number(expiresInDays);
    createMutation.mutate({ name: name.trim(), expiresInDays: days });
  };

  const copyToClipboard = async (text: string, type: "token" | "config") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "token") {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      } else {
        setCopiedConfig(true);
        setTimeout(() => setCopiedConfig(false), 2000);
      }
      toast.success("Copiado para a área de transferência!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const serverUrl = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "http://10.159.245.28:8978/api/mcp";

  const sampleConfig = createdTokenData
    ? JSON.stringify(
        {
          mcpServers: {
            "marketing-hub": {
              url: serverUrl,
              headers: {
                Authorization: `Bearer ${createdTokenData.token}`,
              },
            },
          },
        },
        null,
        2
      )
    : "";

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Bot className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-base font-semibold text-foreground">
              Tokens de Acesso MCP (IA)
            </h3>
            <p className="text-sm text-muted-foreground">
              Conecte assistentes de IA (Cursor, Antigravity, Claude Desktop) para consultar e operar o Marketing HUB via MCP.
            </p>
          </div>
        </div>
        <Button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Novo Token MCP
        </Button>
      </div>

      <div className="mt-5">
        {tokensQuery.isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando tokens...
          </div>
        ) : !tokensQuery.data || tokensQuery.data.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Nenhum token MCP ativo. Clique em "Novo Token MCP" para criar um token e conectar seu assistente de IA.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tokensQuery.data.map(tok => {
              const isRevoked = Boolean(tok.revokedAt);
              const isExpired = tok.expiresAt ? new Date(tok.expiresAt) < new Date() : false;
              const isActive = !isRevoked && !isExpired;

              return (
                <div
                  key={tok.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm">{tok.name}</span>
                      {isActive && (
                        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[11px]">
                          Ativo
                        </Badge>
                      )}
                      {isRevoked && (
                        <Badge variant="outline" className="border-destructive/40 text-destructive text-[11px]">
                          Revogado
                        </Badge>
                      )}
                      {isExpired && !isRevoked && (
                        <Badge variant="outline" className="border-destructive/40 text-destructive text-[11px]">
                          Expirado
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <code>{tok.tokenPrefix}</code>
                      <span>Criado em: {new Date(tok.createdAt).toLocaleDateString("pt-BR")}</span>
                      {tok.lastUsedAt && (
                        <span>Último uso: {new Date(tok.lastUsedAt).toLocaleDateString("pt-BR")}</span>
                      )}
                      {tok.expiresAt && (
                        <span>Expira em: {new Date(tok.expiresAt).toLocaleDateString("pt-BR")}</span>
                      )}
                    </div>
                  </div>

                  {isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive self-start sm:self-center"
                      onClick={() => setTokenToRevoke({ id: tok.id, name: tok.name })}
                      disabled={revokeMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Revogar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Diálogo de criação */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Criar Token MCP
              </DialogTitle>
              <DialogDescription>
                Gere um token de autenticação seguro para que assistentes de IA (Cursor, Antigravity, Claude) possam acessar o Marketing HUB via MCP.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="token-name">Nome / Finalidade</Label>
                <Input
                  id="token-name"
                  placeholder="Ex: Cursor - Meu Computador, Claude Desktop, Agente de Trade"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={100}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="token-expiry">Validade</Label>
                <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                  <SelectTrigger id="token-expiry">
                    <SelectValue placeholder="Selecione a validade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 dias</SelectItem>
                    <SelectItem value="90">90 dias (Recomendado)</SelectItem>
                    <SelectItem value="180">180 dias</SelectItem>
                    <SelectItem value="365">1 ano</SelectItem>
                    <SelectItem value="never">Sem expiração</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                disabled={createMutation.isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  "Gerar Token"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de exibição do token recém-criado */}
      <Dialog
        open={Boolean(createdTokenData)}
        onOpenChange={open => {
          if (!open) setCreatedTokenData(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Bot className="h-5 w-5" />
              Token MCP Gerado com Sucesso
            </DialogTitle>
            <DialogDescription>
              Copie o token abaixo agora. Por segurança, ele não poderá ser visualizado novamente após fechar esta janela.
            </DialogDescription>
          </DialogHeader>

          {createdTokenData && (
            <div className="space-y-4 py-2">
              <div className="hub-status-note flex items-start gap-2.5 text-xs text-foreground">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
                <span>
                  Guarde este token com cuidado. Qualquer pessoa ou assistente com ele poderá realizar ações de acordo com o seu perfil de acesso.
                </span>
              </div>

              <div className="space-y-1.5">
                <Label>Token de Autenticação</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={createdTokenData.token}
                    className="font-mono text-xs select-all bg-muted"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-label="Copiar token MCP"
                    onClick={() => copyToClipboard(createdTokenData.token, "token")}
                  >
                    {copiedToken ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Exemplo de configuração (mcp_config.json):</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => copyToClipboard(sampleConfig, "config")}
                  >
                    {copiedConfig ? (
                      <span className="flex items-center gap-1 text-primary">
                        <Check className="h-3.5 w-3.5" /> Copiado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Copy className="h-3.5 w-3.5" /> Copiar Configuração
                      </span>
                    )}
                  </Button>
                </div>
                <pre className="rounded-xl border border-border bg-muted p-3 text-[11px] font-mono leading-relaxed overflow-x-auto text-foreground">
                  {sampleConfig}
                </pre>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setCreatedTokenData(null)}
            >
              Concluído
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação de revogação de token */}
      <AlertDialog
        open={Boolean(tokenToRevoke)}
        onOpenChange={open => {
          if (!open) setTokenToRevoke(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar token MCP</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja revogar o token "{tokenToRevoke?.name}"? As IAs conectadas com este token perderão o acesso imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={revokeMutation.isPending}
              onClick={() => {
                if (tokenToRevoke) {
                  revokeMutation.mutate(
                    { id: tokenToRevoke.id },
                    { onSettled: () => setTokenToRevoke(null) }
                  );
                }
              }}
            >
              {revokeMutation.isPending ? "Revogando..." : "Revogar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}