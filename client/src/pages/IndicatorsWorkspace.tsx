import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { BarChart3, BellRing, CalendarDays, Landmark, Megaphone, TrendingUp } from "lucide-react";
import MapWorkspace from "./MapWorkspace";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function IndicatorsWorkspace() {
  const utils = trpc.useUtils();
  const media = trpc.media.list.useQuery();
  const actions = trpc.actions.list.useQuery();
  const events = trpc.events.list.useQuery();
  const invoices = trpc.finance.listInvoices.useQuery();
  const alerts = trpc.notifications.list.useQuery();
  const analytics = trpc.analytics.overview.useQuery();
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => utils.notifications.list.invalidate() });

  const activeCampaigns = media.data?.filter(point => point.activeCampaign).length ?? 0;
  const openAmount = invoices.data?.reduce((sum, invoice) => sum + invoice.outstandingAmount, 0) ?? 0;
  const actionCompletion = actions.data?.length ? Math.round((actions.data.filter(({ debrief }) => Boolean(debrief)).length / actions.data.length) * 100) : 0;
  const completedEvents = events.data?.filter(({ event }) => event.status === "completed").length ?? 0;
  const cards = [
    { label: "Campanhas ativas", value: activeCampaigns, caption: `${media.data?.length ?? 0} pontos de mídia cadastrados`, icon: Megaphone, tone: "text-[#2d7772] bg-[#e8f4f1]" },
    { label: "Contas em aberto", value: currency.format(openAmount), caption: `${invoices.data?.filter(invoice => invoice.status !== "paid").length ?? 0} notas a acompanhar`, icon: Landmark, tone: "text-[#a26b29] bg-[#fbf0df]" },
    { label: "Debriefings concluídos", value: `${actionCompletion}%`, caption: `${actions.data?.length ?? 0} ações registradas`, icon: TrendingUp, tone: "text-[#675281] bg-[#f0eaf6]" },
    { label: "Eventos concluídos", value: completedEvents, caption: `${events.data?.length ?? 0} eventos na base`, icon: CalendarDays, tone: "text-[#98564f] bg-[#f9ebe8]" },
  ];
  const distribution = [
    { label: "Mídias", value: media.data?.length ?? 0, color: "bg-[#3d807b]" },
    { label: "Ações", value: actions.data?.length ?? 0, color: "bg-[#745d92]" },
    { label: "Eventos", value: events.data?.length ?? 0, color: "bg-[#a46058]" },
  ];
  const distributionMax = Math.max(...distribution.map(item => item.value), 1);

  return <div className="mx-auto max-w-[1480px]">
    <header className="flex gap-4 border-b border-[#dce3db] pb-6"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#387071] text-white shadow-sm"><BarChart3 className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#758780]">Business intelligence</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-[#203735]">Indicadores operacionais</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f817b]">Leituras consolidadas de mídia, financeiro, ações e eventos para decisões mais rápidas.</p></div></header>
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(card => { const Icon = card.icon; return <article key={card.label} className="rounded-2xl border border-[#e0e6df] bg-white p-5 shadow-[0_3px_12px_rgba(24,48,43,0.025)]"><span className={`grid h-9 w-9 place-items-center rounded-xl ${card.tone}`}><Icon className="h-4 w-4" /></span><p className="mt-4 text-xs font-medium text-[#72817b]">{card.label}</p><p className="mt-1 font-display text-2xl font-semibold text-[#2d443e]">{card.value}</p><p className="mt-1 text-[11px] text-[#8a9690]">{card.caption}</p></article>; })}</div>
    <section className="mt-6 rounded-2xl border border-[#e0e6df] bg-white p-5"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-display text-lg font-semibold text-[#304843]">Desempenho por fornecedor</p><p className="mt-0.5 text-xs text-[#7b8983]">Exposição operacional e movimentação financeira calculadas pelo servidor.</p></div><div className="text-left text-xs text-[#778781] sm:text-right"><p>Campanhas ativas: <strong>{analytics.data?.media.activeCampaigns ?? 0}</strong></p><p>Avaliação média de ações: <strong>{analytics.data?.actions.averageRating ?? "—"}</strong></p></div></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="border-b border-[#edf0ed] text-[#7b8983]"><tr><th className="pb-3 font-medium">Fornecedor</th><th className="pb-3 font-medium">Mídias</th><th className="pb-3 font-medium">Ações</th><th className="pb-3 font-medium">Eventos</th><th className="pb-3 text-right font-medium">Faturado</th><th className="pb-3 text-right font-medium">Pago</th></tr></thead><tbody>{analytics.data?.supplierPerformance.length ? analytics.data.supplierPerformance.map(row => <tr key={row.id} className="border-b border-[#f0f2ef] text-[#52655e]"><td className="py-3 font-medium text-[#304843]">{row.name}</td><td className="py-3">{row.mediaPoints}</td><td className="py-3">{row.actions}</td><td className="py-3">{row.events}</td><td className="py-3 text-right">{currency.format(row.invoicedAmount)}</td><td className="py-3 text-right">{currency.format(row.paidAmount)}</td></tr>) : <tr><td colSpan={6} className="py-7 text-center text-[#83918b]">Cadastre fornecedores e operações para visualizar a análise.</td></tr>}</tbody></table></div></section>
    <div className="mt-6 grid gap-5 xl:grid-cols-3"><section className="rounded-2xl border border-[#e0e6df] bg-white p-5"><div className="flex items-center justify-between"><div><p className="font-display text-lg font-semibold text-[#304843]">Atenções da operação</p><p className="mt-0.5 text-xs text-[#7b8983]">Prioridades geradas a partir do status atual.</p></div><Badge variant="outline" className="border-[#dae4de] bg-[#f8faf8] text-xs text-[#547068]">Em acompanhamento</Badge></div><div className="mt-5 space-y-3"><div className="rounded-xl bg-[#fbf5ec] p-3 text-xs text-[#8a6331]"><strong>{invoices.data?.filter(invoice => invoice.status !== "paid").length ?? 0} notas</strong> ainda possuem saldo financeiro em aberto.</div><div className="rounded-xl bg-[#eef5f3] p-3 text-xs text-[#39706a]"><strong>{activeCampaigns} campanhas</strong> estão ativas nos pontos de mídia.</div><div className="rounded-xl bg-[#f3eef8] p-3 text-xs text-[#67527a]"><strong>{actions.data?.filter(({ debrief }) => !debrief).length ?? 0} ações</strong> ainda aguardam registro de debriefing.</div></div></section><section className="rounded-2xl border border-[#e0e6df] bg-white p-5"><p className="font-display text-lg font-semibold text-[#304843]">Panorama por frente</p><p className="mt-0.5 text-xs text-[#7b8983]">Distribuição da base cadastrada na plataforma.</p><div className="mt-5 space-y-4">{distribution.map(item => <div key={item.label}><div className="flex justify-between text-xs text-[#687b74]"><span>{item.label}</span><span className="font-semibold">{item.value}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#edf1ed]"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${(item.value / distributionMax) * 100}%` }} /></div></div>)}</div></section><section className="rounded-2xl border border-[#e0e6df] bg-white p-5"><div className="flex items-center gap-2"><BellRing className="h-4 w-4 text-[#a26b29]" /><div><p className="font-display text-lg font-semibold text-[#304843]">Alertas persistentes</p><p className="mt-0.5 text-xs text-[#7b8983]">Vencimentos e pendências recentes.</p></div></div><div className="mt-4 space-y-2">{alerts.data?.length ? alerts.data.slice(0, 4).map(alert => <button key={alert.id} type="button" onClick={() => !alert.readAt && markRead.mutate({ notificationId: alert.id })} className={`block w-full rounded-xl p-3 text-left text-xs transition-colors ${alert.readAt ? "bg-[#f7faf8] text-[#788881]" : "bg-[#fbf5ec] text-[#765d37]"}`}><span className="font-semibold">{alert.title}</span><span className="mt-1 block leading-5">{alert.message}</span></button>) : <p className="py-5 text-center text-xs text-[#83918b]">Nenhum alerta pendente.</p>}</div></section></div>
    <MapWorkspace />
  </div>;
}
