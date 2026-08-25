import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import EvidenceUpload from "@/components/EvidenceUpload";
import { OperationalHistory, OperationalStatusDropdown } from "@/components/OperationalPatterns";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import { WorkspaceActions, WorkspaceHeader, WorkspaceShell } from "@/components/WorkspaceChrome";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useListDensity } from "@/hooks/useListDensity";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Handshake, MapPinned, PackageCheck, Plus, RefreshCw, Search, SlidersHorizontal, Trash2, UsersRound } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

type StockAllocation = { stockItemId: number; quantity: string };
const statusLabel: Record<string, string> = { planned: "Planejado", in_progress: "Em execução", paused: "Pausado", completed: "Concluído", cancelled: "Cancelado" };
const partnershipLabel: Record<string, string> = { paid: "Pago", barter: "Permuta", mixed: "Misto" };

export default function EventsWorkspace() {
  const [, setLocation] = useLocation();
  const [isDetailRoute, routeParams] = useRoute("/eventos/:eventId");
  const { user } = useAuth();
  const { can } = useEffectivePermissions();
  const canWrite = can("events.write");
  const { compact } = useListDensity();
  const utils = trpc.useUtils();
  const references = trpc.events.referenceData.useQuery();
  const eventList = trpc.events.list.useQuery();
  const initialForm = { name: "", cityId: "", eventTypeId: "", campaignId: "", actionPointId: "", startsAt: "", endsAt: "", address: "", commercialSupervisorId: "", partnershipType: "paid" as "paid" | "barter" | "mixed", estimatedCost: "0", partnershipReason: "", preEventNotes: "", supplierIds: [] as number[], serviceTypeIds: [] as number[], teamMemberIds: [] as number[], stockAllocations: [] as StockAllocation[] };
  const [form, setForm] = useState(initialForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);
  const selectedId = isDetailRoute && routeParams?.eventId ? Number(routeParams.eventId) : null;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [regionalFilter, setRegionalFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [supervisorFilter, setSupervisorFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [post, setPost] = useState({ postEventNotes: "", rating: "5", resultAchieved: false, worthRenewing: false, status: "planned" as "planned" | "in_progress" | "completed" | "cancelled" });
  const cityOptions = (references.data?.cities ?? []).map((entry: any) => ({ city: entry.city ?? entry, regionalName: entry.regionalName ?? entry.city?.regionalName ?? "" }));
  const regionalOptions = Array.from(new Set(cityOptions.map(({ regionalName }) => regionalName).filter(Boolean))).sort();
  const cityFilterOptions = cityOptions.filter(({ regionalName }) => regionalFilter === "all" || regionalName === regionalFilter);
  const supervisorOptions = references.data?.supervisors ?? [];
  const selectedCity = cityOptions.find(({ city }) => city.id === Number(form.cityId))?.city;
  const supplierOptions = useMemo(() => !form.cityId ? [] : (references.data?.suppliers ?? []).filter(supplier => (references.data?.supplierCities ?? []).some(link => link.supplierId === supplier.id && link.cityId === Number(form.cityId))).map(supplier => ({ id: supplier.id, label: supplier.displayName })), [references.data, form.cityId]);
  const stockOptions = useMemo(() => !selectedCity ? [] : (references.data?.stockItems ?? []).filter(item => item.regionalId === selectedCity.regionalId && (item.cityId === null || item.cityId === selectedCity.id)).map(item => ({ id: item.id, label: item.name, description: `${item.sku} · ${item.unit}` })), [references.data, selectedCity]);
  const pointOptions = useMemo(() => !form.cityId ? [] : (references.data?.actionPoints ?? []).filter(point => point.active && point.cityId === Number(form.cityId)).map(point => ({ id: point.id, label: point.name, description: point.address || "Sem endereço cadastrado" })), [references.data, form.cityId]);
  const visibleEvents = useMemo(() => (eventList.data ?? []).filter(row => {
    const regionalName = cityOptions.find(({ city }) => city.id === row.event.cityId)?.regionalName ?? "";
    return (statusFilter === "all" || row.event.status === statusFilter)
      && (regionalFilter === "all" || regionalName === regionalFilter)
      && (cityFilter === "all" || String(row.event.cityId) === cityFilter)
      && (supervisorFilter === "all" || String(row.event.commercialSupervisorId ?? "") === supervisorFilter)
      && `${row.event.name} ${row.cityName} ${row.eventTypeName} ${regionalName}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"));
  }), [eventList.data, cityFilter, cityOptions, regionalFilter, search, statusFilter, supervisorFilter]);
  const selectedEvent = (eventList.data ?? []).find(row => row.event.id === selectedId);
  useEffect(() => {
    if (!selectedEvent) return;
    setPost({ postEventNotes: selectedEvent.event.postEventNotes ?? "", rating: "5", resultAchieved: selectedEvent.event.resultAchieved ?? false, worthRenewing: selectedEvent.event.worthRenewing ?? false, status: selectedEvent.event.status === "paused" ? "in_progress" : selectedEvent.event.status });
  }, [selectedEvent?.event.id, selectedEvent?.event.status, selectedEvent?.event.postEventNotes, selectedEvent?.event.resultAchieved, selectedEvent?.event.worthRenewing]);

  const create = trpc.events.create.useMutation({
    onSuccess: () => { toast.success("Evento planejado com sucesso."); utils.events.list.invalidate(); setIsFormOpen(false); setForm(initialForm); },
    onError: error => toast.error(error.message),
  });
  const savePost = trpc.events.savePostEvent.useMutation({
    onSuccess: () => { toast.success("Acompanhamento do evento registrado."); utils.events.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.events.delete.useMutation({
    onSuccess: () => { toast.success("Evento excluído."); setConfirmDelete(null); setLocation("/eventos"); utils.events.list.invalidate(); },
    onError: error => toast.error(error.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({
      name: form.name, cityId: Number(form.cityId), eventTypeId: Number(form.eventTypeId), campaignId: form.campaignId ? Number(form.campaignId) : null, startsAt: new Date(form.startsAt), endsAt: form.endsAt ? new Date(form.endsAt) : null,
      address: form.address || undefined, latitude: null, longitude: null, commercialSupervisorId: form.commercialSupervisorId ? Number(form.commercialSupervisorId) : null,
      partnershipType: form.partnershipType, estimatedCost: Number(form.estimatedCost), partnershipReason: form.partnershipReason || undefined, preEventNotes: form.preEventNotes || undefined,
      supplierIds: form.supplierIds, serviceTypeIds: form.serviceTypeIds, teamMemberIds: form.teamMemberIds,
      stockAllocations: form.stockAllocations.map(item => ({ stockItemId: item.stockItemId, quantity: Number(item.quantity) })),
    });
  };
  const updateStockSelection = (stockItemIds: number[]) => setForm(current => ({ ...current, stockAllocations: stockItemIds.map(stockItemId => current.stockAllocations.find(item => item.stockItemId === stockItemId) ?? { stockItemId, quantity: "1" }) }));

  return <WorkspaceShell>
    <WorkspaceHeader
      eyebrow="Trade"
      title="Eventos"
      description="Planejamento territorial, equipe, fornecedores, recursos e custos em uma única operação."
      icon={MapPinned}
      actions={<WorkspaceActions>
        <Button type="button" variant="outline" onClick={() => setFiltersOpen(value => !value)} aria-expanded={filtersOpen}>
          <SlidersHorizontal />
          Filtros
        </Button>
        {canWrite && <Button onClick={() => setIsFormOpen(true)}>
          <Plus />
          Novo evento
        </Button>}
      </WorkspaceActions>}
    />

    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
      <DialogContent className="hub-form-dialog">
        <DialogHeader><DialogTitle>Planejar novo evento</DialogTitle><DialogDescription>Escolha primeiro a cidade. O sistema então protege a coerência territorial de fornecedores e recursos de estoque.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="mt-2 grid gap-4 md:grid-cols-4">
          <Field label="Nome do evento" htmlFor="event-name"><Input id="event-name" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field>
          <div><SearchableMultiSelect id="event-city" label="Cidade e regional" options={cityOptions.map(({ city, regionalName }) => ({ id: city.id, label: `${regionalName ? `${regionalName} · ` : ""}${city.name}/${city.state}`, description: "Define os vínculos territoriais." }))} values={form.cityId ? [Number(form.cityId)] : []} maxSelections={1} legacyChangeInput placeholder="Selecionar cidade" onChange={ids => { const cityId = ids[0] ? String(ids[0]) : ""; setForm(current => ({ ...current, cityId, actionPointId: "", address: "", supplierIds: [], stockAllocations: [] })); }} /></div>
          <div><SearchableMultiSelect id="event-type" label="Tipo de evento" options={(references.data?.eventTypes ?? []).map(type => ({ id: type.id, label: type.name }))} values={form.eventTypeId ? [Number(form.eventTypeId)] : []} maxSelections={1} legacyChangeInput disabled={references.isLoading} placeholder={references.isLoading ? "Carregando tipos…" : "Selecionar tipo"} onChange={ids => setForm(current => ({ ...current, eventTypeId: ids[0] ? String(ids[0]) : "" }))} />{!references.isLoading && !references.data?.eventTypes.length ? <p className="mt-2 text-xs text-destructive">Cadastre um tipo de evento antes de planejar.</p> : null}</div>
          <div><SearchableMultiSelect id="event-campaign" label="Campanha" placeholder="Sem campanha vinculada" maxSelections={1} options={(references.data?.campaigns ?? []).map(campaign => ({ id: campaign.id, label: campaign.name, description: campaign.status }))} values={form.campaignId ? [Number(form.campaignId)] : []} onChange={ids => setForm(current => ({ ...current, campaignId: ids[0] ? String(ids[0]) : "" }))} emptyMessage="Crie uma campanha básica sem sair do evento." /></div>
          <div><SearchableMultiSelect id="event-supervisor" label="Supervisor comercial" options={(references.data?.supervisors ?? []).map(supervisor => ({ id: supervisor.id, label: supervisor.name }))} values={form.commercialSupervisorId ? [Number(form.commercialSupervisorId)] : []} maxSelections={1} legacyChangeInput placeholder="Não definido" onChange={ids => setForm(current => ({ ...current, commercialSupervisorId: ids[0] ? String(ids[0]) : "" }))} /></div>
          <Field label="Início" htmlFor="event-start"><Input id="event-start" required type="datetime-local" value={form.startsAt} onChange={event => setForm({ ...form, startsAt: event.target.value })} /></Field>
          <Field label="Término" htmlFor="event-end"><Input id="event-end" type="datetime-local" value={form.endsAt} onChange={event => setForm({ ...form, endsAt: event.target.value })} /></Field>
          <div><SearchableMultiSelect id="event-partnership" label="Modalidade" options={[{ id: 1, label: "Pago" }, { id: 2, label: "Permuta" }, { id: 3, label: "Misto" }]} values={[form.partnershipType === "paid" ? 1 : form.partnershipType === "barter" ? 2 : 3]} maxSelections={1} legacyChangeInput legacyValueMap={{ paid: 1, barter: 2, mixed: 3 }} onChange={ids => setForm(current => ({ ...current, partnershipType: ids[0] === 2 ? "barter" : ids[0] === 3 ? "mixed" : "paid" }))} /></div>
          <Field label="Custo previsto (R$)" htmlFor="event-cost"><Input id="event-cost" required min="0" step="0.01" type="number" value={form.estimatedCost} onChange={event => setForm({ ...form, estimatedCost: event.target.value })} /></Field>
          <div className="md:col-span-2"><SearchableMultiSelect id="event-point" label="Ponto comercial ou local de ação" options={pointOptions} values={form.actionPointId ? [Number(form.actionPointId)] : []} disabled={!form.cityId} placeholder="Selecionar ponto cadastrado" onChange={ids => { const point = (references.data?.actionPoints ?? []).find(item => item.id === ids.at(-1)); setForm(current => ({ ...current, actionPointId: ids.at(-1) ? String(ids.at(-1)) : "", address: point?.address ?? current.address })); }} emptyMessage="Nenhum ponto cadastrado para esta cidade." /></div>
          <div className="md:col-span-2"><Label htmlFor="event-address">Endereço e ponto de referência</Label><Input id="event-address" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} className="mt-1.5" placeholder="Preenchido pelo ponto selecionado, se houver." /></div>
          <div className="md:col-span-2"><Label htmlFor="event-reason">Motivo da parceria</Label><Textarea id="event-reason" value={form.partnershipReason} onChange={event => setForm({ ...form, partnershipReason: event.target.value })} className="mt-1.5 min-h-24" /></div>
          <div className="md:col-span-2"><Label htmlFor="event-pre">Entregáveis e observações pré-evento</Label><Textarea id="event-pre" value={form.preEventNotes} onChange={event => setForm({ ...form, preEventNotes: event.target.value })} className="mt-1.5 min-h-24" /></div>
          <div className="md:col-span-2"><SearchableMultiSelect id="event-team" label="Responsáveis do trade" options={(references.data?.teamUsers ?? []).map(member => ({ id: member.id, label: member.name || member.email || `Usuário #${member.id}`, description: member.jobTitle || undefined }))} values={form.teamMemberIds} onChange={ids => setForm({ ...form, teamMemberIds: ids })} /></div>
          <div className="md:col-span-2"><SearchableMultiSelect id="event-suppliers" label="Fornecedores envolvidos" options={supplierOptions} values={form.supplierIds} disabled={!form.cityId} onChange={ids => setForm({ ...form, supplierIds: ids })} emptyMessage="Nenhum fornecedor atende esta cidade." /></div>
          <div className="md:col-span-2"><SearchableMultiSelect id="event-services" label="Serviços" options={(references.data?.serviceTypes ?? []).map(service => ({ id: service.id, label: service.name }))} values={form.serviceTypeIds} onChange={ids => setForm({ ...form, serviceTypeIds: ids })} /></div>
          <div className="md:col-span-2"><SearchableMultiSelect id="event-stock" label="Recursos de estoque" options={stockOptions} values={form.stockAllocations.map(item => item.stockItemId)} disabled={!form.cityId} onChange={updateStockSelection} emptyMessage="Nenhum recurso está disponível para esta cidade." /></div>
          {form.stockAllocations.length > 0 && <div className="md:col-span-4 rounded-xl border border-border bg-muted/50 p-4"><p className="text-xs font-semibold text-foreground">Quantidade planejada por recurso</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{form.stockAllocations.map(allocation => { const item = references.data?.stockItems.find(stock => stock.id === allocation.stockItemId); return <label key={allocation.stockItemId} className="flex items-center gap-2 text-xs text-foreground"><span className="min-w-0 flex-1 truncate">{item?.name}</span><Input aria-label={`Quantidade planejada para ${item?.name ?? allocation.stockItemId}`} required min="0.01" step="0.01" type="number" value={allocation.quantity} onChange={event => setForm(current => ({ ...current, stockAllocations: current.stockAllocations.map(stock => stock.stockItemId === allocation.stockItemId ? { ...stock, quantity: event.target.value } : stock) }))} className="h-8 w-24" /><span>{item?.unit}</span></label>; })}</div></div>}
          <div className="flex justify-end gap-2 md:col-span-4"><Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button><Button type="submit" disabled={create.isPending || references.isLoading || !form.eventTypeId} className="bg-primary hover:bg-primary/90">{create.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}Planejar evento</Button></div>
        </form>
      </DialogContent>
    </Dialog>

    {selectedEvent ? <EventDetail row={selectedEvent} canWrite={canWrite} post={post} setPost={setPost} pending={savePost.isPending} onBack={() => setLocation("/eventos")} onStatusChange={status => setPost(current => ({ ...current, status }))} onSave={() => savePost.mutate({ eventId: selectedEvent.event.id, postEventNotes: post.postEventNotes || undefined, rating: null, resultAchieved: post.resultAchieved, worthRenewing: null, status: post.status })} onDelete={() => setConfirmDelete({ id: selectedEvent.event.id, name: selectedEvent.event.name })} deleting={remove.isPending} /> : <section className="mt-6">{filtersOpen && <div className="hub-filter-panel mb-4 shadow-sm"><div className="flex flex-col gap-3 p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar por evento, cidade, regional ou tipo…" className="pl-9" /></div><select aria-label="Filtrar eventos por regional" value={regionalFilter} onChange={event => { setRegionalFilter(event.target.value); setCityFilter("all"); }} className="h-9 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">Todas as regionais</option>{regionalOptions.map(regional => <option key={regional} value={regional}>{regional}</option>)}</select><select aria-label="Filtrar eventos por cidade" value={cityFilter} onChange={event => setCityFilter(event.target.value)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">Todas as cidades</option>{cityFilterOptions.map(({ city }) => <option key={city.id} value={city.id}>{city.name}/{city.state}</option>)}</select><select aria-label="Filtrar eventos por supervisor" value={supervisorFilter} onChange={event => setSupervisorFilter(event.target.value)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">Todos os supervisores</option>{supervisorOptions.map(supervisor => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}</select></div><div className="flex flex-wrap gap-2">{[["all", "Todos"], ["planned", "Planejados"], ["in_progress", "Em execução"], ["completed", "Concluídos"], ["cancelled", "Cancelados"]].map(([value, label]) => <Button key={value} type="button" size="sm" variant={statusFilter === value ? "default" : "outline"} className={statusFilter === value ? "bg-primary" : ""} onClick={() => setStatusFilter(value)}>{label}</Button>)}</div></div><div className="flex justify-end border-t border-border pt-3"><Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => { setSearch(""); setRegionalFilter("all"); setCityFilter("all"); setSupervisorFilter("all"); setStatusFilter("all"); }}>Redefinir filtros</Button></div></div>}{eventList.isLoading ? <div className="mt-3 rounded-[10px] border border-border bg-card p-10 text-center text-sm text-muted-foreground">Carregando eventos...</div> : visibleEvents.length ? <div className={`mt-3 ${compact ? "space-y-2" : "space-y-3"}`}>{visibleEvents.map(({ event, cityName, eventTypeName, supervisorName, teamMembers, stockItems, suppliers = [], services = [], finance }) => <article key={event.id} data-density={compact ? "compact" : "comfortable"} onClick={() => setLocation(`/eventos/${event.id}`)} className={`cursor-pointer rounded-[10px] border border-border bg-card shadow-[0_2px_8px_rgba(19,53,35,0.025)] transition hover:border-primary/30 hover:bg-muted/50 ${compact ? "px-4 py-3" : "px-5 py-4"}`}><div className={`flex flex-col lg:flex-row lg:items-center lg:justify-between ${compact ? "gap-2" : "gap-4"}`}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{event.name}</p><Badge className="bg-secondary text-secondary-foreground">{statusLabel[event.status]}</Badge><Badge variant="outline">{partnershipLabel[event.partnershipType]}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{eventTypeName} · {cityName} · {new Date(event.startsAt).toLocaleString("pt-BR")}{event.endsAt ? ` até ${new Date(event.endsAt).toLocaleString("pt-BR")}` : ""}</p><div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground ${compact ? "mt-1.5" : "mt-2"}`}><span className="inline-flex items-center gap-1"><Handshake className="h-3.5 w-3.5" /> Previsto: {Number(finance?.estimatedAmount ?? event.estimatedCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span><span>Pago: {Number(finance?.paidAmount ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span><span>Saldo: {Number(finance?.remainingAmount ?? event.estimatedCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>{supervisorName && <span>Supervisor: {supervisorName}</span>}{teamMembers.length > 0 && <span className="inline-flex items-center gap-1"><UsersRound className="h-3.5 w-3.5" /> {teamMembers.map(member => member.name || `Usuário #${member.userId}`).join(", ")}</span>}{stockItems.length > 0 && <span className="inline-flex items-center gap-1"><PackageCheck className="h-3.5 w-3.5" /> {stockItems.length} recurso(s)</span>}{suppliers.length > 0 && <span>{suppliers.length} fornecedor(es)</span>}{services.length > 0 && <span>{services.length} serviço(s)</span>}</div></div></div>
</article>)}</div> : <div className="p-10 text-center text-sm text-muted-foreground">Nenhum evento registrado. Planeje o primeiro evento para iniciar o acompanhamento.</div>}
    </section>}<AlertDialog open={Boolean(confirmDelete)} onOpenChange={open => { if (!open && !remove.isPending) setConfirmDelete(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir evento?</AlertDialogTitle><AlertDialogDescription>Você está prestes a excluir <strong>{confirmDelete?.name}</strong>. A exclusão é permanente e só será permitida quando o evento não tiver sido executado nem possuir ações, solicitações, faturas ou evidências vinculadas. Para preservar o histórico, mantenha o evento e atualize seu status.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={remove.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (confirmDelete) remove.mutate({ id: confirmDelete.id }); }}>{remove.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}Excluir evento</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></WorkspaceShell>;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) { return <div><Label htmlFor={htmlFor}>{label}</Label><div className="mt-1.5">{children}</div></div>; }

function EventDetail({ row, canWrite, post, setPost, pending, onBack, onStatusChange, onSave, onDelete, deleting }: { row: any; canWrite: boolean; post: any; setPost: (value: any) => void; pending: boolean; onBack: () => void; onStatusChange: (status: "planned" | "in_progress" | "completed" | "cancelled") => void; onSave: () => void; onDelete: () => void; deleting: boolean }) {
  const event = row.event;
  const eventHistory = [{ id: `created-${event.id}`, occurredAt: event.createdAt ?? event.startsAt, action: "create", afterData: {} }, ...(event.updatedAt && event.updatedAt !== event.createdAt ? [{ id: `updated-${event.id}`, occurredAt: event.updatedAt, action: event.postEventNotes ? "save_debrief" : "update", afterData: event.postEventNotes ? { reason: event.postEventNotes } : {} }] : [])];
  return <section className="mt-6"><Button variant="outline" onClick={onBack} className="mb-5"><ArrowLeft className="mr-2 h-4 w-4" />Voltar à lista</Button><header className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2"><Badge variant="outline">{statusLabel[event.status]}</Badge><Badge className="bg-secondary text-secondary-foreground">{partnershipLabel[event.partnershipType]}</Badge></div>{canWrite && <div className="flex flex-wrap items-center gap-2"><OperationalStatusDropdown id={`event-status-${event.id}`} value={post.status} options={[{ value: "planned", label: "Planejado" }, { value: "in_progress", label: "Em execução" }, { value: "completed", label: "Concluído" }, { value: "cancelled", label: "Cancelado" }]} onChange={onStatusChange} /><Button type="button" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete} disabled={deleting}>{deleting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Excluir evento</Button></div>}</div><h2 className="mt-3 font-display text-3xl font-semibold text-foreground">{event.name}</h2><p className="mt-2 text-sm text-muted-foreground">{row.eventTypeName} · {row.cityName} · {new Date(event.startsAt).toLocaleString("pt-BR")}{event.endsAt ? ` até ${new Date(event.endsAt).toLocaleString("pt-BR")}` : ""}</p></header><div className="mt-5 grid gap-5 lg:grid-cols-3"><div className="space-y-5 lg:col-span-2"><EventDetailSection title="Planejamento, local e financeiro"><div className="grid gap-3 sm:grid-cols-2"><EventDetailValue label="Localização" value={event.address || "Não informada"} /><EventDetailValue label="Custo previsto" value={Number(row.finance?.estimatedAmount ?? event.estimatedCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /><EventDetailValue label="Valor pago" value={Number(row.finance?.paidAmount ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /><EventDetailValue label="Saldo da previsão" value={Number(row.finance?.remainingAmount ?? event.estimatedCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} /><EventDetailValue label="Supervisor" value={row.supervisorName || "Não definido"} /><EventDetailValue label="Motivo da parceria" value={event.partnershipReason || "Não informado"} /></div><p className="mt-4 text-sm leading-6 text-foreground">{event.preEventNotes || "Sem observações pré-evento registradas."}</p></EventDetailSection><EventDetailSection title="Status e debriefing">{canWrite ? <form onSubmit={formEvent => { formEvent.preventDefault(); onSave(); }} className="grid gap-3 md:grid-cols-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={post.resultAchieved} onChange={input => setPost({ ...post, resultAchieved: input.target.checked })} />Resultado atingido</label><div className="md:col-span-2"><Label htmlFor={`detail-event-post-${event.id}`}>Debriefing</Label><Textarea id={`detail-event-post-${event.id}`} value={post.postEventNotes} onChange={input => setPost({ ...post, postEventNotes: input.target.value })} className="mt-1.5" placeholder="Registre aprendizados, entregáveis e recomendações." /></div><div className="flex justify-end md:col-span-2"><Button type="submit" disabled={pending} className="bg-primary">Salvar acompanhamento</Button></div></form> : <p className="text-sm text-muted-foreground">{event.postEventNotes || "Nenhum debriefing registrado."}</p>}</EventDetailSection><EventDetailSection title="Equipe e recursos"><div className="grid gap-3 sm:grid-cols-2"><EventDetailValue label="Responsáveis" value={row.teamMembers.length ? row.teamMembers.map((member: any) => member.name || `Usuário #${member.userId}`).join(", ") : "Não informados"} /><EventDetailValue label="Fornecedores" value={row.suppliers?.length ? row.suppliers.map((supplier: any) => supplier.name).join(", ") : "Não informados"} /><EventDetailValue label="Serviços" value={row.services?.length ? row.services.map((service: any) => service.name).join(", ") : "Não informados"} /><EventDetailValue label="Recursos de estoque" value={row.stockItems.length ? row.stockItems.map((item: any) => `${item.name}: ${item.plannedQuantity} ${item.unit}`).join(" · ") : "Não informados"} /></div></EventDetailSection><OperationalHistory title="Histórico do evento" entries={eventHistory} emptyMessage="Ainda não há alterações registradas." labelFor={entry => entry.action === "create" ? "Evento planejado" : entry.action === "save_debrief" ? "Debriefing atualizado" : `Status: ${statusLabel[event.status] ?? event.status}`} /></div><aside><EventDetailSection title="Fotos, vídeos e evidências"><EvidenceUpload entityType="event" entityId={event.id} canWrite={canWrite} /></EventDetailSection></aside></div></section>;
}

function EventDetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h3 className="font-display text-lg font-semibold text-foreground">{title}</h3><div className="mt-4">{children}</div></section>; }
function EventDetailValue({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-muted/60 p-3"><p className="text-xs font-semibold text-muted-foreground">{label}</p><p className="mt-1 text-sm text-foreground">{value}</p></div>; }
