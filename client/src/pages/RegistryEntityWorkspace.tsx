import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  Filter,
  ImageIcon,
  MapPin,
  Paperclip,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { trpc } from "@/lib/trpc";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import {
  CoordinatesField,
  StoreHoursField,
} from "@/components/StoreLocationFields";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import { SupplierContractsPanel } from "@/components/SupplierContractsPanel";
import {
  STORE_WEEKDAYS,
  formatStoreHours,
  parseStoreHours,
} from "@shared/storeHours";

type RegistryRecord = Record<string, unknown> & {
  id: number;
  active?: boolean;
  name?: string;
  displayName?: string;
  phone?: string | null;
  email?: string | null;
};
type EntityConfig = {
  singular: string;
  plural: string;
  collection: string;
  kind: string;
  importModule: string;
  description: string;
  icon: typeof Building2;
};
type SupervisorStoreLink = { commercialSupervisorId: number; storeId: number };
type SupervisorCityLink = { commercialSupervisorId: number; cityId: number };
type ProductMediaTypeLink = { productTypeId: number; mediaTypeId: number };
type ServiceTypeRelationLink = {
  serviceTypeId: number;
  subserviceTypeId: number;
};
type ServiceSubserviceLink = {
  serviceTypeId: number;
  subserviceTypeId: number;
};

const entities: Record<string, EntityConfig> = {
  "empresas-fiscais": {
    singular: "Empresa fiscal",
    plural: "Empresas fiscais",
    collection: "fiscalEntities",
    kind: "provider_fiscal_entity",
    importModule: "fiscalEntities",
    description: "CNPJs e inscrições fiscais vinculados a uma Empresa operacional.",
    icon: Building2,
  },
  empresas: {
    singular: "Empresa",
    plural: "Empresas",
    collection: "providers",
    kind: "provider",
    importModule: "providers",
    description:
      "Dados de faturamento, cobertura territorial, lojas, fornecedores e operações associadas.",
    icon: Building2,
  },
  regionais: {
    singular: "Regional",
    plural: "Regionais",
    collection: "regionals",
    kind: "regional",
    importModule: "regionals",
    description:
      "Estrutura territorial, empresa responsável, cidades, lojas e operações associadas.",
    icon: MapPin,
  },
  cidades: {
    singular: "Cidade",
    plural: "Cidades",
    collection: "cities",
    kind: "city",
    importModule: "cities",
    description:
      "Localização, dados de território, lojas, fornecedores e referências operacionais.",
    icon: MapPin,
  },
  lojas: {
    singular: "Loja",
    plural: "Lojas",
    collection: "stores",
    kind: "store",
    importModule: "stores",
    description:
      "Unidades de atendimento e respectivas referências territoriais.",
    icon: Building2,
  },
  fornecedores: {
    singular: "Fornecedor",
    plural: "Fornecedores",
    collection: "suppliers",
    kind: "supplier",
    importModule: "suppliers",
    description:
      "Contatos, cobertura, serviços contratáveis e condições comerciais.",
    icon: Building2,
  },
  "parceiros-comerciais": {
    singular: "Parceiro comercial",
    plural: "Parceiros comerciais",
    collection: "partners",
    kind: "partner",
    importModule: "partners",
    description: "Contatos, contratos e condições de parceria.",
    icon: Building2,
  },
  supervisores: {
    singular: "Supervisor comercial",
    plural: "Supervisores comerciais",
    collection: "commercialSupervisors",
    kind: "supervisor",
    importModule: "commercialSupervisors",
    description: "Pessoas responsáveis e lojas sob supervisão comercial.",
    icon: Building2,
  },
  servicos: {
    singular: "Serviço",
    plural: "Serviços",
    collection: "serviceTypes",
    kind: "service",
    importModule: "serviceTypes",
    description:
      "Serviços principais disponíveis para contratação e configuração da operação.",
    icon: Building2,
  },
  subservicos: {
    singular: "SubServiço",
    plural: "SubServiços",
    collection: "subserviceTypes",
    kind: "subservice",
    importModule: "subserviceTypes",
    description:
      "Detalhamentos operacionais reutilizáveis e vinculados a um ou mais serviços principais.",
    icon: Building2,
  },
  "tipos-de-produto": {
    singular: "Tipo de produto",
    plural: "Tipos de produto",
    collection: "productTypes",
    kind: "product",
    importModule: "productTypes",
    description:
      "Categorias de produtos para composição das ofertas de fornecedores.",
    icon: Building2,
  },
  "tipos-de-midia": {
    singular: "Tipo de mídia",
    plural: "Tipos de mídia",
    collection: "mediaTypes",
    kind: "media",
    importModule: "mediaTypes",
    description: "Canais e formatos para planejamento de mídia.",
    icon: Building2,
  },
  "tipos-de-acao": {
    singular: "Tipo de ação",
    plural: "Tipos de ação",
    collection: "actionTypes",
    kind: "action",
    importModule: "actionTypes",
    description: "Classificações usadas no planejamento de ações.",
    icon: Building2,
  },
  "tipos-de-evento": {
    singular: "Tipo de evento",
    plural: "Tipos de evento",
    collection: "eventTypes",
    kind: "event",
    importModule: "eventTypes",
    description: "Classificações usadas no planejamento de eventos.",
    icon: Building2,
  },
  "tipos-de-campanha": {
    singular: "Atuação",
    plural: "Atuações",
    collection: "campaignTypes",
    kind: "campaign",
    importModule: "campaignTypes",
    description:
      "Classificações reutilizáveis, como Comercial, Fidelização e outras estratégias.",
    icon: Building2,
  },
  "setores-de-campanha": {
    singular: "Setor",
    plural: "Setores",
    collection: "campaignSectors",
    kind: "campaign_sector",
    importModule: "campaignSectors",
    description:
      "Segmentos reutilizáveis, como B2C, B2B, PME e demais públicos.",
    icon: Building2,
  },
  "categorias-financeiras": {
    singular: "Categoria financeira",
    plural: "Categorias financeiras",
    collection: "financialCategories",
    kind: "financial_category",
    importModule: "financialCategories",
    description:
      "Classificações de estimativas, verbas e controles financeiros.",
    icon: Building2,
  },
};

const registryPaths: Record<string, string> = {
  provider: "empresas",
  provider_fiscal_entity: "empresas-fiscais",
  regional: "regionais",
  city: "cidades",
  store: "lojas",
  supplier: "fornecedores",
  partner: "parceiros-comerciais",
  supervisor: "supervisores",
  service: "servicos",
  subservice: "subservicos",
  product: "tipos-de-produto",
  media: "tipos-de-midia",
  action: "tipos-de-acao",
  event: "tipos-de-evento",
  campaign: "tipos-de-campanha",
  campaign_sector: "setores-de-campanha",
  financial_category: "categorias-financeiras",
};
const registryGroups: Record<string, string> = {
  provider: "territorio",
  provider_fiscal_entity: "financeiro",
  regional: "territorio",
  city: "territorio",
  store: "territorio",
  supplier: "parceiros",
  partner: "parceiros",
  supervisor: "parceiros",
  service: "parceiros",
  product: "produtos-servicos",
  media: "categorias",
  action: "categorias",
  event: "categorias",
  campaign: "operacao",
  campaign_sector: "operacao",
  financial_category: "financeiro",
};

function recordName(record: RegistryRecord) {
  return String(record.displayName ?? record.name ?? "Sem identificação");
}
function digits(value?: string | null) {
  return String(value ?? "").replace(/\D/g, "");
}
function whatsappUrl(phone?: string | null) {
  const number = digits(phone);
  return number.length >= 10
    ? `https://wa.me/55${number.replace(/^55/, "")}`
    : null;
}
function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
function blankSupplierForm() {
  return {
    name: "",
    providerId: "",
    cityId: "",
    address: "",
    legalName: "",
    document: "",
    contactName: "",
    phone: "",
    email: "",
    mainService: "",
    partnershipType: "paid",
    paymentMethod: "",
    paymentRecurrence: "",
    pixKey: "",
    paymentDay: "",
    paymentBarterValue: "",
    paymentBarterService: "",
    paymentNotes: "",
    contractStartsOn: "",
    contractEndsOn: "",
    hasContract: "no",
  };
}
function blankRegistryForm(kind: string) {
  const base = {
    recordId: "",
    name: "",
    providerId: "",
    regionalId: "",
    cityId: "",
    code: "",
    state: "MG",
    legalName: "",
    billingCnpj: "",
    contactName: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    headquartersCityId: "",
    brandColors: "",
    ibgeCode: "",
    zipCode: "",
    latitude: "",
    longitude: "",
    locationNotes: "",
    referencePoint: "",
    openingHours: "",
    document: "",
    partnershipType: "paid",
    paymentMethod: "",
    paymentRecurrence: "",
    hasContract: "no",
    mainService: "",
    description: "",
    operationCategory: "graphics",
    parentMediaTypeId: "",
    parentServiceTypeId: "",
    mediaTypeId: "",
    unit: "unidade",
    cnpj: "",
    stateRegistration: "",
    municipalRegistration: "",
    isDefault: "no",
  };
  return kind === "supplier" ? blankSupplierForm() : base;
}

const registrySlugAliases: Record<string, string> = {
  produto: "tipos-de-produto",
  produtos: "tipos-de-produto",
  servico: "servicos",
  subservico: "subservicos",
};

export default function RegistryEntityWorkspace() {
  const [location, setLocation] = useLocation();
  const cleanPath = location.split("?")[0];
  const [, , requestedSlug = "", rawId] = cleanPath.split("/");
  const slug = registrySlugAliases[requestedSlug] ?? requestedSlug;
  const entity = entities[slug];
  const isSubservicePage = slug === "subservicos";
  const isServiceRegistryPage = slug === "servicos" || isSubservicePage;
  const entityId = rawId ? Number(rawId) : null;
  const { can } = useEffectivePermissions();
  const utils = trpc.useUtils();
  const overview = trpc.settings.overview.useQuery(undefined, {
    staleTime: 20_000,
  });
  const [editing, setEditing] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [supplierCityIds, setSupplierCityIds] = useState<number[]>([]);
  const [supplierServiceIds, setSupplierServiceIds] = useState<number[]>([]);
  const [supplierMediaIds, setSupplierMediaIds] = useState<number[]>([]);
  const [supervisorCityIds, setSupervisorCityIds] = useState<number[]>([]);
  const [productMediaIds, setProductMediaIds] = useState<number[]>([]);
  const [subserviceParentIds, setSubserviceParentIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [companyFilter, setCompanyFilter] = useState("");
  const [regionalFilter, setRegionalFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [expandedRelation, setExpandedRelation] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const updateProvider = trpc.settings.updateProvider.useMutation({
    onSuccess: () => {
      toast.success("Empresa atualizada.");
      utils.settings.overview.invalidate();
      setEditing(false);
    },
  });
  const updateRegional = trpc.settings.updateRegional.useMutation({
    onSuccess: () => {
      toast.success("Regional atualizada.");
      utils.settings.overview.invalidate();
      setEditing(false);
    },
  });
  const updateCity = trpc.settings.updateCity.useMutation({
    onSuccess: () => {
      toast.success("Cidade atualizada.");
      utils.settings.overview.invalidate();
      setEditing(false);
    },
  });
  const updateSupplier = trpc.settings.updateSupplier.useMutation({
    onSuccess: () => {
      toast.success("Fornecedor atualizado.");
      utils.settings.overview.invalidate();
      setEditing(false);
    },
  });
  const createProvider = trpc.settings.createProvider.useMutation({
    onError: error => toast.error(error.message),
  });
  const createFiscalEntity = trpc.settings.createFiscalEntity.useMutation({
    onError: error => toast.error(error.message),
  });
  const updateFiscalEntity = trpc.settings.updateFiscalEntity.useMutation({
    onSuccess: () => {
      toast.success("Empresa fiscal atualizada.");
      utils.settings.overview.invalidate();
      setEditing(false);
    },
    onError: error => toast.error(error.message),
  });
  const createRegional = trpc.settings.createRegional.useMutation({
    onError: error => toast.error(error.message),
  });
  const createCity = trpc.settings.createCity.useMutation({
    onError: error => toast.error(error.message),
  });
  const createSupplier = trpc.settings.createSupplier.useMutation({
    onError: error => toast.error(error.message),
  });
  const createStore = trpc.settings.createStore.useMutation({
    onError: error => toast.error(error.message),
  });
  const createPartner = trpc.settings.createPartner.useMutation({
    onError: error => toast.error(error.message),
  });
  const createSupervisor = trpc.settings.createCommercialSupervisor.useMutation(
    { onError: error => toast.error(error.message) }
  );
  const createType = trpc.settings.createType.useMutation({
    onError: error => toast.error(error.message),
  });
  const createFinancialCategory =
    trpc.settings.createFinancialCategory.useMutation({
      onError: error => toast.error(error.message),
    });
  const updateStore = trpc.settings.updateStore.useMutation({
    onSuccess: () => {
      toast.success("Loja atualizada.");
      utils.settings.overview.invalidate();
      setEditing(false);
    },
  });
  const updatePartner = trpc.settings.updatePartner.useMutation({
    onSuccess: () => {
      toast.success("Parceiro atualizado.");
      utils.settings.overview.invalidate();
      setEditing(false);
    },
  });
  const updateSupervisor = trpc.settings.updateCommercialSupervisor.useMutation(
    {
      onSuccess: () => {
        toast.success("Supervisor atualizado.");
        utils.settings.overview.invalidate();
        setEditing(false);
      },
    }
  );
  const updateType = trpc.settings.updateType.useMutation({
    onSuccess: () => {
      toast.success("Tipo atualizado.");
      utils.settings.overview.invalidate();
      setEditing(false);
    },
  });
  const updateFinancialCategory =
    trpc.settings.updateFinancialCategory.useMutation({
      onSuccess: () => {
        toast.success("Categoria atualizada.");
        utils.settings.overview.invalidate();
        setEditing(false);
      },
    });
  const uploadProviderLogo = trpc.settings.uploadProviderLogo.useMutation({
    onSuccess: () => {
      toast.success("Logotipo atualizado.");
      utils.settings.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const uploadProviderCnpjCard =
    trpc.settings.uploadProviderCnpjCard.useMutation({
      onSuccess: () => {
        toast.success("Cartão CNPJ atualizado.");
        utils.settings.overview.invalidate();
      },
      onError: error => toast.error(error.message),
    });
  const uploadProviderBrandManual =
    trpc.settings.uploadProviderBrandManual.useMutation({
      onSuccess: () => {
        toast.success("Manual da marca atualizado.");
        utils.settings.overview.invalidate();
      },
      onError: error => toast.error(error.message),
    });
  const uploadStorePhoto = trpc.settings.uploadStorePhoto.useMutation({
    onSuccess: () => {
      toast.success("Foto da loja atualizada.");
      utils.settings.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const uploadSupplierPhoto = trpc.settings.uploadSupplierPhoto.useMutation({
    onSuccess: () => {
      toast.success("Foto do fornecedor atualizada.");
      utils.settings.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const uploadSupplierContract =
    trpc.settings.uploadRegistryContract.useMutation({
      onSuccess: () => {
        toast.success("Contrato cadastral anexado.");
        utils.settings.overview.invalidate();
      },
      onError: error => toast.error(error.message),
    });
  const setSupplierCoverage = trpc.settings.setSupplierCoverage.useMutation({
    onSuccess: () => {
      toast.success("Vínculos do fornecedor atualizados.");
      utils.settings.supplierCoverage.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const setSupervisorStores =
    trpc.settings.setCommercialSupervisorStores.useMutation({
      onSuccess: () => {
        toast.success("Cobertura de supervisão atualizada.");
        utils.settings.overview.invalidate();
      },
      onError: error => toast.error(error.message),
    });
  const setSupervisorCities =
    trpc.settings.setCommercialSupervisorCities.useMutation({
      onSuccess: () => {
        toast.success("Cidades vinculadas atualizadas.");
        utils.settings.overview.invalidate();
      },
      onError: error => toast.error(error.message),
    });
  const setProductMediaTypes = trpc.settings.setProductMediaTypes.useMutation({
    onSuccess: () => {
      toast.success("Tipos de mídia vinculados atualizados.");
      utils.settings.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const setActive = trpc.settings.setRegistryActive.useMutation({
    onSuccess: (_result, variables) => {
      toast.success(
        variables.active ? "Cadastro ativado." : "Cadastro inativado."
      );
      utils.settings.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const removeFiscalEntity = trpc.settings.deleteFiscalEntity.useMutation({
    onSuccess: () => {
      toast.success("Empresa fiscal excluída.");
      utils.settings.overview.invalidate();
      setLocation("/cadastros/empresas-fiscais");
    },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.settings.deleteRegistry.useMutation({
    onSuccess: () => {
      toast.success("Cadastro excluído com segurança.");
      utils.settings.overview.invalidate();
      setLocation(`/cadastros/${slug}`);
    },
    onError: error => toast.error(error.message),
  });
  const removeMany = trpc.settings.deleteRegistries.useMutation({
    onSuccess: result => {
      toast.success(`${result.deleted} cadastro(s) excluído(s) com segurança.`);
      setSelectedIds([]);
      utils.settings.overview.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const rows = useMemo(
    () =>
      ((overview.data as Record<string, unknown> | undefined)?.[
        entity?.collection ?? ""
      ] ?? []) as RegistryRecord[],
    [overview.data, entity?.collection]
  );
  const selected = entityId
    ? rows.find(item => item.id === entityId)
    : undefined;
  const providers = ((overview.data as Record<string, unknown> | undefined)
    ?.providers ?? []) as RegistryRecord[];
  const regionals = ((overview.data as Record<string, unknown> | undefined)
    ?.regionals ?? []) as RegistryRecord[];
  const cities = ((overview.data as Record<string, unknown> | undefined)
    ?.cities ?? []) as RegistryRecord[];
  const stores = ((overview.data as Record<string, unknown> | undefined)
    ?.stores ?? []) as RegistryRecord[];
  const suppliers = ((overview.data as Record<string, unknown> | undefined)
    ?.suppliers ?? []) as RegistryRecord[];
  const supervisors = ((overview.data as Record<string, unknown> | undefined)
    ?.commercialSupervisors ?? []) as RegistryRecord[];
  const supervisorStoreLinks = ((
    overview.data as Record<string, unknown> | undefined
  )?.commercialSupervisorStores ?? []) as SupervisorStoreLink[];
  const supervisorCityLinks = ((
    overview.data as Record<string, unknown> | undefined
  )?.commercialSupervisorCities ?? []) as SupervisorCityLink[];
  const productMediaLinks = ((
    overview.data as Record<string, unknown> | undefined
  )?.productMediaTypes ?? []) as ProductMediaTypeLink[];
  const serviceTypes = ((overview.data as Record<string, unknown> | undefined)
    ?.serviceTypes ?? []) as RegistryRecord[];
  const rawSubserviceTypes = ((overview.data as Record<string, unknown> | undefined)
    ?.subserviceTypes ?? []) as RegistryRecord[];
  const subserviceTypes = rawSubserviceTypes.length
    ? rawSubserviceTypes
    : serviceTypes.filter(item => Number(item.parentServiceTypeId ?? 0) > 0);
  const mediaServiceCatalog = ((overview.data as Record<string, unknown> | undefined)
    ?.mediaServiceCatalog ?? []) as RegistryRecord[];
  const serviceTypeRelations = ((
    overview.data as Record<string, unknown> | undefined
  )?.serviceTypeRelations ?? []) as ServiceTypeRelationLink[];
  const serviceSubservices = ((
    overview.data as Record<string, unknown> | undefined
  )?.serviceSubservices ?? []) as ServiceSubserviceLink[];
  const mediaTypes = ((overview.data as Record<string, unknown> | undefined)
    ?.mediaTypes ?? []) as RegistryRecord[];
  const supplierOfferings = ((
    overview.data as Record<string, unknown> | undefined
  )?.supplierOfferings ?? []) as RegistryRecord[];
  const operationalFootprint = ((
    overview.data as Record<string, unknown> | undefined
  )?.operationalFootprint ?? {}) as SupplierOperationalFootprint;
  const supplierCoverage = trpc.settings.supplierCoverage.useQuery(undefined, {
    enabled: entity?.kind === "supplier" && Boolean(selected),
  });
  const filteredRows = rows.filter(row => {
    const text =
      `${recordName(row)} ${String(row.email ?? "")} ${String(row.code ?? "")}`.toLocaleLowerCase(
        "pt-BR"
      );
    const regionalId = Number(
      row.regionalId ??
        (row.cityId
          ? cities.find(city => city.id === Number(row.cityId))?.regionalId
          : 0)
    );
    return (
      (activeFilter === "all" ||
        (activeFilter === "active"
          ? row.active !== false
          : row.active === false)) &&
      text.includes(search.toLocaleLowerCase("pt-BR")) &&
      (!companyFilter ||
        Number(row.providerId ?? row.headquartersCityId) ===
          Number(companyFilter)) &&
      (!regionalFilter || regionalId === Number(regionalFilter)) &&
      (!cityFilter ||
        Number(row.cityId ?? row.headquartersCityId) === Number(cityFilter)) &&
      (!isServiceRegistryPage ||
        (isSubservicePage
          ? true
          : !row.parentServiceTypeId &&
            !serviceSubservices.some(
              relation => Number(relation.subserviceTypeId) === row.id
            ) &&
            !serviceTypeRelations.some(
              relation => Number(relation.subserviceTypeId) === row.id
            )))
    );
  });
  const clearFilters = () => {
    setSearch("");
    setActiveFilter("all");
    setCompanyFilter("");
    setRegionalFilter("");
    setCityFilter("");
  };
  const allVisibleSelected =
    filteredRows.length > 0 && filteredRows.every(row => selectedIds.includes(row.id));
  const toggleSelected = (id: number) => {
    setSelectedIds(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    );
  };
  const toggleAllVisible = () => {
    const visibleIds = filteredRows.map(row => row.id);
    setSelectedIds(current =>
      allVisibleSelected
        ? current.filter(id => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds]))
    );
  };

  useEffect(() => {
    if (!selected) return;
    setForm({
      recordId: String(selected.id),
      name: recordName(selected),
      providerRecordId: String(selected.id),
      code: String(selected.code ?? ""),
      state: String(selected.state ?? "MG"),
      providerId: selected.providerId ? String(selected.providerId) : "",
      regionalId: selected.regionalId ? String(selected.regionalId) : "",
      legalName: String(selected.legalName ?? ""),
      billingCnpj: String(selected.billingCnpj ?? ""),
      cnpj: String(selected.cnpj ?? ""),
      stateRegistration: String(selected.stateRegistration ?? ""),
      municipalRegistration: String(selected.municipalRegistration ?? ""),
      isDefault: selected.isDefault ? "yes" : "no",
      contactName: String(selected.contactName ?? ""),
      phone: String(selected.phone ?? ""),
      email: String(selected.email ?? ""),
      website: String(selected.website ?? ""),
      address: String(selected.address ?? ""),
      headquartersCityId: selected.headquartersCityId
        ? String(selected.headquartersCityId)
        : "",
      brandColors: Array.isArray(selected.brandColors)
        ? selected.brandColors.join(", ")
        : "",
      ibgeCode: String(selected.ibgeCode ?? ""),
      zipCode: String(selected.zipCode ?? ""),
      latitude: String(selected.latitude ?? ""),
      longitude: String(selected.longitude ?? ""),
      locationNotes: String(selected.locationNotes ?? ""),
      referencePoint: String(selected.referencePoint ?? ""),
      openingHours: String(selected.openingHours ?? ""),
      document: String(selected.document ?? ""),
      cityId: selected.cityId ? String(selected.cityId) : "",
      partnershipType: String(selected.partnershipType ?? "paid"),
      paymentMethod: String(selected.paymentMethod ?? ""),
      paymentRecurrence: String(selected.paymentRecurrence ?? ""),
      pixKey: String(selected.pixKey ?? ""),
      paymentDay: selected.paymentDay ? String(selected.paymentDay) : "",
      paymentBarterValue: String(selected.paymentBarterValue ?? ""),
      paymentBarterService: String(selected.paymentBarterService ?? ""),
      paymentNotes: String(selected.paymentNotes ?? ""),
      contractStartsOn: String(selected.contractStartsOn ?? ""),
      contractEndsOn: String(selected.contractEndsOn ?? ""),
      hasContract: selected.hasContract ? "yes" : "no",
      mainService: String(selected.mainService ?? ""),
      description: String(selected.description ?? ""),
      operationCategory: String(selected.operationCategory ?? "graphics"),
      unit: String(selected.unit ?? "unidade"),
      parentMediaTypeId: selected.parentMediaTypeId
        ? String(selected.parentMediaTypeId)
        : "",
    });
    const relationParentIds = isSubservicePage
      ? serviceSubservices
          .filter(relation => Number(relation.subserviceTypeId) === selected.id)
          .map(relation => Number(relation.serviceTypeId))
      : serviceTypeRelations
          .filter(relation => Number(relation.subserviceTypeId) === selected.id)
          .map(relation => Number(relation.serviceTypeId));
    setSubserviceParentIds(
      isSubservicePage
        ? relationParentIds.length
          ? relationParentIds
          : selected.parentServiceTypeId
            ? [Number(selected.parentServiceTypeId)]
            : []
        : []
    );
  }, [selected, isSubservicePage, serviceTypeRelations, serviceSubservices]);

  useEffect(() => {
    if (
      entity?.kind !== "supplier" ||
      !selected ||
      !supplierCoverage.data
    )
      return;
    setSupplierCityIds(
      supplierCoverage.data.citiesBySupplier
        .filter(item => item.supplierId === selected.id)
        .map(item => item.cityId)
    );
    setSupplierServiceIds(
      supplierCoverage.data.servicesBySupplier
        .filter(item => item.supplierId === selected.id)
        .map(item => item.serviceTypeId)
    );
    setSupplierMediaIds(
      supplierCoverage.data.mediaBySupplier
        .filter(item => item.supplierId === selected.id)
        .map(item => item.mediaTypeId)
    );
  }, [entity?.kind, selected, supplierCoverage.data]);
  useEffect(() => {
    if (entity?.kind !== "supervisor" || !selected) return;
    setSupervisorCityIds(
      supervisorCityLinks
        .filter(link => link.commercialSupervisorId === selected.id)
        .map(link => link.cityId)
    );
  }, [entity?.kind, selected, supervisorCityLinks]);
  useEffect(() => {
    if (entity?.kind !== "product" || !selected) return;
    setProductMediaIds(
      productMediaLinks
        .filter(link => link.productTypeId === selected.id)
        .map(link => link.mediaTypeId)
    );
  }, [entity?.kind, selected, productMediaLinks]);
  useEffect(() => {
    setSelectedIds([]);
  }, [slug]);

  useEffect(() => {
    if (!createDialogOpen || !entity) return;
    setEditing(false);
    setForm(blankRegistryForm(entity.kind));
    setSupplierCityIds([]);
    setSupplierServiceIds([]);
    setSupplierMediaIds([]);
    setSupervisorCityIds([]);
    setProductMediaIds([]);
    setSubserviceParentIds([]);
  }, [createDialogOpen, entity?.kind]);

  if (!entity)
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <CircleAlert className="mx-auto h-7 w-7 text-muted-foreground" />
        <h1 className="mt-3 font-display text-xl font-semibold">
          Cadastro não encontrado
        </h1>
        <Button
          className="mt-5"
          variant="outline"
          onClick={() => setLocation("/cadastros/territorio")}
        >
          Voltar aos Cadastros
        </Button>
      </div>
    );
  if (overview.isLoading)
    return (
      <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
        Carregando {entity.plural.toLowerCase()}…
      </div>
    );
  const Icon = entity.icon;
  const canWrite = can("settings.write");
  const isTerritorial = ["regional", "city", "store"].includes(entity.kind);
  const allRelationCards = selected
    ? getRelations(entity.kind, selected, {
        providers,
        regionals,
        cities,
        stores,
        suppliers,
        mediaTypes,
        serviceTypes,
        subserviceTypes,
        serviceSubservices,
        serviceTypeRelations,
        mediaServiceCatalog,
      })
    : [];
  const relationCards = isTerritorial ? [] : allRelationCards;
  const storeSupervisors =
    selected && entity.kind === "store"
      ? supervisors.filter(supervisor =>
          supervisorStoreLinks.some(
            link =>
              link.storeId === selected.id &&
              link.commercialSupervisorId === supervisor.id
          )
        )
      : [];
  const toggleStoreSupervisor = (supervisorId: number) => {
    if (!selected || entity.kind !== "store") return;
    const currentStoreIds = supervisorStoreLinks
      .filter(link => link.commercialSupervisorId === supervisorId)
      .map(link => link.storeId);
    const storeIds = currentStoreIds.includes(selected.id)
      ? currentStoreIds.filter(id => id !== selected.id)
      : [...currentStoreIds, selected.id];
    setSupervisorStores.mutate({
      commercialSupervisorId: supervisorId,
      storeIds,
    });
  };
  function TerritorialDetailsLayout() {
    if (!selected) return null;
    const parent =
      entity.kind === "regional"
        ? providers.find(provider => provider.id === selected.providerId)
        : entity.kind === "city"
          ? regionals.find(regional => regional.id === selected.regionalId)
          : cities.find(city => city.id === selected.cityId);
    const parentLabel =
      entity.kind === "regional"
        ? "Empresa responsável"
        : entity.kind === "city"
          ? "Regional vinculada"
          : "Cidade vinculada";
    const photoUpload = (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result).split(",")[1];
        if (base64)
          uploadStorePhoto.mutate({
            storeId: selected.id,
            originalName: file.name,
            mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
            dataBase64: base64,
          });
      };
      reader.readAsDataURL(file);
    };
    const storeHours =
      entity.kind === "store"
        ? parseStoreHours(String(selected.openingHours ?? ""))
        : null;
    const contextPanel = (
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-primary/10 text-primary">
              <MapPin className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Estrutura territorial
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
                Contexto do cadastro
              </h2>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="rounded-[10px] border border-border bg-muted/30 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {parentLabel}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {parent ? recordName(parent) : "Não informado"}
              </p>
            </div>
            <div className="rounded-[10px] border border-border bg-muted/30 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Status
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {selected.active === false ? "Inativo" : "Ativo"}
              </p>
            </div>
            {selected.latitude && selected.longitude ? (
              <div className="rounded-[10px] border border-border bg-muted/30 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Coordenadas
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {String(selected.latitude)}, {String(selected.longitude)}
                </p>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
    return (
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
        <div className="space-y-5">
          <DetailOverview
            entity={entity}
            record={selected}
            parent={parent}
            parentLabel={parentLabel}
          />
          {entity.kind === "store" ? (
            <StoreSupervisorsPanel
              supervisors={supervisors}
              linkedSupervisors={storeSupervisors}
              canWrite={canWrite}
              isPending={setSupervisorStores.isPending}
              onToggle={toggleStoreSupervisor}
            />
          ) : null}
          {entity.kind === "store" ? contextPanel : null}
          {allRelationCards.length ? (
            <section className="rounded-[10px] border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-xl font-semibold text-foreground">
                    Vínculos e cobertura
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Consulte os registros relacionados a esta{" "}
                    {entity.singular.toLowerCase()}.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {allRelationCards.map(card => (
                  <button
                    key={card.label}
                    onClick={() =>
                      setExpandedRelation(current =>
                        current === card.label ? null : card.label
                      )
                    }
                    className={`rounded-[10px] border p-4 text-left transition hover:border-primary/40 ${expandedRelation === card.label ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "border-border bg-background"}`}
                  >
                    <p className="text-2xl font-semibold text-primary">
                      {card.count}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {card.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {card.description}
                    </p>
                  </button>
                ))}
              </div>
              {expandedRelation ? (
                <ExpandedRelationPanel
                  label={expandedRelation}
                  rows={
                    allRelationCards.find(
                      card => card.label === expandedRelation
                    )?.items ?? []
                  }
                  destination={
                    allRelationCards.find(
                      card => card.label === expandedRelation
                    )?.path ?? "/cadastros/territorio"
                  }
                  onOpen={(id: number) => {
                    const card = allRelationCards.find(
                      item => item.label === expandedRelation
                    );
                    if (card) setLocation(`${card.path}/${id}`);
                  }}
                  onViewAll={() => {
                    const card = allRelationCards.find(
                      item => item.label === expandedRelation
                    );
                    if (card) setLocation(card.path);
                  }}
                />
              ) : null}
            </section>
          ) : null}
        </div>
        <aside className="space-y-5">
          {entity.kind === "store" && storeHours ? (
            <StoreHoursPanel storeHours={storeHours} />
          ) : null}
          {entity.kind === "store" ? (
            <StorePhotoPanel
              store={selected}
              canWrite={canWrite}
              isPending={uploadStorePhoto.isPending}
              onUpload={photoUpload}
            />
          ) : null}
          {entity.kind !== "store" ? contextPanel : null}
        </aside>
      </section>
    );
  }
  const finishCreate = (message: string) => (created: { id: number }) => {
    toast.success(message);
    void utils.settings.overview.invalidate();
    setLocation(`/cadastros/${slug}/${created.id}`);
  };
  const save = () => {
    if (!form.name.trim()) {
      toast.error("Informe um nome para o cadastro.");
      return;
    }
    if (entity.kind === "supplier") {
      const supplierPayload = {
        providerId: form.providerId ? Number(form.providerId) : null,
        cityId: form.cityId ? Number(form.cityId) : null,
        displayName: form.name.trim(),
        address: form.address.trim() || undefined,
        legalName: form.legalName.trim() || undefined,
        document: form.document.trim(),
        contactName: form.contactName.trim() || undefined,
        phone: form.phone.trim(),
        email: form.email.trim(),
        mainService: form.mainService.trim() || undefined,
        partnershipType: form.partnershipType as "paid" | "barter" | "mixed",
        paymentMethod: form.paymentMethod.trim() || undefined,
        paymentRecurrence: form.paymentRecurrence.trim() || undefined,
        pixKey: form.pixKey.trim() || undefined,
        paymentDay: form.paymentDay ? Number(form.paymentDay) : null,
        paymentBarterValue: form.paymentBarterValue
          ? Number(form.paymentBarterValue.replace(",", "."))
          : null,
        paymentBarterService: form.paymentBarterService.trim() || undefined,
        paymentNotes: form.paymentNotes.trim() || undefined,
        contractStartsOn: form.contractStartsOn || null,
        contractEndsOn: form.contractEndsOn || null,
        hasContract: form.hasContract === "yes",
      };
      if (!selected) {
        createSupplier.mutate(supplierPayload, {
          onSuccess: created => {
            setSupplierCoverage.mutate(
              {
                supplierId: created.id,
                cityIds: supplierCityIds,
                serviceTypeIds: supplierServiceIds,
                mediaTypeIds: supplierMediaIds,
              },
              { onSuccess: () => finishCreate("Fornecedor criado.")(created) }
            );
          },
        });
        return;
      }
      if (!selected) return;
      updateSupplier.mutate(
        { id: selected.id, ...supplierPayload },
        {
          onSuccess: updated =>
            setSupplierCoverage.mutate({
              supplierId: updated.id,
              cityIds: supplierCityIds,
              serviceTypeIds: supplierServiceIds,
              mediaTypeIds: supplierMediaIds,
            }),
        }
      );
      return;
    }
    if (entity.kind === "provider_fiscal_entity") {
      if (!form.providerId) {
        toast.error("Selecione a Empresa operacional.");
        return;
      }
      if (!form.cnpj.trim()) {
        toast.error("Informe o CNPJ fiscal.");
        return;
      }
      const payload = {
        providerId: Number(form.providerId),
        name: form.name.trim(),
        legalName: form.legalName.trim() || undefined,
        cnpj: form.cnpj.trim(),
        stateRegistration: form.stateRegistration.trim() || undefined,
        municipalRegistration: form.municipalRegistration.trim() || undefined,
        address: form.address.trim() || undefined,
        cityId: form.cityId ? Number(form.cityId) : null,
        isDefault: form.isDefault === "yes",
      };
      return selected
        ? updateFiscalEntity.mutate({ id: selected.id, ...payload })
        : createFiscalEntity.mutate(payload, {
            onSuccess: finishCreate("Empresa fiscal criada."),
          });
    }
    if (entity.kind === "provider") {
      const payload = {
        name: form.name.trim(),
        legalName: form.legalName.trim() || undefined,
        billingCnpj: form.billingCnpj.trim() || undefined,
        contactName: form.contactName.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        website: form.website.trim() || undefined,
        address: form.address.trim() || undefined,
        headquartersCityId: form.headquartersCityId
          ? Number(form.headquartersCityId)
          : null,
        brandColors: form.brandColors
          .split(",")
          .map(color => color.trim())
          .filter(Boolean),
      };
      return selected
        ? updateProvider.mutate({ id: selected.id, ...payload })
        : createProvider.mutate(payload, {
            onSuccess: finishCreate("Empresa criada."),
          });
    }
    if (entity.kind === "regional") {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        providerId: form.providerId ? Number(form.providerId) : null,
      };
      return selected
        ? updateRegional.mutate({ id: selected.id, ...payload })
        : createRegional.mutate(payload, {
            onSuccess: finishCreate("Regional criada."),
          });
    }
    if (entity.kind === "city") {
      const payload = {
        name: form.name.trim(),
        state: form.state.trim().toUpperCase(),
        regionalId: Number(form.regionalId),
        ibgeCode: form.ibgeCode.trim() || undefined,
        address: form.address.trim() || undefined,
        zipCode: form.zipCode.trim() || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        locationNotes: form.locationNotes.trim() || undefined,
      };
      return selected
        ? updateCity.mutate({ id: selected.id, ...payload })
        : createCity.mutate(payload, {
            onSuccess: finishCreate("Cidade criada."),
          });
    }
    if (entity.kind === "store") {
      const payload = {
        cityId: Number(form.cityId),
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        address: form.address.trim() || undefined,
        referencePoint: form.referencePoint.trim() || undefined,
        zipCode: form.zipCode.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        openingHours: form.openingHours.trim() || undefined,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
      };
      return selected
        ? updateStore.mutate({
            id: selected.id,
            ...payload,
            active: selected.active !== false,
          })
        : createStore.mutate(payload, {
            onSuccess: finishCreate("Loja criada."),
          });
    }
    if (entity.kind === "partner") {
      const payload = {
        cityId: form.cityId ? Number(form.cityId) : null,
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        partnershipType: form.partnershipType as "paid" | "barter" | "mixed",
        paymentMethod: form.paymentMethod.trim() || undefined,
        paymentRecurrence: form.paymentRecurrence.trim() || undefined,
        hasContract: form.hasContract === "yes",
      };
      return selected
        ? updatePartner.mutate({ id: selected.id, ...payload })
        : createPartner.mutate(payload, {
            onSuccess: finishCreate("Parceiro criado."),
          });
    }
    if (entity.kind === "supervisor") {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
      };
      const saveCities = (supervisorId: number, created?: { id: number }) =>
        setSupervisorCities.mutate(
          { commercialSupervisorId: supervisorId, cityIds: supervisorCityIds },
          {
            onSuccess: () =>
              created
                ? finishCreate("Supervisor criado.")(created)
                : (setEditing(false),
                  void utils.settings.overview.invalidate()),
          }
        );
      return selected
        ? updateSupervisor.mutate(
            { id: selected.id, ...payload },
            {
              onSuccess: updated => saveCities(updated.id),
            }
          )
        : createSupervisor.mutate(
            { userId: null, ...payload },
            { onSuccess: created => saveCities(created.id, created) }
          );
    }
    if (
      [
        "service",
        "subservice",
        "product",
        "media",
        "action",
        "event",
        "campaign",
        "campaign_sector",
      ].includes(entity.kind)
    ) {
      const kind = entity.kind as
        | "service"
        | "subservice"
        | "media"
        | "product"
        | "action"
        | "event"
        | "campaign"
        | "campaign_sector";
      if (kind === "subservice" && !subserviceParentIds.length) {
        toast.error("Selecione ao menos um Serviço principal para o SubServiço.");
        return;
      }
      const payload = {
        kind,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        ...(kind === "media"
          ? {
              operationCategory: form.operationCategory as
                | "graphics"
                | "audio_video"
                | "leafleting"
                | "sound_car"
                | "influencers",
              parentMediaTypeId: form.parentMediaTypeId
                ? Number(form.parentMediaTypeId)
                : null,
            }
          : {}),
        ...(kind === "service"
          ? {
              mediaTypeId: form.mediaTypeId ? Number(form.mediaTypeId) : null,
              parentServiceTypeId: null,
              subserviceParentIds: [],
            }
          : {}),
        ...(kind === "subservice"
          ? {
              parentServiceTypeId: subserviceParentIds[0] ?? null,
              subserviceParentIds,
              unit: form.unit.trim() || "unidade",
            }
          : {}),
      };
      const saveMediaLinks = (
        productTypeId: number,
        created?: { id: number }
      ) =>
        kind === "product"
          ? setProductMediaTypes.mutate(
              { productTypeId, mediaTypeIds: productMediaIds },
              {
                onSuccess: () =>
                  created
                    ? finishCreate("Tipo de produto criado.")(created)
                    : (setEditing(false),
                      void utils.settings.overview.invalidate()),
              }
            )
          : created
            ? finishCreate("Cadastro criado.")(created)
            : undefined;
      return selected
        ? updateType.mutate(
            { id: selected.id, ...payload },
            {
              onSuccess: updated => saveMediaLinks(updated.id),
            }
          )
        : createType.mutate(payload, {
            onSuccess: created => saveMediaLinks(created.id, created),
          });
    }
    if (entity.kind === "financial_category") {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
      };
      return selected
        ? updateFinancialCategory.mutate({ id: selected.id, ...payload })
        : createFinancialCategory.mutate(payload, {
            onSuccess: finishCreate("Categoria financeira criada."),
          });
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <nav className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
              <button
                onClick={() =>
                  setLocation(
                    `/cadastros/${registryGroups[entity.kind] ?? "territorio"}`
                  )
                }
                className="hover:text-primary"
              >
                Cadastros
              </button>
              <ChevronRight className="h-3 w-3" />
              <button
                onClick={() => setLocation(`/cadastros/${slug}`)}
                className="hover:text-primary"
              >
                {entity.plural}
              </button>
              {selected ? (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span className="max-w-52 truncate text-foreground">
                    {recordName(selected)}
                  </span>
                </>
              ) : null}
            </nav>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
              {selected ? recordName(selected) : entity.plural}
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              {entity.description}
            </p>
          </div>
        </div>
        {!selected ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/cadastros")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar aos Cadastros
            </Button>
            {canWrite ? (
              <>
                <Button
                  type="button"
                  onClick={() => setCreateDialogOpen(true)}
                  className="bg-primary text-primary-foreground"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar {entity.singular.toLowerCase()}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {!selected ? (
        <Dialog
          open={createDialogOpen}
          onOpenChange={open => {
            setCreateDialogOpen(open);
            if (!open) setForm({});
          }}
        >
          <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Novo {entity.singular.toLowerCase()}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados principais e os vínculos deste cadastro.
              </DialogDescription>
            </DialogHeader>
            {entity.kind === "supplier" ? (
              <SupplierEditor
                form={form}
                setForm={setForm}
                providers={providers}
                cities={cities}
                serviceTypes={serviceTypes}
                mediaTypes={mediaTypes}
                cityIds={supplierCityIds}
                setCityIds={setSupplierCityIds}
                serviceIds={supplierServiceIds}
                setServiceIds={setSupplierServiceIds}
                mediaIds={supplierMediaIds}
                setMediaIds={setSupplierMediaIds}
                onSave={save}
                saving={
                  createSupplier.isPending || setSupplierCoverage.isPending
                }
                isCreating
              />
            ) : (
              <RegistryEditor
                kind={entity.kind}
                isSubservicePage={isSubservicePage}
                form={form}
                setForm={setForm}
                providers={providers}
                regionals={regionals}
                cities={cities}
                mediaTypes={mediaTypes}
                serviceTypes={serviceTypes}
                subserviceParentIds={subserviceParentIds}
                setSubserviceParentIds={setSubserviceParentIds}
                supervisorCityIds={supervisorCityIds}
                setSupervisorCityIds={setSupervisorCityIds}
                productMediaIds={productMediaIds}
                setProductMediaIds={setProductMediaIds}
                onSave={save}
                saving={
                  createProvider.isPending ||
                  createFiscalEntity.isPending ||
                  updateFiscalEntity.isPending ||
                  createRegional.isPending ||
                  createCity.isPending ||
                  createStore.isPending ||
                  createPartner.isPending ||
                  createSupervisor.isPending ||
                  createType.isPending ||
                  createFinancialCategory.isPending
                }
                isCreating
              />
            )}
          </DialogContent>
        </Dialog>
      ) : null}
      {!selected ? (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="relative min-w-0 flex-1 max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={`Pesquisar ${entity.plural.toLowerCase()}…`}
                className="pl-9"
                aria-label="Pesquisar"
              />
            </div>
            <p className="text-sm font-medium text-foreground">
              {filteredRows.length} de {rows.length} cadastros
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFiltersOpen(value => !value)}
              aria-expanded={filtersOpen}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filtros
            </Button>
          </div>
          {filtersOpen ? (
            <div className="mb-4 space-y-4 rounded-2xl border border-border bg-card p-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <select
                  aria-label="Status"
                  value={activeFilter}
                  onChange={event =>
                    setActiveFilter(event.target.value as typeof activeFilter)
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Todos os status</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                </select>
                <select
                  aria-label="Empresa"
                  value={companyFilter}
                  onChange={event => setCompanyFilter(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Todas as empresas</option>
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {recordName(provider)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Regional"
                  value={regionalFilter}
                  onChange={event => setRegionalFilter(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Todas as regionais</option>
                  {regionals.map(regional => (
                    <option key={regional.id} value={regional.id}>
                      {recordName(regional)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Cidade"
                  value={cityFilter}
                  onChange={event => setCityFilter(event.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Todas as cidades</option>
                  {cities.map(city => (
                    <option key={city.id} value={city.id}>
                      {recordName(city)}
                      {city.state ? `/${city.state}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="ghost" onClick={clearFilters}>
                  Redefinir filtros
                </Button>
              </div>
            </div>
          ) : null}
          {canWrite ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  disabled={!filteredRows.length || removeMany.isPending}
                  className="h-4 w-4 accent-primary"
                />
                Selecionar todos os visíveis
              </label>
              {selectedIds.length ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-muted-foreground">{selectedIds.length} selecionado(s)</span>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={removeMany.isPending}
                    onClick={() => {
                      if (!window.confirm(`Excluir ${selectedIds.length} cadastro(s)? Esta ação não pode ser desfeita.`)) return;
                      removeMany.mutate({ kind: entity.kind as never, ids: selectedIds });
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir selecionados
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          {entity.kind === "supplier" ? (
            <SupplierDirectory
              rows={filteredRows}
              providers={providers}
              cities={cities}
              selectedIds={selectedIds}
              onToggle={toggleSelected}
              onOpen={id => setLocation(`/cadastros/${slug}/${id}`)}
            />
          ) : (
            <div className="hub-list">
              {filteredRows.map(row => (
                <div key={row.id} className="relative">
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${recordName(row)}`}
                    checked={selectedIds.includes(row.id)}
                    onChange={() => toggleSelected(row.id)}
                    className="absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 accent-primary"
                  />
                <button
                  type="button"
                  onClick={() => setLocation(`/cadastros/${slug}/${row.id}`)}
                  className="hub-list-item grid w-full gap-3 p-4 pl-11 text-left sm:grid-cols-[auto_minmax(0,1.3fr)_minmax(190px,.8fr)_auto] sm:items-center"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-primary">
                    {entity.kind === "provider" &&
                    typeof row.logoUrl === "string" &&
                    row.logoUrl ? (
                      <img
                        src={row.logoUrl}
                        alt={`Logo de ${recordName(row)}`}
                        className="h-full w-full object-contain bg-background p-1"
                      />
                    ) : entity.kind === "store" &&
                      typeof row.photoUrl === "string" &&
                      row.photoUrl ? (
                      <img
                        src={row.photoUrl}
                        alt={`Foto de ${recordName(row)}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate font-display text-base font-semibold text-foreground">
                      {recordName(row)}
                    </strong>
                    <span className="mt-1 block break-words text-sm text-muted-foreground">
                      {summary(entity.kind, row, {
                        providers,
                        regionals,
                        cities,
                      })}
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        row.active === false
                          ? "border-border text-muted-foreground"
                          : "border-primary/30 bg-primary/10 text-primary"
                      }
                    >
                      {row.active === false ? "Inativo" : "Ativo"}
                    </Badge>
                    {row.code ? (
                      <Badge variant="secondary">{String(row.code)}</Badge>
                    ) : null}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 justify-self-end text-primary" />
                </button>
                </div>
              ))}
              {filteredRows.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum cadastro encontrado para a busca ou filtro
                    selecionado.
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-5">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setLocation(`/cadastros/${slug}`)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar à lista
            </Button>
            {canWrite ? (
              <Button
                onClick={() => setEditing(value => !value)}
                className="bg-primary text-primary-foreground"
              >
                <Pencil className="mr-2 h-4 w-4" />
                {editing ? "Cancelar edição" : "Editar informações"}
              </Button>
            ) : null}
            {canWrite ? (
              <Button
                variant="outline"
                disabled={setActive.isPending}
                onClick={() =>
                  setActive.mutate({
                    kind: entity.kind as never,
                    id: selected.id,
                    active: selected.active === false,
                  })
                }
              >
                <Power className="mr-2 h-4 w-4" />
                {selected.active === false ? "Ativar" : "Inativar"}
              </Button>
            ) : null}
            {canWrite ? (
              <Button
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => {
                  const deletionMessage =
                    entity.kind === "provider"
                      ? `Excluir ${entity.singular.toLowerCase()}? Regionais e fornecedores vinculados serão desvinculados da empresa, preservando os demais dados.`
                      : `Excluir ${entity.singular.toLowerCase()}? A exclusão só será concluída se não houver vínculos operacionais dependentes.`;
                  if (window.confirm(deletionMessage)) {
                    if (entity.kind === "provider_fiscal_entity") {
                      removeFiscalEntity.mutate({ id: selected.id });
                    } else {
                      remove.mutate({
                        kind: entity.kind as never,
                        id: selected.id,
                      });
                    }
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            ) : null}
          </div>
          {editing ? (
            entity.kind === "supplier" ? (
              <SupplierEditor
                form={form}
                setForm={setForm}
                providers={providers}
                cities={cities}
                serviceTypes={serviceTypes}
                mediaTypes={mediaTypes}
                cityIds={supplierCityIds}
                setCityIds={setSupplierCityIds}
                serviceIds={supplierServiceIds}
                setServiceIds={setSupplierServiceIds}
                mediaIds={supplierMediaIds}
                setMediaIds={setSupplierMediaIds}
                onSave={save}
                saving={
                  updateSupplier.isPending || setSupplierCoverage.isPending
                }
              />
            ) : (
              <RegistryEditor
                kind={entity.kind}
                isSubservicePage={isSubservicePage}
                form={form}
                setForm={setForm}
                providers={providers}
                regionals={regionals}
                cities={cities}
                mediaTypes={mediaTypes}
                serviceTypes={serviceTypes}
                subserviceParentIds={subserviceParentIds}
                setSubserviceParentIds={setSubserviceParentIds}
                supervisorCityIds={supervisorCityIds}
                setSupervisorCityIds={setSupervisorCityIds}
                productMediaIds={productMediaIds}
                setProductMediaIds={setProductMediaIds}
                onSave={save}
                saving={
                  updateProvider.isPending ||
                  updateFiscalEntity.isPending ||
                  updateRegional.isPending ||
                  updateCity.isPending ||
                  updateStore.isPending ||
                  updatePartner.isPending ||
                  updateSupervisor.isPending ||
                  updateType.isPending ||
                  updateFinancialCategory.isPending
                }
              />
            )
          ) : isTerritorial ? (
            <TerritorialDetailsLayout />
          ) : (
            <>
              <DetailOverview entity={entity} record={selected} />
              {entity.kind === "supervisor" ? (
                <SupervisorCitiesPanel
                  cities={cities.filter(city =>
                    supervisorCityIds.includes(city.id)
                  )}
                />
              ) : null}
              {entity.kind === "product" ? (
                <ProductMediaPanel
                  mediaTypes={mediaTypes.filter(type =>
                    productMediaIds.includes(type.id)
                  )}
                />
              ) : null}
            </>
          )}
          {entity.kind === "provider" ? (
            <>
              <ProviderLogoPanel
                provider={selected}
                canWrite={canWrite}
                isPending={uploadProviderLogo.isPending}
                onUpload={(file: File) => {
                  const reader = new FileReader();
                  reader.onload = () => {
                    const base64 = String(reader.result).split(",")[1];
                    if (base64)
                      uploadProviderLogo.mutate({
                        providerId: selected.id,
                        originalName: file.name,
                        mimeType: file.type as
                          | "image/jpeg"
                          | "image/png"
                          | "image/webp",
                        dataBase64: base64,
                      });
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <ProviderDocumentPanel
                  provider={selected}
                  kind="cnpj"
                  canWrite={canWrite}
                  isPending={uploadProviderCnpjCard.isPending}
                  onUpload={(file: File) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                      const base64 = String(reader.result).split(",")[1];
                      if (base64)
                        uploadProviderCnpjCard.mutate({
                          providerId: selected.id,
                          originalName: file.name,
                          mimeType: file.type as
                            | "application/pdf"
                            | "image/jpeg"
                            | "image/png"
                            | "image/webp",
                          dataBase64: base64,
                        });
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                <ProviderDocumentPanel
                  provider={selected}
                  kind="manual"
                  canWrite={canWrite}
                  isPending={uploadProviderBrandManual.isPending}
                  onUpload={(file: File) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                      const base64 = String(reader.result).split(",")[1];
                      if (base64)
                        uploadProviderBrandManual.mutate({
                          providerId: selected.id,
                          originalName: file.name,
                          mimeType: file.type as
                            | "application/pdf"
                            | "image/jpeg"
                            | "image/png"
                            | "image/webp",
                          dataBase64: base64,
                        });
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </div>
            </>
          ) : null}
          {entity.kind === "store" && editing ? (
            <StorePhotoPanel
              store={selected}
              canWrite={canWrite}
              isPending={uploadStorePhoto.isPending}
              onUpload={(file: File) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const base64 = String(reader.result).split(",")[1];
                  if (base64)
                    uploadStorePhoto.mutate({
                      storeId: selected.id,
                      originalName: file.name,
                      mimeType: file.type as
                        | "image/jpeg"
                        | "image/png"
                        | "image/webp",
                      dataBase64: base64,
                    });
                };
                reader.readAsDataURL(file);
              }}
            />
          ) : null}
          {entity.kind === "supplier" ? (
            <SupplierPhotoPanel
              supplier={selected}
              canWrite={canWrite}
              isPending={uploadSupplierPhoto.isPending}
              onUpload={(file: File) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const base64 = String(reader.result).split(",")[1];
                  if (base64)
                    uploadSupplierPhoto.mutate({
                      supplierId: selected.id,
                      originalName: file.name,
                      mimeType: file.type as
                        | "image/jpeg"
                        | "image/png"
                        | "image/webp",
                      dataBase64: base64,
                    });
                };
                reader.readAsDataURL(file);
              }}
            />
          ) : null}
          {entity.kind === "supplier" ? (
            <SupplierContractAttachmentPanel
              supplier={selected}
              canWrite={canWrite}
              isPending={uploadSupplierContract.isPending}
              onUpload={async (file: File) => {
                const base64 = await fileToBase64(file);
                uploadSupplierContract.mutate({
                  entityType: "supplier",
                  entityId: selected.id,
                  originalName: file.name,
                  mimeType: file.type as
                    | "application/pdf"
                    | "image/jpeg"
                    | "image/png"
                    | "image/webp",
                  dataBase64: base64,
                });
              }}
            />
          ) : null}
          {entity.kind === "supplier" ? (
            <SupplierContractsPanel
              supplierId={selected.id}
              canWrite={canWrite}
            />
          ) : null}
          {entity.kind === "store" && editing ? (
            <StoreSupervisorsPanel
              supervisors={supervisors}
              linkedSupervisors={storeSupervisors}
              canWrite={canWrite}
              isPending={setSupervisorStores.isPending}
              onToggle={toggleStoreSupervisor}
            />
          ) : null}
          {entity.kind === "supplier" ? (
            <SupplierDetailsPanel
              supplier={selected}
              cities={cities}
              serviceTypes={serviceTypes}
              mediaTypes={mediaTypes}
              offerings={supplierOfferings}
              coverage={supplierCoverage.data}
              footprint={operationalFootprint}
            />
          ) : null}
          {relationCards.length ? (
            <section>
              <h2 className="font-display text-xl font-semibold text-foreground">
                Vínculos e cobertura
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Consulte os registros vinculados sem sair desta ficha.
              </p>
              <div className="mt-3 hub-list">
                {relationCards.map(card => (
                  <button
                    key={card.label}
                    onClick={() =>
                      setExpandedRelation(current =>
                        current === card.label ? null : card.label
                      )
                    }
                    className={`hub-list-item p-4 text-left transition ${expandedRelation === card.label ? "border-primary ring-2 ring-primary/10" : ""}`}
                  >
                    <p className="text-2xl font-semibold text-primary">
                      {card.count}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {card.label}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {card.description}
                    </p>
                  </button>
                ))}
              </div>
              {expandedRelation ? (
                <ExpandedRelationPanel
                  label={expandedRelation}
                  rows={
                    relationCards.find(card => card.label === expandedRelation)
                      ?.items ?? []
                  }
                  destination={
                    relationCards.find(card => card.label === expandedRelation)
                      ?.path ??
                    `/cadastros/${registryGroups[entity.kind] ?? "territorio"}`
                  }
                  onOpen={(id: number) => {
                    const card = relationCards.find(
                      item => item.label === expandedRelation
                    );
                    if (card) setLocation(`${card.path}/${id}`);
                  }}
                  onViewAll={() => {
                    const card = relationCards.find(
                      item => item.label === expandedRelation
                    );
                    if (card) setLocation(card.path);
                  }}
                />
              ) : null}
            </section>
          ) : null}
        </section>
      )}
    </div>
  );
}

function DetailOverview({
  entity,
  record,
  parent,
  parentLabel,
}: {
  entity: EntityConfig;
  record: RegistryRecord;
  parent?: RegistryRecord;
  parentLabel?: string;
}) {
  const phoneUrl = whatsappUrl(record.phone as string | null | undefined);
  const websiteUrl =
    typeof record.website === "string" && record.website.trim()
      ? record.website
      : null;
  const entries = Object.entries({
    Status: record.active === false ? "Inativo" : "Ativo",
    ...(parentLabel
      ? { [parentLabel]: parent ? recordName(parent) : "Não informado" }
      : {}),
    Código: record.code,
    CNPJ: record.billingCnpj ?? record.document,
    Contato: record.contactName,
    "E-mail": record.email,
    Site: websiteUrl,
    Telefone: record.phone,
    "Serviço principal": record.mainService,
    Endereço: record.address,
    "Ponto de referência": record.referencePoint,
    CEP: record.zipCode,
    ...(entity.kind !== "store"
      ? {
          "Horário de funcionamento":
            typeof record.openingHours === "string"
              ? formatStoreHours(record.openingHours)
              : record.openingHours,
        }
      : {}),
    UF: record.state,
    IBGE: record.ibgeCode,
    Latitude: record.latitude,
    Longitude: record.longitude,
    Observações: record.locationNotes ?? record.description,
  }).filter(
    ([, value]) => value !== null && value !== undefined && value !== ""
  );
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Informações do cadastro
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold">
              {recordName(record)}
            </h2>
          </div>
          <Badge
            variant="outline"
            className={
              record.active === false
                ? "text-muted-foreground"
                : "border-primary/30 bg-primary/10 text-primary"
            }
          >
            {record.active === false ? "Inativo" : "Ativo"}
          </Badge>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-muted/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className="mt-1 break-words text-sm text-foreground">
                {String(value)}
              </p>
            </div>
          ))}
        </div>
        {phoneUrl ? (
          <a
            className="mt-5 inline-flex items-center text-sm font-semibold text-primary hover:underline"
            href={phoneUrl}
            target="_blank"
            rel="noreferrer"
          >
            Conversar pelo WhatsApp{" "}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        ) : null}
        {entity.kind === "provider" && websiteUrl ? (
          <a
            className="mt-3 inline-flex items-center text-sm font-semibold text-primary hover:underline"
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
          >
            Abrir site da empresa{" "}
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SupervisorCitiesPanel({ cities }: { cities: RegistryRecord[] }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Cobertura territorial
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
          Cidades vinculadas
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {cities.length ? (
            cities.map(city => (
              <Badge key={city.id} variant="secondary">
                {recordName(city)}
                {city.state ? ` · ${city.state}` : ""}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma cidade vinculada a este supervisor.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ProductMediaPanel({ mediaTypes }: { mediaTypes: RegistryRecord[] }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Aplicação do catálogo
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
          Tipos de mídia vinculados
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {mediaTypes.length ? (
            mediaTypes.map(media => (
              <Badge key={media.id} variant="secondary">
                {recordName(media)}
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum tipo de mídia vinculado a este produto.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StoreHoursPanel({
  storeHours,
}: {
  storeHours: ReturnType<typeof parseStoreHours>;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Operação da loja
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
              Horário de funcionamento
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Dias e horários cadastrados para esta unidade.
            </p>
          </div>
          <Clock3 className="h-5 w-5 text-primary" />
        </div>
        <div className="mt-5 grid grid-cols-1 gap-2">
          {STORE_WEEKDAYS.map(({ key, label }) => {
            const day = storeHours[key];
            return (
              <div
                key={key}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${day.enabled ? "border-primary/20 bg-primary/5" : "border-border bg-muted/20"}`}
              >
                <span className="text-sm font-medium text-foreground">
                  {label}
                </span>
                <span className="text-sm text-muted-foreground">
                  {day.enabled
                    ? `${day.open || "--:--"} – ${day.close || "--:--"}`
                    : "Fechado"}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function StoreSupervisorsPanel({
  supervisors,
  linkedSupervisors,
  canWrite,
  isPending,
  onToggle,
}: {
  supervisors: RegistryRecord[];
  linkedSupervisors: RegistryRecord[];
  canWrite: boolean;
  isPending: boolean;
  onToggle: (supervisorId: number) => void;
}) {
  const linkedIds = new Set(linkedSupervisors.map(supervisor => supervisor.id));
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Cobertura comercial
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
              Supervisores vinculados
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Uma loja pode estar sob a responsabilidade de mais de um
              supervisor comercial.
            </p>
          </div>
          <Badge
            variant="outline"
            className="w-fit border-primary/30 bg-primary/10 text-primary"
          >
            {linkedSupervisors.length} vinculados
          </Badge>
        </div>
        {supervisors.length ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {supervisors.map(supervisor => {
              const linked = linkedIds.has(supervisor.id);
              return (
                <div
                  key={supervisor.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${linked ? "border-primary/30 bg-primary/5" : "border-border bg-muted/30"}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {recordName(supervisor)}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {String(
                        supervisor.email ??
                          supervisor.phone ??
                          "Sem contato informado"
                      )}
                    </p>
                  </div>
                  {canWrite ? (
                    <Button
                      type="button"
                      variant={linked ? "outline" : "secondary"}
                      size="sm"
                      disabled={isPending}
                      onClick={() => onToggle(supervisor.id)}
                    >
                      {linked ? "Desvincular" : "Vincular"}
                    </Button>
                  ) : (
                    <Badge variant="outline">
                      {linked ? "Vinculado" : "Não vinculado"}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nenhum supervisor comercial foi cadastrado ainda.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ProviderLogoPanel({
  provider,
  canWrite,
  isPending,
  onUpload,
}: {
  provider: RegistryRecord;
  canWrite: boolean;
  isPending: boolean;
  onUpload: (file: File) => void;
}) {
  const logoUrl =
    typeof provider.logoUrl === "string" ? provider.logoUrl : null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <div className="grid h-28 w-40 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted/50">
          <input
            id="provider-logo-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={!canWrite || isPending}
            onChange={event => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 3 * 1024 * 1024) {
                toast.error("O logotipo deve ter até 3 MB.");
                return;
              }
              onUpload(file);
              event.currentTarget.value = "";
            }}
          />
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`Logotipo de ${recordName(provider)}`}
              className="h-full w-full object-contain p-2"
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Identidade da empresa
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-foreground">
            Logotipo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie PNG, JPG ou WEBP de até 3 MB. A imagem é exibida sem corte na
            ficha empresarial.
          </p>
          {canWrite ? (
            <label htmlFor="provider-logo-upload">
              <Button
                type="button"
                asChild
                disabled={isPending}
                className="mt-4 bg-primary"
              >
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  {isPending
                    ? "Enviando…"
                    : logoUrl
                      ? "Substituir logotipo"
                      : "Adicionar logotipo"}
                </span>
              </Button>
            </label>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderDocumentPanel({
  provider,
  kind,
  canWrite,
  isPending,
  onUpload,
}: {
  provider: RegistryRecord;
  kind: "cnpj" | "manual";
  canWrite: boolean;
  isPending: boolean;
  onUpload: (file: File) => void;
}) {
  const isCnpj = kind === "cnpj";
  const label = isCnpj ? "Cartão CNPJ" : "Manual da marca";
  const url =
    typeof provider[isCnpj ? "cnpjCardUrl" : "brandManualUrl"] === "string"
      ? String(provider[isCnpj ? "cnpjCardUrl" : "brandManualUrl"])
      : null;
  const inputId = `provider-${kind}-upload`;
  return (
    <Card>
      <CardContent className="p-5">
        <input
          id={inputId}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={!canWrite || isPending}
          onChange={event => {
            const file = event.target.files?.[0];
            if (!file) return;
            const limit = isCnpj ? 5 : 10;
            if (file.size > limit * 1024 * 1024) {
              toast.error(`${label} deve ter até ${limit} MB.`);
              return;
            }
            onUpload(file);
            event.currentTarget.value = "";
          }}
        />
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Documento institucional
        </p>
        <h2 className="mt-1 font-display text-lg font-semibold text-foreground">
          {label}
        </h2>
        <p className="mt-2 min-h-10 text-sm text-muted-foreground">
          {url
            ? "Documento disponível para consulta."
            : "Anexe um PDF ou imagem para centralizar esta informação institucional."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {url ? (
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Abrir
              </a>
            </Button>
          ) : null}
          {canWrite ? (
            <label htmlFor={inputId}>
              <Button
                type="button"
                size="sm"
                asChild
                disabled={isPending}
                className="bg-primary"
              >
                <span>
                  <Upload className="mr-2 h-3.5 w-3.5" />
                  {isPending ? "Enviando…" : url ? "Substituir" : "Anexar"}
                </span>
              </Button>
            </label>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function StorePhotoPanel({
  store,
  canWrite,
  isPending,
  onUpload,
}: {
  store: RegistryRecord;
  canWrite: boolean;
  isPending: boolean;
  onUpload: (file: File) => void;
}) {
  const photoUrl = typeof store.photoUrl === "string" ? store.photoUrl : null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <div className="grid aspect-square h-40 w-40 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted/50 sm:h-44 sm:w-44">
          <input
            id="store-photo-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={!canWrite || isPending}
            onChange={event => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) {
                toast.error("A foto da loja deve ter até 5 MB.");
                return;
              }
              onUpload(file);
              event.currentTarget.value = "";
            }}
          />
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`Foto de ${recordName(store)}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Identificação da unidade
          </p>
          <h2 className="mt-1 font-display text-lg font-semibold text-foreground">
            Foto da loja
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Envie PNG, JPG ou WEBP de até 5 MB. A imagem ajuda a reconhecer a
            unidade em seus vínculos operacionais.
          </p>
          {canWrite ? (
            <label htmlFor="store-photo-upload">
              <Button
                type="button"
                asChild
                disabled={isPending}
                className="mt-4 bg-primary"
              >
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  {isPending
                    ? "Enviando…"
                    : photoUrl
                      ? "Substituir foto"
                      : "Adicionar foto"}
                </span>
              </Button>
            </label>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

type SupplierCoverage = {
  citiesBySupplier: Array<{ supplierId: number; cityId: number }>;
  servicesBySupplier: Array<{ supplierId: number; serviceTypeId: number }>;
  mediaBySupplier: Array<{ supplierId: number; mediaTypeId: number }>;
};
type SupplierOperationalFootprint = {
  actions?: Array<{ id: number; name: string; cityId: number }>;
  events?: Array<{ id: number; name: string; cityId: number }>;
  mediaPoints?: Array<{
    id: number;
    name: string;
    cityId: number;
    supplierId: number | null;
  }>;
  actionSuppliers?: Array<{ actionId: number; supplierId: number }>;
  eventSuppliers?: Array<{ eventId: number; supplierId: number }>;
};

function SupplierPhotoPanel({
  supplier,
  canWrite,
  isPending,
  onUpload,
}: {
  supplier: RegistryRecord;
  canWrite: boolean;
  isPending: boolean;
  onUpload: (file: File) => void;
}) {
  const photoUrl =
    typeof supplier.photoUrl === "string" ? supplier.photoUrl : null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted/50">
          <input
            id="supplier-photo-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={!canWrite || isPending}
            onChange={event => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 3 * 1024 * 1024) {
                toast.error("A foto deve ter até 3 MB.");
                return;
              }
              onUpload(file);
              event.currentTarget.value = "";
            }}
          />
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`Foto de ${recordName(supplier)}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Identificação visual
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
            Foto do fornecedor
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Esta foto será usada nos fornecedores envolvidos nas fichas de
            Ações.
          </p>
          {canWrite ? (
            <label
              htmlFor="supplier-photo-upload"
              className="mt-4 inline-flex w-fit cursor-pointer items-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isPending
                ? "Enviando…"
                : photoUrl
                  ? "Trocar foto"
                  : "Adicionar foto"}
            </label>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SupplierDetailsPanel({
  supplier,
  cities,
  serviceTypes,
  mediaTypes,
  offerings,
  coverage,
  footprint,
}: {
  supplier: RegistryRecord;
  cities: RegistryRecord[];
  serviceTypes: RegistryRecord[];
  mediaTypes: RegistryRecord[];
  offerings: RegistryRecord[];
  coverage?: SupplierCoverage;
  footprint: SupplierOperationalFootprint;
}) {
  const cityIds = new Set(
    (coverage?.citiesBySupplier ?? [])
      .filter(item => item.supplierId === supplier.id)
      .map(item => item.cityId)
  );
  if (supplier.cityId) cityIds.add(Number(supplier.cityId));
  const serviceIds = new Set(
    (coverage?.servicesBySupplier ?? [])
      .filter(item => item.supplierId === supplier.id)
      .map(item => item.serviceTypeId)
  );
  const mediaIds = new Set(
    (coverage?.mediaBySupplier ?? [])
      .filter(item => item.supplierId === supplier.id)
      .map(item => item.mediaTypeId)
  );
  const supplierOffers = offerings.filter(
    item => Number(item.supplierId) === supplier.id
  );
  const averageCost = supplierOffers.length
    ? supplierOffers.reduce(
        (total, item) => total + Number(item.unitPrice ?? 0),
        0
      ) / supplierOffers.length
    : 0;
  const actionIds = new Set(
    (footprint.actionSuppliers ?? [])
      .filter(item => item.supplierId === supplier.id)
      .map(item => item.actionId)
  );
  const eventIds = new Set(
    (footprint.eventSuppliers ?? [])
      .filter(item => item.supplierId === supplier.id)
      .map(item => item.eventId)
  );
  const actions = (footprint.actions ?? []).filter(item =>
    actionIds.has(item.id)
  );
  const events = (footprint.events ?? []).filter(item => eventIds.has(item.id));
  const mediaPoints = (footprint.mediaPoints ?? []).filter(
    item => item.supplierId === supplier.id
  );
  const linkedCities = cities.filter(item => cityIds.has(item.id));
  const linkedServices = serviceTypes.filter(item => serviceIds.has(item.id));
  const linkedMedia = mediaTypes.filter(item => mediaIds.has(item.id));
  const money = (value: unknown) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(value ?? 0));
  const names = (items: RegistryRecord[], empty = "Não informado") =>
    items.length ? items.map(recordName).join(", ") : empty;
  const paymentType =
    supplier.partnershipType === "barter"
      ? "Permuta"
      : supplier.partnershipType === "mixed"
        ? "Misto"
        : "Pago";
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
      <div className="space-y-5">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  Dados do fornecedor
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">
                  Identificação e contrato
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Visão relacional do fornecedor
                </p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Todos os dados cadastrados no fluxo de cinco etapas.
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  supplier.active === false
                    ? "text-muted-foreground"
                    : "border-primary/30 bg-primary/10 text-primary"
                }
              >
                {supplier.active === false ? "Inativo" : "Ativo"}
              </Badge>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <RelationInfo title="Nome" value={recordName(supplier)} />
              <RelationInfo
                title="Razão social"
                value={String(supplier.legalName ?? "Não informado")}
              />
              <RelationInfo
                title="CNPJ"
                value={String(supplier.document ?? "Não informado")}
              />
              <RelationInfo
                title="Endereço"
                value={String(supplier.address ?? "Não informado")}
              />
              <RelationInfo
                title="Contrato"
                value={
                  supplier.hasContract
                    ? "Contrato cadastrado"
                    : "Sem contrato informado"
                }
              />
              <RelationInfo
                title="Período do contrato"
                value={
                  supplier.contractStartsOn || supplier.contractEndsOn
                    ? `${String(supplier.contractStartsOn ?? "Início não informado")} até ${String(supplier.contractEndsOn ?? "Fim não informado")}`
                    : "Não informado"
                }
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Dados de pagamento
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
              Condições comerciais
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <RelationInfo title="Tipo de pagamento" value={paymentType} />
              <RelationInfo
                title="Dia de pagamento"
                value={String(
                  supplier.paymentDay ??
                    supplier.paymentRecurrence ??
                    "Não informado"
                )}
              />
              <RelationInfo
                title="Forma de pagamento"
                value={String(supplier.paymentMethod ?? "Não informado")}
              />
              <RelationInfo
                title="Valor da permuta"
                value={
                  supplier.paymentBarterValue
                    ? money(supplier.paymentBarterValue)
                    : "Não informado"
                }
              />
              <RelationInfo
                title="Serviço oferecido na permuta"
                value={String(supplier.paymentBarterService ?? "Não informado")}
              />
              <RelationInfo
                title="Observações"
                value={String(supplier.paymentNotes ?? "Não informado")}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Serviços e produtos
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
              Oferta comercial cadastrada
            </h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <RelationInfo
                title="Serviços vinculados"
                value={names(linkedServices)}
              />
              <RelationInfo title="Tipos de mídia" value={names(linkedMedia)} />
              <RelationInfo
                title="Ofertas"
                value={
                  supplierOffers.length
                    ? supplierOffers
                        .map(
                          item =>
                            `${recordName(item)} — ${money(item.unitPrice)}${item.averageUnitPrice ? ` · médio ${money(item.averageUnitPrice)}` : ""}`
                        )
                        .join(" | ")
                    : "Nenhuma oferta cadastrada"
                }
              />
              <RelationInfo
                title="Custo médio das ofertas"
                value={money(averageCost)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
      <aside className="space-y-5">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Responsável
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
              Representante
            </h2>
            <div className="mt-5 space-y-3">
              <RelationInfo
                title="Nome"
                value={String(supplier.contactName ?? "Não informado")}
              />
              <RelationInfo
                title="Telefone"
                value={String(supplier.phone ?? "Não informado")}
              />
              <RelationInfo
                title="E-mail"
                value={String(supplier.email ?? "Não informado")}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Localidade
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
              Atendimento
            </h2>
            <div className="mt-5 space-y-3">
              <RelationInfo
                title="Cidade base"
                value={String(
                  cities.find(item => item.id === Number(supplier.cityId))
                    ? recordName(
                        cities.find(
                          item => item.id === Number(supplier.cityId)
                        )!
                      )
                    : "Não informado"
                )}
              />
              <RelationInfo
                title="Cidades atendidas"
                value={names(linkedCities)}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Relacionamentos
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
              Uso operacional
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <RelationInfo title="Ações" value={names(actions)} />
              <RelationInfo title="Eventos" value={names(events)} />
              <RelationInfo
                title="Pontos de mídia"
                value={
                  mediaPoints.length
                    ? `${mediaPoints.length} ponto(s) vinculado(s)`
                    : "Nenhum ponto vinculado"
                }
              />
            </div>
          </CardContent>
        </Card>
      </aside>
    </section>
  );
}

function RelationInfo({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-foreground">{value}</p>
    </div>
  );
}

function SupplierContractAttachmentPanel({
  supplier,
  canWrite,
  isPending,
  onUpload,
}: {
  supplier: RegistryRecord;
  canWrite: boolean;
  isPending: boolean;
  onUpload: (file: File) => void;
}) {
  const contractUrl =
    typeof supplier.contractUrl === "string" ? supplier.contractUrl : null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Documento cadastral
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
            Contrato do fornecedor
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Anexe o contrato institucional do cadastro. Contratos financeiros,
            ordens de compra e notas fiscais ficam na seção de contratos
            operacionais abaixo.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <input
            id="supplier-contract-upload"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={!canWrite || isPending}
            onChange={event => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) {
                toast.error("O contrato deve ter até 5 MB.");
                return;
              }
              onUpload(file);
              event.currentTarget.value = "";
            }}
          />
          {contractUrl ? (
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={contractUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-3.5 w-3.5" />
                Abrir contrato
              </a>
            </Button>
          ) : null}
          {canWrite ? (
            <label htmlFor="supplier-contract-upload">
              <Button
                type="button"
                size="sm"
                asChild
                disabled={isPending}
                className="bg-primary"
              >
                <span>
                  <Paperclip className="mr-2 h-3.5 w-3.5" />
                  {isPending
                    ? "Enviando…"
                    : contractUrl
                      ? "Substituir"
                      : "Adicionar contrato"}
                </span>
              </Button>
            </label>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SupplierEditor({
  form,
  setForm,
  providers,
  cities,
  serviceTypes,
  mediaTypes,
  cityIds,
  setCityIds,
  serviceIds,
  setServiceIds,
  mediaIds,
  setMediaIds,
  onSave,
  saving,
  isCreating = false,
}: {
  form: Record<string, string>;
  setForm: (value: Record<string, string>) => void;
  providers: RegistryRecord[];
  cities: RegistryRecord[];
  serviceTypes: RegistryRecord[];
  mediaTypes: RegistryRecord[];
  cityIds: number[];
  setCityIds: (values: number[]) => void;
  serviceIds: number[];
  setServiceIds: (values: number[]) => void;
  mediaIds: number[];
  setMediaIds: (values: number[]) => void;
  onSave: () => void;
  saving: boolean;
  isCreating?: boolean;
}) {
  const lookupCnpj = trpc.settings.lookupSupplierCnpj.useQuery(
    { cnpj: form.cnpj ?? "" },
    { enabled: false, retry: false }
  );
  const searchSupplierCnpj = async () => {
    try {
      const result = await lookupCnpj.refetch();
      if (!result.data) return;
      setForm({
        ...form,
        cnpj: result.data.cnpj,
        name: form.name || result.data.displayName,
        legalName: form.legalName || result.data.legalName,
        address: form.address || result.data.address,
        phone: form.phone || result.data.phone,
        email: form.email || result.data.email,
      });
      toast.success("Dados do CNPJ carregados. Revise antes de salvar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível consultar o CNPJ.");
    }
  };
  const field = (
    key: string,
    label: string,
    type = "text",
    placeholder?: string
  ) => (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      <Input
        type={type}
        value={form[key] ?? ""}
        placeholder={placeholder}
        onChange={event => setForm({ ...form, [key]: event.target.value })}
      />
    </label>
  );
  const select = (
    key: string,
    label: string,
    options: RegistryRecord[],
    emptyLabel: string
  ) => (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>{label}</span>
      <select
        value={form[key] ?? ""}
        onChange={event => setForm({ ...form, [key]: event.target.value })}
        className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
      >
        <option value="">{emptyLabel}</option>
        {options.map(option => (
          <option key={option.id} value={option.id}>
            {recordName(option)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <form
      className="space-y-5"
      onSubmit={event => {
        event.preventDefault();
        onSave();
      }}
    >
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Etapa 1 · Identificação
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
              Dados cadastrais
            </h2>
          </div>
          <Badge
            variant="outline"
            className="w-fit border-primary/25 bg-primary/5 text-primary"
          >
            Formulário único
          </Badge>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {field(
            "name",
            "Nome de exibição",
            "text",
            "Nome usado nas operações"
          )}
          {field("legalName", "Razão social")}
          <label className="grid gap-1.5 text-sm font-medium">
            <span>CNPJ</span>
            <div className="flex items-center gap-2">
              <Input
                value={form.cnpj ?? ""}
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                onChange={event => setForm({ ...form, cnpj: event.target.value })}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void searchSupplierCnpj()}
                disabled={lookupCnpj.isFetching || !form.cnpj}
              >
                {lookupCnpj.isFetching ? "Consultando…" : "Buscar"}
              </Button>
            </div>
            <span className="text-xs font-normal text-muted-foreground">
              Consulta razão social, endereço, telefone e e-mail na BrasilAPI.
            </span>
          </label>
          {select(
            "providerId",
            "Empresa vinculada",
            providers,
            "Sem empresa vinculada"
          )}
          {field("address", "Endereço", "text", "Rua, número, complemento")}
          {field(
            "mainService",
            "Serviço principal",
            "text",
            "Ex.: impressão, áudio, eventos"
          )}
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="border-b border-border pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Etapa 2 · Representante
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
            Contato operacional
          </h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {field("contactName", "Nome do representante")}
          {field("phone", "Telefone")}
          {field("email", "E-mail", "email")}
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="border-b border-border pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Etapa 3 · Cobertura
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
            Territórios e capacidades
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            A cidade base e as listas de cobertura são relacionamentos
            diferentes: a base identifica a referência principal, enquanto os
            vínculos definem onde o fornecedor pode ser contratado.
          </p>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            {select("cityId", "Cidade base", cities, "Sem cidade base")}
          </div>
          <SearchableMultiSelect
            id="supplier-cities"
            label="Cidades atendidas"
            options={cities.map(city => ({
              id: city.id,
              label: recordName(city),
              description: city.state ? String(city.state) : undefined,
            }))}
            values={cityIds}
            onChange={setCityIds}
            placeholder="Selecionar cidades"
          />
          <SearchableMultiSelect
            id="supplier-services"
            label="Serviços vinculados"
            options={serviceTypes.map(service => ({
              id: service.id,
              label: recordName(service),
            }))}
            values={serviceIds}
            onChange={setServiceIds}
            placeholder="Selecionar serviços"
          />
          <SearchableMultiSelect
            id="supplier-media"
            label="Tipos de mídia"
            options={mediaTypes.map(media => ({
              id: media.id,
              label: recordName(media),
            }))}
            values={mediaIds}
            onChange={setMediaIds}
            placeholder="Selecionar mídias"
          />
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="border-b border-border pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Etapa 4 · Condições comerciais
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
            Pagamento e contrato
          </h2>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Modalidade</span>
            <select
              value={form.partnershipType ?? "paid"}
              onChange={event =>
                setForm({ ...form, partnershipType: event.target.value })
              }
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="paid">Pago</option>
              <option value="barter">Permuta</option>
              <option value="mixed">Misto</option>
            </select>
          </label>
          {field(
            "paymentMethod",
            "Forma de pagamento",
            "text",
            "PIX, boleto, transferência"
          )}
          {field(
            "paymentRecurrence",
            "Recorrência",
            "text",
            "Mensal, por ação..."
          )}
          {field("pixKey", "Chave PIX")}
          {field("paymentDay", "Dia de pagamento", "number")}
          {field("paymentBarterValue", "Valor da permuta (R$)", "number")}
          {field("paymentBarterService", "Serviço oferecido na permuta")}
          {field("contractStartsOn", "Início do contrato", "date")}
          {field("contractEndsOn", "Fim do contrato", "date")}
          <label className="grid gap-1.5 text-sm font-medium">
            <span>Possui contrato?</span>
            <select
              value={form.hasContract ?? "no"}
              onChange={event =>
                setForm({ ...form, hasContract: event.target.value })
              }
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="yes">Sim</option>
              <option value="no">Não</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2 xl:col-span-3">
            <span>Observações de pagamento</span>
            <Textarea
              value={form.paymentNotes ?? ""}
              onChange={event =>
                setForm({ ...form, paymentNotes: event.target.value })
              }
              placeholder="Condições, exceções e regras de faturamento"
            />
          </label>
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="border-b border-border pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Etapa 5 · Conferência
          </p>
          <h2 className="mt-1 font-display text-xl font-semibold text-foreground">
            Vínculos prontos para operação
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Revise a cobertura e salve. As ofertas detalhadas e os contratos
            financeiros permanecem em seus painéis próprios, sem misturar
            conceitos.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge variant="secondary">{cityIds.length} cidade(s)</Badge>
          <Badge variant="secondary">{serviceIds.length} serviço(s)</Badge>
          <Badge variant="secondary">{mediaIds.length} mídia(s)</Badge>
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={saving} className="bg-primary">
            {saving
              ? isCreating
                ? "Criando fornecedor…"
                : "Salvando fornecedor…"
              : isCreating
                ? "Criar fornecedor"
                : "Salvar fornecedor"}
          </Button>
        </div>
      </section>
    </form>
  );
}

function RegistryEditor({
  kind,
  isSubservicePage = false,
  form,
  setForm,
  providers,
  regionals,
  cities,
  mediaTypes,
  serviceTypes,
  subserviceParentIds,
  setSubserviceParentIds,
  supervisorCityIds,
  setSupervisorCityIds,
  productMediaIds,
  setProductMediaIds,
  onSave,
  saving,
  isCreating = false,
}: {
  kind: string;
  isSubservicePage?: boolean;
  form: Record<string, string>;
  setForm: (value: Record<string, string>) => void;
  providers: RegistryRecord[];
  regionals: RegistryRecord[];
  cities: RegistryRecord[];
  mediaTypes: RegistryRecord[];
  serviceTypes: RegistryRecord[];
  subserviceParentIds: number[];
  setSubserviceParentIds: (value: number[]) => void;
  supervisorCityIds: number[];
  setSupervisorCityIds: (value: number[]) => void;
  productMediaIds: number[];
  setProductMediaIds: (value: number[]) => void;
  onSave: () => void;
  saving: boolean;
  isCreating?: boolean;
}) {
  const field = (key: string, label: string, type = "text") => (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      <Input
        type={type}
        value={form[key] ?? ""}
        onChange={event => setForm({ ...form, [key]: event.target.value })}
      />
    </label>
  );
  const citySelect = (
    <label className="grid gap-2 text-sm font-medium">
      <span>Cidade</span>
      <select
        value={form.cityId ?? ""}
        onChange={event => setForm({ ...form, cityId: event.target.value })}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Sem cidade vinculada</option>
        {cities.map(city => (
          <option key={city.id} value={city.id}>
            {recordName(city)}
          </option>
        ))}
      </select>
    </label>
  );
  const partnershipFields = (
    <>
      <label className="grid gap-2 text-sm font-medium">
        <span>Modalidade</span>
        <select
          value={form.partnershipType ?? "paid"}
          onChange={event =>
            setForm({ ...form, partnershipType: event.target.value })
          }
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="paid">Pago</option>
          <option value="barter">Permuta</option>
          <option value="mixed">Misto</option>
        </select>
      </label>
      {field("paymentMethod", "Forma de pagamento")}
      {field("paymentRecurrence", "Recorrência")}
      <label className="grid gap-2 text-sm font-medium">
        <span>Possui contrato?</span>
        <select
          value={form.hasContract ?? "no"}
          onChange={event =>
            setForm({ ...form, hasContract: event.target.value })
          }
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="yes">Sim</option>
          <option value="no">Não</option>
        </select>
      </label>
    </>
  );
  const mediaParents = mediaTypes.filter(
    type =>
      type.id !== Number(form.recordId) &&
      !type.parentMediaTypeId &&
      String(type.operationCategory ?? "graphics") === form.operationCategory
  );
  const providerRegionalIds = new Set(
    regionals
      .filter(regional => regional.providerId === Number(form.providerRecordId))
      .map(regional => regional.id)
  );
  const providerCities = cities.filter(city =>
    providerRegionalIds.has(Number(city.regionalId))
  );
  return (
    <Card>
      <CardContent className="p-6">
        <div className="grid gap-4 md:grid-cols-2">
          {field(
            "name",
            kind === "provider"
              ? "Nome da empresa"
              : kind === "supplier"
                ? "Nome de exibição"
                : "Nome"
          )}
          {kind === "provider" ? (
            <>
              {field("legalName", "Razão social")}
              {field("billingCnpj", "CNPJ de faturamento")}
              {field("contactName", "Nome do contato")}
              {field("phone", "Telefone")}
              {field("email", "E-mail", "email")}
              {field("website", "Site", "url")}
              <label className="grid gap-2 text-sm font-medium md:col-span-2">
                <span>Endereço de faturamento</span>
                <Input
                  value={form.address ?? ""}
                  onChange={event =>
                    setForm({ ...form, address: event.target.value })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span>Cidade-matriz</span>
                <select
                  value={form.headquartersCityId ?? ""}
                  onChange={event =>
                    setForm({ ...form, headquartersCityId: event.target.value })
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Não definida</option>
                  {providerCities.map(city => (
                    <option key={city.id} value={city.id}>
                      {recordName(city)} · {String(city.state ?? "MG")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span>Cores da empresa</span>
                <Input
                  value={form.brandColors ?? ""}
                  onChange={event =>
                    setForm({ ...form, brandColors: event.target.value })
                  }
                  placeholder="#0E723B, #F45103"
                />
                <span className="text-xs font-normal text-muted-foreground">
                  Separe as cores hexadecimais por vírgula.
                </span>
              </label>
            </>
          ) : null}
          {kind === "provider_fiscal_entity" ? (
            <>
              <label className="grid gap-2 text-sm font-medium">
                <span>Empresa operacional</span>
                <select
                  value={form.providerId ?? ""}
                  onChange={event => setForm({ ...form, providerId: event.target.value })}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecione a empresa operacional</option>
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {recordName(provider)}
                    </option>
                  ))}
                </select>
              </label>
              {field("cnpj", "CNPJ fiscal")}
              {field("legalName", "Razão social")}
              {field("stateRegistration", "Inscrição estadual")}
              {field("municipalRegistration", "Inscrição municipal")}
              {field("address", "Endereço fiscal")}
              {citySelect}
              <label className="grid gap-2 text-sm font-medium">
                <span>CNPJ padrão para faturamento</span>
                <select
                  value={form.isDefault ?? "no"}
                  onChange={event => setForm({ ...form, isDefault: event.target.value })}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="no">Não</option>
                  <option value="yes">Sim</option>
                </select>
              </label>
            </>
          ) : null}
          {kind === "regional" ? (
            <>
              <label className="grid gap-2 text-sm font-medium">
                <span>Código</span>
                <Input
                  value={form.code ?? ""}
                  onChange={event =>
                    setForm({ ...form, code: event.target.value.toUpperCase() })
                  }
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span>Empresa responsável</span>
                <select
                  value={form.providerId ?? ""}
                  onChange={event =>
                    setForm({ ...form, providerId: event.target.value })
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Sem empresa vinculada</option>
                  {providers.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {recordName(provider)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          {kind === "city" ? (
            <>
              <label className="grid gap-2 text-sm font-medium">
                <span>Regional</span>
                <select
                  value={form.regionalId ?? ""}
                  onChange={event =>
                    setForm({ ...form, regionalId: event.target.value })
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecione uma regional</option>
                  {regionals.map(regional => (
                    <option key={regional.id} value={regional.id}>
                      {recordName(regional)}
                    </option>
                  ))}
                </select>
              </label>
              {field("state", "UF")}
              {field("ibgeCode", "Código IBGE")}
              {field("zipCode", "CEP")}
              {field("address", "Endereço")}
              {field("latitude", "Latitude", "number")}
              {field("longitude", "Longitude", "number")}
              {field("locationNotes", "Observações de localização")}
            </>
          ) : null}
          {kind === "store" ? (
            <>
              <label className="grid gap-2 text-sm font-medium">
                <span>Cidade</span>
                <select
                  value={form.cityId ?? ""}
                  onChange={event =>
                    setForm({ ...form, cityId: event.target.value })
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecione uma cidade</option>
                  {cities.map(city => (
                    <option key={city.id} value={city.id}>
                      {recordName(city)}
                    </option>
                  ))}
                </select>
              </label>
              {field("code", "Código")}
              {field("address", "Endereço")}
              {field("referencePoint", "Ponto de referência")}
              {field("zipCode", "CEP")}
              {field("phone", "Telefone")}
              {field("email", "E-mail", "email")}
              <StoreHoursField
                value={form.openingHours ?? ""}
                onChange={openingHours => setForm({ ...form, openingHours })}
              />
              <CoordinatesField
                latitude={form.latitude ?? ""}
                longitude={form.longitude ?? ""}
                setLatitude={latitude => setForm({ ...form, latitude })}
                setLongitude={longitude => setForm({ ...form, longitude })}
              />
            </>
          ) : null}
          {kind === "supplier" ? (
            <>
              {field("legalName", "Razão social")}
              {field("document", "CNPJ")}
              {field("contactName", "Contato")}
              {field("phone", "Telefone")}
              {field("email", "E-mail", "email")}
              <label className="grid gap-2 text-sm font-medium">
                <span>Especialidade</span>
                <select
                  value={form.mainService ?? ""}
                  onChange={event =>
                    setForm({ ...form, mainService: event.target.value })
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Selecione um serviço</option>
                  {serviceTypes
                    .filter(item => item.active !== false)
                    .map(service => (
                      <option key={service.id} value={recordName(service)}>
                        {recordName(service)}
                      </option>
                    ))}
                </select>
              </label>
              {citySelect}
              {partnershipFields}
            </>
          ) : null}
          {kind === "partner" ? (
            <>
              {field("email", "E-mail", "email")}
              {field("phone", "Telefone")}
              {citySelect}
              {partnershipFields}
            </>
          ) : null}
          {kind === "supervisor" ? (
            <>
              {field("email", "E-mail", "email")}
              {field("phone", "Telefone")}
              <label className="grid gap-2 text-sm font-medium md:col-span-2">
                <span>Cidades vinculadas</span>
                <select
                  multiple
                  value={supervisorCityIds.map(String)}
                  onChange={event =>
                    setSupervisorCityIds(
                      Array.from(event.target.selectedOptions).map(option =>
                        Number(option.value)
                      )
                    )
                  }
                  className="min-h-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {cities.map(city => (
                    <option key={city.id} value={city.id}>
                      {recordName(city)}
                      {city.state ? ` · ${city.state}` : ""}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-normal text-muted-foreground">
                  Segure Ctrl/Cmd para selecionar mais de uma cidade.
                </span>
              </label>
            </>
          ) : null}
          {kind === "service" || kind === "subservice" ? (
            <>
              {kind === "service" ? (
                <label className="grid gap-2 text-sm font-medium">
                  <span>Mídia relacionada</span>
                  <select
                    value={form.mediaTypeId ?? ""}
                    onChange={event =>
                      setForm({ ...form, mediaTypeId: event.target.value })
                    }
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Sem mídia específica</option>
                    {mediaTypes
                      .filter(type => type.active !== false)
                      .map(type => (
                        <option key={type.id} value={type.id}>
                          {recordName(type)}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
              {kind === "subservice" ? (
                <>
                  <label className="grid gap-2 text-sm font-medium">
                    <span>Unidade padrão</span>
                    <Input
                      value={form.unit ?? "unidade"}
                      onChange={event =>
                        setForm({ ...form, unit: event.target.value })
                      }
                      placeholder="unidade, m², hora, diária…"
                    />
                  </label>
                  <SearchableMultiSelect
                    id="registry-subservice-parents"
                    label="Serviços principais"
                    placeholder="Selecione um ou mais Serviços"
                    options={serviceTypes
                      .filter(
                        type =>
                          type.active !== false &&
                          !type.parentServiceTypeId &&
                          type.id !== Number(form.recordId)
                      )
                      .map(type => ({
                        id: type.id,
                        label: recordName(type),
                      }))}
                    values={subserviceParentIds}
                    onChange={setSubserviceParentIds}
                  />
                </>
              ) : null}
            </>
          ) : null}
          {kind === "product" ? (
            <>
              <label className="grid gap-2 text-sm font-medium md:col-span-2">
                <span>Tipos de mídia vinculados</span>
                <select
                  multiple
                  value={productMediaIds.map(String)}
                  onChange={event =>
                    setProductMediaIds(
                      Array.from(event.target.selectedOptions).map(option =>
                        Number(option.value)
                      )
                    )
                  }
                  className="min-h-32 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {mediaTypes
                    .filter(type => type.active !== false)
                    .map(type => (
                      <option key={type.id} value={type.id}>
                        {recordName(type)}
                      </option>
                    ))}
                </select>
                <span className="text-xs font-normal text-muted-foreground">
                  Vincule o produto aos tipos de mídia em que ele pode ser
                  aplicado.
                </span>
              </label>
              <label className="grid gap-2 text-sm font-medium md:col-span-2">
                <span>Descrição</span>
                <Textarea
                  value={form.description ?? ""}
                  onChange={event =>
                    setForm({ ...form, description: event.target.value })
                  }
                />
              </label>
            </>
          ) : null}
          {kind === "media" ? (
            <>
              <label className="grid gap-2 text-sm font-medium">
                <span>Categoria da mídia</span>
                <select
                  value={form.operationCategory ?? "graphics"}
                  onChange={event =>
                    setForm({
                      ...form,
                      operationCategory: event.target.value,
                      parentMediaTypeId: "",
                    })
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="graphics">Mídia Urbana</option>
                  <option value="audio_video">Mídia Audiovisual</option>
                  <option value="leafleting">Panfletagem</option>
                  <option value="sound_car">Carro de Som</option>
                  <option value="influencers">Influencers</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span>Tipo de mídia pai (opcional)</span>
                <select
                  value={form.parentMediaTypeId ?? ""}
                  onChange={event =>
                    setForm({ ...form, parentMediaTypeId: event.target.value })
                  }
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Sem tipo pai — este é um tipo principal</option>
                  {mediaParents.map(type => (
                    <option key={type.id} value={type.id}>
                      {recordName(type)}
                    </option>
                  ))}
                </select>
                <span className="text-xs font-normal text-muted-foreground">
                  O tipo pai organiza este registro como subtipo/variação dentro da mesma categoria. Sem pai, o registro é um tipo principal.
                </span>
              </label>
            </>
          ) : null}
          {kind === "financial_category" ? (
            <label className="grid gap-2 text-sm font-medium md:col-span-2">
              <span>Descrição</span>
              <Input
                value={form.description ?? ""}
                onChange={event =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </label>
          ) : null}
        </div>
        <div className="mt-6 flex justify-end">
          <Button
            disabled={saving || !form.name?.trim()}
            onClick={onSave}
            className="bg-primary text-primary-foreground"
          >
            {saving
              ? "Salvando…"
              : isCreating
                ? "Criar cadastro"
                : "Salvar alterações"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SupplierDirectory({
  rows,
  providers,
  cities,
  selectedIds,
  onToggle,
  onOpen,
}: {
  rows: RegistryRecord[];
  providers: RegistryRecord[];
  cities: RegistryRecord[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onOpen: (id: number) => void;
}) {
  const cityName = (id: unknown) => {
    const city = cities.find(item => item.id === Number(id));
    return city
      ? `${recordName(city)}${city.state ? `/${city.state}` : ""}`
      : "Cidade não informada";
  };
  if (!rows.length)
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Nenhum fornecedor encontrado para a busca ou filtro selecionado.
        </CardContent>
      </Card>
    );
  return (
    <div className="space-y-3">
      {rows.map(row => {
        const provider = providers.find(
          item => item.id === Number(row.providerId)
        );
        return (
          <div key={row.id} className="relative">
            <input
              type="checkbox"
              aria-label={`Selecionar ${recordName(row)}`}
              checked={selectedIds.includes(row.id)}
              onChange={() => onToggle(row.id)}
              className="absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 accent-primary"
            />
            <button
              type="button"
              onClick={() => onOpen(row.id)}
              className="grid w-full grid-cols-[56px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-[10px] border border-border bg-card px-4 py-4 pl-11 text-left shadow-[0_2px_8px_rgba(19,53,35,0.025)] transition hover:border-primary/30 hover:bg-muted/40 sm:grid-cols-[56px_minmax(190px,1.2fr)_minmax(170px,.9fr)_minmax(180px,.9fr)_32px] sm:px-5 sm:pl-12"
            >
            <span className="row-span-2 grid h-14 w-14 place-items-center overflow-hidden rounded-xl border border-border bg-primary/5 text-primary sm:row-span-1">
              {typeof row.photoUrl === "string" && row.photoUrl ? (
                <img
                  src={row.photoUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Building2 className="h-5 w-5" />
              )}
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-sm font-semibold text-foreground">
                {recordName(row)}
              </strong>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {String(row.mainService ?? "Serviço principal não informado")}
              </span>
            </span>
            <span className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 sm:col-span-1">
              <Badge
                variant="outline"
                className={
                  row.active === false
                    ? "border-border text-muted-foreground"
                    : "border-primary/30 bg-primary/10 text-primary"
                }
              >
                {row.active === false ? "Inativo" : "Ativo"}
              </Badge>
              <Badge variant="outline">
                {row.partnershipType === "barter"
                  ? "Permuta"
                  : row.partnershipType === "mixed"
                    ? "Misto"
                    : "Pago"}
              </Badge>
            </span>
            <span className="col-span-2 min-w-0 rounded-xl bg-muted/45 px-3 py-2 text-xs text-muted-foreground sm:col-span-1">
              <span className="block truncate">{cityName(row.cityId)}</span>
              <span className="mt-1 block truncate">
                {provider ? recordName(provider) : "Sem empresa vinculada"}
              </span>
            </span>
            <ChevronRight className="col-start-2 row-start-1 h-4 w-4 justify-self-end text-primary sm:col-start-auto sm:row-start-auto" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function summary(
  kind: string,
  row: RegistryRecord,
  lookup: {
    providers: RegistryRecord[];
    regionals: RegistryRecord[];
    cities: RegistryRecord[];
  }
) {
  if (kind === "regional") {
    const provider = lookup.providers.find(
      item => item.id === Number(row.providerId)
    );
    return `${row.code ?? "Sem código"} · ${provider ? recordName(provider) : "Sem empresa vinculada"}`;
  }
  if (kind === "city") {
    const regional = lookup.regionals.find(
      item => item.id === Number(row.regionalId)
    );
    return `${row.state ?? ""} · ${regional ? recordName(regional) : "Sem regional vinculada"}`;
  }
  return String(
    row.email ??
      row.phone ??
      row.code ??
      row.description ??
      "Abrir detalhes do cadastro"
  );
}
function getRelations(
  kind: string,
  record: RegistryRecord,
  all: {
    providers: RegistryRecord[];
    regionals: RegistryRecord[];
    cities: RegistryRecord[];
    stores: RegistryRecord[];
    suppliers: RegistryRecord[];
    mediaTypes: RegistryRecord[];
    serviceTypes: RegistryRecord[];
    subserviceTypes: RegistryRecord[];
    serviceSubservices: ServiceSubserviceLink[];
    serviceTypeRelations: ServiceTypeRelationLink[];
    mediaServiceCatalog: RegistryRecord[];
  }
) {
  const companyRegionals = all.regionals.filter(
    item => Number(item.providerId) === record.id
  );
  const regionalCities = all.cities.filter(
    item => Number(item.regionalId) === record.id
  );
  const scopeCities =
    kind === "provider"
      ? all.cities.filter(city =>
          companyRegionals.some(
            regional => regional.id === Number(city.regionalId)
          )
        )
      : kind === "regional"
        ? regionalCities
        : kind === "city"
          ? [record]
          : [];
  const scopeStores = all.stores.filter(store =>
    scopeCities.some(city => city.id === Number(store.cityId))
  );
  const scopeSuppliers = all.suppliers.filter(supplier =>
    scopeCities.some(city => city.id === Number(supplier.cityId))
  );
  if (kind === "media") {
    const catalogRows = all.mediaServiceCatalog.filter(row => Number(row.mediaTypeId) === record.id);
    const relatedServices = all.serviceTypes.filter(service => catalogRows.some(row => Number(row.serviceTypeId) === service.id));
    const subserviceIds = new Set(catalogRows.map(row => Number(row.subserviceTypeId)).filter(Number.isFinite));
    const subserviceRows = all.subserviceTypes.filter(subservice => subserviceIds.has(subservice.id));
    return [
      {
        label: "Serviços relacionados",
        count: relatedServices.length,
        description: "Serviços disponíveis para este tipo de mídia",
        path: "/cadastros/servicos",
        items: relatedServices,
      },
      {
        label: "Subserviços relacionados",
        count: subserviceRows.length,
        description: "Subserviços vinculados ao catálogo de mídia",
        path: "/cadastros/subservicos",
        items: subserviceRows,
      },
    ];
  }
  if (kind === "service") {
    const links = all.serviceSubservices
      .map(link => ({
        serviceTypeId: Number(link.serviceTypeId),
        subserviceTypeId: Number(link.subserviceTypeId),
      }))
      .filter(link => link.serviceTypeId === record.id);
    const subserviceIds = new Set(links.map(link => link.subserviceTypeId));
    const subserviceRows = all.subserviceTypes.filter(subservice => subserviceIds.has(subservice.id));
    return [{ label: "Subserviços relacionados", count: subserviceRows.length, description: "Subserviços atendidos por este serviço", path: "/cadastros/subservicos", items: subserviceRows }];
  }
  if (kind === "subservice") {
    const links = all.serviceSubservices
      .map(link => ({
        serviceTypeId: Number(link.serviceTypeId),
        subserviceTypeId: Number(link.subserviceTypeId),
      }))
      .filter(link => link.subserviceTypeId === record.id);
    const serviceIds = new Set(links.map(link => link.serviceTypeId));
    const serviceRows = all.serviceTypes.filter(service => serviceIds.has(service.id));
    return [{ label: "Serviços relacionados", count: serviceRows.length, description: "Serviços que utilizam este subserviço", path: "/cadastros/servicos", items: serviceRows }];
  }
  if (kind === "provider")
    return [
      {
        label: "Regionais",
        count: companyRegionals.length,
        description: "Estruturas atendidas",
        path: "/cadastros/regionais",
        items: companyRegionals,
      },
      {
        label: "Cidades",
        count: scopeCities.length,
        description: "Cidades da cobertura",
        path: "/cadastros/cidades",
        items: scopeCities,
      },
      {
        label: "Lojas",
        count: scopeStores.length,
        description: "Lojas vinculadas",
        path: "/cadastros/lojas",
        items: scopeStores,
      },
      {
        label: "Fornecedores",
        count: scopeSuppliers.length,
        description: "Fornecedores locais",
        path: "/cadastros/fornecedores",
        items: scopeSuppliers,
      },
    ];
  if (["regional", "city"].includes(kind))
    return [
      {
        label: "Cidades",
        count: scopeCities.length,
        description: "Territórios vinculados",
        path: "/cadastros/cidades",
        items: scopeCities,
      },
      {
        label: "Lojas",
        count: scopeStores.length,
        description: "Lojas vinculadas",
        path: "/cadastros/lojas",
        items: scopeStores,
      },
      {
        label: "Fornecedores",
        count: scopeSuppliers.length,
        description: "Fornecedores locais",
        path: "/cadastros/fornecedores",
        items: scopeSuppliers,
      },
    ];
  return [];
}

function ExpandedRelationPanel({
  label,
  rows,
  destination,
  onOpen,
  onViewAll,
}: {
  label: string;
  rows: RegistryRecord[];
  destination: string;
  onOpen: (id: number) => void;
  onViewAll: () => void;
}) {
  return (
    <Card className="mt-4 overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="font-display text-lg font-semibold text-foreground">
              {label} vinculados
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Consulte os registros relacionados a este cadastro.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onViewAll}>
            Ver todos
          </Button>
        </div>
        {rows.length ? (
          <div className="divide-y divide-border">
            {rows.map(row => (
              <button
                key={row.id}
                type="button"
                className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition hover:bg-muted/50"
                onClick={() => onOpen(row.id)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {recordName(row)}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {String(
                      row.address ??
                        row.email ??
                        row.phone ??
                        row.code ??
                        "Cadastro vinculado"
                    )}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
              </button>
            ))}
          </div>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">
            Não há {label.toLowerCase()} vinculados a este cadastro.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
