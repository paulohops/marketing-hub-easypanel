import { MapView } from "@/components/Map";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import EvidenceUpload from "@/components/EvidenceUpload";
import { OperationalHistory, OperationalStatusDialog, OperationalStatusDropdown, resolveHistoryEvidence } from "@/components/OperationalPatterns";
import TraditionalScheduleEditor, { createEmptyTraditionalSchedule, type TraditionalScheduleItem } from "@/components/TraditionalScheduleEditor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CalendarDays, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, FileAudio, History, MapPin, Paperclip, Pencil, Plus, RefreshCw, Save, UserRound, Volume2 } from "lucide-react";
import { ChangeEvent, FormEvent, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type PartnershipType = "paid" | "barter" | "mixed";
type FormState = {
  serviceTypeId: string;
  responsibleUserId: string;
  tradeCampaignId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  partnershipType: PartnershipType;
  estimatedCost: string;
  airingSchedule: string;
  signalNotes: string;
  signalCityIds: number[];
  campaignDetails: string;
  notes: string;
  allowConcurrent: boolean;
  schedules: TraditionalScheduleItem[];
}

type TraditionalSpotFile = { originalName: string; mimeType: "audio/mpeg" | "audio/wav" | "audio/x-wav"; dataBase64: string };

type TraditionalSchedulePayload = Omit<TraditionalScheduleItem, "weekdays"> & { weekday: number | null };

type MediaPointStatus = "active" | "inactive" | "maintenance" | "cancelled";

type PointEditState = {
  supplierId: string;
  cityId: string;
  mediaTypeId: string;
  mediaVariationTypeId: string;
  name: string;
  contractStartsOn: string;
  contractEndsOn: string;
  partnershipType: PartnershipType;
  replacementFrequency: string;
};

type PointSnapshot = Pick<PointEditState, never> & {
  supplierId: number;
  cityId: number;
  mediaTypeId: number;
  mediaVariationTypeId?: number | null;
  name: string;
  contractStartsOn?: string | null;
  contractEndsOn?: string | null;
  partnershipType: string;
  replacementFrequency?: string | null;
  address?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  signalRangeKm?: string | number | null;
};

function createPointEditForm(point: PointSnapshot): PointEditState {
  return { supplierId: String(point.supplierId), cityId: String(point.cityId), mediaTypeId: String(point.mediaTypeId), mediaVariationTypeId: point.mediaVariationTypeId ? String(point.mediaVariationTypeId) : "", name: point.name, contractStartsOn: point.contractStartsOn ?? "", contractEndsOn: point.contractEndsOn ?? "", partnershipType: (point.partnershipType as PartnershipType) ?? "paid", replacementFrequency: point.replacementFrequency ?? "" };
}

const pointStatusOptions: Array<{ id: number; value: MediaPointStatus; label: string }> = [
  { id: 1, value: "active", label: "Ativa" },
  { id: 2, value: "inactive", label: "Inativa" },
  { id: 3, value: "maintenance", label: "Em manutenção" },
  { id: 4, value: "cancelled", label: "Cancelada" },
];

const replacementFrequencyOptions = [
  { id: 1, value: "weekly", label: "Semanal" },
  { id: 2, value: "biweekly", label: "Quinzenal" },
  { id: 3, value: "monthly", label: "Mensal" },
  { id: 4, value: "quarterly", label: "Trimestral" },
  { id: 5, value: "semiannual", label: "Semestral" },
  { id: 6, value: "annual", label: "Anual" },
  { id: 7, value: "custom", label: "Personalizado" },
];
const replacementFrequencyLabels = Object.fromEntries(replacementFrequencyOptions.map(option => [option.value, option.label]));

type TraditionalPayload = {
  mediaPointId: number;
  serviceTypeId: number | null;
  responsibleUserId: number | null;
  tradeCampaignId: number | null;
  name: string;
  startsOn: string;
  endsOn: string;
  partnershipType: PartnershipType;
  estimatedCost: number;
  airingSchedule?: string;
  signalNotes?: string;
  signalCityIds: number[];
  campaignDetails?: string;
  notes?: string;
  allowConcurrent: boolean;
  schedules: TraditionalSchedulePayload[];
  confirmReplaceExisting: boolean;
};

const emptyForm: FormState = {
  serviceTypeId: "",
  responsibleUserId: "",
  tradeCampaignId: "",
  name: "",
  startsOn: "",
  endsOn: "",
  partnershipType: "paid",
  estimatedCost: "",
  airingSchedule: "",
  signalNotes: "",
  signalCityIds: [],
  campaignDetails: "",
  notes: "",
  allowConcurrent: false,
  schedules: [createEmptyTraditionalSchedule()],
};

const statusLabel: Record<string, string> = { scheduled: "Agendada", active: "Ativa", inactive: "Inativa", completed: "Encerrada", cancelled: "Cancelada" };
const partnershipLabel: Record<PartnershipType, string> = { paid: "Pago", barter: "Permuta", mixed: "Misto" };
const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type CalendarDocument = { id: number; url: string; originalName?: string | null; mimeType?: string | null };
type CalendarSchedule = { programName?: string | null; weekday?: number | null; specificDate?: string | null; startsAt?: string | null; endsAt?: string | null; notes?: string | null };
type CalendarCampaign = { id: number; name: string; startsOn: string; endsOn: string; status?: string | null; serviceTypeName?: string | null; campaignDetails?: string | null; schedules?: CalendarSchedule[] | null; cityDistributions?: Array<{ cityName?: string | null }> | null; spots?: CalendarDocument[] | null; evidences?: CalendarDocument[] | null };
type CalendarEntry = CalendarSchedule & { campaignName: string; campaignId: number; campaign: CalendarCampaign };

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

function normalizeTime(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || hours < 0 || hours > 23 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o spot selecionado."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

function TraditionalProgrammingCalendar({ campaigns, onOpenCampaign }: { campaigns: CalendarCampaign[]; onOpenCampaign: (campaignId: number) => void }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedEntry, setSelectedEntry] = useState<CalendarEntry | null>(null);
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, index) => index < firstDay ? null : index - firstDay + 1);
  const entriesFor = (day: number): CalendarEntry[] => {
    const current = new Date(year, month, day);
    const key = dateKey(current);
    return campaigns.flatMap(campaign => (campaign.schedules ?? []).filter(schedule => {
      const inPeriod = key >= campaign.startsOn && key <= campaign.endsOn;
      return inPeriod && (schedule.specificDate ? schedule.specificDate === key : schedule.weekday === current.getDay());
    }).map(schedule => ({ ...schedule, campaignName: campaign.name, campaignId: campaign.id, campaign })));
  };
  const documentCard = (document: CalendarDocument, kind: string, index: number) => {
    const isAudio = document.mimeType?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(document.originalName ?? '');
    const isImage = document.mimeType?.startsWith('image/');
    return <div key={`${kind}-${document.id}-${index}`} className="overflow-hidden rounded-lg border border-border bg-muted/30">
      {isAudio ? <audio controls preload="metadata" className="w-full" src={document.url} /> : isImage ? <img src={document.url} alt={document.originalName ?? `${kind} ${index + 1}`} className="max-h-44 w-full object-contain" /> : <a href={document.url} target="_blank" rel="noreferrer" className="block truncate p-3 text-sm font-medium text-primary hover:underline">{document.originalName ?? `Abrir ${kind.toLowerCase()}`}</a>}
      <p className="truncate border-t border-border px-3 py-2 text-xs text-muted-foreground">{document.originalName ?? `${kind} ${index + 1}`}</p>
    </div>;
  };
  return <>
    <article className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" /><div><p className="font-display text-lg font-semibold text-foreground">Calendário de programação</p><p className="text-xs text-muted-foreground">Clique em um programa para consultar a veiculação, o spot e as evidências.</p></div></div><div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor(new Date(year, month - 1, 1))} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></Button><p className="min-w-36 text-center text-sm font-semibold capitalize text-foreground">{cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p><Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setCursor(new Date(year, month + 1, 1))} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></Button></div></div>
      <div className="p-4"><div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{weekdayLabels.map(label => <span key={label} className="py-2">{label}</span>)}</div><div className="grid grid-cols-7 gap-1">{cells.map((day, index) => { const entries = day ? entriesFor(day) : []; return <div key={`${day ?? "empty"}-${index}`} className={`min-h-24 rounded-lg border p-1.5 text-left ${day ? "border-border bg-background" : "border-transparent bg-transparent"}`}>{day ? <><p className="text-xs font-semibold text-foreground">{day}</p><div className="mt-1 space-y-1">{entries.slice(0, 3).map((entry, entryIndex) => <Button key={`${entry.campaignId}-${entryIndex}`} type="button" variant="ghost" onClick={() => setSelectedEntry(entry)} className="h-auto w-full justify-start rounded bg-primary/10 px-1.5 py-1 text-left text-[10px] leading-3 text-primary hover:bg-primary/20 hover:text-primary"><span className="min-w-0"><span className="block truncate font-semibold">{entry.programName || entry.campaignName}</span><span className="block">{entry.startsAt}–{entry.endsAt}</span></span></Button>)}{entries.length > 3 && <p className="px-1 text-[10px] text-muted-foreground">+{entries.length - 3} horários</p>}</div></> : null}</div>; })}</div><p className="mt-3 text-[11px] text-muted-foreground">Os dias recorrentes respeitam a vigência da veiculação. Datas específicas são indicadas para entrevistas, participações e ações pontuais.</p></div>
    </article>
    <Dialog open={Boolean(selectedEntry)} onOpenChange={open => !open && setSelectedEntry(null)}><DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{selectedEntry?.programName || selectedEntry?.campaign.name || "Detalhes da programação"}</DialogTitle><DialogDescription>Resumo da veiculação mídia volante vinculada a este horário.</DialogDescription></DialogHeader>{selectedEntry ? <div className="space-y-4"><div className="grid gap-3 rounded-xl border border-border bg-secondary/40 p-4 text-sm sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Veiculação</p><p className="mt-1 font-medium text-foreground">{selectedEntry.campaign.name}</p></div><div><p className="text-xs text-muted-foreground">Status</p><p className="mt-1 font-medium text-foreground">{statusLabel[selectedEntry.campaign.status ?? ""] ?? selectedEntry.campaign.status ?? "Não informado"}</p></div><div><p className="text-xs text-muted-foreground">Data e horário</p><p className="mt-1 font-medium text-foreground">{selectedEntry.specificDate ? new Date(`${selectedEntry.specificDate}T12:00:00`).toLocaleDateString("pt-BR") : weekdayLabels[selectedEntry.weekday ?? 0]} · {selectedEntry.startsAt}–{selectedEntry.endsAt}</p></div><div><p className="text-xs text-muted-foreground">Vigência</p><p className="mt-1 font-medium text-foreground">{new Date(`${selectedEntry.campaign.startsOn}T12:00:00`).toLocaleDateString("pt-BR")} até {new Date(`${selectedEntry.campaign.endsOn}T12:00:00`).toLocaleDateString("pt-BR")}</p></div><div><p className="text-xs text-muted-foreground">Serviço</p><p className="mt-1 font-medium text-foreground">{selectedEntry.campaign.serviceTypeName ?? "Não informado"}</p></div><div><p className="text-xs text-muted-foreground">Cidades do sinal</p><p className="mt-1 font-medium text-foreground">{selectedEntry.campaign.cityDistributions?.map(city => city.cityName).filter(Boolean).join(", ") || "Não informadas"}</p></div></div>{selectedEntry.notes || selectedEntry.campaign.campaignDetails ? <div className="rounded-xl border border-border p-4 text-sm"><p className="text-xs font-semibold text-muted-foreground">Observações</p><p className="mt-1 whitespace-pre-wrap text-foreground">{selectedEntry.notes || selectedEntry.campaign.campaignDetails}</p></div> : null}<div><div className="mb-2 flex items-center gap-2"><FileAudio className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">Spot da veiculação</h3></div>{selectedEntry.campaign.spots?.length ? <div className="grid gap-3 sm:grid-cols-2">{selectedEntry.campaign.spots.map((document, index) => documentCard(document, "Spot", index))}</div> : <p className="text-sm text-muted-foreground">Nenhum spot anexado.</p>}</div><div><div className="mb-2 flex items-center gap-2"><Paperclip className="h-4 w-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">Evidências</h3></div>{selectedEntry.campaign.evidences?.length ? <div className="grid gap-3 sm:grid-cols-2">{selectedEntry.campaign.evidences.map((document, index) => documentCard(document, "Evidência", index))}</div> : <p className="text-sm text-muted-foreground">Nenhuma evidência anexada.</p>}</div><div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => setSelectedEntry(null)}>Fechar</Button><Button type="button" onClick={() => { onOpenCampaign(selectedEntry.campaignId); setSelectedEntry(null); }} className="bg-primary hover:bg-primary/90"><ExternalLink className="mr-1.5 h-4 w-4" />Abrir veiculação</Button></div></div> : null}</DialogContent></Dialog>
  </>;
}
function ProgramMap({ point }: { point: { name: string; latitude?: string | number | null; longitude?: string | number | null; signalRangeKm?: string | number | null } }) {
  const lat = point.latitude == null ? NaN : Number(point.latitude);
  const lng = point.longitude == null ? NaN : Number(point.longitude);
  const range = point.signalRangeKm == null ? 0 : Number(point.signalRangeKm);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return <div className="grid h-64 place-items-center rounded-xl bg-secondary text-xs text-muted-foreground">Coordenadas não informadas para este programa.</div>;
  const center = { lat, lng };
  return <MapView className="h-64" initialCenter={center} initialZoom={range > 20 ? 10 : 13} onMapReady={map => {
    if (window.google?.maps?.marker?.AdvancedMarkerElement) new window.google.maps.marker.AdvancedMarkerElement({ map, position: center, title: point.name });
    else new window.google.maps.Marker({ map, position: center, title: point.name });
    if (range > 0) new window.google.maps.Circle({ map, center, radius: range * 1000, fillColor: "#2563eb", fillOpacity: 0.12, strokeColor: "#2563eb", strokeOpacity: 0.65, strokeWeight: 2 });
  }} />;
}

function MultiOption({ id, label, options, values, onChange, placeholder, createAction }: { id: string; label: string; options: Array<{ id: number; label: string; description?: string }>; values: number[]; onChange: (values: number[]) => void; placeholder: string; createAction?: ReactNode }) {
  return <SearchableMultiSelect id={id} label={label} options={options} values={values} onChange={onChange} maxSelections={id === "volante-signal-cities" ? 100 : 1} placeholder={placeholder} emptyMessage="Nenhuma opção disponível" createAction={createAction} />;
}

export default function MidiaVolanteDetails({ mediaPointId }: { mediaPointId: number }) {
  const [, setLocation] = useLocation();
  const { can } = useEffectivePermissions();
  const canWrite = can("media.write");
  const utils = trpc.useUtils();
  const detail = trpc.media.pointDetails.useQuery({ mediaPointId });
  const references = trpc.media.referenceData.useQuery();
  const tradeCampaigns = trpc.campaigns.list.useQuery();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [open, setOpen] = useState(false);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<TraditionalPayload | null>(null);
  const [spotFile, setSpotFile] = useState<TraditionalSpotFile | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<PointEditState | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusForm, setStatusForm] = useState<{ status: MediaPointStatus; reason: string; evidenceDocumentIds: number[] }>({ status: "active", reason: "", evidenceDocumentIds: [] });
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleCampaignId, setRescheduleCampaignId] = useState<number | null>(null);
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rescheduleDates, setRescheduleDates] = useState({ startsOn: "", endsOn: "" });
  const point = detail.data;
  const serviceOptions = useMemo(() => {
    const services = references.data?.serviceTypes ?? [];
    const catalog = references.data?.mediaServiceCatalog ?? [];
    if (!point) return services;
    const catalogServiceIds = new Set(catalog.filter(item => item.mediaTypeId === point.mediaTypeId).map(item => item.serviceTypeId));
    const linked = services.filter(service => service.mediaTypeId === point.mediaTypeId || catalogServiceIds.has(service.id));
    return linked.length ? linked : services;
  }, [point, references.data?.mediaServiceCatalog, references.data?.serviceTypes]);
  const cityOptions = useMemo(() => (references.data?.cities ?? []).map(item => ({ id: item.city.id, label: item.city.name ?? `Cidade ${item.city.id}`, description: item.regionalName ?? undefined })), [references.data?.cities]);
  const supplierOptions = useMemo(() => (references.data?.suppliers ?? []).map(supplier => ({ id: supplier.id, label: supplier.displayName, description: supplier.email ?? supplier.phone ?? undefined })), [references.data?.suppliers]);
  const mediaTypeOptions = useMemo(() => (references.data?.mediaTypes ?? []).filter(mediaType => mediaType.operationCategory === "sound_car").map(mediaType => ({ id: mediaType.id, label: mediaType.name, description: mediaType.parentMediaTypeId ? "Variação de mídia" : "Tipo de mídia" })), [references.data?.mediaTypes]);
  const variationOptions = useMemo(() => { const parentId = editForm?.mediaTypeId ? Number(editForm.mediaTypeId) : point?.mediaTypeId; return (references.data?.mediaTypes ?? []).filter(mediaType => mediaType.parentMediaTypeId === parentId).map(mediaType => ({ id: mediaType.id, label: mediaType.name, description: "Variação vinculada" })); }, [editForm?.mediaTypeId, point?.mediaTypeId, references.data?.mediaTypes]);
  const refresh = () => { void utils.media.pointDetails.invalidate({ mediaPointId }); void utils.media.list.invalidate(); };
  const updatePoint = trpc.media.updatePoint.useMutation({ onSuccess: () => { toast.success("Programa mídia volante atualizado."); setEditOpen(false); refresh(); }, onError: error => toast.error(error.message) });
  const updatePointStatus = trpc.media.updatePointStatus.useMutation({ onSuccess: () => { toast.success("Status do programa atualizado."); setStatusOpen(false); refresh(); }, onError: error => toast.error(error.message) });
  const uploadSpot = trpc.documents.upload.useMutation();
  const renewCampaign = trpc.media.renewCampaign.useMutation({ onSuccess: () => { toast.success("Veiculação reagendada sem duplicação."); setRescheduleOpen(false); setRescheduleCampaignId(null); setRescheduleReason(""); refresh(); }, onError: error => toast.error(error.message) });
  const create = trpc.media.createTraditionalVeiculation.useMutation({
    onSuccess: async result => {
      let spotUploaded = true;
      if (spotFile) {
        try {
          await uploadSpot.mutateAsync({ entityType: "media_campaign", entityId: result.id, regionalId: point?.regionalId ?? null, documentKind: "spot", originalName: spotFile.originalName, mimeType: spotFile.mimeType, dataBase64: spotFile.dataBase64 });
        } catch (error) {
          spotUploaded = false;
          toast.error(error instanceof Error ? `Veiculação criada, mas o spot não foi anexado: ${error.message}` : "Veiculação criada, mas o spot não foi anexado.");
        }
      }
      if (spotUploaded) toast.success(result.status === "scheduled" ? "Spot agendado com sucesso." : "Veiculação de mídia volante criada.");
      setOpen(false); setForm(emptyForm); setSpotFile(null); setConfirmReplaceOpen(false); setPendingPayload(null); refresh(); setLocation(`/midias/volante/veiculacao/${result.id}`);
    },
    onError: error => { if (error.data?.code === "CONFLICT") { setConfirmReplaceOpen(true); return; } toast.error(error.message); },
  });
  const handleSpotFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const acceptedTypes = ["audio/mpeg", "audio/wav", "audio/x-wav"];
    if (!acceptedTypes.includes(file.type) && !/\.(mp3|wav)$/i.test(file.name)) { toast.error("Envie o spot em MP3 ou WAV."); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error("O spot deve ter no máximo 50 MB."); return; }
    try {
      setSpotFile({ originalName: file.name, mimeType: (file.type || (file.name.toLowerCase().endsWith(".wav") ? "audio/wav" : "audio/mpeg")) as TraditionalSpotFile["mimeType"], dataBase64: await fileToBase64(file) });
      toast.success("Spot selecionado para a veiculação.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível preparar o spot."); }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const schedules: TraditionalSchedulePayload[] = form.schedules
      .filter(item => item.programName.trim() && item.startsAt && item.endsAt)
      .flatMap((item): TraditionalSchedulePayload[] => {
        const startsAt = normalizeTime(item.startsAt);
        const endsAt = normalizeTime(item.endsAt);
        if (!startsAt || !endsAt) return [];
        const base = { programName: item.programName.trim(), notes: item.notes?.trim() || undefined, startsAt, endsAt };
        if (item.specificDate) return [{ ...base, specificDate: item.specificDate, weekday: null }];
        const selectedWeekdays = item.weekdays.length ? item.weekdays : [1];
        return selectedWeekdays.map(weekday => ({ ...base, specificDate: null, weekday }));
      });
    if (form.schedules.some(item => item.programName.trim() && (!normalizeTime(item.startsAt) || !normalizeTime(item.endsAt)))) { toast.error("Informe os horários no formato HH:MM, por exemplo 08:00 e 08:30."); return; }
    if (!schedules.length) { toast.error("Adicione pelo menos um programa com dia e horário."); return; }
    const payload: TraditionalPayload = { mediaPointId, serviceTypeId: form.serviceTypeId ? Number(form.serviceTypeId) : null, responsibleUserId: form.responsibleUserId ? Number(form.responsibleUserId) : null, tradeCampaignId: form.tradeCampaignId ? Number(form.tradeCampaignId) : null, name: form.name, startsOn: form.startsOn, endsOn: form.endsOn, partnershipType: form.partnershipType, estimatedCost: Number(form.estimatedCost || 0), airingSchedule: form.airingSchedule || undefined, signalNotes: form.signalNotes || undefined, signalCityIds: form.signalCityIds, campaignDetails: form.campaignDetails || undefined, notes: form.notes || undefined, allowConcurrent: form.allowConcurrent, schedules, confirmReplaceExisting: false };
    setPendingPayload(payload);
    create.mutate(payload);
  };
  const openEdit = () => { setEditForm(createPointEditForm(point as PointSnapshot)); setEditOpen(true); };
  const submitEdit = (event: FormEvent) => {
    event.preventDefault();
    if (!editForm) return;
    if (!editForm.supplierId || !editForm.cityId || !editForm.mediaTypeId || !editForm.name.trim()) { toast.error("Informe fornecedor, cidade, tipo de mídia e nome do programa."); return; }
    updatePoint.mutate({ mediaPointId, supplierId: Number(editForm.supplierId), cityId: Number(editForm.cityId), mediaTypeId: Number(editForm.mediaTypeId), mediaVariationTypeId: editForm.mediaVariationTypeId ? Number(editForm.mediaVariationTypeId) : null, serviceTypeId: point?.serviceTypeId ? Number(point.serviceTypeId) : null, name: editForm.name.trim(), operationCategory: "sound_car", latitude: null, longitude: null, replacementFrequency: (editForm.replacementFrequency || null) as "weekly" | "biweekly" | "monthly" | "quarterly" | "semiannual" | "annual" | "custom" | null, contractStartsOn: editForm.contractStartsOn || null, contractEndsOn: editForm.contractEndsOn || null, partnershipType: editForm.partnershipType });
  };
  const openStatus = (status: MediaPointStatus) => { setStatusForm({ status, reason: "", evidenceDocumentIds: [] }); setStatusOpen(true); };
  const submitStatus = () => { updatePointStatus.mutate({ mediaPointId, status: statusForm.status, reason: statusForm.reason.trim() || undefined, evidenceDocumentIds: statusForm.evidenceDocumentIds }); };
  const openReschedule = (campaign: CalendarCampaign) => { setRescheduleCampaignId(campaign.id); setRescheduleReason(""); setRescheduleDates({ startsOn: campaign.startsOn.slice(0, 10), endsOn: campaign.endsOn.slice(0, 10) }); setRescheduleOpen(true); };
  const submitReschedule = () => { const campaign = point?.campaigns.find(item => item.id === rescheduleCampaignId); if (!campaign || !rescheduleDates.startsOn || !rescheduleDates.endsOn || !rescheduleReason.trim()) { toast.error("Informe as novas datas e o motivo do reagendamento."); return; } if (rescheduleDates.endsOn < rescheduleDates.startsOn) { toast.error("A data final deve ser posterior à data inicial."); return; } renewCampaign.mutate({ sourceCampaignId: campaign.id, name: campaign.name, startsOn: rescheduleDates.startsOn, endsOn: rescheduleDates.endsOn, partnershipType: campaign.partnershipType as PartnershipType, estimatedCost: Number(campaign.estimatedCost ?? 0), notes: campaign.notes ?? undefined, campaignDetails: campaign.campaignDetails ?? undefined, rescheduleReason: rescheduleReason.trim(), evidenceDocumentIds: [] }); };
  if (detail.isLoading) return <div className="grid h-56 place-items-center rounded-2xl border border-border bg-card text-sm text-muted-foreground">Carregando programa...</div>;
  if (!point) return <div className="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">O programa não foi encontrado ou não está disponível para seu perfil.</div>;
  const currentStatus = (point.status as MediaPointStatus) || "active";
  const visibleCampaigns = showAllCampaigns ? point.campaigns : point.campaigns.slice(0, 2);
  const calendarCampaigns = point.campaigns.map(campaign => ({ ...campaign, serviceTypeName: serviceOptions.find(service => service.id === campaign.serviceTypeId)?.name ?? null })) as CalendarCampaign[];
  return <main className="mx-auto max-w-[1480px] space-y-5">
    <Button type="button" variant="outline" onClick={() => setLocation("/midias/volante")} className="border-border"><ArrowLeft className="mr-1.5 h-4 w-4" />Voltar para Mídia Volante</Button>
    <header className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-primary">Programa de Mídia Volante</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{point.name}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Ficha de rádio ou TV com contratação, alcance do sinal, programação de spots, comprovações e histórico operacional.</p>
        </div>
        {canWrite && <div className="flex w-full flex-wrap items-center justify-end gap-2 xl:w-auto xl:shrink-0">
          <Button type="button" size="sm" variant="outline" onClick={openEdit} className="border-border"><Pencil className="mr-1.5 h-4 w-4" />Editar programa</Button>
          <OperationalStatusDropdown id="volante-program-status" value={currentStatus} options={pointStatusOptions} onChange={openStatus} disabled={updatePointStatus.isPending} className="min-w-[8.25rem] px-2 text-xs" />
          <Button type="button" size="sm" onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90"><Plus className="mr-1.5 h-4 w-4" />Nova veiculação</Button>
        </div>}
      </div>
    </header>
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,0.78fr)_minmax(0,1.42fr)]">
      <aside className="min-w-0 space-y-5">
        <article className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2"><Volume2 className="h-4 w-4 text-primary" /><p className="font-display text-lg font-semibold text-foreground">Dados do programa</p></div>
          <dl className="mt-5 space-y-3 text-sm"><div><dt className="text-xs text-muted-foreground">Fornecedor</dt><dd className="font-medium text-foreground">{point.supplierName}</dd></div><div><dt className="text-xs text-muted-foreground">Tipo de mídia e cidade</dt><dd className="font-medium text-foreground">{point.mediaTypeName} · {point.cityName} · {point.regionalName}</dd></div><div><dt className="text-xs text-muted-foreground">Contrato</dt><dd className="font-medium text-foreground">{point.contractStartsOn ? new Date(`${point.contractStartsOn}T12:00:00`).toLocaleDateString("pt-BR") : "Não informado"} até {point.contractEndsOn ? new Date(`${point.contractEndsOn}T12:00:00`).toLocaleDateString("pt-BR") : "Não informado"} · {partnershipLabel[point.partnershipType as PartnershipType] ?? point.partnershipType}</dd></div><div><dt className="text-xs text-muted-foreground">Troca do spot</dt><dd className="font-medium text-foreground">{replacementFrequencyLabels[point.replacementFrequency ?? ""] ?? point.replacementFrequency ?? "Não informada"}</dd></div></dl>
        </article>
        <OperationalHistory entries={point.history} title="Histórico do programa" labelFor={entry => { const action = entry.action ?? entry.auditAction ?? ""; return action === "replace" ? "Programa substituído" : action === "schedule" ? "Spot agendado" : action === "reschedule" ? "Veiculação reagendada" : action === "save_debrief" ? "Debriefing atualizado" : action === "update_status" ? "Status atualizado" : action === "create" ? "Registro criado" : "Atualização registrada"; }} evidenceFor={(_entry, payload) => resolveHistoryEvidence(payload, point.statusEvidence ?? [])} />
      </aside>
      <section className="min-w-0 space-y-5">
        <article className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><p className="font-display text-lg font-semibold text-foreground">Spots e veiculações</p><p className="mt-0.5 text-xs text-muted-foreground">Acompanhe vigência, cidades que recebem o sinal e a programação de cada ciclo.</p></div>{canWrite && <Button size="sm" onClick={() => setOpen(true)} className="bg-primary text-xs hover:bg-primary/90"><Plus className="mr-1.5 h-3.5 w-3.5" />Nova veiculação</Button>}</div>
          <div className="divide-y divide-border">{visibleCampaigns.length ? visibleCampaigns.map(campaign => <article key={campaign.id} className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{campaign.name}</p><Badge className="border-0 bg-primary/10 text-[10px] text-primary">{statusLabel[campaign.status] ?? campaign.status}</Badge><Badge className="border-0 bg-secondary text-[10px] text-foreground">{partnershipLabel[campaign.partnershipType as PartnershipType] ?? campaign.partnershipType}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{new Date(`${campaign.startsOn}T12:00:00`).toLocaleDateString("pt-BR")} até {new Date(`${campaign.endsOn}T12:00:00`).toLocaleDateString("pt-BR")} · {campaign.serviceTypeId ? (references.data?.serviceTypes ?? []).find(service => service.id === campaign.serviceTypeId)?.name ?? "Serviço" : "Serviço não definido"}</p>{campaign.cityDistributions?.length ? <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5 text-primary" />Sinal: {campaign.cityDistributions.map(city => city.cityName).join(", ")}</p> : null}{campaign.campaignConfig?.airingSchedule ? <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="h-3.5 w-3.5 text-primary" />{campaign.campaignConfig.airingSchedule}</p> : null}{campaign.campaignDetails && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{campaign.campaignDetails}</p>}</div><div className="flex shrink-0 flex-wrap justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setLocation(`/midias/volante/veiculacao/${campaign.id}`)} className="h-8 border-border text-xs"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Abrir mídia</Button>{canWrite && <Button variant="outline" size="sm" onClick={() => openReschedule(campaign as CalendarCampaign)} className="h-8 border-primary/30 text-xs text-primary"><CalendarClock className="mr-1.5 h-3.5 w-3.5" />Reagendar</Button>}</div></div></article>) : <p className="p-6 text-sm text-muted-foreground">Nenhuma veiculação registrada para este programa.</p>}</div>
          {point.campaigns.length > 2 ? <div className="border-t border-border p-3"><Button type="button" variant="ghost" size="sm" className="w-full text-primary hover:bg-primary/5 hover:text-primary" onClick={() => setShowAllCampaigns(current => !current)}>{showAllCampaigns ? "Mostrar menos" : `Mostrar mais (${point.campaigns.length - 2})`}</Button></div> : null}
        </article>
        <TraditionalProgrammingCalendar campaigns={calendarCampaigns} onOpenCampaign={campaignId => setLocation(`/midias/volante/veiculacao/${campaignId}`)} />
      </section>
    </div>
    <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}><DialogContent><DialogHeader><DialogTitle>Reagendar veiculação</DialogTitle><DialogDescription>A veiculação será atualizada no mesmo registro, sem criar uma duplicata. O motivo ficará no histórico operacional.</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1.5"><Label>Nova data de início</Label><Input type="date" value={rescheduleDates.startsOn} onChange={event => setRescheduleDates(current => ({ ...current, startsOn: event.target.value }))} /></label><label className="grid gap-1.5"><Label>Nova data de fim</Label><Input type="date" value={rescheduleDates.endsOn} onChange={event => setRescheduleDates(current => ({ ...current, endsOn: event.target.value }))} /></label></div><label className="grid gap-1.5"><Label>Motivo</Label><Textarea value={rescheduleReason} onChange={event => setRescheduleReason(event.target.value)} placeholder="Explique o motivo do reagendamento." /></label><Button type="button" onClick={submitReschedule} disabled={renewCampaign.isPending}>{renewCampaign.isPending ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : null}Confirmar reagendamento</Button></div></DialogContent></Dialog>
    <Dialog open={editOpen} onOpenChange={setEditOpen}><DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Editar programa mídia volante</DialogTitle><DialogDescription>Atualize os dados do responsável e do programa sem sair do histórico de programação.</DialogDescription></DialogHeader>{editForm ? <form onSubmit={submitEdit} className="grid gap-4 pt-2 md:grid-cols-2"><label className="space-y-1.5 md:col-span-2"><Label htmlFor="edit-volante-name">Nome do responsável</Label><Input id="edit-volante-name" required value={editForm.name} onChange={event => setEditForm({ ...editForm, name: event.target.value })} /></label><MultiOption id="edit-volante-supplier" label="Fornecedor" options={supplierOptions} values={editForm.supplierId ? [Number(editForm.supplierId)] : []} onChange={values => setEditForm({ ...editForm, supplierId: values[0] ? String(values[0]) : "" })} placeholder="Selecionar fornecedor" /><MultiOption id="edit-volante-city" label="Cidade" options={cityOptions} values={editForm.cityId ? [Number(editForm.cityId)] : []} onChange={values => setEditForm({ ...editForm, cityId: values[0] ? String(values[0]) : "" })} placeholder="Selecionar cidade" /><MultiOption id="edit-volante-edit-type" label="Tipo de mídia" options={mediaTypeOptions} values={editForm.mediaTypeId ? [Number(editForm.mediaTypeId)] : []} onChange={values => setEditForm({ ...editForm, mediaTypeId: values[0] ? String(values[0]) : "", mediaVariationTypeId: "" })} placeholder="Selecionar rádio ou TV" /><MultiOption id="edit-volante-variation" label="Variação de mídia" options={variationOptions} values={editForm.mediaVariationTypeId ? [Number(editForm.mediaVariationTypeId)] : []} onChange={values => setEditForm({ ...editForm, mediaVariationTypeId: values[0] ? String(values[0]) : "" })} placeholder="Selecionar variação (opcional)" /><label className="space-y-1.5"><Label htmlFor="edit-volante-contract-start">Início do contrato</Label><Input id="edit-volante-contract-start" type="date" value={editForm.contractStartsOn} onChange={event => setEditForm({ ...editForm, contractStartsOn: event.target.value })} /></label><label className="space-y-1.5"><Label htmlFor="edit-volante-contract-end">Fim do contrato</Label><Input id="edit-volante-contract-end" type="date" value={editForm.contractEndsOn} onChange={event => setEditForm({ ...editForm, contractEndsOn: event.target.value })} /></label><MultiOption id="edit-volante-partnership" label="Tipo de contrato" options={[{ id: 1, label: "Pago" }, { id: 2, label: "Permuta" }, { id: 3, label: "Misto" }]} values={[({ paid: 1, barter: 2, mixed: 3 } as const)[editForm.partnershipType]]} onChange={values => setEditForm({ ...editForm, partnershipType: ({ 1: "paid", 2: "barter", 3: "mixed" } as const)[values[0] as 1 | 2 | 3] ?? "paid" })} placeholder="Selecionar modalidade" /><MultiOption id="edit-volante-frequency" label="Período de troca do spot" options={replacementFrequencyOptions} values={[replacementFrequencyOptions.find(option => option.value === editForm.replacementFrequency)?.id ?? 0].filter(Boolean)} onChange={values => setEditForm({ ...editForm, replacementFrequency: replacementFrequencyOptions.find(option => option.id === values[0])?.value ?? "" })} placeholder="Selecionar periodicidade" /><div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button><Button type="submit" disabled={updatePoint.isPending} className="bg-primary hover:bg-primary/90"><Save className="mr-1.5 h-4 w-4" />{updatePoint.isPending ? "Salvando..." : "Salvar alterações"}</Button></div></form> : null}</DialogContent></Dialog><OperationalStatusDialog open={statusOpen} onOpenChange={setStatusOpen} title="Atualizar status do programa" description="Alterações de status ficam registradas no histórico. Para inativar ou cancelar, informe o motivo e anexe uma evidência." reason={statusForm.reason} onReasonChange={reason => setStatusForm(current => ({ ...current, reason }))} requiredReason={["inactive", "cancelled"].includes(statusForm.status)} evidenceCount={statusForm.evidenceDocumentIds.length} contextContent={<MultiOption id="volante-status-dialog" label="Novo status" options={pointStatusOptions.map(option => ({ id: option.id, label: option.label }))} values={[pointStatusOptions.find(option => option.value === statusForm.status)?.id ?? 1]} onChange={values => { const selected = pointStatusOptions.find(option => option.id === values[0]); if (selected) setStatusForm(current => ({ ...current, status: selected.value })); }} placeholder="Selecionar status" />} evidenceContent={["inactive", "cancelled"].includes(statusForm.status) ? <EvidenceUpload entityType="media_point" entityId={mediaPointId} regionalId={point.regionalId} canWrite={canWrite} documentKind="history_evidence" title="Evidência da alteração" onUploadComplete={document => setStatusForm(current => ({ ...current, evidenceDocumentIds: Array.from(new Set([...current.evidenceDocumentIds, document.id])) }))} /> : null} pending={updatePointStatus.isPending} onSubmit={submitStatus} /><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Nova veiculação mídia volante</DialogTitle><DialogDescription>Programe o spot, vincule o serviço e informe as cidades que recebem o sinal.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4 pt-2 md:grid-cols-2"><label className="space-y-1.5 md:col-span-2"><Label htmlFor="volante-name">Nome do spot ou veiculação</Label><Input id="volante-name" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="Ex.: Campanha institucional — spot 30s" /></label><MultiOption id="volante-service" label="Tipo de serviço" options={serviceOptions.map(service => ({ id: service.id, label: service.name ?? `Serviço ${service.id}`, description: "Vinculado ao tipo de mídia" }))} values={form.serviceTypeId ? [Number(form.serviceTypeId)] : []} onChange={values => setForm({ ...form, serviceTypeId: values[0] ? String(values[0]) : "" })} placeholder="Selecionar propaganda, entrevista ou serviço" /><MultiOption id="volante-responsible" label="Responsável do trade" options={(references.data?.users ?? []).map(user => ({ id: user.id, label: user.name ?? `Usuário ${user.id}`, description: user.jobTitle || user.email || undefined }))} values={form.responsibleUserId ? [Number(form.responsibleUserId)] : []} onChange={values => setForm({ ...form, responsibleUserId: values[0] ? String(values[0]) : "" })} placeholder="Selecionar responsável" /><div className="md:col-span-2"><MultiOption id="volante-campaign" label="Campanha vinculada" options={(tradeCampaigns.data ?? []).map(campaign => ({ id: campaign.id, label: campaign.name ?? `Campanha ${campaign.id}`, description: campaign.status === "active" ? "Ativa" : "Planejada" }))} values={form.tradeCampaignId ? [Number(form.tradeCampaignId)] : []} onChange={values => setForm({ ...form, tradeCampaignId: values[0] ? String(values[0]) : "" })} placeholder="Selecionar campanha (opcional)" /></div><label className="space-y-1.5"><Label htmlFor="volante-start">Início do spot</Label><Input id="volante-start" required type="date" value={form.startsOn} onChange={event => setForm({ ...form, startsOn: event.target.value })} /></label><label className="space-y-1.5"><Label htmlFor="volante-end">Fim do spot</Label><Input id="volante-end" required type="date" value={form.endsOn} onChange={event => setForm({ ...form, endsOn: event.target.value })} /></label><label className="space-y-1.5"><Label htmlFor="volante-cost">Investimento previsto</Label><Input id="volante-cost" type="number" min="0" step="0.01" value={form.estimatedCost} onChange={event => setForm({ ...form, estimatedCost: event.target.value })} placeholder="0,00" /></label><MultiOption id="volante-partnership" label="Tipo de contrato" options={[{ id: 1, label: "Pago" }, { id: 2, label: "Permuta" }, { id: 3, label: "Misto" }]} values={[({ paid: 1, barter: 2, mixed: 3 } as const)[form.partnershipType]]} onChange={values => setForm({ ...form, partnershipType: ({ 1: "paid", 2: "barter", 3: "mixed" } as const)[values[0] as 1 | 2 | 3] ?? "paid" })} placeholder="Selecionar modalidade" /><div className="md:col-span-2"><MultiOption id="volante-signal-cities" label="Cidades que recebem o sinal" options={cityOptions} values={form.signalCityIds} onChange={signalCityIds => setForm({ ...form, signalCityIds })} placeholder="Selecionar cidades de alcance" /></div><div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3 md:col-span-2"><Checkbox id="volante-concurrent" checked={form.allowConcurrent} onCheckedChange={checked => setForm({ ...form, allowConcurrent: checked === true })} /><div><Label htmlFor="volante-concurrent" className="cursor-pointer text-sm font-medium">Permitir coexistência com outra veiculação ativa</Label><p className="mt-1 text-xs leading-5 text-muted-foreground">Use para entrevistas, participações ou programas ao vivo que podem ocorrer simultaneamente a um spot. Spots comuns continuarão solicitando confirmação para encerrar a veiculação ativa anterior.</p></div></div><TraditionalScheduleEditor value={form.schedules} onChange={schedules => setForm(current => ({ ...current, schedules }))} /><div className="rounded-lg border border-border bg-secondary/40 p-3 md:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><Label htmlFor="volante-spot-file" className="flex items-center gap-1.5 text-sm font-medium"><Paperclip className="h-3.5 w-3.5 text-primary" />Arquivo do spot</Label><p className="mt-1 text-xs text-muted-foreground">Anexe o áudio que será usado nesta veiculação. Formatos aceitos: MP3 ou WAV, até 50 MB.</p></div><label htmlFor="volante-spot-file" className="inline-flex cursor-pointer items-center rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition hover:border-primary/50"><Paperclip className="mr-1.5 h-3.5 w-3.5 text-primary" />Selecionar arquivo</label><input id="volante-spot-file" type="file" accept="audio/mpeg,audio/wav,audio/x-wav,.mp3,.wav" onChange={handleSpotFile} className="hidden" /></div>{spotFile ? <p className="mt-2 truncate text-xs font-medium text-primary">Selecionado: {spotFile.originalName}</p> : <p className="mt-2 text-xs text-muted-foreground">Nenhum spot selecionado. Você também poderá anexar ou substituir o arquivo na ficha da veiculação.</p>}</div><label className="space-y-1.5 md:col-span-2"><Label htmlFor="volante-signal-notes">Detalhes do alcance</Label><Textarea id="volante-signal-notes" value={form.signalNotes} onChange={event => setForm({ ...form, signalNotes: event.target.value })} placeholder="Observações sobre cobertura, praça, frequência ou condições do sinal" /></label><label className="space-y-1.5 md:col-span-2"><Label htmlFor="volante-details">Detalhes da veiculação</Label><Textarea id="volante-details" value={form.campaignDetails} onChange={event => setForm({ ...form, campaignDetails: event.target.value })} placeholder="Objetivo, formato, duração do spot, entrevista ou entregas" /></label><label className="space-y-1.5 md:col-span-2"><Label htmlFor="volante-notes">Observações internas</Label><Textarea id="volante-notes" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Informações para acompanhamento da equipe" /></label><div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={create.isPending} className="bg-primary hover:bg-primary/90">{create.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}Criar veiculação</Button></div></form></DialogContent></Dialog><AlertDialog open={confirmReplaceOpen} onOpenChange={open => { setConfirmReplaceOpen(open); if (!open) setPendingPayload(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Já existe uma veiculação ativa</AlertDialogTitle><AlertDialogDescription>Ao confirmar, as veiculações de mídia volante conflitantes neste programa serão encerradas e o novo spot ficará ativo. Entrevistas, participações e programas ao vivo podem continuar simultaneamente quando a opção de coexistência estiver marcada.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Manter a veiculação atual</AlertDialogCancel><AlertDialogAction onClick={() => { if (pendingPayload) create.mutate({ ...pendingPayload, confirmReplaceExisting: true }); }}>Encerrar e criar nova veiculação</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}
