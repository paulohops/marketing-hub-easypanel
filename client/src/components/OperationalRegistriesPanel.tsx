import { useEffect, useMemo, useState } from "react";
import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  Building2,
  CalendarDays,
  FileText,
  Handshake,
  Loader2,
  MapPinned,
  Megaphone,
  PackagePlus,
  Pencil,
  Plus,
  ReceiptText,
  Radio,
  Settings2,
  Store,
  Upload,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Panel =
  | "provider"
  | "regional"
  | "city"
  | "supplier"
  | "partner"
  | "supervisor"
  | "service"
  | "media"
  | "action"
  | "event"
  | "campaign"
  | "campaign_sector"
  | "financial_category"
  | "action_point";
type Row = { id: number; name: string; active: boolean; detail?: string };
type RegistryGroup = "Lojas e localidade" | "Parceiros" | "Operação";

const cards: Array<{
  key: Panel;
  title: string;
  description: string;
  icon: typeof Building2;
  group: RegistryGroup;
}> = [
  {
    key: "provider",
    title: "Empresas",
    description: "Faturamento, CNPJ, contatos e vínculo territorial.",
    icon: Building2,
    group: "Lojas e localidade",
  },
  {
    key: "regional",
    title: "Regionais",
    description: "Estrutura territorial, código e empresa responsável.",
    icon: MapPinned,
    group: "Lojas e localidade",
  },
  {
    key: "city",
    title: "Cidades",
    description: "UF, endereço, CEP e coordenadas de localização.",
    icon: Store,
    group: "Lojas e localidade",
  },
  {
    key: "supplier",
    title: "Fornecedores e preços",
    description: "Cobertura, ofertas, preços e capacidades contratáveis.",
    icon: Handshake,
    group: "Parceiros",
  },
  {
    key: "partner",
    title: "Parceiros",
    description: "Parceiros comerciais e institucionais ativos.",
    icon: Handshake,
    group: "Parceiros",
  },
  {
    key: "supervisor",
    title: "Supervisores comerciais",
    description:
      "Pessoas disponíveis para liderar ações e eventos no território.",
    icon: Store,
    group: "Parceiros",
  },
  {
    key: "campaign",
    title: "Tipos",
    description: "Classificações reutilizáveis, como Comercial, Fidelização e outras estratégias.",
    icon: Megaphone,
    group: "Operação",
  },
  {
    key: "campaign_sector",
    title: "Setores",
    description: "Segmentos reutilizáveis, como B2C, B2B, PME e demais públicos.",
    icon: Settings2,
    group: "Operação",
  },
  {
    key: "action",
    title: "Tipos de ação",
    description: "Categorias configuráveis para ações de trade.",
    icon: Megaphone,
    group: "Operação",
  },
  {
    key: "action_point",
    title: "Pontos de ação",
    description: "Locais recorrentes para planejar, comparar e avaliar ações de trade.",
    icon: MapPinned,
    group: "Operação",
  },
  {
    key: "event",
    title: "Tipos de evento",
    description: "Categorias configuráveis para a agenda de eventos.",
    icon: CalendarDays,
    group: "Operação",
  },
  {
    key: "media",
    title: "Tipos de mídia",
    description: "Canais e formatos de mídia usados no território.",
    icon: Radio,
    group: "Operação",
  },
  {
    key: "service",
    title: "Serviços",
    description: "Serviços contratáveis de fornecedores e parceiros.",
    icon: Wrench,
    group: "Operação",
  },
  {
    key: "financial_category",
    title: "Categorias financeiras",
    description: "Classificações de planejamento e controle de verba.",
    icon: ReceiptText,
    group: "Operação",
  },
];

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant={active ? "outline" : "secondary"}
      className={
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "text-muted-foreground"
      }
    >
      {active ? "Ativo" : "Inativo"}
    </Badge>
  );
}
function toStringValue(value: unknown) {
  return value == null ? "" : String(value);
}

async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const [, dataBase64] = result.split(",", 2);
      dataBase64 ? resolve(dataBase64) : reject(new Error("Arquivo inválido."));
    };
    reader.readAsDataURL(file);
  });
}

export default function OperationalRegistriesPanel() {
  const [location, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const overview = trpc.settings.overview.useQuery();
  const coverage = trpc.settings.supplierCoverage.useQuery();
  const [panel, setPanel] = useState<Panel | null>(null);
  const handledCreateIntent = useRef<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [state, setState] = useState("MG");
  const [providerId, setProviderId] = useState("");
  const [regionalId, setRegionalId] = useState("");
  const [legalName, setLegalName] = useState("");
  const [billingCnpj, setBillingCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationNotes, setLocationNotes] = useState("");
  const [description, setDescription] = useState("");
  const [document, setDocument] = useState("");
  const [registryCityId, setRegistryCityId] = useState("");
  const [partnershipType, setPartnershipType] = useState<"paid" | "barter" | "mixed">("paid");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentRecurrence, setPaymentRecurrence] = useState("");
  const [hasContract, setHasContract] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [cityIds, setCityIds] = useState<number[]>([]);
  const [serviceIds, setServiceIds] = useState<number[]>([]);
  const [mediaIds, setMediaIds] = useState<number[]>([]);
  const [supervisorStoreIds, setSupervisorStoreIds] = useState<number[]>([]);
  const [offerName, setOfferName] = useState("");
  const [offerKind, setOfferKind] = useState<
    "service" | "media" | "action" | "event" | "other"
  >("service");
  const [offerUnit, setOfferUnit] = useState("unidade");
  const [offerPrice, setOfferPrice] = useState("");
  const [offerNotes, setOfferNotes] = useState("");
  const [editingOfferingId, setEditingOfferingId] = useState<number | null>(
    null
  );
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(
    null
  );
  const refresh = () => {
    utils.settings.overview.invalidate();
    utils.settings.supplierCoverage.invalidate();
  };
  const feedback = (message: string) => ({
    onSuccess: () => {
      toast.success(message);
      reset();
      refresh();
    },
    onError: (error: { message: string }) => toast.error(error.message),
  });
  const createProvider = trpc.settings.createProvider.useMutation(
    feedback("Empresa cadastrada.")
  );
  const updateProvider = trpc.settings.updateProvider.useMutation(
    feedback("Empresa atualizada.")
  );
  const createRegional = trpc.settings.createRegional.useMutation(
    feedback("Regional cadastrada.")
  );
  const updateRegional = trpc.settings.updateRegional.useMutation(
    feedback("Regional atualizada.")
  );
  const createCity = trpc.settings.createCity.useMutation(
    feedback("Cidade cadastrada.")
  );
  const updateCity = trpc.settings.updateCity.useMutation(
    feedback("Cidade atualizada.")
  );
  const createPartner = trpc.settings.createPartner.useMutation(
    feedback("Parceiro cadastrado.")
  );
  const updatePartner = trpc.settings.updatePartner.useMutation(
    feedback("Parceiro atualizado.")
  );
  const createSupplier = trpc.settings.createSupplier.useMutation({
    onSuccess: item => {
      toast.success("Fornecedor cadastrado. Configure cobertura e ofertas.");
      setEditingSupplierId(null);
      setSelectedSupplierId(String(item.id));
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const updateSupplier = trpc.settings.updateSupplier.useMutation({
    onSuccess: () => {
      toast.success("Fornecedor atualizado.");
      setEditingSupplierId(null);
      reset();
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const uploadRegistryContract = trpc.settings.uploadRegistryContract.useMutation({
    onSuccess: () => {
      toast.success("Contrato enviado com segurança.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const createType = trpc.settings.createType.useMutation(
    feedback("Tipo cadastrado.")
  );
  const updateType = trpc.settings.updateType.useMutation(
    feedback("Tipo atualizado.")
  );
  const createFinancialCategory =
    trpc.settings.createFinancialCategory.useMutation(
      feedback("Categoria financeira cadastrada.")
    );
  const updateFinancialCategory =
    trpc.settings.updateFinancialCategory.useMutation(
      feedback("Categoria financeira atualizada.")
    );
  const createCommercialSupervisor =
    trpc.settings.createCommercialSupervisor.useMutation(
      feedback("Supervisor comercial cadastrado.")
    );
  const updateCommercialSupervisor =
    trpc.settings.updateCommercialSupervisor.useMutation(
      feedback("Supervisor comercial atualizado.")
    );
  const setCommercialSupervisorStores = trpc.settings.setCommercialSupervisorStores.useMutation({
    onSuccess: () => {
      toast.success("Lojas supervisionadas atualizadas.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const createOffering = trpc.settings.createSupplierOffering.useMutation({
    onSuccess: () => {
      toast.success("Oferta e preço cadastrados.");
      setOfferName("");
      setOfferPrice("");
      setOfferNotes("");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const updateOffering = trpc.settings.updateSupplierOffering.useMutation({
    onSuccess: () => {
      toast.success("Oferta atualizada.");
      setEditingOfferingId(null);
      setOfferName("");
      setOfferPrice("");
      setOfferNotes("");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const setCoverage = trpc.settings.setSupplierCoverage.useMutation({
    onSuccess: () => {
      toast.success("Cobertura e capacidades atualizadas.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const setActive = trpc.settings.setRegistryActive.useMutation({
    onSuccess: () => {
      toast.success("Status atualizado.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const deleteRegistry = trpc.settings.deleteRegistry.useMutation({
    onSuccess: () => {
      toast.success("Cadastro excluído com segurança.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const selectedSupplier = useMemo(
    () =>
      overview.data?.suppliers.find(
        item => item.id === Number(selectedSupplierId)
      ),
    [overview.data?.suppliers, selectedSupplierId]
  );
  useEffect(() => {
    if (!selectedSupplierId || !coverage.data) return;
    const id = Number(selectedSupplierId);
    setCityIds(
      coverage.data.citiesBySupplier
        .filter(item => item.supplierId === id)
        .map(item => item.cityId)
    );
    setServiceIds(
      coverage.data.servicesBySupplier
        .filter(item => item.supplierId === id)
        .map(item => item.serviceTypeId)
    );
    setMediaIds(
      coverage.data.mediaBySupplier
        .filter(item => item.supplierId === id)
        .map(item => item.mediaTypeId)
    );
  }, [selectedSupplierId, coverage.data]);
  const reset = () => {
    setEditingId(null);
    setName("");
    setCode("");
    setState("MG");
    setProviderId("");
    setRegionalId("");
    setLegalName("");
    setBillingCnpj("");
    setEmail("");
    setPhone("");
    setAddress("");
    setZipCode("");
    setLatitude("");
    setLongitude("");
    setLocationNotes("");
    setDescription("");
    setDocument("");
    setRegistryCityId("");
    setPartnershipType("paid");
    setPaymentMethod("");
    setPaymentRecurrence("");
    setHasContract(false);
    setSupervisorStoreIds([]);
  };
  useEffect(() => {
    const requested = new URLSearchParams(location.split("?")[1] ?? "").get("novo");
    const panelBySlug: Record<string, Panel> = { empresas: "provider", regionais: "regional", cidades: "city", fornecedores: "supplier", parceiros: "partner", supervisores: "supervisor", servicos: "service", "tipos-de-midia": "media", "tipos-de-acao": "action", "tipos-de-evento": "event", "tipos-de-campanha": "campaign", "setores-de-campanha": "campaign_sector", "categorias-financeiras": "financial_category" };
    const target = requested ? panelBySlug[requested] : undefined;
    if (!target || handledCreateIntent.current === requested) return;
    handledCreateIntent.current = requested;
    reset();
    setPanel(target);
  }, [location]);
  const toggle = (
    id: number,
    values: number[],
    setValues: (value: number[]) => void
  ) =>
    setValues(
      values.includes(id)
        ? values.filter(value => value !== id)
        : [...values, id]
    );
  const saving =
    createProvider.isPending ||
    updateProvider.isPending ||
    createRegional.isPending ||
    updateRegional.isPending ||
    createCity.isPending ||
    updateCity.isPending ||
    createPartner.isPending ||
    updatePartner.isPending ||
    createCommercialSupervisor.isPending ||
    updateCommercialSupervisor.isPending ||
    setCommercialSupervisorStores.isPending ||
    createSupplier.isPending ||
    updateSupplier.isPending ||
    uploadRegistryContract.isPending ||
    createType.isPending ||
    updateType.isPending ||
    createFinancialCategory.isPending ||
    updateFinancialCategory.isPending ||
    createOffering.isPending ||
    updateOffering.isPending ||
    setCoverage.isPending ||
    deleteRegistry.isPending;
  const rows = (): Row[] => {
    const data = overview.data;
    if (!data || !panel) return [];
    if (panel === "provider")
      return data.providers.map(item => ({
        id: item.id,
        name: item.name,
        active: item.active,
        detail: item.billingCnpj
          ? `CNPJ ${item.billingCnpj}`
          : (item.legalName ?? undefined),
      }));
    if (panel === "regional")
      return data.regionals.map(item => ({
        id: item.id,
        name: item.name,
        active: item.active,
        detail: item.code,
      }));
    if (panel === "city")
      return data.cities.map(item => ({
        id: item.id,
        name: item.name,
        active: item.active,
        detail: `${item.state}${item.address ? ` · ${item.address}` : ""}`,
      }));
    if (panel === "supplier")
      return data.suppliers.map(item => ({
        id: item.id,
        name: item.displayName,
        active: item.active,
        detail: item.email ?? item.phone ?? undefined,
      }));
    if (panel === "partner")
      return data.partners.map(item => ({
        id: item.id,
        name: item.name,
        active: item.active,
        detail: item.email ?? item.phone ?? undefined,
      }));
    if (panel === "supervisor")
      return data.commercialSupervisors.map(item => ({
        id: item.id,
        name: item.name,
        active: item.active,
        detail: item.email ?? item.phone ?? undefined,
      }));
    if (panel === "financial_category")
      return data.financialCategories.map(item => ({
        id: item.id,
        name: item.name,
        active: item.active,
        detail: item.description ?? undefined,
      }));
    const types =
      panel === "service"
        ? data.serviceTypes
        : panel === "media"
          ? data.mediaTypes
          : panel === "action"
            ? data.actionTypes
            : panel === "event"
              ? data.eventTypes
              : panel === "campaign"
                ? data.campaignTypes
                : data.campaignSectors;
    return types.map(item => ({
      id: item.id,
      name: item.name,
      active: item.active,
    }));
  };
  const startEdit = (id: number) => {
    const data = overview.data;
    if (!data || !panel) return;
    reset();
    setEditingId(id);
    if (panel === "provider") {
      const item = data.providers.find(row => row.id === id);
      if (!item) return;
      setName(item.name);
      setLegalName(item.legalName ?? "");
      setBillingCnpj(item.billingCnpj ?? "");
      setEmail(item.email ?? "");
      setPhone(item.phone ?? "");
      setAddress(item.address ?? "");
      return;
    }
    if (panel === "regional") {
      const item = data.regionals.find(row => row.id === id);
      if (!item) return;
      setName(item.name);
      setCode(item.code);
      setProviderId(item.providerId ? String(item.providerId) : "");
      return;
    }
    if (panel === "city") {
      const item = data.cities.find(row => row.id === id);
      if (!item) return;
      setName(item.name);
      setState(item.state);
      setRegionalId(String(item.regionalId));
      setAddress(item.address ?? "");
      setZipCode(item.zipCode ?? "");
      setLatitude(toStringValue(item.latitude));
      setLongitude(toStringValue(item.longitude));
      setLocationNotes(item.locationNotes ?? "");
      return;
    }
    if (panel === "partner") {
      const item = data.partners.find(row => row.id === id);
      if (!item) return;
      setName(item.name);
      setEmail(item.email ?? "");
      setPhone(item.phone ?? "");
      setRegistryCityId(item.cityId ? String(item.cityId) : "");
      setPartnershipType(item.partnershipType ?? "paid");
      setPaymentMethod(item.paymentMethod ?? "");
      setPaymentRecurrence(item.paymentRecurrence ?? "");
      setHasContract(item.hasContract);
      return;
    }
    if (panel === "supervisor") {
      const item = data.commercialSupervisors.find(row => row.id === id);
      if (!item) return;
      setName(item.name);
      setEmail(item.email ?? "");
      setPhone(item.phone ?? "");
      setSupervisorStoreIds((data.commercialSupervisorStores ?? []).filter(link => link.commercialSupervisorId === id).map(link => link.storeId));
      return;
    }
    if (panel === "financial_category") {
      const item = data.financialCategories.find(row => row.id === id);
      if (!item) return;
      setName(item.name);
      setDescription(item.description ?? "");
      return;
    }
    if (
      panel === "action" ||
      panel === "event" ||
      panel === "media" ||
      panel === "service" ||
      panel === "campaign" ||
      panel === "campaign_sector"
    ) {
      const items =
        panel === "action"
          ? data.actionTypes
          : panel === "event"
            ? data.eventTypes
            : panel === "media"
              ? data.mediaTypes
              : panel === "campaign"
                ? data.campaignTypes
                : panel === "campaign_sector"
                  ? data.campaignSectors
                  : data.serviceTypes;
      setName(items.find(item => item.id === id)?.name ?? "");
    }
  };
  const submit = () => {
    if (!panel) return;
    if (panel === "provider") {
      const payload = {
        name,
        legalName: legalName || undefined,
        billingCnpj: billingCnpj || undefined,
        email: email || undefined,
        phone: phone || undefined,
        address: address || undefined,
      };
      return editingId
        ? updateProvider.mutate({ id: editingId, ...payload })
        : createProvider.mutate(payload);
    }
    if (panel === "regional") {
      const payload = {
        name,
        code,
        providerId: providerId ? Number(providerId) : null,
      };
      return editingId
        ? updateRegional.mutate({ id: editingId, ...payload })
        : createRegional.mutate(payload);
    }
    if (panel === "city") {
      const payload = {
        name,
        state,
        regionalId: Number(regionalId),
        address: address || undefined,
        zipCode: zipCode || undefined,
        latitude: latitude ? Number(latitude.replace(",", ".")) : undefined,
        longitude: longitude ? Number(longitude.replace(",", ".")) : undefined,
        locationNotes: locationNotes || undefined,
      };
      return editingId
        ? updateCity.mutate({ id: editingId, ...payload })
        : createCity.mutate(payload);
    }
    if (panel === "partner")
      return editingId
        ? updatePartner.mutate({
            id: editingId,
            name,
            email: email || undefined,
            phone: phone || undefined,
            cityId: registryCityId ? Number(registryCityId) : null,
            partnershipType,
            paymentMethod: paymentMethod || undefined,
            paymentRecurrence: paymentRecurrence || undefined,
            hasContract,
          })
        : createPartner.mutate({
            name,
            email: email || undefined,
            phone: phone || undefined,
            cityId: registryCityId ? Number(registryCityId) : null,
            partnershipType,
            paymentMethod: paymentMethod || undefined,
            paymentRecurrence: paymentRecurrence || undefined,
            hasContract,
          });
    if (panel === "supervisor") {
      const payload = { name, email: email || undefined, phone: phone || undefined };
      if (editingId) {
        updateCommercialSupervisor.mutate({ id: editingId, ...payload });
        return setCommercialSupervisorStores.mutate({ commercialSupervisorId: editingId, storeIds: supervisorStoreIds });
      }
      return createCommercialSupervisor.mutate({ userId: null, ...payload }, { onSuccess: item => setCommercialSupervisorStores.mutate({ commercialSupervisorId: item.id, storeIds: supervisorStoreIds }) });
    }
    if (panel === "financial_category")
      return editingId
        ? updateFinancialCategory.mutate({
            id: editingId,
            name,
            description: description || undefined,
          })
        : createFinancialCategory.mutate({
            name,
            description: description || undefined,
          });
    if (
      panel === "action" ||
      panel === "event" ||
      panel === "media" ||
      panel === "service" ||
      panel === "campaign" ||
      panel === "campaign_sector"
    )
      return editingId
        ? updateType.mutate({ kind: panel, id: editingId, name })
        : createType.mutate({ kind: panel, name });
  };
  const beginSupplierEdit = () => {
    if (!selectedSupplier) return;
    setEditingSupplierId(selectedSupplier.id);
    setName(selectedSupplier.displayName);
    setDocument(selectedSupplier.document ?? "");
    setEmail(selectedSupplier.email ?? "");
    setPhone(selectedSupplier.phone ?? "");
    setProviderId(selectedSupplier.providerId ? String(selectedSupplier.providerId) : "");
    setRegistryCityId(selectedSupplier.cityId ? String(selectedSupplier.cityId) : "");
    setPartnershipType(selectedSupplier.partnershipType ?? "paid");
    setPaymentMethod(selectedSupplier.paymentMethod ?? "");
    setPaymentRecurrence(selectedSupplier.paymentRecurrence ?? "");
    setHasContract(selectedSupplier.hasContract);
  };
  const saveSupplier = () => {
    const payload = {
      displayName: name,
      document,
      email,
      phone,
      providerId: providerId ? Number(providerId) : null,
      cityId: registryCityId ? Number(registryCityId) : null,
      partnershipType,
      paymentMethod: paymentMethod || undefined,
      paymentRecurrence: paymentRecurrence || undefined,
      hasContract,
    };
    return editingSupplierId
      ? updateSupplier.mutate({ id: editingSupplierId, ...payload })
      : createSupplier.mutate(payload);
  };
  const beginOfferingEdit = (item: {
    id: number;
    name: string;
    kind: "service" | "media" | "action" | "event" | "other";
    unit: string;
    unitPrice: string;
    notes?: string | null;
  }) => {
    setEditingOfferingId(item.id);
    setOfferName(item.name);
    setOfferKind(item.kind);
    setOfferUnit(item.unit);
    setOfferPrice(toStringValue(item.unitPrice));
    setOfferNotes(item.notes ?? "");
  };
  const saveOffering = () => {
    if (!selectedSupplierId) return;
    const payload = {
      kind: offerKind,
      name: offerName,
      unit: offerUnit,
      unitPrice: Number(offerPrice.replace(",", ".")),
      notes: offerNotes || undefined,
    };
    return editingOfferingId
      ? updateOffering.mutate({ id: editingOfferingId, ...payload })
      : createOffering.mutate({ supplierId: Number(selectedSupplierId), ...payload });
  };
  if (overview.isLoading || coverage.isLoading)
    return (
      <section className="mt-6 grid min-h-48 place-items-center rounded-2xl border border-border bg-card">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </section>
    );
  const title = cards.find(card => card.key === panel)?.title ?? "Cadastros";
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            <h2 className="font-display text-xl font-semibold text-foreground">
              Cadastros operacionais
            </h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Cadastros mestres para o dia a dia: configure, edite e ative
            registros sem apagar o histórico operacional.
          </p>
        </div>
        <Badge
          variant="outline"
          className="w-fit border-primary/25 bg-primary/5 text-primary"
        >
          Centro configurável
        </Badge>
      </div>
      <div className="mt-6 space-y-8">
        {(["Lojas e localidade", "Parceiros", "Operação"] as RegistryGroup[]).map(group => <section key={group} aria-labelledby={`registry-group-${group}`}>
          <div className="mb-3 flex items-center gap-3"><h3 id={`registry-group-${group}`} className="text-sm font-semibold text-foreground">{group}</h3><span className="h-px flex-1 bg-border" /></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.filter(card => card.group === group).map(card => {
          const Icon = card.icon;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => {
                if (card.key === "action_point") {
                  setLocation("/pontos-de-acao");
                  return;
                }
                const paths: Partial<Record<Panel, string>> = { provider: "empresas", regional: "regionais", city: "cidades", supplier: "fornecedores", partner: "parceiros", supervisor: "supervisores", service: "servicos", media: "tipos-de-midia", action: "tipos-de-acao", event: "tipos-de-evento", campaign: "tipos-de-campanha", campaign_sector: "setores-de-campanha", financial_category: "categorias-financeiras" };
                setLocation(`/cadastros/${paths[card.key] ?? ""}`);
              }}
              className="rounded-xl border border-border bg-background p-4 text-left transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-4 font-semibold text-foreground">{card.title}</p>
              <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">
                {card.description}
              </p>
              <span className="mt-4 inline-flex items-center text-xs font-semibold text-primary">
                Ver cadastros <Plus className="ml-1 h-3.5 w-3.5" />
              </span>
            </button>
          );
        })}{group === "Operação" && <><button type="button" onClick={() => setLocation("/cadastros/modelos")} className="rounded-xl border border-border bg-background p-4 text-left transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary"><FileText className="h-4 w-4" /></span><p className="mt-4 font-semibold text-foreground">Modelos de campanha</p><p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">Estruturas reutilizáveis de promoções, planos e prazos para iniciar campanhas.</p><span className="mt-4 inline-flex items-center text-xs font-semibold text-primary">Gerenciar modelos <Plus className="ml-1 h-3.5 w-3.5" /></span></button><button type="button" onClick={() => setLocation("/cadastros/modelos-acoes")} className="rounded-xl border border-border bg-background p-4 text-left transition hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-primary"><FileText className="h-4 w-4" /></span><p className="mt-4 font-semibold text-foreground">Modelos de ações</p><p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">Objetivo, tipo, modalidade e duração padrão para iniciar uma ação mais rapidamente.</p><span className="mt-4 inline-flex items-center text-xs font-semibold text-primary">Gerenciar modelos <Plus className="ml-1 h-3.5 w-3.5" /></span></button></>}</div>
        </section>)}
      </div>
      <Dialog
        open={panel !== null}
        onOpenChange={open => {
          if (!open) {
            reset();
            setPanel(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Edite os dados do registro selecionado. Seu histórico operacional será preservado."
                : "Cadastre novos registros, consulte os existentes e altere o status sem excluir dados históricos."}
            </DialogDescription>
          </DialogHeader>
          {panel === "supplier" ? (
            <SupplierPanel
              suppliers={overview.data?.suppliers ?? []}
              providers={overview.data?.providers ?? []}
              cities={overview.data?.cities ?? []}
              services={overview.data?.serviceTypes ?? []}
              media={overview.data?.mediaTypes ?? []}
              offerings={overview.data?.supplierOfferings ?? []}
              selectedSupplierId={selectedSupplierId}
              setSelectedSupplierId={setSelectedSupplierId}
              selectedSupplier={selectedSupplier}
              name={name}
              setName={setName}
              document={document}
              setDocument={setDocument}
              email={email}
              setEmail={setEmail}
              phone={phone}
              setPhone={setPhone}
              providerId={providerId}
              setProviderId={setProviderId}
              registryCityId={registryCityId}
              setRegistryCityId={setRegistryCityId}
              partnershipType={partnershipType}
              setPartnershipType={setPartnershipType}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              paymentRecurrence={paymentRecurrence}
              setPaymentRecurrence={setPaymentRecurrence}
              hasContract={hasContract}
              setHasContract={setHasContract}
              cityIds={cityIds}
              serviceIds={serviceIds}
              mediaIds={mediaIds}
              onToggleCity={id => toggle(id, cityIds, setCityIds)}
              onToggleService={id => toggle(id, serviceIds, setServiceIds)}
              onToggleMedia={id => toggle(id, mediaIds, setMediaIds)}
              onCreate={() =>
                saveSupplier()
              }
              editingSupplier={editingSupplierId !== null}
              onBeginSupplierEdit={beginSupplierEdit}
              onCancelSupplierEdit={() => {
                setEditingSupplierId(null);
                reset();
              }}
              onToggleSupplier={() =>
                selectedSupplier &&
                setActive.mutate({
                  kind: "supplier",
                  id: selectedSupplier.id,
                  active: !selectedSupplier.active,
                })
              }
              onUploadContract={async file => {
                if (!selectedSupplier) return;
                try {
                  const dataBase64 = await fileToBase64(file);
                  uploadRegistryContract.mutate({
                    entityType: "supplier",
                    entityId: selectedSupplier.id,
                    originalName: file.name,
                    mimeType: file.type as "application/pdf" | "image/jpeg" | "image/png" | "image/webp",
                    dataBase64,
                  });
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Não foi possível preparar o contrato.");
                }
              }}
              onSaveCoverage={() =>
                selectedSupplierId &&
                setCoverage.mutate({
                  supplierId: Number(selectedSupplierId),
                  cityIds,
                  serviceTypeIds: serviceIds,
                  mediaTypeIds: mediaIds,
                })
              }
              offerName={offerName}
              setOfferName={setOfferName}
              offerKind={offerKind}
              setOfferKind={setOfferKind}
              offerUnit={offerUnit}
              setOfferUnit={setOfferUnit}
              offerPrice={offerPrice}
              setOfferPrice={setOfferPrice}
              offerNotes={offerNotes}
              setOfferNotes={setOfferNotes}
              editingOffering={editingOfferingId !== null}
              onCreateOffer={saveOffering}
              onBeginOfferingEdit={beginOfferingEdit}
              onCancelOfferingEdit={() => {
                setEditingOfferingId(null);
                setOfferName("");
                setOfferPrice("");
                setOfferNotes("");
              }}
              onToggleOffering={(id: number, active: boolean) =>
                setActive.mutate({
                  kind: "supplier_offering",
                  id,
                  active: !active,
                })
              }
              saving={saving}
            />
          ) : (
            <>
              <RegistryForm
                panel={panel ?? "provider"}
                name={name}
                setName={setName}
                code={code}
                setCode={setCode}
                state={state}
                setState={setState}
                providerId={providerId}
                setProviderId={setProviderId}
                regionalId={regionalId}
                setRegionalId={setRegionalId}
                legalName={legalName}
                setLegalName={setLegalName}
                billingCnpj={billingCnpj}
                setBillingCnpj={setBillingCnpj}
                email={email}
                setEmail={setEmail}
                phone={phone}
                setPhone={setPhone}
                address={address}
                setAddress={setAddress}
                zipCode={zipCode}
                setZipCode={setZipCode}
                latitude={latitude}
                setLatitude={setLatitude}
                longitude={longitude}
                setLongitude={setLongitude}
                locationNotes={locationNotes}
                setLocationNotes={setLocationNotes}
                description={description}
                setDescription={setDescription}
                providers={overview.data?.providers ?? []}
                regionals={overview.data?.regionals ?? []}
                cities={overview.data?.cities ?? []}
                stores={overview.data?.stores ?? []}
                supervisorStoreIds={supervisorStoreIds}
                onToggleSupervisorStore={id => toggle(id, supervisorStoreIds, setSupervisorStoreIds)}
                registryCityId={registryCityId}
                setRegistryCityId={setRegistryCityId}
                partnershipType={partnershipType}
                setPartnershipType={setPartnershipType}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                paymentRecurrence={paymentRecurrence}
                setPaymentRecurrence={setPaymentRecurrence}
                hasContract={hasContract}
                setHasContract={setHasContract}
                editingId={editingId}
                onUploadContract={async file => {
                  if (!editingId || panel !== "partner") return;
                  try {
                    const dataBase64 = await fileToBase64(file);
                    uploadRegistryContract.mutate({
                      entityType: "partner",
                      entityId: editingId,
                      originalName: file.name,
                      mimeType: file.type as "application/pdf" | "image/jpeg" | "image/png" | "image/webp",
                      dataBase64,
                    });
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Não foi possível preparar o contrato.");
                  }
                }}
              />
              {panel === "provider" && editingId ? (
                <ProviderTerritory
                  providerId={editingId}
                  regionals={overview.data?.regionals ?? []}
                  cities={overview.data?.cities ?? []}
                />
              ) : null}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset();
                    setPanel(null);
                  }}
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={submit}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : editingId ? (
                    <Pencil className="mr-2 h-4 w-4" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {editingId ? "Salvar edição" : "Cadastrar"}
                </Button>
              </DialogFooter>
              <RegistryList
                rows={rows()}
                onEdit={startEdit}
                onToggle={(id, active) =>
                  setActive.mutate({
                    kind: (panel ?? "provider") as Exclude<Panel, "action_point">,
                    id,
                    active: !active,
                  })
                }
                onDelete={id => {
                  const kind = (panel ?? "provider") as Exclude<Panel, "action_point">;
                  if (window.confirm("Excluir este cadastro? A exclusão só será concluída se não houver vínculos operacionais.")) deleteRegistry.mutate({ kind, id });
                }}
                pending={setActive.isPending}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function RegistryForm(props: {
  panel: Panel;
  name: string;
  setName: (v: string) => void;
  code: string;
  setCode: (v: string) => void;
  state: string;
  setState: (v: string) => void;
  providerId: string;
  setProviderId: (v: string) => void;
  regionalId: string;
  setRegionalId: (v: string) => void;
  legalName: string;
  setLegalName: (v: string) => void;
  billingCnpj: string;
  setBillingCnpj: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  zipCode: string;
  setZipCode: (v: string) => void;
  latitude: string;
  setLatitude: (v: string) => void;
  longitude: string;
  setLongitude: (v: string) => void;
  locationNotes: string;
  setLocationNotes: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  providers: Array<{ id: number; name: string; active: boolean }>;
  regionals: Array<{ id: number; name: string; active: boolean }>;
  cities: Array<{ id: number; name: string; state: string; active: boolean }>;
  stores: Array<{ id: number; name: string; cityId: number; active: boolean }>;
  supervisorStoreIds: number[];
  onToggleSupervisorStore: (id: number) => void;
  registryCityId: string;
  setRegistryCityId: (v: string) => void;
  partnershipType: "paid" | "barter" | "mixed";
  setPartnershipType: (v: "paid" | "barter" | "mixed") => void;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  paymentRecurrence: string;
  setPaymentRecurrence: (v: string) => void;
  hasContract: boolean;
  setHasContract: (v: boolean) => void;
  editingId: number | null;
  onUploadContract: (file: File) => void;
}) {
  const city = props.panel === "city";
  const provider = props.panel === "provider";
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        label="Nome"
        id="registry-name"
        value={props.name}
        setValue={props.setName}
      />
      {props.panel === "regional" ? (
        <>
          <Field
            label="Código"
            id="registry-code"
            value={props.code}
            setValue={value => props.setCode(value.toUpperCase())}
          />
          <SelectField
            id="registry-provider"
            label="Empresa"
            value={props.providerId}
            onChange={props.setProviderId}
            optional
            options={props.providers.map(item => ({
              value: String(item.id),
              label: item.name,
            }))}
          />
        </>
      ) : null}
      {city ? (
        <>
          <SelectField
            id="registry-regional"
            label="Regional"
            value={props.regionalId}
            onChange={props.setRegionalId}
            options={props.regionals.map(item => ({
              value: String(item.id),
              label: item.name,
            }))}
          />
          <Field
            label="UF"
            id="registry-state"
            value={props.state}
            setValue={value => props.setState(value.toUpperCase())}
          />
          <Field
            label="Endereço"
            id="registry-address"
            value={props.address}
            setValue={props.setAddress}
          />
          <Field
            label="CEP"
            id="registry-zip"
            value={props.zipCode}
            setValue={props.setZipCode}
          />
          <Field
            label="Latitude"
            id="registry-latitude"
            value={props.latitude}
            setValue={props.setLatitude}
            inputMode="decimal"
          />
          <Field
            label="Longitude"
            id="registry-longitude"
            value={props.longitude}
            setValue={props.setLongitude}
            inputMode="decimal"
          />
          <Field
            label="Referência da localização"
            id="registry-location"
            value={props.locationNotes}
            setValue={props.setLocationNotes}
          />
        </>
      ) : null}
      {provider ? (
        <>
          <Field
            label="Razão social"
            id="provider-legal-name"
            value={props.legalName}
            setValue={props.setLegalName}
          />
          <Field
            label="CNPJ de faturamento"
            id="provider-cnpj"
            value={props.billingCnpj}
            setValue={props.setBillingCnpj}
          />
          <Field
            label="E-mail"
            id="registry-email"
            value={props.email}
            setValue={props.setEmail}
            type="email"
          />
          <Field
            label="Telefone"
            id="registry-phone"
            value={props.phone}
            setValue={props.setPhone}
          />
          <Field
            label="Endereço de faturamento"
            id="provider-address"
            value={props.address}
            setValue={props.setAddress}
          />
        </>
      ) : null}
      {props.panel === "partner" ? (
        <>
          <SelectField
            id="partner-city"
            label="Cidade-base"
            value={props.registryCityId}
            onChange={props.setRegistryCityId}
            optional
            options={props.cities.filter(item => item.active).map(item => ({
              value: String(item.id),
              label: `${item.name} · ${item.state}`,
            }))}
          />
          <Field
            label="E-mail"
            id="registry-email"
            value={props.email}
            setValue={props.setEmail}
            type="email"
          />
          <Field
            label="Telefone"
            id="registry-phone"
            value={props.phone}
            setValue={props.setPhone}
          />
          <SelectField
            id="partner-partnership-type"
            label="Modalidade"
            value={props.partnershipType}
            onChange={value => props.setPartnershipType(value as "paid" | "barter" | "mixed")}
            options={[
              { value: "paid", label: "Pago" },
              { value: "barter", label: "Permuta" },
              { value: "mixed", label: "Misto" },
            ]}
          />
          <Field label="Forma de pagamento" id="partner-payment-method" value={props.paymentMethod} setValue={props.setPaymentMethod} />
          <Field label="Recorrência do pagamento" id="partner-payment-recurrence" value={props.paymentRecurrence} setValue={props.setPaymentRecurrence} />
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground sm:col-span-2">
            <input type="checkbox" checked={props.hasContract} onChange={event => props.setHasContract(event.target.checked)} className="h-4 w-4 accent-primary" />
            Possuímos contrato com este parceiro
          </label>
          {props.editingId ? <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground sm:col-span-2"><Upload className="h-4 w-4 text-primary" />Enviar contrato (PDF ou imagem)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) props.onUploadContract(file); event.currentTarget.value = ""; }} /></label> : <p className="text-xs leading-5 text-muted-foreground sm:col-span-2">Salve o parceiro para anexar o arquivo do contrato.</p>}
        </>
      ) : null}
      {props.panel === "supervisor" ? (
        <>
          <Field label="E-mail" id="registry-email" value={props.email} setValue={props.setEmail} type="email" />
          <Field label="Telefone" id="registry-phone" value={props.phone} setValue={props.setPhone} />
          <section className="rounded-xl border border-border bg-secondary/20 p-3 sm:col-span-2">
            <p className="text-sm font-semibold text-foreground">Lojas supervisionadas</p>
            <p className="mt-1 text-xs text-muted-foreground">Selecione todas as lojas sob responsabilidade deste supervisor.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {props.stores.filter(store => store.active).length ? props.stores.filter(store => store.active).map(store => {
                const city = props.cities.find(item => item.id === store.cityId);
                return <label key={store.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"><input type="checkbox" checked={props.supervisorStoreIds.includes(store.id)} onChange={() => props.onToggleSupervisorStore(store.id)} className="h-4 w-4 accent-primary" /><span>{store.name}{city ? ` · ${city.name}/${city.state}` : ""}</span></label>;
              }) : <p className="text-sm text-muted-foreground">Nenhuma loja ativa cadastrada.</p>}
            </div>
          </section>
        </>
      ) : null}
      {props.panel === "financial_category" ? (
        <Field label="Descrição" id="financial-description" value={props.description} setValue={props.setDescription} />
      ) : null}
    </div>
  );
}

function ProviderTerritory({
  providerId,
  regionals,
  cities,
}: {
  providerId: number;
  regionals: Array<{ id: number; name: string; providerId: number | null; active: boolean }>;
  cities: Array<{ id: number; name: string; regionalId: number; active: boolean }>;
}) {
  const coveredRegionals = regionals.filter(regional => regional.providerId === providerId);
  const regionalIds = new Set(coveredRegionals.map(regional => regional.id));
  const coveredCities = cities.filter(city => regionalIds.has(city.regionalId));
  return (
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2"><MapPinned className="h-4 w-4 text-primary" /><p className="font-semibold text-foreground">Cobertura territorial da empresa</p></div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">A cobertura é calculada a partir das regionais vinculadas à empresa e das cidades vinculadas a essas regionais.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Regionais atendidas</p><div className="mt-2 flex flex-wrap gap-2">{coveredRegionals.length ? coveredRegionals.map(item => <Badge key={item.id} variant="outline" className="border-primary/30 bg-background text-primary">{item.name}</Badge>) : <span className="text-xs text-muted-foreground">Nenhuma regional vinculada.</span>}</div></div>
        <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cidades atendidas</p><div className="mt-2 flex flex-wrap gap-2">{coveredCities.length ? coveredCities.map(item => <Badge key={item.id} variant="outline" className="border-primary/30 bg-background text-primary">{item.name}</Badge>) : <span className="text-xs text-muted-foreground">Nenhuma cidade vinculada.</span>}</div></div>
      </div>
    </section>
  );
}

function SupplierPanel(props: {
  suppliers: Array<{ id: number; displayName: string; active: boolean }>;
  providers: Array<{ id: number; name: string; active: boolean }>;
  cities: Array<{ id: number; name: string; active: boolean }>;
  services: Array<{ id: number; name: string; active: boolean }>;
  media: Array<{ id: number; name: string; active: boolean }>;
  offerings: Array<{
    id: number;
    supplierId: number;
    kind: string;
    name: string;
    unit: string;
    unitPrice: string;
    notes?: string | null;
    active: boolean;
  }>;
  selectedSupplierId: string;
  setSelectedSupplierId: (v: string) => void;
  selectedSupplier:
    | { id: number; displayName: string; active: boolean; document?: string | null; email?: string | null; phone?: string | null; providerId?: number | null; cityId?: number | null; partnershipType?: "paid" | "barter" | "mixed" | null; paymentMethod?: string | null; paymentRecurrence?: string | null; hasContract: boolean; contractUrl?: string | null }
    | undefined;
  name: string;
  setName: (v: string) => void;
  document: string;
  setDocument: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  providerId: string;
  setProviderId: (v: string) => void;
  registryCityId: string;
  setRegistryCityId: (v: string) => void;
  partnershipType: "paid" | "barter" | "mixed";
  setPartnershipType: (v: "paid" | "barter" | "mixed") => void;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  paymentRecurrence: string;
  setPaymentRecurrence: (v: string) => void;
  hasContract: boolean;
  setHasContract: (v: boolean) => void;
  cityIds: number[];
  serviceIds: number[];
  mediaIds: number[];
  onToggleCity: (id: number) => void;
  onToggleService: (id: number) => void;
  onToggleMedia: (id: number) => void;
  onCreate: () => void;
  editingSupplier: boolean;
  onBeginSupplierEdit: () => void;
  onCancelSupplierEdit: () => void;
  onToggleSupplier: () => void;
  onUploadContract: (file: File) => void;
  onSaveCoverage: () => void;
  offerName: string;
  setOfferName: (v: string) => void;
  offerKind: "service" | "media" | "action" | "event" | "other";
  setOfferKind: (v: "service" | "media" | "action" | "event" | "other") => void;
  offerUnit: string;
  setOfferUnit: (v: string) => void;
  offerPrice: string;
  setOfferPrice: (v: string) => void;
  offerNotes: string;
  setOfferNotes: (v: string) => void;
  editingOffering: boolean;
  onCreateOffer: () => void;
  onBeginOfferingEdit: (item: { id: number; name: string; kind: "service" | "media" | "action" | "event" | "other"; unit: string; unitPrice: string; notes?: string | null }) => void;
  onCancelOfferingEdit: () => void;
  onToggleOffering: (id: number, active: boolean) => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border p-4">
        <p className="font-semibold text-foreground">{props.editingSupplier ? "Editar fornecedor" : "Novo fornecedor"}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            label="Nome de exibição"
            id="supplier-name"
            value={props.name}
            setValue={props.setName}
          />
          <Field
            label="CNPJ"
            id="supplier-document"
            value={props.document}
            setValue={props.setDocument}
          />
          <Field
            label="Telefone"
            id="supplier-phone"
            value={props.phone}
            setValue={props.setPhone}
          />
          <Field
            label="E-mail"
            id="supplier-email"
            value={props.email}
            setValue={props.setEmail}
            type="email"
          />
          <SelectField
            id="supplier-provider"
            label="Empresa"
            value={props.providerId}
            onChange={props.setProviderId}
            optional
            options={props.providers
              .filter(item => item.active)
              .map(item => ({ value: String(item.id), label: item.name }))}
          />
          <SelectField
            id="supplier-city"
            label="Cidade-base"
            value={props.registryCityId}
            onChange={props.setRegistryCityId}
            optional
            options={props.cities.filter(item => item.active).map(item => ({ value: String(item.id), label: item.name }))}
          />
          <SelectField
            id="supplier-partnership-type"
            label="Modalidade"
            value={props.partnershipType}
            onChange={value => props.setPartnershipType(value as "paid" | "barter" | "mixed")}
            options={[{ value: "paid", label: "Pago" }, { value: "barter", label: "Permuta" }, { value: "mixed", label: "Misto" }]}
          />
          <Field label="Forma de pagamento" id="supplier-payment-method" value={props.paymentMethod} setValue={props.setPaymentMethod} />
          <Field label="Recorrência do pagamento" id="supplier-payment-recurrence" value={props.paymentRecurrence} setValue={props.setPaymentRecurrence} />
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground sm:col-span-2">
            <input type="checkbox" checked={props.hasContract} onChange={event => props.setHasContract(event.target.checked)} className="h-4 w-4 accent-primary" />
            Possuímos contrato com este fornecedor
          </label>
        </div>
        <Button
          type="button"
          className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={props.saving}
          onClick={props.onCreate}
        >
          {props.editingSupplier ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
          {props.editingSupplier ? "Salvar fornecedor" : "Cadastrar fornecedor"}
        </Button>
        {props.editingSupplier ? <Button type="button" variant="ghost" className="ml-2" onClick={props.onCancelSupplierEdit}>Cancelar</Button> : null}
      </section>
      <section className="rounded-xl border border-border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">
              Cobertura, capacidades e preços
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Selecione um fornecedor para definir atendimento e ofertas.
            </p>
          </div>
          <div className="min-w-52">
            <SelectField
              id="supplier-select"
              label="Fornecedor"
              value={props.selectedSupplierId}
              onChange={props.setSelectedSupplierId}
              options={props.suppliers.map(item => ({
                value: String(item.id),
                label: item.displayName,
              }))}
            />
          </div>
        </div>
        {props.selectedSupplier ? (
          <div className="mt-4 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/30 p-3">
              <div><p className="text-sm font-semibold text-foreground">{props.selectedSupplier.displayName}</p><p className="text-xs text-muted-foreground">Atualize os dados cadastrais, a cobertura, as capacidades e os preços.</p></div>
              <div className="flex items-center gap-2"><StatusBadge active={props.selectedSupplier.active} /><Button type="button" size="sm" variant="outline" onClick={props.onBeginSupplierEdit}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button><Button type="button" size="sm" variant="outline" disabled={props.saving} onClick={props.onToggleSupplier}>{props.selectedSupplier.active ? "Inativar" : "Ativar"}</Button></div>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /><div><p className="text-sm font-medium text-foreground">Contrato</p><p className="text-xs text-muted-foreground">Envie PDF, JPG, PNG ou WEBP de até 5 MB.</p></div></div>
                <div className="flex flex-wrap items-center gap-2">
                  {props.selectedSupplier.contractUrl ? <a href={props.selectedSupplier.contractUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-primary underline-offset-4 hover:underline">Abrir contrato</a> : <span className="text-xs text-muted-foreground">Nenhum arquivo enviado</span>}
                  <label className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent"><Upload className="mr-1.5 h-3.5 w-3.5" />Enviar<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={event => { const file = event.target.files?.[0]; if (file) props.onUploadContract(file); event.currentTarget.value = ""; }} /></label>
                </div>
              </div>
            </div>
            <RegistryChecks
              title="Cidades atendidas"
              options={props.cities.filter(item => item.active)}
              selected={props.cityIds}
              toggle={props.onToggleCity}
            />
            <RegistryChecks
              title="Serviços oferecidos"
              options={props.services.filter(item => item.active)}
              selected={props.serviceIds}
              toggle={props.onToggleService}
            />
            <RegistryChecks
              title="Mídias oferecidas"
              options={props.media.filter(item => item.active)}
              selected={props.mediaIds}
              toggle={props.onToggleMedia}
            />
            <Button
              type="button"
              variant="outline"
              disabled={props.saving}
              onClick={props.onSaveCoverage}
            >
              Salvar cobertura e capacidades
            </Button>
            <div className="border-t border-border pt-5">
              <p className="font-semibold text-foreground">{props.editingOffering ? "Editar oferta e preço" : "Oferta e preço"}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Oferta"
                  id="offer-name"
                  value={props.offerName}
                  setValue={props.setOfferName}
                />
                <SelectField
                  id="offer-kind"
                  label="Categoria"
                  value={props.offerKind}
                  onChange={value =>
                    props.setOfferKind(value as typeof props.offerKind)
                  }
                  options={[
                    { value: "service", label: "Serviço" },
                    { value: "media", label: "Mídia" },
                    { value: "action", label: "Ação" },
                    { value: "event", label: "Evento" },
                    { value: "other", label: "Outro" },
                  ]}
                />
                <Field
                  label="Unidade"
                  id="offer-unit"
                  value={props.offerUnit}
                  setValue={props.setOfferUnit}
                />
                <Field
                  label="Preço unitário (R$)"
                  id="offer-price"
                  value={props.offerPrice}
                  setValue={props.setOfferPrice}
                  inputMode="decimal"
                />
                <Field label="Observações" id="offer-notes" value={props.offerNotes} setValue={props.setOfferNotes} />
              </div>
              <Button
                type="button"
                className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={props.saving}
                onClick={props.onCreateOffer}
              >
                {props.editingOffering ? <Pencil className="mr-2 h-4 w-4" /> : <PackagePlus className="mr-2 h-4 w-4" />}
                {props.editingOffering ? "Salvar oferta" : "Adicionar oferta"}
              </Button>
              {props.editingOffering ? <Button type="button" variant="ghost" className="ml-2" onClick={props.onCancelOfferingEdit}>Cancelar</Button> : null}
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {props.offerings
                  .filter(
                    item => item.supplierId === props.selectedSupplier?.id
                  )
                  .map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.kind} · {item.unit}
                        </p>
                        {item.notes ? <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <p className="text-sm font-semibold text-primary">R$ {Number(item.unitPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        <StatusBadge active={item.active} />
                        <Button type="button" size="sm" variant="ghost" className="h-8 px-2" onClick={() => props.onBeginOfferingEdit({ ...item, kind: item.kind as "service" | "media" | "action" | "event" | "other" })}><Pencil className="h-3.5 w-3.5" /><span className="sr-only">Editar oferta</span></Button>
                        <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" disabled={props.saving} onClick={() => props.onToggleOffering(item.id, item.active)}>{item.active ? "Inativar" : "Ativar"}</Button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Cadastre ou selecione um fornecedor para definir cobertura e preços.
          </p>
        )}
      </section>
    </div>
  );
}

function RegistryList({
  rows,
  onEdit,
  onToggle,
  onDelete,
  pending,
}: {
  rows: Row[];
  onEdit: (id: number) => void;
  onToggle: (id: number, active: boolean) => void;
  onDelete: (id: number) => void;
  pending: boolean;
}) {
  return (
    <section className="border-t border-border pt-5">
      <p className="mb-3 font-semibold text-foreground">Registros existentes</p>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {rows.length ? (
          rows.map(row => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {row.name}
                </p>
                {row.detail ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {row.detail}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <StatusBadge active={row.active} />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-border text-xs"
                  onClick={() => onEdit(row.id)}
                >
                  <Pencil className="mr-1 h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-border text-xs"
                  disabled={pending}
                  onClick={() => onToggle(row.id, row.active)}
                >
                  {row.active ? "Inativar" : "Ativar"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-destructive/30 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={pending}
                  onClick={() => onDelete(row.id)}
                >
                  Excluir
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nenhum item cadastrado ainda.
          </p>
        )}
      </div>
    </section>
  );
}
function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  optional = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  optional?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
      >
        <option value="">{optional ? "Não vincular" : "Selecione"}</option>
        {options.map(item => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </div>
  );
}
function Field({
  label,
  id,
  value,
  setValue,
  type = "text",
  inputMode,
}: {
  label: string;
  id: string;
  value: string;
  setValue: (v: string) => void;
  type?: string;
  inputMode?: "decimal";
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={event => setValue(event.target.value)}
      />
    </div>
  );
}
function RegistryChecks({
  title,
  options,
  selected,
  toggle,
}: {
  title: string;
  options: Array<{ id: number; name: string }>;
  selected: number[];
  toggle: (id: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {options.map(item => (
          <label
            key={item.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            <input
              type="checkbox"
              checked={selected.includes(item.id)}
              onChange={() => toggle(item.id)}
              className="h-4 w-4 accent-primary"
            />
            {item.name}
          </label>
        ))}
      </div>
    </div>
  );
}
