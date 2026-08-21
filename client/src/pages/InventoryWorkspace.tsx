import { Badge } from "@/components/ui/badge";
import { WorkspaceActions, WorkspaceHeader, WorkspaceShell } from "@/components/WorkspaceChrome";
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
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import ImageViewer from "@/components/ImageViewer";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import SearchableSelect from "@/components/SearchableSelect";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  History,
  Pencil,
  Search,
  Plus,
  RefreshCw,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

const stockCategories = [
  { value: "brinde_relacionamento", label: "Brinde Relacionamento" },
  { value: "brinde_vip", label: "Brinde VIP" },
  { value: "material_suporte", label: "Material de Suporte" },
] as const;
type StockCategory = (typeof stockCategories)[number]["value"];

function categoryLabel(category: StockCategory) {
  return (
    stockCategories.find(item => item.value === category)?.label ??
    "Material de Suporte"
  );
}

function balanceLabel(balance: number, minimum: string) {
  if (balance <= 0) {
    return { label: "Sem saldo", className: "bg-destructive/10 text-destructive" };
  }
  if (balance <= Number(minimum)) {
    return { label: "Estoque baixo", className: "bg-accent/15 text-accent-foreground" };
  }
  return { label: "Regular", className: "bg-secondary text-foreground" };
}

function movementLabel(type: "entry" | "exit" | "adjustment") {
  return type === "entry" ? "Entrada" : type === "exit" ? "Saída" : "Ajuste";
}

const acceptedPhotoTypes = ["image/jpeg", "image/png", "image/webp"] as const;

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Não foi possível ler a imagem selecionada."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

export default function InventoryWorkspace() {
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const { can } = useEffectivePermissions();
  const canWrite = can("inventory.write");
  const [showCreate, setShowCreate] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [movementItemId, setMovementItemId] = useState<number | null>(null);
  const [transferSourceId, setTransferSourceId] = useState<number | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [historyItemId, setHistoryItemId] = useState<number | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyDates, setHistoryDates] = useState({
    startsAt: "",
    endsAt: "",
  });
  const [filtersState, setFiltersState] = useState({
    regionalId: "",
    cityId: "",
    category: "",
    search: "",
    availability: "",
  });
  const [itemForm, setItemForm] = useState({
    regionalId: "",
    cityId: "",
    productTypeId: "",
    sku: "",
    name: "",
    unit: "un",
    category: "material_suporte" as StockCategory,
    minimumQuantity: "0",
    description: "",
  });
  const [editForm, setEditForm] = useState({
    productTypeId: "",
    sku: "",
    name: "",
    unit: "un",
    category: "material_suporte" as StockCategory,
    minimumQuantity: "0",
    description: "",
    active: true,
  });
  const [itemPhoto, setItemPhoto] = useState<File | null>(null);
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [movementForm, setMovementForm] = useState({
    movementType: "entry" as "entry" | "exit" | "adjustment",
    quantity: "",
    unitCost: "",
    reference: "",
    notes: "",
    responsibleCommercialSupervisorId: "",
    recipientCommercialSupervisorId: "",
  });
  const [transferForm, setTransferForm] = useState<{
    destinationStockItemId: string;
    quantity: string;
    notes: string;
    responsibleCommercialSupervisorId?: string;
    recipientCommercialSupervisorId?: string;
  }>({
    destinationStockItemId: "",
    quantity: "",
    notes: "",
    responsibleCommercialSupervisorId: "",
    recipientCommercialSupervisorId: "",
  });

  const filters = useMemo(
    () => ({
      regionalId: filtersState.regionalId
        ? Number(filtersState.regionalId)
        : undefined,
      cityId: filtersState.cityId ? Number(filtersState.cityId) : undefined,
      category: (filtersState.category || undefined) as
        | StockCategory
        | undefined,
      search: filtersState.search || undefined,
    }),
    [filtersState]
  );
  const inventory = trpc.inventory.list.useQuery(filters);
  const visibleItems = useMemo(() => {
    const availability = filtersState.availability;
    if (!availability) return inventory.data ?? [];
    return (inventory.data ?? []).filter(item => {
      const balance = Number(item.balance ?? 0);
      if (availability === "out") return balance <= 0;
      if (availability === "low") return balance > 0 && balance <= Number(item.minimumQuantity);
      if (availability === "active") return item.active;
      if (availability === "inactive") return !item.active;
      return true;
    });
  }, [filtersState.availability, inventory.data]);
  const references = trpc.inventory.referenceData.useQuery();
  const movementInput = useMemo(
    () => ({
      stockItemId: historyItemId ?? undefined,
      startsAt: historyDates.startsAt
        ? new Date(`${historyDates.startsAt}T00:00:00`)
        : undefined,
      endsAt: historyDates.endsAt
        ? new Date(`${historyDates.endsAt}T23:59:59`)
        : undefined,
      page: historyPage,
      pageSize: 10,
    }),
    [historyDates, historyItemId, historyPage]
  );
  const movementHistory = trpc.inventory.listMovements.useQuery(movementInput, {
    enabled: historyItemId !== null,
  });

  const refreshInventory = () => {
    void utils.inventory.list.invalidate();
    void utils.inventory.listMovements.invalidate();
  };
  const uploadPhoto = trpc.inventory.uploadPhoto.useMutation({
    onSuccess: () => {
      toast.success("Foto do item atualizada.");
      refreshInventory();
    },
    onError: error => toast.error(error.message),
  });
  const uploadItemPhoto = (stockItemId: number, file: File) => {
    if (
      !acceptedPhotoTypes.includes(
        file.type as (typeof acceptedPhotoTypes)[number]
      )
    ) {
      toast.error("Envie uma imagem JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("A foto do item deve ter até 3 MB.");
      return;
    }
    void readFileAsBase64(file)
      .then(dataBase64 =>
        uploadPhoto.mutate({
          stockItemId,
          originalName: file.name,
          mimeType: file.type as (typeof acceptedPhotoTypes)[number],
          dataBase64,
        })
      )
      .catch(error => toast.error(error.message));
  };
  const createItem = trpc.inventory.createItem.useMutation({
    onSuccess: created => {
      if (itemPhoto) uploadItemPhoto(created.id, itemPhoto);
      toast.success(
        itemPhoto
          ? "Item cadastrado. A foto está sendo enviada."
          : "Item de estoque cadastrado."
      );
      refreshInventory();
      setShowCreate(false);
      setItemForm({
        regionalId: "",
        cityId: "",
        productTypeId: "",
        sku: "",
        name: "",
        unit: "un",
        category: "material_suporte",
        minimumQuantity: "0",
        description: "",
      });
      setItemPhoto(null);
    },
    onError: error => toast.error(error.message),
  });
  const updateStockItem = trpc.inventory.updateStockItem.useMutation({
    onSuccess: () => {
      toast.success(
        "Item de estoque atualizado. O histórico de movimentações foi preservado."
      );
      refreshInventory();
      setEditingItemId(null);
    },
    onError: error => toast.error(error.message),
  });
  const registerMovement = trpc.inventory.registerMovement.useMutation({
    onSuccess: () => {
      toast.success("Movimentação registrada.");
      refreshInventory();
      setMovementItemId(null);
      setMovementForm({
        movementType: "entry",
        quantity: "",
        unitCost: "",
        reference: "",
        notes: "",
        responsibleCommercialSupervisorId: "",
        recipientCommercialSupervisorId: "",
      });
    },
    onError: error => toast.error(error.message),
  });
  const transfer = trpc.inventory.transfer.useMutation({
    onSuccess: () => {
      toast.success("Transferência registrada entre as cidades.");
      refreshInventory();
      setTransferSourceId(null);
      setTransferForm({
        destinationStockItemId: "",
        quantity: "",
        notes: "",
        responsibleCommercialSupervisorId: "",
        recipientCommercialSupervisorId: "",
      });
    },
    onError: error => toast.error(error.message),
  });

  const submitItem = (event: FormEvent) => {
    event.preventDefault();
    createItem.mutate({
      regionalId: Number(itemForm.regionalId),
      cityId: itemForm.cityId ? Number(itemForm.cityId) : null,
      productTypeId: itemForm.productTypeId ? Number(itemForm.productTypeId) : null,
      sku: itemForm.sku,
      name: itemForm.name,
      unit: itemForm.unit,
      category: itemForm.category,
      minimumQuantity: Number(itemForm.minimumQuantity),
      description: itemForm.description || undefined,
    });
  };
  const submitEditItem = (event: FormEvent) => {
    event.preventDefault();
    if (!editingItemId) return;
    updateStockItem.mutate({
      id: editingItemId,
      productTypeId: editForm.productTypeId ? Number(editForm.productTypeId) : null,
      sku: editForm.sku,
      name: editForm.name,
      unit: editForm.unit,
      category: editForm.category,
      minimumQuantity: Number(editForm.minimumQuantity),
      description: editForm.description || undefined,
      active: editForm.active,
    });
    if (editPhoto) uploadItemPhoto(editingItemId, editPhoto);
  };
  const submitMovement = (event: FormEvent) => {
    event.preventDefault();
    if (!movementItemId) return;
    registerMovement.mutate({
      stockItemId: movementItemId,
      movementType: movementForm.movementType,
      quantity: Number(movementForm.quantity),
      unitCost: movementForm.unitCost
        ? Number(movementForm.unitCost)
        : undefined,
      occurredAt: new Date(),
      reference: movementForm.reference || undefined,
      notes: movementForm.notes || undefined,
      responsibleCommercialSupervisorId:
        movementForm.responsibleCommercialSupervisorId
          ? Number(movementForm.responsibleCommercialSupervisorId)
          : null,
      recipientCommercialSupervisorId:
        movementForm.recipientCommercialSupervisorId
          ? Number(movementForm.recipientCommercialSupervisorId)
          : null,
    });
  };
  const submitTransfer = (event: FormEvent) => {
    event.preventDefault();
    if (!transferSourceId || !transferForm.destinationStockItemId) return;
    transfer.mutate({
      sourceStockItemId: transferSourceId,
      destinationStockItemId: Number(transferForm.destinationStockItemId),
      quantity: Number(transferForm.quantity),
      occurredAt: new Date(),
      notes: transferForm.notes || undefined,
      responsibleCommercialSupervisorId:
        transferForm.responsibleCommercialSupervisorId
          ? Number(transferForm.responsibleCommercialSupervisorId)
          : null,
      recipientCommercialSupervisorId:
        transferForm.recipientCommercialSupervisorId
          ? Number(transferForm.recipientCommercialSupervisorId)
          : null,
    });
  };
  const selectHistory = (itemId: number) => {
    setHistoryItemId(historyItemId === itemId ? null : itemId);
    setHistoryPage(1);
    setHistoryDates({ startsAt: "", endsAt: "" });
  };
  const openEditItem = (item: NonNullable<typeof inventory.data>[number]) => {
    setEditingItemId(item.id);
    setEditPhoto(null);
    setEditForm({
      productTypeId: item.productTypeId ? String(item.productTypeId) : "",
      sku: item.sku,
      name: item.name,
      unit: item.unit,
      category: item.category,
      minimumQuantity: String(Number(item.minimumQuantity)),
      description: item.description ?? "",
      active: item.active,
    });
  };
  const totalPages = movementHistory.data
    ? Math.max(
        1,
        Math.ceil(movementHistory.data.total / movementHistory.data.pageSize)
      )
    : 1;
  const transferSource =
    visibleItems.find(item => item.id === transferSourceId) ?? null;
  const transferDestinations = transferSource
    ? visibleItems.filter(
        item =>
          item.id !== transferSource.id &&
          item.cityId &&
          item.cityId !== transferSource.cityId &&
          item.sku === transferSource.sku &&
          item.unit === transferSource.unit &&
          item.category === transferSource.category
      )
    : [];
  const totalQuantity = useMemo(
    () =>
              visibleItems.reduce(
        (total, item) => total + Number(item.balance ?? 0),
        0
      ),
    [visibleItems]
  );

  return (
    <WorkspaceShell>
      <WorkspaceHeader
        eyebrow="Operação e materiais"
        title="Estoque de materiais"
        description="Controle brindes, tendas, cadeiras, mesas, windbanners e outros materiais por regional e cidade."
        icon={Boxes}
        actions={<WorkspaceActions>{canWrite ? <Button type="button" onClick={() => setShowCreate(value => !value)}><Plus />Novo item</Button> : null}</WorkspaceActions>}
      />

      <section className="hub-section-card">
        <div className="flex flex-wrap items-center justify-end gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setFiltersOpen(value => !value)} aria-expanded={filtersOpen}><Filter className="mr-2 h-4 w-4" />Filtros<ChevronDown className={`ml-2 h-4 w-4 transition-transform ${filtersOpen ? "rotate-180" : ""}`} /></Button>{(filtersState.search || filtersState.regionalId || filtersState.cityId || filtersState.category || filtersState.availability) && <Button type="button" variant="ghost" size="sm" onClick={() => setFiltersState({ regionalId: "", cityId: "", category: "", search: "", availability: "" })}>Limpar</Button>}</div>
        {filtersOpen && <div className="mt-4 grid gap-3 rounded-xl border border-border bg-secondary/30 p-4 sm:grid-cols-2 xl:grid-cols-4"><label className="text-xs font-medium text-foreground sm:col-span-2 xl:col-span-4">Buscar material<div className="relative mt-1.5"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input id="inventory-filter-search" value={filtersState.search} onChange={event => setFiltersState({ ...filtersState, search: event.target.value })} placeholder="Nome do material ou SKU" className="h-9 pl-9" /></div></label><SearchableSelect id="inventory-filter-regional" label="Regional" value={filtersState.regionalId} onChange={value => setFiltersState({ ...filtersState, regionalId: value, cityId: "" })} placeholder="Todas as regionais" options={(references.data?.regionals ?? []).map(regional => ({ value: regional.id, label: regional.name }))} /><SearchableSelect id="inventory-filter-city" label="Cidade" value={filtersState.cityId} onChange={value => setFiltersState({ ...filtersState, cityId: value })} placeholder="Todas as cidades" options={(references.data?.cities ?? []).filter(city => !filtersState.regionalId || city.regionalId === Number(filtersState.regionalId)).map(city => ({ value: city.id, label: `${city.name} - ${city.state}` }))} /><SearchableSelect id="inventory-filter-availability" label="Situação" value={filtersState.availability} onChange={value => setFiltersState({ ...filtersState, availability: value })} placeholder="Todas as situações" options={[{ value: "out", label: "Sem saldo" }, { value: "low", label: "Estoque baixo" }, { value: "active", label: "Itens ativos" }, { value: "inactive", label: "Itens inativos" }]} /><SearchableSelect id="inventory-filter-category" label="Categoria" value={filtersState.category} onChange={value => setFiltersState({ ...filtersState, category: value })} placeholder="Todas as categorias" options={stockCategories.map(category => ({ value: category.value, label: category.label }))} /></div>}
      </section>

      {showCreate && (
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent className="hub-form-dialog">
            <DialogHeader>
              <DialogTitle>Novo item de estoque</DialogTitle>
              <DialogDescription>
                Cadastre o material, a localização territorial e o estoque
                mínimo para iniciar o controle.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={submitItem}
              className="hub-form hub-form-grid hub-form-grid--3 rounded-2xl border border-border bg-card p-5 shadow-sm md:grid-cols-6"
            >
              <div className="md:col-span-2">
                <Label htmlFor="item-name">Nome do material</Label>
                <Input
                  id="item-name"
                  required
                  value={itemForm.name}
                  onChange={event =>
                    setItemForm({ ...itemForm, name: event.target.value })
                  }
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="item-product">Produto do catálogo</Label>
                <SearchableSelect id="item-product" label="Produto do catálogo" value={itemForm.productTypeId} onChange={value => setItemForm({ ...itemForm, productTypeId: value })} placeholder="Sem produto vinculado" options={(references.data?.productTypes ?? []).map(product => ({ value: product.id, label: product.name }))} />
              </div>
              <div>
                <Label htmlFor="item-sku">SKU</Label>
                <Input
                  id="item-sku"
                  required
                  value={itemForm.sku}
                  onChange={event =>
                    setItemForm({ ...itemForm, sku: event.target.value })
                  }
                  className="mt-1.5"
                />
              </div>
              <div>
                <SearchableSelect id="item-category" label="Categoria" value={itemForm.category} onChange={value => setItemForm({ ...itemForm, category: value as StockCategory })} options={stockCategories.map(category => ({ value: category.value, label: category.label }))} />
              </div>
              <div>
                <Label htmlFor="item-unit">Unidade</Label>
                <Input
                  id="item-unit"
                  required
                  maxLength={24}
                  value={itemForm.unit}
                  onChange={event =>
                    setItemForm({ ...itemForm, unit: event.target.value })
                  }
                  className="mt-1.5"
                />
              </div>
              <div>
                <SearchableSelect id="item-regional" label="Regional" value={itemForm.regionalId} onChange={value => setItemForm({ ...itemForm, regionalId: value, cityId: "" })} placeholder="Selecionar" options={(references.data?.regionals ?? []).map(regional => ({ value: regional.id, label: regional.name }))} />
              </div>
              <div>
                <SearchableSelect id="item-city" label="Cidade" value={itemForm.cityId} onChange={value => setItemForm({ ...itemForm, cityId: value })} placeholder="Sem cidade específica" options={(references.data?.cities ?? []).filter(city => !itemForm.regionalId || city.regionalId === Number(itemForm.regionalId)).map(city => ({ value: city.id, label: `${city.name} - ${city.state}` }))} />
              </div>
              <div>
                <Label htmlFor="item-minimum">Estoque mínimo</Label>
                <Input
                  id="item-minimum"
                  type="number"
                  min="0"
                  step="0.01"
                  value={itemForm.minimumQuantity}
                  onChange={event =>
                    setItemForm({
                      ...itemForm,
                      minimumQuantity: event.target.value,
                    })
                  }
                  className="mt-1.5"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="item-photo">Foto do item</Label>
                <Input
                  id="item-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={event =>
                    setItemPhoto(event.target.files?.[0] ?? null)
                  }
                  className="mt-1.5 cursor-pointer"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  JPG, PNG ou WEBP até 3 MB
                  {itemPhoto ? ` · ${itemPhoto.name}` : ""}
                </p>
              </div>
              <div className="md:col-span-4">
                <Label htmlFor="item-description">Descrição</Label>
                <Textarea
                  id="item-description"
                  value={itemForm.description}
                  onChange={event =>
                    setItemForm({
                      ...itemForm,
                      description: event.target.value,
                    })
                  }
                  className="mt-1.5 min-h-9"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="submit"
                  disabled={
                    createItem.isPending || !references.data?.regionals.length
                  }
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {createItem.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    "Salvar item"
                  )}
                </Button>
              </div>
              {!references.data?.regionals.length && (
                <p className="md:col-span-6 flex items-center gap-2 text-xs text-accent-foreground">
                  <AlertCircle className="h-3.5 w-3.5" /> Cadastre uma regional
                  no contexto operacional antes de incluir materiais.
                </p>
              )}
            </form>
          </DialogContent>
        </Dialog>
      )}

      {transferSource && (
        <form
          onSubmit={submitTransfer}
          className="mt-5 grid gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-5 lg:grid-cols-[1.25fr_1.25fr_0.65fr_1fr_1fr_1fr_auto]"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
              Transferência interna
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {transferSource.name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Origem: {transferSource.cityName ?? "Estoque regional"} · saldo{" "}
              {transferSource.balance.toLocaleString("pt-BR", {
                maximumFractionDigits: 2,
              })}{" "}
              {transferSource.unit}
            </p>
          </div>
          <div>
            <SearchableSelect id="transfer-destination" label="Cidade de destino" value={transferForm.destinationStockItemId} onChange={value => setTransferForm({ ...transferForm, destinationStockItemId: value })} placeholder="Selecionar item de destino" options={transferDestinations.map(item => ({ value: item.id, label: `${item.cityName} · saldo ${item.balance.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}` }))} disabled={!transferDestinations.length} />
            {!transferDestinations.length && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                Cadastre o mesmo SKU, unidade e categoria em outra cidade para
                receber a transferência.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="transfer-quantity" className="text-xs">
              Quantidade
            </Label>
            <Input
              id="transfer-quantity"
              required
              min="0.01"
              step="0.01"
              type="number"
              value={transferForm.quantity}
              onChange={event =>
                setTransferForm({
                  ...transferForm,
                  quantity: event.target.value,
                })
              }
              className="mt-1.5"
            />
          </div>
          <SearchableMultiSelect
            id="transfer-responsible-supervisor"
            label="Supervisor responsável"
            placeholder="Selecionar responsável"
            maxSelections={1}
            options={(references.data?.supervisors ?? []).map(supervisor => ({ id: supervisor.id, label: supervisor.name, description: supervisor.email ?? supervisor.phone ?? undefined }))}
            values={transferForm.responsibleCommercialSupervisorId ? [Number(transferForm.responsibleCommercialSupervisorId)] : []}
            onChange={values => setTransferForm({ ...transferForm, responsibleCommercialSupervisorId: values[0] ? String(values[0]) : "" })}
          />
          <SearchableMultiSelect
            id="transfer-recipient-supervisor"
            label="Supervisor recebedor"
            placeholder="Selecionar recebedor"
            maxSelections={1}
            options={(references.data?.supervisors ?? []).map(supervisor => ({ id: supervisor.id, label: supervisor.name, description: supervisor.email ?? supervisor.phone ?? undefined }))}
            values={transferForm.recipientCommercialSupervisorId ? [Number(transferForm.recipientCommercialSupervisorId)] : []}
            onChange={values => setTransferForm({ ...transferForm, recipientCommercialSupervisorId: values[0] ? String(values[0]) : "" })}
          />
          <div>
            <Label htmlFor="transfer-notes" className="text-xs">
              Observação
            </Label>
            <Input
              id="transfer-notes"
              maxLength={2000}
              value={transferForm.notes}
              onChange={event =>
                setTransferForm({ ...transferForm, notes: event.target.value })
              }
              className="mt-1.5"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              type="submit"
              disabled={transfer.isPending || !transferDestinations.length}
              className="bg-primary hover:bg-primary/90"
            >
              <ArrowLeftRight className="mr-1.5 h-4 w-4" /> Transferir
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTransferSourceId(null)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <p className="font-display text-lg font-semibold text-foreground">
              Posição de estoque
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge
              variant="outline"
              className="border-border bg-secondary text-xs text-foreground"
            >
              {visibleItems.length} itens
            </Badge>
            <Badge
              variant="outline"
              className="border-primary/30 bg-primary/5 text-xs text-primary"
            >
              Total: {totalQuantity.toLocaleString("pt-BR", {
                maximumFractionDigits: 2,
              })} unidades
            </Badge>
          </div>
        </div>
        {inventory.isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Carregando estoque...
          </div>
        ) : visibleItems.length ? (
          <div className="divide-y divide-border">
            {visibleItems.map(item => {
              const balance = Number(item.balance ?? 0);
              const status = balanceLabel(balance, item.minimumQuantity);
              const isHistoryOpen = historyItemId === item.id;
              const isEditing = editingItemId === item.id;
              return (
                <div key={item.id} className="overflow-hidden px-5 py-4">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 items-center gap-3">
                      <ImageViewer
                        src={item.photoUrl}
                        alt={`Foto de ${item.name}`}
                        title={`Foto do item: ${item.name}`}
                        className="h-16 w-16"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-foreground">
                            {item.name}
                          </p>
                          <Badge
                            className={`border-0 text-[10px] ${status.className}`}
                          >
                            {status.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-border bg-background text-[10px] text-muted-foreground"
                          >
                            {categoryLabel(item.category)}
                          </Badge>
                          {!item.active && (
                            <Badge
                              variant="outline"
                              className="border-border bg-destructive/10 text-[10px] text-destructive"
                            >
                              Inativo
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.sku} · {item.regionalName}
                          {item.cityName ? ` · ${item.cityName}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end">
                      <div className="col-span-2 text-left sm:mr-2 sm:text-right">
                        <p className="text-lg font-semibold text-foreground">
                          {balance.toLocaleString("pt-BR", {
                            maximumFractionDigits: 2,
                          })}{" "}
                          <span className="text-xs font-medium text-muted-foreground">
                            {item.unit}
                          </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          mínimo:{" "}
                          {Number(item.minimumQuantity).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-full min-w-0 overflow-hidden rounded-lg border-border text-xs sm:w-auto"
                        onClick={() => selectHistory(item.id)}
                      >
                        <History className="mr-1.5 h-3.5 w-3.5" />
                        <span className="sm:hidden">Ficha</span>
                        <span className="hidden sm:inline">Ver ficha</span>
                      </Button>
                      {canWrite && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-full min-w-0 overflow-hidden rounded-lg border-border text-xs sm:w-auto"
                          onClick={() => openEditItem(item)}
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" /> Editar
                        </Button>
                      )}
                      {canWrite && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-full min-w-0 overflow-hidden rounded-lg border-border text-xs sm:w-auto"
                          onClick={() =>
                            setMovementItemId(
                              movementItemId === item.id ? null : item.id
                            )
                          }
                        >
                          <ArrowUpFromLine className="mr-1.5 h-3.5 w-3.5" />
                          <span className="sm:hidden">Mov.</span>
                          <span className="hidden sm:inline">Movimentar</span>
                        </Button>
                      )}
                      {canWrite && item.cityId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-full min-w-0 overflow-hidden rounded-lg border-border text-xs sm:w-auto"
                          onClick={() => {
                            setTransferSourceId(
                              transferSourceId === item.id ? null : item.id
                            );
                            setTransferForm({
                              destinationStockItemId: "",
                              quantity: "",
                              notes: "",
                              responsibleCommercialSupervisorId: "",
                              recipientCommercialSupervisorId: "",
                            });
                          }}
                        >
                          <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" />
                          <span className="sm:hidden">Transf.</span>
                          <span className="hidden sm:inline">Transferir</span>
                        </Button>
                      )}
                    </div>
                  </div>
                  {isEditing && (
                    <Dialog
                      open={isEditing}
                      onOpenChange={open => {
                        if (!open) setEditingItemId(null);
                      }}
                    >
                      <DialogContent className="hub-form-dialog">
                        <DialogHeader>
                          <DialogTitle>Editar item de estoque</DialogTitle>
                          <DialogDescription>
                            Altere os dados cadastrais sem modificar o saldo ou
                            o histórico de movimentações.
                          </DialogDescription>
                        </DialogHeader>
                        <form
                          onSubmit={submitEditItem}
                          className="hub-form hub-form-grid hub-form-grid--3 rounded-xl border border-primary/20 bg-primary/5 p-4 md:grid-cols-6"
                        >
                          <div className="md:col-span-2">
                            <Label
                              htmlFor={`edit-item-name-${item.id}`}
                              className="text-xs"
                            >
                              Nome do material
                            </Label>
                            <Input
                              id={`edit-item-name-${item.id}`}
                              required
                              value={editForm.name}
                              onChange={event =>
                                setEditForm({
                                  ...editForm,
                                  name: event.target.value,
                                })
                              }
                              className="mt-1 h-9 bg-background"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`edit-item-product-${item.id}`} className="text-xs">Produto do catálogo</Label>
                            <select
                              id={`edit-item-product-${item.id}`}
                              value={editForm.productTypeId}
                              onChange={event => setEditForm({ ...editForm, productTypeId: event.target.value })}
                              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            >
                              <option value="">Sem produto vinculado</option>
                              {references.data?.productTypes?.map(product => (
                                <option key={product.id} value={product.id}>{product.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label
                              htmlFor={`edit-item-sku-${item.id}`}
                              className="text-xs"
                            >
                              SKU
                            </Label>
                            <Input
                              id={`edit-item-sku-${item.id}`}
                              required
                              value={editForm.sku}
                              onChange={event =>
                                setEditForm({
                                  ...editForm,
                                  sku: event.target.value,
                                })
                              }
                              className="mt-1 h-9 bg-background"
                            />
                          </div>
                          <div>
                            <Label
                              htmlFor={`edit-item-category-${item.id}`}
                              className="text-xs"
                            >
                              Categoria
                            </Label>
                            <select
                              id={`edit-item-category-${item.id}`}
                              value={editForm.category}
                              onChange={event =>
                                setEditForm({
                                  ...editForm,
                                  category: event.target.value as StockCategory,
                                })
                              }
                              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            >
                              {stockCategories.map(category => (
                                <option
                                  key={category.value}
                                  value={category.value}
                                >
                                  {category.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label
                              htmlFor={`edit-item-unit-${item.id}`}
                              className="text-xs"
                            >
                              Unidade
                            </Label>
                            <Input
                              id={`edit-item-unit-${item.id}`}
                              required
                              maxLength={24}
                              value={editForm.unit}
                              onChange={event =>
                                setEditForm({
                                  ...editForm,
                                  unit: event.target.value,
                                })
                              }
                              className="mt-1 h-9 bg-background"
                            />
                          </div>
                          <div>
                            <Label
                              htmlFor={`edit-item-minimum-${item.id}`}
                              className="text-xs"
                            >
                              Estoque mínimo
                            </Label>
                            <Input
                              id={`edit-item-minimum-${item.id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={editForm.minimumQuantity}
                              onChange={event =>
                                setEditForm({
                                  ...editForm,
                                  minimumQuantity: event.target.value,
                                })
                              }
                              className="mt-1 h-9 bg-background"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <Label
                              htmlFor={`edit-item-photo-${item.id}`}
                              className="text-xs"
                            >
                              Atualizar foto
                            </Label>
                            <Input
                              id={`edit-item-photo-${item.id}`}
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={event =>
                                setEditPhoto(event.target.files?.[0] ?? null)
                              }
                              className="mt-1 h-9 cursor-pointer bg-background"
                            />
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              {editPhoto
                                ? editPhoto.name
                                : "JPG, PNG ou WEBP até 3 MB"}
                            </p>
                          </div>
                          <div className="md:col-span-4">
                            <Label
                              htmlFor={`edit-item-description-${item.id}`}
                              className="text-xs"
                            >
                              Descrição
                            </Label>
                            <Input
                              id={`edit-item-description-${item.id}`}
                              value={editForm.description}
                              onChange={event =>
                                setEditForm({
                                  ...editForm,
                                  description: event.target.value,
                                })
                              }
                              className="mt-1 h-9 bg-background"
                            />
                          </div>
                          <label className="flex items-end gap-2 pb-2 text-xs font-medium text-foreground">
                            <input
                              type="checkbox"
                              checked={editForm.active}
                              onChange={event =>
                                setEditForm({
                                  ...editForm,
                                  active: event.target.checked,
                                })
                              }
                              className="h-4 w-4 accent-primary"
                            />{" "}
                            Item ativo
                          </label>
                          <div className="flex items-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setEditingItemId(null)}
                              className="h-9 border-border text-xs"
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="submit"
                              disabled={
                                updateStockItem.isPending ||
                                uploadPhoto.isPending
                              }
                              className="h-9 bg-primary text-xs hover:bg-primary/90"
                            >
                              {updateStockItem.isPending ||
                              uploadPhoto.isPending ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Salvar edição"
                              )}
                            </Button>
                          </div>
                          <p className="md:col-span-6 text-[11px] text-muted-foreground">
                            A edição atualiza os dados cadastrais. Saldos,
                            movimentações e transferências já registradas
                            permanecem preservados.
                          </p>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}
                  {isHistoryOpen && (
                    <div className="mt-4 rounded-xl border border-border bg-secondary p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                            Ficha do item e histórico cronológico
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {item.regionalName}
                            {item.cityName ? ` · ${item.cityName}` : ""}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label
                              htmlFor={`history-start-${item.id}`}
                              className="text-[10px]"
                            >
                              De
                            </Label>
                            <Input
                              id={`history-start-${item.id}`}
                              type="date"
                              value={historyDates.startsAt}
                              onChange={event => {
                                setHistoryDates({
                                  ...historyDates,
                                  startsAt: event.target.value,
                                });
                                setHistoryPage(1);
                              }}
                              className="mt-1 h-8 text-xs"
                            />
                          </div>
                          <div>
                            <Label
                              htmlFor={`history-end-${item.id}`}
                              className="text-[10px]"
                            >
                              Até
                            </Label>
                            <Input
                              id={`history-end-${item.id}`}
                              type="date"
                              value={historyDates.endsAt}
                              onChange={event => {
                                setHistoryDates({
                                  ...historyDates,
                                  endsAt: event.target.value,
                                });
                                setHistoryPage(1);
                              }}
                              className="mt-1 h-8 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 rounded-lg border border-border bg-background p-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
                        <div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Identificação</p><p className="mt-1 font-medium text-foreground">{item.name}</p><p className="mt-0.5 text-muted-foreground">SKU: {item.sku}</p></div>
                        <div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Saldo atual</p><p className="mt-1 font-semibold text-foreground">{item.balance.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {item.unit}</p><p className="mt-0.5 text-muted-foreground">Mínimo: {Number(item.minimumQuantity).toLocaleString("pt-BR")}</p></div>
                        <div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Localização</p><p className="mt-1 font-medium text-foreground">{item.regionalName}</p><p className="mt-0.5 text-muted-foreground">{item.cityName ?? "Estoque regional"}</p></div>
                        <div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Categoria e status</p><p className="mt-1 font-medium text-foreground">{categoryLabel(item.category)}</p><p className="mt-0.5 text-muted-foreground">{item.active ? "Item ativo" : "Item inativo"}</p></div>
                        {item.description && <div className="sm:col-span-2 xl:col-span-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Descrição</p><p className="mt-1 leading-5 text-muted-foreground">{item.description}</p></div>}
                      </div>
                      {movementHistory.isLoading ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Carregando histórico...
                        </p>
                      ) : movementHistory.data?.items.length ? (
                        <>
                          <div className="mt-3 space-y-2">
                            {movementHistory.data.items.map(
                              ({ movement, performedByName, responsibleName, recipientName }) => (
                                <div
                                  key={movement.id}
                                  className="grid gap-2 border-b border-border pb-2 text-xs last:border-0 last:pb-0 sm:grid-cols-[110px_1fr_auto]"
                                >
                                  <span className="font-medium text-foreground">
                                    {movementLabel(movement.movementType)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {movement.reference ||
                                      movement.notes ||
                                      "Sem referência"}
                                    {performedByName
                                      ? ` · ${performedByName}`
                                      : ""}
                                    {responsibleName ? ` · responsável: ${responsibleName}` : ""}
                                    {recipientName ? ` · recebedor: ${recipientName}` : ""}
                                  </span>
                                  <span className="text-right font-semibold text-foreground">
                                    {movement.movementType === "exit"
                                      ? "−"
                                      : "+"}
                                    {Number(movement.quantity).toLocaleString(
                                      "pt-BR"
                                    )}{" "}
                                    ·{" "}
                                    {new Date(
                                      movement.occurredAt
                                    ).toLocaleDateString("pt-BR")}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                          <div className="mt-3 flex items-center justify-end gap-2">
                            <span className="mr-auto text-[11px] text-muted-foreground">
                              {movementHistory.data.total} registros
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              disabled={historyPage <= 1}
                              onClick={() => setHistoryPage(page => page - 1)}
                              aria-label="Página anterior"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-[11px] text-muted-foreground">
                              {historyPage} de {totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              disabled={historyPage >= totalPages}
                              onClick={() => setHistoryPage(page => page + 1)}
                              aria-label="Próxima página"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Nenhuma movimentação registrada para este período.
                        </p>
                      )}
                    </div>
                  )}
                  {movementItemId === item.id && (
                    <form
                      onSubmit={submitMovement}
                      className="mt-4 grid gap-3 rounded-xl bg-secondary p-4 lg:grid-cols-7"
                    >
                      <select
                        aria-label="Tipo de movimentação"
                        value={movementForm.movementType}
                        onChange={event =>
                          setMovementForm({
                            ...movementForm,
                            movementType: event.target.value as
                              | "entry"
                              | "exit"
                              | "adjustment",
                          })
                        }
                        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="entry">Entrada</option>
                        <option value="exit">Saída</option>
                        <option value="adjustment">Ajuste positivo</option>
                      </select>
                      <Input
                        aria-label="Quantidade"
                        required
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Quantidade"
                        value={movementForm.quantity}
                        onChange={event =>
                          setMovementForm({
                            ...movementForm,
                            quantity: event.target.value,
                          })
                        }
                      />
                      <Input
                        aria-label="Referência"
                        placeholder="Referência"
                        value={movementForm.reference}
                        onChange={event =>
                          setMovementForm({
                            ...movementForm,
                            reference: event.target.value,
                          })
                        }
                      />
                      <SearchableMultiSelect
                        id={`movement-responsible-${item.id}`}
                        label="Supervisor responsável"
                        placeholder="Selecionar responsável"
                        maxSelections={1}
                        options={(references.data?.supervisors ?? []).map(supervisor => ({ id: supervisor.id, label: supervisor.name, description: supervisor.email ?? supervisor.phone ?? undefined }))}
                        values={movementForm.responsibleCommercialSupervisorId ? [Number(movementForm.responsibleCommercialSupervisorId)] : []}
                        onChange={values => setMovementForm({ ...movementForm, responsibleCommercialSupervisorId: values[0] ? String(values[0]) : "" })}
                      />
                      <SearchableMultiSelect
                        id={`movement-recipient-${item.id}`}
                        label="Supervisor recebedor"
                        placeholder="Selecionar recebedor"
                        maxSelections={1}
                        options={(references.data?.supervisors ?? []).map(supervisor => ({ id: supervisor.id, label: supervisor.name, description: supervisor.email ?? supervisor.phone ?? undefined }))}
                        values={movementForm.recipientCommercialSupervisorId ? [Number(movementForm.recipientCommercialSupervisorId)] : []}
                        onChange={values => setMovementForm({ ...movementForm, recipientCommercialSupervisorId: values[0] ? String(values[0]) : "" })}
                      />
                      <Input
                        aria-label="Observações"
                        placeholder="Observações"
                        value={movementForm.notes}
                        onChange={event =>
                          setMovementForm({
                            ...movementForm,
                            notes: event.target.value,
                          })
                        }
                      />
                      <Button
                        type="submit"
                        disabled={registerMovement.isPending}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <ArrowDownToLine className="mr-1.5 h-3.5 w-3.5" />{" "}
                        Registrar
                      </Button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Boxes className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold text-foreground">
              Seu estoque ainda não tem itens cadastrados
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Inclua os materiais que serão distribuídos ou utilizados nas
              operações.
            </p>
          </div>
        )}
      </section>
    </WorkspaceShell>
  );
}
