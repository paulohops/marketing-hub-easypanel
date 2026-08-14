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
    <main className="mx-auto max-w-[1480px]">
      <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Ativação de marca
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">
              Ações de trade
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Consulte cada iniciativa em uma ficha única com planejamento,
              execução, evidências, histórico e debriefing.
            </p>
          </div>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setCampaignOpen(true)} className="rounded-xl border-primary/30 text-primary">
              <Plus className="mr-2 h-4 w-4" /> Nova campanha
            </Button>
            <Button onClick={openForm} className="rounded-xl bg-primary">
              <Plus className="mr-2 h-4 w-4" /> Nova ação
            </Button>
          </div>
        )}
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
      <section className="mt-6 rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(12rem,0.8fr)_minmax(12rem,0.8fr)_minmax(12rem,0.8fr)]">
            <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Pesquisar por ação, cidade ou tipo…"
              className="pl-9"
            />
            </div>
            <SearchableMultiSelect
              id="action-filter-regional"
              label="Regional"
              placeholder="Todas as regionais"
              maxSelections={1}
              options={regionalOptions.map(regional => ({ id: Number(regional.id), label: regional.name }))}
              values={regionalFilter === "all" ? [] : [Number(regionalFilter)]}
              onChange={values => { setRegionalFilter(values[0] ? String(values[0]) : "all"); setCityFilter("all"); }}
            />
            <SearchableMultiSelect
              id="action-filter-city"
              label="Cidade"
              placeholder="Todas as cidades"
              maxSelections={1}
              options={cityFilterOptions.map(({ city }) => ({ id: city.id, label: city.name }))}
              values={cityFilter === "all" ? [] : [Number(cityFilter)]}
              onChange={values => setCityFilter(values[0] ? String(values[0]) : "all")}
            />
            <SearchableMultiSelect
              id="action-filter-status"
              label="Situação"
              placeholder="Todas as situações"
              maxSelections={1}
              options={[{ id: 1, label: "Planejadas" }, { id: 2, label: "Em execução" }, { id: 3, label: "Concluídas" }, { id: 4, label: "Canceladas" }]}
              values={status === "all" ? [] : [{ planned: 1, in_progress: 2, completed: 3, cancelled: 4 }[status] ?? 0]}
              onChange={values => setStatus(({ 1: "planned", 2: "in_progress", 3: "completed", 4: "cancelled" }[values[0] ?? 0] ?? "all") as typeof status)}
            />
          </div>
        </div>
        {actionList.isLoading ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Carregando ações…
          </p>
        ) : visibleActions.length ? (
          <div className="divide-y divide-border">
            {visibleActions.map((row: any) => (
              <button
                key={row.action.id}
                type="button"
                onClick={() => setLocation(`/acoes/${row.action.id}`)}
                className="flex w-full flex-col gap-3 px-5 py-4 text-left transition hover:bg-muted/50 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-foreground">
                      {row.action.name}
                    </p>
                    <Badge variant="outline">
                      {statusLabel[row.action.status]}
                    </Badge>
                    <Badge className="bg-secondary text-secondary-foreground">
                      {partnershipLabel[row.action.partnershipType]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.actionTypeName} · {row.cityName} · Início: {new Date(row.action.scheduledFor).toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-2 line-clamp-1 text-xs text-foreground">
                    Objetivo: {row.action.objective}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs text-muted-foreground lg:max-w-80">
                  <span>
                    Previsto: {Number(row.finance?.estimatedAmount ?? row.action.estimatedCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                  <span>
                    Pago: {Number(row.finance?.paidAmount ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                  <span>
                    Saldo: {Number(row.finance?.remainingAmount ?? row.action.estimatedCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                  {row.debrief && (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {row.debrief.rating}/5
                    </span>
                  )}
                </div>
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
    <main className="mx-auto max-w-[1480px]">
      <Button variant="outline" onClick={onBack} className="mb-5">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar à lista
      </Button>
      <header className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{statusLabel[row.action.status]}</Badge>
              <Badge className="bg-secondary text-secondary-foreground">
                {partnershipLabel[row.action.partnershipType]}
              </Badge>
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold text-foreground">
              {row.action.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {row.actionTypeName} · {row.cityName} ·{" "}
              {new Date(row.action.scheduledFor).toLocaleString("pt-BR")}
            </p>
          </div>
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onEdit}>
                Editar ação
              </Button>
              <Button variant="outline" onClick={onReschedule}>
                Reagendar
              </Button>
              {row.action.status === "planned" && (
                <Button
                  onClick={() => onStatus("in_progress")}
                  className="bg-primary"
                >
                  Iniciar
                </Button>
              )}
              {row.action.status === "in_progress" && (
                <Button
                  onClick={() => onStatus("completed")}
                  className="bg-primary"
                >
                  Concluir
                </Button>
              )}
              <Button variant="outline" onClick={onDebrief}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                {row.debrief ? "Revisar debrief" : "Registrar debrief"}
              </Button>
            </div>
          )}
        </div>
      </header>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <section className="space-y-5 lg:col-span-2">
          <DetailSection title="Planejamento e local">
            <p className="text-sm leading-6 text-foreground">
              {row.action.objective}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
                label="Custo previsto"
                value={Number(row.finance?.estimatedAmount ?? row.action.estimatedCost).toLocaleString(
                  "pt-BR",
                  { style: "currency", currency: "BRL" }
                )}
              />
              <DetailValue
                label="Valor gasto"
                value={Number(row.finance?.paidAmount ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              />
              <DetailValue
                label="Diferença"
                value={Number(row.finance?.remainingAmount ?? row.action.estimatedCost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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
          <DetailSection title="Equipe, fornecedores e recursos">
            <div className="grid gap-4 sm:grid-cols-2">
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
          <DetailSection title="Debriefing e resultado">
            {row.debrief ? (
              <div className="space-y-2 text-sm text-foreground">
                <p className="inline-flex items-center gap-1 font-semibold text-primary">
                  <Star className="h-4 w-4 fill-current" />
                  Nota {row.debrief.rating}/5
                </p>
                <p>{row.debrief.notes || "Sem síntese registrada."}</p>
                {row.debrief.resultSummary && <p>{row.debrief.resultSummary}</p>}
                <div className="grid gap-2 pt-1 sm:grid-cols-3">
                  <DetailValue label="Leads" value={String(row.debrief.leadCount ?? 0)} />
                  <DetailValue label="Vendas" value={String(row.debrief.saleCount ?? 0)} />
                  <DetailValue label="Renovações" value={String(row.debrief.renewalCount ?? 0)} />
                </div>
                <p className="text-muted-foreground">
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
        <aside>
          <DetailSection title="Fotos, vídeos e evidências">
            <EvidenceUpload
              entityType="action"
              entityId={row.action.id}
              regionalId={regionalId}
              canWrite={canWrite}
            />
          </DetailSection>
        </aside>
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
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-display text-lg font-semibold text-foreground">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
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
