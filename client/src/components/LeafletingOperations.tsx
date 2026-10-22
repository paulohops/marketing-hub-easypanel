import { useState, useMemo, FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import MultiDatePicker from "@/components/MultiDatePicker";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CalendarDays,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Star,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ClipboardCheck,
  Layers,
  FileText,
  RotateCcw,
} from "lucide-react";

export type LeafletingSchedule = {
  id: number;
  mediaCampaignId: number;
  programName: string;
  specificDate: string | null;
  weekday: number | null;
  startsAt: string;
  endsAt: string;
  cityId: number | null;
  cityName?: string | null;
  neighborhoodId: number | null;
  neighborhoodName?: string | null;
  routeDescription?: string | null;
  distributionVolume?: number | null;
  debriefStatus?: string | null;
  debriefNotes?: string | null;
  debriefRating?: number | null;
  debriefLearnings?: string | null;
  debriefAt?: string | Date | null;
  debriefedByUserName?: string | null;
  notes?: string | null;
};

export type LeafletingCampaign = {
  id: number;
  name: string;
  startsOn: string;
  endsOn: string;
  partnershipType: "paid" | "barter" | "mixed";
  estimatedCost: string | number;
  notes?: string | null;
  campaignDetails?: string | null;
  campaignConfig?: Record<string, any> | null;
  cityDistributions?: Array<{
    cityId: number;
    cityName?: string;
    regionalName?: string;
    quantity: number;
    notes?: string | null;
  }>;
  schedules?: LeafletingSchedule[];
};

// ---------------------------------------------------------------------------
// 1. DIALOG: EDITAR PANFLETAGEM
// ---------------------------------------------------------------------------

type EditLeafletingDialogProps = {
  campaign: LeafletingCampaign | null;
  regionalId?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function EditLeafletingDialog({
  campaign,
  regionalId,
  open,
  onOpenChange,
  onSuccess,
}: EditLeafletingDialogProps) {
  const references = trpc.media.referenceData.useQuery(undefined, { enabled: open });
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [partnershipType, setPartnershipType] = useState<"paid" | "barter" | "mixed">("paid");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [materialFormat, setMaterialFormat] = useState("");
  const [materialQuantity, setMaterialQuantity] = useState("");
  const [campaignDetails, setCampaignDetails] = useState("");
  const [notes, setNotes] = useState("");
  const [cityDistributions, setCityDistributions] = useState<Array<{ cityId: number; quantity: number; notes: string }>>([]);

  const [distCityId, setDistCityId] = useState<number | null>(null);
  const [distQty, setDistQty] = useState<string>("1000");
  const [distNotes, setDistNotes] = useState<string>("");

  // Sync state when dialog opens or campaign changes
  const [lastInitId, setLastInitId] = useState<number | null>(null);
  if (campaign && campaign.id !== lastInitId && open) {
    setLastInitId(campaign.id);
    setName(campaign.name ?? "");
    setStartsOn(campaign.startsOn ? campaign.startsOn.slice(0, 10) : "");
    setEndsOn(campaign.endsOn ? campaign.endsOn.slice(0, 10) : "");
    setPartnershipType((campaign.partnershipType as "paid" | "barter" | "mixed") || "paid");
    setEstimatedCost(campaign.estimatedCost ? String(campaign.estimatedCost) : "0");
    const cfg = campaign.campaignConfig || {};
    setMaterialFormat(cfg.materialFormat || "");
    setMaterialQuantity(cfg.materialQuantity ? String(cfg.materialQuantity) : "");
    setCampaignDetails(campaign.campaignDetails || "");
    setNotes(campaign.notes || "");
    setCityDistributions(
      (campaign.cityDistributions || []).map(item => ({
        cityId: item.cityId,
        quantity: item.quantity,
        notes: item.notes || "",
      }))
    );
  }

  const regionalCities = useMemo(() => {
    if (!references.data?.cities) return [];
    if (!regionalId) return references.data.cities.map(item => item.city);
    return references.data.cities.filter(item => item.city.regionalId === regionalId).map(item => item.city);
  }, [references.data?.cities, regionalId]);

  const updateVeiculation = trpc.media.updateTraditionalVeiculation.useMutation({
    onSuccess: () => {
      toast.success("Panfletagem atualizada com sucesso.");
      utils.media.list.invalidate();
      utils.media.pointDetails.invalidate();
      utils.media.campaignDetails.invalidate();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: error => toast.error(error.message),
  });

  const handleAddDistribution = () => {
    if (!distCityId || !distQty) return;
    if (cityDistributions.some(item => item.cityId === distCityId)) {
      toast.error("Esta cidade já foi adicionada na distribuição.");
      return;
    }
    setCityDistributions(current => [
      ...current,
      { cityId: distCityId, quantity: Number(distQty), notes: distNotes.trim() },
    ]);
    setDistCityId(null);
    setDistQty("1000");
    setDistNotes("");
  };

  const handleRemoveDistribution = (cityId: number) => {
    setCityDistributions(current => current.filter(item => item.cityId !== cityId));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!campaign) return;
    if (endsOn < startsOn) {
      toast.error("A data final deve ser igual ou posterior à data de início.");
      return;
    }

    updateVeiculation.mutate({
      campaignId: campaign.id,
      name: name.trim(),
      startsOn,
      endsOn,
      partnershipType,
      estimatedCost: Number(estimatedCost || 0),
      materialFormat: materialFormat.trim() || undefined,
      materialQuantity: materialQuantity ? Number(materialQuantity) : undefined,
      campaignDetails: campaignDetails.trim() || undefined,
      notes: notes.trim() || undefined,
      cityDistributions: cityDistributions.map(item => ({
        cityId: item.cityId,
        quantity: item.quantity,
        notes: item.notes || undefined,
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Pencil className="h-5 w-5 text-primary" />
            Editar Panfletagem
          </DialogTitle>
          <DialogDescription>
            Atualize o período, modalidade, formato do material, tiragem e a distribuição por cidade desta ação.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 pt-2 md:grid-cols-2">
          <label className="space-y-1.5 md:col-span-2">
            <Label htmlFor="edit-leafleting-name">Nome da panfletagem / ação</Label>
            <Input
              id="edit-leafleting-name"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex.: Distribuição Promocional Regional - Setembro"
            />
          </label>

          <label className="space-y-1.5">
            <Label htmlFor="edit-leafleting-start">Início da ação</Label>
            <Input
              id="edit-leafleting-start"
              required
              type="date"
              value={startsOn}
              onChange={e => setStartsOn(e.target.value)}
            />
          </label>

          <label className="space-y-1.5">
            <Label htmlFor="edit-leafleting-end">Término da ação</Label>
            <Input
              id="edit-leafleting-end"
              required
              type="date"
              value={endsOn}
              onChange={e => setEndsOn(e.target.value)}
            />
          </label>

          <div className="space-y-1.5">
            <Label htmlFor="edit-leafleting-partnership">Modalidade de contratação</Label>
            <select
              id="edit-leafleting-partnership"
              value={partnershipType}
              onChange={e => setPartnershipType(e.target.value as "paid" | "barter" | "mixed")}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="paid">Pago</option>
              <option value="barter">Permuta</option>
              <option value="mixed">Misto</option>
            </select>
          </div>

          <label className="space-y-1.5">
            <Label htmlFor="edit-leafleting-cost">Investimento previsto (R$)</Label>
            <Input
              id="edit-leafleting-cost"
              type="number"
              step="0.01"
              min="0"
              value={estimatedCost}
              onChange={e => setEstimatedCost(e.target.value)}
              placeholder="0,00"
            />
          </label>

          <label className="space-y-1.5">
            <Label htmlFor="edit-leafleting-format">Formato do material</Label>
            <Input
              id="edit-leafleting-format"
              value={materialFormat}
              onChange={e => setMaterialFormat(e.target.value)}
              placeholder="Ex.: Folder A5 frente e verso 115g"
            />
          </label>

          <label className="space-y-1.5">
            <Label htmlFor="edit-leafleting-qty">Quantidade total de panfletos</Label>
            <Input
              id="edit-leafleting-qty"
              type="number"
              min="1"
              value={materialQuantity}
              onChange={e => setMaterialQuantity(e.target.value)}
              placeholder="Ex.: 10000"
            />
          </label>

          <label className="space-y-1.5 md:col-span-2">
            <Label htmlFor="edit-leafleting-details">Instruções e detalhes da operação</Label>
            <Textarea
              id="edit-leafleting-details"
              value={campaignDetails}
              onChange={e => setCampaignDetails(e.target.value)}
              placeholder="Público-alvo, locais prioritários, equipe de promotores, horários de pico, abordagem e critérios de entrega"
            />
          </label>

          {/* DISTRIBUIÇÃO TERRITORIAL */}
          <section className="space-y-3 rounded-xl border border-sky-200 bg-sky-50/50 p-4 md:col-span-2 dark:border-sky-900/60 dark:bg-sky-950/20">
            <div>
              <p className="text-sm font-semibold text-foreground">Distribuição de materiais por cidade</p>
              <p className="text-xs text-muted-foreground">Distribua a tiragem pelas cidades atendidas para acompanhamento territorial.</p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-[1.5fr_1fr_1.5fr_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="edit-dist-city">Cidade</Label>
                <select
                  id="edit-dist-city"
                  value={distCityId ?? ""}
                  onChange={e => setDistCityId(e.target.value ? Number(e.target.value) : null)}
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none"
                >
                  <option value="">Selecionar cidade</option>
                  {regionalCities.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <label className="space-y-1.5">
                <Label htmlFor="edit-dist-qty">Tiragem</Label>
                <Input
                  id="edit-dist-qty"
                  type="number"
                  min="1"
                  value={distQty}
                  onChange={e => setDistQty(e.target.value)}
                  className="h-9 text-xs"
                />
              </label>

              <label className="space-y-1.5">
                <Label htmlFor="edit-dist-notes">Observação</Label>
                <Input
                  id="edit-dist-notes"
                  value={distNotes}
                  onChange={e => setDistNotes(e.target.value)}
                  placeholder="Ex.: Centro e semáforos"
                  className="h-9 text-xs"
                />
              </label>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                onClick={handleAddDistribution}
                disabled={!distCityId || !distQty}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Adicionar
              </Button>
            </div>

            {cityDistributions.length > 0 ? (
              <div className="divide-y divide-border/60 rounded-lg border border-border bg-background">
                {cityDistributions.map(item => {
                  const city = regionalCities.find(c => c.id === item.cityId);
                  return (
                    <div key={item.cityId} className="flex items-center justify-between px-3 py-2 text-xs">
                      <div>
                        <strong className="text-foreground">{city?.name ?? `Cidade #${item.cityId}`}</strong>
                        <span className="ml-2 text-muted-foreground">
                          · {item.quantity.toLocaleString("pt-BR")} panfletos
                          {item.notes ? ` (${item.notes})` : ""}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDistribution(item.cityId)}
                        className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">Nenhuma cidade configurada na distribuição.</p>
            )}
          </section>

          <label className="space-y-1.5 md:col-span-2">
            <Label htmlFor="edit-leafleting-notes">Observações internas</Label>
            <Textarea
              id="edit-leafleting-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Comentários internos da equipe de trade marketing"
            />
          </label>

          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={updateVeiculation.isPending || !name.trim() || !startsOn || !endsOn}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {updateVeiculation.isPending ? "Salvando alterações..." : "Salvar panfletagem"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 2. DIALOG: ADICIONAR / EDITAR ROTA DO CALENDÁRIO
// ---------------------------------------------------------------------------

type ScheduleRouteDialogProps = {
  mediaCampaignId: number;
  regionalId?: number | null;
  editingSchedule: LeafletingSchedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function ScheduleRouteDialog({
  mediaCampaignId,
  regionalId,
  editingSchedule,
  open,
  onOpenChange,
  onSuccess,
}: ScheduleRouteDialogProps) {
  const references = trpc.media.referenceData.useQuery(undefined, { enabled: open });
  const utils = trpc.useUtils();

  const [programName, setProgramName] = useState("Rota de lançamento");
  const [startsAt, setStartsAt] = useState("08:00");
  const [endsAt, setEndsAt] = useState("08:30");
  const [cityId, setCityId] = useState<number | null>(null);
  const [neighborhoodId, setNeighborhoodId] = useState<number | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [routeDescription, setRouteDescription] = useState("");
  const [distributionVolume, setDistributionVolume] = useState("");
  const [notes, setNotes] = useState("");

  const [lastEditingId, setLastEditingId] = useState<number | null>(null);

  if (open && editingSchedule && editingSchedule.id !== lastEditingId) {
    setLastEditingId(editingSchedule.id);
    setProgramName(editingSchedule.programName || "Rota de lançamento");
    setStartsAt(editingSchedule.startsAt || "08:00");
    setEndsAt(editingSchedule.endsAt || "08:30");
    setCityId(editingSchedule.cityId ?? null);
    setNeighborhoodId(editingSchedule.neighborhoodId ?? null);
    setSelectedDates(editingSchedule.specificDate ? [editingSchedule.specificDate.slice(0, 10)] : []);
    setRouteDescription(editingSchedule.routeDescription || "");
    setDistributionVolume(editingSchedule.distributionVolume ? String(editingSchedule.distributionVolume) : "");
    setNotes(editingSchedule.notes || "");
  } else if (open && !editingSchedule && lastEditingId !== null) {
    setLastEditingId(null);
    setProgramName("Rota de lançamento");
    setStartsAt("08:00");
    setEndsAt("08:30");
    setCityId(null);
    setNeighborhoodId(null);
    setSelectedDates([new Date().toISOString().slice(0, 10)]);
    setRouteDescription("");
    setDistributionVolume("");
    setNotes("");
  }

  const regionalCityOptions = useMemo(() => {
    if (!references.data?.cities) return [];
    const source = !regionalId
      ? references.data.cities
      : references.data.cities.filter(item => item.city.regionalId === regionalId);
    return source.map(({ city, regionalName }) => ({
      id: city.id,
      label: city.name,
      description: regionalName,
    }));
  }, [references.data?.cities, regionalId]);

  const availableNeighborhoods = useMemo(() => {
    if (!cityId || !references.data?.neighborhoods) return [];
    return references.data.neighborhoods.filter(n => n.cityId === cityId);
  }, [cityId, references.data?.neighborhoods]);

  const addRoute = trpc.media.addScheduleRoute.useMutation({
    onSuccess: () => {
      toast.success(selectedDates.length > 1 ? `${selectedDates.length} rotas adicionadas ao calendário.` : "Nova rota adicionada ao calendário.");
      utils.media.pointDetails.invalidate();
      utils.media.campaignDetails.invalidate();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: error => toast.error(error.message),
  });

  const updateRoute = trpc.media.updateScheduleRoute.useMutation({
    onSuccess: () => {
      toast.success("Rota da operação atualizada.");
      utils.media.pointDetails.invalidate();
      utils.media.campaignDetails.invalidate();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: error => toast.error(error.message),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (endsAt <= startsAt) {
      toast.error("O horário final deve ser posterior ao horário de início.");
      return;
    }

    if (editingSchedule) {
      updateRoute.mutate({
        scheduleId: editingSchedule.id,
        programName: programName.trim() || "Rota de lançamento",
        specificDate: selectedDates[0] || null,
        startsAt,
        endsAt,
        cityId: cityId ?? null,
        neighborhoodId: neighborhoodId ?? null,
        routeDescription: routeDescription.trim() || null,
        distributionVolume: distributionVolume ? Number(distributionVolume) : null,
        notes: notes.trim() || null,
      });
    } else {
      if (!selectedDates.length) {
        toast.error("Selecione pelo menos um dia no calendário da operação.");
        return;
      }
      addRoute.mutate({
        mediaCampaignId,
        programName: programName.trim() || "Rota de lançamento",
        specificDates: selectedDates,
        startsAt,
        endsAt,
        cityId: cityId ?? null,
        neighborhoodId: neighborhoodId ?? null,
        routeDescription: routeDescription.trim() || null,
        distributionVolume: distributionVolume ? Number(distributionVolume) : null,
        notes: notes.trim() || null,
      });
    }
  };

  const isPending = addRoute.isPending || updateRoute.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <CalendarDays className="h-5 w-5 text-primary" />
            {editingSchedule ? "Editar Rota / Horário" : "Adicionar Rota / Horário"}
          </DialogTitle>
          <DialogDescription>
            {editingSchedule
              ? "Atualize as informações, horários e data desta rodada de panfletagem."
              : "Defina a atividade, horários, cidade e selecione os dias da rodagem no calendário."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <article className="rounded-lg border border-border bg-card p-3">
            {/* ROW 1: Veiculação ou atividade, Início, Fim */}
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_110px_110px_auto] sm:items-end">
              <label className="space-y-1.5">
                <Label htmlFor="route-program">Veiculação ou atividade</Label>
                <Input
                  id="route-program"
                  required
                  value={programName}
                  onChange={e => setProgramName(e.target.value)}
                  placeholder="Ex.: Rota de lançamento"
                />
              </label>
              <label className="space-y-1.5">
                <Label htmlFor="route-start">Início</Label>
                <Input
                  id="route-start"
                  required
                  type="time"
                  value={startsAt}
                  onChange={e => setStartsAt(e.target.value)}
                />
              </label>
              <label className="space-y-1.5">
                <Label htmlFor="route-end">Fim</Label>
                <Input
                  id="route-end"
                  required
                  type="time"
                  value={endsAt}
                  onChange={e => setEndsAt(e.target.value)}
                />
              </label>
              {editingSchedule && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                  className="h-10 w-10 text-muted-foreground hover:text-foreground"
                  title="Fechar"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* ROW 2: Cidade da rodada */}
            <div className="mt-3">
              <SearchableMultiSelect
                id="route-city"
                label="Cidade da rodada"
                options={regionalCityOptions}
                values={cityId ? [cityId] : []}
                maxSelections={1}
                onChange={values => {
                  setCityId(values[0] ?? null);
                  setNeighborhoodId(null);
                }}
                placeholder="Selecionar cidade"
                emptyMessage="Nenhuma cidade disponível nesta regional"
              />
            </div>

            {/* ROW 3: Dias da rodagem / operação */}
            <div className="mt-3">
              <MultiDatePicker
                value={selectedDates}
                onChange={setSelectedDates}
                label="Dias da rodagem / operação"
                description="Selecione múltiplos dias no calendário ou adicione um período completo de uma só vez."
              />
            </div>

            {/* ROW 4: Observação da rodada */}
            <div className="mt-3">
              <label className="space-y-1.5 block">
                <Label htmlFor="route-notes">Observação da rodada</Label>
                <Input
                  id="route-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Ex.: rota da manhã, pontos comerciais"
                />
              </label>
            </div>

            {/* CAMPOS ADICIONAIS OPCIONAIS */}
            <details className="mt-3 group rounded-lg border border-border/70 bg-secondary/30 p-3 text-xs">
              <summary className="cursor-pointer font-medium text-foreground hover:text-primary transition">
                Informações adicionais (volume de panfletos, bairro e percurso detalhado)
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="route-volume" className="text-xs">Volume planejado de panfletos (opcional)</Label>
                  <Input
                    id="route-volume"
                    type="number"
                    min="0"
                    value={distributionVolume}
                    onChange={e => setDistributionVolume(e.target.value)}
                    placeholder="Ex.: 1500"
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="route-neighborhood" className="text-xs">Bairro (opcional)</Label>
                  <select
                    id="route-neighborhood"
                    disabled={!cityId}
                    value={neighborhoodId ?? ""}
                    onChange={e => setNeighborhoodId(e.target.value ? Number(e.target.value) : null)}
                    className="h-9 w-full rounded-md border border-border bg-background px-3 text-xs text-foreground outline-none disabled:opacity-50"
                  >
                    <option value="">{cityId ? "Selecionar bairro (opcional)" : "Selecione a cidade primeiro"}</option>
                    {availableNeighborhoods.map(n => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="route-desc" className="text-xs">Percurso / Rota de distribuição (opcional)</Label>
                  <Input
                    id="route-desc"
                    value={routeDescription}
                    onChange={e => setRouteDescription(e.target.value)}
                    placeholder="Ex.: Saída da Praça Central, descendo pelo calçadão comercial até o terminal"
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </details>
          </article>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending || !startsAt || !endsAt || (!editingSchedule && !selectedDates.length)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isPending
                ? "Salvando..."
                : editingSchedule
                ? "Salvar alterações"
                : selectedDates.length > 1
                ? `Adicionar ${selectedDates.length} rotas`
                : "Adicionar rota"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 3. DIALOG: DEBRIEFING INDIVIDUAL POR ROTA
// ---------------------------------------------------------------------------

type RouteDebriefDialogProps = {
  schedule: LeafletingSchedule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function RouteDebriefDialog({
  schedule,
  open,
  onOpenChange,
  onSuccess,
}: RouteDebriefDialogProps) {
  const utils = trpc.useUtils();

  const [debriefStatus, setDebriefStatus] = useState<"completed" | "partial" | "cancelled" | "pending">("completed");
  const [debriefRating, setDebriefRating] = useState<number>(5);
  const [actualVolume, setActualVolume] = useState<string>("");
  const [debriefLearnings, setDebriefLearnings] = useState("");
  const [debriefNotes, setDebriefNotes] = useState("");

  const [lastScheduleId, setLastScheduleId] = useState<number | null>(null);

  if (open && schedule && schedule.id !== lastScheduleId) {
    setLastScheduleId(schedule.id);
    setDebriefStatus((schedule.debriefStatus as any) || "completed");
    setDebriefRating(schedule.debriefRating ?? 5);
    setActualVolume(schedule.distributionVolume ? String(schedule.distributionVolume) : "");
    setDebriefLearnings(schedule.debriefLearnings || "");
    setDebriefNotes(schedule.debriefNotes || "");
  }

  const debriefRoute = trpc.media.debriefScheduleRoute.useMutation({
    onSuccess: () => {
      toast.success("Debriefing da rota registrado com sucesso.");
      utils.media.pointDetails.invalidate();
      utils.media.campaignDetails.invalidate();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: error => toast.error(error.message),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!schedule) return;

    debriefRoute.mutate({
      scheduleId: schedule.id,
      debriefStatus,
      debriefRating,
      distributionVolume: actualVolume ? Number(actualVolume) : undefined,
      debriefLearnings: debriefLearnings.trim() || null,
      debriefNotes: debriefNotes.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Debriefing da Rota
          </DialogTitle>
          <DialogDescription>
            Registre o resultado, volume distribuído, avaliação qualitativa e aprendizados desta rodada.
          </DialogDescription>
        </DialogHeader>

        {schedule && (
          <div className="rounded-xl border border-border bg-secondary/40 p-3.5 text-xs">
            <p className="font-semibold text-foreground">{schedule.programName}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              <span>
                <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
                {schedule.specificDate
                  ? new Date(`${schedule.specificDate}T12:00:00`).toLocaleDateString("pt-BR")
                  : "Data recorrente"}{" "}
                · {schedule.startsAt}–{schedule.endsAt}
              </span>
              {schedule.cityName && (
                <span>
                  <MapPin className="mr-1 inline h-3.5 w-3.5" />
                  {schedule.cityName}
                  {schedule.neighborhoodName ? ` · ${schedule.neighborhoodName}` : ""}
                </span>
              )}
            </div>
            {schedule.routeDescription && (
              <p className="mt-1 text-muted-foreground italic">Percurso: {schedule.routeDescription}</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4 pt-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="debrief-status">Status da execução</Label>
              <select
                id="debrief-status"
                value={debriefStatus}
                onChange={e => setDebriefStatus(e.target.value as any)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="completed">Concluído integralmente</option>
                <option value="partial">Execução parcial</option>
                <option value="cancelled">Cancelado / Não executado</option>
                <option value="pending">Pendente de execução</option>
              </select>
            </div>

            <label className="space-y-1.5">
              <Label htmlFor="actual-volume">Volume distribuído (panfletos)</Label>
              <Input
                id="actual-volume"
                type="number"
                min="0"
                value={actualVolume}
                onChange={e => setActualVolume(e.target.value)}
                placeholder="Ex.: 1450"
              />
            </label>
          </div>

          {/* NOTA DE AVALIAÇÃO COM ESTRELAS */}
          <div className="rounded-xl border border-border bg-card p-3.5">
            <Label className="text-xs font-semibold text-foreground">Avaliação da rota (1 a 5 estrelas)</Label>
            <div className="mt-2 flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setDebriefRating(rating)}
                  className="rounded p-1 text-muted-foreground transition hover:text-amber-500 focus:outline-none"
                  aria-label={`${rating} estrela${rating > 1 ? "s" : ""}`}
                >
                  <Star
                    className={`h-6 w-6 ${
                      rating <= debriefRating
                        ? "fill-amber-400 text-amber-400 dark:fill-amber-500 dark:text-amber-500"
                        : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-3 text-xs font-medium text-foreground">
                {debriefRating === 5 && "5/5 · Excelente"}
                {debriefRating === 4 && "4/5 · Muito bom"}
                {debriefRating === 3 && "3/5 · Bom / Regular"}
                {debriefRating === 2 && "2/5 · Abaixo do esperado"}
                {debriefRating === 1 && "1/5 · Insuficiente"}
              </span>
            </div>
          </div>

          <label className="space-y-1.5">
            <Label htmlFor="debrief-learnings">Aprendizados e o que funcionou</Label>
            <Textarea
              id="debrief-learnings"
              value={debriefLearnings}
              onChange={e => setDebriefLearnings(e.target.value)}
              placeholder="Qual foi a receptividade do público? Quais horários/locais tiveram mais fluxo? O que pode ser replicado ou melhorado?"
            />
          </label>

          <label className="space-y-1.5">
            <Label htmlFor="debrief-notes">Observações gerais da execução</Label>
            <Textarea
              id="debrief-notes"
              value={debriefNotes}
              onChange={e => setDebriefNotes(e.target.value)}
              placeholder="Ocorrências, condições de tempo, promotores presentes, sobras de material, etc."
            />
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Voltar
            </Button>
            <Button
              type="submit"
              disabled={debriefRoute.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {debriefRoute.isPending ? "Salvando debriefing..." : "Salvar debriefing"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// 4. COMPONENTE: GERENCIADOR DO CALENDÁRIO DA OPERAÇÃO
// ---------------------------------------------------------------------------

type LeafletingCalendarManagerProps = {
  campaignId: number;
  regionalId?: number | null;
  schedules?: LeafletingSchedule[];
  canWrite?: boolean;
  onRefresh?: () => void;
};

export function LeafletingCalendarManager({
  campaignId,
  regionalId,
  schedules = [],
  canWrite = true,
  onRefresh,
}: LeafletingCalendarManagerProps) {
  const utils = trpc.useUtils();
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<LeafletingSchedule | null>(null);
  const [debriefingSchedule, setDebriefingSchedule] = useState<LeafletingSchedule | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<LeafletingSchedule | null>(null);

  const deleteRoute = trpc.media.deleteScheduleRoute.useMutation({
    onSuccess: () => {
      toast.success("Rota removida com sucesso.");
      utils.media.pointDetails.invalidate();
      utils.media.campaignDetails.invalidate();
      setDeletingSchedule(null);
      onRefresh?.();
    },
    onError: error => toast.error(error.message),
  });

  return (
    <div className="space-y-3">
      {/* HEADER DA SEÇÃO DE CALENDÁRIO */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-border/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Calendário da Operação</p>
            <Badge variant="outline" className="border-border bg-secondary text-[10px] text-foreground">
              {schedules.length} rota{schedules.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Gerencie as rotas de distribuição, horários, tiragem e o debriefing individual por rodada.
          </p>
        </div>

        {canWrite && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 border-primary/30 text-xs text-foreground hover:bg-primary/10 hover:text-primary"
            onClick={() => {
              setEditingSchedule(null);
              setShowAddRoute(true);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Adicionar Rota / Horário
          </Button>
        )}
      </div>

      {/* LISTA DE ROTAS DO CALENDÁRIO */}
      {schedules.length > 0 ? (
        <div className="grid gap-2.5">
          {schedules.map(schedule => {
            const isCompleted = schedule.debriefStatus === "completed";
            const isPartial = schedule.debriefStatus === "partial";
            const isCancelled = schedule.debriefStatus === "cancelled";
            const isPending = !schedule.debriefStatus || schedule.debriefStatus === "pending";

            return (
              <article
                key={schedule.id}
                className="group rounded-xl border border-border bg-background/80 p-3.5 transition hover:border-primary/40 hover:bg-secondary/20"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground text-sm">{schedule.programName}</p>

                      {/* BADGE DE STATUS DO DEBRIEFING */}
                      {isCompleted && (
                        <Badge className="border-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px]">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Debriefing Concluído
                        </Badge>
                      )}
                      {isPartial && (
                        <Badge className="border-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px]">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Debriefing Parcial
                        </Badge>
                      )}
                      {isCancelled && (
                        <Badge className="border-0 bg-destructive/10 text-destructive text-[10px]">
                          <XCircle className="mr-1 h-3 w-3" />
                          Cancelada
                        </Badge>
                      )}
                      {isPending && (
                        <Badge variant="outline" className="border-border bg-secondary text-[10px] text-muted-foreground">
                          <Clock className="mr-1 h-3 w-3" />
                          Debriefing Pendente
                        </Badge>
                      )}

                      {/* NOTA COM ESTRELAS */}
                      {schedule.debriefRating ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {schedule.debriefRating}/5
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 text-foreground font-medium">
                        <CalendarDays className="h-3.5 w-3.5 text-primary" />
                        {schedule.specificDate
                          ? new Date(`${schedule.specificDate}T12:00:00`).toLocaleDateString("pt-BR")
                          : "Data recorrente"}
                      </span>

                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {schedule.startsAt} – {schedule.endsAt}
                      </span>

                      {schedule.cityName && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {schedule.cityName}
                          {schedule.neighborhoodName ? ` · ${schedule.neighborhoodName}` : ""}
                        </span>
                      )}

                      {schedule.distributionVolume ? (
                        <span className="flex items-center gap-1">
                          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                          Volume: <strong>{schedule.distributionVolume.toLocaleString("pt-BR")}</strong> panfletos
                        </span>
                      ) : null}
                    </div>

                    {schedule.routeDescription && (
                      <p className="pt-0.5 text-xs text-foreground/90 leading-relaxed">
                        <strong className="text-muted-foreground font-normal">Percurso: </strong>
                        {schedule.routeDescription}
                      </p>
                    )}

                    {schedule.notes && (
                      <p className="text-[11px] text-muted-foreground">
                        <strong className="font-normal">Obs: </strong>
                        {schedule.notes}
                      </p>
                    )}

                    {/* RESUMO DO DEBRIEFING SE JÁ REALIZADO */}
                    {(schedule.debriefLearnings || schedule.debriefNotes) && (
                      <div className="mt-2 rounded-lg border border-border/70 bg-secondary/30 p-2.5 text-xs space-y-1">
                        {schedule.debriefLearnings && (
                          <p className="text-foreground">
                            <span className="font-semibold text-muted-foreground">Aprendizados: </span>
                            {schedule.debriefLearnings}
                          </p>
                        )}
                        {schedule.debriefNotes && (
                          <p className="text-muted-foreground">
                            <span className="font-semibold">Observações: </span>
                            {schedule.debriefNotes}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/80 pt-0.5">
                          Registrado por {schedule.debriefedByUserName || "Usuário"} em{" "}
                          {schedule.debriefAt ? new Date(schedule.debriefAt).toLocaleString("pt-BR") : "data recente"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* AÇÕES DA ROTA */}
                  {canWrite && (
                    <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant={isPending ? "default" : "outline"}
                        className={`h-8 text-xs ${isPending ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border-border text-foreground"}`}
                        onClick={() => setDebriefingSchedule(schedule)}
                      >
                        <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
                        {isPending ? "Registrar Debriefing" : "Editar Debriefing"}
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setEditingSchedule(schedule);
                          setShowAddRoute(true);
                        }}
                        aria-label="Editar rota"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeletingSchedule(schedule)}
                        aria-label="Excluir rota"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-5 text-center">
          <CalendarDays className="mx-auto h-6 w-6 text-muted-foreground/60" />
          <p className="mt-2 text-xs font-semibold text-foreground">Nenhuma rota no calendário desta panfletagem</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Adicione rotas para acompanhar horários, promotores, percursos e debriefing individual.
          </p>
          {canWrite && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 h-8 border-primary/30 text-xs text-primary hover:bg-primary/10"
              onClick={() => {
                setEditingSchedule(null);
                setShowAddRoute(true);
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Adicionar primeira rota
            </Button>
          )}
        </div>
      )}

      {/* DIÁLOGOS GERENCIADOS */}
      <ScheduleRouteDialog
        mediaCampaignId={campaignId}
        regionalId={regionalId}
        editingSchedule={editingSchedule}
        open={showAddRoute}
        onOpenChange={open => {
          setShowAddRoute(open);
          if (!open) setEditingSchedule(null);
        }}
        onSuccess={onRefresh}
      />

      <RouteDebriefDialog
        schedule={debriefingSchedule}
        open={Boolean(debriefingSchedule)}
        onOpenChange={open => {
          if (!open) setDebriefingSchedule(null);
        }}
        onSuccess={onRefresh}
      />

      <AlertDialog
        open={Boolean(deletingSchedule)}
        onOpenChange={open => {
          if (!open) setDeletingSchedule(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir rota do calendário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá a rota "{deletingSchedule?.programName}" e todos os registros e debriefing associados a ela.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteRoute.isPending}
              onClick={() => {
                if (deletingSchedule) deleteRoute.mutate({ scheduleId: deletingSchedule.id });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteRoute.isPending ? "Excluindo..." : "Excluir rota"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
