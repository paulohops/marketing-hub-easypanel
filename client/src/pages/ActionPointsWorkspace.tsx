import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, MapPin, Pencil, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type PointForm = { id: number | null; cityId: string; name: string; address: string; latitude: string; longitude: string; notes: string };
const emptyForm: PointForm = { id: null, cityId: "", name: "", address: "", latitude: "", longitude: "", notes: "" };

export default function ActionPointsWorkspace() {
  const [, setLocation] = useLocation();
  const { can } = useEffectivePermissions();
  const canWrite = can("settings.write");
  const utils = trpc.useUtils();
  const overview = trpc.settings.overview.useQuery();
  const [form, setForm] = useState<PointForm>(emptyForm);
  const [open, setOpen] = useState(false);
  const citiesById = useMemo(() => new Map((overview.data?.cities ?? []).map(city => [city.id, city])), [overview.data?.cities]);
  const complete = (message: string) => ({ onSuccess: () => { toast.success(message); utils.settings.overview.invalidate(); setOpen(false); setForm(emptyForm); }, onError: (error: { message: string }) => toast.error(error.message) });
  const create = trpc.settings.createActionPoint.useMutation(complete("Ponto de ação cadastrado."));
  const update = trpc.settings.updateActionPoint.useMutation(complete("Ponto de ação atualizado."));
  const pending = create.isPending || update.isPending;
  const save = () => {
    const payload = { cityId: Number(form.cityId), name: form.name, address: form.address || undefined, latitude: form.latitude ? Number(form.latitude.replace(",", ".")) : null, longitude: form.longitude ? Number(form.longitude.replace(",", ".")) : null, notes: form.notes || undefined };
    if (!payload.cityId || !payload.name.trim()) { toast.error("Informe a cidade e o nome do ponto de ação."); return; }
    form.id ? update.mutate({ id: form.id, ...payload }) : create.mutate(payload);
  };
  const beginEdit = (point: NonNullable<typeof overview.data>["actionPoints"][number]) => {
    setForm({ id: point.id, cityId: String(point.cityId), name: point.name, address: point.address ?? "", latitude: point.latitude ? String(point.latitude) : "", longitude: point.longitude ? String(point.longitude) : "", notes: point.notes ?? "" });
    setOpen(true);
  };

  if (overview.isLoading) return <div className="grid min-h-64 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  const points = overview.data?.actionPoints ?? [];
  return <div className="mx-auto max-w-[1480px]">
    <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><MapPin className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cadastros operacionais</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Pontos de ação</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Organize locais recorrentes para que o planejamento de ações mantenha endereço, cidade e referências consistentes.</p></div></div>
      <div className="flex gap-2"><Button variant="outline" className="border-border" onClick={() => setLocation("/cadastros/operacionais")}><ArrowLeft className="mr-1.5 h-4 w-4" />Cadastros</Button>{canWrite && <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => { setForm(emptyForm); setOpen(true); }}><Plus className="mr-1.5 h-4 w-4" />Novo ponto</Button>}</div>
    </div>
    <section className="mt-6 rounded-2xl border border-border bg-card shadow-sm"><div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="font-display text-lg font-semibold text-foreground">Locais cadastrados</p><p className="mt-0.5 text-xs text-muted-foreground">Cada ponto deve pertencer a uma cidade para proteger a consistência territorial.</p></div><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">{points.length} {points.length === 1 ? "ponto" : "pontos"}</span></div>
      {points.length ? <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{points.map(point => { const city = citiesById.get(point.cityId); return <article key={point.id} className="rounded-xl border border-border bg-background p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-foreground">{point.name}</p><p className="mt-1 text-xs text-muted-foreground">{city ? `${city.name}/${city.state}` : "Cidade não identificada"}</p></div>{canWrite && <Button size="icon" variant="outline" className="h-8 w-8 shrink-0 border-border" aria-label={`Editar ${point.name}`} onClick={() => beginEdit(point)}><Pencil className="h-3.5 w-3.5" /></Button>}</div>{point.address && <p className="mt-3 text-xs leading-5 text-foreground">{point.address}</p>}{point.notes && <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{point.notes}</p>}{(point.latitude || point.longitude) && <p className="mt-3 text-[11px] text-muted-foreground">{point.latitude}, {point.longitude}</p>}</article>; })}</div> : <div className="p-10 text-center"><MapPin className="mx-auto h-8 w-8 text-primary" /><p className="mt-3 font-medium text-foreground">Nenhum ponto de ação cadastrado</p><p className="mt-1 text-sm text-muted-foreground">Cadastre locais frequentes para reutilizá-los com segurança no planejamento.</p></div>}</section>
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) setForm(emptyForm); }}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{form.id ? "Editar ponto de ação" : "Novo ponto de ação"}</DialogTitle><DialogDescription>O endereço livre pode complementar a cidade e será reutilizado nas próximas ações.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Label htmlFor="point-name">Nome do ponto</Label><Input id="point-name" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} className="mt-1.5" placeholder="Ex.: Praça Sete — esquina principal" /></div><div><Label htmlFor="point-city">Cidade</Label><select id="point-city" value={form.cityId} onChange={event => setForm(current => ({ ...current, cityId: event.target.value }))} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="">Selecionar cidade</option>{(overview.data?.cities ?? []).filter(city => city.active).map(city => <option key={city.id} value={city.id}>{city.name}/{city.state}</option>)}</select></div><div><Label htmlFor="point-address">Endereço</Label><Input id="point-address" value={form.address} onChange={event => setForm(current => ({ ...current, address: event.target.value }))} className="mt-1.5" placeholder="Rua, número ou referência" /></div><div><Label htmlFor="point-lat">Latitude</Label><Input id="point-lat" inputMode="decimal" value={form.latitude} onChange={event => setForm(current => ({ ...current, latitude: event.target.value }))} className="mt-1.5" /></div><div><Label htmlFor="point-lng">Longitude</Label><Input id="point-lng" inputMode="decimal" value={form.longitude} onChange={event => setForm(current => ({ ...current, longitude: event.target.value }))} className="mt-1.5" /></div><div className="sm:col-span-2"><Label htmlFor="point-notes">Observações</Label><Textarea id="point-notes" value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} className="mt-1.5" placeholder="Acesso, horário recomendado, referência ou outra orientação operacional." /></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button disabled={pending} className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={save}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{form.id ? "Salvar edição" : "Cadastrar ponto"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
