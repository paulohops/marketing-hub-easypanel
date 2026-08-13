import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import { Building2, CalendarRange, Eye, ImagePlus, Loader2, MapPinned, Megaphone, PackageCheck, Pencil, Radio, Store, Upload, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
type EditableProvider = { id: number; name: string; legalName: string | null; billingCnpj: string | null; contactName: string | null; phone: string | null; email: string | null; address: string | null };
type Provider = EditableProvider & { active: boolean; logoUrl: string | null };

async function imageAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o logotipo selecionado."));
    reader.onload = () => {
      const [, base64] = String(reader.result ?? "").split(",", 2);
      base64 ? resolve(base64) : reject(new Error("Arquivo de imagem inválido."));
    };
    reader.readAsDataURL(file);
  });
}

function ProviderLogo({ provider, large = false }: { provider: Provider; large?: boolean }) {
  const dimensions = large ? "h-24 w-24" : "h-20 w-20";
  return <div className={`grid ${dimensions} shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-secondary p-2`}>
    {provider.logoUrl ? <img src={provider.logoUrl} alt={`Logotipo de ${provider.name}`} className="h-full w-full object-contain" /> : <Building2 className="h-8 w-8 text-primary" />}
  </div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm text-foreground">{value}</p></div>;
}

function Field({ name, label, defaultValue, type = "text", required = false }: { name: string; label: string; defaultValue: string; type?: string; required?: boolean }) {
  return <div><Label htmlFor={`provider-${name}`}>{label}</Label><Input id={`provider-${name}`} name={name} type={type} required={required} className="mt-1.5" defaultValue={defaultValue} /></div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof MapPinned; label: string; value: number }) {
  return <div className="border-r border-border p-3 last:border-r-0"><Icon className="h-4 w-4 text-primary" /><p className="mt-2 text-xl font-semibold text-foreground">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}

export default function CompaniesWorkspace() {
  const utils = trpc.useUtils();
  const { can } = useEffectivePermissions();
  const overview = trpc.settings.overview.useQuery();
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [editingProvider, setEditingProvider] = useState<EditableProvider | null>(null);
  const [uploadingProviderId, setUploadingProviderId] = useState<number | null>(null);
  const canWrite = can("settings.write");

  const uploadLogo = trpc.settings.uploadProviderLogo.useMutation({
    onSuccess: async () => { await utils.settings.overview.invalidate(); toast.success("Logotipo atualizado."); setUploadingProviderId(null); },
    onError: error => { toast.error(error.message); setUploadingProviderId(null); },
  });
  const updateProvider = trpc.settings.updateProvider.useMutation({
    onSuccess: async () => { await utils.settings.overview.invalidate(); setEditingProvider(null); toast.success("Dados da empresa atualizados."); },
    onError: error => toast.error(error.message),
  });

  const footprints = useMemo(() => {
    const data = overview.data;
    if (!data) return new Map<number, { actions: number; events: number; media: number }>();
    const operationalFootprint = data.operationalFootprint ?? { actions: [], events: [], mediaPoints: [], mediaCampaigns: [] };
    const mediaCityByPoint = new Map(operationalFootprint.mediaPoints.map(point => [point.id, point.cityId]));
    const campaignsByCity = new Map<number, number>();
    operationalFootprint.mediaCampaigns.forEach(campaign => {
      const cityId = mediaCityByPoint.get(campaign.mediaPointId);
      if (cityId) campaignsByCity.set(cityId, (campaignsByCity.get(cityId) ?? 0) + 1);
    });
    const countByCity = new Map<number, { actions: number; events: number; media: number }>();
    const ensure = (cityId: number) => countByCity.get(cityId) ?? { actions: 0, events: 0, media: 0 };
    operationalFootprint.actions.forEach(row => { const current = ensure(row.cityId); current.actions += 1; countByCity.set(row.cityId, current); });
    operationalFootprint.events.forEach(row => { const current = ensure(row.cityId); current.events += 1; countByCity.set(row.cityId, current); });
    campaignsByCity.forEach((media, cityId) => { const current = ensure(cityId); current.media += media; countByCity.set(cityId, current); });
    const byProvider = new Map<number, { actions: number; events: number; media: number }>();
    data.providers.forEach(provider => {
      const regionalIds = new Set(data.regionals.filter(regional => regional.providerId === provider.id).map(regional => regional.id));
      const cityIds = data.cities.filter(city => regionalIds.has(city.regionalId)).map(city => city.id);
      const total = cityIds.reduce((accumulator, cityId) => {
        const current = countByCity.get(cityId);
        return { actions: accumulator.actions + (current?.actions ?? 0), events: accumulator.events + (current?.events ?? 0), media: accumulator.media + (current?.media ?? 0) };
      }, { actions: 0, events: 0, media: 0 });
      byProvider.set(provider.id, total);
    });
    return byProvider;
  }, [overview.data]);

  if (overview.isLoading) return <div className="grid min-h-[320px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const data = overview.data;
  if (!data) return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Não foi possível carregar as empresas.</div>;

  const providerScope = (provider: Provider) => {
    const regionals = data.regionals.filter(regional => regional.providerId === provider.id);
    const regionalIds = new Set(regionals.map(regional => regional.id));
    const cities = data.cities.filter(city => regionalIds.has(city.regionalId));
    const cityIds = new Set(cities.map(city => city.id));
    return { regionals, cities, stores: data.stores.filter(store => cityIds.has(store.cityId)), suppliers: data.suppliers.filter(supplier => supplier.providerId === provider.id), counts: footprints.get(provider.id) ?? { actions: 0, events: 0, media: 0 } };
  };

  const edit = (provider: Provider) => setEditingProvider({ id: provider.id, name: provider.name, legalName: provider.legalName, billingCnpj: provider.billingCnpj, contactName: provider.contactName, phone: provider.phone, email: provider.email, address: provider.address });
  const upload = async (provider: Provider, file?: File) => {
    if (!file) return;
    if (!acceptedImageTypes.includes(file.type as (typeof acceptedImageTypes)[number])) return toast.error("Escolha uma imagem JPG, PNG ou WEBP.");
    if (file.size > 3 * 1024 * 1024) return toast.error("O logotipo deve ter até 3 MB.");
    try { setUploadingProviderId(provider.id); uploadLogo.mutate({ providerId: provider.id, originalName: file.name, mimeType: file.type as (typeof acceptedImageTypes)[number], dataBase64: await imageAsBase64(file) }); }
    catch (error) { setUploadingProviderId(null); toast.error(error instanceof Error ? error.message : "Não foi possível preparar o logotipo."); }
  };

  return <div className="mx-auto max-w-7xl space-y-5">
    <header className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><Building2 className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Cadastros operacionais</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Empresas</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Consulte a estrutura territorial, fornecedores, lojas e o volume de operações vinculadas a cada empresa.</p></div></div></header>
    {data.providers.length ? <section className="grid gap-4 xl:grid-cols-2">{data.providers.map(provider => {
      const scope = providerScope(provider as Provider);
      return <article key={provider.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="flex gap-4 p-5"><ProviderLogo provider={provider as Provider} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="truncate font-display text-xl font-semibold text-foreground">{provider.name}</h2><p className="mt-1 text-sm text-muted-foreground">{provider.legalName ?? "Razão social não informada"}</p></div><span className={provider.active ? "rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary" : "rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"}>{provider.active ? "Ativa" : "Inativa"}</span></div><p className="mt-3 text-sm text-muted-foreground">CNPJ de faturamento: <span className="font-medium text-foreground">{provider.billingCnpj ?? "Não informado"}</span></p></div></div><div className="grid grid-cols-2 border-y border-border bg-secondary/25 sm:grid-cols-4"><Metric icon={MapPinned} label="Regionais" value={scope.regionals.length} /><Metric icon={Store} label="Cidades" value={scope.cities.length} /><Metric icon={PackageCheck} label="Lojas" value={scope.stores.length} /><Metric icon={UsersRound} label="Fornecedores" value={scope.suppliers.length} /></div><div className="grid grid-cols-3 border-b border-border bg-background"><Metric icon={Megaphone} label="Ações" value={scope.counts.actions} /><Metric icon={CalendarRange} label="Eventos" value={scope.counts.events} /><Metric icon={Radio} label="Mídias" value={scope.counts.media} /></div><div className="flex flex-wrap gap-2 p-5"><Button type="button" size="sm" variant="outline" onClick={() => setSelectedProvider(provider as Provider)}><Eye className="mr-2 h-4 w-4" />Ver detalhes</Button>{canWrite ? <Button type="button" variant="outline" size="sm" onClick={() => edit(provider as Provider)}><Pencil className="mr-2 h-4 w-4" />Editar</Button> : null}{canWrite ? <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent"><Upload className="mr-2 h-4 w-4" />{uploadingProviderId === provider.id ? "Enviando..." : provider.logoUrl ? "Trocar logo" : "Adicionar logo"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploadingProviderId !== null} onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ""; void upload(provider as Provider, file); }} /></label> : null}</div></article>;
    })}</section> : <section className="grid min-h-[320px] place-items-center rounded-2xl border border-dashed border-border bg-card p-8 text-center"><div><ImagePlus className="mx-auto h-8 w-8 text-primary" /><h2 className="mt-4 font-display text-xl font-semibold text-foreground">Nenhuma empresa cadastrada</h2><p className="mt-2 text-sm text-muted-foreground">Cadastre a primeira empresa no centro de cadastros operacionais.</p><Button asChild className="mt-5"><Link href="/cadastros">Abrir cadastros</Link></Button></div></section>}
    <Dialog open={selectedProvider !== null} onOpenChange={open => { if (!open) setSelectedProvider(null); }}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">{selectedProvider ? (() => { const scope = providerScope(selectedProvider); return <><DialogHeader><div className="flex items-start gap-4"><ProviderLogo provider={selectedProvider} large /><div><DialogTitle>{selectedProvider.name}</DialogTitle><DialogDescription className="mt-2">Visão relacional de territórios, unidades, fornecedores e operações vinculadas.</DialogDescription></div></div></DialogHeader><div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border sm:grid-cols-4"><Metric icon={MapPinned} label="Regionais" value={scope.regionals.length} /><Metric icon={Store} label="Cidades" value={scope.cities.length} /><Metric icon={PackageCheck} label="Lojas" value={scope.stores.length} /><Metric icon={UsersRound} label="Fornecedores" value={scope.suppliers.length} /></div><div className="grid grid-cols-3 overflow-hidden rounded-xl border border-border"><Metric icon={Megaphone} label="Ações" value={scope.counts.actions} /><Metric icon={CalendarRange} label="Eventos" value={scope.counts.events} /><Metric icon={Radio} label="Mídias" value={scope.counts.media} /></div><div className="grid gap-4 sm:grid-cols-2"><Detail label="Razão social" value={selectedProvider.legalName ?? "Não informada"} /><Detail label="CNPJ de faturamento" value={selectedProvider.billingCnpj ?? "Não informado"} /><Detail label="Contato" value={selectedProvider.contactName ?? "Não informado"} /><Detail label="Telefone" value={selectedProvider.phone ?? "Não informado"} /><Detail label="E-mail" value={selectedProvider.email ?? "Não informado"} /><Detail label="Endereço" value={selectedProvider.address ?? "Não informado"} /></div><RelationList title="Regionais" values={scope.regionals.map(item => `${item.name} · ${item.code}`)} /><RelationList title="Cidades atendidas" values={scope.cities.map(item => item.name)} /><RelationList title="Lojas vinculadas" values={scope.stores.map(item => item.name)} /><RelationList title="Fornecedores vinculados" values={scope.suppliers.map(item => item.displayName)} /></>; })() : null}</DialogContent></Dialog>
    <Dialog open={editingProvider !== null} onOpenChange={open => { if (!open) setEditingProvider(null); }}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Editar empresa</DialogTitle><DialogDescription>Atualize as informações cadastrais sem alterar suas relações territoriais ou o histórico operacional.</DialogDescription></DialogHeader>{editingProvider ? <form className="grid gap-4" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const optional = (key: string) => String(form.get(key) ?? "").trim() || undefined; updateProvider.mutate({ id: editingProvider.id, name: String(form.get("name") ?? "").trim(), legalName: optional("legalName"), billingCnpj: optional("billingCnpj"), contactName: optional("contactName"), email: optional("email"), phone: optional("phone"), address: optional("address") }); }}><div className="grid gap-4 sm:grid-cols-2"><Field name="name" label="Nome da empresa" defaultValue={editingProvider.name} required /><Field name="legalName" label="Razão social" defaultValue={editingProvider.legalName ?? ""} /><Field name="billingCnpj" label="CNPJ de faturamento" defaultValue={editingProvider.billingCnpj ?? ""} /><Field name="contactName" label="Pessoa de contato" defaultValue={editingProvider.contactName ?? ""} /><Field name="email" label="E-mail" type="email" defaultValue={editingProvider.email ?? ""} /><Field name="phone" label="Telefone" defaultValue={editingProvider.phone ?? ""} /></div><Field name="address" label="Endereço" defaultValue={editingProvider.address ?? ""} /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditingProvider(null)}>Cancelar</Button><Button type="submit" disabled={updateProvider.isPending}>{updateProvider.isPending ? "Salvando..." : "Salvar alterações"}</Button></div></form> : null}</DialogContent></Dialog>
  </div>;
}

function RelationList({ title, values }: { title: string; values: string[] }) {
  return <section><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>{values.length ? <div className="mt-2 flex flex-wrap gap-2">{values.map(value => <span key={value} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground">{value}</span>)}</div> : <p className="mt-2 text-sm text-muted-foreground">Nenhum vínculo cadastrado.</p>}</section>;
}
