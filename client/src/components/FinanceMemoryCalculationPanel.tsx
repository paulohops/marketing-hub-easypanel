import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Calculator, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function FinanceMemoryCalculationPanel() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const snapshot = trpc.finance.budgetSnapshot.useQuery({ year: Number(year) });
  const dimensions = trpc.finance.financeDimensions.useQuery();
  const referenceData = trpc.finance.referenceData.useQuery();

  const maps = useMemo(() => ({
    company: new Map((dimensions.data?.companies ?? []).map(item => [item.id, item.name])),
    regional: new Map((dimensions.data?.regionals ?? []).map(item => [item.id, item.name])),
    division: new Map((dimensions.data?.divisions ?? []).map(item => [item.id, item.name])),
    sector: new Map((dimensions.data?.sectors ?? []).map(item => [item.id, item.name])),
    medium: new Map((dimensions.data?.mediums ?? []).map(item => [item.id, item.name])),
    account: new Map((dimensions.data?.accounts ?? []).map(item => [item.id, item.name])),
    supplier: new Map((referenceData.data ?? []).map(item => [item.id, item.displayName])),
  }), [dimensions.data, referenceData.data]);

  const totals = useMemo(() => {
    const months = Array.from({ length: 12 }, () => 0);
    for (const line of snapshot.data?.lines ?? []) {
      for (const month of line.months) months[month.month - 1] += Number(month.plannedAmount ?? 0);
    }
    return { months, annual: months.reduce((sum, amount) => sum + amount, 0) };
  }, [snapshot.data?.lines]);

  return <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
    <div className="flex flex-col gap-4 border-b border-border px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
      <div><div className="flex items-center gap-2"><Calculator className="h-4 w-4 text-primary" /><p className="font-display text-lg font-semibold text-foreground">Memória de Cálculo</p></div><p className="mt-1 max-w-4xl text-xs leading-5 text-muted-foreground">Visualização anual inspirada na planilha operacional: agrupamento por regional, meio, setor e fornecedor, com valor planejado por mês e total anual.</p></div>
      <div className="flex items-end gap-2"><div><Label htmlFor="memory-year" className="text-xs">Ano do planejamento</Label><Input id="memory-year" type="number" min="2020" max="2200" value={year} onChange={event => setYear(event.target.value)} className="mt-1 h-9 w-28" /></div><button type="button" aria-label="Atualizar memória de cálculo" onClick={() => { void snapshot.refetch(); void dimensions.refetch(); void referenceData.refetch(); }} className="inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-secondary"><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar</button></div>
    </div>
    <div className="grid gap-3 border-b border-border bg-secondary/20 p-5 sm:grid-cols-3"><article className="rounded-xl border border-border bg-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Linhas planejadas</p><p className="mt-1 text-2xl font-semibold text-foreground">{snapshot.data?.lines.length ?? 0}</p><p className="text-xs text-muted-foreground">Ano {year}</p></article><article className="rounded-xl border border-border bg-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Planejado anual</p><p className="mt-1 text-2xl font-semibold text-primary">{currency.format(totals.annual)}</p><p className="text-xs text-muted-foreground">Soma das competências mensais</p></article><article className="rounded-xl border border-border bg-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Planos</p><p className="mt-1 text-2xl font-semibold text-foreground">{snapshot.data?.plans.length ?? 0}</p><p className="text-xs text-muted-foreground">Rascunhos e aprovados</p></article></div>
    <div className="p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-foreground">Resumo anual por eixo financeiro</p><p className="mt-1 text-xs text-muted-foreground">Valores sem cadastro de dimensão aparecem como “Não informado” para não ocultar linhas importadas ou ainda incompletas.</p></div><Badge variant="outline" className="text-xs">{snapshot.data?.lines.length ?? 0} linhas</Badge></div><div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[1500px] text-left text-xs"><thead className="bg-secondary text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="sticky left-0 z-10 bg-secondary px-3 py-2">Regional</th><th className="px-3 py-2">Meio</th><th className="px-3 py-2">Setor</th><th className="px-3 py-2">Fornecedor</th><th className="px-3 py-2">Conta</th>{monthLabels.map(label => <th key={label} className="px-3 py-2 text-right">{label}</th>)}<th className="px-3 py-2 text-right">Anual</th></tr></thead><tbody className="divide-y divide-border">{snapshot.data?.lines.map(line => { const annual = line.months.reduce((sum, month) => sum + Number(month.plannedAmount ?? 0), 0); return <tr key={line.id} className="hover:bg-secondary/30"><td className="sticky left-0 bg-card px-3 py-2 font-medium text-foreground">{maps.regional.get(line.regionalId ?? -1) ?? "Não informado"}</td><td className="px-3 py-2 text-muted-foreground">{maps.medium.get(line.mediumId ?? -1) ?? "Não informado"}</td><td className="px-3 py-2 text-muted-foreground">{maps.sector.get(line.sectorId ?? -1) ?? "Não informado"}</td><td className="px-3 py-2 text-muted-foreground">{maps.supplier.get(line.supplierId ?? -1) ?? "Não informado"}</td><td className="px-3 py-2 text-muted-foreground">{maps.account.get(line.accountId ?? -1) ?? "Não informado"}</td>{Array.from({ length: 12 }, (_, index) => <td key={index} className="px-3 py-2 text-right tabular-nums">{currency.format(Number(line.months.find(month => month.month === index + 1)?.plannedAmount ?? 0))}</td>)}<td className="px-3 py-2 text-right font-semibold tabular-nums">{currency.format(annual)}</td></tr>; })}</tbody><tfoot className="border-t border-border bg-secondary/50"><tr><td colSpan={5} className="sticky left-0 bg-secondary/50 px-3 py-2 font-semibold text-foreground">Total do planejamento</td>{totals.months.map((amount, index) => <td key={index} className="px-3 py-2 text-right font-semibold tabular-nums">{currency.format(amount)}</td>)}<td className="px-3 py-2 text-right font-semibold tabular-nums">{currency.format(totals.annual)}</td></tr></tfoot></table>{!snapshot.data?.lines.length && <p className="p-10 text-center text-sm text-muted-foreground">Nenhuma linha orçamentária encontrada para {year}. Crie ou importe um plano anual para começar a acompanhar a memória de cálculo.</p>}</div></div>
  </section>;
}
