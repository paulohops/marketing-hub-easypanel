import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { hasModulePermission } from "@/lib/permissions";
import { trpc } from "@/lib/trpc";
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
import ProfileWorkspace from "./ProfileWorkspace";
import UserAdministrationWorkspace from "./UserAdministrationWorkspace";
import TradeOperationsWorkspace from "./TradeOperationsWorkspace";
import TradeEvidencePanel from "@/components/TradeEvidencePanel";
import RegionalMediaPanel from "@/components/RegionalMediaPanel";
import MediaCampaignLibrary from "@/components/MediaCampaignLibrary";
import MediaCoverageExplorer from "@/components/MediaCoverageExplorer";
import { BarChart3, Boxes, CalendarDays, Flag, Landmark, MapPinned, Megaphone, Settings2, ShieldCheck, UserRound } from "lucide-react";

const definitions = {
  estoque: { permission: "inventory.read", eyebrow: "Operação e materiais", title: "Estoque de materiais", description: "Controle entradas, saídas, saldo, transferências e histórico de materiais por regional e cidade.", icon: Boxes, resources: [{ title: "Catálogo de materiais", description: "Itens, SKU, categoria, unidade e estoque mínimo." }, { title: "Movimentações", description: "Entradas, saídas, ajustes e responsáveis." }, { title: "Saldo por território", description: "Visão consolidada por regional e cidade." }], accent: "var(--primary)" },
  financeiro: { permission: "finance.read", eyebrow: "Governança financeira", title: "Financeiro", description: "Acompanhe orçamento mensal, custos operacionais, notas fiscais e pagamentos vinculados à operação.", icon: Landmark, resources: [{ title: "Orçamento vivo", description: "Verba total, realizado e saldo por competência." }, { title: "Custos operacionais", description: "Composição de custos e aprovação segregada." }, { title: "Notas e pagamentos", description: "Documentos, fornecedores e vencimentos." }], accent: "var(--primary)" },
  operacoes: { permission: "operations.read", eyebrow: "Planejamento e execução", title: "Operações unificadas", description: "Organize ações de trade, mídias e eventos com alvará, evidências e feedback pós-ação.", icon: Flag, resources: [{ title: "Planejamento", description: "Tipo, denominação, cidade, fornecedor e agenda." }, { title: "Execução segura", description: "Alvará obrigatório antes da liberação quando aplicável." }, { title: "Pós-ação", description: "Evidências, feedback e histórico operacional." }], accent: "var(--primary)" },
  midias: { permission: "media.read", eyebrow: "Canais e cobertura", title: "Mídias e campanhas", description: "Cadastre pontos, campanhas, ciclos de renovação e evidências de veiculação.", icon: Megaphone, resources: [{ title: "Pontos de mídia", description: "Localização, fornecedor e tipo de mídia." }, { title: "Campanhas", description: "Vigência, renovação e resultado." }, { title: "Cobertura regional", description: "Filtros por regional e cidade." }], accent: "var(--primary)" },
  acoes: { permission: "actions.read", eyebrow: "Ativação de marca", title: "Ações de trade", description: "Planeje, execute e documente ações, serviços, fornecedores e debriefings.", icon: CalendarDays, resources: [{ title: "Planejamento", description: "Objetivo, agenda e fornecedores envolvidos." }, { title: "Execução", description: "Status, evidências e acompanhamento." }, { title: "Debriefing", description: "Nota, resultado, pontos positivos e negativos." }], accent: "var(--primary)" },
  eventos: { permission: "events.read", eyebrow: "Experiências presenciais", title: "Eventos", description: "Centralize etapas de pré-evento, execução, avaliação e histórico operacional.", icon: MapPinned, resources: [{ title: "Pré-evento", description: "Planejamento, fornecedores e entregáveis." }, { title: "Acompanhamento", description: "Status, localização e registros." }, { title: "Pós-evento", description: "Avaliação e resultados alcançados." }], accent: "var(--primary)" },
  indicadores: { permission: "dashboard.read", eyebrow: "Business intelligence", title: "Indicadores", description: "Acompanhe indicadores de fornecedores, mídias, ações e eventos para tomada de decisão.", icon: BarChart3, resources: [{ title: "Performance", description: "Indicadores comparativos por fornecedor." }, { title: "Investimento", description: "Leitura de custos e pagamentos por operação." }, { title: "Mapa analítico", description: "Cobertura e resultados por localidade." }], accent: "var(--primary)" },
  configuracoes: { permission: "settings.read", eyebrow: "Administração do sistema", title: "Configurações", description: "Gerencie segurança, usuários e os cadastros operacionais que abastecem cada módulo.", icon: Settings2, resources: [{ title: "Segurança", description: "Papéis, permissões e rastreabilidade." }, { title: "Usuários", description: "Acessos e administração da equipe." }, { title: "Cadastros operacionais", description: "Empresas, territórios, fornecedores, serviços, mídias e parâmetros financeiros." }], accent: "var(--primary)" },
  perfil: { permission: "dashboard.read", eyebrow: "Conta e segurança", title: "Meu perfil", description: "Mantenha seus dados pessoais atualizados.", icon: UserRound, resources: [], accent: "var(--primary)" },
  usuarios: { permission: "settings.read", eyebrow: "Acesso administrativo", title: "Usuários e permissões", description: "Gerencie papéis e acessos operacionais.", icon: ShieldCheck, resources: [], accent: "var(--primary)" },
} as const;

export default function ProtectedModule({ module }: { module: keyof typeof definitions }) {
  const { loading, isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const effectivePermissions = trpc.users.effectivePermissions.useQuery(undefined, { enabled: isAuthenticated });
  if (loading) return <div className="cluster-grid grid min-h-screen place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isAuthenticated) return <LoginPage />;
  const definition = definitions[module];
  const hasReadPermission = user?.role === "admin" || (effectivePermissions.isSuccess ? effectivePermissions.data.includes(definition.permission) : hasModulePermission(user?.role, definition.permission));
  if (!hasReadPermission) {
    return <DashboardLayout><div className="grid min-h-[calc(100vh-220px)] place-items-center"><div className="max-w-md rounded-2xl border border-border bg-white p-8 text-center shadow-sm"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent text-sidebar-primary"><LockKeyhole className="h-5 w-5" /></span><h1 className="mt-5 font-display text-2xl font-semibold text-foreground">Acesso não autorizado</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Seu perfil não possui permissão para consultar este módulo. Solicite a liberação a um administrador.</p><Button variant="outline" onClick={() => setLocation("/")} className="mt-6 rounded-lg border-border text-xs text-primary"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Voltar ao início</Button></div></div></DashboardLayout>;
  }
  if (module === "estoque") return <DashboardLayout><div className="cluster-workspace"><InventoryWorkspace /></div></DashboardLayout>;
  if (module === "financeiro") return <DashboardLayout><div className="cluster-workspace"><FinanceWorkspace /></div></DashboardLayout>;
  if (module === "operacoes") return <DashboardLayout><div className="cluster-workspace"><TradeOperationsWorkspace /></div></DashboardLayout>;
  if (module === "configuracoes") return <DashboardLayout><div className="cluster-workspace"><SettingsWorkspace /></div></DashboardLayout>;
  const canWrite = (permission: string) => user?.role === "admin" || (effectivePermissions.isSuccess ? effectivePermissions.data.includes(permission) : hasModulePermission(user?.role, permission));
  if (module === "midias") return <DashboardLayout><div className="cluster-workspace"><MediaWorkspace /><MediaCoverageExplorer /><MediaCampaignLibrary canWrite={canWrite("media.write")} /><RegionalMediaPanel canWrite={canWrite("media.write")} /></div></DashboardLayout>;
  if (module === "acoes") return <DashboardLayout><div className="cluster-workspace"><ActionsWorkspace /><TradeEvidencePanel mode="action" canWrite={canWrite("actions.write")} /></div></DashboardLayout>;
  if (module === "eventos") return <DashboardLayout><div className="cluster-workspace"><EventsWorkspace /><TradeEvidencePanel mode="event" canWrite={canWrite("events.write")} /></div></DashboardLayout>;
  if (module === "indicadores") return <DashboardLayout><div className="cluster-workspace"><IndicatorsWorkspace /></div></DashboardLayout>;
  if (module === "perfil") return <DashboardLayout><div className="cluster-workspace"><ProfileWorkspace /></div></DashboardLayout>;
  if (module === "usuarios") return <DashboardLayout><div className="cluster-workspace"><UserAdministrationWorkspace /></div></DashboardLayout>;
  return <DashboardLayout><ModulePage {...definition} /></DashboardLayout>;
}
