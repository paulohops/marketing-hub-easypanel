import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Building2, ChevronRight, CircleAlert, ExternalLink, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";

type RegistryRecord = Record<string, unknown> & { id: number; active?: boolean; name?: string; displayName?: string; phone?: string | null; email?: string | null };
type EntityConfig = { singular: string; plural: string; collection: string; kind: string; description: string; icon: typeof Building2 };

const entities: Record<string, EntityConfig> = {
  empresas: { singular: "Empresa", plural: "Empresas", collection: "providers", kind: "provider", description: "Dados de faturamento, cobertura territorial, lojas, fornecedores e operações associadas.", icon: Building2 },
  regionais: { singular: "Regional", plural: "Regionais", collection: "regionals", kind: "regional", description: "Estrutura territorial, empresa responsável, cidades, lojas e operações associadas.", icon: MapPin },
  cidades: { singular: "Cidade", plural: "Cidades", collection: "cities", kind: "city", description: "Localização, dados de território, lojas, fornecedores e referências operacionais.", icon: MapPin },
  lojas: { singular: "Loja", plural: "Lojas", collection: "stores", kind: "store", description: "Unidades de atendimento e respectivas referências territoriais.", icon: Building2 },
  fornecedores: { singular: "Fornecedor", plural: "Fornecedores", collection: "suppliers", kind: "supplier", description: "Contatos, cobertura, serviços contratáveis e condições comerciais.", icon: Building2 },
  parceiros: { singular: "Parceiro", plural: "Parceiros", collection: "partners", kind: "partner", description: "Contatos, contratos e condições de parceria.", icon: Building2 },
  supervisores: { singular: "Supervisor comercial", plural: "Supervisores comerciais", collection: "commercialSupervisors", kind: "supervisor", description: "Pessoas responsáveis e lojas sob supervisão comercial.", icon: Building2 },
  servicos: { singular: "Serviço", plural: "Serviços", collection: "serviceTypes", kind: "service", description: "Serviços disponíveis para contratação e configuração da operação.", icon: Building2 },
  "tipos-de-midia": { singular: "Tipo de mídia", plural: "Tipos de mídia", collection: "mediaTypes", kind: "media", description: "Canais e formatos para planejamento de mídia.", icon: Building2 },
  "tipos-de-acao": { singular: "Tipo de ação", plural: "Tipos de ação", collection: "actionTypes", kind: "action", description: "Classificações usadas no planejamento de ações.", icon: Building2 },
  "tipos-de-evento": { singular: "Tipo de evento", plural: "Tipos de evento", collection: "eventTypes", kind: "event", description: "Classificações usadas no planejamento de eventos.", icon: Building2 },
  "categorias-financeiras": { singular: "Categoria financeira", plural: "Categorias financeiras", collection: "financialCategories", kind: "financial_category", description: "Classificações de estimativas, verbas e controles financeiros.", icon: Building2 },
};

const registryPaths: Record<string, string> = { provider: "empresas", regional: "regionais", city: "cidades", store: "lojas", supplier: "fornecedores", partner: "parceiros", supervisor: "supervisores", service: "servicos", media: "tipos-de-midia", action: "tipos-de-acao", event: "tipos-de-evento", financial_category: "categorias-financeiras" };

function recordName(record: RegistryRecord) { return String(record.displayName ?? record.name ?? "Sem identificação"); }
function digits(value?: string | null) { return String(value ?? "").replace(/\D/g, ""); }
function whatsappUrl(phone?: string | null) { const number = digits(phone); return number.length >= 10 ? `https://wa.me/55${number.replace(/^55/, "")}` : null; }

export default function RegistryEntityWorkspace() {
  const [location, setLocation] = useLocation();
  const cleanPath = location.split("?")[0];
  const [, , slug = "", rawId] = cleanPath.split("/");
  const entity = entities[slug];
  const entityId = rawId ? Number(rawId) : null;
  const { can } = useEffectivePermissions();
  const utils = trpc.useUtils();
  const overview = trpc.settings.overview.useQuery(undefined, { staleTime: 20_000 });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const updateProvider = trpc.settings.updateProvider.useMutation({ onSuccess: () => { toast.success("Empresa atualizada."); utils.settings.overview.invalidate(); setEditing(false); } });
  const updateRegional = trpc.settings.updateRegional.useMutation({ onSuccess: () => { toast.success("Regional atualizada."); utils.settings.overview.invalidate(); setEditing(false); } });
  const updateCity = trpc.settings.updateCity.useMutation({ onSuccess: () => { toast.success("Cidade atualizada."); utils.settings.overview.invalidate(); setEditing(false); } });
  const remove = trpc.settings.deleteRegistry.useMutation({ onSuccess: () => { toast.success("Cadastro excluído com segurança."); utils.settings.overview.invalidate(); setLocation(`/cadastros/${slug}`); }, onError: error => toast.error(error.message) });

  const rows = useMemo(() => (((overview.data as Record<string, unknown> | undefined)?.[entity?.collection ?? ""] ?? []) as RegistryRecord[]), [overview.data, entity?.collection]);
  const selected = entityId ? rows.find(item => item.id === entityId) : undefined;
  const providers = (((overview.data as Record<string, unknown> | undefined)?.providers ?? []) as RegistryRecord[]);
  const regionals = (((overview.data as Record<string, unknown> | undefined)?.regionals ?? []) as RegistryRecord[]);
  const cities = (((overview.data as Record<string, unknown> | undefined)?.cities ?? []) as RegistryRecord[]);
  const stores = (((overview.data as Record<string, unknown> | undefined)?.stores ?? []) as RegistryRecord[]);
  const suppliers = (((overview.data as Record<string, unknown> | undefined)?.suppliers ?? []) as RegistryRecord[]);

  useEffect(() => {
    if (!selected) return;
    setForm({
      name: String(selected.name ?? ""),
      code: String(selected.code ?? ""), state: String(selected.state ?? "MG"), providerId: selected.providerId ? String(selected.providerId) : "",
      regionalId: selected.regionalId ? String(selected.regionalId) : "", legalName: String(selected.legalName ?? ""), billingCnpj: String(selected.billingCnpj ?? ""),
      contactName: String(selected.contactName ?? ""), phone: String(selected.phone ?? ""), email: String(selected.email ?? ""), address: String(selected.address ?? ""),
      ibgeCode: String(selected.ibgeCode ?? ""), zipCode: String(selected.zipCode ?? ""), latitude: String(selected.latitude ?? ""), longitude: String(selected.longitude ?? ""), locationNotes: String(selected.locationNotes ?? ""),
    });
  }, [selected]);

  if (!entity) return <div className="rounded-2xl border border-border bg-card p-8 text-center"><CircleAlert className="mx-auto h-7 w-7 text-muted-foreground" /><h1 className="mt-3 font-display text-xl font-semibold">Cadastro não encontrado</h1><Button className="mt-5" variant="outline" onClick={() => setLocation("/cadastros")}>Voltar aos Cadastros</Button></div>;
  if (overview.isLoading) return <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">Carregando {entity.plural.toLowerCase()}…</div>;
  const Icon = entity.icon;
  const canWrite = can("settings.write");
  const relationCards = selected ? getRelations(entity.kind, selected, { providers, regionals, cities, stores, suppliers }) : [];
  const save = () => {
    if (!selected) return;
    if (entity.kind === "provider") return updateProvider.mutate({ id: selected.id, name: form.name.trim(), legalName: form.legalName.trim() || undefined, billingCnpj: form.billingCnpj.trim() || undefined, contactName: form.contactName.trim() || undefined, phone: form.phone.trim() || undefined, email: form.email.trim() || undefined, address: form.address.trim() || undefined });
    if (entity.kind === "regional") return updateRegional.mutate({ id: selected.id, name: form.name.trim(), code: form.code.trim().toUpperCase(), providerId: form.providerId ? Number(form.providerId) : null });
    if (entity.kind === "city") return updateCity.mutate({ id: selected.id, name: form.name.trim(), state: form.state.trim().toUpperCase(), regionalId: Number(form.regionalId), ibgeCode: form.ibgeCode.trim() || undefined, address: form.address.trim() || undefined, zipCode: form.zipCode.trim() || undefined, latitude: form.latitude ? Number(form.latitude) : undefined, longitude: form.longitude ? Number(form.longitude) : undefined, locationNotes: form.locationNotes.trim() || undefined });
  };

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><Icon className="h-5 w-5" /></span><div><nav className="mb-2 flex items-center gap-1 text-xs text-muted-foreground"><button onClick={() => setLocation("/cadastros")} className="hover:text-primary">Cadastros</button><ChevronRight className="h-3 w-3" /><button onClick={() => setLocation(`/cadastros/${slug}`)} className="hover:text-primary">{entity.plural}</button>{selected ? <><ChevronRight className="h-3 w-3" /><span className="max-w-52 truncate text-foreground">{recordName(selected)}</span></> : null}</nav><h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">{selected ? recordName(selected) : entity.plural}</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{entity.description}</p></div></div>
      {!selected && canWrite ? <Button onClick={() => setLocation(`/cadastros?novo=${slug}`)} className="bg-primary text-primary-foreground"><Plus className="mr-2 h-4 w-4" />Adicionar {entity.singular.toLowerCase()}</Button> : null}
    </div>
    {!selected ? <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map(row => <button key={row.id} onClick={() => setLocation(`/cadastros/${slug}/${row.id}`)} className="rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span><Badge variant="outline" className={row.active === false ? "border-border text-muted-foreground" : "border-primary/30 bg-primary/10 text-primary"}>{row.active === false ? "Inativo" : "Ativo"}</Badge></div><h2 className="mt-5 font-display text-lg font-semibold text-foreground">{recordName(row)}</h2><p className="mt-1 min-h-5 text-xs text-muted-foreground">{summary(entity.kind, row, { providers, regionals, cities })}</p><span className="mt-5 inline-flex items-center text-xs font-semibold text-primary">Ver informações <ChevronRight className="ml-1 h-3.5 w-3.5" /></span></button>)}{rows.length === 0 ? <Card className="sm:col-span-2 xl:col-span-3"><CardContent className="p-8 text-center text-sm text-muted-foreground">Ainda não há {entity.plural.toLowerCase()} cadastradas. Use o botão acima para criar o primeiro registro.</CardContent></Card> : null}</section> : <section className="space-y-5">
      <div className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => setLocation(`/cadastros/${slug}`)}><ArrowLeft className="mr-2 h-4 w-4" />Voltar à lista</Button>{canWrite && ["provider", "regional", "city"].includes(entity.kind) ? <Button onClick={() => setEditing(value => !value)} className="bg-primary text-primary-foreground"><Pencil className="mr-2 h-4 w-4" />{editing ? "Cancelar edição" : "Editar informações"}</Button> : null}{canWrite ? <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => { if (window.confirm(`Excluir ${entity.singular.toLowerCase()}? A exclusão somente será permitida quando não houver dependências.`)) remove.mutate({ kind: entity.kind as never, id: selected.id }); }}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button> : null}</div>
      {editing ? <RegistryEditor kind={entity.kind} form={form} setForm={setForm} providers={providers} regionals={regionals} onSave={save} saving={updateProvider.isPending || updateRegional.isPending || updateCity.isPending} /> : <DetailOverview entity={entity} record={selected} />}
      {relationCards.length ? <section><h2 className="font-display text-xl font-semibold text-foreground">Vínculos e cobertura</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{relationCards.map(card => <button key={card.label} onClick={() => setLocation(card.path)} className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/40"><p className="text-2xl font-semibold text-primary">{card.count}</p><p className="mt-1 text-sm font-semibold text-foreground">{card.label}</p><p className="mt-1 text-xs text-muted-foreground">{card.description}</p></button>)}</div></section> : null}
    </section>}
  </div>;
}

function DetailOverview({ entity, record }: { entity: EntityConfig; record: RegistryRecord }) {
  const phoneUrl = whatsappUrl(record.phone as string | null | undefined);
  const entries = Object.entries({ "Status": record.active === false ? "Inativo" : "Ativo", "Código": record.code, "CNPJ": record.billingCnpj ?? record.document, "Contato": record.contactName, "E-mail": record.email, "Telefone": record.phone, "Endereço": record.address, "CEP": record.zipCode, "UF": record.state, "IBGE": record.ibgeCode, "Observações": record.locationNotes ?? record.description }).filter(([, value]) => value);
  return <Card><CardContent className="p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Informações do cadastro</p><h2 className="mt-1 font-display text-2xl font-semibold">{recordName(record)}</h2></div><Badge variant="outline" className={record.active === false ? "text-muted-foreground" : "border-primary/30 bg-primary/10 text-primary"}>{record.active === false ? "Inativo" : "Ativo"}</Badge></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{entries.map(([label, value]) => <div key={label} className="rounded-xl bg-muted/50 p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm text-foreground">{String(value)}</p></div>)}</div>{phoneUrl ? <a className="mt-5 inline-flex items-center text-sm font-semibold text-primary hover:underline" href={phoneUrl} target="_blank" rel="noreferrer">Conversar pelo WhatsApp <ExternalLink className="ml-1.5 h-3.5 w-3.5" /></a> : null}</CardContent></Card>;
}

function RegistryEditor({ kind, form, setForm, providers, regionals, onSave, saving }: { kind: string; form: Record<string, string>; setForm: (value: Record<string, string>) => void; providers: RegistryRecord[]; regionals: RegistryRecord[]; onSave: () => void; saving: boolean }) {
  const field = (key: string, label: string, type = "text") => <label className="grid gap-2 text-sm font-medium"><span>{label}</span><Input type={type} value={form[key] ?? ""} onChange={event => setForm({ ...form, [key]: event.target.value })} /></label>;
  return <Card><CardContent className="p-6"><div className="grid gap-4 md:grid-cols-2">{field("name", kind === "provider" ? "Nome da empresa" : "Nome")}{kind === "provider" ? <>{field("legalName", "Razão social")}{field("billingCnpj", "CNPJ de faturamento")}{field("contactName", "Nome do contato")}{field("phone", "Telefone")}{field("email", "E-mail", "email")}<label className="grid gap-2 text-sm font-medium md:col-span-2"><span>Endereço</span><Input value={form.address ?? ""} onChange={event => setForm({ ...form, address: event.target.value })} /></label></> : null}{kind === "regional" ? <><label className="grid gap-2 text-sm font-medium"><span>Código</span><Input value={form.code ?? ""} onChange={event => setForm({ ...form, code: event.target.value.toUpperCase() })} /></label><label className="grid gap-2 text-sm font-medium"><span>Empresa responsável</span><select value={form.providerId ?? ""} onChange={event => setForm({ ...form, providerId: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Sem empresa vinculada</option>{providers.map(provider => <option key={provider.id} value={provider.id}>{recordName(provider)}</option>)}</select></label></> : null}{kind === "city" ? <><label className="grid gap-2 text-sm font-medium"><span>Regional</span><select value={form.regionalId ?? ""} onChange={event => setForm({ ...form, regionalId: event.target.value })} className="h-10 rounded-md border border-input bg-background px-3 text-sm">{regionals.map(regional => <option key={regional.id} value={regional.id}>{recordName(regional)}</option>)}</select></label>{field("state", "UF")}{field("ibgeCode", "Código IBGE")}{field("zipCode", "CEP")}{field("address", "Endereço")}{field("latitude", "Latitude", "number")}{field("longitude", "Longitude", "number")}{field("locationNotes", "Observações de localização")}</> : null}</div><div className="mt-6 flex justify-end"><Button disabled={saving || !form.name?.trim()} onClick={onSave} className="bg-primary text-primary-foreground">{saving ? "Salvando…" : "Salvar alterações"}</Button></div></CardContent></Card>;
}

function summary(kind: string, row: RegistryRecord, lookup: { providers: RegistryRecord[]; regionals: RegistryRecord[]; cities: RegistryRecord[] }) { if (kind === "regional") { const provider = lookup.providers.find(item => item.id === Number(row.providerId)); return `${row.code ?? "Sem código"} · ${provider ? recordName(provider) : "Sem empresa vinculada"}`; } if (kind === "city") { const regional = lookup.regionals.find(item => item.id === Number(row.regionalId)); return `${row.state ?? ""} · ${regional ? recordName(regional) : "Sem regional vinculada"}`; } return String(row.email ?? row.phone ?? row.code ?? row.description ?? "Abrir detalhes do cadastro"); }
function getRelations(kind: string, record: RegistryRecord, all: { providers: RegistryRecord[]; regionals: RegistryRecord[]; cities: RegistryRecord[]; stores: RegistryRecord[]; suppliers: RegistryRecord[] }) { const companyRegionals = all.regionals.filter(item => Number(item.providerId) === record.id); const regionalCities = all.cities.filter(item => Number(item.regionalId) === record.id); const scopeCities = kind === "provider" ? all.cities.filter(city => companyRegionals.some(regional => regional.id === Number(city.regionalId))) : kind === "regional" ? regionalCities : kind === "city" ? [record] : []; const scopeStores = all.stores.filter(store => scopeCities.some(city => city.id === Number(store.cityId))); const scopeSuppliers = all.suppliers.filter(supplier => scopeCities.some(city => city.id === Number(supplier.cityId))); if (kind === "provider") return [{ label: "Regionais", count: companyRegionals.length, description: "Estruturas atendidas", path: "/cadastros/regionais" }, { label: "Cidades", count: scopeCities.length, description: "Cidades da cobertura", path: "/cadastros/cidades" }, { label: "Lojas", count: scopeStores.length, description: "Lojas vinculadas", path: "/cadastros/lojas" }, { label: "Fornecedores", count: scopeSuppliers.length, description: "Fornecedores locais", path: "/cadastros/fornecedores" }]; if (["regional", "city"].includes(kind)) return [{ label: "Cidades", count: scopeCities.length, description: "Territórios vinculados", path: "/cadastros/cidades" }, { label: "Lojas", count: scopeStores.length, description: "Lojas vinculadas", path: "/cadastros/lojas" }, { label: "Fornecedores", count: scopeSuppliers.length, description: "Fornecedores locais", path: "/cadastros/fornecedores" }]; return []; }
