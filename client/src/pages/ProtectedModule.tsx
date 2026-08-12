import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { hasModulePermission } from "@/lib/permissions";
import { ArrowLeft, LockKeyhole, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import LoginPage from "./LoginPage";
import ModulePage from "./ModulePage";
import FinanceWorkspace from "./FinanceWorkspace";
import InventoryWorkspace from "./InventoryWorkspace";
import SettingsWorkspace from "./SettingsWorkspace";
import MediaWorkspace from "./MediaWorkspace";
import ActionsWorkspace from "./ActionsWorkspace";
import EventsWorkspace from "./EventsWorkspace";
import IndicatorsWorkspace from "./IndicatorsWorkspace";
import TradeEvidencePanel from "@/components/TradeEvidencePanel";
import RegionalMediaPanel from "@/components/RegionalMediaPanel";
import MediaCampaignLibrary from "@/components/MediaCampaignLibrary";
import MediaCoverageExplorer from "@/components/MediaCoverageExplorer";
import { BarChart3, Boxes, CalendarDays, Landmark, MapPinned, Megaphone, Settings2 } from "lucide-react";

const definitions = {
  estoque: { permission: "inventory.read", eyebrow: "Operação e materiais", title: "Estoque de brindes", description: "Controle entradas, saídas, saldo e histórico de materiais por regional e cidade.", icon: Boxes, resources: [{ title: "Catálogo de brindes", description: "Itens, SKU, unidade e estoque mínimo." }, { title: "Movimentações", description: "Entradas, saídas, ajustes e responsáveis." }, { title: "Saldo por local", description: "Visão consolidada por regional e cidade." }], accent: "#3f6c58" },
  financeiro: { permission: "finance.read", eyebrow: "Governança financeira", title: "Financeiro", description: "Organize notas fiscais, contas a pagar, pagamentos e vínculo com as operações.", icon: Landmark, resources: [{ title: "Notas fiscais", description: "Documentos, fornecedores e vencimentos." }, { title: "Contas a pagar", description: "Status, valores e obrigações em aberto." }, { title: "Pagamentos", description: "Histórico, comprovantes e referências." }], accent: "#9a6729" },
  midias: { permission: "media.read", eyebrow: "Canais e cobertura", title: "Mídias e campanhas", description: "Cadastre pontos, campanhas, ciclos de renovação e evidências de veiculação.", icon: Megaphone, resources: [{ title: "Pontos de mídia", description: "Localização, fornecedor e tipo de mídia." }, { title: "Campanhas", description: "Vigência, renovação e resultado." }, { title: "Cobertura regional", description: "Filtros por regional e cidade." }], accent: "#337273" },
  acoes: { permission: "actions.read", eyebrow: "Ativação de marca", title: "Ações de trade", description: "Planeje, execute e documente ações, serviços, fornecedores e debriefings.", icon: CalendarDays, resources: [{ title: "Planejamento", description: "Objetivo, agenda e fornecedores envolvidos." }, { title: "Execução", description: "Status, evidências e acompanhamento." }, { title: "Debriefing", description: "Nota, resultado, pontos positivos e negativos." }], accent: "#6d588d" },
  eventos: { permission: "events.read", eyebrow: "Experiências presenciais", title: "Eventos", description: "Centralize etapas de pré-evento, execução, avaliação e histórico operacional.", icon: MapPinned, resources: [{ title: "Pré-evento", description: "Planejamento, fornecedores e entregáveis." }, { title: "Acompanhamento", description: "Status, localização e registros." }, { title: "Pós-evento", description: "Avaliação e resultados alcançados." }], accent: "#96554e" },
  indicadores: { permission: "dashboard.read", eyebrow: "Business intelligence", title: "Indicadores", description: "Acompanhe indicadores de fornecedores, mídias, ações e eventos para tomada de decisão.", icon: BarChart3, resources: [{ title: "Performance", description: "Indicadores comparativos por fornecedor." }, { title: "Investimento", description: "Leitura de custos e pagamentos por operação." }, { title: "Mapa analítico", description: "Cobertura e resultados por localidade." }], accent: "#387071" },
  configuracoes: { permission: "settings.read", eyebrow: "Base cadastral", title: "Configurações", description: "Estruture regionais, cidades, lojas, fornecedores, serviços, parceiros e tipologias da operação.", icon: Settings2, resources: [{ title: "Estrutura territorial", description: "Regionais, cidades e lojas." }, { title: "Rede de parceiros", description: "Fornecedores, serviços e parceiros." }, { title: "Tipologias", description: "Tipos de mídia, ações e eventos." }], accent: "#45604f" },
} as const;

export default function ProtectedModule({ module }: { module: keyof typeof definitions }) {
  const { loading, isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f5f4ee]"><Loader2 className="h-6 w-6 animate-spin text-[#35635d]" /></div>;
  if (!isAuthenticated) return <LoginPage />;
  const definition = definitions[module];
  if (!hasModulePermission(user?.role, definition.permission)) {
    return <DashboardLayout><div className="grid min-h-[calc(100vh-220px)] place-items-center"><div className="max-w-md rounded-2xl border border-[#dee5dc] bg-white p-8 text-center shadow-sm"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#fbf0de] text-[#9e6729]"><LockKeyhole className="h-5 w-5" /></span><h1 className="mt-5 font-display text-2xl font-semibold text-[#253b38]">Acesso não autorizado</h1><p className="mt-3 text-sm leading-6 text-[#70817b]">Seu perfil não possui permissão para consultar este módulo. Solicite a liberação a um administrador.</p><Button variant="outline" onClick={() => setLocation("/")} className="mt-6 rounded-lg border-[#d8e0d7] text-xs text-[#41665d]"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Voltar ao início</Button></div></div></DashboardLayout>;
  }
  if (module === "estoque") return <DashboardLayout><InventoryWorkspace /></DashboardLayout>;
  if (module === "financeiro") return <DashboardLayout><FinanceWorkspace /></DashboardLayout>;
  if (module === "configuracoes") return <DashboardLayout><SettingsWorkspace /></DashboardLayout>;
  if (module === "midias") return <DashboardLayout><MediaWorkspace /><MediaCoverageExplorer /><MediaCampaignLibrary canWrite={hasModulePermission(user?.role, "media.write")} /><RegionalMediaPanel canWrite={hasModulePermission(user?.role, "media.write")} /></DashboardLayout>;
  if (module === "acoes") return <DashboardLayout><ActionsWorkspace /><TradeEvidencePanel mode="action" canWrite={hasModulePermission(user?.role, "actions.write")} /></DashboardLayout>;
  if (module === "eventos") return <DashboardLayout><EventsWorkspace /><TradeEvidencePanel mode="event" canWrite={hasModulePermission(user?.role, "events.write")} /></DashboardLayout>;
  if (module === "indicadores") return <DashboardLayout><IndicatorsWorkspace /></DashboardLayout>;
  return <DashboardLayout><ModulePage {...definition} /></DashboardLayout>;
}
