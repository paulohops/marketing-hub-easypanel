import ReportExportPanel from "@/components/ReportExportPanel";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, FileSpreadsheet, Loader2 } from "lucide-react";
import { useLocation } from "wouter";

export default function ReportExportWorkspace() {
  const [, setLocation] = useLocation();
  const media = trpc.media.list.useQuery();
  const actions = trpc.actions.list.useQuery();
  const events = trpc.events.list.useQuery();
  const invoices = trpc.finance.listInvoices.useQuery();
  const loading = media.isLoading || actions.isLoading || events.isLoading || invoices.isLoading;

  return <div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
      <div className="flex gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><FileSpreadsheet className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Configurações</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Exportar relatórios</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Baixe dados consolidados de mídias, ações, eventos e financeiro no período necessário.</p></div></div>
      <Button type="button" variant="outline" onClick={() => setLocation("/configuracoes")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar para Configurações</Button>
    </div>
    {loading ? <div className="grid min-h-56 place-items-center"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Preparando dados para exportação…</div></div> : <ReportExportPanel sources={{ media: media.data ?? [], actions: actions.data ?? [], events: events.data ?? [], invoices: invoices.data ?? [] }} />}
  </div>;
}
