import { FormEvent, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Building2, CalendarClock, CheckCircle2, ExternalLink, History, Plus, Route, Truck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import TraditionalScheduleEditor, { createEmptyTraditionalSchedule, type TraditionalScheduleItem } from "@/components/TraditionalScheduleEditor";
import EvidenceUpload from "@/components/EvidenceUpload";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const statusLabels: Record<string, string> = { active: "Ativa", inactive: "Inativa", scheduled: "Agendada", completed: "Encerrada", cancelled: "Cancelada" };
const partnershipLabels: Record<string, string> = { paid: "Pago", barter: "Permuta", mixed: "Misto" };
const emptyForm = { tradeCampaignId: "", name: "", startsOn: "", endsOn: "", partnershipType: "paid" as "paid" | "barter" | "mixed", routeOrDistribution: "", materialFormat: "", materialQuantity: "", notes: "", signalNeighborhoodIds: [] as number[], schedules: [createEmptyTraditionalSchedule()] as TraditionalScheduleItem[] };

export default function ExternalMediaPointDetails({ mediaPointId }: { mediaPointId: number }) {
  const [, setLocation] = useLocation();
  const { can } = useEffectivePermissions();
  const canWrite = can("media.write");
  const utils = trpc.useUtils();
  const detail = trpc.media.pointDetails.useQuery({ mediaPointId });
  const tradeCampaigns = trpc.campaigns.list.useQuery();
  const references = trpc.media.referenceData.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const point = detail.data;
  const isSoundCar = point?.operationCategory === "sound_car";
  const pointKind = isSoundCar ? "Carro de som" : "Panfletagem e distribuição externa";
  const neighborhoodOptions = useMemo(() => (references.data?.neighborhoods ?? []).filter(neighborhood => neighborhood.cityId === point?.cityId).map(neighborhood => ({ id: neighborhood.id, label: neighborhood.name, description: point?.cityName ?? undefined })), [point?.cityId, point?.cityName, references.data?.neighborhoods]);

  const invalidate = () => { utils.media.pointDetails.invalidate({ mediaPointId }); utils.media.list.invalidate(); };
  const createVeiculation = trpc.media.createConfiguredCampaign.useMutation({
    onSuccess: result => { toast.success(result.status === "scheduled" ? "Veiculação externa agendada." : "Veiculação externa criada."); invalidate(); setShowForm(false); setForm(emptyForm); },
    onError: error => toast.error(error.message),
  });
  const updateStatus = trpc.media.updateCampaignStatus.useMutation({
    onSuccess: () => { toast.success("Status da veiculação atualizado."); invalidate(); },
    onError: error => toast.error(error.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!point) return;
    const schedules: Array<{ programName: string; neighborhoodId: number | null; startsAt: string; endsAt: string; notes?: string; specificDate?: string | null; weekday?: number | null }> = !isSoundCar ? form.schedules.filter(item => item.programName.trim() && item.startsAt && item.endsAt).flatMap((item): Array<{ programName: string; neighborhoodId: number | null; startsAt: string; endsAt: string; notes?: string; specificDate?: string | null; weekday?: number | null }> => {
      const base = { programName: item.programName.trim(), neighborhoodId: item.neighborhoodId ?? null, startsAt: item.startsAt, endsAt: item.endsAt, notes: item.notes?.trim() || undefined };
      if (item.specificDates?.length) return item.specificDates.map(specificDate => ({ ...base, specificDate, weekday: null }));
      if (item.specificDate) return [{ ...base, specificDate: item.specificDate, weekday: null }];
      return [];
    }) : [];
    if (!isSoundCar && !form.signalNeighborhoodIds.length) { toast.error("Selecione pelo menos um bairro para a panfletagem."); return; }
    if (!isSoundCar && (!schedules.length || form.schedules.some(item => item.programName.trim() && !item.specificDates?.length))) { toast.error("Adicione pelo menos uma data, horário e bairro para a panfletagem."); return; }
    if (!isSoundCar && form.schedules.some(item => item.programName.trim() && !item.neighborhoodId)) { toast.error("Informe o bairro em cada linha da programação."); return; }
    const details = [!isSoundCar && form.materialFormat.trim() ? `Formato: ${form.materialFormat.trim()}` : "", !isSoundCar && form.materialQuantity ? `Quantidade: ${form.materialQuantity}` : "", isSoundCar && form.routeOrDistribution.trim() ? `Rota e horários: ${form.routeOrDistribution.trim()}` : ""].filter(Boolean).join("\n");
    createVeiculation.mutate({
      mediaPointId: point.id,
      tradeCampaignId: form.tradeCampaignId ? Number(form.tradeCampaignId) : null,
      name: form.name,
      startsOn: form.startsOn,
      endsOn: form.endsOn,
      partnershipType: form.partnershipType,
      estimatedCost: 0,
      notes: form.notes || undefined,
      campaignDetails: details || undefined,
      campaignConfig: isSoundCar ? { dailyRoute: form.routeOrDistribution || undefined, audioBrief: form.notes || undefined } : { materialFormat: form.materialFormat || undefined, materialQuantity: form.materialQuantity ? Number(form.materialQuantity) : undefined },
      cityDistributions: [],
      signalNeighborhoodIds: isSoundCar ? [] : form.signalNeighborhoodIds,
      schedules,
    });
  };

  const changeStatus = (campaignId: number, status: "active" | "inactive" | "completed" | "cancelled") => {
    if ((status === "completed" || status === "cancelled") && !window.confirm(`Confirma marcar esta veiculação como ${statusLabels[status].toLocaleLowerCase("pt-BR")}?`)) return;
    updateStatus.mutate({ campaignId, status });
  };

  return <main className="hub-entity-page">
    <Button type="button" variant="outline" onClick={() => setLocation(isSoundCar ? "/midias/carro-de-som" : "/midias/panfletagem")} className="border-border"><ArrowLeft className="mr-1.5 h-4 w-4" />Voltar para mídia externa</Button>
    <header className="hub-entity-header"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Truck className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Ficha operacional de mídia externa</p><h1 className="mt-1 font-display text-3xl font-semibold text-foreground">{point?.name ?? "Detalhes da mídia externa"}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Esta página é exclusiva para {pointKind.toLocaleLowerCase("pt-BR")}. Ela possui fluxo, controles e histórico próprios, separados de Mídias Urbanas.</p></div></div></header>
    {detail.isLoading ? <div className="grid h-48 place-items-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">Carregando detalhes...</div> : !point ? <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">Esta mídia externa não foi encontrada ou você não possui acesso a ela.</div> : <>
      <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
        <aside className="space-y-4">
          <article className="rounded-2xl border border-border bg-secondary p-5"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Building2 className="h-4 w-4 text-primary" />Identificação do ponto</div><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-muted-foreground">Fornecedor</dt><dd className="font-medium text-foreground">{point.supplierName}</dd></div><div><dt className="text-xs text-muted-foreground">Cidade e regional</dt><dd className="font-medium text-foreground">{point.cityName} · {point.regionalName}</dd></div><div><dt className="text-xs text-muted-foreground">Tipo de operação</dt><dd className="font-medium text-foreground">{pointKind}</dd></div><div><dt className="text-xs text-muted-foreground">Tipo de mídia</dt><dd className="font-medium text-foreground">{point.mediaTypeName}</dd></div><div><dt className="text-xs text-muted-foreground">Contrato</dt><dd className="font-medium text-foreground">{point.contractStartsOn || "Sem início"} até {point.contractEndsOn || "Sem término"} · {partnershipLabels[point.partnershipType] ?? point.partnershipType}</dd></div><div><dt className="text-xs text-muted-foreground">Localização ou rota</dt><dd className="font-medium text-foreground">{point.address || "Não informada"}</dd></div></dl></article>
          <article className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><History className="h-4 w-4 text-primary" />Histórico da mídia externa</div><div className="mt-4 space-y-3">{point.history.length ? point.history.map(entry => <div key={`${entry.scope}-${entry.id}`} className="border-l-2 border-primary/50 pl-3"><p className="text-xs font-medium text-foreground">{entry.action === "schedule" ? "Veiculação agendada" : entry.action === "reschedule" ? "Veiculação reagendada" : entry.action.startsWith("status_") ? `Status alterado para ${statusLabels[entry.action.replace("status_", "")] ?? entry.action}` : entry.action === "create" ? "Registro criado" : "Atualização registrada"}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(entry.occurredAt).toLocaleString("pt-BR")}</p></div>) : <p className="text-sm text-muted-foreground">Ainda não há eventos registrados.</p>}</div></article>
        </aside>
        <section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><p className="font-display text-lg font-semibold text-foreground">Veiculações externas</p><p className="mt-0.5 text-xs text-muted-foreground">Controle de agenda, rota ou distribuição, evidências e situação da operação.</p></div>{canWrite && <Button type="button" onClick={() => { setForm(emptyForm); setShowForm(true); }} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="mr-1.5 h-4 w-4" />Nova veiculação</Button>}</div><div className="divide-y divide-border">{point.campaigns.length ? point.campaigns.map(campaign => <article key={campaign.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{campaign.name}</p><Badge className="border-0 bg-primary/10 text-[10px] text-primary">{statusLabels[campaign.status] ?? campaign.status}</Badge><Badge className="border-0 bg-secondary text-[10px] text-foreground">{partnershipLabels[campaign.partnershipType] ?? campaign.partnershipType}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{new Date(`${campaign.startsOn}T12:00:00`).toLocaleDateString("pt-BR")} até {new Date(`${campaign.endsOn}T12:00:00`).toLocaleDateString("pt-BR")}</p>{!isSoundCar && campaign.neighborhoodDistributions?.length ? <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Bairros:</span> {campaign.neighborhoodDistributions.map(neighborhood => neighborhood.neighborhoodName).filter(Boolean).join(", ")}</p> : null}{!isSoundCar && campaign.schedules?.length ? <div className="mt-2 rounded-lg bg-secondary/40 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Calendário da panfletagem</p>{campaign.schedules.slice(0, 4).map((schedule, scheduleIndex) => <p key={`${campaign.id}-schedule-${scheduleIndex}`} className="mt-1 text-xs text-foreground">{schedule.specificDate ? new Date(`${schedule.specificDate}T12:00:00`).toLocaleDateString("pt-BR") : "Data recorrente"} · {schedule.startsAt}–{schedule.endsAt}{schedule.neighborhoodName ? ` · ${schedule.neighborhoodName}` : ""}</p>)}{campaign.schedules.length > 4 ? <p className="mt-1 text-[11px] text-muted-foreground">+{campaign.schedules.length - 4} horários</p> : null}</div> : null}{campaign.campaignDetails && <p className="mt-2 whitespace-pre-line text-xs leading-5 text-muted-foreground">{campaign.campaignDetails}</p>}</div><div className="flex flex-wrap gap-2">{canWrite && campaign.status === "scheduled" && <Button size="sm" variant="outline" onClick={() => changeStatus(campaign.id, "active")}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Ativar</Button>}{canWrite && campaign.status === "active" && <Button size="sm" variant="outline" onClick={() => changeStatus(campaign.id, "inactive")}><XCircle className="mr-1 h-3.5 w-3.5" />Inativar</Button>}{canWrite && ["active", "inactive"].includes(campaign.status) && <Button size="sm" variant="outline" onClick={() => changeStatus(campaign.id, "completed")}>Encerrar</Button>}{canWrite && ["scheduled", "active", "inactive"].includes(campaign.status) && <Button size="sm" variant="outline" className="text-destructive" onClick={() => changeStatus(campaign.id, "cancelled")}>Cancelar</Button>}</div></div><div className="mt-3 flex flex-wrap gap-2">{campaign.evidences.map(evidence => <a key={evidence.id} href={evidence.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-foreground hover:bg-primary/10"><ExternalLink className="h-3 w-3" />{evidence.originalName}</a>)}</div><div className="mt-3"><EvidenceUpload entityType="media_campaign" entityId={campaign.id} regionalId={point.regionalId} canWrite={canWrite} title="Adicionar evidência da operação" /></div></article>) : <div className="p-8 text-center"><Route className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-semibold text-foreground">Nenhuma veiculação externa registrada</p><p className="mt-1 text-xs text-muted-foreground">Crie a primeira veiculação para acompanhar a execução desta mídia.</p></div>}</div></section>
      </div>
    </>}
    <Dialog open={showForm} onOpenChange={setShowForm}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Nova veiculação externa</DialogTitle><DialogDescription>Registre a vigência, contratação e as instruções específicas de {pointKind.toLocaleLowerCase("pt-BR")}.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4 pt-2 md:grid-cols-2"><label className="space-y-1.5 md:col-span-2"><Label htmlFor="external-veiculation-name">Nome da veiculação</Label><Input id="external-veiculation-name" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Veiculação de lançamento regional" /></label><div className="md:col-span-2"><SearchableMultiSelect id="external-trade-campaign" label="Campanha comercial vinculada" options={(tradeCampaigns.data ?? []).map(campaign => ({ id: campaign.id, label: campaign.name, description: campaign.status === "active" ? "Ativa" : "Planejada" }))} values={form.tradeCampaignId ? [Number(form.tradeCampaignId)] : []} onChange={values => setForm({ ...form, tradeCampaignId: values[0] ? String(values[0]) : "" })} maxSelections={1} placeholder="Vincular campanha (opcional)" emptyMessage="Nenhuma campanha disponível" /></div><label className="space-y-1.5"><Label htmlFor="external-start">Início da veiculação</Label><Input id="external-start" required type="date" value={form.startsOn} onChange={event => setForm({ ...form, startsOn: event.target.value })} /></label><label className="space-y-1.5"><Label htmlFor="external-end">Fim da veiculação</Label><Input id="external-end" required type="date" value={form.endsOn} onChange={event => setForm({ ...form, endsOn: event.target.value })} /></label><SearchableMultiSelect id="external-partnership" label="Tipo de contrato" options={[{ id: 1, label: "Pago" }, { id: 2, label: "Permuta" }, { id: 3, label: "Misto" }]} values={[({ paid: 1, barter: 2, mixed: 3 } as const)[form.partnershipType]]} onChange={values => setForm({ ...form, partnershipType: ({ 1: "paid", 2: "barter", 3: "mixed" } as const)[values[0] as 1 | 2 | 3] ?? "paid" })} maxSelections={1} placeholder="Selecionar tipo de contrato" />{isSoundCar ? <label className="space-y-1.5 md:col-span-2"><Label htmlFor="external-route">Rota, bairros e horários</Label><Textarea id="external-route" value={form.routeOrDistribution} onChange={event => setForm({ ...form, routeOrDistribution: event.target.value })} placeholder="Cidades, bairros, horários e período de circulação" /></label> : <><label className="space-y-1.5"><Label htmlFor="external-format">Formato do material</Label><Input id="external-format" value={form.materialFormat} onChange={event => setForm({ ...form, materialFormat: event.target.value })} placeholder="Ex.: Folder A5 frente e verso" /></label><label className="space-y-1.5"><Label htmlFor="external-quantity">Quantidade de materiais</Label><Input id="external-quantity" type="number" min="1" value={form.materialQuantity} onChange={event => setForm({ ...form, materialQuantity: event.target.value })} placeholder="Ex.: 5000" /></label><div className="md:col-span-2"><SearchableMultiSelect id="external-neighborhoods" label="Bairros da panfletagem" options={neighborhoodOptions} values={form.signalNeighborhoodIds} onChange={signalNeighborhoodIds => setForm({ ...form, signalNeighborhoodIds })} maxSelections={500} placeholder="Selecionar bairros" emptyMessage="Nenhum bairro ativo cadastrado para esta cidade" /></div><div className="md:col-span-2"><TraditionalScheduleEditor value={form.schedules} onChange={schedules => setForm(current => ({ ...current, schedules }))} neighborhoodOptions={neighborhoodOptions} territorialMode /></div></>}<label className="space-y-1.5 md:col-span-2"><Label htmlFor="external-notes">Observações da veiculação</Label><Textarea id="external-notes" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Briefing, responsável, comprovações esperadas e orientações internas" /></label><div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={createVeiculation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90"><CalendarClock className="mr-1.5 h-4 w-4" />{createVeiculation.isPending ? "Salvando..." : "Salvar veiculação"}</Button></div></form></DialogContent></Dialog>
  </main>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-secondary p-3"><p className="text-[11px] font-semibold uppercase tracking-[.1em] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium text-foreground">{value}</p></div>; }
