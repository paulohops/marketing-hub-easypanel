import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const logoUrl = branding.logoUrl || branding.faviconUrl || "/favicon.ico";

  return (
    <div className="mx-auto w-full max-w-[1480px]">
      <section className="cluster-grid relative overflow-hidden rounded-[10px] bg-primary px-6 py-7 text-white shadow-[0_16px_42px_rgba(14,114,59,0.18)] sm:px-8 sm:py-9">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full border-[26px] border-sidebar-primary opacity-90" />
        <div className="absolute bottom-[-75px] right-[18%] h-40 w-40 rounded-full border border-white/20" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/20 bg-sidebar-accent/30 p-2 shadow-[0_8px_22px_rgba(7,63,31,0.2)] sm:h-20 sm:w-20">
              <img src={logoUrl} alt={`Logo ${branding.appName}`} className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <Badge className="border-0 bg-sidebar-primary px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-white">{branding.appSubtitle || branding.appName}</Badge>
              <h1 className="mt-3 break-words font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{branding.appName} em movimento</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-sidebar-foreground">A central de gestão do {branding.appSubtitle || branding.appName} para conectar território, campanhas, fornecedores e resultados.</p>
            </div>
          </div>
          <Button onClick={() => setLocation("/ajuda")} className="h-10 rounded-xl bg-sidebar-primary px-4 text-xs font-bold text-white hover:bg-accent-foreground"><CircleHelp className="mr-1.5 h-4 w-4" /> Ver ajuda e suporte</Button>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-5 shadow-[0_3px_12px_rgba(14,114,59,0.04)]"><p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Mídias ativas</p><p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{activeMedia}</p><p className="mt-1 text-xs text-muted-foreground">Pontos disponíveis para veiculação</p></article>
        <article className="rounded-2xl border border-border bg-card p-5 shadow-[0_3px_12px_rgba(14,114,59,0.04)]"><p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Ações realizadas</p><p className="mt-2 text-2xl font-semibold tracking-tight text-primary">{completedActions}</p><p className="mt-1 text-xs text-muted-foreground">Ativações concluídas</p></article>
        <article className="rounded-2xl border border-border bg-card p-5 shadow-[0_3px_12px_rgba(14,114,59,0.04)]"><p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Eventos realizados</p><p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{completedEvents}</p><p className="mt-1 text-xs text-muted-foreground">Eventos concluídos</p></article>
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="flex items-center justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Agenda operacional</p><h2 className="mt-1 font-display text-xl font-semibold text-foreground">Próximas ações e eventos</h2></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><ClipboardList className="h-5 w-5" /></span></div><div className="mt-5 divide-y divide-border">{upcoming.length ? upcoming.map(item => <button key={item.id} onClick={() => setLocation(item.href)} className="group flex w-full items-center gap-4 py-4 text-left first:pt-0 last:pb-0"><span className="grid h-9 min-w-9 place-items-center rounded-lg bg-primary/10 text-primary"><CalendarDays className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm text-foreground">{item.title}</strong><span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-primary">{item.type}</span></span><span className="mt-1 block text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · {item.city}</span></span><ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" /></button>) : <div className="rounded-xl border border-dashed border-border bg-background px-5 py-9 text-center"><p className="text-sm font-semibold text-foreground">Não há compromissos programados</p><p className="mt-1 text-xs text-muted-foreground">Cadastre uma ação ou evento para acompanhar a agenda por aqui.</p></div>}</div></div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Prioridades</p><h2 className="mt-1 font-display text-xl font-semibold text-foreground">O que precisa de atenção</h2></div><BellRing className="h-5 w-5 text-sidebar-primary" /></div><div className="mt-5 space-y-3"><button onClick={() => setLocation("/notificacoes")} className="flex w-full items-center gap-3 rounded-xl bg-secondary p-4 text-left"><BellRing className="h-4 w-4 text-primary" /><span className="flex-1"><strong className="block text-xs text-foreground">{alerts.data?.length ?? 0} alertas não lidos</strong><span className="text-xs text-muted-foreground">Campanhas, pagamentos e responsabilidades.</span></span><ArrowRight className="h-4 w-4 text-primary" /></button><button onClick={() => setLocation("/estoque")} className="flex w-full items-center gap-3 rounded-xl bg-accent p-4 text-left"><TriangleAlert className="h-4 w-4 text-accent-foreground" /><span className="flex-1"><strong className="block text-xs text-accent-foreground">{lowStock} itens em estoque mínimo</strong><span className="text-xs text-muted-foreground">Verifique reposição por cidade e regional.</span></span><ArrowRight className="h-4 w-4 text-accent-foreground" /></button><button onClick={() => setLocation("/midias")} className="flex w-full items-center gap-3 rounded-xl border border-border p-4 text-left"><Megaphone className="h-4 w-4 text-primary" /><span className="flex-1"><strong className="block text-xs text-foreground">{activeMedia} mídias ativas</strong><span className="text-xs text-muted-foreground">Acompanhe vigência e próximas renovações.</span></span><ArrowRight className="h-4 w-4 text-primary" /></button></div></div>
      </section>
    </div>
  );
}
