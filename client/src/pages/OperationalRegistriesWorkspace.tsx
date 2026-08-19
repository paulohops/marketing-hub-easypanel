import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Database,
  FileSpreadsheet,
  Handshake,
  Landmark,
  MapPinned,
  Megaphone,
  Package,
  Radio,
  Settings2,
  Store,
  UsersRound,
  Wrench,
} from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "wouter";

type RegistryGroup =
  | "territorio"
  | "parceiros"
  | "produtos-servicos"
  | "operacao"
  | "categorias"
  | "financeiro"
  | "modelos";
type RegistryCollection =
  | "providers"
  | "regionals"
  | "cities"
  | "stores"
  | "suppliers"
  | "partners"
  | "commercialSupervisors"
  | "serviceTypes"
  | "productTypes"
  | "mediaTypes"
  | "actionTypes"
  | "eventTypes"
  | "campaignTypes"
  | "campaignSectors"
  | "financialCategories"
  | "fiscalEntities";

type RegistryItem = {
  slug: string;
  title: string;
  description: string;
  group: RegistryGroup;
  route: string;
  collection?: RegistryCollection;
  icon: typeof Building2;
  relation: string;
};

const groupDefinitions: Array<{
  id: RegistryGroup;
  label: string;
  description: string;
}> = [
  {
    id: "territorio",
    label: "Território",
    description:
      "Empresas, regionais, cidades e lojas que estruturam a cobertura.",
  },
  {
    id: "parceiros",
    label: "Parceiros",
    description:
      "Fornecedores, parceiros comerciais, supervisores e serviços contratáveis.",
  },
  {
    id: "produtos-servicos",
    label: "Produtos e serviços",
    description:
      "Serviços, produtos e tipos de mídia disponíveis para a operação de trade.",
  },
  {
    id: "operacao",
    label: "Operação",
    description:
      "Classificações usadas para organizar campanhas e sua estratégia.",
  },
  {
    id: "categorias",
    label: "Categorias do Trade",
    description: "Tipos de ação, evento, mídia e produto usados na execução.",
  },
  {
    id: "financeiro",
    label: "Financeiro",
    description:
      "Categorias que organizam estimativas, verbas e controles financeiros.",
  },
  {
    id: "modelos",
    label: "Modelos",
    description:
      "Estruturas reutilizáveis para criar campanhas e ações com consistência.",
  },
];

const registryItems: RegistryItem[] = [
  {
    slug: "empresas",
    title: "Empresas",
    description:
      "Dados de faturamento, identidade, matriz e cobertura territorial.",
    group: "territorio",
    route: "/cadastros/empresas",
    collection: "providers",
    icon: Building2,
    relation: "Regionais, cidades e fornecedores",
  },
  {
    slug: "empresas-fiscais",
    title: "Empresas fiscais",
    description: "CNPJs e inscrições vinculados a cada Empresa operacional.",
    group: "financeiro",
    route: "/cadastros/empresas-fiscais",
    collection: "fiscalEntities",
    icon: Building2,
    relation: "Empresa operacional e notas fiscais",
  },
  {
    slug: "regionais",
    title: "Regionais",
    description: "Estruturas territoriais vinculadas às empresas responsáveis.",
    group: "territorio",
    route: "/cadastros/regionais",
    collection: "regionals",
    icon: MapPinned,
    relation: "Cidades da regional",
  },
  {
    slug: "cidades",
    title: "Cidades",
    description: "Localização, UF, códigos e referências de cada território.",
    group: "territorio",
    route: "/cadastros/cidades",
    collection: "cities",
    icon: MapPinned,
    relation: "Regional, lojas e pontos de ação",
  },
  {
    slug: "lojas",
    title: "Lojas",
    description:
      "Unidades de atendimento com localização, horários e responsáveis.",
    group: "territorio",
    route: "/cadastros/lojas",
    collection: "stores",
    icon: Store,
    relation: "Cidade e supervisor comercial",
  },
  {
    slug: "pontos-de-acao",
    title: "Pontos de ação",
    description:
      "Locais recorrentes para planejar, comparar e avaliar ações de trade.",
    group: "territorio",
    route: "/pontos-de-acao",
    icon: MapPinned,
    relation: "Cidade e ações",
  },
  {
    slug: "fornecedores",
    title: "Fornecedores",
    description:
      "Parceiros contratáveis, cobertura, serviços e condições comerciais.",
    group: "parceiros",
    route: "/cadastros/fornecedores",
    collection: "suppliers",
    icon: Handshake,
    relation: "Cidades, serviços e operações",
  },
  {
    slug: "parceiros-comerciais",
    title: "Parceiros comerciais",
    description: "Parceiros institucionais e comerciais ligados à operação.",
    group: "parceiros",
    route: "/cadastros/parceiros-comerciais",
    collection: "partners",
    icon: Handshake,
    relation: "Cidade, contrato e pagamento",
  },
  {
    slug: "supervisores",
    title: "Supervisores comerciais",
    description: "Pessoas responsáveis por acompanhar lojas e operações.",
    group: "parceiros",
    route: "/cadastros/supervisores",
    collection: "commercialSupervisors",
    icon: UsersRound,
    relation: "Lojas sob responsabilidade",
  },
  {
    slug: "servicos",
    title: "Serviços",
    description:
      "Serviços principais disponíveis para contratação e composição de ações.",
    group: "produtos-servicos",
    route: "/cadastros/servicos",
    collection: "serviceTypes",
    icon: Wrench,
    relation: "Fornecedores, mídia e subserviços",
  },
  {
    slug: "subservicos",
    title: "SubServiços",
    description:
      "Detalhamentos operacionais vinculados a um serviço principal, como lona, propaganda ou entrevista.",
    group: "produtos-servicos",
    route: "/cadastros/subservicos",
    collection: "serviceTypes",
    icon: Wrench,
    relation: "Serviço principal e tipo de mídia",
  },
  {
    slug: "tipos-de-campanha",
    title: "Atuação",
    description:
      "Classificações estratégicas como Comercial, Fidelização e outras.",
    group: "operacao",
    route: "/cadastros/tipos-de-campanha",
    collection: "campaignTypes",
    icon: Megaphone,
    relation: "Campanhas",
  },
  {
    slug: "setores-de-campanha",
    title: "Setores",
    description: "Segmentos de público usados na definição de campanhas.",
    group: "operacao",
    route: "/cadastros/setores-de-campanha",
    collection: "campaignSectors",
    icon: Settings2,
    relation: "Campanhas",
  },
  {
    slug: "tipos-de-acao",
    title: "Tipos de ação",
    description: "Categorias configuráveis para ações de trade.",
    group: "categorias",
    route: "/cadastros/tipos-de-acao",
    collection: "actionTypes",
    icon: Megaphone,
    relation: "Ações",
  },
  {
    slug: "tipos-de-evento",
    title: "Tipos de evento",
    description: "Categorias configuráveis para a agenda de eventos.",
    group: "categorias",
    route: "/cadastros/tipos-de-evento",
    collection: "eventTypes",
    icon: CalendarDays,
    relation: "Eventos",
  },
  {
    slug: "tipos-de-midia",
    title: "Tipos de mídia",
    description: "Canais, categorias e formatos de mídia usados no território.",
    group: "categorias",
    route: "/cadastros/tipos-de-midia",
    collection: "mediaTypes",
    icon: Radio,
    relation: "Mídias e fornecedores",
  },
  {
    slug: "tipos-de-produto",
    title: "Tipos de produtos",
    description: "Classificações de produtos usadas no catálogo do Trade.",
    group: "produtos-servicos",
    route: "/cadastros/tipos-de-produto",
    collection: "productTypes",
    icon: Package,
    relation: "Ofertas de fornecedores",
  },
  {
    slug: "categorias-financeiras",
    title: "Categorias financeiras",
    description:
      "Classificações para estimativas, verbas e controles financeiros.",
    group: "financeiro",
    route: "/cadastros/categorias-financeiras",
    collection: "financialCategories",
    icon: Landmark,
    relation: "Financeiro e orçamentos",
  },
  {
    slug: "modelos",
    title: "Modelos de campanha",
    description:
      "Estruturas reutilizáveis para iniciar campanhas com menos retrabalho.",
    group: "modelos",
    route: "/cadastros/modelos",
    icon: FileSpreadsheet,
    relation: "Campanhas",
  },
  {
    slug: "modelos-acoes",
    title: "Modelos de ações",
    description: "Informações reutilizáveis para planejar ações de trade.",
    group: "modelos",
    route: "/cadastros/modelos-acoes",
    icon: FileSpreadsheet,
    relation: "Ações",
  },
];

function resolveGroup(path: string): RegistryGroup {
  const value = path.split("?")[0].split("/").filter(Boolean)[1];
  return groupDefinitions.some(group => group.id === value)
    ? (value as RegistryGroup)
    : "territorio";
}

function collectionCount(data: unknown, collection?: RegistryCollection) {
  if (!collection || !data || typeof data !== "object") return null;
  const value = (data as Record<string, unknown>)[collection];
  return Array.isArray(value) ? value.length : null;
}

export default function OperationalRegistriesWorkspace() {
  const [location, setLocation] = useLocation();
  const overview = trpc.settings.overview.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const activeGroup = resolveGroup(location);
  const currentGroup =
    groupDefinitions.find(group => group.id === activeGroup) ??
    groupDefinitions[0];
  const items = useMemo(
    () => registryItems.filter(item => item.group === activeGroup),
    [activeGroup]
  );

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Gestão operacional</p>
          <h1 className="font-display text-3xl font-bold text-foreground">
            Cadastros
          </h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            Mantenha as informações mestres que abastecem campanhas, ações,
            eventos, mídias, estoque e financeiro.
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-primary/25 bg-primary/5 px-3 py-1.5 text-primary"
        >
          {registryItems.length} estruturas
        </Badge>
      </header>

      <nav
        aria-label="Grupos de cadastros"
        className="rounded-xl border border-border bg-card p-2 shadow-sm"
      >
        <div className="flex flex-wrap gap-2">
          {groupDefinitions.map(group => (
            <Button
              key={group.id}
              type="button"
              variant={group.id === activeGroup ? "default" : "outline"}
              className="rounded-lg"
              onClick={() => setLocation(`/cadastros/${group.id}`)}
            >
              {group.label}
            </Button>
          ))}
        </div>
      </nav>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Grupo selecionado
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">
              {currentGroup.label}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {currentGroup.description}
            </p>
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            {items.length} {items.length === 1 ? "lista" : "listas"}
          </span>
        </div>

        <div
          className="hub-list"
          aria-label={`Listas de ${currentGroup.label}`}
        >
          {items.map(item => {
            const Icon = item.icon;
            const count = collectionCount(overview.data, item.collection);
            return (
              <button
                key={item.slug}
                type="button"
                className="hub-list-item grid w-full gap-4 p-4 text-left sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"
                onClick={() => setLocation(item.route)}
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="font-display text-base font-semibold text-foreground">
                      {item.title}
                    </strong>
                    {count !== null ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                        {count}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-muted-foreground">
                    {item.description}
                  </span>
                  <span className="mt-2 block text-xs font-medium text-primary">
                    Relaciona com: {item.relation}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-xs font-semibold text-primary sm:justify-self-end">
                  <span className="hidden sm:inline">Abrir lista</span>
                  <ArrowRight className="h-4 w-4" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-muted/35 p-4 text-sm text-muted-foreground">
        <div className="flex gap-3">
          <Database className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            <strong className="text-foreground">
              Como os relacionamentos funcionam:
            </strong>{" "}
            o território define a cobertura; empresas e regionais organizam
            cidades e lojas; fornecedores recebem cobertura por cidade e
            capacidade; tipos e categorias alimentam os formulários de operação;
            e cada registro pode ser inativado quando já possui histórico
            dependente.
          </p>
        </div>
      </section>
    </main>
  );
}

export { registryItems, groupDefinitions };
