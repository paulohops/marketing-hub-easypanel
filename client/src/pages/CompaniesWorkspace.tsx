import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Building2, CalendarRange, Eye, FilePlus2, FileText, ImagePlus, Loader2, MapPinned, Megaphone, PackageCheck, Pencil, Radio, Search, Store, Upload, UsersRound, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";

const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const acceptedDocumentTypes = ["application/pdf", ...acceptedImageTypes] as const;
type EditableProvider = { id: number; name: string; legalName: string | null; billingCnpj: string | null; contactName: string | null; phone: string | null; email: string | null; address: string | null; headquartersCityId: number | null; brandColors: string[] };
type Provider = EditableProvider & { active: boolean; logoStorageKey: string | null; logoUrl: string | null; cnpjCardStorageKey: string | null; cnpjCardUrl: string | null; brandManualStorageKey: string | null; brandManualUrl: string | null; createdAt: Date; updatedAt: Date };
type ProviderDocument = { id: number; providerId: number; title: string; url: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: Date | string };

async function fileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
    reader.onload = () => {
      const [, base64] = String(reader.result ?? "").split(",", 2);
      base64 ? resolve(base64) : reject(new Error("Arquivo inválido."));
    };
    reader.readAsDataURL(file);
  });
}

function ProviderLogo({ provider, large = false }: { provider: Provider; large?: boolean }) {
  const dimensions = large ? "h-28 w-28 sm:h-32 sm:w-32" : "h-16 w-16 sm:h-20 sm:w-20";
  return <div className={`grid ${dimensions} shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-secondary p-2 shadow-sm`}>
    {provider.logoUrl ? <img src={provider.logoUrl} alt={`Logotipo de ${provider.name}`} className="h-full w-full object-contain" /> : <Building2 className="h-8 w-8 text-primary" />}
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof MapPinned; label: string; value: number }) {
  return <div className="min-w-0 border-r border-border px-3 py-3 last:border-r-0"><Icon className="h-4 w-4 text-primary" /><p className="mt-2 text-xl font-semibold text-foreground">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div>;
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="rounded-xl border border-border bg-background p-3.5"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className="mt-1.5 break-words text-sm font-medium text-foreground">{value?.trim() ? value : "Não informado"}</p></div>;
}

function BrandColors({ colors }: { colors: string[] | null | undefined }) {
  const validColors = (colors ?? []).map(color => color.trim().toUpperCase()).filter(color => /^#[0-9A-F]{6}$/.test(color));
  return validColors.length ? <div className="flex flex-wrap gap-2">{validColors.map(color => <span key={color} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground"><span aria-hidden="true" className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: color }} />{color}</span>)}</div> : <p className="text-sm text-muted-foreground">Não informado</p>;
}

function Field({ name, label, defaultValue, type = "text", required = false }: { name: string; label: string; defaultValue: string; type?: string; required?: boolean }) {
  return <div><Label htmlFor={`provider-${name}`}>{label}</Label><Input id={`provider-${name}`} name={name} type={type} required={required} className="mt-1.5" defaultValue={defaultValue} /></div>;
}

function DocumentCard({ label, url, canWrite, uploading, onUpload }: { label: string; url: string | null; canWrite: boolean; uploading: boolean; onUpload: (file?: File) => void }) {
  const inputId = `provider-document-${label.toLowerCase().replaceAll(" ", "-")}`;
  return <div className="rounded-xl border border-border bg-background p-3.5"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><FileText className="h-4 w-4" /></span><div className="min-w-0"><p className="text-sm font-semibold text-foreground">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{url ? "Documento disponível" : "Não informado"}</p></div></div><div className="flex shrink-0 gap-2">{url ? <Button size="sm" variant="outline" asChild><a href={url} target="_blank" rel="noreferrer">Abrir</a></Button> : null}{canWrite ? <label htmlFor={inputId}><Button type="button" size="sm" variant="outline" asChild disabled={uploading}><span><Upload className="mr-1.5 h-3.5 w-3.5" />{uploading ? "Enviando" : url ? "Trocar" : "Anexar"}</span></Button></label> : null}</div></div><input id={inputId} type="file" className="sr-only" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={!canWrite || uploading} onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ""; onUpload(file); }} /></div>;
}

function RelationList({ title, values }: { title: string; values: string[] }) {
  return <section className="rounded-2xl border border-border bg-card p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>{values.length ? <div className="mt-3 flex flex-wrap gap-2">{values.map(value => <span key={value} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground">{value}</span>)}</div> : <p className="mt-3 text-sm text-muted-foreground">Não informado</p>}</section>;
}

export default function CompaniesWorkspace() {
  const [, setLocation] = useLocation();
  const [isDetailRoute, routeParams] = useRoute("/empresas/:providerId");
  const selectedId = isDetailRoute && routeParams?.providerId ? Number(routeParams.providerId) : null;
  const utils = trpc.useUtils();
  const { can } = useEffectivePermissions();
  const canWrite = can("settings.write");
  const overview = trpc.settings.overview.useQuery();
  const [editingProvider, setEditingProvider] = useState<EditableProvider | null>(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [additionalDocument, setAdditionalDocument] = useState({ title: "", file: null as File | null });
  const data = overview.data;
  const updateProvider = trpc.settings.updateProvider.useMutation();
  const uploadLogo = trpc.settings.uploadProviderLogo.useMutation();
  const uploadCnpjCard = trpc.settings.uploadProviderCnpjCard.useMutation();
  const uploadBrandManual = trpc.settings.uploadProviderBrandManual.useMutation();
  const uploadProviderDocument = trpc.settings.uploadProviderDocument.useMutation();
  const deleteProviderDocument = trpc.settings.deleteProviderDocument.useMutation();

  const updateCacheProvider = (updated: Provider) => {
    utils.settings.overview.setData(undefined, current => current ? { ...current, providers: current.providers.map(provider => provider.id === updated.id ? updated : provider) } : current);
  };
  const refresh = async () => { await utils.settings.overview.invalidate(); };
  const footprints = useMemo(() => {
    if (!data) return new Map<number, { actions: number; events: number; media: number }>();
    const operationalFootprint = data.operationalFootprint ?? { actions: [], events: [], mediaPoints: [], mediaCampaigns: [] };
    const mediaCityByPoint = new Map(operationalFootprint.mediaPoints.map(point => [point.id, point.cityId]));
    const campaignMedia = new Map<number, number>();
    operationalFootprint.mediaCampaigns.forEach(campaign => { const cityId = mediaCityByPoint.get(campaign.mediaPointId); if (cityId) campaignMedia.set(cityId, (campaignMedia.get(cityId) ?? 0) + 1); });
    const byCity = new Map<number, { actions: number; events: number; media: number }>();
    const ensure = (cityId: number) => byCity.get(cityId) ?? { actions: 0, events: 0, media: 0 };
    operationalFootprint.actions.forEach(row => { const current = ensure(row.cityId); current.actions += 1; byCity.set(row.cityId, current); });
    operationalFootprint.events.forEach(row => { const current = ensure(row.cityId); current.events += 1; byCity.set(row.cityId, current); });
    campaignMedia.forEach((media, cityId) => { const current = ensure(cityId); current.media += media; byCity.set(cityId, current); });
    return new Map(data.providers.map(provider => {
      const regionalIds = new Set(data.regionals.filter(regional => regional.providerId === provider.id).map(regional => regional.id));
      const cityIds = data.cities.filter(city => regionalIds.has(city.regionalId)).map(city => city.id);
      return [provider.id, cityIds.reduce((sum, cityId) => { const current = byCity.get(cityId); return { actions: sum.actions + (current?.actions ?? 0), events: sum.events + (current?.events ?? 0), media: sum.media + (current?.media ?? 0) }; }, { actions: 0, events: 0, media: 0 })];
    }));
  }, [data]);

  if (overview.isLoading) return <div className="grid min-h-[320px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!data) return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Não foi possível carregar as empresas.</div>;

  const providerScope = (provider: Provider) => {
    const regionals = data.regionals.filter(regional => regional.providerId === provider.id);
    const cityIds = new Set(data.cities.filter(city => regionals.some(regional => regional.id === city.regionalId)).map(city => city.id));
    return { regionals, cities: data.cities.filter(city => cityIds.has(city.id)), stores: data.stores.filter(store => cityIds.has(store.cityId)), suppliers: data.suppliers.filter(supplier => supplier.providerId === provider.id), documents: ((data.providerDocuments ?? []) as ProviderDocument[]).filter(document => document.providerId === provider.id), counts: footprints.get(provider.id) ?? { actions: 0, events: 0, media: 0 } };
  };
  const selectedProvider = selectedId ? (data.providers.find(provider => provider.id === selectedId) as Provider | undefined) : undefined;
  const visibleProviders = data.providers.filter(provider => `${provider.name} ${provider.legalName ?? ""} ${provider.billingCnpj ?? ""}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))) as Provider[];
  const edit = (provider: Provider) => setEditingProvider({ id: provider.id, name: provider.name, legalName: provider.legalName, billingCnpj: provider.billingCnpj, contactName: provider.contactName, phone: provider.phone, email: provider.email, address: provider.address, headquartersCityId: provider.headquartersCityId, brandColors: provider.brandColors ?? [] });
  const submitProvider = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingProvider) return;
    const form = new FormData(event.currentTarget);
    const optional = (key: string) => String(form.get(key) ?? "").trim() || undefined;
    try {
      const updated = await updateProvider.mutateAsync({ id: editingProvider.id, name: String(form.get("name") ?? "").trim(), legalName: optional("legalName"), billingCnpj: optional("billingCnpj"), contactName: optional("contactName"), email: optional("email"), phone: optional("phone"), address: optional("address"), headquartersCityId: editingProvider.headquartersCityId, brandColors: (editingProvider.brandColors ?? []).map(color => color.trim()).filter(Boolean) });
      updateCacheProvider(updated as Provider);
      setEditingProvider(null);
      await refresh();
      toast.success("Dados da empresa atualizados.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar as alterações."); }
  };
  const uploadInstitutional = async (provider: Provider, kind: "logo" | "cnpj" | "manual", file?: File) => {
    if (!file) return;
    const imageOnly = kind === "logo";
    if (!(imageOnly ? acceptedImageTypes : acceptedDocumentTypes).includes(file.type as never)) return toast.error(imageOnly ? "Escolha uma imagem JPG, PNG ou WEBP." : "Escolha um PDF, JPG, PNG ou WEBP.");
    const limit = kind === "logo" ? 3 : kind === "cnpj" ? 5 : 10;
    if (file.size > limit * 1024 * 1024) return toast.error(`O arquivo deve ter até ${limit} MB.`);
    const uploadKey = `${provider.id}:${kind}`;
    try {
      setUploading(uploadKey);
      const payload = { providerId: provider.id, originalName: file.name, mimeType: file.type as "application/pdf" | "image/jpeg" | "image/png" | "image/webp", dataBase64: await fileAsBase64(file) };
      const updated = kind === "logo" ? await uploadLogo.mutateAsync(payload as never) : kind === "cnpj" ? await uploadCnpjCard.mutateAsync(payload) : await uploadBrandManual.mutateAsync(payload);
      updateCacheProvider(updated as Provider);
      await refresh();
      toast.success(kind === "logo" ? "Logotipo atualizado." : kind === "cnpj" ? "Cartão CNPJ atualizado." : "Manual da marca atualizado.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível enviar o arquivo."); } finally { setUploading(null); }
  };
  const uploadAdditionalDocument = async (provider: Provider) => {
    const { title, file } = additionalDocument;
    if (!file) return toast.error("Selecione o arquivo complementar.");
    if (!title.trim()) return toast.error("Informe um título para o documento complementar.");
    if (!acceptedDocumentTypes.includes(file.type as never)) return toast.error("Escolha um PDF, JPG, PNG ou WEBP.");
    if (file.size > 10 * 1024 * 1024) return toast.error("O documento complementar deve ter até 10 MB.");
    try {
      setUploading(`${provider.id}:extra`);
      const created = await uploadProviderDocument.mutateAsync({ providerId: provider.id, title: title.trim(), originalName: file.name, mimeType: file.type as "application/pdf" | "image/jpeg" | "image/png" | "image/webp", dataBase64: await fileAsBase64(file) });
      utils.settings.overview.setData(undefined, current => current ? { ...current, providerDocuments: [...(current.providerDocuments ?? []), created] } : current);
      setAdditionalDocument({ title: "", file: null });
      await refresh();
      toast.success("Documento complementar adicionado.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível adicionar o documento."); } finally { setUploading(null); }
  };
  const removeAdditionalDocument = async (providerId: number, documentId: number) => {
    try {
      await deleteProviderDocument.mutateAsync({ providerId, documentId });
      utils.settings.overview.setData(undefined, current => current ? { ...current, providerDocuments: (current.providerDocuments ?? []).filter(document => document.id !== documentId) } : current);
      await refresh();
      toast.success("Documento complementar removido.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível remover o documento."); }
  };

  if (selectedProvider) {
    const scope = providerScope(selectedProvider);
    const headquarters = scope.cities.find(city => city.id === selectedProvider.headquartersCityId);
    return <div className="mx-auto max-w-7xl space-y-5"><header className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><Button type="button" variant="ghost" size="sm" onClick={() => setLocation("/empresas")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar para Empresas</Button><div className="mt-5 flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div className="flex min-w-0 items-start gap-4"><ProviderLogo provider={selectedProvider} large /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="min-w-0 break-words font-display text-3xl font-semibold tracking-tight text-foreground">{selectedProvider.name}</h1><span className={selectedProvider.active ? "rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary" : "rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"}>{selectedProvider.active ? "Ativa" : "Inativa"}</span></div><p className="mt-2 text-sm text-muted-foreground">{selectedProvider.legalName || "Não informado"}</p><p className="mt-1 text-sm text-muted-foreground">Matriz: <span className="font-medium text-foreground">{headquarters ? `${headquarters.name} · ${headquarters.state}` : "Não informado"}</span></p></div></div><div className="flex flex-wrap gap-2">{canWrite ? <Button type="button" variant="outline" onClick={() => edit(selectedProvider)}><Pencil className="mr-2 h-4 w-4" />Editar empresa</Button> : null}{canWrite ? <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent"><Upload className="mr-2 h-4 w-4" />{uploading === `${selectedProvider.id}:logo` ? "Enviando..." : selectedProvider.logoUrl ? "Trocar logo" : "Adicionar logo"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading !== null} onChange={event => { const file = event.target.files?.[0]; event.currentTarget.value = ""; void uploadInstitutional(selectedProvider, "logo", file); }} /></label> : null}</div></div></header><section className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-sm grid-cols-2 lg:grid-cols-4"><Metric icon={MapPinned} label="Regionais" value={scope.regionals.length} /><Metric icon={Store} label="Cidades" value={scope.cities.length} /><Metric icon={PackageCheck} label="Lojas" value={scope.stores.length} /><Metric icon={UsersRound} label="Fornecedores" value={scope.suppliers.length} /></section><section className="grid overflow-hidden rounded-2xl border border-border bg-card shadow-sm grid-cols-3"><Metric icon={Megaphone} label="Ações" value={scope.counts.actions} /><Metric icon={CalendarRange} label="Eventos" value={scope.counts.events} /><Metric icon={Radio} label="Mídias" value={scope.counts.media} /></section><section className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]"><div className="space-y-5"><div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span><div><h2 className="font-display text-xl font-semibold text-foreground">Dados cadastrais</h2><p className="text-sm text-muted-foreground">Informações institucionais, fiscais e de contato.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Detail label="Nome da empresa" value={selectedProvider.name} /><Detail label="Razão social" value={selectedProvider.legalName} /><Detail label="CNPJ de faturamento" value={selectedProvider.billingCnpj} /><Detail label="Pessoa de contato" value={selectedProvider.contactName} /><Detail label="E-mail" value={selectedProvider.email} /><Detail label="Telefone" value={selectedProvider.phone} /><Detail label="Cidade-matriz" value={headquarters ? `${headquarters.name} · ${headquarters.state}` : null} /><Detail label="Endereço de faturamento" value={selectedProvider.address} /></div></div><div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="font-display text-xl font-semibold text-foreground">Identidade visual</h2><p className="mt-1 text-sm text-muted-foreground">Paleta institucional registrada para a Empresa.</p><div className="mt-4"><BrandColors colors={selectedProvider.brandColors} /></div></div><div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><h2 className="font-display text-xl font-semibold text-foreground">Documentos institucionais</h2><p className="mt-1 text-sm text-muted-foreground">Arquivos essenciais vinculados à identificação da Empresa.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><DocumentCard label="Cartão CNPJ" url={selectedProvider.cnpjCardUrl} canWrite={canWrite} uploading={uploading === `${selectedProvider.id}:cnpj`} onUpload={file => void uploadInstitutional(selectedProvider, "cnpj", file)} /><DocumentCard label="Manual da marca" url={selectedProvider.brandManualUrl} canWrite={canWrite} uploading={uploading === `${selectedProvider.id}:manual`} onUpload={file => void uploadInstitutional(selectedProvider, "manual", file)} /></div></div></div><aside className="space-y-5"><div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><FilePlus2 className="h-5 w-5" /></span><div><h2 className="font-display text-xl font-semibold text-foreground">Outros documentos</h2><p className="text-sm text-muted-foreground">Arquivos complementares da Empresa.</p></div></div>{canWrite ? <div className="mt-4 space-y-3 rounded-xl border border-dashed border-border bg-muted/20 p-3"><div><Label htmlFor="provider-extra-title">Título do documento</Label><Input id="provider-extra-title" className="mt-1.5" value={additionalDocument.title} onChange={event => setAdditionalDocument(current => ({ ...current, title: event.target.value }))} placeholder="Ex.: Certidão municipal" /></div><div><Label htmlFor="provider-extra-file">Arquivo</Label><Input id="provider-extra-file" className="mt-1.5" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => setAdditionalDocument(current => ({ ...current, file: event.target.files?.[0] ?? null }))} /><p className="mt-1.5 text-xs text-muted-foreground">PDF ou imagem, até 10 MB.</p></div><Button type="button" className="w-full" disabled={uploading === `${selectedProvider.id}:extra`} onClick={() => void uploadAdditionalDocument(selectedProvider)}><Upload className="mr-2 h-4 w-4" />{uploading === `${selectedProvider.id}:extra` ? "Enviando..." : "Adicionar documento"}</Button></div> : null}<div className="mt-4 space-y-2">{scope.documents.length ? scope.documents.map(document => <div key={document.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3"><div className="flex min-w-0 items-center gap-3"><FileText className="h-4 w-4 shrink-0 text-primary" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{document.title}</p><p className="truncate text-xs text-muted-foreground">{document.originalName}</p></div></div><div className="flex shrink-0 gap-1"><Button size="sm" variant="outline" asChild><a href={document.url} target="_blank" rel="noreferrer">Abrir</a></Button>{canWrite ? <Button size="icon" variant="ghost" aria-label={`Remover ${document.title}`} disabled={deleteProviderDocument.isPending} onClick={() => void removeAdditionalDocument(selectedProvider.id, document.id)}><X className="h-4 w-4" /></Button> : null}</div></div>) : <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Não informado</p>}</div></div><RelationList title="Regionais vinculadas" values={scope.regionals.map(item => `${item.name} · ${item.code}`)} /><RelationList title="Cidades atendidas" values={scope.cities.map(item => `${item.name} · ${item.state}`)} /><RelationList title="Lojas vinculadas" values={scope.stores.map(item => item.name)} /><RelationList title="Fornecedores vinculados" values={scope.suppliers.map(item => item.displayName)} /></aside></section><ProviderEditDialog provider={editingProvider} scope={editingProvider ? providerScope(editingProvider as Provider) : null} pending={updateProvider.isPending} onOpenChange={open => { if (!open) setEditingProvider(null); }} onSubmit={submitProvider} onChange={setEditingProvider} /></div>;
  }
  if (selectedId) return <div className="mx-auto max-w-5xl rounded-2xl border border-border bg-card p-8 text-center"><Building2 className="mx-auto h-9 w-9 text-primary" /><h1 className="mt-4 font-display text-2xl font-semibold text-foreground">Empresa não encontrada</h1><p className="mt-2 text-sm text-muted-foreground">O cadastro pode ter sido excluído ou você não tem mais acesso a ele.</p><Button className="mt-5" onClick={() => setLocation("/empresas")}>Voltar para Empresas</Button></div>;

  return <div className="mx-auto max-w-7xl space-y-5"><header className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Cadastros operacionais</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Empresas</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Selecione uma Empresa para consultar seus dados cadastrais, cobertura territorial, documentos e operações vinculadas.</p></div><div className="relative w-full md:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} className="pl-9" placeholder="Buscar empresa, razão social ou CNPJ" /></div></div></header>{visibleProviders.length ? <section className="space-y-3">{visibleProviders.map(provider => { const scope = providerScope(provider); return <button key={provider.id} type="button" onClick={() => setLocation(`/empresas/${provider.id}`)} className="group grid w-full gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-5"><ProviderLogo provider={provider} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-display text-xl font-semibold text-foreground">{provider.name}</h2><span className={provider.active ? "rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary" : "rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"}>{provider.active ? "Ativa" : "Inativa"}</span></div><p className="mt-1 truncate text-sm text-muted-foreground">{provider.legalName || "Não informado"}</p><div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-4"><p><span className="font-medium text-foreground">CNPJ:</span> {provider.billingCnpj || "Não informado"}</p><p><span className="font-medium text-foreground">Cidades:</span> {scope.cities.length}</p><p><span className="font-medium text-foreground">Lojas:</span> {scope.stores.length}</p><p><span className="font-medium text-foreground">Fornecedores:</span> {scope.suppliers.length}</p></div></div><span className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground group-hover:border-primary/40 group-hover:text-primary"><Eye className="mr-2 h-4 w-4" />Ver ficha</span></button>; })}</section> : <section className="grid min-h-[320px] place-items-center rounded-2xl border border-dashed border-border bg-card p-8 text-center"><div><ImagePlus className="mx-auto h-8 w-8 text-primary" /><h2 className="mt-4 font-display text-xl font-semibold text-foreground">Nenhuma empresa encontrada</h2><p className="mt-2 text-sm text-muted-foreground">{data.providers.length ? "Tente ajustar a busca." : "Cadastre a primeira empresa no centro de cadastros operacionais."}</p>{data.providers.length ? <Button className="mt-5" variant="outline" onClick={() => setSearch("")}>Limpar busca</Button> : <Button asChild className="mt-5"><Link href="/cadastros/operacionais">Abrir cadastros</Link></Button>}</div></section>}</div>;
}

function ProviderEditDialog({ provider, scope, pending, onOpenChange, onSubmit, onChange }: { provider: EditableProvider | null; scope: { cities: Array<{ id: number; name: string; state: string; active: boolean }> } | null; pending: boolean; onOpenChange: (open: boolean) => void; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onChange: (next: React.SetStateAction<EditableProvider | null>) => void }) {
  return <Dialog open={provider !== null} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Editar empresa</DialogTitle><DialogDescription>Atualize os dados institucionais sem alterar relações territoriais ou o histórico operacional.</DialogDescription></DialogHeader>{provider ? <form className="grid gap-4" onSubmit={onSubmit}><div className="grid gap-4 sm:grid-cols-2"><Field name="name" label="Nome da empresa" defaultValue={provider.name} required /><Field name="legalName" label="Razão social" defaultValue={provider.legalName ?? ""} /><Field name="billingCnpj" label="CNPJ de faturamento" defaultValue={provider.billingCnpj ?? ""} /><Field name="contactName" label="Pessoa de contato" defaultValue={provider.contactName ?? ""} /><Field name="email" label="E-mail" type="email" defaultValue={provider.email ?? ""} /><Field name="phone" label="Telefone" defaultValue={provider.phone ?? ""} /></div><Field name="address" label="Endereço de faturamento" defaultValue={provider.address ?? ""} /><SearchableMultiSelect id="company-headquarters-city" label="Cidade-matriz" maxSelections={1} options={((scope as any)?.cities ?? []).filter((city: any) => city.active).map((city: any) => ({ id: city.id, label: `${city.name} · ${city.state}` }))} values={provider.headquartersCityId ? [provider.headquartersCityId] : []} onChange={values => onChange(current => current ? { ...current, headquartersCityId: values[0] ? Number(values[0]) : null } : current)} placeholder="Selecionar cidade vinculada" emptyMessage="Nenhuma cidade vinculada à Empresa" /><div><Label htmlFor="company-brand-colors">Cores da empresa (hexadecimal)</Label><Input id="company-brand-colors" className="mt-1.5" value={(provider.brandColors ?? []).join(", ")} onChange={event => onChange(current => current ? { ...current, brandColors: event.target.value.split(",").map(color => color.trim()).filter(Boolean) } : current)} placeholder="#0E723B, #F45103" /><p className="mt-1.5 text-xs text-muted-foreground">Separe até 10 cores por vírgula, no formato #RRGGBB.</p><div className="mt-2"><BrandColors colors={provider.brandColors} /></div></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar alterações"}</Button></div></form> : null}</DialogContent></Dialog>;
}
