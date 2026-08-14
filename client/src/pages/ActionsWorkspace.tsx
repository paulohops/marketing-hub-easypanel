import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import EvidenceUpload from "@/components/EvidenceUpload";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardCheck,
  FolderUp,
  ImagePlus,
  MapPin,
  PackageCheck,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  UsersRound,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

type StockAllocation = { stockItemId: number; quantity: string };
type ServiceAllocation = { serviceTypeId: number; supplierOfferingId: number | null; estimatedAmount: string };
const statusLabel: Record<string, string> = {
  planned: "Planejada",
  in_progress: "Em execução",
  paused: "Pausada",
  completed: "Concluída",
  cancelled: "Cancelada",
};
const partnershipLabel: Record<string, string> = {
  paid: "Pago",
  barter: "Permuta",
  mixed: "Misto",
};
const actionStatusClass: Record<string, string> = {
  planned: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
  in_progress: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  paused: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  completed: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
  cancelled: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
};
const actionRatingClass: Record<number, string> = {
  1: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
  2: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
  3: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  4: "border-lime-200 bg-lime-50 text-lime-800 dark:border-lime-900 dark:bg-lime-950/40 dark:text-lime-300",
  5: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
};
const actionRatingLabel: Record<number, string> = {
  1: "Muito ruim",
  2: "Ruim",
  3: "Regular",
  4: "Bom",
  5: "Excelente",
};
const compactDate = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "—";
const blankForm = () => ({
  name: "",
  tradeCampaignId: "",
  eventId: "",
  cityId: "",
  actionTypeId: "",
  actionPointId: "",
  scheduledFor: "",
  endsAt: "",
  objective: "",
  address: "",
  commercialSupervisorId: "",
  partnershipType: "paid" as const,
  supplierIds: [] as number[],
  serviceTypeIds: [] as number[],
  serviceAllocations: [] as ServiceAllocation[],
  teamMemberIds: [] as number[],
  stockAllocations: [] as StockAllocation[],
});
const toDateField = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString().slice(0, 16) : "";

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível preparar a foto de capa."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

export default function ActionsWorkspace() {
  const [, setLocation] = useLocation();
  const [isDetailRoute, routeParams] = useRoute("/acoes/:actionId");
  const { can } = useEffectivePermissions();
  const canWrite = can("actions.write");
  const utils = trpc.useUtils();
  const references = trpc.actions.referenceData.useQuery();
  const actionList = trpc.actions.list.useQuery();
  const [form, setForm] = useState(blankForm);
  const [formOpen, setFormOpen] = useState(false);
  const [editingActionId, setEditingActionId] = useState<number | null>(null);
  const selectedId = isDetailRoute && routeParams?.actionId ? Number(routeParams.actionId) : null;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [regionalFilter, setRegionalFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [supervisorFilter, setSupervisorFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [statusChangeOpen, setStatusChangeOpen] = useState(false);
  const [statusChange, setStatusChange] = useState({ status: "planned", reason: "", evidenceUrls: [] as string[] });
  const [debrief, setDebrief] = useState({
    rating: "5",
    notes: "",
    positives: "",
    negatives: "",
    resultAchieved: true,
    resultSummary: "",
    leadCount: "0",
    saleCount: "0",
    renewalCount: "0",
    worthRepeating: true,
    completedAt: new Date().toISOString().slice(0, 16),
  });
  const [reschedule, setReschedule] = useState({
    scheduledFor: "",
    endsAt: "",
    reason: "",
    evidenceUrls: [] as string[],
  });
  const cities = useMemo(
    () =>
      (references.data?.cities ?? []).map((entry: any) => ({
        city: entry.city ?? entry,
        regionalName: entry.regionalName ?? "",
      })),
    [references.data]
  );
  const selectedCity = cities.find(
    ({ city }) => String(city.id) === form.cityId
  )?.city;
  const regionalOptions = useMemo(
    () =>
      Array.from(
        new Map(
          cities
            .filter(({ city, regionalName }) => city.regionalId && regionalName)
            .map(({ city, regionalName }) => [city.regionalId, regionalName])
        ).entries()
      ).map(([id, name]) => ({ id: String(id), name })),
    [cities]
  );
  const cityFilterOptions = useMemo(
    () =>
      cities.filter(
        ({ city }) =>
          regionalFilter === "all" || String(city.regionalId) === regionalFilter
      ),
    [cities, regionalFilter]
  );
  const supplierOptions = useMemo(
    () =>
      !form.cityId
        ? []
        : (references.data?.suppliers ?? [])
            .filter((supplier: any) =>
              (references.data?.supplierCities ?? []).some(
                (link: any) =>
                  link.supplierId === supplier.id &&
                  link.cityId === Number(form.cityId)
              )
            )
            .map((supplier: any) => ({
              id: supplier.id,
              label: supplier.displayName,
            })),
    [references.data, form.cityId]
  );
  const stockOptions = useMemo(
    () =>
      !selectedCity
        ? []
        : (references.data?.stockItems ?? [])
            .filter(
              (item: any) =>
                item.regionalId === selectedCity.regionalId &&
                (item.cityId === null || item.cityId === selectedCity.id)
            )
            .map((item: any) => ({
              id: item.id,
              label: item.name,
              description: `${item.sku} · ${item.unit}`,
            })),
    [references.data, selectedCity]
  );
  const pointOptions = useMemo(
    () =>
      !form.cityId
        ? []
        : (references.data?.actionPoints ?? [])
            .filter(
              (point: any) =>
                point.active && point.cityId === Number(form.cityId)
            )
            .map((point: any) => ({
              id: point.id,
              label: point.name,
              description: point.address || "Sem endereço cadastrado",
            })),
    [references.data, form.cityId]
  );
  const uploadCover = trpc.actions.uploadCover.useMutation({
    onSuccess: () => utils.actions.list.invalidate(),
    onError: error => toast.error(error.message),
  });
  const saveCover = async (actionId: number, file = coverFile) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Envie uma imagem JPEG, PNG ou WEBP para a capa.");
      return;
    }
    await uploadCover.mutateAsync({ actionId, originalName: file.name, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp", dataBase64: await fileToBase64(file) });
  };
  const create = trpc.actions.create.useMutation({
    onSuccess: async (created: any) => {
      await saveCover(created.id);
      toast.success("Ação planejada com sucesso.");
      utils.actions.list.invalidate();
      setFormOpen(false);
      setForm(blankForm());
      setCoverFile(null);
    },
    onError: error => toast.error(error.message),
  });
  const updateDetails = trpc.actions.updateDetails.useMutation({
    onSuccess: () => {
      utils.actions.list.invalidate();
      setFormOpen(false);
      setEditingActionId(null);
      setCoverFile(null);
      toast.success("Detalhes da ação atualizados.");
    },
    onError: error => toast.error(error.message),
  });
  const changeStatus = trpc.actions.updateExecutionStatus.useMutation({
    onSuccess: () => {
      utils.actions.list.invalidate();
      toast.success("Status da ação atualizado.");
    },
    onError: error => toast.error(error.message),
  });
  const saveDebrief = trpc.actions.saveDebrief.useMutation({
    onSuccess: () => {
      utils.actions.list.invalidate();
      toast.success("Debriefing salvo.");
    },
    onError: error => toast.error(error.message),
  });
  const rescheduleAction = trpc.actions.reschedule.useMutation({
    onSuccess: () => {
      utils.actions.list.invalidate();
      setRescheduleOpen(false);
      toast.success("Ação reagendada.");
    },
    onError: (error: { message: string }) => toast.error(error.message),
  });
  const visibleActions = useMemo(
    () =>
      (actionList.data ?? []).filter(
        (row: any) =>
          (status === "all" || row.action.status === status) &&
          (regionalFilter === "all" ||
            String(
              cities.find(({ city }) => city.id === row.action.cityId)?.city
                .regionalId ?? ""
            ) === regionalFilter) &&
          (cityFilter === "all" || String(row.action.cityId) === cityFilter) &&
          (supervisorFilter === "all" || String(row.action.commercialSupervisorId ?? "") === supervisorFilter) &&
          (ratingFilter === "all" || String(row.debrief?.rating ?? "") === ratingFilter) &&
          `${row.action.name} ${row.cityName} ${row.actionTypeName}`
            .toLocaleLowerCase("pt-BR")
            .includes(search.toLocaleLowerCase("pt-BR"))
      ),
    [actionList.data, search, status, regionalFilter, cityFilter, supervisorFilter, ratingFilter, cities]
  );
  const selected = (actionList.data ?? []).find(
    (row: any) => row.action.id === selectedId
  ) as any;
  useEffect(() => {
    if (!selected) return;
    const prior = selected.debrief;
    setDebrief({
      rating: String(prior?.rating ?? 5),
      notes: prior?.notes ?? "",
      positives: prior?.positives ?? "",
      negatives: prior?.negatives ?? "",
      resultAchieved: prior?.resultAchieved ?? true,
      resultSummary: prior?.resultSummary ?? "",
      leadCount: String(prior?.leadCount ?? 0),
      saleCount: String(prior?.saleCount ?? 0),
      renewalCount: String(prior?.renewalCount ?? 0),
      worthRepeating: prior?.worthRepeating ?? true,
      completedAt: toDateField(prior?.completedAt ?? new Date()),
    });
  }, [selectedId]);
  const activeFilterCount = [search, status !== "all", regionalFilter !== "all", cityFilter !== "all", supervisorFilter !== "all", ratingFilter !== "all"].filter(Boolean).length;
  const statusCounts = (actionList.data ?? []).reduce((counts: Record<string, number>, row: any) => {
    counts[row.action.status] = (counts[row.action.status] ?? 0) + 1;
    return counts;
  }, {});
  const resetFilters = () => {
    setSearch("");
    setStatus("all");
    setRegionalFilter("all");
    setCityFilter("all");
    setSupervisorFilter("all");
    setRatingFilter("all");
  };
  const openForm = () => {
    setForm(blankForm());
    setEditingActionId(null);
    setCoverFile(null);
    setFormOpen(true);
  };
  const openEdit = (row: any) => {
    setCoverFile(null);
    setForm({
      name: row.action.name,
      tradeCampaignId: row.action.tradeCampaignId ? String(row.action.tradeCampaignId) : "",
      eventId: row.action.eventId ? String(row.action.eventId) : "",
      cityId: String(row.action.cityId),
      actionTypeId: String(row.action.actionTypeId),
      actionPointId: row.action.actionPointId ? String(row.action.actionPointId) : "",
      scheduledFor: toDateField(row.action.scheduledFor),
      endsAt: toDateField(row.action.endsAt),
      objective: row.action.objective,
      address: row.action.address ?? "",
      commercialSupervisorId: row.action.commercialSupervisorId ? String(row.action.commercialSupervisorId) : "",
      partnershipType: row.action.partnershipType,
      supplierIds: (row.suppliers ?? []).map((item: any) => item.id ?? item.supplierId),
      serviceTypeIds: (row.services ?? []).map((item: any) => item.id ?? item.serviceTypeId),
      serviceAllocations: (row.services ?? []).map((item: any) => ({ serviceTypeId: item.id ?? item.serviceTypeId, supplierOfferingId: item.supplierOfferingId ?? null, estimatedAmount: String(item.estimatedAmount ?? "0") })),
      teamMemberIds: (row.teamMembers ?? []).map((item: any) => item.userId),
      stockAllocations: (row.stockItems ?? []).map((item: any) => ({ stockItemId: item.stockItemId, quantity: String(item.plannedQuantity ?? 0) })),
    });
    setEditingActionId(row.action.id);
    setFormOpen(true);
  };
  const setCity = (cityId: string) =>
    setForm(current => ({
      ...current,
      cityId,
      eventId: "",
      actionPointId: "",
      address: "",
      supplierIds: [],
      stockAllocations: [],
    }));
  const setPoint = (pointId: number | null) => {
    const point = (references.data?.actionPoints ?? []).find(
      (item: any) => item.id === pointId
    );
    setForm(current => ({
      ...current,
      actionPointId: pointId ? String(pointId) : "",
      address: point?.address ?? current.address,
    }));
  };
  const setStock = (ids: number[]) =>
    setForm(current => ({
      ...current,
      stockAllocations: ids.map(
        stockItemId =>
          current.stockAllocations.find(
            item => item.stockItemId === stockItemId
          ) ?? { stockItemId, quantity: "1" }
      ),
    }));
  const matchingOffering = (serviceTypeId: number, supplierIds: number[]) => {
    const serviceName = (references.data?.serviceTypes ?? []).find((service: any) => service.id === serviceTypeId)?.name?.toLocaleLowerCase("pt-BR") ?? "";
    return (references.data?.supplierOfferings ?? []).find((offering: any) => supplierIds.includes(offering.supplierId) && offering.name?.toLocaleLowerCase("pt-BR").includes(serviceName));
  };
  const setSuppliers = (supplierIds: number[]) =>
    setForm(current => {
      const allowedServiceIds = new Set((references.data?.supplierServiceTypes ?? []).filter((link: any) => supplierIds.includes(link.supplierId)).map((link: any) => link.serviceTypeId));
      const retainedAllocations = current.serviceAllocations.filter(allocation => allowedServiceIds.has(allocation.serviceTypeId)).map(allocation => {
        const selectedOffering = (references.data?.supplierOfferings ?? []).find((offering: any) => offering.id === allocation.supplierOfferingId && supplierIds.includes(offering.supplierId));
        const fallbackOffering = selectedOffering ?? matchingOffering(allocation.serviceTypeId, supplierIds);
        return selectedOffering ? allocation : { ...allocation, supplierOfferingId: fallbackOffering?.id ?? null, estimatedAmount: fallbackOffering ? String(fallbackOffering.unitPrice ?? 0) : allocation.estimatedAmount };
      });
      return { ...current, supplierIds, serviceTypeIds: retainedAllocations.map(allocation => allocation.serviceTypeId), serviceAllocations: retainedAllocations };
    });
  const setServices = (ids: number[]) =>
    setForm(current => ({
      ...current,
      serviceTypeIds: ids,
      serviceAllocations: ids.map(
        serviceTypeId =>
          current.serviceAllocations.find(
            item => item.serviceTypeId === serviceTypeId
          ) ?? (() => { const offering = matchingOffering(serviceTypeId, current.supplierIds); return { serviceTypeId, supplierOfferingId: offering?.id ?? null, estimatedAmount: String(offering?.unitPrice ?? 0) }; })()
      ),
    }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      name: form.name,
      tradeCampaignId: form.tradeCampaignId ? Number(form.tradeCampaignId) : null,
      eventId: form.eventId ? Number(form.eventId) : null,
      cityId: Number(form.cityId),
      actionTypeId: Number(form.actionTypeId),
      actionPointId: form.actionPointId ? Number(form.actionPointId) : null,
      scheduledFor: new Date(form.scheduledFor),
      endsAt: form.endsAt ? new Date(form.endsAt) : null,
      objective: form.objective,
      address: form.address || undefined,
      latitude: null,
      longitude: null,
      commercialSupervisorId: form.commercialSupervisorId
        ? Number(form.commercialSupervisorId)
        : null,
      partnershipType: form.partnershipType,
      supplierIds: form.supplierIds,
      serviceTypeIds: form.serviceTypeIds,
      serviceAllocations: form.serviceAllocations.map(item => ({
        serviceTypeId: item.serviceTypeId,
        supplierOfferingId: item.supplierOfferingId,
        estimatedAmount: Number(item.estimatedAmount || 0),
      })),
      teamMemberIds: form.teamMemberIds,
      stockAllocations: form.stockAllocations.map(item => ({
        stockItemId: item.stockItemId,
        quantity: Number(item.quantity),
      })),
    };
    if (editingActionId) {
      if (coverFile) void saveCover(editingActionId);
      updateDetails.mutate({ actionId: editingActionId, ...payload });
    } else {
      create.mutate(payload);
    }
  };
  if (selected)
    return (
      <>
        <ActionDetail
          row={selected}
          canWrite={canWrite}
          onBack={() => setLocation("/acoes")}
          onEdit={() => openEdit(selected)}
          onStatus={next => {
            setStatusChange({ status: next, reason: "", evidenceUrls: [] });
            setStatusChangeOpen(true);
          }}
          debrief={debrief}
          onDebriefChange={setDebrief}
          onSaveDebrief={() => saveDebrief.mutate({ actionId: selected.action.id, rating: Number(debrief.rating), notes: debrief.notes || undefined, positives: debrief.positives || undefined, negatives: debrief.negatives || undefined, resultAchieved: debrief.resultAchieved, resultSummary: debrief.resultSummary || undefined, leadCount: Number(debrief.leadCount || 0), saleCount: Number(debrief.saleCount || 0), renewalCount: Number(debrief.renewalCount || 0), worthRepeating: debrief.worthRepeating, completedAt: new Date(debrief.completedAt) })}
          debriefPending={saveDebrief.isPending}
          onReschedule={() => {
            setReschedule({
              scheduledFor: toDateField(selected.action.scheduledFor),
              endsAt: toDateField(selected.action.endsAt),
              reason: "",
              evidenceUrls: [],
            });
            setRescheduleOpen(true);
          }}
        />
        <ActionForm
          open={formOpen}
          onOpenChange={setFormOpen}
          form={form}
          setForm={setForm}
          cities={cities}
          references={references.data}
          supplierOptions={supplierOptions}
          stockOptions={stockOptions}
          pointOptions={pointOptions}
          setCity={setCity}
          setPoint={setPoint}
          setStock={setStock}
          setSuppliers={setSuppliers}
          setServices={setServices}
          submit={submit}
          pending={updateDetails.isPending}
          isEditing
          coverFile={coverFile}
          onCoverChange={setCoverFile}
          currentCoverUrl={selected.action.coverImageUrl}
        />
        <Dialog open={statusChangeOpen} onOpenChange={setStatusChangeOpen}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-1.25rem)] max-w-2xl overflow-y-auto">
            <DialogHeader><DialogTitle>Confirmar alteração de status</DialogTitle><DialogDescription>Registre o contexto operacional e os arquivos que justificam esta mudança. O registro ficará disponível no histórico da ação.</DialogDescription></DialogHeader>
            <form className="grid gap-4" onSubmit={event => { event.preventDefault(); changeStatus.mutate({ actionId: selected.action.id, status: statusChange.status as "planned" | "in_progress" | "paused" | "completed" | "cancelled", reason: statusChange.reason || undefined, evidenceUrls: statusChange.evidenceUrls }, { onSuccess: () => setStatusChangeOpen(false) }); }}>
              <label className="grid gap-1.5 text-sm font-medium">Motivo {(["paused", "cancelled"] as string[]).includes(statusChange.status) ? "(obrigatório)" : "(opcional)"}<Textarea required={["paused", "cancelled"].includes(statusChange.status)} minLength={["paused", "cancelled"].includes(statusChange.status) ? 3 : undefined} value={statusChange.reason} onChange={event => setStatusChange(current => ({ ...current, reason: event.target.value }))} placeholder="Descreva a razão da alteração de status." /></label>
              <StatusEvidenceFolder actionId={selected.action.id} canWrite={canWrite} value={statusChange.evidenceUrls} onChange={(evidenceUrls: string[]) => setStatusChange(current => ({ ...current, evidenceUrls }))} />
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setStatusChangeOpen(false)}>Voltar</Button><Button type="submit" className="bg-primary" disabled={changeStatus.isPending}>{changeStatus.isPending ? "Salvando..." : "Confirmar status"}</Button></div>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
          <DialogContent className="max-h-[90vh] w-[calc(100vw-1.25rem)] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Reagendar ação</DialogTitle>
              <DialogDescription>
                Atualize as novas datas da iniciativa. O histórico preservará a
                alteração.
              </DialogDescription>
            </DialogHeader>
            <form
              className="grid gap-4"
              onSubmit={event => {
                event.preventDefault();
                rescheduleAction.mutate({
                  actionId: selected.action.id,
                  scheduledFor: new Date(reschedule.scheduledFor),
                  endsAt: reschedule.endsAt
                    ? new Date(reschedule.endsAt)
                    : null,
                  reason: reschedule.reason,
                  evidenceUrls: reschedule.evidenceUrls,
                });
              }}
            >
              <label className="grid gap-1.5 text-sm font-medium">
                Novo início
                <Input
                  required
                  type="datetime-local"
                  value={reschedule.scheduledFor}
                  onChange={event =>
                    setReschedule({
                      ...reschedule,
                      scheduledFor: event.target.value,
                    })
                  }
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Novo término
                <Input
                  type="datetime-local"
                  value={reschedule.endsAt}
                  onChange={event =>
                    setReschedule({ ...reschedule, endsAt: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Motivo do reagendamento
                <Textarea required minLength={3} value={reschedule.reason} onChange={event => setReschedule(current => ({ ...current, reason: event.target.value }))} placeholder="Explique o motivo da nova data." />
              </label>
              <StatusEvidenceFolder actionId={selected.action.id} canWrite={canWrite} value={reschedule.evidenceUrls} onChange={(evidenceUrls: string[]) => setReschedule(current => ({ ...current, evidenceUrls }))} />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="bg-primary"
                  disabled={rescheduleAction.isPending}
                >
                  Salvar novo agendamento
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">Operação</p>
          <h1 className="font-display text-3xl font-bold text-foreground">Ações</h1>
          <p className="text-sm text-muted-foreground">
            Planeje, execute e acompanhe ativações de trade em uma ficha única.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setFiltersOpen(current => !current)} aria-expanded={filtersOpen}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filtros{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>
          {canWrite && <>
            <Button onClick={openForm} className="bg-primary">
              <Plus className="mr-2 h-4 w-4" /> Nova ação
            </Button>
          </>}
        </div>
      </header>
      {filtersOpen && <section className="space-y-4 rounded-xl border border-border bg-card p-4">
        {activeFilterCount > 0 && <div className="flex justify-end"><Button type="button" variant="ghost" size="sm" onClick={resetFilters}>Limpar filtros</Button></div>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-1.5 text-sm font-medium">
            Pesquisa
            <span className="relative min-w-0"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Ação, cidade ou tipo" className="pl-9" /></span>
          </label>
          <SearchableMultiSelect id="action-filter-regional" label="Regional" placeholder="Todas as regionais" maxSelections={1} options={regionalOptions.map(regional => ({ id: Number(regional.id), label: regional.name }))} values={regionalFilter === "all" ? [] : [Number(regionalFilter)]} onChange={values => { setRegionalFilter(values[0] ? String(values[0]) : "all"); setCityFilter("all"); }} />
          <SearchableMultiSelect id="action-filter-city" label="Cidade" placeholder="Todas as cidades" maxSelections={1} options={cityFilterOptions.map(({ city }) => ({ id: city.id, label: city.name }))} values={cityFilter === "all" ? [] : [Number(cityFilter)]} onChange={values => setCityFilter(values[0] ? String(values[0]) : "all")} />
          <SearchableMultiSelect id="action-filter-supervisor" label="Responsável" placeholder="Todos os responsáveis" maxSelections={1} options={(references.data?.supervisors ?? []).map((supervisor: any) => ({ id: supervisor.id, label: supervisor.name }))} values={supervisorFilter === "all" ? [] : [Number(supervisorFilter)]} onChange={values => setSupervisorFilter(values[0] ? String(values[0]) : "all")} />
          <SearchableMultiSelect id="action-filter-rating" label="Nota" placeholder="Todas as notas" maxSelections={1} options={[5, 4, 3, 2, 1].map(rating => ({ id: rating, label: `${rating} · ${actionRatingLabel[rating]}` }))} values={ratingFilter === "all" ? [] : [Number(ratingFilter)]} onChange={values => setRatingFilter(values[0] ? String(values[0]) : "all")} />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Situação da ação</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <Button type="button" variant={status === "all" ? "default" : "outline"} onClick={() => setStatus("all")} className="justify-between">Todas <span className="rounded bg-background/20 px-1.5 text-xs">{(actionList.data ?? []).length}</span></Button>
            {(["planned", "in_progress", "paused", "completed", "cancelled"] as const).map(value => <Button key={value} type="button" variant="outline" onClick={() => setStatus(value)} className={`justify-between ${status === value ? actionStatusClass[value] : ""}`}><span>{statusLabel[value]}</span><span className="rounded bg-background/20 px-1.5 text-xs">{statusCounts[value] ?? 0}</span></Button>)}
          </div>
        </div>
      </section>}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {actionList.isLoading ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Carregando ações…
          </p>
        ) : visibleActions.length ? (
          <div>
            {visibleActions.map((row: any) => (
              <button
                key={row.action.id}
                type="button"
                onClick={() => setLocation(`/acoes/${row.action.id}`)}
                className="grid min-h-[150px] w-full grid-cols-[72px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 border-b border-border px-4 py-5 text-left transition last:border-b-0 hover:bg-muted/40 lg:grid-cols-[76px_minmax(190px,1.15fr)_minmax(178px,.85fr)] lg:px-5 xl:grid-cols-[76px_minmax(190px,1.15fr)_minmax(165px,.76fr)_minmax(180px,.86fr)_minmax(190px,.9fr)_62px] xl:gap-x-3"
              >
                <div className="row-span-2 grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-primary/5 text-primary md:h-[76px] md:w-[76px] xl:row-span-1">
                  {row.action.coverImageUrl || row.coverImageUrl ? <img src={row.action.coverImageUrl || row.coverImageUrl} alt="" className="h-full w-full object-contain" /> : <CalendarClock className="h-6 w-6" />}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-foreground">{row.action.name}</h2>
                  <p className="mt-1 whitespace-normal break-words text-sm leading-5 text-muted-foreground">{row.action.objective || "Objetivo ainda não informado."}</p>
                </div>
                <div className="col-span-2 min-w-0 space-y-2 lg:col-span-1">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={actionStatusClass[row.action.status]}>{statusLabel[row.action.status]}</Badge><Badge variant="outline">{partnershipLabel[row.action.partnershipType]}</Badge></div>
                  <div className="flex flex-wrap gap-2"><Badge variant="secondary">{row.actionTypeName || "Tipo não informado"}</Badge><Badge variant="outline">{row.cityName || "Cidade não informada"}</Badge></div>
                </div>
                <div className="col-span-2 min-w-0 rounded-xl bg-muted/45 px-3 py-2.5 lg:col-span-1"><p className="whitespace-nowrap text-xs font-medium tabular-nums text-muted-foreground">{compactDate(row.action.scheduledFor)} — {compactDate(row.action.endsAt)}</p><p className="mt-1 truncate text-xs text-muted-foreground">{row.supervisorName || "Supervisor não definido"}</p></div>
                <div className="col-span-2 min-w-0 text-primary lg:col-span-2 xl:col-span-1"><span className="flex min-h-14 flex-col items-center justify-center rounded-lg bg-primary/8 px-2 py-1.5 text-center"><strong className="text-sm font-semibold leading-none tabular-nums">{Number(row.action.estimatedCost ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</strong><small className="mt-1 text-[10px] font-medium leading-none text-primary/80">itens e serviços</small></span></div>
                <div className="col-span-2 flex min-h-8 items-center lg:col-span-2 xl:col-span-1 xl:justify-center">{row.debrief?.rating ? <Badge variant="outline" className={`min-w-9 justify-center font-bold tabular-nums ${actionRatingClass[Number(row.debrief.rating)] ?? ""}`} title={`Nota ${row.debrief.rating}/5`}>{row.debrief.rating}</Badge> : <span className="text-[11px] text-muted-foreground">Sem nota</span>}</div>
              </button>
            ))}
          </div>
        ) : (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Nenhuma ação encontrada para os filtros selecionados.
          </p>
        )}
      </section>
      <ActionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        form={form}
        setForm={setForm}
        cities={cities}
        references={references.data}
        supplierOptions={supplierOptions}
        stockOptions={stockOptions}
        pointOptions={pointOptions}
        setCity={setCity}
        setPoint={setPoint}
        setStock={setStock}
        setSuppliers={setSuppliers}
        setServices={setServices}
        submit={submit}
        pending={create.isPending}
        coverFile={coverFile}
        onCoverChange={setCoverFile}
      />
      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Reagendar ação</DialogTitle>
            <DialogDescription>
              Atualize as novas datas da iniciativa. O histórico preservará a
              alteração.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={event => {
              event.preventDefault();
              if (selectedId)
                rescheduleAction.mutate({
                  actionId: selectedId,
                  scheduledFor: new Date(reschedule.scheduledFor),
                  endsAt: reschedule.endsAt
                    ? new Date(reschedule.endsAt)
                    : null,
                  reason: reschedule.reason,
                  evidenceUrls: reschedule.evidenceUrls,
                });
            }}
          >
            <label className="grid gap-1.5 text-sm font-medium">
              Novo início
              <Input
                required
                type="datetime-local"
                value={reschedule.scheduledFor}
                onChange={event =>
                  setReschedule({
                    ...reschedule,
                    scheduledFor: event.target.value,
                  })
                }
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Novo término
              <Input
                type="datetime-local"
                value={reschedule.endsAt}
                onChange={event =>
                  setReschedule({ ...reschedule, endsAt: event.target.value })
                }
              />
            </label>
            <div className="flex justify-end">
              <Button
                type="submit"
                className="bg-primary"
                disabled={rescheduleAction.isPending}
              >
                Salvar novo agendamento
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function StatusEvidenceFolder({
  actionId,
  canWrite,
  value,
  onChange,
}: {
  actionId: number;
  canWrite: boolean;
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const uploadEvidence = trpc.actions.uploadStatusEvidence.useMutation({
    onError: error => toast.error(error.message),
  });
  const acceptedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf", "video/mp4", "video/webm", "audio/mpeg", "audio/wav", "audio/ogg"];
  const onFileChange = async (file: File | null) => {
    if (!file) return;
    if (!acceptedTypes.includes(file.type)) {
      toast.error("Envie imagem, PDF, vídeo ou áudio em um formato compatível.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Cada evidência pode ter até 50 MB.");
      return;
    }
    const result = await uploadEvidence.mutateAsync({
      actionId,
      originalName: file.name,
      mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "application/pdf" | "video/mp4" | "video/webm" | "audio/mpeg" | "audio/wav" | "audio/ogg",
      dataBase64: await fileToBase64(file),
    });
    onChange([...value, result.url]);
  };
  return (
    <section className="rounded-xl border border-dashed border-primary/35 bg-primary/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><FolderUp className="h-4 w-4" /></div>
          <div><p className="text-sm font-semibold text-foreground">Pasta de motivo e evidências</p><p className="mt-0.5 text-xs text-muted-foreground">Arquivos exclusivos do histórico; não serão exibidos no acervo geral da ação.</p></div>
        </div>
        {canWrite && <Label htmlFor={`action-status-evidence-${actionId}`} className="flex h-9 cursor-pointer items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition hover:bg-muted">{uploadEvidence.isPending ? "Enviando..." : "Adicionar arquivo"}<Input id={`action-status-evidence-${actionId}`} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4,video/webm,audio/mpeg,audio/wav,audio/ogg" disabled={uploadEvidence.isPending} onChange={event => { void onFileChange(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} /></Label>}
      </div>
      {value.length ? <div className="mt-3 space-y-1.5">{value.map((url, index) => <div key={`${url}-${index}`} className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-background px-2.5 py-2 text-xs"><span className="truncate text-muted-foreground">Arquivo {index + 1}</span>{canWrite && <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive" onClick={() => onChange(value.filter((_, currentIndex) => currentIndex !== index))}>Remover</Button>}</div>)}</div> : null}
    </section>
  );
}

function ActionDetail({
  row,
  canWrite,
  onBack,
  onEdit,
  onStatus,
  debrief,
  onDebriefChange,
  onSaveDebrief,
  debriefPending,
  onReschedule,
}: {
  row: any;
  canWrite: boolean;
  onBack: () => void;
  onEdit: () => void;
  onStatus: (status: "planned" | "in_progress" | "paused" | "completed" | "cancelled") => void;
  debrief: any;
  onDebriefChange: (next: any) => void;
  onSaveDebrief: () => void;
  debriefPending: boolean;
  onReschedule: () => void;
}) {
  const regionalId = null;
  const [historyDetail, setHistoryDetail] = useState<any | null>(null);
  const historyPayload = historyDetail
    ? typeof historyDetail.afterData === "string"
      ? (() => { try { return JSON.parse(historyDetail.afterData); } catch { return {}; } })()
      : historyDetail.afterData ?? {}
    : {};
  const downloadHistoryEvidence = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error();
      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `evidencia-acao-${index + 1}`;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    } catch {
      toast.error("Não foi possível iniciar o download da evidência.");
    }
  };
  const historyLabel: Record<string, string> = {
    create: "Ação planejada",
    update_execution_status: "Status atualizado",
    reschedule: "Ação reagendada",
  };
  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <Button variant="outline" onClick={onBack}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para ações
      </Button>
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-primary/5 text-primary">
            {row.coverImageUrl ? <img src={row.coverImageUrl} alt={`Capa de ${row.action.name}`} className="h-full w-full object-contain" /> : <CalendarClock className="h-7 w-7" />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={actionStatusClass[row.action.status]}>{statusLabel[row.action.status]}</Badge>
              <Badge variant="outline">{partnershipLabel[row.action.partnershipType]}</Badge>
            </div>
            <h1 className="mt-2 break-words font-display text-3xl font-bold text-foreground">{row.action.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{row.action.objective || "Objetivo ainda não informado."}</p>
          </div>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button variant="outline" onClick={onEdit}>
                Editar ação
            </Button>
            <Button variant="outline" onClick={onReschedule}>
                Reagendar
            </Button>
            <label className="flex items-center gap-2 rounded-lg border border-border bg-background px-2 text-xs font-medium text-muted-foreground">
              Status
              <select value={row.action.status} onChange={event => onStatus(event.target.value as "planned" | "in_progress" | "paused" | "completed" | "cancelled")} className="h-8 bg-transparent text-sm font-medium text-foreground outline-none">
                <option value="planned">Planejada</option><option value="in_progress">Em execução</option><option value="paused">Pausada</option><option value="completed">Concluída</option><option value="cancelled">Cancelada</option>
              </select>
            </label>
          </div>
        )}
      </header>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-border bg-card p-4">
          <DetailSection title="Planejamento e local">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailValue
                icon={<MapPin className="h-4 w-4" />}
                label="Localização"
                value={
                  row.actionPointName
                    ? `${row.actionPointName}${row.action.address ? ` · ${row.action.address}` : ""}`
                    : row.action.address || "Não informada"
                }
              />
              <DetailValue
                label="Período"
                value={`${new Date(row.action.scheduledFor).toLocaleString("pt-BR")}${row.action.endsAt ? ` até ${new Date(row.action.endsAt).toLocaleString("pt-BR")}` : ""}`}
              />
              <DetailValue
                label="Tipo de ação"
                value={row.actionTypeName || "Não informado"}
              />
              <DetailValue
                label="Cidade"
                value={row.cityName || "Não informada"}
              />
              <DetailValue
                label="Supervisor"
                value={row.supervisorName || "Não definido"}
              />
              <DetailValue
                label="Evento de contexto"
                value={row.eventName || "Ação independente de evento"}
              />
            </div>
          </DetailSection>
        </section>
        <section className="min-w-0 rounded-xl border border-border bg-card p-4">
          <DetailSection title="Contexto comercial">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailValue label="Modalidade" value={partnershipLabel[row.action.partnershipType]} />
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-xs font-semibold text-muted-foreground">Campanha</p>
                <div className="mt-2 flex min-w-0 items-center gap-3">
                  {row.campaignLogoUrl ? <div className="grid h-12 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-background"><img src={row.campaignLogoUrl} alt={`Identidade visual da campanha ${row.campaignName ?? ""}`} className="h-full w-full object-contain" /></div> : null}
                  <p className="min-w-0 break-words text-sm text-foreground">{row.campaignName || "Ação sem campanha vinculada"}</p>
                </div>
              </div>
            </div>
          </DetailSection>
        </section>
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2"><DetailSection title="Responsáveis e fornecedores"><div className="grid gap-3 md:grid-cols-2"><div className="rounded-xl bg-muted/50 p-3"><p className="mb-3 flex items-center gap-1 text-xs font-semibold text-muted-foreground"><UsersRound className="h-4 w-4" /> Responsáveis do trade</p>{row.teamMembers?.length ? <div className="grid gap-2 sm:grid-cols-2">{row.teamMembers.map((member: any) => <div key={member.userId} className="flex min-w-0 items-center gap-2 rounded-lg bg-background p-2"><div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-xs font-bold text-primary">{member.avatarUrl ? <img src={member.avatarUrl} alt="" className="h-full w-full object-contain" /> : (member.name || "U").slice(0, 1)}</div><div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{member.name || `Usuário #${member.userId}`}</p><p className="truncate text-xs text-muted-foreground">{member.jobTitle || "Colaborador"}</p></div></div>)}</div> : <p className="text-sm text-muted-foreground">Nenhum responsável definido.</p>}</div><DetailValue label="Fornecedores envolvidos" value={row.suppliers?.length ? row.suppliers.map((supplier: any) => supplier.name).join(", ") : "Não informados"} /></div></DetailSection></section>
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2"><DetailSection title="Serviços"><div className="space-y-2">{row.services?.length ? row.services.map((service: any) => <div key={service.serviceTypeId} className="grid gap-2 rounded-xl bg-muted/50 p-3 sm:grid-cols-[minmax(0,1fr)_auto]"><div><p className="font-medium text-foreground">{service.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{service.supplierName || "Fornecedor não vinculado"}{service.offeringName ? ` · ${service.offeringName}` : ""}{service.unit ? ` · ${service.unit}` : ""}</p></div><strong className="text-sm tabular-nums text-primary">{Number(service.estimatedAmount ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>) : <p className="text-sm text-muted-foreground">Nenhum serviço planejado.</p>}</div>{row.services?.length ? <div className="mt-3 flex justify-end border-t border-border pt-3"><span className="text-sm font-semibold text-foreground">Total dos serviços: <strong className="text-primary">{Number((row.services ?? []).reduce((total: number, service: any) => total + Number(service.estimatedAmount ?? 0), 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></span></div> : null}</DetailSection></section>
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2"><DetailSection title="Recursos de estoque"><div className="grid gap-2 sm:grid-cols-2">{row.stockItems?.length ? row.stockItems.map((item: any) => <div key={item.stockItemId} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 p-3"><div className="min-w-0"><p className="truncate font-medium text-foreground">{item.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.sku || "Sem SKU"} · {item.unit}</p></div><strong className="shrink-0 text-sm tabular-nums text-primary">{item.plannedQuantity} {item.unit}</strong></div>) : <p className="text-sm text-muted-foreground">Nenhum recurso de estoque planejado.</p>}</div></DetailSection></section>
        <section className="rounded-xl border border-border bg-card p-4">
          <DetailSection title="Debriefing e resultado">
            <form onSubmit={event => { event.preventDefault(); onSaveDebrief(); }} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-[126px_minmax(0,1fr)]">
                <div className="grid content-start gap-2 rounded-xl border border-border bg-muted/25 p-3"><p className="text-xs font-semibold text-muted-foreground">Nota geral</p><strong className="text-2xl font-semibold tabular-nums text-foreground">{debrief.rating}</strong><Badge variant="outline" className={`w-fit text-[10px] ${actionRatingClass[Number(debrief.rating)] ?? ""}`}>{debrief.rating}/5 · {actionRatingLabel[Number(debrief.rating)] ?? "Avaliação"}</Badge><select aria-label="Nota geral" value={debrief.rating} onChange={event => onDebriefChange({ ...debrief, rating: event.target.value })} className="control h-8 text-xs">{[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} · {actionRatingLabel[value]}</option>)}</select></div>
                <div className="grid gap-3"><label className="grid gap-1 text-xs font-semibold text-muted-foreground">História e resultado da ação<Textarea className="min-h-24" value={debrief.resultSummary} onChange={event => onDebriefChange({ ...debrief, resultSummary: event.target.value })} placeholder="Contexto, resultado alcançado e impacto percebido" /></label><label className="grid gap-1 text-xs font-semibold text-muted-foreground">Avaliação e aprendizados<Textarea className="min-h-24" value={debrief.notes} onChange={event => onDebriefChange({ ...debrief, notes: event.target.value })} placeholder="O que funcionou e o que deve ser aprimorado" /></label></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3"><label className="grid gap-1 text-xs font-semibold text-muted-foreground">Leads<Input type="number" min="0" value={debrief.leadCount} onChange={event => onDebriefChange({ ...debrief, leadCount: event.target.value })} /></label><label className="grid gap-1 text-xs font-semibold text-muted-foreground">Vendas<Input type="number" min="0" value={debrief.saleCount} onChange={event => onDebriefChange({ ...debrief, saleCount: event.target.value })} /></label><label className="grid gap-1 text-xs font-semibold text-muted-foreground">Renovações<Input type="number" min="0" value={debrief.renewalCount} onChange={event => onDebriefChange({ ...debrief, renewalCount: event.target.value })} /></label></div>
              <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs font-semibold text-muted-foreground">Pontos positivos<Textarea value={debrief.positives} onChange={event => onDebriefChange({ ...debrief, positives: event.target.value })} /></label><label className="grid gap-1 text-xs font-semibold text-muted-foreground">Pontos a melhorar<Textarea value={debrief.negatives} onChange={event => onDebriefChange({ ...debrief, negatives: event.target.value })} /></label></div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={debrief.resultAchieved} onChange={event => onDebriefChange({ ...debrief, resultAchieved: event.target.checked })} /> Objetivo atingido</label><label className="flex items-center gap-2"><input type="checkbox" checked={debrief.worthRepeating} onChange={event => onDebriefChange({ ...debrief, worthRepeating: event.target.checked })} /> Vale repetir</label><label className="ml-auto grid gap-1 text-xs font-semibold text-muted-foreground">Concluída em<Input type="datetime-local" required value={debrief.completedAt} onChange={event => onDebriefChange({ ...debrief, completedAt: event.target.value })} /></label></div>
              {canWrite && <Button type="submit" className="w-full bg-primary" disabled={debriefPending}>Salvar debriefing</Button>}
            </form>
          </DetailSection>
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <DetailSection title="Fotos, vídeos e evidências">
            <EvidenceUpload entityType="action" entityId={row.action.id} regionalId={regionalId} canWrite={canWrite} variant="side" />
          </DetailSection>
        </section>
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <DetailSection title="Histórico da ação">
            {row.history?.length ? (
              <div className="space-y-3">
                {row.history.map((entry: any, index: number) => (
                  <div
                    key={entry.id ?? `${entry.auditAction}-${entry.occurredAt}-${index}`}
                    className="border-l-2 border-primary/30 pl-3"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {historyLabel[entry.auditAction] ??
                        "Atualização registrada"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(entry.occurredAt).toLocaleString("pt-BR")}
                      {entry.actorName ? ` · ${entry.actorName}` : ""}
                    </p>
                    {(entry.afterData?.reason || entry.afterData?.evidenceUrls?.length || typeof entry.afterData === "string") && <Button type="button" variant="link" className="mt-1 h-auto px-0 text-xs text-primary" onClick={() => setHistoryDetail(entry)}>Ver motivo e evidências</Button>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ainda não há movimentações registradas.
              </p>
            )}
          </DetailSection>
        </section>
      </div>
      <Dialog open={Boolean(historyDetail)} onOpenChange={open => !open && setHistoryDetail(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1.25rem)] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>Motivo e evidências da alteração</DialogTitle><DialogDescription>{historyDetail ? `${historyLabel[historyDetail.auditAction] ?? "Atualização registrada"} em ${new Date(historyDetail.occurredAt).toLocaleString("pt-BR")}` : ""}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><p className="text-xs font-semibold text-muted-foreground">Motivo informado</p><p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{historyPayload.reason || "Nenhum motivo registrado para esta alteração."}</p></div>
            {Array.isArray(historyPayload.evidenceUrls) && historyPayload.evidenceUrls.length ? <div><p className="mb-2 text-xs font-semibold text-muted-foreground">Evidências anexadas</p><div className="grid gap-3 sm:grid-cols-2">{historyPayload.evidenceUrls.map((url: string, index: number) => { const normalizedUrl = url.toLowerCase(); const isVideo = /\.(mp4|webm)(?:\?|$)/.test(normalizedUrl); const isAudio = /\.(mp3|wav)(?:\?|$)/.test(normalizedUrl); const isDocument = /\.pdf(?:\?|$)/.test(normalizedUrl); return <div key={`${url}-${index}`} className="overflow-hidden rounded-lg border border-border bg-muted/30">{isVideo ? <video controls preload="metadata" className="max-h-44 w-full bg-black"><source src={url} /></video> : isAudio ? <audio controls className="m-3 w-[calc(100%-1.5rem)]"><source src={url} /></audio> : isDocument ? <iframe title={`Evidência ${index + 1}`} src={url} className="h-44 w-full bg-background" /> : <img src={url} alt={`Evidência ${index + 1}`} className="max-h-44 w-full object-contain" />}<div className="border-t border-border p-2"><Button type="button" variant="outline" size="sm" onClick={() => void downloadHistoryEvidence(url, index)}>Baixar arquivo</Button></div></div>; })}</div></div> : null}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="font-semibold text-foreground">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}
function DetailValue({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}
function ActionForm({
  open,
  onOpenChange,
  form,
  setForm,
  cities,
  references,
  supplierOptions,
  stockOptions,
  pointOptions,
  setCity,
  setPoint,
  setStock,
  setSuppliers,
  setServices,
  submit,
  pending,
  isEditing = false,
  coverFile,
  onCoverChange,
  currentCoverUrl,
}: any) {
  const selectedSupplierOfferings = (references?.supplierOfferings ?? []).filter((offering: any) => form.supplierIds.includes(offering.supplierId));
  const availableServiceTypeIds = new Set((references?.supplierServiceTypes ?? []).filter((link: any) => form.supplierIds.includes(link.supplierId)).map((link: any) => link.serviceTypeId));
  const serviceOptions = (references?.serviceTypes ?? []).filter((service: any) => availableServiceTypeIds.has(service.id)).map((service: any) => ({ id: service.id, label: service.name }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-7xl overflow-y-auto p-4 sm:w-[calc(100vw-2rem)] sm:p-6">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar ação" : "Planejar nova ação"}</DialogTitle>
          <DialogDescription>
            Escolha a cidade primeiro. Fornecedores, pontos e recursos abaixo
            passam a mostrar somente opções compatíveis.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-3 md:col-span-2 sm:flex-row sm:items-center">
            {(coverFile || currentCoverUrl) ? <img src={coverFile ? URL.createObjectURL(coverFile) : currentCoverUrl} alt="Capa da ação" className="h-20 w-full rounded-lg bg-background object-cover sm:w-32" /> : <div className="flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-border bg-background text-xs text-muted-foreground sm:w-32">Sem capa</div>}
            <div className="grid flex-1 gap-2"><p className="text-sm font-medium text-foreground">Foto de capa</p><Label htmlFor="action-cover-upload" className="flex h-10 w-fit cursor-pointer items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"><ImagePlus className="h-4 w-4" />{coverFile ? "Trocar imagem de capa" : "Subir imagem de capa"}<Input id="action-cover-upload" type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={event => onCoverChange(event.target.files?.[0] ?? null)} /></Label><span className="text-xs text-muted-foreground">JPEG, PNG ou WEBP. A capa identifica a ação na ficha.</span></div>
          </div>
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            Nome da ação
            <Input
              required
              value={form.name}
              onChange={event => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <SearchableMultiSelect
            id="action-campaign"
            label="Campanha"
            options={(references?.campaigns ?? []).map((item: any) => ({ id: item.id, label: item.name, description: item.status === "active" ? "Em andamento" : undefined }))}
            values={form.tradeCampaignId ? [Number(form.tradeCampaignId)] : []}
            onChange={ids => setForm({ ...form, tradeCampaignId: ids[0] ? String(ids[0]) : "" })}
            maxSelections={1}
            placeholder="Sem campanha vinculada"
          />
          <SearchableMultiSelect
            id="action-event"
            label="Evento de contexto"
            options={(Array.isArray(references?.events) ? references.events : []).filter((item: any) => item.status !== "cancelled" && (!form.cityId || item.cityId === Number(form.cityId)) && (!form.tradeCampaignId || !item.tradeCampaignId || item.tradeCampaignId === Number(form.tradeCampaignId))).map((item: any) => ({ id: item.id, label: item.name, description: item.startsAt ? `Evento em ${new Date(item.startsAt).toLocaleDateString("pt-BR")}` : undefined }))}
            values={form.eventId ? [Number(form.eventId)] : []}
            onChange={ids => setForm({ ...form, eventId: ids[0] ? String(ids[0]) : "" })}
            maxSelections={1}
            placeholder="Ação independente de evento"
          />
          <SearchableMultiSelect
            id="action-city"
            label="Cidade"
            options={cities.map(({ city, regionalName }: any) => ({ id: city.id, label: city.name, description: `${regionalName} · ${city.state}` }))}
            values={form.cityId ? [Number(form.cityId)] : []}
            onChange={ids => setCity(ids[0] ? String(ids[0]) : "")}
            maxSelections={1}
            placeholder="Selecionar cidade"
          />
          <SearchableMultiSelect
            id="action-type"
            label="Tipo de ação"
            options={(references?.actionTypes ?? []).map((item: any) => ({ id: item.id, label: item.name }))}
            values={form.actionTypeId ? [Number(form.actionTypeId)] : []}
            onChange={ids => setForm({ ...form, actionTypeId: ids[0] ? String(ids[0]) : "" })}
            maxSelections={1}
            placeholder="Selecionar tipo"
          />
          <SearchableMultiSelect
            id="action-supervisor"
            label="Supervisor responsável"
            options={(references?.supervisors ?? []).map((item: any) => ({ id: item.id, label: item.name }))}
            values={form.commercialSupervisorId ? [Number(form.commercialSupervisorId)] : []}
            onChange={ids => setForm({ ...form, commercialSupervisorId: ids[0] ? String(ids[0]) : "" })}
            maxSelections={1}
            placeholder="Não definido"
          />
          <label className="grid gap-1.5 text-sm font-medium">
            Início
            <Input
              required
              type="datetime-local"
              value={form.scheduledFor}
              onChange={event =>
                setForm({ ...form, scheduledFor: event.target.value })
              }
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Término
            <Input
              type="datetime-local"
              value={form.endsAt}
              onChange={event =>
                setForm({ ...form, endsAt: event.target.value })
              }
            />
          </label>
          <SearchableMultiSelect id="action-modality" label="Modalidade" options={[{ id: 1, label: "Pago" }, { id: 2, label: "Permuta" }, { id: 3, label: "Misto" }]} values={[form.partnershipType === "paid" ? 1 : form.partnershipType === "barter" ? 2 : 3]} onChange={ids => setForm({ ...form, partnershipType: ({ 1: "paid", 2: "barter", 3: "mixed" } as Record<number, string>)[ids[0]] ?? "paid" })} maxSelections={1} placeholder="Selecionar modalidade" />
          <div className="md:col-span-2">
            <SearchableMultiSelect
              id="action-point"
              label="Ponto comercial ou local de ação"
              options={pointOptions}
              values={form.actionPointId ? [Number(form.actionPointId)] : []}
              onChange={ids => setPoint(ids.at(-1) ?? null)}
              maxSelections={1}
              disabled={!form.cityId}
              placeholder="Selecionar ponto cadastrado"
            />
          </div>
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            Endereço e referência
            <Textarea
              value={form.address}
              onChange={event =>
                setForm({ ...form, address: event.target.value })
              }
              placeholder="Preenchido automaticamente pelo ponto selecionado, se houver."
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            Objetivo
            <Textarea
              required
              value={form.objective}
              onChange={event =>
                setForm({ ...form, objective: event.target.value })
              }
            />
          </label>
          <SearchableMultiSelect
            id="action-team"
            label="Responsáveis do trade"
            options={(references?.teamUsers ?? []).map((item: any) => ({
              id: item.id,
              label: item.name || item.email || `Usuário #${item.id}`,
              description: item.jobTitle || undefined,
            }))}
            values={form.teamMemberIds}
            onChange={ids => setForm({ ...form, teamMemberIds: ids })}
          />
          <SearchableMultiSelect
            id="action-suppliers"
            label="Fornecedores envolvidos"
            options={supplierOptions}
            values={form.supplierIds}
            onChange={setSuppliers}
            disabled={!form.cityId}
            emptyMessage="Nenhum fornecedor atende esta cidade."
          />
          <SearchableMultiSelect
            id="action-services"
            label="Serviços oferecidos"
            options={serviceOptions}
            values={form.serviceTypeIds}
            onChange={setServices}
            disabled={!form.supplierIds.length}
            emptyMessage="Selecione um fornecedor que ofereça serviços para esta ação."
          />
          <SearchableMultiSelect
            id="action-stock"
            label="Recursos de estoque"
            options={stockOptions}
            values={form.stockAllocations.map(
              (item: StockAllocation) => item.stockItemId
            )}
            onChange={setStock}
            disabled={!form.cityId}
            emptyMessage="Nenhum recurso disponível para esta cidade."
          />
          {form.serviceAllocations.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/50 p-4 md:col-span-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-semibold">Serviços e valores previstos</p><p className="text-xs text-muted-foreground">O valor de referência é trazido da oferta do fornecedor e pode ser ajustado para descontos.</p></div>
              <div className="mt-3 space-y-2">
                {form.serviceAllocations.map((allocation: ServiceAllocation) => {
                  const service = (references?.serviceTypes ?? []).find((item: any) => item.id === allocation.serviceTypeId);
                  return <div key={allocation.serviceTypeId} className="grid gap-3 rounded-lg border border-border bg-background p-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,1.2fr)_150px] sm:items-end"><div className="min-w-0"><p className="text-sm font-medium text-foreground">{service?.name ?? "Serviço"}</p><p className="mt-1 text-xs text-muted-foreground">Fornecedor e valor aplicado à previsão.</p></div><label className="grid gap-1 text-xs font-medium text-muted-foreground">Oferta do fornecedor<select className="control h-9" value={allocation.supplierOfferingId ?? ""} onChange={event => { const offering = selectedSupplierOfferings.find((item: any) => item.id === Number(event.target.value)); setForm({ ...form, serviceAllocations: form.serviceAllocations.map((current: ServiceAllocation) => current.serviceTypeId === allocation.serviceTypeId ? { ...current, supplierOfferingId: offering?.id ?? null, estimatedAmount: offering ? String(offering.unitPrice ?? 0) : current.estimatedAmount } : current) }); }}><option value="">Selecionar oferta</option>{selectedSupplierOfferings.map((offering: any) => <option key={offering.id} value={offering.id}>{offering.name}{offering.unit ? ` (${offering.unit})` : ""}</option>)}</select></label><label className="grid gap-1 text-xs font-medium text-muted-foreground">Valor aplicado<Input type="number" min="0" step="0.01" value={allocation.estimatedAmount} onChange={event => setForm({ ...form, serviceAllocations: form.serviceAllocations.map((current: ServiceAllocation) => current.serviceTypeId === allocation.serviceTypeId ? { ...current, estimatedAmount: event.target.value } : current) })} /></label></div>;
                })}
              </div>
              <div className="mt-3 flex justify-end border-t border-border pt-3 text-sm font-semibold text-foreground">Total previsto: <strong className="ml-1 text-primary">{form.serviceAllocations.reduce((total: number, item: ServiceAllocation) => total + Number(item.estimatedAmount || 0), 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></div>
            </div>
          )}
          {form.stockAllocations.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/50 p-4 md:col-span-2">
              <p className="text-sm font-semibold">
                Quantidade planejada por recurso
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {form.stockAllocations.map((allocation: StockAllocation) => {
                  const item = stockOptions.find(
                    (option: { id: number }) =>
                      option.id === allocation.stockItemId
                  );
                  return (
                    <label
                      key={allocation.stockItemId}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {item?.label}
                      </span>
                      <Input
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={allocation.quantity}
                        onChange={event =>
                          setForm((current: any) => ({
                            ...current,
                            stockAllocations: current.stockAllocations.map(
                              (row: StockAllocation) =>
                                row.stockItemId === allocation.stockItemId
                                  ? { ...row, quantity: event.target.value }
                                  : row
                            ),
                          }))
                        }
                        className="w-24"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary" disabled={pending}>
              {isEditing ? "Salvar alterações" : "Planejar ação"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
