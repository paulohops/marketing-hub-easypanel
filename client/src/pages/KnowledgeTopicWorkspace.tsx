import { WorkspaceCard, WorkspaceHeader, WorkspaceSection, WorkspaceShell } from "@/components/WorkspaceChrome";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, BookOpenCheck, GitBranch, ListChecks, Link2, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { knowledgeCards } from "./HelpWorkspace";

const flowByTopic: Record<string, string[]> = {
  "visao-geral": ["Cadastros mestres", "Planejamento", "Execução", "Comprovação", "Financeiro e Estoque", "BI e decisão"],
  "cadastros-relacionamentos": ["Empresa e fiscal", "Regional e cidade", "Fornecedor e oferta", "Serviço e SubServiço", "Operação vinculada"],
  trade: ["Campanha", "Ação ou evento", "Responsável e fornecedor", "Status e evidências", "Debriefing e custo"],
  midias: ["Ponto ou programa", "Contrato e cobertura", "Nova veiculação", "Arte, spot e evidências", "Histórico e resultado"],
  "servicos-subservicos": ["Tipo de mídia", "Serviço principal", "Vínculo M:N", "SubServiço filtrado", "Veiculação"],
  estoque: ["Produto", "Entrada ou compra", "Saldo por local", "Saída ou transferência", "Conciliação"],
  financeiro: ["Fornecedor e oferta", "Contrato ou pedido", "Itens", "Nota fiscal", "Pagamento e caixa"],
  "central-dados": ["Modelo do módulo", "Validação", "Resolução de vínculos", "Prévia de erros", "Importação e auditoria"],
  processos: ["Arquivo oficial", "Passos por setor", "Publicação", "Execução", "Revisão"],
  bi: ["Fonte operacional", "Filtros e dimensões", "Métrica", "Card ou gráfico", "Decisão"],
  "padrao-visual": ["WorkspaceShell", "Header canônico", "Seção", "Card com padding", "Controles alinhados"],
};

export default function KnowledgeTopicWorkspace({ topicId }: { topicId?: string }) {
  const [, setLocation] = useLocation();
  const card = knowledgeCards.find(item => item.id === topicId);

  if (!card) {
    return <WorkspaceShell><WorkspaceHeader eyebrow="Central de conhecimento" title="Tópico não encontrado" description="O tópico solicitado não existe ou foi movido." icon={BookOpenCheck} actions={<Button variant="outline" onClick={() => setLocation("/central-conhecimento")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar à Central</Button>} /><WorkspaceCard><p className="text-sm text-muted-foreground">Use o índice da Central de Conhecimento para consultar os tópicos disponíveis.</p></WorkspaceCard></WorkspaceShell>;
  }

  const Icon = card.icon;
  const flow = flowByTopic[card.id] ?? ["Contexto", "Preenchimento", "Validação", "Execução", "Histórico"];

  return <WorkspaceShell>
    <WorkspaceHeader eyebrow={`${card.area} · Central de conhecimento`} title={card.title} description={card.summary} icon={Icon} actions={<Button variant="outline" onClick={() => setLocation("/central-conhecimento")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar à Central</Button>} meta={<span className="inline-flex items-center gap-1.5"><BookOpenCheck className="h-3.5 w-3.5" />Página de conhecimento operacional</span>} />
    <WorkspaceSection title="Como este tópico se relaciona" description="Use este relacionamento para entender de onde o dado vem, para onde ele vai e quais módulos dependem dele.">
      <WorkspaceCard className="border-primary/25 bg-primary/[0.03]"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Link2 className="h-4 w-4" /></span><p className="text-sm leading-7 text-foreground">{card.relationship}</p></div></WorkspaceCard>
    </WorkspaceSection>
    <WorkspaceSection title="Fluxo operacional" description="O fluxo é uma representação resumida; os detalhes de preenchimento e as regras ficam nos cards abaixo.">
      <WorkspaceCard><div className="mb-4 flex items-center gap-2"><GitBranch className="h-4 w-4 text-primary" /><h2 className="font-display text-base font-semibold text-foreground">Sequência recomendada</h2></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{flow.map((step, index) => <div key={step} className="relative flex min-h-24 flex-col justify-between rounded-xl border border-border bg-secondary/30 p-3"><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Etapa {String(index + 1).padStart(2, "0")}</span><span className="mt-3 text-sm font-semibold leading-5 text-foreground">{step}</span>{index < flow.length - 1 && <ArrowRight className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rounded-full bg-card text-primary xl:block" />}</div>)}</div></WorkspaceCard>
    </WorkspaceSection>
    <div className="grid gap-5 xl:grid-cols-2">
      <WorkspaceCard><div className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-semibold text-foreground">Como preencher e usar</h2></div><KnowledgeList items={card.howTo} /></WorkspaceCard>
      <WorkspaceCard><div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-semibold text-foreground">Campos importantes</h2></div><KnowledgeList items={card.fields} /></WorkspaceCard>
    </div>
    <WorkspaceCard><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-semibold text-foreground">Regras e cuidados</h2></div><KnowledgeList items={card.rules} /></WorkspaceCard>
  </WorkspaceShell>;
}

function KnowledgeList({ items }: { items: string[] }) {
  return <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">{items.map(item => <li key={item} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{item}</li>)}</ul>;
}
