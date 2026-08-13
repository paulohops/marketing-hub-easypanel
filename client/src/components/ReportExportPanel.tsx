import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

type ReportSources = { media: unknown[]; actions: unknown[]; events: unknown[]; invoices: unknown[] };

function record(value: unknown) { return (value && typeof value === "object" ? value : {}) as Record<string, any>; }
function displayDate(value: unknown) { if (!value) return ""; const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("pt-BR"); }
function dateKey(value: unknown) { const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10); }
function inPeriod(value: unknown, startsOn: string, endsOn: string) { const date = dateKey(value); return Boolean(date && date >= startsOn && date <= endsOn); }
export function reportDateRangeValid(startsOn: string, endsOn: string) { return Boolean(startsOn && endsOn && startsOn <= endsOn); }

export function buildOperationalReportWorkbook(sources: ReportSources, startsOn: string, endsOn: string) {
  const media = sources.media.map(record).filter(row => inPeriod(row.activeCampaign?.startsOn ?? row.createdAt, startsOn, endsOn)).map(row => ({ Ponto: row.name ?? row.mediaPoint?.name ?? "", Tipo: row.mediaType?.name ?? row.type?.name ?? "", Fornecedor: row.supplier?.name ?? "", Campanha: row.activeCampaign?.name ?? "", "Início da campanha": displayDate(row.activeCampaign?.startsOn), "Fim da campanha": displayDate(row.activeCampaign?.endsOn), "Investimento previsto": Number(row.activeCampaign?.estimatedCost ?? 0), Status: row.activeCampaign?.status ?? "sem campanha" }));
  const actions = sources.actions.map(record).filter(row => inPeriod(row.action?.startsAt ?? row.action?.startsOn ?? row.action?.createdAt, startsOn, endsOn)).map(row => ({ Ação: row.action?.name ?? row.action?.title ?? "", Status: row.action?.status ?? "", "Início": displayDate(row.action?.startsAt ?? row.action?.startsOn), "Fim": displayDate(row.action?.endsAt ?? row.action?.endsOn), Cidade: row.action?.city?.name ?? row.city?.name ?? "", "Custo previsto": Number(row.action?.estimatedCost ?? row.action?.cost ?? 0), Nota: row.debrief?.rating ?? "", "Vale repetir": row.debrief?.worthRepeating === true ? "Sim" : row.debrief?.worthRepeating === false ? "Não" : "" }));
  const events = sources.events.map(record).filter(row => inPeriod(row.event?.startsAt ?? row.event?.startsOn ?? row.event?.createdAt, startsOn, endsOn)).map(row => ({ Evento: row.event?.name ?? row.event?.title ?? "", Status: row.event?.status ?? "", "Início": displayDate(row.event?.startsAt ?? row.event?.startsOn), "Fim": displayDate(row.event?.endsAt ?? row.event?.endsOn), Cidade: row.event?.city?.name ?? row.city?.name ?? "", Modalidade: row.event?.partnershipType ?? "", "Custo previsto": Number(row.event?.estimatedCost ?? row.event?.cost ?? 0), Nota: row.postEvent?.rating ?? "", "Vale renovar": row.postEvent?.worthRenewing === true ? "Sim" : row.postEvent?.worthRenewing === false ? "Não" : "" }));
  const invoices = sources.invoices.map(record).filter(row => inPeriod(row.issuedAt ?? row.dueAt ?? row.createdAt, startsOn, endsOn)).map(row => ({ "Nota fiscal": row.number ?? row.invoiceNumber ?? "", Fornecedor: row.supplierName ?? row.supplier?.name ?? "", Emissão: displayDate(row.issuedAt), Vencimento: displayDate(row.dueAt), Status: row.status ?? "", Valor: Number(row.totalAmount ?? row.amount ?? 0), Pago: Number(row.totalPaid ?? row.paidAmount ?? 0), "Saldo aberto": Number(row.outstandingAmount ?? 0), Operação: row.operationLabel ?? "" }));
  const workbook = XLSX.utils.book_new();
  const summary = [{ "Período inicial": displayDate(startsOn), "Período final": displayDate(endsOn), "Pontos e campanhas": media.length, Ações: actions.length, Eventos: events.length, "Notas fiscais": invoices.length }];
  [["Resumo", summary], ["Mídias", media], ["Ações", actions], ["Eventos", events], ["Financeiro", invoices]].forEach(([name, rows]) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows as Record<string, unknown>[]), String(name)));
  return workbook;
}

export default function ReportExportPanel({ sources }: { sources: ReportSources }) {
  const today = new Date().toISOString().slice(0, 10);
  const [startsOn, setStartsOn] = useState(() => `${today.slice(0, 7)}-01`);
  const [endsOn, setEndsOn] = useState(today);
  const valid = reportDateRangeValid(startsOn, endsOn);
  const rowsAvailable = useMemo(() => Object.values(sources).reduce((total, rows) => total + rows.length, 0), [sources]);
  const download = () => { if (!valid) return; XLSX.writeFile(buildOperationalReportWorkbook(sources, startsOn, endsOn), `relatorio-trade-hub_${startsOn}_a_${endsOn}.xlsx`); };
  return <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><FileSpreadsheet className="h-4 w-4" /></span><div><h2 className="font-display text-lg font-semibold text-foreground">Exportar relatório completo</h2><p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">Gere uma planilha XLSX com mídia, ações, eventos e financeiro conforme o período selecionado.</p></div></div><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><label className="grid gap-1.5 text-xs font-medium text-muted-foreground">De<input aria-label="Data inicial do relatório" type="date" value={startsOn} onChange={event => setStartsOn(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label><label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Até<input aria-label="Data final do relatório" type="date" value={endsOn} onChange={event => setEndsOn(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground" /></label><Button onClick={download} disabled={!valid || !rowsAvailable}><Download className="mr-2 h-4 w-4" />Exportar XLSX</Button></div></div>{!valid && <p className="mt-3 text-xs font-medium text-destructive">A data inicial precisa ser anterior ou igual à data final.</p>}<p className="mt-3 text-xs text-muted-foreground">{rowsAvailable} registros disponíveis nas fontes permitidas para seu perfil. A planilha não altera os dados do sistema.</p></section>;
}
