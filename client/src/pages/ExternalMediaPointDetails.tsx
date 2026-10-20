import { FormEvent, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Building2, CalendarClock, CheckCircle2, ExternalLink, History, Loader2, Plus, Route, Trash2, Truck, XCircle, Pencil } from "lucide-react";
import { EditLeafletingDialog, LeafletingCalendarManager, type LeafletingCampaign } from "@/components/LeafletingOperations";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import TraditionalScheduleEditor, { createEmptyTraditionalSchedule, type TraditionalScheduleItem } from "@/components/TraditionalScheduleEditor";
import EvidenceUpload from "@/components/EvidenceUpload";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const canDelete = can("media.delete");
  const utils = trpc.useUtils();
  const detail = trpc.media.pointDetails.useQuery({ mediaPointId });
  const tradeCampaigns = trpc.campaigns.list.useQuery();
  const references = trpc.media.referenceData.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingCampaign, setEditingCampaign] = useState<LeafletingCampaign | null>(null);
  const [confirmDeleteCampaign, setConfirmDeleteCampaign] = useState<{ id: number; name: string } | null>(null);
  const point = detail.data;
  const isSoundCar = point?.operationCategory === "sound_car";
  const pointKind = isSoundCar ? "Carro de som" : "Panfletagem e distribuição externa";
  const neighborhoodOptions = useMemo(() => (references.data?.neighborhoods ?? []).filter(neighborhood => neighborhood.cityId === point?.cityId).map(neighborhood => ({ id: neighborhood.id, label: neighborhood.name, description: point?.cityName ?? undefined })), [point?.cityId, point?.cityName, references.data?.neighborhoods]);
  const regionalCityOptions = useMemo(() => {
    if (!point?.regionalId) return [];
    return (references.data?.cities ?? [])
      .filter(item => item.city.regionalId === point.regionalId)
      .map(({ city, regionalName }) => ({ id: city.id, label: city.name, description: regionalName }));
  }, [point?.regionalId, references.data?.cities]);

  const [additionalPointIds, setAdditionalPointIds] = useState<number[]>([]);
  const otherPointsQuery = trpc.media.list.useQuery(
    point?.operationCategory ? { operationCategory: point.operationCategory as any } : undefined,
    { enabled: Boolean(point?.operationCategory) }
  );
  const otherPointsOptions = useMemo(() => {
    if (!otherPointsQuery.data || !point) return [];
    return otherPointsQuery.data
      .filter(p => p.id !== point.id)
      .map(p => ({
        id: p.id,
        label: !isSoundCar ? (p.supplierName || p.name) : p.name,
        description: `${p.cityName} · ${p.regionalName}`
      }));
  }, [otherPointsQuery.data, point, isSoundCar]);

  const invalidate = () => { utils.media.pointDetails.invalidate({ mediaPointId }); utils.media.list.invalidate(); };
  const deleteCampaignMutation = trpc.media.deleteCampaign.useMutation({
    onSuccess: () => {
      toast.success("Veiculação excluída com sucesso.");
      setConfirmDeleteCampaign(null);
      invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const createVeiculation = trpc.media.createConfiguredCampaign.useMutation({
    onSuccess: result => { toast.success(result.status === "scheduled" ? (!isSoundCar ? "Panfletagem agendada." : "Veiculação externa agendada.") : (!isSoundCar ? "Panfletagem criada." : "Veiculação externa criada.")); invalidate(); setShowForm(false); setForm(emptyForm); setAdditionalPointIds([]); },
    onError: error => toast.error(error.message),
  });
  const updateStatus = trpc.media.updateCampaignStatus.useMutation({
    onSuccess: () => { toast.success("Status atualizado com sucesso."); invalidate(); },
    onError: error => toast.error(error.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!point) return;
    const schedules = !isSoundCar ? form.schedules.filter(item => item.programName.trim() && item.startsAt && item.endsAt).flatMap(item => {
      const base = { programName: item.programName.trim(), cityId: item.cityId ?? null, neighborhoodId: item.neighborhoodId ?? null, startsAt: item.startsAt, endsAt: item.endsAt, notes: item.notes?.trim() || undefined };
      if (item.specificDates?.length) return item.specificDates.map(specificDate => ({ ...base, specificDate, weekday: null }));
      if (item.specificDate) return [{ ...base, specificDate: item.specificDate, weekday: null }];
      return [];
    }) : [];
    if (!isSoundCar && (!schedules.length || form.schedules.some(item => item.programName.trim() && !item.specificDates?.length))) { toast.error("Adicione pelo menos uma data e horário para a panfletagem."); return; }
    const details = [!isSoundCar && form.materialFormat.trim() ? `Formato: ${form.materialFormat.trim()}` : "", !isSoundCar && form.materialQuantity ? `Quantidade: ${form.materialQuantity}` : "", isSoundCar && form.routeOrDistribution.trim() ? `Rota e horários: ${form.routeOrDistribution.trim()}` : ""].filter(Boolean).join("\n");
    const scheduleCityIds = Array.from(new Set(schedules.map(s => s.cityId).filter((id): id is number => typeof id === "number")));
    const cityDistributions = scheduleCityIds.map(cityId => ({ cityId, quantity: 1 }));

    createVeiculation.mutate({
      mediaPointId: point.id,
      mediaPointIds: [point.id, ...additionalPointIds],
      tradeCampaignId: form.tradeCampaignId ? Number(form.tradeCampaignId) : null,
      name: form.name,
      startsOn: form.startsOn,
      endsOn: form.endsOn,
      partnershipType: form.partnershipType,
      estimatedCost: 0,
      notes: form.notes || undefined,
      campaignDetails: details || undefined,
      campaignConfig: isSoundCar ? { dailyRoute: form.routeOrDistribution || undefined, audioBrief: form.notes || undefined } : { materialFormat: form.materialFormat || undefined, materialQuantity: form.materialQuantity ? Number(form.materialQuantity) : undefined },
      cityDistributions,
      signalNeighborhoodIds: isSoundCar ? form.signalNeighborhoodIds : [],
      schedules,
    });
  };

  const changeStatus = (campaignId: number, status: "active" | "inactive" | "completed" | "cancelled") => {
    if ((status === "completed" || status === "cancelled") && !window.confirm(`Confirma marcar este item como ${statusLabels[status].toLocaleLowerCase("pt-BR")}?`)) return;
    updateStatus.mutate({ campaignId, status });
  };

  return <main className="hub-entity-page">
    <Button type="button" variant="outline" onClick={() => setLocation(isSoundCar ? "/midias/carro-de-som" : "/midias/panfletagem")} className="border-border"><ArrowLeft className="mr-1.5 h-4 w-4" />Voltar para {isSoundCar ? "carro de som" : "panfletagem"}</Button>
    <header className="hub-entity-header"><div className="flex items-start gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Truck className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{isSoundCar ? "Ficha operacional de carro de som" : "Ficha operacional de fornecedor de panfletagem"}</p><h1 className="mt-1 font-display text-3xl font-semibold text-foreground">{!isSoundCar ? (point?.supplierName || point?.name) : (point?.name ?? "Detalhes da mídia externa")}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{!isSoundCar ? "Gerencie as ações de panfletagem deste fornecedor, datas, tiragem, cidades e comprovações da distribuição." : "Esta página é exclusiva para carro de som. Ela possui fluxo, controles e histórico próprios, separados de Mídias Urbanas."}</p></div></div></header>
    {detail.isLoading ? <div className="grid h-48 place-items-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">Carregando detalhes...</div> : !point ? <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">Este registro não foi encontrado ou você não possui acesso a ele.</div> : <>
      <div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
        <aside className="space-y-4">
          <article className="rounded-2xl border border-border bg-secondary p-5"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Building2 className="h-4 w-4 text-primary" />Identificação do {!isSoundCar ? "fornecedor" : "ponto"}</div><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-muted-foreground">Fornecedor</dt><dd className="font-medium text-foreground">{point.supplierName}</dd></div><div><dt className="text-xs text-muted-foreground">{!isSoundCar ? "Regional da panfletagem" : "Cidade e regional"}</dt><dd className="font-medium text-foreground">{!isSoundCar ? point.regionalName : `${point.cityName} · ${point.regionalName}`}</dd></div><div><dt className="text-xs text-muted-foreground">Tipo de operação</dt><dd className="font-medium text-foreground">{pointKind}</dd></div><div><dt className="text-xs text-muted-foreground">Tipo de mídia</dt><dd className="font-medium text-foreground">{point.mediaTypeName}</dd></div><div><dt className="text-xs text-muted-foreground">Contrato</dt><dd className="font-medium text-foreground">{point.contractStartsOn || "Sem início"} até {point.contractEndsOn || "Sem término"} · {partnershipLabels[point.partnershipType] ?? point.partnershipType}</dd></div>{isSoundCar && <div><dt className="text-xs text-muted-foreground">Localização ou rota</dt><dd className="font-medium text-foreground">{point.address || "Não informada"}</dd></div>}</dl></article>
          <article className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><History className="h-4 w-4 text-primary" />Histórico da operação</div><div className="mt-4 space-y-3">{point.history.length ? point.history.map(entry => <div key={`${entry.scope}-${entry.id}`} className="border-l-2 border-primary/50 pl-3"><p className="text-xs font-medium text-foreground">{entry.action === "schedule" ? (!isSoundCar ? "Panfletagem agendada" : "Veiculação agendada") : entry.action === "reschedule" ? "Reagendamento registrado" : entry.action.startsWith("status_") ? `Status alterado para ${statusLabels[entry.action.replace("status_", "")] ?? entry.action}` : entry.action === "create" ? "Registro criado" : "Atualização registrada"}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(entry.occurredAt).toLocaleString("pt-BR")}</p></div>) : <p className="text-sm text-muted-foreground">Ainda não há eventos registrados.</p>}</div></article>
        </aside>
        <section className="overflow-hidden rounded-2xl border border-border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><p className="font-display text-lg font-semibold text-foreground">{!isSoundCar ? "Panfletagens registradas" : "Veiculações externas"}</p><p className="mt-0.5 text-xs text-muted-foreground">{!isSoundCar ? "Controle de agenda por cidade, tiragem, evidências e situação da operação." : "Controle de agenda, rota ou distribuição, evidências e situação da operação."}</p></div>{canWrite && <Button type="button" onClick={() => { setForm(emptyForm); setShowForm(true); }} className="bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="mr-1.5 h-4 w-4" />{!isSoundCar ? "Nova panfletagem" : "Nova veiculação"}</Button>}</div><div className="divide-y divide-border">{point.campaigns.length ? point.campaigns.map(campaign => <article key={campaign.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{campaign.name}</p><Badge className="border-0 bg-primary/10 text-[10px] text-primary">{statusLabels[campaign.status] ?? campaign.status}</Badge><Badge className="border-0 bg-secondary text-[10px] text-foreground">{partnershipLabels[campaign.partnershipType] ?? campaign.partnershipType}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{new Date(`${campaign.startsOn}T12:00:00`).toLocaleDateString("pt-BR")} até {new Date(`${campaign.endsOn}T12:00:00`).toLocaleDateString("pt-BR")}</p>{!isSoundCar && campaign.cityDistributions?.length ? <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Cidades:</span> {campaign.cityDistributions.map(distribution => distribution.cityName).filter(Boolean).join(", ")}</p> : null}{isSoundCar && campaign.neighborhoodDistributions?.length ? <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">Bairros:</span> {campaign.neighborhoodDistributions.map(neighborhood => neighborhood.neighborhoodName).filter(Boolean).join(", ")}</p> : null}{isSoundCar && campaign.schedules?.length ? <div className="mt-2 rounded-lg bg-secondary/40 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Calendário da operação</p>{campaign.schedules.slice(0, 6).map((schedule, scheduleIndex) => <p key={`${campaign.id}-schedule-${scheduleIndex}`} className="mt-1 text-xs text-foreground">{schedule.specificDate ? new Date(`${schedule.specificDate}T12:00:00`).toLocaleDateString("pt-BR") : "Data recorrente"} · {schedule.startsAt}–{schedule.endsAt}{schedule.cityName ? ` · ${schedule.cityName}` : schedule.neighborhoodName ? ` · ${schedule.neighborhoodName}` : ""}{schedule.notes ? ` (${schedule.notes})` : ""}</p>)}{campaign.schedules.length > 6 ? <p className="mt-1 text-[11px] text-muted-foreground">+{campaign.schedules.length - 6} horários</p> : null}</div> : null}{campaign.campaignDetails && <p className="mt-2 whitespace-pre-line text-xs leading-5 text-muted-foreground">{campaign.campaignDetails}</p>}</div><div className="flex flex-wrap gap-2">{canWrite && !isSoundCar && <Button size="sm" variant="outline" className="h-8 border-border text-xs" onClick={() => setEditingCampaign(campaign as any)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar Panfletagem</Button>}{canWrite && campaign.status === "scheduled" && <Button size="sm" variant="outline" onClick={() => changeStatus(campaign.id, "active")}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Ativar</Button>}{canWrite && campaign.status === "active" && <Button size="sm" variant="outline" onClick={() => changeStatus(campaign.id, "inactive")}><XCircle className="mr-1 h-3.5 w-3.5" />Inativar</Button>}{canWrite && ["active", "inactive"].includes(campaign.status) && <Button size="sm" variant="outline" onClick={() => changeStatus(campaign.id, "completed")}>Encerrar</Button>}{canWrite && ["scheduled", "active", "inactive"].includes(campaign.status) && <Button size="sm" variant="outline" className="text-destructive" onClick={() => changeStatus(campaign.id, "cancelled")}>Cancelar</Button>}{canDelete && <Button size="sm" variant="outline" className="h-8 border-destructive/40 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setConfirmDeleteCampaign({ id: campaign.id, name: campaign.name })}><Trash2 className="mr-1 h-3.5 w-3.5" />Excluir</Button>}</div></div>{!isSoundCar && <div className="mt-4 pt-3 border-t border-border"><LeafletingCalendarManager campaignId={campaign.id} regionalId={point.regionalId} schedules={campaign.schedules as any} canWrite={canWrite} onRefresh={invalidate} /></div>}<div className="mt-3 flex flex-wrap gap-2">{campaign.evidences.map(evidence => <a key={evidence.id} href={evidence.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-foreground hover:bg-primary/10"><ExternalLink className="h-3 w-3" />{evidence.originalName}</a>)}</div><div className="mt-3"><EvidenceUpload entityType="media_campaign" entityId={campaign.id} regionalId={point.regionalId} canWrite={canWrite} title="Adicionar evidência da operação" /></div></article>) : <div className="p-8 text-center"><Route className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-semibold text-foreground">{!isSoundCar ? "Nenhuma panfletagem registrada" : "Nenhuma veiculação externa registrada"}</p><p className="mt-1 text-xs text-muted-foreground">{!isSoundCar ? "Crie a primeira panfletagem para acompanhar a distribuição territorial." : "Crie a primeira veiculação para acompanhar a execução desta mídia."}</p></div>}</div></section>
      </div>
    </>}
    <Dialog open={showForm} onOpenChange={setShowForm}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{!isSoundCar ? "Nova panfletagem" : "Nova veiculação externa"}</DialogTitle><DialogDescription>{!isSoundCar ? "Registre o período, tiragem e a programação por cidade para esta panfletagem." : "Registre a vigência, contratação e as instruções específicas de Carro de som."}</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4 pt-2 md:grid-cols-2"><label className="space-y-1.5 md:col-span-2"><Label htmlFor="external-veiculation-name">{!isSoundCar ? "Nome da panfletagem" : "Nome da veiculação"}</Label><Input id="external-veiculation-name" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder={!isSoundCar ? "Ex.: Ação de panfletagem de lançamento regional" : "Ex.: Veiculação de lançamento regional"} /></label>{otherPointsOptions.length > 0 && <div className="md:col-span-2"><SearchableMultiSelect id="external-additional-points" label={!isSoundCar ? "Aplicar também a outros fornecedores de panfletagem (opcional)" : "Aplicar também a outros pontos (opcional)"} options={otherPointsOptions} values={additionalPointIds} onChange={setAdditionalPointIds} placeholder="Selecionar mais fornecedores/pontos para esta ação" emptyMessage="Nenhum outro fornecedor disponível" /></div>}{isSoundCar && <div className="md:col-span-2"><SearchableMultiSelect id="external-trade-campaign" label="Campanha comercial vinculada" options={(tradeCampaigns.data ?? []).map(campaign => ({ id: campaign.id, label: campaign.name, description: campaign.status === "active" ? "Ativa" : "Planejada" }))} values={form.tradeCampaignId ? [Number(form.tradeCampaignId)] : []} onChange={values => setForm({ ...form, tradeCampaignId: values[0] ? String(values[0]) : "" })} maxSelections={1} placeholder="Vincular campanha (opcional)" emptyMessage="Nenhuma campanha disponível" /></div>}<label className="space-y-1.5"><Label htmlFor="external-start">{!isSoundCar ? "Início da panfletagem" : "Início da veiculação"}</Label><Input id="external-start" required type="date" value={form.startsOn} onChange={event => setForm({ ...form, startsOn: event.target.value })} /></label><label className="space-y-1.5"><Label htmlFor="external-end">{!isSoundCar ? "Fim da panfletagem" : "Fim da veiculação"}</Label><Input id="external-end" required type="date" value={form.endsOn} onChange={event => setForm({ ...form, endsOn: event.target.value })} /></label><SearchableMultiSelect id="external-partnership" label="Tipo de contrato" options={[{ id: 1, label: "Pago" }, { id: 2, label: "Permuta" }, { id: 3, label: "Misto" }]} values={[({ paid: 1, barter: 2, mixed: 3 } as const)[form.partnershipType]]} onChange={values => setForm({ ...form, partnershipType: ({ 1: "paid", 2: "barter", 3: "mixed" } as const)[values[0] as 1 | 2 | 3] ?? "paid" })} maxSelections={1} placeholder="Selecionar tipo de contrato" />{isSoundCar ? <label className="space-y-1.5 md:col-span-2"><Label htmlFor="external-route">Rota, bairros e horários</Label><Textarea id="external-route" value={form.routeOrDistribution} onChange={event => setForm({ ...form, routeOrDistribution: event.target.value })} placeholder="Cidades, bairros, horários e período de circulação" /></label> : <><label className="space-y-1.5"><Label htmlFor="external-format">Formato do material</Label><Input id="external-format" value={form.materialFormat} onChange={event => setForm({ ...form, materialFormat: event.target.value })} placeholder="Ex.: Folder A5 frente e verso" /></label><label className="space-y-1.5"><Label htmlFor="external-quantity">Quantidade de materiais</Label><Input id="external-quantity" type="number" min="1" value={form.materialQuantity} onChange={event => setForm({ ...form, materialQuantity: event.target.value })} placeholder="Ex.: 5000" /></label><div className="md:col-span-2"><TraditionalScheduleEditor value={form.schedules} onChange={schedules => setForm(current => ({ ...current, schedules }))} cityOptions={regionalCityOptions} headerContent={<SearchableMultiSelect id="external-trade-campaign" label="Campanha comercial vinculada" options={(tradeCampaigns.data ?? []).map(campaign => ({ id: campaign.id, label: campaign.name, description: campaign.status === "active" ? "Ativa" : "Planejada" }))} values={form.tradeCampaignId ? [Number(form.tradeCampaignId)] : []} onChange={values => setForm({ ...form, tradeCampaignId: values[0] ? String(values[0]) : "" })} maxSelections={1} placeholder="Vincular campanha (opcional)" emptyMessage="Nenhuma campanha disponível" />} territorialMode /></div></>}<label className="space-y-1.5 md:col-span-2"><Label htmlFor="external-notes">{!isSoundCar ? "Observações da panfletagem" : "Observações da veiculação"}</Label><Textarea id="external-notes" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Briefing, responsável, comprovações esperadas e orientações internas" /></label><div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={createVeiculation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90"><CalendarClock className="mr-1.5 h-4 w-4" />{createVeiculation.isPending ? "Salvando..." : (!isSoundCar ? "Salvar panfletagem" : "Salvar veiculação")}</Button></div></form></DialogContent></Dialog>
    <EditLeafletingDialog
      campaign={editingCampaign}
      regionalId={point?.regionalId ?? null}
      open={editingCampaign !== null}
      onOpenChange={open => {
        if (!open) setEditingCampaign(null);
      }}
      onSuccess={invalidate}
    />
    <AlertDialog open={Boolean(confirmDeleteCampaign)} onOpenChange={open => { if (!open && !deleteCampaignMutation.isPending) setConfirmDeleteCampaign(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir veiculação?</AlertDialogTitle>
          <AlertDialogDescription>
            Você está prestes a excluir a veiculação <strong>{confirmDeleteCampaign?.name}</strong>. A exclusão é permanente e removerá todas as agendas, evidências e dados vinculados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteCampaignMutation.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteCampaignMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (confirmDeleteCampaign) deleteCampaignMutation.mutate({ id: confirmDeleteCampaign.id });
            }}
          >
            {deleteCampaignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Excluir veiculação
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </main>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-secondary p-3"><p className="text-[11px] font-semibold uppercase tracking-[.1em] text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium text-foreground">{value}</p></div>; }

