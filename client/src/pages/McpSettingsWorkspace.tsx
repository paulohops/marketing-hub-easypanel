import { ArrowLeft, Bot, Sparkles, Terminal } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { McpTokensManager } from "@/components/McpTokensManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function McpSettingsWorkspace() {
  const [, setLocation] = useLocation();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button
        type="button"
        variant="outline"
        className="border-border text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setLocation("/configuracoes")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para Configurações
      </Button>

      <div className="flex gap-4 border-b border-border pb-6">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white shadow-sm">
          <Bot className="h-6 w-6" />
        </span>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">
              Inteligência Artificial & Integrações
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              <Sparkles className="h-3 w-3" />
              MCP Server Ativo
            </span>
          </div>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">
            Tokens e Integração MCP
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Conecte agentes de inteligência artificial (Antigravity, Claude Desktop, Cursor ou agentes autônomos) diretamente ao Marketing HUB usando o padrão <strong>Model Context Protocol (MCP)</strong>.
            Gere tokens de acesso com permissão auditada para ler e preencher planilhas, gerenciar mídias, campanhas e extrair métricas do Trade.
          </p>
        </div>
      </div>

      <McpTokensManager />

      <Card className="border-border/80 bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Terminal className="h-4 w-4 text-primary" />
            Como utilizar no Antigravity / Claude Desktop / Cursor
          </CardTitle>
          <CardDescription className="text-xs">
            Ao gerar um token acima, copie o bloco de configuração JSON e adicione-o ao arquivo <code>mcp.json</code> ou <code>claude_desktop_config.json</code> do seu cliente.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            O endpoint MCP do sistema opera em <code>/api/mcp</code> aceitando requisições JSON-RPC via método POST com o cabeçalho <code>Authorization: Bearer &lt;seu_token&gt;</code>.
          </p>
          <p>
            Todas as ferramentas do MCP validam as permissões do usuário que gerou o token, operam com transações atômicas seguras e registram cada ação no log de auditoria operacional do Trade HUB.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
