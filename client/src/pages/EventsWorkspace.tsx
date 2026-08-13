import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import { CalendarDays, ClipboardCheck, Handshake, MapPinned, PackageCheck, Plus, RefreshCw, Star, UsersRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

type StockAllocation = { stockItemId: number; quantity: string };
const statusLabel: Record<string, string> = { planned: "Planejado", in_progress: "Em execução", completed: "Concluído", cancelled: "Cancelado" };
const partnershipLabel: Record<string, string> = { paid: "Pago", barter: "Permuta", mixed: "Misto" };
const selectedIds = (event: React.ChangeEvent<HTMLSelectElement>) => Array.from(event.target.selectedOptions).map(option => Number(option.value));

export default function EventsWorkspace() {
  const { user } = useAuth();
  const { can } = useEffectivePermissions();
  const canWrite = can("events.write");
  const utils = trpc.useUtils();
  const references = trpc.events.referenceData.useQuery();
  const eventList = trpc.events.list.useQuery();
  const initialForm = { name: "", cityId: "", eventTypeId: "", startsAt: "", endsAt: "", address: "", commercialSupervisorId: "", partnershipType: "paid" as "paid" | "barter" | "mixed", estimatedCost: "0", partnershipReason: "", preEventNotes: "", supplierIds: [] as number[], serviceTypeIds: [] as number[], teamMemberIds: [] as number[], stockAllocations: [] as StockAllocation[] };
  const [form, setForm] = useState(initialForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [postEventId, setPostEventId] = useState<number | null>(null);
  const [post, setPost] = useState({ postEventNotes: "", rating: "5", resultAchieved: true, worthRenewing: true, status: "completed" as "planned" | "in_progress" | "completed" | "cancelled" });
  const cityOptions = (references.data?.cities ?? []).map((entry: any) => ({ city: entry.city ?? entry, regionalName: entry.regionalName ?? entry.city?.regionalName ?? "" }));

  const create = trpc.events.create.useMutation({
    onSuccess: () => { toast.success("Evento planejado com sucesso."); utils.events.list.invalidate(); setIsFormOpen(false); setForm(initialForm); },
    onError: error => toast.error(error.message),
  });
  const savePost = trpc.events.savePostEvent.useMutation({
    onSuccess: () => { toast.success("Pós-evento registrado."); utils.events.list.invalidate(); setPostEventId(null); },
    onError: error => toast.error(error.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate({
      name: form.name, cityId: Number(form.cityId), eventTypeId: Number(form.eventTypeId), startsAt: new Date(form.startsAt), endsAt: form.endsAt ? new Date(form.endsAt) : null,
      address: form.address || undefined, latitude: null, longitude: null, commercialSupervisorId: form.commercialSupervisorId ? Number(form.commercialSupervisorId) : null,
      partnershipType: form.partnershipType, estimatedCost: Number(form.estimatedCost), partnershipReason: form.partnershipReason || undefined, preEventNotes: form.preEventNotes || undefined,
      supplierIds: form.supplierIds, serviceTypeIds: form.serviceTypeIds, teamMemberIds: form.teamMemberIds,
      stockAllocations: form.stockAllocations.map(item => ({ stockItemId: item.stockItemId, quantity: Number(item.quantity) })),
    });
  };
  const updateStockSelection = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const stockItemIds = selectedIds(event);
    setForm(current => ({ ...current, stockAllocations: stockItemIds.map(stockItemId => current.stockAllocations.find(item => item.stockItemId === stockItemId) ?? { stockItemId, quantity: "1" }) }));
  };

  return <main className="mx-auto max-w-[1480px]">
    <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><MapPinned className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Experiências presenciais</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Eventos</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Planejamento territorial, equipe, fornecedores, recursos, custos e avaliação da parceria em uma única operação.</p></div></div>
      {canWrite && <Button onClick={() => setIsFormOpen(true)} className="h-10 rounded-xl bg-primary px-4 text-xs font-semibold hover:bg-primary/90"><Plus className="mr-1.5 h-4 w-4" /> Novo evento</Button>}
    </header>

    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
      <DialogContent className="max-h-[88vh] w-[calc(100vw-2rem)] max-w-6xl overflow-y-auto p-6 sm:p-7">
        <DialogHeader><DialogTitle>Planejar novo evento</DialogTitle><DialogDescription>Escolha primeiro a cidade. O sistema então protege a coerência territorial de fornecedores e recursos de estoque.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="mt-2 grid gap-4 md:grid-cols-4">
          <Field label="Nome do evento" htmlFor="event-name"><Input id="event-name" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Cidade e regional" htmlFor="event-city"><select id="event-city" required value={form.cityId} onChange={event => setForm(current => ({ ...current, cityId: event.target.value, supplierIds: [], stockAllocations: [] }))} className="control"><option value="">Selecionar cidade</option>{cityOptions.map(({ city, regionalName }) => <option key={city.id} value={city.id}>{regionalName ? `${regionalName} · ` : ""}{city.name}/{city.state}</option>)}</select><p className="helper">Define os vínculos territoriais.</p></Field>
          <Field label="Tipo de evento" htmlFor="event-type"><select id="event-type" required value={form.eventTypeId} onChange={event => setForm({ ...form, eventTypeId: event.target.value })} className="control"><option value="">Selecionar</option>{references.data?.eventTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></Field>
          <Field label="Supervisor comercial" htmlFor="event-supervisor"><select id="event-supervisor" value={form.commercialSupervisorId} onChange={event => setForm({ ...form, commercialSupervisorId: event.target.value })} className="control"><option value="">Não definido</option>{references.data?.supervisors.map(supervisor => <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>)}</select></Field>
          <Field label="Início" htmlFor="event-start"><Input id="event-start" required type="datetime-local" value={form.startsAt} onChange={event => setForm({ ...form, startsAt: event.target.value })} /></Field>
          <Field label="Término" htmlFor="event-end"><Input id="event-end" type="datetime-local" value={form.endsAt} onChange={event => setForm({ ...form, endsAt: event.target.value })} /></Field>
          <Field label="Modalidade" htmlFor="event-partnership"><select id="event-partnership" value={form.partnershipType} onChange={event => setForm({ ...form, partnershipType: event.target.value as typeof form.partnershipType })} className="control"><option value="paid">Pago</option><option value="barter">Permuta</option><option value="mixed">Misto</option></select></Field>
          <Field label="Custo previsto (R$)" htmlFor="event-cost"><Input id="event-cost" required min="0" step="0.01" type="number" value={form.estimatedCost} onChange={event => setForm({ ...form, estimatedCost: event.target.value })} /></Field>
          <div className="md:col-span-4"><Label htmlFor="event-address">Localização e ponto de referência</Label><Input id="event-address" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} className="mt-1.5" /></div>
          <div className="md:col-span-2"><Label htmlFor="event-reason">Motivo da parceria</Label><Textarea id="event-reason" value={form.partnershipReason} onChange={event => setForm({ ...form, partnershipReason: event.target.value })} className="mt-1.5 min-h-24" /></div>
          <div className="md:col-span-2"><Label htmlFor="event-pre">Entregáveis e observações pré-evento</Label><Textarea id="event-pre" value={form.preEventNotes} onChange={event => setForm({ ...form, preEventNotes: event.target.value })} className="mt-1.5 min-h-24" /></div>
          <MultiSelect label="Responsáveis do trade" id="event-team" values={form.teamMemberIds} onChange={ids => setForm({ ...form, teamMemberIds: ids })}>{references.data?.teamUsers.map(member => <option key={member.id} value={member.id}>{member.name || member.email || `Usuário #${member.id}`}{member.jobTitle ? ` · ${member.jobTitle}` : ""}</option>)}</MultiSelect>
          <MultiSelect label="Fornecedores envolvidos" id="event-suppliers" values={form.supplierIds} disabled={!form.cityId} onChange={ids => setForm({ ...form, supplierIds: ids })}>{references.data?.suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.displayName}</option>)}</MultiSelect>
          <MultiSelect label="Serviços" id="event-services" values={form.serviceTypeIds} onChange={ids => setForm({ ...form, serviceTypeIds: ids })}>{references.data?.serviceTypes.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</MultiSelect>
          <MultiSelect label="Recursos de estoque" id="event-stock" values={form.stockAllocations.map(item => item.stockItemId)} disabled={!form.cityId} onChange={stockItemIds => setForm(current => ({ ...current, stockAllocations: stockItemIds.map(stockItemId => current.stockAllocations.find(item => item.stockItemId === stockItemId) ?? { stockItemId, quantity: "1" }) }))}>{references.data?.stockItems.map(item => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}</MultiSelect>
          {form.stockAllocations.length > 0 && <div className="md:col-span-4 rounded-xl border border-border bg-muted/50 p-4"><p className="text-xs font-semibold text-foreground">Quantidade planejada por recurso</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{form.stockAllocations.map(allocation => { const item = references.data?.stockItems.find(stock => stock.id === allocation.stockItemId); return <label key={allocation.stockItemId} className="flex items-center gap-2 text-xs text-foreground"><span className="min-w-0 flex-1 truncate">{item?.name}</span><Input aria-label={`Quantidade planejada para ${item?.name ?? allocation.stockItemId}`} required min="0.01" step="0.01" type="number" value={allocation.quantity} onChange={event => setForm(current => ({ ...current, stockAllocations: current.stockAllocations.map(stock => stock.stockItemId === allocation.stockItemId ? { ...stock, quantity: event.target.value } : stock) }))} className="h-8 w-24" /><span>{item?.unit}</span></label>; })}</div></div>}
          <div className="flex justify-end gap-2 md:col-span-4"><Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancelar</Button><Button type="submit" disabled={create.isPending} className="bg-primary hover:bg-primary/90">{create.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}Planejar evento</Button></div>
        </form>
      </DialogContent>
    </Dialog>

    <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-display text-lg font-semibold text-foreground">Agenda e avaliação</h2><p className="mt-0.5 text-xs text-muted-foreground">Acompanhe a jornada do evento e documente o aprendizado.</p></div><Badge variant="outline">{eventList.data?.length ?? 0} eventos</Badge></div>
      {eventList.isLoading ? <div className="p-10 text-center text-sm text-muted-foreground">Carregando eventos...</div> : eventList.data?.length ? <div className="divide-y divide-border">{eventList.data.map(({ event, cityName, eventTypeName, supervisorName, teamMembers, stockItems }) => <article key={event.id} className="px-5 py-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{event.name}</p><Badge className="bg-secondary text-secondary-foreground">{statusLabel[event.status]}</Badge><Badge variant="outline">{partnershipLabel[event.partnershipType]}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{eventTypeName} · {cityName} · {new Date(event.startsAt).toLocaleString("pt-BR")}{event.endsAt ? ` até ${new Date(event.endsAt).toLocaleString("pt-BR")}` : ""}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Handshake className="h-3.5 w-3.5" /> {Number(event.estimatedCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>{supervisorName && <span>Supervisor: {supervisorName}</span>}{teamMembers.length > 0 && <span className="inline-flex items-center gap-1"><UsersRound className="h-3.5 w-3.5" /> {teamMembers.map(member => member.name || `Usuário #${member.userId}`).join(", ")}</span>}{stockItems.length > 0 && <span className="inline-flex items-center gap-1"><PackageCheck className="h-3.5 w-3.5" /> {stockItems.length} recurso(s)</span>}</div>{event.rating && <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"><Star className="h-3.5 w-3.5 fill-current" /> Nota {event.rating}/5{event.worthRenewing ? " · Recomendado renovar" : " · Avaliar renovação"}</p>}</div>{canWrite && <Button variant="outline" size="sm" className="shrink-0" onClick={() => setPostEventId(postEventId === event.id ? null : event.id)}><ClipboardCheck className="mr-1.5 h-3.5 w-3.5" /> Pós-evento</Button>}</div>
        {postEventId === event.id && <form onSubmit={formEvent => { formEvent.preventDefault(); savePost.mutate({ eventId: event.id, postEventNotes: post.postEventNotes || undefined, rating: Number(post.rating), resultAchieved: post.resultAchieved, worthRenewing: post.worthRenewing, status: post.status }); }} className="mt-4 grid gap-3 rounded-xl border border-border bg-muted/50 p-4 md:grid-cols-4"><Field label="Status" htmlFor={`event-status-${event.id}`}><select id={`event-status-${event.id}`} value={post.status} onChange={input => setPost({ ...post, status: input.target.value as typeof post.status })} className="control"><option value="in_progress">Em execução</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option></select></Field><Field label="Nota" htmlFor={`event-rating-${event.id}`}><select id={`event-rating-${event.id}`} value={post.rating} onChange={input => setPost({ ...post, rating: input.target.value })} className="control">{[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{rating} estrela{rating > 1 ? "s" : ""}</option>)}</select></Field><label className="flex items-center gap-2 pt-6 text-xs text-foreground"><input type="checkbox" checked={post.resultAchieved} onChange={input => setPost({ ...post, resultAchieved: input.target.checked })} /> Resultado atingido</label><label className="flex items-center gap-2 pt-6 text-xs text-foreground"><input type="checkbox" checked={post.worthRenewing} onChange={input => setPost({ ...post, worthRenewing: input.target.checked })} /> Vale renovar</label><div className="md:col-span-4"><Label htmlFor={`event-post-${event.id}`}>Debriefing</Label><Textarea id={`event-post-${event.id}`} value={post.postEventNotes} onChange={input => setPost({ ...post, postEventNotes: input.target.value })} className="mt-1.5" placeholder="Registre aprendizados, entregáveis e recomendações." /></div><div className="flex justify-end md:col-span-4"><Button size="sm" type="submit" disabled={savePost.isPending} className="bg-primary hover:bg-primary/90">Salvar avaliação</Button></div></form>}</article>)}</div> : <div className="p-10 text-center text-sm text-muted-foreground">Nenhum evento registrado. Planeje o primeiro evento para iniciar o acompanhamento.</div>}
    </section>
  </main>;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) { return <div><Label htmlFor={htmlFor}>{label}</Label><div className="mt-1.5">{children}</div></div>; }
function MultiSelect({ label, id, values, disabled, onChange, children }: { label: string; id: string; values: number[]; disabled?: boolean; onChange: (ids: number[]) => void; children: React.ReactNode }) { return <div className="md:col-span-2"><Label htmlFor={id}>{label}</Label><select id={id} multiple value={values.map(String)} disabled={disabled} onChange={event => onChange(selectedIds(event))} className="control mt-1.5 h-24 disabled:opacity-50">{children}</select>{disabled && <p className="helper">Selecione uma cidade primeiro.</p>}</div>; }
