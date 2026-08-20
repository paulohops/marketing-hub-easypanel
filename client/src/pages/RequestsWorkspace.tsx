import SearchableSelect from "@/components/SearchableSelect";
import { WorkspaceActions, WorkspaceCard, WorkspaceHeader, WorkspaceSection, WorkspaceShell } from "@/components/WorkspaceChrome";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CalendarClock, CheckCircle2, Clock3, ExternalLink, Inbox, Link2, Loader2, Pencil, Plus, Search, Trash2, UserRound, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type RequestType = "action" | "event" | "media" | "finance" | "other";
type RequestStatus = "draft" | "submitted" | "in_review" | "approved" | "rejected" | "in_progress" | "completed" | "cancelled";
type RequestPriority = "low" | "normal" | "high" | "urgent";
type RequestLinkType = "action" | "event" | "media_point" | "media_campaign";

type RequestFormState = {
  title: string;
  description: string;
  requestType: RequestType;
  status: RequestStatus;
  priority: RequestPriority;
  assignedToUserId: string;
  regionalId: string;
  cityId: string;
  requestedForDate: string;
  dueDate: string;
  statusNote: string;
  linkedEntityType: RequestLinkType | "";
  linkedEntityId: string;
};

const typeLabels: Record<RequestType, string> = { action: "Ação", event: "Evento", media: "Mídia", finance: "Financeiro", other: "Outra demanda" };
const statusLabels: Record<RequestStatus, string> = { draft: "Rascunho", submitted: "Enviada", in_review: "Em análise", approved: "Aprovada", rejected: "Rejeitada", in_progress: "Em execução", completed: "Concluída", cancelled: "Cancelada" };
const priorityLabels: Record<RequestPriority, string> = { low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" };
const linkTypeLabels: Record<RequestLinkType, string> = { action: "Ação", event: "Evento", media_point: "Ponto de mídia", media_campaign: "Veiculação de mídia" };
const statusTone: Record<RequestStatus, string> = { draft: "bg-muted text-muted-foreground", submitted: "bg-sky-100 text-sky-700", in_review: "bg-amber-100 text-amber-700", approved: "bg-emerald-100 text-emerald-700", rejected: "bg-rose-100 text-rose-700", in_progress: "bg-violet-100 text-violet-700", completed: "bg-emerald-100 text-emerald-700", cancelled: "bg-muted text-muted-foreground" };
const priorityTone: Record<RequestPriority, string> = { low: "border-border text-muted-foreground", normal: "border-border text-foreground", high: "border-amber-300 bg-amber-50 text-amber-700", urgent: "border-rose-300 bg-rose-50 text-rose-700" };

const typeOptions = Object.entries(typeLabels).map(([value, label]) => ({ value, label }));
const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label }));
const priorityOptions = Object.entries(priorityLabels).map(([value, label]) => ({ value, label }));

const emptyForm: RequestFormState = { title: "", description: "", requestType: "action", status: "submitted", priority: "normal", assignedToUserId: "", regionalId: "", cityId: "", requestedForDate: "", dueDate: "", statusNote: "", linkedEntityType: "action", linkedEntityId: "" };

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`grid gap-1.5 ${className}`}><span className="text-xs font-semibold text-foreground">{label}</span>{children}</label>;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Sem data";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sem data" : date.toLocaleDateString("pt-BR");
}

function asForm(request: Record<string, unknown>): RequestFormState {
  return {
    title: String(request.title ?? ""),
    description: String(request.description ?? ""),
    requestType: (request.requestType as RequestType) ?? "action",
    status: (request.status as RequestStatus) ?? "submitted",
    priority: (request.priority as RequestPriority) ?? "normal",
    assignedToUserId: request.assignedToUserId ? String(request.assignedToUserId) : "",
    regionalId: request.regionalId ? String(request.regionalId) : "",
    cityId: request.cityId ? String(request.cityId) : "",
    requestedForDate: String(request.requestedForDate ?? "").slice(0, 10),
    dueDate: String(request.dueDate ?? "").slice(0, 10),
    statusNote: "",
    linkedEntityType: (request.linkedEntityType as RequestLinkType) ?? "",
    linkedEntityId: request.linkedEntityId ? String(request.linkedEntityId) : "",
  };
}

export default function RequestsWorkspace() {
  const [, setLocation] = useLocation();
  const permissions = useEffectivePermissions();
  const canCreate = permissions.can("requests.create");
  const canUpdate = permissions.can("requests.update");
  const canDelete = permissions.can("requests.delete");
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RequestFormState>(emptyForm);

  const requestsQuery = trpc.requests.list.useQuery({ search: search.trim() || undefined, requestType: typeFilter ? typeFilter as RequestType : undefined, status: statusFilter ? statusFilter as RequestStatus : undefined, priority: priorityFilter ? priorityFilter as RequestPriority : undefined });
  const referenceQuery = trpc.requests.referenceData.useQuery();
  const historyQuery = trpc.requests.history.useQuery({ requestId: selectedId ?? 0 }, { enabled: selectedId !== null });
  const createRequest = trpc.requests.create.useMutation({ onSuccess: created => { toast.success("Solicitação criada."); setFormOpen(false); setSelectedId(created.id); void utils.requests.list.invalidate(); }, onError: error => toast.error(error.message) });
  const updateRequest = trpc.requests.update.useMutation({ onSuccess: updated => { toast.success("Solicitação atualizada."); setFormOpen(false); setSelectedId(updated.id); void utils.requests.list.invalidate(); void utils.requests.history.invalidate({ requestId: updated.id }); }, onError: error => toast.error(error.message) });
  const deleteRequest = trpc.requests.delete.useMutation({ onSuccess: () => { toast.success("Solicitação excluída."); setSelectedId(null); void utils.requests.list.invalidate(); }, onError: error => toast.error(error.message) });

  const requests = requestsQuery.data ?? [];
  const selected = requests.find(request => request.id === selectedId) ?? null;
  const cities = useMemo(() => (referenceQuery.data?.cities ?? []).filter(city => !form.regionalId || city.regionalId === Number(form.regionalId)), [referenceQuery.data?.cities, form.regionalId]);
  const linkedOptions = useMemo(() => {
    if (!form.linkedEntityType || !referenceQuery.data) return [];
    if (form.linkedEntityType === "action") return referenceQuery.data.actions.map(item => ({ value: String(item.id), label: item.name, description: `Ação · ${item.status}` }));
    if (form.linkedEntityType === "event") return referenceQuery.data.events.map(item => ({ value: String(item.id), label: item.name, description: `Evento · ${item.status}` }));
    if (form.linkedEntityType === "media_point") return referenceQuery.data.mediaPoints.map(item => ({ value: String(item.id), label: item.name, description: `${item.channelKind === "external" ? "Mídia externa" : "Mídia urbana"} · ${item.status}` }));
    return referenceQuery.data.mediaCampaigns.map(item => ({ value: String(item.id), label: item.name, description: `${item.mediaPointName || "Mídia"} · ${item.status}` }));
  }, [form.linkedEntityType, referenceQuery.data]);
  const summary = useMemo(() => ({ total: requests.length, pending: requests.filter(request => ["submitted", "in_review", "approved", "in_progress"].includes(request.status)).length, urgent: requests.filter(request => request.priority === "urgent" && !["completed", "cancelled", "rejected"].includes(request.status)).length, completed: requests.filter(request => request.status === "completed").length }), [requests]);
  const isSaving = createRequest.isPending || updateRequest.isPending;

  const openCreate = () => { setEditingId(null); setForm({ ...emptyForm }); setFormOpen(true); };
  const openEdit = () => { if (!selected) return; setEditingId(selected.id); setForm(asForm(selected as unknown as Record<string, unknown>)); setFormOpen(true); };
  const updateField = <K extends keyof RequestFormState>(field: K, value: RequestFormState[K]) => setForm(current => ({ ...current, [field]: value }));
  const updateRequestType = (value: RequestType) => {
    const defaultLink = value === "action" ? "action" : value === "event" ? "event" : value === "media" ? "media_point" : "";
    setForm(current => ({ ...current, requestType: value, linkedEntityType: defaultLink, linkedEntityId: "" }));
  };
  const clearFilters = () => { setSearch(""); setTypeFilter(""); setStatusFilter(""); setPriorityFilter(""); };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return toast.error("Informe o título da solicitação.");
    const payload = { title: form.title.trim(), description: form.description.trim() || null, requestType: form.requestType, status: form.status, priority: form.priority, assignedToUserId: form.assignedToUserId ? Number(form.assignedToUserId) : null, regionalId: form.regionalId ? Number(form.regionalId) : null, cityId: form.cityId ? Number(form.cityId) : null, requestedForDate: form.requestedForDate || null, dueDate: form.dueDate || null, linkedEntityType: form.linkedEntityType || null, linkedEntityId: form.linkedEntityId ? Number(form.linkedEntityId) : null };
    if (editingId) updateRequest.mutate({ ...payload, id: editingId, statusNote: form.statusNote.trim() || null }); else createRequest.mutate(payload);
  };

  return <WorkspaceShell>
    <WorkspaceHeader eyebrow="Gestão integrada" title="Solicitações" description="Registre demandas de ações, eventos, mídias e financeiro, acompanhe a análise e mantenha cada encaminhamento rastreável." icon={Inbox} actions={<WorkspaceActions><Button type="button" variant="outline" onClick={() => setFiltersOpen(current => !current)} className="h-9 rounded-lg border-border px-3 text-xs text-primary"><Search className="mr-1.5 h-3.5 w-3.5" />{filtersOpen ? "Ocultar filtros" : "Filtros"}</Button>{canCreate && <Button type="button" onClick={openCreate} className="h-9 rounded-lg bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"><Plus className="mr-1.5 h-3.5 w-3.5" />Nova solicitação</Button>}</WorkspaceActions>} meta={<span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" />Fluxo com análise, execução e histórico</span>} />

    {filtersOpen && <WorkspaceSection title="Filtros da fila" description="Refine a fila por texto, frente de atuação, status e prioridade."><div className="hub-filter-panel grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem_12rem_auto]"><Field label="Pesquisar"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Título, descrição ou pessoa" className="h-9 pl-9" /></div></Field><SearchableSelect id="request-type-filter" label="Frente" value={typeFilter} onChange={setTypeFilter} placeholder="Todas" options={[{ value: "", label: "Todas as frentes" }, ...typeOptions]} /><SearchableSelect id="request-status-filter" label="Status" value={statusFilter} onChange={setStatusFilter} placeholder="Todos" options={[{ value: "", label: "Todos os status" }, ...statusOptions]} /><SearchableSelect id="request-priority-filter" label="Prioridade" value={priorityFilter} onChange={setPriorityFilter} placeholder="Todas" options={[{ value: "", label: "Todas as prioridades" }, ...priorityOptions]} /><Button type="button" variant="ghost" onClick={clearFilters} className="mt-5 h-9 px-2 text-xs text-muted-foreground"><X className="mr-1 h-3.5 w-3.5" />Limpar</Button></div></WorkspaceSection>}

    <div className="grid gap-4 md:grid-cols-4"><WorkspaceCard><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">Total na fila</span><Inbox className="h-4 w-4 text-primary" /></div><p className="mt-3 font-display text-2xl font-semibold text-foreground">{summary.total}</p><p className="mt-1 text-xs text-muted-foreground">Solicitações filtradas</p></WorkspaceCard><WorkspaceCard><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">Em acompanhamento</span><Clock3 className="h-4 w-4 text-primary" /></div><p className="mt-3 font-display text-2xl font-semibold text-foreground">{summary.pending}</p><p className="mt-1 text-xs text-muted-foreground">Aguardando análise ou execução</p></WorkspaceCard><WorkspaceCard><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">Prioridade urgente</span><AlertCircle className="h-4 w-4 text-rose-500" /></div><p className="mt-3 font-display text-2xl font-semibold text-foreground">{summary.urgent}</p><p className="mt-1 text-xs text-muted-foreground">Demandas ainda abertas</p></WorkspaceCard><WorkspaceCard><div className="flex items-center justify-between"><span className="text-xs font-semibold text-muted-foreground">Concluídas</span><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div><p className="mt-3 font-display text-2xl font-semibold text-foreground">{summary.completed}</p><p className="mt-1 text-xs text-muted-foreground">Entregas encerradas</p></WorkspaceCard></div>

    <WorkspaceSection title="Fila de solicitações" description="Selecione uma solicitação para acompanhar os dados, o responsável e o histórico operacional.">{requestsQuery.isLoading ? <WorkspaceCard className="grid min-h-48 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></WorkspaceCard> : requests.length ? <div className="grid gap-4 xl:grid-cols-2">{requests.map(request => <button key={request.id} type="button" onClick={() => setSelectedId(request.id)} className="block w-full text-left"><WorkspaceCard className={`h-full transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md ${selectedId === request.id ? "border-primary/50 ring-1 ring-primary/20" : ""}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">{typeLabels[request.requestType as RequestType]}</span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusTone[request.status as RequestStatus]}`}>{statusLabels[request.status as RequestStatus]}</span></div><h2 className="mt-3 truncate font-display text-lg font-semibold text-foreground">{request.title}</h2><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{request.description || "Sem descrição complementar."}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${priorityTone[request.priority as RequestPriority]}`}>{priorityLabels[request.priority as RequestPriority]}</span></div><div className="mt-5 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2"><span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{request.assigneeName || "Sem responsável"}</span><span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />{formatDate(request.dueDate)}</span><span>{request.cityName ? `${request.cityName}${request.cityState ? ` - ${request.cityState}` : ""}` : "Território não definido"}</span><span>{request.regionalName || "Sem regional"}</span></div>{request.linkedLabel && <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs"><Link2 className="h-3.5 w-3.5 shrink-0 text-primary" /><span className="truncate text-muted-foreground">{request.linkedEntityType ? linkTypeLabels[request.linkedEntityType as RequestLinkType] : "Registro"}:</span><span className="truncate font-semibold text-foreground">{request.linkedLabel}</span></div>}</WorkspaceCard></button>)}</div> : <WorkspaceCard className="grid min-h-48 place-items-center text-center"><Inbox className="h-6 w-6 text-primary" /><h2 className="mt-3 font-display text-lg font-semibold text-foreground">Nenhuma solicitação encontrada</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Crie uma nova demanda ou ajuste os filtros para consultar outra etapa do fluxo.</p></WorkspaceCard>}</WorkspaceSection>

    {selected && <WorkspaceSection title="Acompanhamento da solicitação" description="A ficha mantém a solicitação, o encaminhamento e as mudanças de status no mesmo lugar."><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]"><WorkspaceCard><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">{typeLabels[selected.requestType as RequestType]}</span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusTone[selected.status as RequestStatus]}`}>{statusLabels[selected.status as RequestStatus]}</span><span className="ml-auto text-xs text-muted-foreground">Atualizada em {formatDate(selected.updatedAt)}</span></div><h2 className="mt-4 font-display text-2xl font-semibold text-foreground">{selected.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{selected.description || "Sem descrição complementar."}</p><div className="mt-6 flex flex-wrap gap-2">{canUpdate && <Button type="button" onClick={openEdit} className="h-9 rounded-lg bg-primary px-3 text-xs text-primary-foreground"><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar solicitação</Button>}{selected.linkedHref && <Button type="button" variant="outline" onClick={() => setLocation(selected.linkedHref!)} className="h-9 rounded-lg border-primary/30 px-3 text-xs text-primary"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Abrir registro vinculado</Button>}{canDelete && <Button type="button" variant="outline" onClick={() => { if (window.confirm("Excluir esta solicitação?")) deleteRequest.mutate({ id: selected.id }); }} className="h-9 rounded-lg border-border px-3 text-xs text-rose-600"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir</Button>}</div></WorkspaceCard><WorkspaceCard><h3 className="font-display text-base font-semibold text-foreground">Dados do encaminhamento</h3><dl className="mt-4 space-y-3 text-xs"><div className="flex items-start justify-between gap-3 border-b border-border/70 pb-2"><dt className="text-muted-foreground">Solicitante</dt><dd className="text-right font-medium text-foreground">{selected.requesterName || "Usuário atual"}</dd></div><div className="flex items-start justify-between gap-3 border-b border-border/70 pb-2"><dt className="text-muted-foreground">Responsável</dt><dd className="text-right font-medium text-foreground">{selected.assigneeName || "Não definido"}</dd></div><div className="flex items-start justify-between gap-3 border-b border-border/70 pb-2"><dt className="text-muted-foreground">Regional</dt><dd className="text-right font-medium text-foreground">{selected.regionalName || "Não definida"}</dd></div><div className="flex items-start justify-between gap-3 border-b border-border/70 pb-2"><dt className="text-muted-foreground">Cidade</dt><dd className="text-right font-medium text-foreground">{selected.cityName ? `${selected.cityName}${selected.cityState ? ` - ${selected.cityState}` : ""}` : "Não definida"}</dd></div><div className="flex items-start justify-between gap-3"><dt className="text-muted-foreground">Data desejada</dt><dd className="text-right font-medium text-foreground">{formatDate(selected.requestedForDate)}</dd></div></dl>{selected.linkedLabel && <div className="mt-5 rounded-lg border border-primary/15 bg-primary/5 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Registro operacional</p><p className="mt-1 text-sm font-semibold text-foreground">{selected.linkedLabel}</p><p className="mt-1 text-xs text-muted-foreground">{selected.linkedEntityType ? linkTypeLabels[selected.linkedEntityType as RequestLinkType] : "Vínculo"}</p></div>}</WorkspaceCard></div><WorkspaceCard className="mt-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-display text-base font-semibold text-foreground">Histórico da solicitação</h3><p className="mt-1 text-xs text-muted-foreground">Mudanças de status, encaminhamentos e observações registradas.</p></div><Clock3 className="h-4 w-4 text-primary" /></div>{historyQuery.isLoading ? <div className="grid min-h-20 place-items-center"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div> : historyQuery.data?.length ? <div className="mt-5 space-y-3">{historyQuery.data.map(entry => <div key={entry.id} className="flex gap-3 border-l-2 border-primary/25 pl-4"><div className="min-w-0"><p className="text-xs font-semibold text-foreground">{entry.note || (entry.toStatus ? `Status alterado para ${statusLabels[entry.toStatus as RequestStatus]}` : "Registro atualizado")}</p><p className="mt-1 text-[11px] text-muted-foreground">{entry.actorName || "Sistema"} · {formatDate(entry.createdAt)}</p></div></div>)}</div> : <p className="mt-4 text-sm text-muted-foreground">Ainda não há movimentações além da criação.</p>}</WorkspaceCard></WorkspaceSection>}

    <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{editingId ? "Editar solicitação" : "Nova solicitação"}</DialogTitle><DialogDescription>Preencha a demanda para que o time consiga analisar, encaminhar e acompanhar a execução.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4"><div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]"><Field label="Título da solicitação"><Input value={form.title} onChange={event => updateField("title", event.target.value)} placeholder="Ex.: Solicitar ação de degustação" /></Field><SearchableSelect id="request-form-type" label="Frente" value={form.requestType} onChange={value => updateRequestType(value as RequestType)} options={typeOptions} /></div><div className="grid gap-4 md:grid-cols-2"><SearchableSelect id="request-form-priority" label="Prioridade" value={form.priority} onChange={value => updateField("priority", value as RequestPriority)} options={priorityOptions} />{editingId ? <SearchableSelect id="request-form-status" label="Status" value={form.status} onChange={value => updateField("status", value as RequestStatus)} options={statusOptions} /> : <Field label="Status inicial"><Input value="Enviada" disabled /></Field>}</div><div className="grid gap-4 md:grid-cols-2"><SearchableSelect id="request-form-assignee" label="Responsável" value={form.assignedToUserId} onChange={value => updateField("assignedToUserId", value)} placeholder="Selecionar responsável" options={(referenceQuery.data?.users ?? []).map(user => ({ value: user.id, label: user.name || "Usuário sem nome", description: user.email || undefined }))} /><SearchableSelect id="request-form-regional" label="Regional" value={form.regionalId} onChange={value => setForm(current => ({ ...current, regionalId: value, cityId: "" }))} placeholder="Selecionar regional" options={(referenceQuery.data?.regionals ?? []).map(regional => ({ value: regional.id, label: regional.name }))} /></div><div className="grid gap-4 md:grid-cols-2"><SearchableSelect id="request-form-city" label="Cidade" value={form.cityId} onChange={value => updateField("cityId", value)} placeholder="Selecionar cidade" options={cities.map(city => ({ value: city.id, label: `${city.name} - ${city.state}`, description: city.regionalName || undefined }))} /><div className="grid gap-4 sm:grid-cols-2"><Field label="Data desejada"><Input type="date" value={form.requestedForDate} onChange={event => updateField("requestedForDate", event.target.value)} /></Field><Field label="Prazo"><Input type="date" value={form.dueDate} onChange={event => updateField("dueDate", event.target.value)} /></Field></div></div><div className="grid gap-4 md:grid-cols-[12rem_minmax(0,1fr)]"><SearchableSelect id="request-form-link-type" label="Tipo de registro vinculado" value={form.linkedEntityType} onChange={value => setForm(current => ({ ...current, linkedEntityType: value as RequestLinkType | "", linkedEntityId: "" }))} placeholder="Nenhum" options={[{ value: "", label: "Nenhum registro" }, ...Object.entries(linkTypeLabels).map(([value, label]) => ({ value, label }))]} /><SearchableSelect id="request-form-link-entity" label="Registro operacional" value={form.linkedEntityId} onChange={value => updateField("linkedEntityId", value)} placeholder={form.linkedEntityType ? "Selecionar registro" : "Escolha o tipo primeiro"} options={linkedOptions} disabled={!form.linkedEntityType || referenceQuery.isLoading} /></div><Field label="Descrição"><Textarea value={form.description} onChange={event => updateField("description", event.target.value)} placeholder="Explique o contexto, o objetivo e o resultado esperado." className="min-h-28 resize-y" /></Field>{editingId && <Field label="Observação do andamento"><Textarea value={form.statusNote} onChange={event => updateField("statusNote", event.target.value)} placeholder="Registre o motivo da mudança ou um encaminhamento importante." className="min-h-20 resize-y" /></Field>}<DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="border-border">Cancelar</Button><Button type="submit" disabled={isSaving} className="bg-primary text-primary-foreground">{isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}{editingId ? "Salvar alterações" : "Criar solicitação"}</Button></DialogFooter></form></DialogContent></Dialog>
  </WorkspaceShell>;
}
