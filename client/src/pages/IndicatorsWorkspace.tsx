import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { BarChart3, CalendarDays, CheckCircle2, ChevronDown, CircleDollarSign, Filter, MapPin, Megaphone, RefreshCw, TrendingUp, Users } from "lucide-react";
import { WorkspaceActions, WorkspaceHeader, WorkspaceShell } from "@/components/WorkspaceChrome";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" });
const statusOptions = [
  { value: "all", label: "Todos os status" },
  { value: "planned", label: "Planejado" },
  { value: "in_progress", label: "Em andamento" },
  { value: "active", label: "Ativo" },
  { value: "paused", label: "Pausado" },
  { value: "completed", label: "Concluído" },
  { value: "cancelled", label: "Cancelado" },
];

type MetricIcon = typeof BarChart3;
function MetricCard({ label, value, helper, icon: Icon, accent = "bg-secondary" }: { label: string; value: string | number; helper: string; icon: MetricIcon; accent?: string }) {
  return <article className="hub-card flex min-h-[142px] flex-col justify-between p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">{value}</p></div><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${accent} text-foreground`}><Icon className="h-4 w-4" /></span></div><p className="mt-4 text-[11px] leading-4 text-muted-foreground">{helper}</p></article>;
}

export default function IndicatorsWorkspace() {
  const [location] = useLocation();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [regionalId, setRegionalId] = useState("");
  const [cityId, setCityId] = useState("");
  const [status, setStatus] = useState("all");
  const input = useMemo(() => ({ startDate: startDate || undefined, endDate: endDate || undefined, regionalId: regionalId ? Number(regionalId) : undefined, cityId: cityId ? Number(cityId) : undefined, status: status === "all" ? undefined : status }), [startDate, endDate, regionalId, cityId, status]);
  const analytics = trpc.analytics.overview.useQuery(input);
  const reference = trpc.media.referenceData.useQuery();
  const cities = reference.data?.cities.filter(item => !regionalId || item.city.regionalId === Number(regionalId)) ?? [];
  const summary = analytics.data?.summary;
  const byModule = analytics.data?.byModule ?? [];
  const byCity = analytics.data?.byCity ?? [];
  const view = location.endsWith("/midias") ? "midias" : location.endsWith("/panfletagem") ? "panfletagem" : "overview";
  const viewCopy = view === "midias"
    ? { title: "Mídias", description: "Acompanhe pontos, veiculações, cobertura territorial e custos das mídias do Trade." }
    : view === "panfletagem"
      ? { title: "Panfletagem", description: "Acompanhe a operação de distribuição, cidades atendidas e indicadores disponíveis para panfletagem." }
      : { title: "Visão geral", description: "Visão gerencial filtrável de mídias, veiculações, ações, eventos e impacto financeiro do Trade." };
  const scopedModules = useMemo(() => {
    if (view === "overview") return byModule;
    const matcher = view === "midias" ? /mídia|veicula/i : /panflet/i;
    return byModule.filter(module => matcher.test(module.label));
  }, [byModule, view]);
  const scopedTotal = scopedModules.reduce((total, module) => total + module.total, 0);
  const scopedCost = scopedModules.reduce((total, module) => total + module.cost, 0);
  const scopedCampaigns = scopedModules.find(module => module.key === (view === "panfletagem" ? "leafleting" : "campaigns"));
  const selectedPeriod = startDate || endDate ? `${startDate ? dateFormatter.format(new Date(`${startDate}T12:00:00`)) : "Início"} – ${endDate ? dateFormatter.format(new Date(`${endDate}T12:00:00`)) : "Atual"}` : "Todo o histórico";
  const maxCityValue = Math.max(...byCity.map(city => city.estimatedCost + city.campaigns + city.actions + city.events), 1);

  return <WorkspaceShell>
    <WorkspaceHeader
      eyebrow="BI & Indicadores · Trade"
      title={viewCopy.title}
      description={viewCopy.description}
      icon={BarChart3}
      actions={<WorkspaceActions>
        <Badge variant="outline" className="h-9 rounded-lg border-border px-3 text-xs text-muted-foreground"><CalendarDays className="mr-2 h-3.5 w-3.5" />{selectedPeriod}</Badge>
        <Button type="button" variant="outline" onClick={() => setFiltersOpen(value => !value)} aria-expanded={filtersOpen}><Filter />Filtros<ChevronDown className={`ml-2 h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} /></Button>
      </WorkspaceActions>}
    />
    {filtersOpen && <section className="hub-card mt-5 p-5"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><label className="text-xs font-medium text-foreground">Data inicial<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" /></label><label className="text-xs font-medium text-foreground">Data final<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" /></label><label className="text-xs font-medium text-foreground">Regional<select value={regionalId} onChange={event => { setRegionalId(event.target.value); setCityId(""); }} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="">Todas as regionais</option>{reference.data?.regionals.map(regional => <option key={regional.id} value={regional.id}>{regional.name}</option>)}</select></label><label className="text-xs font-medium text-foreground">Cidade<select value={cityId} onChange={event => setCityId(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="">Todas as cidades</option>{cities.map(({ city }) => <option key={city.id} value={city.id}>{city.name} · {city.state}</option>)}</select></label><label className="text-xs font-medium text-foreground">Status<select value={status} onChange={event => setStatus(event.target.value)} className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">{statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div><div className="mt-4 flex justify-end"><Button type="button" variant="ghost" className="h-9 rounded-lg" onClick={() => { setStartDate(""); setEndDate(""); setRegionalId(""); setCityId(""); setStatus("all"); }}><RefreshCw className="mr-2 h-3.5 w-3.5" />Limpar filtros</Button></div></section>}
    {analytics.isLoading ? <div className="hub-card mt-5 p-8 text-center text-sm text-muted-foreground" aria-live="polite">Carregando indicadores do Trade…</div> : analytics.error ? <div role="alert" className="hub-card mt-5 p-8 text-center text-sm text-destructive"><p>Não foi possível carregar os indicadores.</p><Button type="button" variant="outline" className="mt-4 border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => void analytics.refetch()}>Tentar novamente</Button></div> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label={view === "midias" ? "Pontos de mídia" : view === "panfletagem" ? "Registros de panfletagem" : "Pontos de mídia"} value={view === "panfletagem" ? scopedTotal : summary?.mediaPoints ?? 0} helper={view === "panfletagem" ? "Operações encontradas no recorte selecionado" : `${summary?.activeMediaPoints ?? 0} ativos no recorte selecionado`} icon={MapPin} /><MetricCard label={view === "panfletagem" ? "Veiculações de panfletagem" : "Veiculações"} value={view === "panfletagem" ? scopedCampaigns?.total ?? 0 : summary?.campaigns ?? 0} helper={view === "panfletagem" ? `${scopedCampaigns?.active ?? 0} ativas no período` : `${summary?.activeCampaigns ?? 0} ativas no período`} icon={Megaphone} accent="bg-primary/10" /><MetricCard label={view === "overview" ? "Ações e eventos" : "Operações"} value={view === "overview" ? (summary?.actions ?? 0) + (summary?.events ?? 0) : scopedTotal} helper={view === "overview" ? `${summary?.completedActions ?? 0} ações e ${summary?.completedEvents ?? 0} eventos concluídos` : "Total da frente selecionada"} icon={CheckCircle2} /><MetricCard label={view === "overview" ? "Custo estimado" : "Custo da frente"} value={currency.format(view === "overview" ? summary?.estimatedCost ?? 0 : scopedCost)} helper={view === "overview" ? `${currency.format(summary?.outstandingAmount ?? 0)} em aberto no financeiro` : "Soma das operações no recorte selecionado"} icon={CircleDollarSign} accent="bg-primary/10" /></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]"><section className="hub-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-lg font-semibold text-foreground">Desempenho por frente</h2><p className="mt-1 text-xs text-muted-foreground">Volume, status e custo estimado da visão selecionada.</p></div><Badge variant="outline" className="border-border text-xs text-muted-foreground">{selectedPeriod}</Badge></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="border-b border-border text-muted-foreground"><tr><th className="pb-3 font-medium">Frente</th><th className="pb-3 font-medium">Total</th><th className="pb-3 font-medium">Ativos</th><th className="pb-3 text-right font-medium">Custo estimado</th></tr></thead><tbody className="divide-y divide-border">{scopedModules.length ? scopedModules.map(module => <tr key={module.key}><td className="py-3 font-medium text-foreground">{module.label}</td><td className="py-3 text-muted-foreground">{module.total}</td><td className="py-3 text-muted-foreground">{module.active}</td><td className="py-3 text-right font-medium text-foreground">{currency.format(module.cost)}</td></tr>) : <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">Nenhum resultado para os filtros e a frente selecionada.</td></tr>}</tbody></table></div></section><section className="hub-card p-5"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-foreground"><TrendingUp className="h-4 w-4" /></span><div><h2 className="font-display text-lg font-semibold text-foreground">Qualidade operacional</h2><p className="mt-1 text-xs text-muted-foreground">Indicadores de execução e fechamento.</p></div></div><div className="mt-5 space-y-4"><div><div className="flex justify-between text-xs"><span className="text-muted-foreground">Debriefings de ações</span><strong className="text-foreground">{summary?.debriefRate ?? 0}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${summary?.debriefRate ?? 0}%` }} /></div></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-secondary p-3"><p className="text-[11px] text-muted-foreground">Nota média ações</p><p className="mt-1 text-lg font-semibold text-foreground">{summary?.averageActionRating ?? "—"}</p></div><div className="rounded-xl bg-secondary p-3"><p className="text-[11px] text-muted-foreground">Nota média eventos</p><p className="mt-1 text-lg font-semibold text-foreground">{summary?.averageEventRating ?? "—"}</p></div></div></div></section></div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2"><section className="hub-card p-5"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-foreground"><MapPin className="h-4 w-4" /></span><div><h2 className="font-display text-lg font-semibold text-foreground">Leitura por cidade</h2><p className="mt-1 text-xs text-muted-foreground">Cidades com maior concentração de operação e custo estimado.</p></div></div><div className="mt-5 space-y-4">{byCity.length ? byCity.map(city => { const weight = city.estimatedCost + city.campaigns + city.actions + city.events; return <div key={city.cityId}><div className="flex items-center justify-between gap-3 text-xs"><span className="font-medium text-foreground">{city.cityName} <span className="font-normal text-muted-foreground">· {city.regionalName}</span></span><span className="text-muted-foreground">{currency.format(city.estimatedCost)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.max((weight / maxCityValue) * 100, 4)}%` }} /></div><p className="mt-1 text-[11px] text-muted-foreground">{city.media} mídias · {city.campaigns} veiculações · {city.actions} ações · {city.events} eventos</p></div>; }) : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma cidade encontrada para os filtros selecionados.</p>}</div></section><section className="hub-card p-5"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-foreground"><Users className="h-4 w-4" /></span><div><h2 className="font-display text-lg font-semibold text-foreground">Fornecedores em destaque</h2><p className="mt-1 text-xs text-muted-foreground">Relacionamento operacional e financeiro no recorte atual.</p></div></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="border-b border-border text-muted-foreground"><tr><th className="pb-3 font-medium">Fornecedor</th><th className="pb-3 font-medium">Operações</th><th className="pb-3 text-right font-medium">Faturado</th><th className="pb-3 text-right font-medium">Pago</th></tr></thead><tbody className="divide-y divide-border">{analytics.data?.supplierPerformance.length ? analytics.data.supplierPerformance.map(row => <tr key={row.id}><td className="py-3 font-medium text-foreground">{row.name}</td><td className="py-3 text-muted-foreground">{row.mediaPoints + row.campaigns + row.actions + row.events}</td><td className="py-3 text-right text-muted-foreground">{currency.format(row.invoicedAmount)}</td><td className="py-3 text-right font-medium text-foreground">{currency.format(row.paidAmount)}</td></tr>) : <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Nenhum fornecedor encontrado no recorte atual.</td></tr>}</tbody></table></div></section></div>
    </>}
  </WorkspaceShell>;
}
