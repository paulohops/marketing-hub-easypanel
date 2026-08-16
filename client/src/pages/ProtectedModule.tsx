import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
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
import TeamsWorkspace from "./TeamsWorkspace";
import ActionPointsWorkspace from "./ActionPointsWorkspace";
import TradeOperationsWorkspace from "./TradeOperationsWorkspace";
import HelpWorkspace from "./HelpWorkspace";
import OperationalRegistriesWorkspace from "./OperationalRegistriesWorkspace";
import NotificationsWorkspace from "./NotificationsWorkspace";
import CompaniesWorkspace from "./CompaniesWorkspace";
import RegistryEntityWorkspace from "./RegistryEntityWorkspace";
import TrelloWorkspace from "./TrelloWorkspace";
import DataImportWorkspace from "./DataImportWorkspace";
import ReportExportWorkspace from "./ReportExportWorkspace";
import DesignWorkspace from "./DesignWorkspace";
import DataCenterWorkspace from "./DataCenterWorkspace";
import CampaignsWorkspace from "./CampaignsWorkspace";
import CampaignTemplatesWorkspace from "./CampaignTemplatesWorkspace";
import ActionTemplatesWorkspace from "./ActionTemplatesWorkspace";
import RegionalMediaPanel from "@/components/RegionalMediaPanel";
import MediaCampaignLibrary from "@/components/MediaCampaignLibrary";
import MediaCoverageExplorer from "@/components/MediaCoverageExplorer";
import UrbanVeiculationPage from "./UrbanVeiculationPage";
import { BarChart3, BellRing, Boxes, Building2, CalendarDays, CircleHelp, FileSpreadsheet, Flag, Landmark, MapPinned, Megaphone, Network, Settings2, ShieldCheck, UserRound } from "lucide-react";

const definitions = {
  estoque: { permission: "inventory.read", eyebrow: "Operação e materiais", title: "Estoque de materiais", description: "Controle entradas, saídas, saldo, transferências e histórico de materiais por regional e cidade.", icon: Boxes, resources: [{ title: "Catálogo de materiais", description: "Itens, SKU, categoria, unidade e estoque mínimo." }, { title: "Movimentações", description: "Entradas, saídas, ajustes e responsáveis." }, { title: "Saldo por território", description: "Visão consolidada por regional e cidade." }], accent: "var(--primary)" },
  financeiro: { permission: "finance.read", eyebrow: "Governança financeira", title: "Financeiro", description: "Acompanhe orçamento mensal, custos operacionais, notas fiscais e pagamentos vinculados à operação.", icon: Landmark, resources: [{ title: "Orçamento vivo", description: "Verba total, realizado e saldo por competência." }, { title: "Custos operacionais", description: "Composição de custos e aprovação segregada." }, { title: "Notas e pagamentos", description: "Documentos, fornecedores e vencimentos." }], accent: "var(--primary)" },
  operacoes: { permission: "operations.read", eyebrow: "Planejamento e execução", title: "Operações unificadas", description: "Organize ações de trade, mídias e eventos com alvará, evidências e feedback pós-ação.", icon: Flag, resources: [{ title: "Planejamento", description: "Tipo, denominação, cidade, fornecedor e agenda." }, { title: "Execução segura", description: "Alvará obrigatório antes da liberação quando aplicável." }, { title: "Pós-ação", description: "Evidências, feedback e histórico operacional." }], accent: "var(--primary)" },
  campanhas: { permission: "actions.read", eyebrow: "Operação integrada", title: "Campanhas", description: "Agrupe ações, eventos e mídias por objetivo, território e período.", icon: Flag, resources: [], accent: "var(--primary)" },
  midias: { permission: "media.read", eyebrow: "Canais e cobertura", title: "Mídias e campanhas", description: "Cadastre pontos, campanhas, ciclos de renovação e evidências de veiculação.", icon: Megaphone, resources: [{ title: "Pontos de mídia", description: "Localização, fornecedor e tipo de mídia." }, { title: "Campanhas", description: "Vigência, renovação e resultado." }, { title: "Cobertura regional", description: "Filtros por regional e cidade." }], accent: "var(--primary)" },
  "midias-graficas": { permission: "media.read", eyebrow: "Canais e cobertura", title: "Mídia Urbana", description: "Planeje e acompanhe outdoors, painéis e superfícies urbanas.", icon: Megaphone, resources: [], accent: "var(--primary)" },
  "midias-audio-video": { permission: "media.read", eyebrow: "Canais e cobertura", title: "Mídia Tradicional", description: "Acompanhe rádios, TVs, spots e horários de veiculação.", icon: Megaphone, resources: [], accent: "var(--primary)" },
  "midias-panfletagem": { permission: "media.read", eyebrow: "Canais e cobertura", title: "Panfletagem", description: "Planeje distribuição territorial vinculada às campanhas.", icon: Megaphone, resources: [], accent: "var(--primary)" },
  "midias-carro-som": { permission: "media.read", eyebrow: "Canais e cobertura", title: "Carro de som", description: "Controle spots, agenda, rodagem e comprovações.", icon: Megaphone, resources: [], accent: "var(--primary)" },
  "midias-influencers": { permission: "media.read", eyebrow: "Canais e cobertura", title: "Influencers", description: "Planeje e acompanhe operações com influenciadores.", icon: Megaphone, resources: [], accent: "var(--primary)" },
  "midias-veiculacao": { permission: "media.read", eyebrow: "Canais e cobertura", title: "Veiculação de Mídia Urbana", description: "Acompanhe o planejamento, status, evidências e debriefing da veiculação selecionada.", icon: Megaphone, resources: [], accent: "var(--primary)" },
  acoes: { permission: "actions.read", eyebrow: "Ativação de marca", title: "Ações de trade", description: "Planeje, execute e documente ações, serviços, fornecedores e debriefings.", icon: CalendarDays, resources: [{ title: "Planejamento", description: "Objetivo, agenda e fornecedores envolvidos." }, { title: "Execução", description: "Status, evidências e acompanhamento." }, { title: "Debriefing", description: "Nota, resultado, pontos positivos e negativos." }], accent: "var(--primary)" },
  eventos: { permission: "events.read", eyebrow: "Experiências presenciais", title: "Eventos", description: "Centralize etapas de pré-evento, execução, avaliação e histórico operacional.", icon: MapPinned, resources: [{ title: "Pré-evento", description: "Planejamento, fornecedores e entregáveis." }, { title: "Acompanhamento", description: "Status, localização e registros." }, { title: "Pós-evento", description: "Avaliação e resultados alcançados." }], accent: "var(--primary)" },
  indicadores: { permission: "dashboard.read", eyebrow: "Business intelligence", title: "Indicadores", description: "Acompanhe indicadores de fornecedores, mídias, ações e eventos para tomada de decisão.", icon: BarChart3, resources: [{ title: "Performance", description: "Indicadores comparativos por fornecedor." }, { title: "Investimento", description: "Leitura de custos e pagamentos por operação." }, { title: "Mapa analítico", description: "Cobertura e resultados por localidade." }], accent: "var(--primary)" },
  configuracoes: { permission: "settings.read", eyebrow: "Administração do sistema", title: "Configurações", description: "Gerencie cadastros operacionais, usuários, segurança e a governança que abastece cada módulo.", icon: Settings2, resources: [{ title: "Segurança", description: "Papéis, permissões e rastreabilidade." }, { title: "Usuários", description: "Acessos e administração da equipe." }, { title: "Cadastros operacionais", description: "Empresas, territórios, fornecedores, serviços, mídias e parâmetros financeiros." }], accent: "var(--primary)" },
  cadastros: { permission: "settings.read", eyebrow: "Gestão operacional", title: "Cadastros operacionais", description: "Organize os cadastros mestres que sustentam a operação do Marketing HUB.", icon: Settings2, resources: [], accent: "var(--primary)" },
  "modelos-campanha": { permission: "settings.read", eyebrow: "Gestão operacional", title: "Modelos de campanha", description: "Padronize estruturas reutilizáveis para os planejamentos de campanha.", icon: FileSpreadsheet, resources: [], accent: "var(--primary)" },
  "modelos-acao": { permission: "settings.read", eyebrow: "Gestão operacional", title: "Modelos de ações", description: "Padronize informações reutilizáveis para o planejamento de ações.", icon: FileSpreadsheet, resources: [], accent: "var(--primary)" },
  "cadastro-influencers": { permission: "settings.read", eyebrow: "Cadastros operacionais", title: "Influencers", description: "Mantenha influenciadores, grupos, agenda de postagens e dados de pagamento para as operações de mídia.", icon: UserRound, resources: [], accent: "var(--primary)" },
  "cadastro-entidade": { permission: "settings.read", eyebrow: "Gestão operacional", title: "Cadastro operacional", description: "Consulte e mantenha as informações detalhadas do cadastro selecionado.", icon: Settings2, resources: [], accent: "var(--primary)" },
  empresas: { permission: "settings.read", eyebrow: "Gestão operacional", title: "Empresas", description: "Consulte empresas, dados de faturamento e relações territoriais.", icon: Building2, resources: [], accent: "var(--primary)" },
  trello: { permission: "settings.read", eyebrow: "Gestão integrada", title: "Trello", description: "Acesse o quadro integrado de gestão da equipe.", icon: Flag, resources: [], accent: "var(--primary)" },
  importacao: { permission: "settings.write", eyebrow: "Administração do sistema", title: "Importar cadastros", description: "Valide e importe dados estruturados por planilha.", icon: Settings2, resources: [], accent: "var(--primary)" },
  exportacao: { permission: "settings.read", eyebrow: "Administração do sistema", title: "Exportar relatórios", description: "Exporte dados operacionais e financeiros por período.", icon: FileSpreadsheet, resources: [], accent: "var(--primary)" },
  perfil: { permission: "dashboard.read", eyebrow: "Conta e segurança", title: "Meu perfil", description: "Mantenha seus dados pessoais atualizados.", icon: UserRound, resources: [], accent: "var(--primary)" },
  usuarios: { permission: "settings.read", eyebrow: "Acesso administrativo", title: "Usuários e permissões", description: "Gerencie papéis e acessos operacionais.", icon: ShieldCheck, resources: [], accent: "var(--primary)" },
  equipes: { permission: "settings.read", eyebrow: "Acesso administrativo", title: "Equipes", description: "Visualize e gerencie a hierarquia da equipe.", icon: Network, resources: [], accent: "var(--primary)" },
  "pontos-de-acao": { permission: "settings.read", eyebrow: "Cadastros operacionais", title: "Pontos de ação", description: "Gerencie locais recorrentes para ações de trade.", icon: MapPinned, resources: [], accent: "var(--primary)" },
  ajuda: { permission: "dashboard.read", eyebrow: "Central de conhecimento", title: "Ajuda e suporte", description: "Consulte os fluxos do sistema e envie solicitações de suporte.", icon: CircleHelp, resources: [], accent: "var(--primary)" },
  notificacoes: { permission: "dashboard.read", eyebrow: "Acompanhamento operacional", title: "Notificações", description: "Acompanhe alertas direcionados a pessoas, regionais e cidades.", icon: BellRing, resources: [], accent: "var(--primary)" },
  "central-de-dados": { permission: "settings.read", eyebrow: "Administração do sistema", title: "Central de Dados", description: "Importe cadastros e exporte relatórios.", icon: FileSpreadsheet, resources: [], accent: "var(--primary)" },
  design: { permission: "settings.read", eyebrow: "Identidade visual", title: "Design", description: "Personalize o tema e a identidade visual.", icon: Settings2, resources: [], accent: "var(--primary)" },
} as const;

export default function ProtectedModule({ module }: { module: keyof typeof definitions }) {
  const { loading, isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const { can: canPermission, isLoading: permissionsLoading } = useEffectivePermissions();
  if (loading) return <div className="cluster-grid grid min-h-screen place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isAuthenticated) return <LoginPage />;
  const definition = definitions[module];
  if (permissionsLoading) return <DashboardLayout><div className="grid min-h-[calc(100vh-220px)] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></DashboardLayout>;
  const hasReadPermission = canPermission(definition.permission);
  if (!hasReadPermission) {
    return <DashboardLayout><div className="grid min-h-[calc(100vh-220px)] place-items-center"><div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent text-sidebar-primary"><LockKeyhole className="h-5 w-5" /></span><h1 className="mt-5 font-display text-2xl font-semibold text-foreground">Acesso não autorizado</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Seu perfil não possui permissão para consultar este módulo. Solicite a liberação a um administrador.</p><Button variant="outline" onClick={() => setLocation("/")} className="mt-6 rounded-lg border-border text-xs text-primary"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Voltar ao início</Button></div></div></DashboardLayout>;
  }
  if (module === "estoque") return <DashboardLayout><div className="cluster-workspace"><InventoryWorkspace /></div></DashboardLayout>;
  if (module === "financeiro") return <DashboardLayout><div className="cluster-workspace"><FinanceWorkspace /></div></DashboardLayout>;
  if (module === "operacoes") return <DashboardLayout><div className="cluster-workspace"><TradeOperationsWorkspace /></div></DashboardLayout>;
  if (module === "campanhas") return <DashboardLayout><div className="cluster-workspace"><CampaignsWorkspace /></div></DashboardLayout>;
  if (module === "configuracoes") return <DashboardLayout><div className="cluster-workspace"><SettingsWorkspace /></div></DashboardLayout>;
  if (module === "central-de-dados") return <DashboardLayout><div className="cluster-workspace"><DataCenterWorkspace /></div></DashboardLayout>;
  if (module === "design") return <DashboardLayout><div className="cluster-workspace"><DesignWorkspace /></div></DashboardLayout>;
  if (module === "cadastros") return <DashboardLayout><div className="cluster-workspace"><OperationalRegistriesWorkspace /></div></DashboardLayout>;
  if (module === "modelos-campanha") return <DashboardLayout><div className="cluster-workspace"><CampaignTemplatesWorkspace /></div></DashboardLayout>;
  if (module === "modelos-acao") return <DashboardLayout><div className="cluster-workspace"><ActionTemplatesWorkspace /></div></DashboardLayout>;
  if (module === "cadastro-influencers") return <DashboardLayout><div className="cluster-workspace"><div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-border bg-card p-10 text-center"><h1 className="font-display text-2xl font-semibold text-foreground">Influencers</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Este módulo está disponível no menu, mas permanece desativado temporariamente.</p><Button type="button" variant="outline" className="mt-6 border-border" onClick={() => setLocation("/")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao início</Button></div></div></DashboardLayout>;
  if (module === "cadastro-entidade") return <DashboardLayout><div className="cluster-workspace"><RegistryEntityWorkspace /></div></DashboardLayout>;
  if (module === "empresas") return <DashboardLayout><div className="cluster-workspace"><CompaniesWorkspace /></div></DashboardLayout>;
  if (module === "trello") return <DashboardLayout><div className="cluster-workspace"><TrelloWorkspace /></div></DashboardLayout>;
  if (module === "importacao") return <DashboardLayout><div className="cluster-workspace"><DataImportWorkspace /></div></DashboardLayout>;
  if (module === "exportacao") return <DashboardLayout><div className="cluster-workspace"><ReportExportWorkspace /></div></DashboardLayout>;
  const canWrite = (permission: string) => canPermission(permission);
  if (module === "midias") return <DashboardLayout><div className="cluster-workspace"><MediaWorkspace /><MediaCoverageExplorer /><MediaCampaignLibrary canWrite={canWrite("media.write")} /><RegionalMediaPanel canWrite={canWrite("media.write")} /></div></DashboardLayout>;
  if (module === "midias-graficas") return <DashboardLayout><div className="cluster-workspace"><MediaWorkspace initialCategory="graphics" /></div></DashboardLayout>;
  if (module === "midias-audio-video") return <DashboardLayout><div className="cluster-workspace"><MediaWorkspace initialCategory="audio_video" /></div></DashboardLayout>;
  if (module === "midias-panfletagem") return <DashboardLayout><div className="cluster-workspace"><MediaWorkspace initialCategory="leafleting" /></div></DashboardLayout>;
  if (module === "midias-carro-som") return <DashboardLayout><div className="cluster-workspace"><MediaWorkspace initialCategory="sound_car" /></div></DashboardLayout>;
  if (module === "midias-influencers") return <DashboardLayout><div className="cluster-workspace"><div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-border bg-card p-10 text-center"><h1 className="font-display text-2xl font-semibold text-foreground">Influencers</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Este módulo está disponível no menu, mas permanece desativado temporariamente.</p><Button type="button" variant="outline" className="mt-6 border-border" onClick={() => setLocation("/")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao início</Button></div></div></DashboardLayout>;
  if (module === "midias-veiculacao") return <DashboardLayout><div className="cluster-workspace"><UrbanVeiculationPage /></div></DashboardLayout>;
  if (module === "acoes") return <DashboardLayout><div className="cluster-workspace"><ActionsWorkspace /></div></DashboardLayout>;
  if (module === "eventos") return <DashboardLayout><div className="cluster-workspace"><EventsWorkspace /></div></DashboardLayout>;
  if (module === "indicadores") return <DashboardLayout><div className="cluster-workspace"><IndicatorsWorkspace /></div></DashboardLayout>;
  if (module === "perfil") return <DashboardLayout><div className="cluster-workspace"><ProfileWorkspace /></div></DashboardLayout>;
  if (module === "usuarios") return <DashboardLayout><div className="cluster-workspace"><UserAdministrationWorkspace /></div></DashboardLayout>;
  if (module === "equipes") return <DashboardLayout><div className="cluster-workspace"><TeamsWorkspace /></div></DashboardLayout>;
  if (module === "pontos-de-acao") return <DashboardLayout><div className="cluster-workspace"><ActionPointsWorkspace /></div></DashboardLayout>;
  if (module === "ajuda") return <DashboardLayout><div className="cluster-workspace"><HelpWorkspace /></div></DashboardLayout>;
  if (module === "notificacoes") return <DashboardLayout><div className="cluster-workspace"><NotificationsWorkspace /></div></DashboardLayout>;
  return <DashboardLayout><ModulePage {...definition} /></DashboardLayout>;
}
