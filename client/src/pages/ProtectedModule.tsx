import { lazy, Suspense, type ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { ArrowLeft, LockKeyhole, Loader2 } from "lucide-react";
import { Redirect, useLocation, useRoute } from "wouter";
import LoginPage from "./LoginPage";
import ModulePage from "./ModulePage";
const FinanceWorkspace = lazy(() => import("./FinanceWorkspace"));
const InventoryWorkspace = lazy(() => import("./InventoryWorkspace"));
const SettingsWorkspace = lazy(() => import("./SettingsWorkspace"));
const MediaWorkspace = lazy(() => import("./MediaWorkspace"));
const TraditionalMediaWorkspace = lazy(() => import("./TraditionalMediaWorkspace"));
const MidiaVolanteWorkspace = lazy(() => import("./MidiaVolanteWorkspace"));
const MidiaVolanteDetails = lazy(() => import("./MidiaVolanteDetails"));
const MidiaVolanteVeiculacaoPage = lazy(() => import("./MidiaVolanteVeiculacaoPage"));
const TraditionalVeiculationPage = lazy(() => import("./TraditionalVeiculationPage"));
const ActionsWorkspace = lazy(() => import("./ActionsWorkspace"));
const EventsWorkspace = lazy(() => import("./EventsWorkspace"));
const IndicatorsWorkspace = lazy(() => import("./IndicatorsWorkspace"));
const ProfileWorkspace = lazy(() => import("./ProfileWorkspace"));
const UserAdministrationWorkspace = lazy(() => import("./UserAdministrationWorkspace"));
const TeamsWorkspace = lazy(() => import("./TeamsWorkspace"));
const ActionPointsWorkspace = lazy(() => import("./ActionPointsWorkspace"));
const TradeOperationsWorkspace = lazy(() => import("./TradeOperationsWorkspace"));
const HelpWorkspace = lazy(() => import("./HelpWorkspace"));
const KnowledgeTopicWorkspace = lazy(() => import("./KnowledgeTopicWorkspace"));
const OperationalRegistriesWorkspace = lazy(() => import("./OperationalRegistriesWorkspace"));
const NotificationsWorkspace = lazy(() => import("./NotificationsWorkspace"));
const CompaniesWorkspace = lazy(() => import("./CompaniesWorkspace"));
const RegistryEntityWorkspace = lazy(() => import("./RegistryEntityWorkspace"));
const TrelloWorkspace = lazy(() => import("./TrelloWorkspace"));
const TasksWorkspace = lazy(() => import("./TasksWorkspace"));
const DataImportWorkspace = lazy(() => import("./DataImportWorkspace"));
const ReportExportWorkspace = lazy(() => import("./ReportExportWorkspace"));
const DesignWorkspace = lazy(() => import("./DesignWorkspace"));
const SystemWorkspace = lazy(() => import("./SystemWorkspace"));
const DataCenterWorkspace = lazy(() => import("./DataCenterWorkspace"));
const CampaignsWorkspace = lazy(() => import("./CampaignsWorkspace"));
const CampaignTemplatesWorkspace = lazy(() => import("./CampaignTemplatesWorkspace"));
const ProcessesWorkspace = lazy(() => import("./ProcessesWorkspace"));
const ActionTemplatesWorkspace = lazy(() => import("./ActionTemplatesWorkspace"));
const RegionalMediaPanel = lazy(() => import("@/components/RegionalMediaPanel"));
const MediaCampaignLibrary = lazy(() => import("@/components/MediaCampaignLibrary"));
const MediaCoverageExplorer = lazy(() => import("@/components/MediaCoverageExplorer"));
const UrbanVeiculationPage = lazy(() => import("./UrbanVeiculationPage"));
const TraditionalProgramDetails = lazy(() => import("./TraditionalProgramDetails"));
const ExternalMediaPointDetails = lazy(() => import("./ExternalMediaPointDetails"));
import { BarChart3, BellRing, Boxes, Building2, CalendarDays, CircleHelp, ClipboardList, FileSpreadsheet, Flag, Inbox, Landmark, MapPinned, Megaphone, Network, Settings2, ShieldCheck, UserRound } from "lucide-react";

const definitions = {
  estoque: { permission: "inventory.read", eyebrow: "Operação e materiais", title: "Estoque de materiais", description: "Controle entradas, saídas, saldo, transferências e histórico de materiais por regional e cidade.", icon: Boxes, resources: [{ title: "Catálogo de materiais", description: "Itens, SKU, categoria, unidade e estoque mínimo." }, { title: "Movimentações", description: "Entradas, saídas, ajustes e responsáveis." }, { title: "Saldo por território", description: "Visão consolidada por regional e cidade." }], accent: "var(--primary)" },
  financeiro: { permission: "finance.read", eyebrow: "Governança financeira", title: "Financeiro", description: "Acompanhe orçamento mensal, custos operacionais, notas fiscais e pagamentos vinculados à operação.", icon: Landmark, resources: [{ title: "Orçamento vivo", description: "Verba total, realizado e saldo por competência." }, { title: "Custos operacionais", description: "Composição de custos e aprovação segregada." }, { title: "Notas e pagamentos", description: "Documentos, fornecedores e vencimentos." }], accent: "var(--primary)" },
  operacoes: { permission: "operations.read", eyebrow: "Planejamento e execução", title: "Operações unificadas", description: "Organize ações de trade, mídias e eventos com alvará, evidências e feedback pós-ação.", icon: Flag, resources: [{ title: "Planejamento", description: "Tipo, denominação, cidade, fornecedor e agenda." }, { title: "Execução segura", description: "Alvará obrigatório antes da liberação quando aplicável." }, { title: "Pós-ação", description: "Evidências, feedback e histórico operacional." }], accent: "var(--primary)" },
  campanhas: { permission: "actions.read", eyebrow: "Operação integrada", title: "Campanhas", description: "Agrupe ações, eventos e mídias por objetivo, território e período.", icon: Flag, resources: [], accent: "var(--primary)" },
  midias: { permission: "media.read", eyebrow: "Canais e cobertura", title: "Mídias e campanhas", description: "Cadastre pontos, campanhas, ciclos de renovação e evidências de veiculação.", icon: Megaphone, resources: [{ title: "Pontos de mídia", description: "Localização, fornecedor e tipo de mídia." }, { title: "Campanhas", description: "Vigência, renovação e resultado." }, { title: "Cobertura regional", description: "Filtros por regional e cidade." }], accent: "var(--primary)" },
  "midias-graficas": { permission: "media.read", eyebrow: "Canais e cobertura", title: "Mídia Urbana", description: "Planeje e acompanhe outdoors, painéis e superfícies urbanas.", icon: Megaphone, resources: [], accent: "var(--primary)" },
  "midias-externa": { permission: "media.read", eyebrow: "Canais e cobertura", title: "Mídia Externa", description: "Controle panfletagem, carro de som e outras ativações externas em uma ficha operacional própria.", icon: Megaphone, resources: [], accent: "var(--primary)" },
  "midias-audio-video": { permission: "media.read", eyebrow: "Canais e cobertura", title: "Mídia Audiovisual", description: "Acompanhe rádios, TVs, spots e horários de veiculação.", icon: Megaphone, resources: [], accent: "var(--primary)" },
  "midias-tradicional": { permission: "media.read", eyebrow: "Canais e cobertura", title: "Programa de Mídia Audiovisual", description: "Ficha de rádio ou TV, alcance do sinal, spots e histórico operacional.", icon: Megaphone, resources: [], accent: "var(--primary)" },
  "midias-tradicional-veiculacao": { permission: "media.read", eyebrow: "Canais e cobertura", title: "Veiculação Audiovisual", description: "Acompanhe o spot, as cidades de sinal, evidências, status e debriefing.", icon: Megaphone, resources: [], accent: "var(--primary)" },
  "midias-volante": { permission: "media.read", eyebrow: "Canais e cobertura", title: "Mídia Volante", description: "Acompanhe pontos, spots, programação e veiculações de mídia volante.", icon: Megaphone, resources: [], accent: "var(--primary)" },
  "midias-volante-detalhe": { permission: "media.read", eyebrow: "Canais e cobertura", title: "Ponto de Mídia Volante", description: "Consulte os dados do ponto, a programação, as veiculações e o histórico operacional.", icon: Megaphone, resources: [], accent: "var(--primary)" },
  "midias-volante-veiculacao": { permission: "media.read", eyebrow: "Canais e cobertura", title: "Veiculação de Mídia Volante", description: "Acompanhe o spot, cidades, evidências, status e debriefing da veiculação.", icon: Megaphone, resources: [], accent: "var(--primary)" },
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
  tarefas: { permission: "tasks.read", eyebrow: "Gestão integrada", title: "Tarefas", description: "Organize responsabilidades, pendências e entregas em um painel Kanban compartilhado.", icon: ClipboardList, resources: [], accent: "var(--primary)" },
  processos: { permission: "operations.read", eyebrow: "Gestão integrada", title: "Processos", description: "Documente processos do Trade com descritivo operacional, governança de versão e arquivos oficiais.", icon: ClipboardList, resources: [], accent: "var(--primary)" },
  importacao: { permission: "settings.write", eyebrow: "Administração do sistema", title: "Importar cadastros", description: "Valide e importe dados estruturados por planilha.", icon: Settings2, resources: [], accent: "var(--primary)" },
  exportacao: { permission: "settings.read", eyebrow: "Administração do sistema", title: "Exportar relatórios", description: "Exporte dados operacionais e financeiros por período.", icon: FileSpreadsheet, resources: [], accent: "var(--primary)" },
  perfil: { permission: "dashboard.read", eyebrow: "Conta e segurança", title: "Meu perfil", description: "Mantenha seus dados pessoais atualizados.", icon: UserRound, resources: [], accent: "var(--primary)" },
  usuarios: { permission: "settings.read", eyebrow: "Acesso administrativo", title: "Usuários e permissões", description: "Gerencie papéis e acessos operacionais.", icon: ShieldCheck, resources: [], accent: "var(--primary)" },
  equipes: { permission: "settings.read", eyebrow: "Acesso administrativo", title: "Equipes", description: "Visualize e gerencie a hierarquia da equipe.", icon: Network, resources: [], accent: "var(--primary)" },
  "pontos-de-acao": { permission: "settings.read", eyebrow: "Cadastros operacionais", title: "Pontos de ação", description: "Gerencie locais recorrentes para ações de trade.", icon: MapPinned, resources: [], accent: "var(--primary)" },
  "central-conhecimento": { permission: "dashboard.read", eyebrow: "Central de conhecimento", title: "Central de Conhecimento", description: "Consulte páginas detalhadas sobre os módulos, relacionamentos, preenchimento dos campos e fluxos operacionais.", icon: CircleHelp, resources: [], accent: "var(--primary)" },
  notificacoes: { permission: "dashboard.read", eyebrow: "Acompanhamento operacional", title: "Notificações", description: "Acompanhe alertas direcionados a pessoas, regionais e cidades.", icon: BellRing, resources: [], accent: "var(--primary)" },
  "central-de-dados": { permission: "settings.read", eyebrow: "Administração do sistema", title: "Central de Dados", description: "Importe cadastros e exporte relatórios.", icon: FileSpreadsheet, resources: [], accent: "var(--primary)" },
  design: { permission: "settings.read", eyebrow: "Identidade visual", title: "Design", description: "Personalize o tema e a identidade visual.", icon: Settings2, resources: [], accent: "var(--primary)" },
  sistema: { permission: "settings.read", eyebrow: "Administração do sistema", title: "Sistema", description: "Configure SMTP, notificações por e-mail e chaves de integrações.", icon: Settings2, resources: [], accent: "var(--primary)" },
} as const;

export default function ProtectedModule({ module, topicId, processId }: { module: keyof typeof definitions; topicId?: string; processId?: string }) {
  const { loading, isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();
  const [, traditionalPointParams] = useRoute("/midias/tradicional/:mediaPointId");
  const [, audiovisualPointParams] = useRoute("/midias/audiovisual/:mediaPointId");
  const [, externalPointParams] = useRoute("/midias/externa/:mediaPointId");
  const [, volantePointParams] = useRoute("/midias/volante/:mediaPointId");
  const { can: canPermission, isLoading: permissionsLoading } = useEffectivePermissions();
  if (loading) return <div className="cluster-grid grid min-h-screen place-items-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!isAuthenticated) return <LoginPage />;
  const definition = definitions[module];
  if (permissionsLoading) return <DashboardLayout><div className="grid min-h-[calc(100vh-220px)] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></DashboardLayout>;
  const hasReadPermission = module === "perfil" && user?.mustChangePassword ? true : canPermission(definition.permission);
  if (!hasReadPermission) {
    return <DashboardLayout><div className="grid min-h-[calc(100vh-220px)] place-items-center"><div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent text-sidebar-primary"><LockKeyhole className="h-5 w-5" /></span><h1 className="mt-5 font-display text-2xl font-semibold text-foreground">Acesso não autorizado</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Seu perfil não possui permissão para consultar este módulo. Solicite a liberação a um administrador.</p><Button variant="outline" onClick={() => setLocation("/")} className="mt-6 rounded-lg border-border text-xs text-primary"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Voltar ao início</Button></div></div></DashboardLayout>;
  }
  if (user?.mustChangePassword && module !== "perfil") return <Redirect to="/perfil?primeiro-acesso=1" replace />;
  const loadingFallback = <div className="grid min-h-[calc(100vh-220px)] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const workspace = (content: ReactNode) => <DashboardLayout><div className="cluster-workspace"><Suspense fallback={loadingFallback}>{content}</Suspense></div></DashboardLayout>;
  if (module === "estoque") return workspace(<InventoryWorkspace />);
  if (module === "financeiro") return workspace(<FinanceWorkspace />);
  if (module === "operacoes") return workspace(<TradeOperationsWorkspace />);
  if (module === "campanhas") return workspace(<CampaignsWorkspace />);
  if (module === "configuracoes") return workspace(<SettingsWorkspace />);
  if (module === "central-de-dados") return workspace(<DataCenterWorkspace />);
  if (module === "design") return workspace(<DesignWorkspace />);
  if (module === "sistema") return workspace(<SystemWorkspace />);
  if (module === "cadastros") return workspace(<OperationalRegistriesWorkspace />);
  if (module === "modelos-campanha") return workspace(<CampaignTemplatesWorkspace />);
  if (module === "modelos-acao") return workspace(<ActionTemplatesWorkspace />);
  if (module === "cadastro-influencers") return <DashboardLayout><div className="cluster-workspace"><div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-border bg-card p-10 text-center"><h1 className="font-display text-2xl font-semibold text-foreground">Influencers</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Este módulo está disponível no menu, mas permanece desativado temporariamente.</p><Button type="button" variant="outline" className="mt-6 border-border" onClick={() => setLocation("/")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao início</Button></div></div></DashboardLayout>;
  if (module === "cadastro-entidade") return workspace(<RegistryEntityWorkspace />);
  if (module === "empresas") return workspace(<CompaniesWorkspace />);
  if (module === "trello") return workspace(<TrelloWorkspace />);
  if (module === "tarefas") return workspace(<TasksWorkspace />);
  if (module === "processos") return workspace(<ProcessesWorkspace processId={processId} />);
  if (module === "importacao") return workspace(<DataImportWorkspace />);
  if (module === "exportacao") return workspace(<ReportExportWorkspace />);
  const canWrite = (permission: string) => canPermission(permission);
  if (module === "midias") return workspace(<><MediaWorkspace /><MediaCoverageExplorer /><MediaCampaignLibrary canWrite={canWrite("media.write")} /><RegionalMediaPanel canWrite={canWrite("media.write")} /></>);
  if (module === "midias-graficas") return workspace(<MediaWorkspace initialCategory="graphics" />);
  if (module === "midias-audio-video") return workspace(<TraditionalMediaWorkspace />);
  if (module === "midias-tradicional") return workspace(<TraditionalProgramDetails mediaPointId={Number(traditionalPointParams?.mediaPointId ?? audiovisualPointParams?.mediaPointId ?? 0)} />);
  if (module === "midias-volante") return workspace(<MidiaVolanteWorkspace />);
  if (module === "midias-volante-detalhe") return workspace(<MidiaVolanteDetails mediaPointId={Number(volantePointParams?.mediaPointId ?? 0)} />);
  if (module === "midias-externa") return workspace(<ExternalMediaPointDetails mediaPointId={Number(externalPointParams?.mediaPointId ?? 0)} />);
  if (module === "midias-tradicional-veiculacao") return workspace(<TraditionalVeiculationPage />);
  if (module === "midias-volante-veiculacao") return workspace(<MidiaVolanteVeiculacaoPage />);
  if (module === "midias-panfletagem") return workspace(<MediaWorkspace initialCategory="leafleting" />);
  if (module === "midias-carro-som") return workspace(<MediaWorkspace initialCategory="sound_car" />);
  if (module === "midias-influencers") return <DashboardLayout><div className="cluster-workspace"><div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-border bg-card p-10 text-center"><h1 className="font-display text-2xl font-semibold text-foreground">Influencers</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Este módulo está disponível no menu, mas permanece desativado temporariamente.</p><Button type="button" variant="outline" className="mt-6 border-border" onClick={() => setLocation("/")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar ao início</Button></div></div></DashboardLayout>;
  if (module === "midias-veiculacao") return workspace(<UrbanVeiculationPage />);
  if (module === "acoes") return workspace(<ActionsWorkspace />);
  if (module === "eventos") return workspace(<EventsWorkspace />);
  if (module === "indicadores") return workspace(<IndicatorsWorkspace />);
  if (module === "perfil") return workspace(<ProfileWorkspace />);
  if (module === "usuarios") return workspace(<UserAdministrationWorkspace />);
  if (module === "equipes") return workspace(<TeamsWorkspace />);
  if (module === "pontos-de-acao") return workspace(<ActionPointsWorkspace />);
  if (module === "central-conhecimento") return workspace(topicId ? <KnowledgeTopicWorkspace topicId={topicId} /> : <HelpWorkspace />);
  if (module === "notificacoes") return workspace(<NotificationsWorkspace />);
  return <DashboardLayout><div className="cluster-workspace"><ModulePage {...definition} /></div></DashboardLayout>;
}
