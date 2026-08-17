import { MapView } from "@/components/Map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CalendarClock, ChevronRight, ExternalLink, FileText, History, MapPin, Paperclip, Plus, RadioTower, Upload } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const emptyForm = { name: "", startsOn: "", endsOn: "", subserviceTypeId: "", tradeCampaignId: "", responsibleUserId: "", campaignDetails: "" };
const statusLabels: Record<string, string> = { active: "Ativa", inactive: "Inativa", scheduled: "Agendada", completed: "Encerrada", cancelled: "Cancelada" };
const partnershipLabels: Record<string, string> = { paid: "Pago", barter: "Permuta", mixed: "Misto" };
const frequencyLabels: Record<string, string> = { weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal", quarterly: "Trimestral", semiannual: "Semestral", annual: "Anual", custom: "Personalizada" };

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o PDF selecionado."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "Não informado";
  return new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}

function PointMap({ point }: { point: { name: string; latitude?: string | number | null; longitude?: string | number | null } }) {
  const coordinates = point.latitude != null && point.longitude != null ? { lat: Number(point.latitude), lng: Number(point.longitude) } : null;
  if (!coordinates || Number.isNaN(coordinates.lat) || Number.isNaN(coordinates.lng)) return <div className="grid h-56 place-items-center bg-secondary px-4 text-center text-xs text-muted-foreground">Coordenadas não informadas para este ponto.</div>;
  return <MapView className="h-56" initialCenter={coordinates} initialZoom={16} onMapReady={map => { if (window.google?.maps?.marker?.AdvancedMarkerElement) new window.google.maps.marker.AdvancedMarkerElement({ map, position: coordinates, title: point.name }); else new window.google.maps.Marker({ map, position: coordinates, title: point.name }); }} />;
}

export default function UrbanPointDetails({ mediaPointId }: { mediaPointId: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const detail = trpc.media.pointDetails.useQuery({ mediaPointId });
  const references = trpc.media.referenceData.useQuery();
  const tradeCampaigns = trpc.campaigns.list.useQuery();
  const [showForm, setShowForm] = useState(() => new URLSearchParams(window.location.search).get("nova") === "1");
  const [form, setForm] = useState(emptyForm);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const point = detail.data;
  const createVeiculation = trpc.media.createUrbanVeiculation.useMutation();
  const uploadMedia = trpc.documents.upload.useMutation();
  const subservices = useMemo(() => references.data?.subserviceTypes ?? references.data?.serviceTypes?.filter(service => Boolean(service.parentServiceTypeId)) ?? [], [references.data]);
  const activeTradeCampaigns = tradeCampaigns.data?.filter(campaign => campaign.status !== "cancelled") ?? [];

  const invalidate = async () => {
    await Promise.all([utils.media.pointDetails.invalidate({ mediaPointId }), utils.media.list.invalidate()]);
  };
  const closeForm = () => {
    setShowForm(false);
    setForm(emptyForm);
    setMediaFile(null);
    setLocation(`/midias/${mediaPointId}`);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name || !form.startsOn || !form.endsOn || !form.subserviceTypeId || !form.campaignDetails.trim()) return toast.error("Preencha o nome, o período, o SubServiço e os detalhes da veiculação.");
    if (!mediaFile) return toast.error("Anexe a mídia utilizada em PDF.");
    if (mediaFile.type !== "application/pdf") return toast.error("A mídia utilizada deve estar em formato PDF.");
    try {
      const created = await createVeiculation.mutateAsync({ mediaPointId, name: form.name, startsOn: form.startsOn, endsOn: form.endsOn, serviceTypeId: Number(form.subserviceTypeId), tradeCampaignId: form.tradeCampaignId ? Number(form.tradeCampaignId) : null, responsibleUserId: form.responsibleUserId ? Number(form.responsibleUserId) : null, campaignDetails: form.campaignDetails });
      await uploadMedia.mutateAsync({ entityType: "media_campaign", entityId: created.id, regionalId: point?.regionalId ?? null, documentKind: "art", originalName: mediaFile.name, mimeType: "application/pdf", dataBase64: await fileToBase64(mediaFile) });
      toast.success("Nova veiculação criada com a mídia em PDF.");
      await invalidate();
      closeForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a veiculação.");
    }
  };

  if (detail.isLoading) return <div className="grid h-56 place-items-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">Carregando ficha do ponto...</div>;
  if (!point) return <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">O ponto de Mídia Urbana não foi encontrado ou não está disponível para seu perfil.</div>;
  return <main className="mx-auto max-w-6xl space-y-5">
    <Button type="button" variant="outline" onClick={() => setLocation("/midias/graficas")} className="border-border"><ArrowLeft className="mr-1.5 h-4 w-4" />Voltar para Mídia Urbana</Button>
    <header className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="flex gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-white"><RadioTower className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[.14em] text-primary">Ponto físico de mídia urbana</p><h1 className="mt-1 font-display text-3xl font-semibold text-foreground">{point.name}</h1><p className="mt-2 text-sm text-muted-foreground">Cadastre o ponto físico e acompanhe cada veiculação com mídia, histórico e debriefing próprios.</p></div></div><Button type="button" onClick={() => setShowForm(true)} className="self-start rounded-xl bg-primary hover:bg-primary/90"><Plus className="mr-1.5 h-4 w-4" />Nova veiculação</Button></div></header>
    <div className="grid gap-5 lg:grid-cols-[.78fr_1.22fr]"><aside className="space-y-4"><article className="rounded-2xl bg-secondary p-4"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><RadioTower className="h-4 w-4 text-primary" />Dados do ponto</div><dl className="mt-4 space-y-3 text-sm"><div><dt className="text-xs text-muted-foreground">Fornecedor</dt><dd className="font-medium text-foreground">{point.supplierName}</dd></div><div><dt className="text-xs text-muted-foreground">Território</dt><dd className="font-medium text-foreground">{point.cityName} · {point.regionalName}</dd></div><div><dt className="text-xs text-muted-foreground">Tipo de mídia</dt><dd className="font-medium text-foreground">{point.mediaTypeName}</dd></div><div><dt className="text-xs text-muted-foreground">Localização ou rota</dt><dd className="font-medium text-foreground">{point.address || "Não informada"}</dd></div><div><dt className="text-xs text-muted-foreground">Contrato</dt><dd className="font-medium text-foreground">{point.contractStartsOn ? `${formatDate(point.contractStartsOn)} até ${formatDate(point.contractEndsOn)}` : "Sem vigência informada"}</dd></div><div><dt className="text-xs text-muted-foreground">Tipo de contrato</dt><dd className="font-medium text-foreground">{partnershipLabels[point.partnershipType] ?? point.partnershipType}</dd></div><div><dt className="text-xs text-muted-foreground">Período de troca</dt><dd className="font-medium text-foreground">{point.replacementFrequency ? frequencyLabels[point.replacementFrequency] : "Não informado"}</dd></div></dl></article><article className="overflow-hidden rounded-2xl border border-border bg-card"><div className="border-b border-border px-4 py-3"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><MapPin className="h-4 w-4 text-primary" />Mapa do ponto</div><p className="mt-1 text-xs text-muted-foreground">Localização geográfica cadastrada para acompanhamento operacional.</p></div><PointMap point={point} /></article><article className="rounded-2xl border border-border bg-card p-4"><div className="flex items-center gap-2 text-sm font-semibold text-foreground"><History className="h-4 w-4 text-primary" />Histórico do ponto</div><div className="mt-3 space-y-3">{point.history.length ? point.history.slice(0, 8).map(entry => <div key={`${entry.scope}-${entry.id}`} className="border-l-2 border-primary/30 pl-3"><p className="text-xs font-medium text-foreground">{entry.action === "create" ? "Registro criado" : entry.action === "schedule" ? "Veiculação agendada" : entry.action === "reschedule" ? "Veiculação reagendada" : entry.action.startsWith("status_") ? `Status alterado para ${statusLabels[entry.action.replace("status_", "")] ?? entry.action}` : "Atualização registrada"}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(entry.occurredAt).toLocaleString("pt-BR")}</p></div>) : <p className="text-xs text-muted-foreground">Ainda não há alterações registradas.</p>}</div></article></aside>
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="border-b border-border px-5 py-4"><p className="font-display text-lg font-semibold text-foreground">Veiculações registradas</p><p className="mt-0.5 text-xs text-muted-foreground">Cada veiculação possui mídia utilizada, status, evidências e debriefing próprio.</p></div><div className="divide-y divide-border">{point.campaigns.length ? point.campaigns.map(campaign => <article key={campaign.id} className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{campaign.name}</p><Badge className="border-0 bg-primary/10 text-[10px] text-primary">{statusLabels[campaign.status] ?? campaign.status}</Badge>{campaign.rating ? <Badge variant="outline" className="border-border text-[10px]">Nota {campaign.rating}/5</Badge> : <Badge variant="outline" className="border-orange-300 text-[10px] text-orange-700">Debriefing pendente</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{formatDate(campaign.startsOn)} até {formatDate(campaign.endsOn)} · SubServiço: {campaign.serviceTypeId ? subservices.find(service => service.id === campaign.serviceTypeId)?.name ?? "Não identificado" : "Não informado"}</p></div><Button type="button" variant="outline" size="sm" onClick={() => setLocation(`/midias/veiculacao/${campaign.id}`)} className="rounded-lg border-border"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Abrir veiculação</Button></div>{campaign.campaignDetails && <p className="mt-4 rounded-xl bg-secondary p-3 text-xs leading-5 text-foreground">{campaign.campaignDetails}</p>}<div className="mt-3 flex flex-wrap gap-2">{campaign.arts.map(art => <a key={art.id} href={art.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-foreground hover:bg-primary/10"><FileText className="h-3 w-3 text-primary" />{art.originalName}</a>)}</div></article>) : <div className="p-8 text-center"><CalendarClock className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 font-medium text-foreground">Nenhuma veiculação registrada neste ponto.</p><p className="mt-1 text-sm text-muted-foreground">Use Nova veiculação para iniciar o acompanhamento operacional.</p><Button type="button" onClick={() => setShowForm(true)} className="mt-4 bg-primary"><Plus className="mr-1.5 h-4 w-4" />Nova veiculação</Button></div>}</div></section></div>
    <Dialog open={showForm} onOpenChange={open => { if (!open) closeForm(); }}><DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Nova veiculação</DialogTitle><DialogDescription>Registre o período, o SubServiço, a mídia utilizada e os detalhes operacionais do ponto.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Label htmlFor="urban-vehicle-name">Nome da veiculação *</Label><Input id="urban-vehicle-name" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Campanha de inverno 2026" /></div><div><Label htmlFor="urban-start">Data de veiculação — início *</Label><Input id="urban-start" type="date" value={form.startsOn} onChange={event => setForm({ ...form, startsOn: event.target.value })} /></div><div><Label htmlFor="urban-end">Data de veiculação — fim *</Label><Input id="urban-end" type="date" value={form.endsOn} onChange={event => setForm({ ...form, endsOn: event.target.value })} /></div><div><Label htmlFor="urban-subservice">SubServiço *</Label><select id="urban-subservice" value={form.subserviceTypeId} onChange={event => setForm({ ...form, subserviceTypeId: event.target.value })} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Selecionar SubServiço</option>{subservices.map(service => <option key={service.id} value={service.id}>{service.name}</option>)}</select><p className="mt-1 text-[11px] text-muted-foreground">Puxado de Cadastros &gt; SubServiços, como papel ou lona.</p></div><div><Label htmlFor="urban-trade-campaign">Campanha vinculada <span className="font-normal text-muted-foreground">(opcional)</span></Label><select id="urban-trade-campaign" value={form.tradeCampaignId} onChange={event => setForm({ ...form, tradeCampaignId: event.target.value })} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Nenhuma campanha</option>{activeTradeCampaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></div><div><Label htmlFor="urban-responsible">Responsável do trade <span className="font-normal text-muted-foreground">(opcional)</span></Label><select id="urban-responsible" value={form.responsibleUserId} onChange={event => setForm({ ...form, responsibleUserId: event.target.value })} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Selecionar responsável</option>{references.data?.users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></div><div className="sm:col-span-2"><Label htmlFor="urban-media-file">Mídia utilizada — PDF da arte *</Label><Input id="urban-media-file" type="file" accept="application/pdf" onChange={event => setMediaFile(event.target.files?.[0] ?? null)} className="mt-1 cursor-pointer" /><p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Paperclip className="h-3 w-3" />PDF de até 50 MB. {mediaFile ? <strong className="text-foreground">{mediaFile.name}</strong> : ""}</p></div><div className="sm:col-span-2"><Label htmlFor="urban-details">Detalhes da veiculação *</Label><Textarea id="urban-details" value={form.campaignDetails} onChange={event => setForm({ ...form, campaignDetails: event.target.value })} placeholder="Descreva o objetivo, material, período de exposição e demais informações operacionais." rows={5} /></div><div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={closeForm} className="border-border">Cancelar</Button><Button type="submit" disabled={createVeiculation.isPending || uploadMedia.isPending} className="bg-primary"><Upload className="mr-1.5 h-4 w-4" />{createVeiculation.isPending || uploadMedia.isPending ? "Salvando..." : "Criar nova veiculação"}</Button></div></form></DialogContent></Dialog>
  </main>;
}
