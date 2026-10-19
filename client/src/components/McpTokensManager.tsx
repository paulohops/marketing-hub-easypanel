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
        {tokensQuery.isLoading ? (\n          <div className="flex items-center justify-center py-8 text-muted-foreground">\n            <Loader2 className="h-5 w-5 animate-spin mr-2" />\n            Carregando tokens...\n          </div>\n        ) : !tokensQuery.data || tokensQuery.data.length === 0 ? (\n          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">\n            Nenhum token MCP ativo. Clique em \"Novo Token MCP\" para criar um token e conectar seu assistente de IA.\n          </div>\n        ) : (\n          <div className="flex flex-col gap-3">\n            {tokensQuery.data.map(tok => {\n              const isRevoked = Boolean(tok.revokedAt);\n              const isExpired = tok.expiresAt ? new Date(tok.expiresAt) < new Date() : false;\n              const isActive = !isRevoked && !isExpired;\n\n              return (\n                <div\n                  key={tok.id}\n                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5"\n                >\n                  <div className="space-y-1">\n                    <div className="flex items-center gap-2">\n                      <span className="font-medium text-foreground text-sm">{tok.name}</span>\n                      {isActive && (\n                        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[11px]">\n                          Ativo\n                        </Badge>\n                      )}\n                      {isRevoked && (\n                        <Badge variant="outline" className="border-destructive/40 text-destructive text-[11px]">\n                          Revogado\n                        </Badge>\n                      )}\n                      {isExpired && !isRevoked && (\n                        <Badge variant="outline" className="border-destructive/40 text-destructive text-[11px]">\n                          Expirado\n                        </Badge>\n                      )}\n                    </div>\n                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">\n                      <code>{tok.tokenPrefix}</code>\n                      <span>Criado em: {new Date(tok.createdAt).toLocaleDateString(\"pt-BR\")}</span>\n                      {tok.lastUsedAt && (\n                        <span>Último uso: {new Date(tok.lastUsedAt).toLocaleDateString(\"pt-BR\")}</span>\n                      )}\n                      {tok.expiresAt && (\n                        <span>Expira em: {new Date(tok.expiresAt).toLocaleDateString(\"pt-BR\")}</span>\n                      )}\n                    </div>\n                  </div>\n\n                  {isActive && (\n                    <Button\n                      variant=\"ghost\"\n                      size=\"sm\"\n                      className=\"text-destructive hover:bg-destructive/10 hover:text-destructive self-start sm:self-center\"\n                      onClick={() => setTokenToRevoke({ id: tok.id, name: tok.name })}\n                      disabled={revokeMutation.isPending}\n                    >\n                      <Trash2 className=\"h-4 w-4 mr-1.5\" />\n                      Revogar\n                    </Button>\n                  )}\n                </div>\n              );\n            })}\n          </div>\n        )}\n      </div>\n\n      {/* Diálogo de criação */}\n      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>\n        <DialogContent className=\"sm:max-w-md\">\n          <form onSubmit={handleCreate}>\n            <DialogHeader>\n              <DialogTitle className=\"flex items-center gap-2\">\n                <KeyRound className=\"h-5 w-5 text-primary\" />\n                Criar Token MCP\n              </DialogTitle>\n              <DialogDescription>\n                Gere um token de autenticação seguro para que assistentes de IA (Cursor, Antigravity, Claude) possam acessar o Marketing HUB via MCP.\n              </DialogDescription>\n            </DialogHeader>\n\n            <div className=\"space-y-4 py-4\">\n              <div className=\"space-y-1.5\">\n                <Label htmlFor=\"token-name\">Nome / Finalidade</Label>\n                <Input\n                  id=\"token-name\"\n                  placeholder=\"Ex: Cursor - Meu Computador, Claude Desktop, Agente de Trade\"\n                  value={name}\n                  onChange={e => setName(e.target.value)}\n                  maxLength={100}\n                  autoFocus\n                />\n              </div>\n\n              <div className=\"space-y-1.5\">\n                <Label htmlFor=\"token-expiry\">Validade</Label>\n                <Select value={expiresInDays} onValueChange={setExpiresInDays}>\n                  <SelectTrigger id=\"token-expiry\">\n                    <SelectValue placeholder=\"Selecione a validade\" />\n                  </SelectTrigger>\n                  <SelectContent>\n                    <SelectItem value=\"30\">30 dias</SelectItem>\n                    <SelectItem value=\"90\">90 dias (Recomendado)</SelectItem>\n                    <SelectItem value=\"180\">180 dias</SelectItem>\n                    <SelectItem value=\"365\">1 ano</SelectItem>\n                    <SelectItem value=\"never\">Sem expiração</SelectItem>\n                  </SelectContent>\n                </Select>\n              </div>\n            </div>\n\n            <DialogFooter>\n              <Button\n                type=\"button\"\n                variant=\"outline\"\n                onClick={() => setIsCreateOpen(false)}\n                disabled={createMutation.isPending}\n              >\n                Cancelar\n              </Button>\n              <Button type=\"submit\" disabled={createMutation.isPending}>\n                {createMutation.isPending ? (\n                  <>\n                    <Loader2 className=\"mr-2 h-4 w-4 animate-spin\" />\n                    Gerando...\n                  </>\n                ) : (\n                  \"Gerar Token\"\n                )}\n              </Button>\n            </DialogFooter>\n          </form>\n        </DialogContent>\n      </Dialog>\n\n      {/* Diálogo de exibição do token recém-criado */}\n      <Dialog\n        open={Boolean(createdTokenData)}\n        onOpenChange={open => {\n          if (!open) setCreatedTokenData(null);\n        }}\n      >\n        <DialogContent className=\"sm:max-w-lg\">\n          <DialogHeader>\n            <DialogTitle className=\"flex items-center gap-2 text-primary\">\n              <Bot className=\"h-5 w-5\" />\n              Token MCP Gerado com Sucesso\n            </DialogTitle>\n            <DialogDescription>\n              Copie o token abaixo agora. Por segurança, ele não poderá ser visualizado novamente após fechar esta janela.\n            </DialogDescription>\n          </DialogHeader>\n\n          {createdTokenData && (\n            <div className=\"space-y-4 py-2\">\n              <div className=\"hub-status-note flex items-start gap-2.5 text-xs text-foreground\">\n                <ShieldAlert className=\"h-4 w-4 shrink-0 mt-0.5 text-destructive\" />\n                <span>\n                  Guarde este token com cuidado. Qualquer pessoa ou assistente com ele poderá realizar ações de acordo com o seu perfil de acesso.\n                </span>\n              </div>\n\n              <div className=\"space-y-1.5\">\n                <Label>Token de Autenticação</Label>\n                <div className=\"flex items-center gap-2\">\n                  <Input\n                    readOnly\n                    value={createdTokenData.token}\n                    className=\"font-mono text-xs select-all bg-muted\"\n                  />\n                  <Button\n                    type=\"button\"\n                    size=\"sm\"\n                    variant=\"outline\"\n                    aria-label=\"Copiar token MCP\"\n                    onClick={() => copyToClipboard(createdTokenData.token, \"token\")}\n                  >\n                    {copiedToken ? <Check className=\"h-4 w-4 text-primary\" /> : <Copy className=\"h-4 w-4\" />}\n                  </Button>\n                </div>\n              </div>\n\n              <div className=\"space-y-1.5\">\n                <div className=\"flex items-center justify-between\">\n                  <Label className=\"text-xs\">Exemplo de configuração (mcp_config.json):</Label>\n                  <Button\n                    type=\"button\"\n                    variant=\"ghost\"\n                    size=\"sm\"\n                    className=\"h-7 text-xs\"\n                    onClick={() => copyToClipboard(sampleConfig, \"config\")}\n                  >\n                    {copiedConfig ? (\n                      <span className=\"flex items-center gap-1 text-primary\">\n                        <Check className=\"h-3.5 w-3.5\" /> Copiado\n                      </span>\n                    ) : (\n                      <span className=\"flex items-center gap-1\">\n                        <Copy className=\"h-3.5 w-3.5\" /> Copiar Configuração\n                      </span>\n                    )}\n                  </Button>\n                </div>\n                <pre className=\"rounded-xl border border-border bg-muted p-3 text-[11px] font-mono leading-relaxed overflow-x-auto text-foreground\">\n                  {sampleConfig}\n                </pre>\n              </div>\n            </div>\n          )}\n\n          <DialogFooter>\n            <Button\n              type=\"button\"\n              onClick={() => setCreatedTokenData(null)}\n            >\n              Concluído\n            </Button>\n          </DialogFooter>\n        </DialogContent>\n      </Dialog>\n\n      {/* Diálogo de confirmação de revogação de token */}\n      <AlertDialog\n        open={Boolean(tokenToRevoke)}\n        onOpenChange={open => {\n          if (!open) setTokenToRevoke(null);\n        }}\n      >\n        <AlertDialogContent>\n          <AlertDialogHeader>\n            <AlertDialogTitle>Revogar token MCP</AlertDialogTitle>\n            <AlertDialogDescription>\n              Deseja revogar o token \"{tokenToRevoke?.name}\"? As IAs conectadas com este token perderão o acesso imediatamente.\n            </AlertDialogDescription>\n          </AlertDialogHeader>\n          <AlertDialogFooter>\n            <AlertDialogCancel disabled={revokeMutation.isPending}>\n              Cancelar\n            </AlertDialogCancel>\n            <AlertDialogAction\n              className=\"bg-destructive text-destructive-foreground hover:bg-destructive/90\"\n              disabled={revokeMutation.isPending}\n              onClick={() => {\n                if (tokenToRevoke) {\n                  revokeMutation.mutate(\n                    { id: tokenToRevoke.id },\n                    { onSettled: () => setTokenToRevoke(null) }\n                  );\n                }\n              }}\n            >\n              {revokeMutation.isPending ? \"Revogando...\" : \"Revogar\"}\n            </AlertDialogAction>\n          </AlertDialogFooter>\n        </AlertDialogContent>\n      </AlertDialog>\n    </div>\n  );\n}\n