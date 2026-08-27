import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import EvidenceUpload from "@/components/EvidenceUpload";
import ContextTaskDialog from "@/components/ContextTaskDialog";
import { createEmptyOperationalDebrief, OperationalDebriefing, OperationalHistory, OperationalStatusDropdown, resolveHistoryEvidence, type OperationalDebriefValue } from "@/components/OperationalPatterns";
import SearchableMultiSelect, { type SelectableOption } from "@/components/SearchableMultiSelect";
import { WorkspaceActions, WorkspaceHeader, WorkspaceShell } from "@/components/WorkspaceChrome";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { useListDensity } from "@/hooks/useListDensity";
import { trpc } from "@/lib/trpc";
import type { inferRouterOutputs } from "@trpc/server";
import { ArrowLeft, Building2, CalendarClock, Handshake, MapPin, MapPinned, PackageCheck, Plus, RefreshCw, Search, SlidersHorizontal, Target, Trash2, UsersRound, WalletCards } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";
import type { AppRouter } from "../../../server/routers";

type RouterOutputs = inferRouterOutputs<AppRouter>;
type EventRow = RouterOutputs["events"]["list"][number];
type EventReferenceData = RouterOutputs["events"]["referenceData"];
type EventStatus = "planned" | "in_progress" | "paused" | "completed" | "cancelled";
type PartnershipType = "paid" | "barter" | "mixed";
type StockAllocation = { stockItemId: number; quantity: string };
type EventFormState = ReturnType<typeof blankForm>;
type EventPostState = OperationalDebriefValue & { status: EventStatus };

const statusLabel: Record<string, string> = { planned: "Planejado", in_progress: "Em execução", paused: "Pausado", completed: "Concluído", cancelled: "Cancelado" };
const partnershipLabel: Record<string, string> = { paid: "Pago", barter: "Permuta", mixed: "Misto" };
const eventStatusClass: Record<string, string> = {
  planned: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
  in_progress: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  paused: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  completed: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
  cancelled: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
};

function blankForm() {
  return {
    name: "",
    cityId: "",
    eventTypeId: "",
    campaignId: "",
    actionPointId: "",
    startsAt: "",
    endsAt: "",
    address: "",
    commercialSupervisorId: "",
    partnershipType: "paid" as PartnershipType,
    estimatedCost: "0",
    partnershipReason: "",
    preEventNotes: "",
    supplierIds: [] as number[],
    serviceTypeIds: [] as number[],
    teamMemberIds: [] as number[],
    stockAllocations: [] as StockAllocation[],
  };
}

const toDateField = (value: Date | string | null | undefined) => value ? new Date(value).toISOString().slice(0, 16) : "";
const formatDateTime = (value: Date | string | null | undefined) => value ? new Date(value).toLocaleString("pt-BR") : "Não informado";
const formatMoney = (value: number | string | null | undefined) => Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function EventsWorkspace() {
  const [, setLocation] = useLocation();
  const [isDetailRoute, routeParams] = useRoute("/eventos/:eventId");
  const { can } = useEffectivePermissions();
  const canWrite = can("events.write");
  const { compact } = useListDensity();
  const utils = trpc.useUtils();
  const references = trpc.events.referenceData.useQuery();
  const eventList = trpc.events.list.useQuery();
  const [form, setForm] = useState<EventFormState>(blankForm());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);
  const selectedId = isDetailRoute && routeParams?.eventId ? Number(routeParams.eventId) : null;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [regionalFilter, setRegionalFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [supervisorFilter, setSupervisorFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [post, setPost] = useState<EventPostState>({ ...createEmptyOperationalDebrief(), status: "planned" });

  const cityOptions = useMemo(() => (references.data?.cities ?? []).map((entry: any) => ({ city: entry.city ?? entry, regionalName: entry.regionalName ?? "" })), [references.data]);
  const regionalOptions = useMemo(() => Array.from(new Set(cityOptions.map(({ regionalName }) => regionalName).filter(Boolean))).sort(), [cityOptions]);
  const cityFilterOptions = useMemo(() => cityOptions.filter(({ regionalName }) => regionalFilter === "all" || regionalName === regionalFilter), [cityOptions, regionalFilter]);
  const supervisorOptions = references.data?.supervisors ?? [];
  const selectedCity = cityOptions.find(({ city }) => city.id === Number(form.cityId))?.city;
  const supplierOptions: SelectableOption[] = useMemo(() => !form.cityId ? [] : (references.data?.suppliers ?? []).filter(supplier => (references.data?.supplierCities ?? []).some(link => link.supplierId === supplier.id && link.cityId === Number(form.cityId))).map(supplier => ({ id: supplier.id, label: supplier.displayName })), [references.data, form.cityId]);
  const stockOptions: SelectableOption[] = useMemo(() => !selectedCity ? [] : (references.data?.stockItems ?? []).filter(item => item.regionalId === selectedCity.regionalId && (item.cityId === null || item.cityId === selectedCity.id)).map(item => ({ id: item.id, label: item.name, description: `${item.sku} · ${item.unit}` })), [references.data, selectedCity]);
  const pointOptions: SelectableOption[] = useMemo(() => !form.cityId ? [] : (references.data?.actionPoints ?? []).filter(point => point.active && point.cityId === Number(form.cityId)).map(point => ({ id: point.id, label: point.name, description: point.address || "Sem endereço cadastrado" })), [references.data, form.cityId]);
  const visibleEvents = useMemo(() => (eventList.data ?? []).filter(row => {
    const regionalName = cityOptions.find(({ city }) => city.id === row.event.cityId)?.regionalName ?? "";
    const searchable = `${row.event.name} ${row.cityName} ${row.eventTypeName} ${regionalName} ${row.actionPointName ?? ""} ${row.campaignName ?? ""}`.toLocaleLowerCase("pt-BR");
    return (statusFilter === "all" || row.event.status === statusFilter)
      && (regionalFilter === "all" || regionalName === regionalFilter)
      && (cityFilter === "all" || String(row.event.cityId) === cityFilter)
      && (supervisorFilter === "all" || String(row.event.commercialSupervisorId ?? "") === supervisorFilter)
      && searchable.includes(search.toLocaleLowerCase("pt-BR"));
  }), [cityOptions, cityFilter, eventList.data, regionalFilter, search, statusFilter, supervisorFilter]);
  const selectedEvent = (eventList.data ?? []).find(row => row.event.id === selectedId);

  useEffect(() => {
    if (!selectedEvent) return;
    const event = selectedEvent.event;
    setPost({
      rating: event.rating == null ? "" : String(event.rating),
      resultSummary: event.resultSummary ?? "",
      notes: event.postEventNotes ?? "",
      leadCount: String(event.leadCount ?? 0),
      saleCount: String(event.saleCount ?? 0),
      renewalCount: String(event.renewalCount ?? 0),
      positives: event.positives ?? "",
      negatives: event.negatives ?? "",
      resultAchieved: event.resultAchieved ?? false,
      worthRepeating: event.worthRenewing ?? false,
      completedAt: toDateField(event.completedAt ?? new Date()),
      status: event.status,
    });
  }, [selectedEvent?.event.id, selectedEvent?.event.status, selectedEvent?.event.postEventNotes, selectedEvent?.event.resultSummary, selectedEvent?.event.rating, selectedEvent?.event.resultAchieved, selectedEvent?.event.worthRenewing, selectedEvent?.event.completedAt]);

  const create = trpc.events.create.useMutation({
    onSuccess: () => { toast.success("Evento planejado com sucesso."); void utils.events.list.invalidate(); setIsFormOpen(false); setEditingEventId(null); setForm(blankForm()); },
    onError: error => toast.error(error.message),
  });
  const update = trpc.events.updateDetails.useMutation({
    onSuccess: () => { toast.success("Detalhes do evento atualizados."); void utils.events.list.invalidate(); setIsFormOpen(false); setEditingEventId(null); setForm(blankForm()); },
    onError: error => toast.error(error.message),
  });
  const savePost = trpc.events.savePostEvent.useMutation({
    onSuccess: () => { toast.success("Acompanhamento do evento registrado."); void utils.events.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.events.delete.useMutation({
    onSuccess: () => { toast.success("Evento excluído."); setConfirmDelete(null); setLocation("/eventos"); void utils.events.list.invalidate(); },
    onError: error => toast.error(error.message),
  });

  const openCreate = () => { setEditingEventId(null); setForm(blankForm()); setIsFormOpen(true); };
  const openEdit = (row: EventRow) => {
    const event = row.event;
    setEditingEventId(event.id);
    setForm({
      name: event.name,
      cityId: String(event.cityId),
      eventTypeId: String(event.eventTypeId),
      campaignId: event.tradeCampaignId ? String(event.tradeCampaignId) : "",
      actionPointId: event.actionPointId ? String(event.actionPointId) : "",
      startsAt: toDateField(event.startsAt),
      endsAt: toDateField(event.endsAt),
      address: event.address ?? "",
      commercialSupervisorId: event.commercialSupervisorId ? String(event.commercialSupervisorId) : "",
      partnershipType: event.partnershipType,
      estimatedCost: String(event.estimatedCost ?? "0"),
      partnershipReason: event.partnershipReason ?? "",
      preEventNotes: event.preEventNotes ?? "",
      supplierIds: (row.suppliers ?? []).map(item => item.supplierId),
      serviceTypeIds: (row.services ?? []).map(item => item.serviceTypeId),
      teamMemberIds: (row.teamMembers ?? []).map(item => item.userId),
      stockAllocations: (row.stockItems ?? []).map(item => ({ stockItemId: item.stockItemId, quantity: String(item.plannedQuantity ?? 1) })),
    });
    setIsFormOpen(true);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      name: form.name,
      cityId: Number(form.cityId),
      eventTypeId: Number(form.eventTypeId),
      campaignId: form.campaignId ? Number(form.campaignId) : null,
      actionPointId: form.actionPointId ? Number(form.actionPointId) : null,
      startsAt: new Date(form.startsAt),
      endsAt: form.endsAt ? new Date(form.endsAt) : null,
      address: form.address || undefined,
      latitude: null,
      longitude: null,
      commercialSupervisorId: form.commercialSupervisorId ? Number(form.commercialSupervisorId) : null,
      partnershipType: form.partnershipType,
      estimatedCost: Number(form.estimatedCost),
      partnershipReason: form.partnershipReason || undefined,
      preEventNotes: form.preEventNotes || undefined,
      supplierIds: form.supplierIds,
      serviceTypeIds: form.serviceTypeIds,
      teamMemberIds: form.teamMemberIds,
      stockAllocations: form.stockAllocations.map(item => ({ stockItemId: item.stockItemId, quantity: Number(item.quantity) })),
    };
    if (editingEventId) update.mutate({ eventId: editingEventId, ...payload });
    else create.mutate(payload);
  };

  const savePostEvent = () => {
    if (!selectedEvent) return;
    savePost.mutate({
      eventId: selectedEvent.event.id,
      postEventNotes: post.notes || undefined,
      resultSummary: post.resultSummary || undefined,
      notes: post.notes || undefined,
      positives: post.positives || undefined,
      negatives: post.negatives || undefined,
      leadCount: Number(post.leadCount || 0),
      saleCount: Number(post.saleCount || 0),
      renewalCount: Number(post.renewalCount || 0),
      completedAt: post.status === "completed" && post.completedAt ? new Date(post.completedAt) : null,
      rating: post.rating ? Number(post.rating) : null,
      resultAchieved: post.resultAchieved,
      worthRenewing: post.worthRepeating,
      status: post.status,
    });
  };

  const resetFilters = () => { setSearch(""); setStatusFilter("all"); setRegionalFilter("all"); setCityFilter("all"); setSupervisorFilter("all"); };
  const activeFilterCount = [search, statusFilter !== "all", regionalFilter !== "all", cityFilter !== "all", supervisorFilter !== "all"].filter(Boolean).length;
  const statusCounts = (eventList.data ?? []).reduce<Record<string, number>>((counts, row) => { counts[row.event.status] = (counts[row.event.status] ?? 0) + 1; return counts; }, {});

  return <WorkspaceShell>
    {selectedEvent ? <>
      <EventDetail row={selectedEvent} canWrite={canWrite} canCreateTask={can("tasks.create")} post={post} onPostChange={next => setPost(next)} pending={savePost.isPending} onBack={() => setLocation("/eventos")} onEdit={() => openEdit(selectedEvent)} onOpenCampaign={campaignId => setLocation(`/campanhas/${campaignId}`)} onStatusChange={status => setPost(current => ({ ...current, status }))} onSave={savePostEvent} onDelete={() => setConfirmDelete({ id: selectedEvent.event.id, name: selectedEvent.event.name })} deleting={remove.isPending} />
    </> : <>
      <WorkspaceHeader eyebrow="Trade" title="Eventos" description="Planeje, execute e acompanhe eventos em uma ficha operacional completa." icon={MapPinned} actions={<WorkspaceActions>
        <Button type="button" variant="outline" onClick={() => setFiltersOpen(value => !value)} aria-expanded={filtersOpen}><SlidersHorizontal />Filtros{activeFilterCount ? ` (${activeFilterCount})` : ""}</Button>
        {canWrite && <Button onClick={openCreate}><Plus />Novo evento</Button>}
      </WorkspaceActions>} />
      {filtersOpen && <section className="hub-filter-panel space-y-4 p-4">
        {activeFilterCount > 0 && <div className="flex justify-end"><Button type="button" variant="ghost" size="sm" onClick={resetFilters}>Limpar filtros</Button></div>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1.5 text-sm font-medium">Pesquisa<span className="relative min-w-0"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Evento, cidade, regional ou tipo" className="pl-9" /></span></label>
          <label className="grid gap-1.5 text-sm font-medium">Regional<select aria-label="Filtrar eventos por regional" value={regionalFilter} onChange={event => { setRegionalFilter(event.target.value); setCityFilter("all"); }} className="h-9 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">Todas as regionais</option>{regionalOptions.map(regional => <option key={regional} value={regional}>{regional}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-medium">Cidade<select aria-label="Filtrar eventos por cidade" value={cityFilter} onChange={event => setCityFilter(event.target.value)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">Todas as cidades</option>{cityFilterOptions.map(({ city }) => <option key={city.id} value={city.id}>{city.name}/{city.state}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-medium">Supervisor<select aria-label="Filtrar eventos por supervisor" value={supervisorFilter} onChange={event => setSupervisorFilter(event.target.value)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm"><option value="all">Todos os supervisores</option>{supervisorOptions.map(supervisor => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}</select></label>
        </div>
        <div><p className="mb-2 text-xs font-medium text-muted-foreground">Situação do evento</p><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">{["all", "planned", "in_progress", "paused", "completed", "cancelled"].map(value => <Button key={value} type="button" variant={statusFilter === value ? "default" : "outline"} onClick={() => setStatusFilter(value)} className={`justify-between ${statusFilter === value ? "bg-primary" : ""}`}><span>{value === "all" ? "Todos" : statusLabel[value]}</span><span className="rounded bg-background/20 px-1.5 text-xs">{value === "all" ? (eventList.data ?? []).length : statusCounts[value] ?? 0}</span></Button>)}</div></div>
      </section>}
      <section className={compact ? "mt-5 space-y-2" : "mt-5 space-y-3"}>
        {eventList.isLoading ? <p className="rounded-[10px] border border-border bg-card p-10 text-center text-sm text-muted-foreground" aria-live="polite">Carregando eventos…</p> : eventList.isError ? <div role="alert" className="rounded-[10px] border border-destructive/30 bg-destructive/5 p-10 text-center text-sm text-destructive"><p>Não foi possível carregar os eventos.</p><Button type="button" variant="outline" className="mt-4 border-destructive/30 text-destructive" onClick={() => void eventList.refetch()}>Tentar novamente</Button></div> : visibleEvents.length ? visibleEvents.map(row => <EventListCard key={row.event.id} row={row} compact={compact} onOpen={() => setLocation(`/eventos/${row.event.id}`)} />) : <p className="rounded-[10px] border border-border bg-card p-10 text-center text-sm text-muted-foreground">Nenhum evento encontrado para os filtros selecionados.</p>}
      </section>
    </>}
    <EventForm open={isFormOpen} onOpenChange={open => { setIsFormOpen(open); if (!open) { setEditingEventId(null); setForm(blankForm()); } }} form={form} setForm={setForm} references={references.data} cityOptions={cityOptions} supplierOptions={supplierOptions} stockOptions={stockOptions} pointOptions={pointOptions} editing={Boolean(editingEventId)} pending={create.isPending || update.isPending} onSubmit={submit} onStockChange={ids => setForm(current => ({ ...current, stockAllocations: ids.map(stockItemId => current.stockAllocations.find(item => item.stockItemId === stockItemId) ?? { stockItemId, quantity: "1" }) }))} />
    <AlertDialog open={Boolean(confirmDelete)} onOpenChange={open => { if (!open && !remove.isPending) setConfirmDelete(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir evento?</AlertDialogTitle><AlertDialogDescription>Você está prestes a excluir <strong>{confirmDelete?.name}</strong>. A exclusão é permanente e só será permitida quando o evento estiver planejado ou cancelado e não possuir ações, solicitações, faturas ou evidências vinculadas. Para preservar o histórico, mantenha o evento e atualize seu status.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={remove.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (confirmDelete) remove.mutate({ id: confirmDelete.id }); }}>{remove.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}Excluir evento</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </WorkspaceShell>;
}

function EventListCard({ row, compact, onOpen }: { row: EventRow; compact: boolean; onOpen: () => void }) {
  const { event } = row;
  return <article data-density={compact ? "compact" : "comfortable"} className={`grid w-full grid-cols-[72px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-[10px] border border-border bg-card px-4 text-left shadow-[0_2px_8px_rgba(19,53,35,0.025)] transition hover:border-primary/30 hover:bg-muted/40 lg:grid-cols-[76px_minmax(190px,1.15fr)_minmax(178px,.85fr)] lg:px-5 xl:grid-cols-[76px_minmax(190px,1.15fr)_minmax(165px,.76fr)_minmax(180px,.86fr)_minmax(190px,.9fr)_62px] xl:gap-x-3 ${compact ? "min-h-[112px] py-3" : "min-h-[150px] py-5"}`}>
    <button type="button" onClick={onOpen} className="row-span-2 grid h-[72px] w-[72px] shrink-0 place-items-center rounded-xl border border-border bg-primary/5 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-[76px] md:w-[76px] xl:row-span-1" aria-label={`Abrir evento ${event.name}`}><MapPinned className="h-6 w-6" /></button>
    <button type="button" onClick={onOpen} className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><h2 className="truncate font-semibold text-foreground">{event.name}</h2><p className="mt-1 whitespace-normal break-words text-sm leading-5 text-muted-foreground">{event.preEventNotes || "Entregáveis e observações ainda não informados."}</p></button>
    <button type="button" onClick={onOpen} className="col-span-2 min-w-0 space-y-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:col-span-1"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={eventStatusClass[event.status]}>{statusLabel[event.status]}</Badge><Badge variant="outline">{partnershipLabel[event.partnershipType]}</Badge></div><div className="flex flex-wrap gap-2"><Badge variant="secondary">{row.eventTypeName || "Tipo não informado"}</Badge><Badge variant="outline">{row.cityName || "Cidade não informada"}</Badge></div></button>
    <button type="button" onClick={onOpen} className="col-span-2 min-w-0 rounded-xl bg-muted/45 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:col-span-1"><p className="whitespace-nowrap text-xs font-medium tabular-nums text-muted-foreground">{new Date(event.startsAt).toLocaleDateString("pt-BR")} — {event.endsAt ? new Date(event.endsAt).toLocaleDateString("pt-BR") : "sem término"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{row.supervisorName || "Supervisor não definido"}</p></button>
    <button type="button" onClick={onOpen} className="col-span-2 min-w-0 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:col-span-2 xl:col-span-1"><span className="flex min-h-14 flex-col items-center justify-center rounded-lg bg-primary/8 px-2 py-1.5 text-center"><strong className="text-sm font-semibold leading-none tabular-nums">{formatMoney(row.finance?.estimatedAmount ?? event.estimatedCost)}</strong><small className="mt-1 text-[10px] font-medium leading-none text-primary/80">custo previsto</small></span></button>
    <button type="button" onClick={onOpen} className="col-span-2 flex min-h-8 items-center justify-center gap-2 text-center text-[11px] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:col-span-2 xl:col-span-1"><span>{row.teamMembers?.length ?? 0} equipe</span><span>{row.suppliers?.length ?? 0} fornec.</span><span>{row.documents?.length ?? 0} arq.</span></button>
  </article>;
}

type EventFormProps = { open: boolean; onOpenChange: (open: boolean) => void; form: EventFormState; setForm: React.Dispatch<React.SetStateAction<EventFormState>>; references?: EventReferenceData; cityOptions: Array<{ city: EventReferenceData["cities"][number]["city"]; regionalName: string }>; supplierOptions: SelectableOption[]; stockOptions: SelectableOption[]; pointOptions: SelectableOption[]; editing: boolean; pending: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onStockChange: (ids: number[]) => void };

function EventForm({ open, onOpenChange, form, setForm, references, cityOptions, supplierOptions, stockOptions, pointOptions, editing, pending, onSubmit, onStockChange }: EventFormProps) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-7xl overflow-y-auto p-4 sm:w-[calc(100vw-2rem)] sm:p-6"><DialogHeader><DialogTitle>{editing ? "Editar evento" : "Planejar novo evento"}</DialogTitle><DialogDescription>Organize território, campanha, equipe, fornecedores, recursos e custos antes da execução. Os vínculos ficam disponíveis na ficha operacional.</DialogDescription></DialogHeader><form onSubmit={onSubmit} className="mt-2 grid gap-4 md:grid-cols-2">
    <Field label="Nome do evento" htmlFor="event-name"><Input id="event-name" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field>
    <SearchableMultiSelect id="event-city" label="Cidade e regional" options={cityOptions.map(({ city, regionalName }) => ({ id: city.id, label: `${regionalName ? `${regionalName} · ` : ""}${city.name}/${city.state}`, description: "Define os vínculos territoriais." }))} values={form.cityId ? [Number(form.cityId)] : []} maxSelections={1} legacyChangeInput placeholder="Selecionar cidade" onChange={ids => setForm(current => ({ ...current, cityId: ids[0] ? String(ids[0]) : "", actionPointId: "", address: "", supplierIds: [], stockAllocations: [] }))} />
    <SearchableMultiSelect id="event-type" label="Tipo de evento" options={(references?.eventTypes ?? []).map(type => ({ id: type.id, label: type.name }))} values={form.eventTypeId ? [Number(form.eventTypeId)] : []} maxSelections={1} legacyChangeInput disabled={!references || !references.eventTypes.length} placeholder={!references ? "Carregando tipos…" : "Selecionar tipo"} onChange={ids => setForm(current => ({ ...current, eventTypeId: ids[0] ? String(ids[0]) : "" }))} />
    <SearchableMultiSelect id="event-campaign" label="Campanha" placeholder="Sem campanha vinculada" maxSelections={1} options={(references?.campaigns ?? []).map(campaign => ({ id: campaign.id, label: campaign.name, description: campaign.status }))} values={form.campaignId ? [Number(form.campaignId)] : []} onChange={ids => setForm(current => ({ ...current, campaignId: ids[0] ? String(ids[0]) : "" }))} />
    <SearchableMultiSelect id="event-supervisor" label="Supervisor comercial" options={(references?.supervisors ?? []).map(supervisor => ({ id: supervisor.id, label: supervisor.name }))} values={form.commercialSupervisorId ? [Number(form.commercialSupervisorId)] : []} maxSelections={1} legacyChangeInput placeholder="Não definido" onChange={ids => setForm(current => ({ ...current, commercialSupervisorId: ids[0] ? String(ids[0]) : "" }))} />
    <Field label="Início" htmlFor="event-start"><Input id="event-start" required type="datetime-local" value={form.startsAt} onChange={event => setForm({ ...form, startsAt: event.target.value })} /></Field>
    <Field label="Término" htmlFor="event-end"><Input id="event-end" type="datetime-local" value={form.endsAt} onChange={event => setForm({ ...form, endsAt: event.target.value })} /></Field>
    <SearchableMultiSelect id="event-partnership" label="Modalidade" options={[{ id: 1, label: "Pago" }, { id: 2, label: "Permuta" }, { id: 3, label: "Misto" }]} values={[form.partnershipType === "paid" ? 1 : form.partnershipType === "barter" ? 2 : 3]} maxSelections={1} legacyChangeInput legacyValueMap={{ paid: 1, barter: 2, mixed: 3 }} onChange={ids => setForm(current => ({ ...current, partnershipType: ids[0] === 2 ? "barter" : ids[0] === 3 ? "mixed" : "paid" }))} />
    <Field label="Custo previsto (R$)" htmlFor="event-cost"><Input id="event-cost" required min="0" step="0.01" type="number" value={form.estimatedCost} onChange={event => setForm({ ...form, estimatedCost: event.target.value })} /></Field>
    <div className="md:col-span-2"><SearchableMultiSelect id="event-point" label="Ponto comercial ou local de ação" options={pointOptions} values={form.actionPointId ? [Number(form.actionPointId)] : []} disabled={!form.cityId} placeholder="Selecionar ponto cadastrado" onChange={ids => { const point = (references?.actionPoints ?? []).find(item => item.id === ids.at(-1)); setForm(current => ({ ...current, actionPointId: ids.at(-1) ? String(ids.at(-1)) : "", address: point?.address ?? current.address })); }} emptyMessage="Nenhum ponto cadastrado para esta cidade." /></div>
    <div className="md:col-span-2"><Label htmlFor="event-address">Endereço e ponto de referência</Label><Input id="event-address" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} className="mt-1.5" placeholder="Preenchido pelo ponto selecionado, se houver." /></div>
    <div className="md:col-span-2"><Label htmlFor="event-reason">Motivo da parceria</Label><Textarea id="event-reason" value={form.partnershipReason} onChange={event => setForm({ ...form, partnershipReason: event.target.value })} className="mt-1.5 min-h-24" /></div>
    <div className="md:col-span-2"><Label htmlFor="event-pre">Entregáveis e observações pré-evento</Label><Textarea id="event-pre" value={form.preEventNotes} onChange={event => setForm({ ...form, preEventNotes: event.target.value })} className="mt-1.5 min-h-24" /></div>
    <div className="md:col-span-2"><SearchableMultiSelect id="event-team" label="Responsáveis do trade" options={(references?.teamUsers ?? []).map(member => ({ id: member.id, label: member.name || member.email || `Usuário #${member.id}`, description: member.jobTitle || undefined }))} values={form.teamMemberIds} onChange={ids => setForm({ ...form, teamMemberIds: ids })} /></div>
    <div className="md:col-span-2"><SearchableMultiSelect id="event-suppliers" label="Fornecedores envolvidos" options={supplierOptions} values={form.supplierIds} disabled={!form.cityId} onChange={ids => setForm({ ...form, supplierIds: ids })} emptyMessage="Nenhum fornecedor atende esta cidade." /></div>
    <div className="md:col-span-2"><SearchableMultiSelect id="event-services" label="Serviços" options={(references?.serviceTypes ?? []).map(service => ({ id: service.id, label: service.name }))} values={form.serviceTypeIds} onChange={ids => setForm({ ...form, serviceTypeIds: ids })} /></div>
    <div className="md:col-span-2"><SearchableMultiSelect id="event-stock" label="Recursos de estoque" options={stockOptions} values={form.stockAllocations.map(item => item.stockItemId)} disabled={!form.cityId} onChange={onStockChange} emptyMessage="Nenhum recurso está disponível para esta cidade." /></div>
    {form.stockAllocations.length > 0 && <div className="md:col-span-2 rounded-xl border border-border bg-muted/50 p-4"><p className="text-xs font-semibold text-foreground">Quantidade planejada por recurso</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{form.stockAllocations.map(allocation => { const item = references?.stockItems.find(stock => stock.id === allocation.stockItemId); return <label key={allocation.stockItemId} className="flex items-center gap-2 text-xs text-foreground"><span className="min-w-0 flex-1 truncate">{item?.name}</span><Input aria-label={`Quantidade planejada para ${item?.name ?? allocation.stockItemId}`} required min="0.01" step="0.01" type="number" value={allocation.quantity} onChange={event => setForm(current => ({ ...current, stockAllocations: current.stockAllocations.map(stock => stock.stockItemId === allocation.stockItemId ? { ...stock, quantity: event.target.value } : stock) }))} className="h-8 w-24" /><span>{item?.unit}</span></label>; })}</div></div>}
    <div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={pending || !form.eventTypeId} className="bg-primary hover:bg-primary/90">{pending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Salvar alterações" : "Planejar evento"}</Button></div>
  </form></DialogContent></Dialog>;
}

function EventDetail({ row, canWrite, canCreateTask, post, onPostChange, pending, onBack, onEdit, onOpenCampaign, onStatusChange, onSave, onDelete, deleting }: { row: EventRow; canWrite: boolean; canCreateTask: boolean; post: EventPostState; onPostChange: (value: EventPostState) => void; pending: boolean; onBack: () => void; onEdit: () => void; onOpenCampaign: (campaignId: number) => void; onStatusChange: (status: EventStatus) => void; onSave: () => void; onDelete: () => void; deleting: boolean }) {
  const { event } = row;
  const statusOptions: Array<{ value: EventStatus; label: string }> = (["planned", "in_progress", "paused", "completed", "cancelled"] as EventStatus[]).map(value => ({ value, label: statusLabel[value] }));
  const eventPointName = row.actionPointName ? <><strong className="block font-semibold text-foreground">{row.actionPointName}</strong>{event.address || row.actionPointAddress ? <span className="mt-1 block text-muted-foreground">{event.address || row.actionPointAddress}</span> : null}</> : event.address || "Não informado";
  return <main className="mx-auto w-full max-w-[1480px] space-y-5">
    <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" />Voltar para eventos</Button>
    <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm xl:flex-row xl:items-center xl:justify-between"><div className="flex min-w-0 gap-4"><div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border border-border bg-primary/5 text-primary"><MapPinned className="h-7 w-7" /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={eventStatusClass[event.status]}>{statusLabel[event.status]}</Badge><Badge variant="outline">{partnershipLabel[event.partnershipType]}</Badge><Badge variant="secondary">{row.eventTypeName || "Tipo não informado"}</Badge></div><h1 className="mt-2 break-words font-display text-3xl font-bold text-foreground">{event.name}</h1><p className="mt-1 text-sm text-muted-foreground">{row.cityName} · {formatDateTime(event.startsAt)}{event.endsAt ? ` até ${formatDateTime(event.endsAt)}` : ""}</p></div></div>{canWrite && <div className="flex flex-wrap items-center gap-2 xl:justify-end">{canCreateTask ? <ContextTaskDialog entityType="event" entityId={event.id} entityName={event.name} cityId={event.cityId} defaultDescription={`Acompanhar o evento ${event.name}.`} /> : null}<Button variant="outline" onClick={onEdit}>Editar evento</Button><OperationalStatusDropdown id={`event-detail-status-${event.id}`} value={post.status} options={statusOptions} onChange={onStatusChange} /><Button type="button" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onDelete} disabled={deleting}>{deleting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Excluir evento</Button></div>}</header>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="min-w-0 rounded-xl border border-border bg-card p-4"><DetailSection title="Planejamento e local"><div className="grid gap-3 sm:grid-cols-2"><DetailValue icon={<MapPin className="h-4 w-4" />} label="Localização" className="sm:col-span-2" value={eventPointName} /><DetailValue label="Período" className="sm:col-span-2" value={`${formatDateTime(event.startsAt)}${event.endsAt ? ` até ${formatDateTime(event.endsAt)}` : ""}`} /><DetailValue label="Tipo de evento" value={row.eventTypeName || "Não informado"} /><DetailValue label="Cidade" value={row.cityName || "Não informada"} /><DetailValue label="Supervisor" value={row.supervisorName || "Não definido"} /><DetailValue label="Coordenadas" value={event.latitude && event.longitude ? `${event.latitude}, ${event.longitude}` : "Não informadas"} /></div></DetailSection></section>
      <section className="min-w-0 rounded-xl border border-border bg-card p-4"><DetailSection title="Contexto comercial"><div className="grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><DetailValue label="Modalidade" value={partnershipLabel[event.partnershipType]} /><button type="button" disabled={!event.tradeCampaignId} onClick={() => event.tradeCampaignId && onOpenCampaign(event.tradeCampaignId)} className="relative min-h-24 overflow-hidden rounded-xl border border-border bg-muted/60 text-left transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:border-border" aria-label={event.tradeCampaignId ? `Abrir campanha ${row.campaignName ?? "vinculada"}` : "Evento sem campanha vinculada"}>{row.campaignLogoUrl ? <img src={row.campaignLogoUrl} alt={`Identidade visual da campanha ${row.campaignName ?? ""}`} className="absolute inset-0 h-full w-full object-cover" /> : null}<div className={`absolute inset-0 ${row.campaignLogoUrl ? "bg-gradient-to-r from-black/75 via-black/45 to-black/15" : "bg-primary/5"}`} /><div className={`relative flex min-h-24 items-end p-3 ${row.campaignLogoUrl ? "text-white" : "text-foreground"}`}><div className="min-w-0"><p className={`text-[10px] font-medium uppercase tracking-wide ${row.campaignLogoUrl ? "text-white/75" : "text-muted-foreground"}`}>Campanha</p><p className="mt-0.5 break-words text-sm font-medium leading-snug">{row.campaignName || "Evento sem campanha vinculada"}</p></div></div></button></div><div className="flex min-h-40 flex-col rounded-xl border border-primary/15 bg-primary/5 p-4"><p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary"><Target className="h-4 w-4" /> Entregáveis e contexto</p><p className="mt-3 whitespace-pre-wrap break-words text-base font-semibold leading-7 text-foreground">{event.preEventNotes || "Entregáveis e observações ainda não informados."}</p></div><DetailValue label="Motivo da parceria" value={event.partnershipReason || "Não informado"} /></div></DetailSection></section>
      <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2"><DetailSection title="Responsáveis e fornecedores"><div className="grid gap-3 md:grid-cols-2"><PeoplePanel title="Responsáveis do trade" icon={<UsersRound className="h-4 w-4" />} items={(row.teamMembers ?? []).map(member => ({ key: member.userId, name: member.name || `Usuário #${member.userId}`, secondary: member.jobTitle || "Colaborador", image: member.avatarUrl, fallback: "U" }))} empty="Nenhum responsável definido." /><PeoplePanel title="Fornecedores envolvidos" icon={<Building2 className="h-4 w-4" />} items={(row.suppliers ?? []).map(supplier => ({ key: supplier.supplierId, name: supplier.name || `Fornecedor #${supplier.supplierId}`, secondary: supplier.mainService || "Serviço principal não informado", image: supplier.photoUrl, fallback: "F" }))} empty="Nenhum fornecedor definido." /></div></DetailSection></section>
      <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2"><DetailSection title="Serviços"><div className="space-y-2">{row.services?.length ? row.services.map(service => <div key={service.serviceTypeId} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3"><div><p className="font-medium text-foreground">{service.name}</p><p className="mt-0.5 text-xs text-muted-foreground">Serviço planejado para a operação</p></div><Badge variant="outline">Planejado</Badge></div>) : <p className="text-sm text-muted-foreground">Nenhum serviço planejado.</p>}</div></DetailSection></section>
      <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2"><DetailSection title="Recursos de estoque"><div className="grid gap-2 sm:grid-cols-2">{row.stockItems?.length ? row.stockItems.map(item => <div key={item.stockItemId} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3"><div className="min-w-0"><p className="truncate font-medium text-foreground">{item.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.unit || "Unidade não informada"}</p></div><strong className="shrink-0 text-sm tabular-nums text-primary">{Number(item.plannedQuantity || 0).toLocaleString("pt-BR")}</strong></div>) : <p className="text-sm text-muted-foreground">Nenhum recurso de estoque planejado.</p>}</div></DetailSection></section>
      <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2"><DetailSection title="Financeiro do evento"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><FinanceValue label="Custo previsto" value={formatMoney(row.finance?.estimatedAmount ?? event.estimatedCost)} icon={<WalletCards className="h-4 w-4" />} /><FinanceValue label="Valor faturado" value={formatMoney(row.finance?.invoicedAmount)} /><FinanceValue label="Valor pago" value={formatMoney(row.finance?.paidAmount)} /><FinanceValue label="Saldo da previsão" value={formatMoney(row.finance?.remainingAmount ?? event.estimatedCost)} /></div></DetailSection></section>
      <div className="lg:col-span-2"><OperationalDebriefing value={post} onChange={value => onPostChange({ ...post, ...value })} onSave={onSave} pending={pending} canWrite={canWrite} title="Debriefing e resultado" summaryLabel="História e resultado do evento" repeatLabel="Vale renovar" /></div>
      <section className="rounded-xl border border-border bg-card p-4"><DetailSection title="Fotos, vídeos e evidências"><EvidenceUpload entityType="event" entityId={event.id} canWrite={canWrite} variant="gallery" /></DetailSection></section>
      <div className="lg:col-span-2"><OperationalHistory title="Histórico do evento" entries={row.history ?? []} emptyMessage="Ainda não há movimentações registradas." labelFor={entry => entry.auditAction === "create" ? "Evento planejado" : entry.auditAction === "delete" ? "Evento excluído" : "Detalhes ou resultado atualizados"} evidenceFor={(_, payload) => resolveHistoryEvidence(payload, row.documents ?? [])} /></div>
    </div>
  </main>;
}

function PeoplePanel({ title, icon, items, empty }: { title: string; icon: ReactNode; items: Array<{ key: number; name: string; secondary: string; image?: string | null; fallback: string }>; empty: string }) { return <div className="rounded-xl bg-muted/50 p-3"><p className="mb-3 flex items-center gap-1 text-xs font-semibold text-muted-foreground">{icon}{title}</p>{items.length ? <div className="grid gap-2 sm:grid-cols-2">{items.map(item => <div key={item.key} className="flex min-w-0 items-center gap-2 rounded-lg bg-background p-2"><div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-xs font-bold text-primary">{item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : item.fallback}</div><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{item.name}</p><p className="truncate text-xs text-muted-foreground">{item.secondary}</p></div></div>)}</div> : <p className="text-sm text-muted-foreground">{empty}</p>}</div>; }
function DetailSection({ title, children }: { title: string; children: ReactNode }) { return <div><h2 className="font-semibold text-foreground">{title}</h2><div className="mt-3">{children}</div></div>; }
function DetailValue({ label, value, icon, className = "" }: { label: string; value: ReactNode; icon?: ReactNode; className?: string }) { return <div className={`rounded-xl bg-muted/60 p-3 ${className}`}><p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">{icon}{label}</p><div className="mt-1 text-sm text-foreground">{value}</div></div>; }
function FinanceValue({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) { return <div className="rounded-xl bg-muted/60 p-3"><p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">{icon}{label}</p><p className="mt-1 text-base font-semibold tabular-nums text-primary">{value}</p></div>; }
function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium" htmlFor={htmlFor}>{label}{children}</label>; }
