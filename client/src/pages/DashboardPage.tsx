import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkspaceCard, WorkspaceHeader, WorkspaceSection, WorkspaceShell } from "@/components/WorkspaceChrome";
import { trpc } from "@/lib/trpc";
import { useBranding } from "@/contexts/BrandingContext";
import { ArrowRight, BellRing, CalendarDays, ChevronRight, CircleHelp, ClipboardList, Megaphone, TriangleAlert } from "lucide-react";
import { useLocation } from "wouter";

export default function DashboardPage() {
  const { branding } = useBranding();
  const [, setLocation] = useLocation();
  const media = trpc.media.list.useQuery();
  const actions = trpc.actions.list.useQuery();
  const events = trpc.events.list.useQuery();
  const inventory = trpc.inventory.list.useQuery();
  const alerts = trpc.notifications.list.useQuery({ unreadOnly: true, limit: 4 });
  const activeMedia = media.data?.filter(point => point.status === "active").length ?? 0;
  const completedActions = actions.data?.filter(({ action }) => action.status === "completed").length ?? 0;
  const completedEvents = events.data?.filter(({ event }) => event.status === "completed").length ?? 0;
  const lowStock = inventory.data?.filter(item => Number(item.balance) <= Number(item.minimumQuantity) && Number(item.minimumQuantity) > 0).length ?? 0;
  const upcoming = [
    ...(actions.data ?? []).filter(({ action }) => action.status === "planned" || action.status === "in_progress").map(({ action, cityName }) => ({ id: `action-${action.id}`, type: "Ação", title: action.name, date: action.scheduledFor, city: cityName ?? "Localidade não informada", href: "/acoes" })),
    ...(events.data ?? []).filter(({ event }) => event.status === "planned" || event.status === "in_progress").map(({ event, cityName }) => ({ id: `event-${event.id}`, type: "Evento", title: event.name, date: event.startsAt, city: cityName ?? "Localidade não informada", href: "/eventos" })),
  ].filter(item => new Date(item.date).getTime() >= Date.now() - 86_400_000).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);

  return (
    <WorkspaceShell className="hub-dashboard">
      <WorkspaceHeader
        eyebrow={branding.appSubtitle || branding.appName}
        title={`${branding.appName} em movimento`}
        description={`A central de gestão do ${branding.appSubtitle || branding.appName} para conectar território, campanhas, fornecedores e resultados.`}
        icon={Megaphone}
        actions={<Button onClick={() => setLocation("/ajuda")}><CircleHelp className="mr-1.5 h-4 w-4" />Ver ajuda e suporte</Button>}
      />

      <WorkspaceSection className="grid gap-3 sm:grid-cols-3">
        <WorkspaceCard className="hub-metric-card">
          <p className="hub-metric-card__label">Mídias ativas</p>
          <p className="hub-metric-card__value">{activeMedia}</p>
          <p className="hub-metric-card__description">Pontos disponíveis para veiculação</p>
        </WorkspaceCard>
        <WorkspaceCard className="hub-metric-card">
          <p className="hub-metric-card__label">Ações realizadas</p>
          <p className="hub-metric-card__value text-primary">{completedActions}</p>
          <p className="hub-metric-card__description">Ativações concluídas</p>
        </WorkspaceCard>
        <WorkspaceCard className="hub-metric-card">
          <p className="hub-metric-card__label">Eventos realizados</p>
          <p className="hub-metric-card__value">{completedEvents}</p>
          <p className="hub-metric-card__description">Eventos concluídos</p>
        </WorkspaceCard>
      </WorkspaceSection>

      <div className="grid gap-[var(--hub-section-gap)] xl:grid-cols-[1.6fr_1fr]">
        <WorkspaceSection title="Próximas ações e eventos" description="Agenda operacional" actions={<span className="hub-section__icon"><ClipboardList className="h-5 w-5" /></span>}>
          <WorkspaceCard>
            <div className="hub-record-list">
              {upcoming.length ? upcoming.map(item => (
                <button key={item.id} onClick={() => setLocation(item.href)} className="hub-record-row group flex w-full items-center gap-4 text-left first:pt-0 last:pb-0">
                  <span className="grid h-9 min-w-9 place-items-center rounded-[var(--hub-control-radius)] bg-primary/10 text-primary"><CalendarDays className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <strong className="truncate text-sm text-foreground">{item.title}</strong>
                      <Badge variant="secondary" className="text-[10px]">{item.type}</Badge>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · {item.city}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                </button>
              )) : (
                <div className="hub-empty-state"><p className="text-sm font-semibold text-foreground">Não há compromissos programados</p><p className="mt-1 text-xs text-muted-foreground">Cadastre uma ação ou evento para acompanhar a agenda por aqui.</p></div>
              )}
            </div>
          </WorkspaceCard>
        </WorkspaceSection>

        <WorkspaceSection title="O que precisa de atenção" description="Prioridades operacionais" actions={<BellRing className="h-5 w-5 text-sidebar-primary" />}>
          <WorkspaceCard className="space-y-3">
            <button onClick={() => setLocation("/notificacoes")} className="hub-priority-item bg-secondary text-left">
              <BellRing className="h-4 w-4 text-primary" />
              <span className="flex-1"><strong className="block text-xs text-foreground">{alerts.data?.length ?? 0} alertas não lidos</strong><span className="text-xs text-muted-foreground">Campanhas, pagamentos e responsabilidades.</span></span>
              <ArrowRight className="h-4 w-4 text-primary" />
            </button>
            <button onClick={() => setLocation("/estoque")} className="hub-priority-item bg-accent text-left">
              <TriangleAlert className="h-4 w-4 text-accent-foreground" />
              <span className="flex-1"><strong className="block text-xs text-accent-foreground">{lowStock} itens em estoque mínimo</strong><span className="text-xs text-muted-foreground">Verifique reposição por cidade e regional.</span></span>
              <ArrowRight className="h-4 w-4 text-accent-foreground" />
            </button>
            <button onClick={() => setLocation("/midias")} className="hub-priority-item border border-border text-left">
              <Megaphone className="h-4 w-4 text-primary" />
              <span className="flex-1"><strong className="block text-xs text-foreground">{activeMedia} mídias ativas</strong><span className="text-xs text-muted-foreground">Acompanhe vigência e próximas renovações.</span></span>
              <ArrowRight className="h-4 w-4 text-primary" />
            </button>
          </WorkspaceCard>
        </WorkspaceSection>
      </div>
    </WorkspaceShell>
  );
}
