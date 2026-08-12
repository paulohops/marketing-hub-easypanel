import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { hasModulePermission } from "@/lib/permissions";
import { trpc } from "@/lib/trpc";
import { AlertCircle, ArrowDownToLine, ArrowUpFromLine, Boxes, ChevronLeft, ChevronRight, History, Plus, RefreshCw } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

function balanceLabel(balance: number, minimum: string) {
  return balance <= Number(minimum)
    ? { label: "Estoque mínimo", className: "bg-accent/15 text-accent-foreground" }
    : { label: "Regular", className: "bg-secondary text-foreground" };
}

function movementLabel(type: "entry" | "exit" | "adjustment") {
  return type === "entry" ? "Entrada" : type === "exit" ? "Saída" : "Ajuste";
}

export default function InventoryWorkspace() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const canWrite = hasModulePermission(user?.role, "inventory.write");
  const [showCreate, setShowCreate] = useState(false);
  const [movementItemId, setMovementItemId] = useState<number | null>(null);
  const [historyItemId, setHistoryItemId] = useState<number | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyDates, setHistoryDates] = useState({ startsAt: "", endsAt: "" });
  const [itemForm, setItemForm] = useState({ regionalId: "", cityId: "", sku: "", name: "", unit: "un", minimumQuantity: "0", description: "" });
  const [movementForm, setMovementForm] = useState({ movementType: "entry" as "entry" | "exit" | "adjustment", quantity: "", unitCost: "", reference: "", notes: "" });

  const inventory = trpc.inventory.list.useQuery();
  const references = trpc.inventory.referenceData.useQuery();
  const movementInput = useMemo(() => ({
    stockItemId: historyItemId ?? undefined,
    startsAt: historyDates.startsAt ? new Date(`${historyDates.startsAt}T00:00:00`) : undefined,
    endsAt: historyDates.endsAt ? new Date(`${historyDates.endsAt}T23:59:59`) : undefined,
    page: historyPage,
    pageSize: 10,
  }), [historyDates, historyItemId, historyPage]);
  const movementHistory = trpc.inventory.listMovements.useQuery(movementInput, { enabled: historyItemId !== null });

  const createItem = trpc.inventory.createItem.useMutation({
    onSuccess: () => {
      toast.success("Item de estoque cadastrado.");
      utils.inventory.list.invalidate();
      setShowCreate(false);
      setItemForm({ regionalId: "", cityId: "", sku: "", name: "", unit: "un", minimumQuantity: "0", description: "" });
    },
    onError: error => toast.error(error.message),
  });
  const registerMovement = trpc.inventory.registerMovement.useMutation({
    onSuccess: () => {
      toast.success("Movimentação registrada.");
      utils.inventory.list.invalidate();
      utils.inventory.listMovements.invalidate();
      setMovementItemId(null);
      setMovementForm({ movementType: "entry", quantity: "", unitCost: "", reference: "", notes: "" });
    },
    onError: error => toast.error(error.message),
  });

  const submitItem = (event: FormEvent) => {
    event.preventDefault();
    createItem.mutate({ regionalId: Number(itemForm.regionalId), cityId: itemForm.cityId ? Number(itemForm.cityId) : null, sku: itemForm.sku, name: itemForm.name, unit: itemForm.unit, minimumQuantity: Number(itemForm.minimumQuantity), description: itemForm.description || undefined });
  };
  const submitMovement = (event: FormEvent) => {
    event.preventDefault();
    if (!movementItemId) return;
    registerMovement.mutate({ stockItemId: movementItemId, movementType: movementForm.movementType, quantity: Number(movementForm.quantity), unitCost: movementForm.unitCost ? Number(movementForm.unitCost) : undefined, occurredAt: new Date(), reference: movementForm.reference || undefined, notes: movementForm.notes || undefined });
  };
  const selectHistory = (itemId: number) => {
    setHistoryItemId(historyItemId === itemId ? null : itemId);
    setHistoryPage(1);
    setHistoryDates({ startsAt: "", endsAt: "" });
  };
  const totalPages = movementHistory.data ? Math.max(1, Math.ceil(movementHistory.data.total / movementHistory.data.pageSize)) : 1;

  return <div className="mx-auto max-w-[1480px]">
    <div className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white shadow-sm"><Boxes className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">Operação e materiais</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Estoque de brindes</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Gerencie o catálogo, as movimentações e o saldo por regional e cidade.</p></div></div>
      {canWrite && <Button onClick={() => setShowCreate(value => !value)} className="h-10 rounded-xl bg-primary px-4 text-xs font-semibold hover:bg-primary/90"><Plus className="mr-1.5 h-4 w-4" /> Novo item</Button>}
    </div>

    {showCreate && <form onSubmit={submitItem} className="mt-6 grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm md:grid-cols-6">
      <div className="md:col-span-2"><Label htmlFor="item-name">Nome do brinde</Label><Input id="item-name" required value={itemForm.name} onChange={event => setItemForm({ ...itemForm, name: event.target.value })} className="mt-1.5" /></div>
      <div><Label htmlFor="item-sku">SKU</Label><Input id="item-sku" required value={itemForm.sku} onChange={event => setItemForm({ ...itemForm, sku: event.target.value })} className="mt-1.5" /></div>
      <div><Label htmlFor="item-regional">Regional</Label><select id="item-regional" required value={itemForm.regionalId} onChange={event => setItemForm({ ...itemForm, regionalId: event.target.value, cityId: "" })} className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecionar</option>{references.data?.regionals.map(regional => <option key={regional.id} value={regional.id}>{regional.name}</option>)}</select></div>
      <div><Label htmlFor="item-city">Cidade</Label><select id="item-city" value={itemForm.cityId} onChange={event => setItemForm({ ...itemForm, cityId: event.target.value })} className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Sem cidade específica</option>{references.data?.cities.filter(city => !itemForm.regionalId || city.regionalId === Number(itemForm.regionalId)).map(city => <option key={city.id} value={city.id}>{city.name} - {city.state}</option>)}</select></div>
      <div><Label htmlFor="item-minimum">Estoque mínimo</Label><Input id="item-minimum" type="number" min="0" step="0.01" value={itemForm.minimumQuantity} onChange={event => setItemForm({ ...itemForm, minimumQuantity: event.target.value })} className="mt-1.5" /></div>
      <div className="md:col-span-5"><Label htmlFor="item-description">Descrição</Label><Textarea id="item-description" value={itemForm.description} onChange={event => setItemForm({ ...itemForm, description: event.target.value })} className="mt-1.5 min-h-9" /></div>
      <div className="flex items-end"><Button type="submit" disabled={createItem.isPending || !references.data?.regionals.length} className="w-full bg-primary hover:bg-primary/90">{createItem.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Salvar item"}</Button></div>
      {!references.data?.regionals.length && <p className="md:col-span-6 flex items-center gap-2 text-xs text-accent-foreground"><AlertCircle className="h-3.5 w-3.5" /> Cadastre uma regional em Configurações antes de incluir itens de estoque.</p>}
    </form>}

    <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="font-display text-lg font-semibold text-foreground">Posição de estoque</p><p className="mt-0.5 text-xs text-muted-foreground">Saldo transacional, atualizado de forma atômica para cada movimentação.</p></div><Badge variant="outline" className="border-border bg-secondary text-xs text-foreground">{inventory.data?.length ?? 0} itens</Badge></div>
      {inventory.isLoading ? <div className="p-10 text-center text-sm text-muted-foreground">Carregando estoque...</div> : inventory.data?.length ? <div className="divide-y divide-border">{inventory.data.map(item => {
        const status = balanceLabel(item.balance, item.minimumQuantity);
        const isHistoryOpen = historyItemId === item.id;
        return <div key={item.id} className="px-5 py-4"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-semibold text-foreground">{item.name}</p><Badge className={`border-0 text-[10px] ${status.className}`}>{status.label}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{item.sku} · {item.regionalName}{item.cityName ? ` · ${item.cityName}` : ""}</p></div><div className="flex flex-wrap items-center justify-end gap-2"><div className="mr-2 text-right"><p className="text-lg font-semibold text-foreground">{item.balance.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} <span className="text-xs font-medium text-muted-foreground">{item.unit}</span></p><p className="text-[11px] text-muted-foreground">mínimo: {Number(item.minimumQuantity).toLocaleString("pt-BR")}</p></div><Button variant="outline" size="sm" className="h-8 rounded-lg border-border text-xs" onClick={() => selectHistory(item.id)}><History className="mr-1.5 h-3.5 w-3.5" /> Histórico</Button>{canWrite && <Button variant="outline" size="sm" className="h-8 rounded-lg border-border text-xs" onClick={() => setMovementItemId(movementItemId === item.id ? null : item.id)}><ArrowUpFromLine className="mr-1.5 h-3.5 w-3.5" /> Movimentar</Button>}</div></div>
          {isHistoryOpen && <div className="mt-4 rounded-xl border border-border bg-secondary p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">Histórico cronológico</p><p className="mt-1 text-xs text-muted-foreground">{item.regionalName}{item.cityName ? ` · ${item.cityName}` : ""}</p></div><div className="grid grid-cols-2 gap-2"><div><Label htmlFor={`history-start-${item.id}`} className="text-[10px]">De</Label><Input id={`history-start-${item.id}`} type="date" value={historyDates.startsAt} onChange={event => { setHistoryDates({ ...historyDates, startsAt: event.target.value }); setHistoryPage(1); }} className="mt-1 h-8 text-xs" /></div><div><Label htmlFor={`history-end-${item.id}`} className="text-[10px]">Até</Label><Input id={`history-end-${item.id}`} type="date" value={historyDates.endsAt} onChange={event => { setHistoryDates({ ...historyDates, endsAt: event.target.value }); setHistoryPage(1); }} className="mt-1 h-8 text-xs" /></div></div></div>
            {movementHistory.isLoading ? <p className="mt-3 text-xs text-muted-foreground">Carregando histórico...</p> : movementHistory.data?.items.length ? <><div className="mt-3 space-y-2">{movementHistory.data.items.map(({ movement, performedByName }) => <div key={movement.id} className="grid gap-2 border-b border-border pb-2 text-xs last:border-0 last:pb-0 sm:grid-cols-[110px_1fr_auto]"><span className="font-medium text-foreground">{movementLabel(movement.movementType)}</span><span className="text-muted-foreground">{movement.reference || movement.notes || "Sem referência"}{performedByName ? ` · ${performedByName}` : ""}</span><span className="text-right font-semibold text-foreground">{movement.movementType === "exit" ? "−" : "+"}{Number(movement.quantity).toLocaleString("pt-BR")} · {new Date(movement.occurredAt).toLocaleDateString("pt-BR")}</span></div>)}</div><div className="mt-3 flex items-center justify-end gap-2"><span className="mr-auto text-[11px] text-muted-foreground">{movementHistory.data.total} registros</span><Button variant="outline" size="icon" className="h-7 w-7" disabled={historyPage <= 1} onClick={() => setHistoryPage(page => page - 1)} aria-label="Página anterior"><ChevronLeft className="h-3.5 w-3.5" /></Button><span className="text-[11px] text-muted-foreground">{historyPage} de {totalPages}</span><Button variant="outline" size="icon" className="h-7 w-7" disabled={historyPage >= totalPages} onClick={() => setHistoryPage(page => page + 1)} aria-label="Próxima página"><ChevronRight className="h-3.5 w-3.5" /></Button></div></> : <p className="mt-3 text-xs text-muted-foreground">Nenhuma movimentação registrada para este período.</p>}</div>}
          {movementItemId === item.id && <form onSubmit={submitMovement} className="mt-4 grid gap-3 rounded-xl bg-secondary p-4 md:grid-cols-5"><select aria-label="Tipo de movimentação" value={movementForm.movementType} onChange={event => setMovementForm({ ...movementForm, movementType: event.target.value as "entry" | "exit" | "adjustment" })} className="h-9 rounded-md border border-input bg-background px-3 text-sm"><option value="entry">Entrada</option><option value="exit">Saída</option><option value="adjustment">Ajuste positivo</option></select><Input aria-label="Quantidade" required type="number" min="0.01" step="0.01" placeholder="Quantidade" value={movementForm.quantity} onChange={event => setMovementForm({ ...movementForm, quantity: event.target.value })} /><Input aria-label="Referência" placeholder="Referência" value={movementForm.reference} onChange={event => setMovementForm({ ...movementForm, reference: event.target.value })} /><Input aria-label="Observações" placeholder="Observações" value={movementForm.notes} onChange={event => setMovementForm({ ...movementForm, notes: event.target.value })} /><Button type="submit" disabled={registerMovement.isPending} className="bg-primary hover:bg-primary/90"><ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" /> Registrar</Button></form>}</div>;
      })}</div> : <div className="p-12 text-center"><Boxes className="mx-auto h-6 w-6 text-muted-foreground" /><p className="mt-3 text-sm font-semibold text-foreground">Seu estoque ainda não tem itens cadastrados</p><p className="mt-1 text-xs text-muted-foreground">Inclua os brindes que serão distribuídos em suas operações.</p></div>}
    </section>
  </div>;
}
