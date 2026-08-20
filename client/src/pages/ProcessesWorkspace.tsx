import EvidenceUpload from "@/components/EvidenceUpload";
import SearchableSelect from "@/components/SearchableSelect";
import { WorkspaceActions, WorkspaceCard, WorkspaceHeader, WorkspaceSection, WorkspaceShell } from "@/components/WorkspaceChrome";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import { BookOpenText, CalendarClock, CheckCircle2, ClipboardList, FileImage, FilePlus2, Layers3, Loader2, Pencil, Search, ShieldCheck, UserRound, X } from "lucide-react";
import { FormEvent, ReactNode, useMemo, useState } from "react";
import { toast } from "sonner";

type ProcessStatus = "draft" | "active" | "under_review" | "archived";

type ProcessForm = {
  code: string;
  name: string;
  category: string;
  version: string;
  status: ProcessStatus;
  ownerUserId: string;
  regionalId: string;
  objective: string;
  scope: string;
  description: string;
  inputs: string;
  outputs: string;
  controls: string;
  exceptions: string;
  sla: string;
  relatedModules: string;
  kpis: string;
  effectiveFrom: string;
  reviewDate: string;
};

const emptyForm: ProcessForm = {
  code: "",
  name: "",
  category: "",
  version: "1.0",
  status: "draft",
  ownerUserId: "",
  regionalId: "",
  objective: "",
  scope: "",
  description: "",
  inputs: "",
  outputs: "",
  controls: "",
  exceptions: "",
  sla: "",
  relatedModules: "",
  kpis: "",
  effectiveFrom: "",
  reviewDate: "",
};

const statusLabels: Record<ProcessStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  under_review: "Em revisão",
  archived: "Arquivado",
};

const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label, description: value === "active" ? "Processo vigente para a operação." : undefined }));

function toForm(process: Record<string, unknown>): ProcessForm {
  return {
    code: String(process.code ?? ""),
    name: String(process.name ?? ""),
    category: String(process.category ?? ""),
    version: String(process.version ?? "1.0"),
    status: (process.status as ProcessStatus) ?? "draft",
    ownerUserId: process.ownerUserId ? String(process.ownerUserId) : "",
    regionalId: process.regionalId ? String(process.regionalId) : "",
    objective: String(process.objective ?? ""),
    scope: String(process.scope ?? ""),
    description: String(process.description ?? ""),
    inputs: String(process.inputs ?? ""),
    outputs: String(process.outputs ?? ""),
    controls: String(process.controls ?? ""),
    exceptions: String(process.exceptions ?? ""),
    sla: String(process.sla ?? ""),
    relatedModules: String(process.relatedModules ?? ""),
    kpis: String(process.kpis ?? ""),
    effectiveFrom: String(process.effectiveFrom ?? ""),
    reviewDate: String(process.reviewDate ?? ""),
  };
}

function asNullable(value: string) {
  return value.trim() || null;
}

export default function ProcessesWorkspace() {
  const permissions = useEffectivePermissions();
  const canCreate = permissions.can("operations.create");
  const canUpdate = permissions.can("operations.update");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProcessForm>(emptyForm);
  const utils = trpc.useUtils();
  const processesQuery = trpc.processes.list.useQuery({ search: search.trim() || undefined, status: (statusFilter || undefined) as ProcessStatus | undefined });
  const referencesQuery = trpc.processes.referenceData.useQuery();
  const selected = processesQuery.data?.find(process => process.id === selectedId) ?? processesQuery.data?.[0] ?? null;

  const createProcess = trpc.processes.create.useMutation({
    onSuccess: created => {
      toast.success("Processo criado.");
      setSelectedId(created.id);
      setFormOpen(false);
      void utils.processes.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const updateProcess = trpc.processes.update.useMutation({
    onSuccess: updated => {
      toast.success("Processo atualizado.");
      setSelectedId(updated.id);
      setFormOpen(false);
      void utils.processes.list.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const ownerOptions = useMemo(() => (referencesQuery.data?.owners ?? []).map(owner => ({ value: owner.id, label: owner.name || owner.email || `Usuário ${owner.id}`, description: owner.email || undefined })), [referencesQuery.data?.owners]);
  const regionalOptions = useMemo(() => (referencesQuery.data?.regionals ?? []).map(regional => ({ value: regional.id, label: regional.name })), [referencesQuery.data?.regionals]);
  const isSaving = createProcess.isPending || updateProcess.isPending;

  const updateField = <K extends keyof ProcessForm>(field: K, value: ProcessForm[K]) => setForm(current => ({ ...current, [field]: value }));
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };
  const openEdit = () => {
    if (!selected) return;
    setEditingId(selected.id);
    setForm(toForm(selected as unknown as Record<string, unknown>));
    setFormOpen(true);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      ...form,
      ownerUserId: form.ownerUserId ? Number(form.ownerUserId) : null,
      regionalId: form.regionalId ? Number(form.regionalId) : null,
      objective: asNullable(form.objective),
      scope: asNullable(form.scope),
      inputs: asNullable(form.inputs),
      outputs: asNullable(form.outputs),
      controls: asNullable(form.controls),
      exceptions: asNullable(form.exceptions),
      sla: asNullable(form.sla),
      relatedModules: asNullable(form.relatedModules),
      kpis: asNullable(form.kpis),
      effectiveFrom: asNullable(form.effectiveFrom),
      reviewDate: asNullable(form.reviewDate),
    };
    if (editingId) updateProcess.mutate({ ...payload, id: editingId });
    else createProcess.mutate(payload);
  };

  return <WorkspaceShell>
    <WorkspaceHeader
      eyebrow="Gestão operacional"
      title="Processos"
      description="Documente os processos do Trade HUB, mantenha a versão vigente e deixe o procedimento completo disponível para consulta da equipe."
      icon={ClipboardList}
      actions={<WorkspaceActions>{canCreate && <Button type="button" onClick={openCreate} className="h-9 rounded-lg bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"><FilePlus2 className="mr-1.5 h-3.5 w-3.5" />Novo processo</Button>}</WorkspaceActions>}
      meta={<span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" />Governança, versão e evidências em um único lugar</span>}
    />

    <WorkspaceSection title="Catálogo de processos" description="Pesquise por código, nome ou categoria. Abra um card para consultar o descritivo, os responsáveis e os arquivos anexados.">
      <div className="hub-filter-panel mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
        <label className="grid gap-1.5"><span className="text-xs font-semibold text-foreground">Pesquisar processos</span><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Código, nome ou categoria" className="h-9 pl-9" /></div></label>
        <SearchableSelect id="process-status-filter" label="Status" value={statusFilter} options={[{ value: "", label: "Todos os status" }, ...statusOptions]} onChange={setStatusFilter} />
      </div>
      {processesQuery.isLoading ? <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-border"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : processesQuery.data?.length ? <div className="grid gap-3 xl:grid-cols-2">{processesQuery.data.map(process => <button key={process.id} type="button" onClick={() => setSelectedId(process.id)} className={`text-left ${selected?.id === process.id ? "ring-2 ring-primary/35" : ""}`}><WorkspaceCard className="h-full transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">{process.code}</span><span className="text-[11px] text-muted-foreground">v{process.version}</span></div><h2 className="mt-3 truncate font-display text-lg font-semibold text-foreground">{process.name}</h2><p className="mt-1 text-xs text-muted-foreground">{process.category}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${process.status === "active" ? "bg-emerald-100 text-emerald-700" : process.status === "archived" ? "bg-muted text-muted-foreground" : "bg-amber-100 text-amber-700"}`}>{statusLabels[process.status as ProcessStatus]}</span></div><p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">{process.description}</p><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{process.ownerName || "Responsável não definido"}</span><span className="inline-flex items-center gap-1.5"><Layers3 className="h-3.5 w-3.5" />{process.regionalName || "Todas as regionais"}</span><span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />Revisão: {process.reviewDate ? new Date(`${process.reviewDate}T00:00:00`).toLocaleDateString("pt-BR") : "não definida"}</span></div></WorkspaceCard></button>)}</div> : <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-border p-6 text-center"><BookOpenText className="h-6 w-6 text-primary" /><h2 className="mt-3 font-display text-lg font-semibold text-foreground">Nenhum processo encontrado</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Crie o primeiro processo ou ajuste os filtros para consultar outra etapa da governança.</p></div>}
    </WorkspaceSection>

    {selected ? <WorkspaceSection title="Ficha do processo" description="A ficha reúne a definição operacional, os controles e a documentação oficial do processo selecionado." actions={<WorkspaceActions>{canUpdate && <Button type="button" variant="outline" onClick={openEdit} className="h-8 rounded-lg border-border px-3 text-xs text-primary"><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar processo</Button>}</WorkspaceActions>}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <WorkspaceCard>
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">{selected.code}</span><span className="text-xs text-muted-foreground">Versão {selected.version}</span><span className="ml-auto rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-foreground">{statusLabels[selected.status as ProcessStatus]}</span></div>
          <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">{selected.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{selected.category}{selected.regionalName ? ` · ${selected.regionalName}` : " · Todas as regionais"}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2"><InfoBlock title="Objetivo" value={selected.objective} /><InfoBlock title="Escopo" value={selected.scope} /><InfoBlock title="Entradas" value={selected.inputs} /><InfoBlock title="Saídas e entregáveis" value={selected.outputs} /><InfoBlock title="Controles obrigatórios" value={selected.controls} /><InfoBlock title="Exceções e escalonamento" value={selected.exceptions} /><InfoBlock title="SLA e prazo esperado" value={selected.sla} /><InfoBlock title="Módulos relacionados" value={selected.relatedModules} /><InfoBlock title="Indicadores de acompanhamento" value={selected.kpis} /></div>
          <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-foreground"><ClipboardList className="h-4 w-4 text-primary" />Descritivo operacional</div><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{selected.description}</p></div>
        </WorkspaceCard>
        <div className="space-y-4"><WorkspaceCard><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /><h3 className="font-display text-base font-semibold text-foreground">Governança</h3></div><dl className="mt-4 space-y-3 text-xs"><KeyValue label="Responsável" value={selected.ownerName || "Não definido"} /><KeyValue label="Versão vigente" value={selected.version} /><KeyValue label="Início da vigência" value={selected.effectiveFrom ? new Date(`${selected.effectiveFrom}T00:00:00`).toLocaleDateString("pt-BR") : "Não definido"} /><KeyValue label="Próxima revisão" value={selected.reviewDate ? new Date(`${selected.reviewDate}T00:00:00`).toLocaleDateString("pt-BR") : "Não definida"} /></dl></WorkspaceCard><WorkspaceCard><div className="flex items-center gap-2"><FileImage className="h-4 w-4 text-primary" /><h3 className="font-display text-base font-semibold text-foreground">Fluxograma e documentos</h3></div><p className="mt-1 text-xs leading-5 text-muted-foreground">Anexe o fluxograma em PDF, PNG, JPEG ou WEBP. Na galeria, clique no arquivo para abrir a visualização completa.</p><EvidenceUpload entityType="process" entityId={selected.id} canWrite={canUpdate} variant="gallery" title="Arquivo oficial do processo" /></WorkspaceCard></div>
      </div>
    </WorkspaceSection> : null}

    <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto bg-card text-card-foreground"><DialogHeader><DialogTitle>{editingId ? "Editar processo" : "Novo processo"}</DialogTitle><DialogDescription>Preencha os dados mestres e o descritivo para que outra pessoa consiga executar o processo sem depender de explicações informais.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-6"><div className="grid gap-4 md:grid-cols-4"><Field label="Código" required><Input required value={form.code} onChange={event => updateField("code", event.target.value)} placeholder="PROC-TRADE-001" /></Field><Field label="Nome do processo" required className="md:col-span-2"><Input required value={form.name} onChange={event => updateField("name", event.target.value)} placeholder="Planejamento de ação de trade" /></Field><Field label="Versão" required><Input required value={form.version} onChange={event => updateField("version", event.target.value)} placeholder="1.0" /></Field><Field label="Categoria" required className="md:col-span-2"><Input required value={form.category} onChange={event => updateField("category", event.target.value)} placeholder="Ações, mídias, eventos, financeiro…" /></Field><SearchableSelect id="process-form-status" label="Status" value={form.status} options={statusOptions} onChange={value => updateField("status", value as ProcessStatus)} /><SearchableSelect id="process-form-owner" label="Responsável" value={form.ownerUserId} options={ownerOptions} onChange={value => updateField("ownerUserId", value)} placeholder="Selecionar responsável" /><SearchableSelect id="process-form-regional" label="Abrangência" value={form.regionalId} options={regionalOptions} onChange={value => updateField("regionalId", value)} placeholder="Todas as regionais" /></div><div className="grid gap-4 md:grid-cols-2"><Field label="Objetivo do processo"><Textarea value={form.objective} onChange={event => updateField("objective", event.target.value)} placeholder="Qual resultado de negócio este processo garante?" /></Field><Field label="Escopo"><Textarea value={form.scope} onChange={event => updateField("scope", event.target.value)} placeholder="Onde começa, onde termina e quais áreas participam?" /></Field><Field label="Entradas"><Textarea value={form.inputs} onChange={event => updateField("inputs", event.target.value)} placeholder="Dados, documentos, aprovações ou cadastros necessários antes de iniciar." /></Field><Field label="Saídas e entregáveis"><Textarea value={form.outputs} onChange={event => updateField("outputs", event.target.value)} placeholder="Registros, aprovações, arquivos ou resultados esperados ao finalizar." /></Field><Field label="Controles obrigatórios"><Textarea value={form.controls} onChange={event => updateField("controls", event.target.value)} placeholder="Validações, segregação de funções, evidências e pontos de aprovação." /></Field><Field label="Exceções e escalonamento"><Textarea value={form.exceptions} onChange={event => updateField("exceptions", event.target.value)} placeholder="O que fazer quando o fluxo normal não puder ser seguido?" /></Field><Field label="SLA e prazo esperado"><Textarea value={form.sla} onChange={event => updateField("sla", event.target.value)} placeholder="Prazo por etapa, janela de atendimento ou regra de prioridade." /></Field><Field label="Módulos relacionados"><Textarea value={form.relatedModules} onChange={event => updateField("relatedModules", event.target.value)} placeholder="Ex.: Cadastros → Ações → Financeiro → Estoque." /></Field><Field label="Indicadores de acompanhamento"><Textarea value={form.kpis} onChange={event => updateField("kpis", event.target.value)} placeholder="Ex.: prazo médio, taxa de aprovação, custo realizado, retrabalho." /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Início da vigência"><Input type="date" value={form.effectiveFrom} onChange={event => updateField("effectiveFrom", event.target.value)} /></Field><Field label="Próxima revisão"><Input type="date" value={form.reviewDate} onChange={event => updateField("reviewDate", event.target.value)} /></Field></div></div><Field label="Descritivo do processo" required hint="Escreva como um manual ERP: contexto, sequência de execução, responsáveis por etapa, decisões, documentos gerados, regras de negócio e critério de conclusão."><Textarea required minLength={20} value={form.description} onChange={event => updateField("description", event.target.value)} placeholder="1. Finalidade: explique o resultado esperado.\n2. Gatilho: informe quando o processo começa.\n3. Execução: descreva as etapas na ordem correta.\n4. Regras: registre validações, aprovações e exceções.\n5. Encerramento: indique o que deve estar concluído e quais evidências ficam registradas." className="min-h-48 leading-6" /></Field><DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="border-border"><X className="mr-1.5 h-4 w-4" />Cancelar</Button><Button type="submit" disabled={isSaving} className="bg-primary text-primary-foreground hover:bg-primary/90">{isSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{editingId ? "Salvar alterações" : "Criar processo"}</Button></DialogFooter></form></DialogContent></Dialog>
  </WorkspaceShell>;
}

function Field({ label, required, hint, className = "", children }: { label: string; required?: boolean; hint?: string; className?: string; children: ReactNode }) {
  return <div className={`grid gap-1.5 ${className}`}><Label>{label}{required ? <span className="ml-1 text-primary">*</span> : null}</Label>{children}{hint ? <p className="text-[11px] leading-5 text-muted-foreground">{hint}</p> : null}</div>;
}

function InfoBlock({ title, value }: { title: string; value: string | null | undefined }) {
  return <div className="rounded-xl border border-border bg-secondary/30 p-3"><h3 className="text-xs font-semibold text-foreground">{title}</h3><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{value || "Não informado."}</p></div>;
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-2 last:border-0 last:pb-0"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium text-foreground">{value}</dd></div>;
}
