import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CalendarDays, CheckCircle2, Clock3, History, MapPin, Music2, Plus, Radio, Route, Truck, Upload, UsersRound } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

type Category = "audio_video" | "sound_car" | "influencers";

function PanelHeader({ icon: Icon, title, description }: { icon: typeof Radio; title: string; description: string }) {
  return (
    <div className="flex gap-3 border-b border-border px-5 py-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function MediaSpecializedOperationsPanel({ category, canWrite }: { category: Category; canWrite: boolean }) {
  const utils = trpc.useUtils();
  const data = trpc.media.listSpecializedData.useQuery();
  const soundPoints = trpc.media.list.useQuery({ operationCategory: "sound_car" }, { enabled: category === "sound_car" });
  const [spot, setSpot] = useState({ name: "", notes: "", active: true });
  const [run, setRun] = useState({ campaignId: "", drivenOn: "", startsAt: "", endsAt: "", route: "", notes: "", evidenceUrls: [] as string[] });
  const [person, setPerson] = useState({ name: "", handle: "", phone: "", email: "", paymentMethod: "", paymentFrequency: "", paymentDay: "", notes: "" });
  const [group, setGroup] = useState({ name: "", influencerIds: [] as number[], weekday: "", notes: "" });
  const [post, setPost] = useState({ influencerId: "", influencerGroupId: "", tradeCampaignId: "", scheduledFor: "", platform: "", deliverable: "", notes: "" });
  const [confirmingPostId, setConfirmingPostId] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState({ evidenceUrls: [] as string[], notes: "" });

  const refresh = () => {
    utils.media.listSpecializedData.invalidate();
    utils.media.list.invalidate();
  };

  const createSpot = trpc.media.createSpot.useMutation({
    onSuccess: () => { toast.success("Spot cadastrado."); setSpot({ name: "", notes: "", active: true }); refresh(); },
    onError: error => toast.error(error.message),
  });
  const uploadSpot = trpc.media.uploadSpot.useMutation({
    onSuccess: () => { toast.success("Arquivo do spot anexado."); refresh(); },
    onError: error => toast.error(error.message),
  });
  const uploadEvidence = trpc.media.uploadEvidenceFile.useMutation({
    onError: error => toast.error(error.message),
  });
  const createRun = trpc.media.createSoundCarRun.useMutation({
    onSuccess: () => { toast.success("Rodagem registrada."); setRun({ campaignId: "", drivenOn: "", startsAt: "", endsAt: "", route: "", notes: "", evidenceUrls: [] }); refresh(); },
    onError: error => toast.error(error.message),
  });
  const createInfluencer = trpc.media.createInfluencer.useMutation({
    onSuccess: () => { toast.success("Influencer cadastrado."); setPerson({ name: "", handle: "", phone: "", email: "", paymentMethod: "", paymentFrequency: "", paymentDay: "", notes: "" }); refresh(); },
    onError: error => toast.error(error.message),
  });
  const createGroup = trpc.media.createInfluencerGroup.useMutation({
    onSuccess: () => { toast.success("Grupo criado."); setGroup({ name: "", influencerIds: [], weekday: "", notes: "" }); refresh(); },
    onError: error => toast.error(error.message),
  });
  const createPost = trpc.media.createInfluencerPost.useMutation({
    onSuccess: () => { toast.success("Postagem programada."); setPost({ influencerId: "", influencerGroupId: "", tradeCampaignId: "", scheduledFor: "", platform: "", deliverable: "", notes: "" }); refresh(); },
    onError: error => toast.error(error.message),
  });
  const confirmPost = trpc.media.confirmInfluencerPost.useMutation({
    onSuccess: () => { toast.success("Publicação comprovada."); setConfirmingPostId(null); setConfirmation({ evidenceUrls: [], notes: "" }); refresh(); },
    onError: error => toast.error(error.message),
  });
  const updateSpot = trpc.media.updateSpot.useMutation({
    onSuccess: () => { toast.success("Status do spot atualizado."); refresh(); },
    onError: error => toast.error(error.message),
  });

  const soundCampaigns = useMemo(() => {
    const campaigns: { id: number; label: string }[] = [];
    for (const point of soundPoints.data ?? []) {
      if (point.activeCampaign) campaigns.push({ id: point.activeCampaign.id, label: `${point.name} · ${point.activeCampaign.name}` });
      if (point.nextCampaign) campaigns.push({ id: point.nextCampaign.id, label: `${point.name} · ${point.nextCampaign.name}` });
    }
    return campaigns;
  }, [soundPoints.data]);

  const fileToBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
  const attachSpotFile = async (spotId: number, file?: File) => {
    if (!file) return;
    const supported = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4", "video/mp4", "video/webm"];
    if (!supported.includes(file.type) || file.size > 50 * 1024 * 1024) { toast.error("Envie um áudio ou vídeo de até 50 MB."); return; }
    uploadSpot.mutate({ spotId, originalName: file.name, mimeType: file.type as "audio/mpeg" | "audio/wav" | "audio/ogg" | "audio/mp4" | "video/mp4" | "video/webm", dataBase64: await fileToBase64(file) });
  };
  const attachEvidenceFile = async (file: File | undefined, target: "run" | "post") => {
    if (!file) return;
    const supported = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"];
    if (!supported.includes(file.type) || file.size > 50 * 1024 * 1024) { toast.error("Envie uma foto ou vídeo de até 50 MB."); return; }
    uploadEvidence.mutate({ originalName: file.name, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "video/mp4" | "video/webm", dataBase64: await fileToBase64(file) }, {
      onSuccess: uploaded => {
        if (target === "run") setRun(current => ({ ...current, evidenceUrls: [...current.evidenceUrls, uploaded.url] }));
        else setConfirmation(current => ({ ...current, evidenceUrls: [...current.evidenceUrls, uploaded.url] }));
        toast.success("Evidência anexada.");
      },
    });
  };

  const submitSpot = (event: FormEvent) => { event.preventDefault(); createSpot.mutate(spot); };
  const submitRun = (event: FormEvent) => {
    event.preventDefault();
    createRun.mutate({ mediaCampaignId: Number(run.campaignId), drivenOn: run.drivenOn, startsAt: run.startsAt || null, endsAt: run.endsAt || null, route: run.route || undefined, notes: run.notes || undefined, evidenceUrls: run.evidenceUrls });
  };
  const submitInfluencer = (event: FormEvent) => {
    event.preventDefault();
    createInfluencer.mutate({ name: person.name, phone: person.phone || undefined, email: person.email || undefined, socialHandle: person.handle || undefined, paymentMethod: person.paymentMethod || undefined, paymentFrequency: person.paymentFrequency || undefined, paymentDay: person.paymentDay ? Number(person.paymentDay) : undefined, notes: person.notes || undefined });
  };
  const submitGroup = (event: FormEvent) => { event.preventDefault(); createGroup.mutate({ name: group.name, influencerIds: group.influencerIds, weekday: group.weekday ? Number(group.weekday) : undefined, notes: group.notes || undefined }); };
  const submitPost = (event: FormEvent) => {
    event.preventDefault();
    createPost.mutate({ influencerId: Number(post.influencerId), influencerGroupId: post.influencerGroupId ? Number(post.influencerGroupId) : undefined, tradeCampaignId: post.tradeCampaignId ? Number(post.tradeCampaignId) : undefined, scheduledFor: new Date(post.scheduledFor), platform: post.platform || undefined, deliverable: post.deliverable || undefined, notes: post.notes || undefined });
  };
  const submitConfirmation = (event: FormEvent) => {
    event.preventDefault();
    if (!confirmingPostId) return;
    confirmPost.mutate({ postId: confirmingPostId, publicationConfirmed: true, evidenceUrls: confirmation.evidenceUrls, notes: confirmation.notes || undefined });
  };

  if (category === "audio_video") {
    return (
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <PanelHeader icon={Music2} title="Spots ativos" description="Organize os spots destinados a rádios, TVs e demais veículos, indicando qual está em uso." />
        <div className="grid gap-5 p-5 lg:grid-cols-[.9fr_1.1fr]">
          {canWrite && <form onSubmit={submitSpot} className="space-y-3 rounded-xl bg-secondary p-4">
            <Label htmlFor="spot-name">Novo spot</Label>
            <Input id="spot-name" required value={spot.name} onChange={event => setSpot({ ...spot, name: event.target.value })} placeholder="Ex.: Spot plano 600 Mega" />
            <Textarea value={spot.notes} onChange={event => setSpot({ ...spot, notes: event.target.value })} placeholder="Veículo, período e orientações de uso" />
            <label className="flex items-center gap-2 text-xs font-medium text-foreground"><input type="checkbox" checked={spot.active} onChange={event => setSpot({ ...spot, active: event.target.checked })} className="h-4 w-4 accent-primary" />Disponibilizar como spot ativo</label>
            <Button className="w-full bg-primary hover:bg-primary/90"><Plus className="mr-1.5 h-4 w-4" />Adicionar spot</Button>
          </form>}
          <div className="space-y-2">
            {data.data?.spots.length ? data.data.spots.map(item => <article key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p className="text-sm font-semibold text-foreground">{item.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.notes || "Sem observações"}</p></div><div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => updateSpot.mutate({ spotId: item.id, active: !item.active })} disabled={!canWrite || updateSpot.isPending} className={`rounded-full px-2 py-1 text-[10px] font-semibold transition hover:opacity-80 disabled:cursor-not-allowed ${item.active ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>{item.active ? "Ativo" : "Inativo"}</button>{canWrite && <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border px-2 text-[11px] font-semibold text-primary hover:bg-secondary"><Upload className="h-3 w-3" />Arquivo<input className="sr-only" type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,video/mp4,video/webm" onChange={event => void attachSpotFile(item.id, event.target.files?.[0])} /></label>}</div></article>) : <p className="text-sm text-muted-foreground">Nenhum spot cadastrado.</p>}
          </div>
        </div>
      </section>
    );
  }

  if (category === "sound_car") {
    const focusPoint = soundPoints.data?.[0];
    const recentRuns = (data.data?.runs ?? []).slice(0, 5);
    const activeSpots = (data.data?.spots ?? []).filter(item => item.active);
    return (
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <PanelHeader icon={Truck} title="Carro de som" description="Acompanhe spots, dados do veículo, rotas, programação, rodagem e evidências da ativação." />
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(230px,.8fr)_minmax(0,1.2fr)]">
          <aside className="space-y-4">
            <article className="rounded-xl border border-border bg-secondary/45 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Truck className="h-4 w-4 text-primary" />Dados do carro de som</div>
              <dl className="mt-4 space-y-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Ponto ou veículo</dt><dd className="font-medium text-foreground">{focusPoint?.name ?? "Nenhum carro de som cadastrado"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Fornecedor</dt><dd className="font-medium text-foreground">{focusPoint?.supplierName ?? "Não informado"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Cidade de operação</dt><dd className="font-medium text-foreground">{focusPoint?.cityName ?? "Não informada"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Tipo de mídia</dt><dd className="font-medium text-foreground">{focusPoint?.mediaTypeName ?? "Carro de som"}</dd></div>
              </dl>
            </article>

            <article className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Music2 className="h-4 w-4 text-primary" />Spot da ativação</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Cadastre o áudio que será utilizado nas rodadas e mantenha o arquivo disponível para a operação.</p>
              {canWrite && <form onSubmit={submitSpot} className="mt-3 space-y-3 rounded-xl bg-secondary p-3">
                <Input required value={spot.name} onChange={event => setSpot({ ...spot, name: event.target.value })} placeholder="Nome do spot" />
                <Textarea value={spot.notes} onChange={event => setSpot({ ...spot, notes: event.target.value })} placeholder="Orientações de uso" />
                <label className="flex items-center gap-2 text-xs font-medium text-foreground"><input type="checkbox" checked={spot.active} onChange={event => setSpot({ ...spot, active: event.target.checked })} className="h-4 w-4 accent-primary" />Disponibilizar como spot ativo</label>
                <Button className="w-full bg-primary hover:bg-primary/90"><Plus className="mr-1.5 h-4 w-4" />Adicionar spot</Button>
              </form>}
              <div className="mt-3 space-y-2">
                {data.data?.spots.length ? data.data.spots.slice(0, 2).map(item => <article key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{item.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{item.notes || "Sem observações"}</p></div><div className="flex shrink-0 items-center gap-1.5"><button type="button" onClick={() => updateSpot.mutate({ spotId: item.id, active: !item.active })} disabled={!canWrite || updateSpot.isPending} className={`rounded-full px-2 py-1 text-[10px] font-semibold transition hover:opacity-80 disabled:cursor-not-allowed ${item.active ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>{item.active ? "Ativo" : "Inativo"}</button>{canWrite && <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-border px-2 text-[11px] font-semibold text-primary hover:bg-secondary"><Upload className="h-3 w-3" />Arquivo<input className="sr-only" type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,video/mp4,video/webm" onChange={event => void attachSpotFile(item.id, event.target.files?.[0])} /></label>}</div></article>) : <p className="text-xs text-muted-foreground">Nenhum spot cadastrado.</p>}
                {data.data?.spots.length && data.data.spots.length > 2 ? <p className="text-[11px] text-muted-foreground">Exibindo os 2 primeiros spots. Os demais ficam disponíveis no acompanhamento da operação.</p> : null}
              </div>
            </article>

            <article className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><History className="h-4 w-4 text-primary" />Histórico do carro de som</div>
              <div className="mt-3 space-y-3">{recentRuns.length ? recentRuns.map(run => <div key={run.id} className="border-l-2 border-primary/30 pl-3"><p className="text-xs font-medium text-foreground">Rodagem registrada</p><p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(`${run.drivenOn}T12:00:00`).toLocaleDateString("pt-BR")}{run.route ? ` · ${run.route}` : ""}</p></div>) : <p className="text-xs text-muted-foreground">Ainda não há rodadas registradas.</p>}</div>
            </article>
          </aside>

          <section className="space-y-4">
            <article className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Radio className="h-4 w-4 text-primary" />Resumo operacional</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-secondary p-3"><p className="text-xs text-muted-foreground">Spots ativos</p><p className="mt-1 text-2xl font-semibold text-foreground">{activeSpots.length}</p></div><div className="rounded-xl bg-secondary p-3"><p className="text-xs text-muted-foreground">Rodadas registradas</p><p className="mt-1 text-2xl font-semibold text-foreground">{data.data?.runs.length ?? 0}</p></div><div className="rounded-xl bg-secondary p-3"><p className="text-xs text-muted-foreground">Última operação</p><p className="mt-1 text-sm font-semibold text-foreground">{recentRuns[0] ? new Date(`${recentRuns[0].drivenOn}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</p></div></div>
            </article>

            <article className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground"><Route className="h-4 w-4 text-primary" />Rotas e programação</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Registre o dia, horário, rota e comprovações de cada saída do carro de som.</p>
              {canWrite && <form onSubmit={submitRun} className="mt-4 grid gap-3 rounded-xl bg-secondary p-4 sm:grid-cols-2">
                <SearchableMultiSelect id="sound-car-campaign" label="Campanha de carro de som" options={soundCampaigns} values={run.campaignId ? [Number(run.campaignId)] : []} onChange={values => setRun({ ...run, campaignId: values[0] ? String(values[0]) : "" })} maxSelections={1} placeholder="Selecionar campanha" />
                <label className="space-y-1"><span className="text-xs font-medium text-foreground">Data da rodagem</span><Input required type="date" value={run.drivenOn} onChange={event => setRun({ ...run, drivenOn: event.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs font-medium text-foreground">Início</span><Input type="time" value={run.startsAt} onChange={event => setRun({ ...run, startsAt: event.target.value })} /></label>
                <label className="space-y-1"><span className="text-xs font-medium text-foreground">Término</span><Input type="time" value={run.endsAt} onChange={event => setRun({ ...run, endsAt: event.target.value })} /></label>
                <label className="space-y-1 sm:col-span-2"><span className="text-xs font-medium text-foreground">Rota e cidades atendidas</span><Textarea value={run.route} onChange={event => setRun({ ...run, route: event.target.value })} placeholder="Descreva o percurso previsto" /></label>
                <label className="space-y-1 sm:col-span-2"><span className="text-xs font-medium text-foreground">Observações operacionais</span><Textarea value={run.notes} onChange={event => setRun({ ...run, notes: event.target.value })} placeholder="Orientações e informações da saída" /></label>
                <label className="sm:col-span-2 flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-primary/40 bg-background px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5"><span className="inline-flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" />Adicionar fotos ou vídeos da rodagem</span><span className="text-muted-foreground">{run.evidenceUrls.length} anexo(s)</span><input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={event => Array.from(event.target.files ?? []).forEach(file => void attachEvidenceFile(file, "run"))} /></label>
                <Button className="sm:col-span-2 bg-primary hover:bg-primary/90"><CalendarDays className="mr-1.5 h-4 w-4" />Registrar rodagem</Button>
              </form>}
              <div className="mt-4 space-y-2">{recentRuns.length ? recentRuns.map(run => <article key={run.id} className="grid gap-3 rounded-xl border border-border p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center"><span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Clock3 className="h-4 w-4" /></span><div className="min-w-0"><p className="text-sm font-semibold text-foreground">{new Date(`${run.drivenOn}T12:00:00`).toLocaleDateString("pt-BR")}{run.route ? ` · ${run.route}` : ""}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{run.notes || "Sem observações"}</p></div><span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary"><MapPin className="h-3.5 w-3.5" />Rodagem</span></article>) : <p className="text-sm text-muted-foreground">Nenhuma rodagem registrada para esta operação.</p>}</div>
            </article>
          </section>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <PanelHeader icon={UsersRound} title="Influencers, grupos e calendário" description="Cadastre parceiros, programe postagens e mantenha a comprovação de publicação." />
      <div className="grid gap-5 p-5 xl:grid-cols-3">
        {canWrite && <form onSubmit={submitInfluencer} className="space-y-3 rounded-xl bg-secondary p-4"><p className="text-sm font-semibold text-foreground">Novo influencer</p><Input required value={person.name} onChange={event => setPerson({ ...person, name: event.target.value })} placeholder="Nome" /><Input value={person.handle} onChange={event => setPerson({ ...person, handle: event.target.value })} placeholder="@perfil" /><Input value={person.phone} onChange={event => setPerson({ ...person, phone: event.target.value })} placeholder="Telefone" /><Input type="email" value={person.email} onChange={event => setPerson({ ...person, email: event.target.value })} placeholder="E-mail" /><Input value={person.paymentMethod} onChange={event => setPerson({ ...person, paymentMethod: event.target.value })} placeholder="Forma de pagamento" /><div className="grid grid-cols-2 gap-2"><Input value={person.paymentFrequency} onChange={event => setPerson({ ...person, paymentFrequency: event.target.value })} placeholder="Recorrência" /><Input type="number" min="1" max="31" value={person.paymentDay} onChange={event => setPerson({ ...person, paymentDay: event.target.value })} placeholder="Dia pgto." /></div><Textarea value={person.notes} onChange={event => setPerson({ ...person, notes: event.target.value })} placeholder="Observações comerciais e de contrato" /><Button className="w-full bg-primary hover:bg-primary/90">Cadastrar influencer</Button></form>}
        <div className="space-y-3">{data.data?.influencers.map(item => <article key={item.id} className="rounded-xl border border-border p-3"><p className="text-sm font-semibold text-foreground">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.socialHandle || "Sem perfil"}{item.paymentFrequency ? ` · ${item.paymentFrequency}` : ""}</p></article>)}</div>
        {canWrite && <div className="space-y-4"><form onSubmit={submitGroup} className="space-y-2 rounded-xl border border-border p-4"><p className="text-sm font-semibold text-foreground">Novo grupo</p><Input required value={group.name} onChange={event => setGroup({ ...group, name: event.target.value })} placeholder="Ex.: Grupo de segunda" /><select value={group.weekday} onChange={event => setGroup({ ...group, weekday: event.target.value })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"><option value="">Dia de postagem (opcional)</option><option value="1">Segunda-feira</option><option value="2">Terça-feira</option><option value="3">Quarta-feira</option><option value="4">Quinta-feira</option><option value="5">Sexta-feira</option><option value="6">Sábado</option><option value="0">Domingo</option></select><SearchableMultiSelect id="influencer-group-members" label="Participantes" options={(data.data?.influencers ?? []).map(item => ({ id: item.id, label: item.name }))} values={group.influencerIds} onChange={values => setGroup({ ...group, influencerIds: values })} placeholder="Selecionar influencers" /><Textarea value={group.notes} onChange={event => setGroup({ ...group, notes: event.target.value })} placeholder="Orientações do grupo" /><Button className="w-full" variant="outline">Salvar grupo</Button></form><form onSubmit={submitPost} className="space-y-2 rounded-xl bg-secondary p-4"><p className="text-sm font-semibold text-foreground">Programar postagem</p><SearchableMultiSelect id="influencer-post-owner" label="Influencer" options={(data.data?.influencers ?? []).filter(item => item.active).map(item => ({ id: item.id, label: item.name, description: item.socialHandle ?? undefined }))} values={post.influencerId ? [Number(post.influencerId)] : []} onChange={values => setPost({ ...post, influencerId: values[0] ? String(values[0]) : "" })} maxSelections={1} placeholder="Selecionar influencer" /><SearchableMultiSelect id="influencer-post-group" label="Grupo" options={(data.data?.groups ?? []).filter(item => item.active).map(item => ({ id: item.id, label: item.name }))} values={post.influencerGroupId ? [Number(post.influencerGroupId)] : []} onChange={values => setPost({ ...post, influencerGroupId: values[0] ? String(values[0]) : "" })} maxSelections={1} placeholder="Selecionar grupo (opcional)" /><SearchableMultiSelect id="influencer-post-campaign" label="Campanha comercial" options={(data.data?.campaigns ?? []).map(item => ({ id: item.id, label: item.name }))} values={post.tradeCampaignId ? [Number(post.tradeCampaignId)] : []} onChange={values => setPost({ ...post, tradeCampaignId: values[0] ? String(values[0]) : "" })} maxSelections={1} placeholder="Vincular campanha (opcional)" /><Input required type="datetime-local" value={post.scheduledFor} onChange={event => setPost({ ...post, scheduledFor: event.target.value })} /><Input value={post.platform} onChange={event => setPost({ ...post, platform: event.target.value })} placeholder="Plataforma" /><Textarea value={post.deliverable} onChange={event => setPost({ ...post, deliverable: event.target.value })} placeholder="Conteúdo combinado" /><Textarea value={post.notes} onChange={event => setPost({ ...post, notes: event.target.value })} placeholder="Orientações e observações" /><Button className="w-full bg-primary hover:bg-primary/90">Programar postagem</Button></form></div>}
      </div>
      <div className="border-t border-border p-5"><p className="text-sm font-semibold text-foreground">Calendário e comprovações</p><div className="mt-3 grid gap-2 md:grid-cols-2">{data.data?.posts.map(item => <article key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p className="text-sm font-semibold text-foreground">{item.platform || "Postagem programada"}</p><p className="mt-0.5 text-xs text-muted-foreground">{new Date(item.scheduledFor).toLocaleString("pt-BR")}</p></div>{item.publicationConfirmed ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><CheckCircle2 className="h-4 w-4" />Publicado</span> : canWrite ? <Button size="sm" variant="outline" onClick={() => setConfirmingPostId(item.id)}>Comprovar</Button> : null}</article>)}</div>{confirmingPostId && <form onSubmit={submitConfirmation} className="mt-4 grid gap-2 rounded-xl bg-secondary p-4 md:grid-cols-[minmax(0,1fr)_auto]"><div className="space-y-2"><Input value={confirmation.notes} onChange={event => setConfirmation({ ...confirmation, notes: event.target.value })} placeholder="Observação" /><label className="flex cursor-pointer items-center justify-between rounded-lg border border-dashed border-primary/40 bg-background px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/5"><span className="inline-flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" />Adicionar prova de publicação</span><span className="text-muted-foreground">{confirmation.evidenceUrls.length} anexo(s)</span><input className="sr-only" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={event => Array.from(event.target.files ?? []).forEach(file => void attachEvidenceFile(file, "post"))} /></label></div><Button className="self-start bg-primary hover:bg-primary/90">Confirmar publicação</Button></form>}</div>
    </section>
  );
}
