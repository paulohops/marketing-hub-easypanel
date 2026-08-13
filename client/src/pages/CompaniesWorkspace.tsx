import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import { Building2, ImagePlus, Loader2, MapPinned, PackageCheck, Pencil, Store, Upload, UsersRound } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
type EditableProvider = { id: number; name: string; legalName: string | null; billingCnpj: string | null; contactName: string | null; phone: string | null; email: string | null; address: string | null };

async function imageAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o logotipo selecionado."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const [, dataBase64] = result.split(",", 2);
      dataBase64 ? resolve(dataBase64) : reject(new Error("Arquivo de imagem inválido."));
    };
    reader.readAsDataURL(file);
  });
}

export default function CompaniesWorkspace() {
  const utils = trpc.useUtils();
  const { can } = useEffectivePermissions();
  const overview = trpc.settings.overview.useQuery();
  const [uploadingProviderId, setUploadingProviderId] = useState<number | null>(null);
  const [editingProvider, setEditingProvider] = useState<EditableProvider | null>(null);
  const uploadLogo = trpc.settings.uploadProviderLogo.useMutation({
    onSuccess: async () => {
      await utils.settings.overview.invalidate();
      toast.success("Logotipo atualizado.");
      setUploadingProviderId(null);
    },
    onError: error => { toast.error(error.message); setUploadingProviderId(null); },
  });
  const canWrite = can("settings.write");
  const updateProvider = trpc.settings.updateProvider.useMutation({
    onSuccess: async () => {
      await utils.settings.overview.invalidate();
      setEditingProvider(null);
      toast.success("Dados da empresa atualizados.");
    },
    onError: error => toast.error(error.message),
  });

  if (overview.isLoading) return <div className="grid min-h-[320px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const data = overview.data;
  if (!data) return <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">Não foi possível carregar as empresas.</div>;

  return <div className="mx-auto max-w-7xl space-y-5">
    <header className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"><div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><Building2 className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Cadastros operacionais</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Empresas</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Visualize os dados de faturamento, cobertura territorial e relações operacionais de cada empresa em cartões de leitura rápida.</p></div></div></header>
    {data.providers.length ? <section className="grid gap-4 xl:grid-cols-2">{data.providers.map(provider => {
      const providerRegionals = data.regionals.filter(regional => regional.providerId === provider.id);
      const regionalIds = new Set(providerRegionals.map(regional => regional.id));
      const providerCities = data.cities.filter(city => regionalIds.has(city.regionalId));
      const cityIds = new Set(providerCities.map(city => city.id));
      const providerStores = data.stores.filter(store => cityIds.has(store.cityId));
      const providerSuppliers = data.suppliers.filter(supplier => supplier.providerId === provider.id);
      return <article key={provider.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"><div className="flex gap-4 p-5"><div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-secondary"><>{provider.logoUrl ? <img src={provider.logoUrl} alt={`Logotipo de ${provider.name}`} className="h-full w-full object-cover" /> : <Building2 className="h-8 w-8 text-primary" />}</></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="truncate font-display text-xl font-semibold text-foreground">{provider.name}</h2><p className="mt-1 text-sm text-muted-foreground">{provider.legalName ?? "Razão social não informada"}</p></div><span className={provider.active ? "rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary" : "rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground"}>{provider.active ? "Ativa" : "Inativa"}</span></div><p className="mt-3 text-sm text-muted-foreground">CNPJ de faturamento: <span className="font-medium text-foreground">{provider.billingCnpj ?? "Não informado"}</span></p></div></div><div className="grid grid-cols-2 border-y border-border bg-secondary/25 sm:grid-cols-4"><Metric icon={MapPinned} label="Regionais" value={providerRegionals.length} /><Metric icon={Store} label="Cidades" value={providerCities.length} /><Metric icon={PackageCheck} label="Lojas" value={providerStores.length} /><Metric icon={UsersRound} label="Fornecedores" value={providerSuppliers.length} /></div><div className="space-y-3 p-5"><div className="grid gap-3 text-sm sm:grid-cols-2"><Detail label="Contato" value={provider.contactName ?? "Não informado"} /><Detail label="E-mail" value={provider.email ?? "Não informado"} /><Detail label="Telefone" value={provider.phone ?? "Não informado"} /><Detail label="Endereço" value={provider.address ?? "Não informado"} /></div><div className="flex flex-wrap gap-2">{canWrite ? <Button type="button" variant="outline" size="sm" onClick={() => setEditingProvider({ id: provider.id, name: provider.name, legalName: provider.legalName, billingCnpj: provider.billingCnpj, contactName: provider.contactName, phone: provider.phone, email: provider.email, address: provider.address })}><Pencil className="mr-2 h-4 w-4" />Editar dados</Button> : <Link href="/cadastros" className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent">Consultar cadastros</Link>}{canWrite ? <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent"><Upload className="mr-2 h-4 w-4" />{uploadingProviderId === provider.id ? "Enviando..." : provider.logoUrl ? "Trocar logotipo" : "Adicionar logotipo"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploadingProviderId !== null} onChange={async event => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (!file) return; if (!acceptedImageTypes.includes(file.type as (typeof acceptedImageTypes)[number])) return toast.error("Escolha uma imagem JPG, PNG ou WEBP."); if (file.size > 3 * 1024 * 1024) return toast.error("O logotipo deve ter até 3 MB."); try { setUploadingProviderId(provider.id); const dataBase64 = await imageAsBase64(file); uploadLogo.mutate({ providerId: provider.id, originalName: file.name, mimeType: file.type as (typeof acceptedImageTypes)[number], dataBase64 }); } catch (error) { setUploadingProviderId(null); toast.error(error instanceof Error ? error.message : "Não foi possível preparar o logotipo."); } }} /></label> : null}</div>{providerRegionals.length ? <div className="pt-1"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Regionais vinculadas</p><div className="mt-2 flex flex-wrap gap-2">{providerRegionals.map(regional => <span key={regional.id} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground">{regional.name} · {regional.code}</span>)}</div></div> : null}</div></article>;
    })}</section> : <section className="grid min-h-[320px] place-items-center rounded-2xl border border-dashed border-border bg-card p-8 text-center"><div><ImagePlus className="mx-auto h-8 w-8 text-primary" /><h2 className="mt-4 font-display text-xl font-semibold text-foreground">Nenhuma empresa cadastrada</h2><p className="mt-2 text-sm text-muted-foreground">Cadastre a primeira empresa no centro de cadastros operacionais.</p><Button asChild className="mt-5"><Link href="/cadastros">Abrir cadastros</Link></Button></div></section>}
    <Dialog open={editingProvider !== null} onOpenChange={open => { if (!open) setEditingProvider(null); }}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Editar empresa</DialogTitle><DialogDescription>Atualize as informações cadastrais da empresa sem alterar suas relações territoriais ou histórico operacional.</DialogDescription></DialogHeader>{editingProvider ? <form className="grid gap-4" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const optional = (key: string) => String(form.get(key) ?? "").trim() || undefined; updateProvider.mutate({ id: editingProvider.id, name: String(form.get("name") ?? "").trim(), legalName: optional("legalName"), billingCnpj: optional("billingCnpj"), contactName: optional("contactName"), email: optional("email"), phone: optional("phone"), address: optional("address") }); }}><div className="grid gap-4 sm:grid-cols-2"><Field name="name" label="Nome da empresa" defaultValue={editingProvider.name} required /><Field name="legalName" label="Razão social" defaultValue={editingProvider.legalName ?? ""} /><Field name="billingCnpj" label="CNPJ de faturamento" defaultValue={editingProvider.billingCnpj ?? ""} /><Field name="contactName" label="Pessoa de contato" defaultValue={editingProvider.contactName ?? ""} /><Field name="email" label="E-mail" type="email" defaultValue={editingProvider.email ?? ""} /><Field name="phone" label="Telefone" defaultValue={editingProvider.phone ?? ""} /></div><Field name="address" label="Endereço" defaultValue={editingProvider.address ?? ""} /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditingProvider(null)}>Cancelar</Button><Button type="submit" disabled={updateProvider.isPending}>{updateProvider.isPending ? "Salvando..." : "Salvar alterações"}</Button></div></form> : null}</DialogContent></Dialog>
  </div>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof MapPinned; label: string; value: number }) { return <div className="border-r border-border p-3 last:border-r-0"><Icon className="h-4 w-4 text-primary" /><p className="mt-2 text-xl font-semibold text-foreground">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm text-foreground">{value}</p></div>; }
function Field({ name, label, defaultValue, type = "text", required = false }: { name: string; label: string; defaultValue: string; type?: string; required?: boolean }) { return <div><Label htmlFor={`provider-${name}`}>{label}</Label><Input id={`provider-${name}`} name={name} type={type} required={required} className="mt-1.5" defaultValue={defaultValue} /></div>; }
