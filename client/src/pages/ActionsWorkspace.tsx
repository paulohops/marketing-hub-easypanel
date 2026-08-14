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
  MapPin,
  PackageCheck,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  UsersRound,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

type StockAllocation = { stockItemId: number; quantity: string };
type ServiceAllocation = { serviceTypeId: number; estimatedAmount: string };
const statusLabel: Record<string, string> = {
  planned: "Planejada",
  in_progress: "Em execução",
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
  estimatedCost: "0",
  supplierIds: [] as number[],
  serviceTypeIds: [] as number[],
  serviceAllocations: [] as ServiceAllocation[],
  teamMemberIds: [] as number[],
  stockAllocations: [] as StockAllocation[],
});
const toDateField = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString().slice(0, 16) : "";

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
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ name: "", objective: "", regionalId: "", startsAt: "", endsAt: "", status: "scheduled" as "scheduled" | "active" | "completed" | "cancelled" });
  const [editingActionId, setEditingActionId] = useState<number | null>(null);
  const selectedId = isDetailRoute && routeParams?.actionId ? Number(routeParams.actionId) : null;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [regionalFilter, setRegionalFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [debriefOpen, setDebriefOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
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
  const create = trpc.actions.create.useMutation({
    onSuccess: () => {
      toast.success("Ação planejada com sucesso.");
      utils.actions.list.invalidate();
      setFormOpen(false);
      setForm(blankForm());
    },
    onError: error => toast.error(error.message),
  });
  const updateDetails = trpc.actions.updateDetails.useMutation({
    onSuccess: () => {
      utils.actions.list.invalidate();
      setFormOpen(false);
      setEditingActionId(null);
      toast.success("Detalhes da ação atualizados.");
    },
    onError: error => toast.error(error.message),
  });
  const createCampaign = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      utils.actions.referenceData.invalidate();
      utils.campaigns.list.invalidate();
      setCampaignOpen(false);
      setCampaignForm({ name: "", objective: "", regionalId: "", startsAt: "", endsAt: "", status: "scheduled" });
      toast.success("Campanha criada. Agora você pode vincular ações, eventos e mídias.");
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
      setDebriefOpen(false);
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
          `${row.action.name} ${row.cityName} ${row.actionTypeName}`
            .toLocaleLowerCase("pt-BR")
            .includes(search.toLocaleLowerCase("pt-BR"))
      ),
    [actionList.data, search, status, regionalFilter, cityFilter, cities]
  );
  const selected = (actionList.data ?? []).find(
    (row: any) => row.action.id === selectedId
  ) as any;
  const activeFilterCount = [search, status !== "all", regionalFilter !== "all", cityFilter !== "all"].filter(Boolean).length;
  const statusCounts = (actionList.data ?? []).reduce((counts: Record<string, number>, row: any) => {
    counts[row.action.status] = (counts[row.action.status] ?? 0) + 1;
    return counts;
  }, {});
  const resetFilters = () => {
    setSearch("");
    setStatus("all");
    setRegionalFilter("all");
    setCityFilter("all");
  };
  const openForm = () => {
    setForm(blankForm());
    setEditingActionId(null);
    setFormOpen(true);
  };
  const openEdit = (row: any) => {
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
      estimatedCost: String(row.action.estimatedCost ?? "0"),
      supplierIds: (row.suppliers ?? []).map((item: any) => item.id ?? item.supplierId),
      serviceTypeIds: (row.services ?? []).map((item: any) => item.id ?? item.serviceTypeId),
      serviceAllocations: (row.services ?? []).map((item: any) => ({ serviceTypeId: item.id ?? item.serviceTypeId, estimatedAmount: String(item.estimatedAmount ?? "0") })),
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
  const setServices = (ids: number[]) =>
    setForm(current => ({
      ...current,
      serviceTypeIds: ids,
      serviceAllocations: ids.map(
        serviceTypeId =>
          current.serviceAllocations.find(
            item => item.serviceTypeId === serviceTypeId
          ) ?? { serviceTypeId, estimatedAmount: "0" }
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
      estimatedCost: Number(form.estimatedCost),
      supplierIds: form.supplierIds,
      serviceTypeIds: form.serviceTypeIds,
      serviceAllocations: form.serviceAllocations.map(item => ({
        serviceTypeId: item.serviceTypeId,
        estimatedAmount: Number(item.estimatedAmount || 0),
      })),
      teamMemberIds: form.teamMemberIds,
      stockAllocations: form.stockAllocations.map(item => ({
        stockItemId: item.stockItemId,
        quantity: Number(item.quantity),
      })),
    };
    if (editingActionId) {
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
          onStatus={next =>
            changeStatus.mutate({ actionId: selected.action.id, status: next })
          }
          onDebrief={() => {
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
            setDebriefOpen(true);
          }}
          onReschedule={() => {
            setReschedule({
              scheduledFor: toDateField(selected.action.scheduledFor),
              endsAt: toDateField(selected.action.endsAt),
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
          setServices={setServices}
          submit={submit}
          pending={updateDetails.isPending}
          isEditing
        />
        <Dialog open={debriefOpen} onOpenChange={setDebriefOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Debriefing da ação</DialogTitle>
              <DialogDescription>
                Registre o resultado, os aprendizados e a recomendação para
                próximas iniciativas.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={event => {
                event.preventDefault();
                saveDebrief.mutate({
                  actionId: selected.action.id,
                  rating: Number(debrief.rating),
                  notes: debrief.notes || undefined,
                  positives: debrief.positives || undefined,
                  negatives: debrief.negatives || undefined,
                  resultAchieved: debrief.resultAchieved,
                  resultSummary: debrief.resultSummary || undefined,
                  leadCount: Number(debrief.leadCount || 0),
                  saleCount: Number(debrief.saleCount || 0),
                  renewalCount: Number(debrief.renewalCount || 0),
                  worthRepeating: debrief.worthRepeating,
                  completedAt: new Date(debrief.completedAt),
                });
              }}
              className="grid gap-4 md:grid-cols-2"
            >
              <label className="grid gap-1.5 text-sm font-medium">
                Nota
                <select
                  value={debrief.rating}
                  onChange={event =>
                    setDebrief({ ...debrief, rating: event.target.value })
                  }
                  className="control"
                >
                  {[5, 4, 3, 2, 1].map(value => (
                    <option key={value} value={value}>
                      {value} estrelas
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Concluída em
                <Input
                  type="datetime-local"
                  required
                  value={debrief.completedAt}
                  onChange={event =>
                    setDebrief({ ...debrief, completedAt: event.target.value })
                  }
                />
              </label>
              <Textarea
                className="md:col-span-2"
                placeholder="Síntese e aprendizados"
                value={debrief.notes}
                onChange={event =>
                  setDebrief({ ...debrief, notes: event.target.value })
                }
              />
              <Textarea
                className="md:col-span-2"
                placeholder="Resultado alcançado e impacto percebido"
                value={debrief.resultSummary}
                onChange={event =>
                  setDebrief({ ...debrief, resultSummary: event.target.value })
                }
              />
              <label className="grid gap-1.5 text-sm font-medium">
                Leads gerados
                <Input type="number" min="0" value={debrief.leadCount} onChange={event => setDebrief({ ...debrief, leadCount: event.target.value })} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Vendas realizadas
                <Input type="number" min="0" value={debrief.saleCount} onChange={event => setDebrief({ ...debrief, saleCount: event.target.value })} />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Renovações
                <Input type="number" min="0" value={debrief.renewalCount} onChange={event => setDebrief({ ...debrief, renewalCount: event.target.value })} />
              </label>
              <Textarea
                placeholder="Pontos positivos"
                value={debrief.positives}
                onChange={event =>
                  setDebrief({ ...debrief, positives: event.target.value })
                }
              />
              <Textarea
                placeholder="Pontos a melhorar"
                value={debrief.negatives}
                onChange={event =>
                  setDebrief({ ...debrief, negatives: event.target.value })
                }
              />
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={debrief.resultAchieved}
                  onChange={event =>
                    setDebrief({
                      ...debrief,
                      resultAchieved: event.target.checked,
                    })
                  }
                />
                Objetivo atingido
              </label>
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={debrief.worthRepeating}
                  onChange={event =>
                    setDebrief({
                      ...debrief,
                      worthRepeating: event.target.checked,
                    })
                  }
                />
                Vale repetir
              </label>
              <div className="flex justify-end md:col-span-2">
                <Button
                  type="submit"
                  className="bg-primary"
                  disabled={saveDebrief.isPending}
                >
                  Salvar debriefing
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
                rescheduleAction.mutate({
                  actionId: selected.action.id,
                  scheduledFor: new Date(reschedule.scheduledFor),
                  endsAt: reschedule.endsAt
                    ? new Date(reschedule.endsAt)
                    : null,
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
            <Button variant="outline" onClick={() => setCampaignOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nova campanha
            </Button>
            <Button onClick={openForm} className="bg-primary">
              <Plus className="mr-2 h-4 w-4" /> Nova ação
            </Button>
          </>}
        </div>
      </header>
      <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova campanha de trade</DialogTitle>
            <DialogDescription>Organize ações, eventos e mídias correlatas em um único planejamento.</DialogDescription>
          </DialogHeader>
          <form onSubmit={event => { event.preventDefault(); createCampaign.mutate({ name: campaignForm.name, objective: campaignForm.objective || undefined, regionalId: campaignForm.regionalId ? Number(campaignForm.regionalId) : null, startsAt: campaignForm.startsAt ? new Date(campaignForm.startsAt) : null, endsAt: campaignForm.endsAt ? new Date(campaignForm.endsAt) : null, status: campaignForm.status }); }} className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">Nome da campanha<Input required value={campaignForm.name} onChange={event => setCampaignForm(current => ({ ...current, name: event.target.value }))} placeholder="Ex.: Expansão Primavera" /></label>
            <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">Objetivo<Textarea value={campaignForm.objective} onChange={event => setCampaignForm(current => ({ ...current, objective: event.target.value }))} placeholder="Objetivo comercial e público prioritário" /></label>
            <label className="grid gap-1.5 text-sm font-medium">Regional<select className="control" value={campaignForm.regionalId} onChange={event => setCampaignForm(current => ({ ...current, regionalId: event.target.value }))}><option value="">Todas as regionais</option>{regionalOptions.map(regional => <option key={regional.id} value={regional.id}>{regional.name}</option>)}</select></label>
            <label className="grid gap-1.5 text-sm font-medium">Situação<select className="control" value={campaignForm.status} onChange={event => setCampaignForm(current => ({ ...current, status: event.target.value as typeof campaignForm.status }))}><option value="scheduled">Planejada</option><option value="active">Ativa</option><option value="completed">Concluída</option><option value="cancelled">Cancelada</option></select></label>
            <label className="grid gap-1.5 text-sm font-medium">Início<Input type="date" value={campaignForm.startsAt} onChange={event => setCampaignForm(current => ({ ...current, startsAt: event.target.value }))} /></label>
            <label className="grid gap-1.5 text-sm font-medium">Término<Input type="date" value={campaignForm.endsAt} onChange={event => setCampaignForm(current => ({ ...current, endsAt: event.target.value }))} /></label>
            <div className="flex justify-end gap-2 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setCampaignOpen(false)}>Cancelar</Button><Button type="submit" className="bg-primary" disabled={createCampaign.isPending}>{createCampaign.isPending ? "Salvando…" : "Criar campanha"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
      {filtersOpen && <section className="space-y-4 rounded-xl border border-border bg-card p-4">
        {activeFilterCount > 0 && <div className="flex justify-end"><Button type="button" variant="ghost" size="sm" onClick={resetFilters}>Limpar filtros</Button></div>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium">
            Pesquisa
            <span className="relative min-w-0"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Ação, cidade ou tipo" className="pl-9" /></span>
          </label>
          <SearchableMultiSelect id="action-filter-regional" label="Regional" placeholder="Todas as regionais" maxSelections={1} options={regionalOptions.map(regional => ({ id: Number(regional.id), label: regional.name }))} values={regionalFilter === "all" ? [] : [Number(regionalFilter)]} onChange={values => { setRegionalFilter(values[0] ? String(values[0]) : "all"); setCityFilter("all"); }} />
          <SearchableMultiSelect id="action-filter-city" label="Cidade" placeholder="Todas as cidades" maxSelections={1} options={cityFilterOptions.map(({ city }) => ({ id: city.id, label: city.name }))} values={cityFilter === "all" ? [] : [Number(cityFilter)]} onChange={values => setCityFilter(values[0] ? String(values[0]) : "all")} />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Situação da ação</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <Button type="button" variant={status === "all" ? "default" : "outline"} onClick={() => setStatus("all")} className="justify-between">Todas <span className="rounded bg-background/20 px-1.5 text-xs">{(actionList.data ?? []).length}</span></Button>
            {(["planned", "in_progress", "completed", "cancelled"] as const).map(value => <Button key={value} type="button" variant="outline" onClick={() => setStatus(value)} className={`justify-between ${status === value ? actionStatusClass[value] : ""}`}><span>{statusLabel[value]}</span><span className="rounded bg-background/20 px-1.5 text-xs">{statusCounts[value] ?? 0}</span></Button>)}
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
                  <CalendarClock className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-foreground">{row.action.name}</h2>
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{row.action.objective || "Objetivo ainda não informado."}</p>
                </div>
                <div className="col-span-2 min-w-0 space-y-2 lg:col-span-1">
                  <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={actionStatusClass[row.action.status]}>{statusLabel[row.action.status]}</Badge><Badge variant="outline">{partnershipLabel[row.action.partnershipType]}</Badge></div>
                  <div className="flex flex-wrap gap-2"><Badge variant="secondary">{row.actionTypeName || "Tipo não informado"}</Badge><Badge variant="outline">{row.cityName || "Cidade não informada"}</Badge></div>
                </div>
                <div className="col-span-2 min-w-0 rounded-xl bg-muted/45 px-3 py-2.5 lg:col-span-1"><p className="whitespace-nowrap text-xs font-medium tabular-nums text-muted-foreground">{compactDate(row.action.scheduledFor)} — {compactDate(row.action.endsAt)}</p><p className="mt-1 truncate text-xs text-muted-foreground">{row.supervisorName || "Supervisor não definido"}</p></div>
                <div className="col-span-2 grid min-w-0 grid-cols-3 gap-1.5 text-center text-primary lg:col-span-2 xl:col-span-1"><span className="flex min-h-14 flex-col items-center justify-center rounded-lg bg-primary/8 px-1 py-1.5"><strong className="text-sm font-semibold leading-none tabular-nums">{Number(row.finance?.estimatedAmount ?? row.action.estimatedCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</strong><small className="mt-1 text-[10px] font-medium leading-none text-primary/80">previsto</small></span><span className="flex min-h-14 flex-col items-center justify-center rounded-lg bg-primary/8 px-1 py-1.5"><strong className="text-sm font-semibold leading-none tabular-nums">{Number(row.finance?.paidAmount ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</strong><small className="mt-1 text-[10px] font-medium leading-none text-primary/80">pago</small></span><span className="flex min-h-14 flex-col items-center justify-center rounded-lg bg-primary/8 px-1 py-1.5"><strong className="text-sm font-semibold leading-none tabular-nums">{Number(row.finance?.remainingAmount ?? row.action.estimatedCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</strong><small className="mt-1 text-[10px] font-medium leading-none text-primary/80">saldo</small></span></div>
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
        setServices={setServices}
        submit={submit}
        pending={create.isPending}
      />
      <Dialog open={debriefOpen} onOpenChange={setDebriefOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Debriefing da ação</DialogTitle>
            <DialogDescription>
              Registre o resultado, os aprendizados e a recomendação para
              próximas iniciativas.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={event => {
              event.preventDefault();
              if (selectedId)
                saveDebrief.mutate({
                  actionId: selectedId,
                  rating: Number(debrief.rating),
                  notes: debrief.notes || undefined,
                  positives: debrief.positives || undefined,
                  negatives: debrief.negatives || undefined,
                  resultAchieved: debrief.resultAchieved,
                  worthRepeating: debrief.worthRepeating,
                  completedAt: new Date(debrief.completedAt),
                });
            }}
            className="grid gap-4 md:grid-cols-2"
          >
            <label className="grid gap-1.5 text-sm font-medium">
              Nota
              <select
                value={debrief.rating}
                onChange={event =>
                  setDebrief({ ...debrief, rating: event.target.value })
                }
                className="control"
              >
                {[5, 4, 3, 2, 1].map(value => (
                  <option key={value} value={value}>
                    {value} estrela{value > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Concluída em
              <Input
                type="datetime-local"
                required
                value={debrief.completedAt}
                onChange={event =>
                  setDebrief({ ...debrief, completedAt: event.target.value })
                }
              />
            </label>
            <Textarea
              className="md:col-span-2"
              placeholder="Síntese e aprendizados"
              value={debrief.notes}
              onChange={event =>
                setDebrief({ ...debrief, notes: event.target.value })
              }
            />
            <Textarea
              placeholder="Pontos positivos"
              value={debrief.positives}
              onChange={event =>
                setDebrief({ ...debrief, positives: event.target.value })
              }
            />
            <Textarea
              placeholder="Pontos a melhorar"
              value={debrief.negatives}
              onChange={event =>
                setDebrief({ ...debrief, negatives: event.target.value })
              }
            />
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={debrief.resultAchieved}
                onChange={event =>
                  setDebrief({
                    ...debrief,
                    resultAchieved: event.target.checked,
                  })
                }
              />
              Objetivo atingido
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={debrief.worthRepeating}
                onChange={event =>
                  setDebrief({
                    ...debrief,
                    worthRepeating: event.target.checked,
                  })
                }
              />
              Vale repetir
            </label>
            <div className="flex justify-end md:col-span-2">
              <Button
                type="submit"
                className="bg-primary"
                disabled={saveDebrief.isPending}
              >
                Salvar debriefing
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
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

function ActionDetail({
  row,
  canWrite,
  onBack,
  onEdit,
  onStatus,
  onDebrief,
  onReschedule,
}: {
  row: any;
  canWrite: boolean;
  onBack: () => void;
  onEdit: () => void;
  onStatus: (status: "in_progress" | "completed" | "cancelled") => void;
  onDebrief: () => void;
  onReschedule: () => void;
}) {
  const regionalId = null;
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
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl border border-border bg-primary/5 text-primary">
            <CalendarClock className="h-7 w-7" />
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
            {row.action.status === "planned" && (
              <Button onClick={() => onStatus("in_progress")} className="bg-primary">
                  Iniciar
              </Button>
            )}
            {row.action.status === "in_progress" && (
              <Button onClick={() => onStatus("completed")} className="bg-primary">
                  Concluir
              </Button>
            )}
            <Button variant="outline" onClick={onDebrief}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              {row.debrief ? "Revisar debrief" : "Registrar debrief"}
            </Button>
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
          <DetailSection title="Financeiro e controle">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailValue label="Custo previsto" value={Number(row.finance?.estimatedAmount ?? row.action.estimatedCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
              <DetailValue label="Valor gasto" value={Number(row.finance?.paidAmount ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
              <DetailValue label="Diferença" value={Number(row.finance?.remainingAmount ?? row.action.estimatedCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
              <DetailValue label="Modalidade" value={partnershipLabel[row.action.partnershipType]} />
            </div>
          </DetailSection>
        </section>
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <DetailSection title="Equipe, fornecedores e recursos">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DetailValue
                icon={<UsersRound className="h-4 w-4" />}
                label="Responsáveis"
                value={
                  row.teamMembers.length
                    ? row.teamMembers
                        .map(
                          (member: any) =>
                            member.name || `Usuário #${member.userId}`
                        )
                        .join(", ")
                    : "Não informados"
                }
              />
              <DetailValue
                label="Fornecedores envolvidos"
                value={
                  row.suppliers?.length
                    ? row.suppliers
                        .map((supplier: any) => supplier.name)
                        .join(", ")
                    : "Não informados"
                }
              />
              <DetailValue
                label="Serviços"
                value={
                  row.services?.length
                    ? row.services
                        .map((service: any) => `${service.name}: ${Number(service.estimatedAmount ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`)
                        .join(", ")
                    : "Não informados"
                }
              />
              <DetailValue
                icon={<PackageCheck className="h-4 w-4" />}
                label="Recursos de estoque"
                value={
                  row.stockItems.length
                    ? row.stockItems
                        .map(
                          (item: any) =>
                            `${item.name}: ${item.plannedQuantity} ${item.unit}`
                        )
                        .join(" · ")
                    : "Não informados"
                }
              />
            </div>
          </DetailSection>
        </section>
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <DetailSection title="Debriefing e resultado">
            {row.debrief ? (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="grid min-h-28 content-start gap-2 rounded-xl border border-border bg-muted/25 p-3">
                    <p className="text-sm font-medium">Nota geral</p>
                    <strong className="text-2xl font-semibold tabular-nums text-foreground">{row.debrief.rating}</strong>
                    <Badge variant="outline" className={`w-fit ${actionRatingClass[Number(row.debrief.rating)] ?? ""}`}>{row.debrief.rating}/5 · {actionRatingLabel[Number(row.debrief.rating)] ?? "Avaliação"}</Badge>
                  </div>
                  <div className="rounded-xl border border-border p-3"><p className="text-sm font-medium text-foreground">História da ação</p><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{row.debrief.resultSummary || "Sem história registrada."}</p></div>
                  <div className="rounded-xl border border-border p-3"><p className="text-sm font-medium text-foreground">Avaliação e aprendizados</p><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{row.debrief.notes || "Sem avaliação registrada."}</p></div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <DetailValue label="Leads" value={String(row.debrief.leadCount ?? 0)} />
                  <DetailValue label="Vendas" value={String(row.debrief.saleCount ?? 0)} />
                  <DetailValue label="Renovações" value={String(row.debrief.renewalCount ?? 0)} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {row.debrief.worthRepeating
                    ? "Recomendado repetir a iniciativa."
                    : "Revisar antes de repetir a iniciativa."}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                O debriefing ainda não foi registrado.
              </p>
            )}
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
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <DetailSection title="Fotos, vídeos e evidências">
            <EvidenceUpload
              entityType="action"
              entityId={row.action.id}
              regionalId={regionalId}
              canWrite={canWrite}
            />
          </DetailSection>
        </section>
      </div>
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
  setServices,
  submit,
  pending,
  isEditing = false,
}: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] w-[calc(100vw-2rem)] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar ação" : "Planejar nova ação"}</DialogTitle>
          <DialogDescription>
            Escolha a cidade primeiro. Fornecedores, pontos e recursos abaixo
            passam a mostrar somente opções compatíveis.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
          <label className="grid gap-1.5 text-sm font-medium">
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
          <label className="grid gap-1.5 text-sm font-medium">
            Modalidade
            <select
              value={form.partnershipType}
              onChange={event =>
                setForm({ ...form, partnershipType: event.target.value })
              }
              className="control"
            >
              <option value="paid">Pago</option>
              <option value="barter">Permuta</option>
              <option value="mixed">Misto</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Custo previsto
            <Input
              required
              type="number"
              min="0"
              step="0.01"
              value={form.estimatedCost}
              onChange={event =>
                setForm({ ...form, estimatedCost: event.target.value })
              }
            />
          </label>
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
            onChange={ids => setForm({ ...form, supplierIds: ids })}
            disabled={!form.cityId}
            emptyMessage="Nenhum fornecedor atende esta cidade."
          />
          <SearchableMultiSelect
            id="action-services"
            label="Serviços"
            options={(references?.serviceTypes ?? []).map((item: any) => ({
              id: item.id,
              label: item.name,
            }))}
            values={form.serviceTypeIds}
            onChange={setServices}
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
            <div className="rounded-xl border border-border bg-muted/50 p-4 md:col-span-4">
              <p className="text-sm font-semibold">Valores previstos por serviço</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {form.serviceAllocations.map((allocation: ServiceAllocation) => {
                  const service = (references?.serviceTypes ?? []).find((item: any) => item.id === allocation.serviceTypeId);
                  return <label key={allocation.serviceTypeId} className="grid gap-1 text-xs font-medium text-muted-foreground"><span>{service?.name ?? "Serviço"}</span><Input type="number" min="0" step="0.01" value={allocation.estimatedAmount} onChange={event => setForm({ ...form, serviceAllocations: form.serviceAllocations.map((current: ServiceAllocation) => current.serviceTypeId === allocation.serviceTypeId ? { ...current, estimatedAmount: event.target.value } : current) })} /></label>;
                })}
              </div>
            </div>
          )}
          {form.stockAllocations.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/50 p-4 md:col-span-4">
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
          <div className="flex justify-end gap-2 md:col-span-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="bg-primary" disabled={pending}>
              Planejar ação
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
