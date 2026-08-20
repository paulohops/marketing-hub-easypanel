import EvidenceUpload from "@/components/EvidenceUpload";
import ProcessBpmnDiagram, { type BpmnStep } from "@/components/ProcessBpmnDiagram";
import SearchableSelect from "@/components/SearchableSelect";
import { WorkspaceActions, WorkspaceCard, WorkspaceHeader, WorkspaceSection, WorkspaceShell } from "@/components/WorkspaceChrome";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BookOpenText, CheckCircle2, ClipboardList, ExternalLink, FilePlus2, GitBranch, Layers3, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type ProcessStatus = "draft" | "active" | "under_review" | "archived";
type StepType = "task" | "gateway";
type ProcessStepForm = {
  sectorId: string;
  stepType: StepType;
  stepName: string;
  description: string;
  gatewayQuestion: string;
  yesNextStepOrder: string;
  noNextStepOrder: string;
};
type ProcessForm = {
  code: string;
  name: string;
  category: string;
  status: ProcessStatus;
  steps: ProcessStepForm[];
};

const statusLabels: Record<ProcessStatus, string> = { draft: "Rascunho", active: "Ativo", under_review: "Em revisão", archived: "Arquivado" };
const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({ value, label, description: value === "active" ? "Processo vigente para a operação." : undefined }));
const stepTypeOptions = [
  { value: "task", label: "Atividade", description: "Etapa executada por um setor." },
  { value: "gateway", label: "Decisão (Sim / Não)", description: "Pergunta com dois caminhos de saída." },
];

const emptyStep = (): ProcessStepForm => ({ sectorId: "", stepType: "task", stepName: "", description: "", gatewayQuestion: "", yesNextStepOrder: "", noNextStepOrder: "" });
const emptyForm: ProcessForm = { code: "", name: "", category: "", status: "draft", steps: [emptyStep()] };

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`grid gap-1.5 ${className}`}><span className="text-xs font-semibold text-foreground">{label}</span>{children}</label>;
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-2 last:border-0 last:pb-0"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium text-foreground">{value}</dd></div>;
}

function asStepForm(step: Record<string, unknown>): ProcessStepForm {
  return {
    sectorId: step.sectorId ? String(step.sectorId) : "",
    stepType: step.stepType === "gateway" ? "gateway" : "task",
    stepName: String(step.stepName ?? ""),
    description: String(step.description ?? ""),
    gatewayQuestion: String(step.gatewayQuestion ?? ""),
    yesNextStepOrder: step.yesNextStepOrder ? String(step.yesNextStepOrder) : "",
    noNextStepOrder: step.noNextStepOrder ? String(step.noNextStepOrder) : "",
  };
}

function asForm(process: Record<string, unknown>): ProcessForm {
  const steps = Array.isArray(process.steps) && process.steps.length ? process.steps.map(step => asStepForm(step as Record<string, unknown>)) : [emptyStep()];
  return { code: String(process.code ?? ""), name: String(process.name ?? ""), category: String(process.category ?? ""), status: (process.status as ProcessStatus) ?? "draft", steps };
}

export default function ProcessesWorkspace({ processId }: { processId?: string }) {
  const permissions = useEffectivePermissions();
  const [, setLocation] = useLocation();
  const canCreate = permissions.can("operations.create");
  const canUpdate = permissions.can("operations.update");
  const canDelete = permissions.can("operations.delete");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProcessForm>(emptyForm);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const utils = trpc.useUtils();
  const processesQuery = trpc.processes.list.useQuery({ search: processId ? undefined : search.trim() || undefined, status: processId ? undefined : (statusFilter || undefined) as ProcessStatus | undefined });
  const referencesQuery = trpc.processes.referenceData.useQuery();
  const selected = processId ? processesQuery.data?.find(process => process.id === Number(processId)) ?? null : null;

  const createProcess = trpc.processes.create.useMutation({ onSuccess: created => { toast.success("Processo criado."); setFormOpen(false); void utils.processes.list.invalidate(); setLocation(`/processos/${created.id}`); }, onError: error => toast.error(error.message) });
  const updateProcess = trpc.processes.update.useMutation({ onSuccess: updated => { toast.success("Processo atualizado."); setFormOpen(false); void utils.processes.list.invalidate(); setLocation(`/processos/${updated.id}`); }, onError: error => toast.error(error.message) });
  const deleteProcess = trpc.processes.delete.useMutation({ onSuccess: async () => { toast.success("Processo excluído."); setDeleteOpen(false); await utils.processes.list.invalidate(); setLocation("/processos"); }, onError: error => toast.error(error.message) });
  const sectorOptions = useMemo(() => (referencesQuery.data?.sectors ?? []).map(sector => ({ value: sector.id, label: sector.name, description: "Cadastro oficial · Operação" })), [referencesQuery.data?.sectors]);
  const isSaving = createProcess.isPending || updateProcess.isPending;
  const isDeleting = deleteProcess.isPending;

  const updateField = <K extends keyof ProcessForm>(field: K, value: ProcessForm[K]) => setForm(current => ({ ...current, [field]: value }));
  const updateStep = (index: number, field: keyof ProcessStepForm, value: string) => setForm(current => ({ ...current, steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, [field]: value } : step) }));
  const addStep = () => setForm(current => ({ ...current, steps: [...current.steps, emptyStep()] }));
  const removeStep = (index: number) => setForm(current => ({ ...current, steps: current.steps.length === 1 ? current.steps : current.steps.filter((_, stepIndex) => stepIndex !== index) }));
  const openCreate = () => { setEditingId(null); setForm({ ...emptyForm, steps: [emptyStep()] }); setFormOpen(true); };
  const openEdit = () => { if (!selected) return; setEditingId(selected.id); setForm(asForm(selected as unknown as Record<string, unknown>)); setFormOpen(true); };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const steps = form.steps.map((step, index) => ({
      stepOrder: index + 1,
      sectorId: Number(step.sectorId),
      stepType: step.stepType,
      stepName: step.stepName.trim(),
      description: step.description.trim(),
      gatewayQuestion: step.stepType === "gateway" ? step.gatewayQuestion.trim() || null : null,
      yesNextStepOrder: step.stepType === "gateway" && step.yesNextStepOrder ? Number(step.yesNextStepOrder) : null,
      noNextStepOrder: step.stepType === "gateway" && step.noNextStepOrder ? Number(step.noNextStepOrder) : null,
    }));
    if (!form.code.trim() || !form.name.trim() || !form.category.trim()) return toast.error("Preencha Código, Nome do processo e Categoria.");
    if (steps.some(step => !Number.isInteger(step.sectorId) || step.sectorId <= 0)) return toast.error("Selecione o Setor oficial em cada passo.");
    if (steps.some(step => !step.stepName || step.stepName.length < 2 || !step.description || step.description.length < 3)) return toast.error("Preencha o nome e a explicação de cada passo.");
    if (steps.some(step => step.stepType === "gateway" && (!step.gatewayQuestion || !step.yesNextStepOrder || !step.noNextStepOrder))) return toast.error("Em cada decisão, informe a pergunta e os caminhos Sim e Não.");
    const description = steps.map(step => `${step.stepOrder}. ${step.stepName}: ${step.description}`).join("\n\n");
    const payload = { code: form.code.trim(), name: form.name.trim(), category: form.category.trim(), version: "1.0", status: form.status, ownerUserId: null, regionalId: null, objective: null, scope: null, description, inputs: null, outputs: null, controls: null, exceptions: null, sla: null, relatedModules: null, kpis: null, effectiveFrom: null, reviewDate: null, steps };
    if (editingId) updateProcess.mutate({ ...payload, id: editingId }); else createProcess.mutate(payload);
  };

  const bpmnSteps = (selected?.steps ?? []) as BpmnStep[];
  const headerTitle = selected ? selected.name : "Processos";
  const headerDescription = selected ? "Consulte as informações, o BPMN e o descritivo operacional deste processo." : "Cadastre processos oficiais, organize o passo a passo por setor e abra cada processo em sua própria página.";

  return <WorkspaceShell>
    <WorkspaceHeader eyebrow="Gestão integrada" title={headerTitle} description={headerDescription} icon={ClipboardList} actions={<WorkspaceActions>{processId ? <Button type="button" variant="outline" onClick={() => setLocation("/processos")} className="h-9 rounded-lg border-border px-3 text-xs text-primary"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Voltar para processos</Button> : null}{canCreate && <Button type="button" onClick={openCreate} className="h-9 rounded-lg bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"><FilePlus2 className="mr-1.5 h-3.5 w-3.5" />Novo processo</Button>}{selected && canUpdate ? <Button type="button" variant="outline" onClick={openEdit} className="h-9 rounded-lg border-border px-3 text-xs text-primary"><Pencil className="mr-1.5 h-3.5 w-3.5" />Editar processo</Button> : null}{selected && canDelete ? <Button type="button" variant="outline" onClick={() => setDeleteOpen(true)} className="h-9 rounded-lg border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Excluir processo</Button> : null}</WorkspaceActions>} meta={<span className="inline-flex items-center gap-1.5"><GitBranch className="h-3.5 w-3.5" />BPMN por pools e decisões</span>} />

    {!processId ? <WorkspaceSection title="Catálogo de processos" description="A página principal reúne os processos cadastrados e suas informações principais. Clique em um card para abrir a página completa do processo.">
      <div className="hub-filter-panel mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem]"><Field label="Pesquisar processos"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Código, nome ou categoria" className="h-9 pl-9" /></div></Field><SearchableSelect id="process-status-filter" label="Status" value={statusFilter} options={[{ value: "", label: "Todos os status" }, ...statusOptions]} onChange={setStatusFilter} /></div>
      {processesQuery.isLoading ? <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-border p-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : processesQuery.data?.length ? <div className="grid gap-4 xl:grid-cols-2">{processesQuery.data.map(process => <button key={process.id} type="button" onClick={() => setLocation(`/processos/${process.id}`)} className="block w-full text-left"><WorkspaceCard className="h-full transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">{process.code}</span><span className="text-[11px] text-muted-foreground">v{process.version}</span></div><h2 className="mt-3 truncate font-display text-lg font-semibold text-foreground">{process.name}</h2><p className="mt-1 text-xs text-muted-foreground">{process.category}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${process.status === "active" ? "bg-emerald-100 text-emerald-700" : process.status === "archived" ? "bg-muted text-muted-foreground" : "bg-amber-100 text-amber-700"}`}>{statusLabels[process.status as ProcessStatus]}</span></div><div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Layers3 className="h-3.5 w-3.5" />{process.steps?.length ?? 0} passo(s)</span><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" />{process.steps?.filter(step => step.stepType === "gateway").length ?? 0} decisão(ões)</span></div></WorkspaceCard></button>)}</div> : <WorkspaceCard className="grid min-h-48 place-items-center text-center"><BookOpenText className="h-6 w-6 text-primary" /><h2 className="mt-3 font-display text-lg font-semibold text-foreground">Nenhum processo encontrado</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Crie o primeiro processo ou ajuste os filtros para consultar outra etapa da governança.</p></WorkspaceCard>}
    </WorkspaceSection> : processesQuery.isLoading ? <WorkspaceCard className="grid min-h-48 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></WorkspaceCard> : !selected ? <WorkspaceCard className="grid min-h-48 place-items-center text-center"><BookOpenText className="h-6 w-6 text-primary" /><h2 className="mt-3 font-display text-lg font-semibold text-foreground">Processo não encontrado</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Volte para a lista e escolha um processo disponível.</p><Button type="button" variant="outline" onClick={() => setLocation("/processos")} className="mt-4 border-border text-xs text-primary">Voltar para a lista</Button></WorkspaceCard> : <>
      <WorkspaceSection title="Informações do processo" description="A ficha concentra a identificação do processo e o acesso ao documento visual oficial.">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]"><WorkspaceCard><div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-primary/25 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">{selected.code}</span><span className="text-xs text-muted-foreground">Versão {selected.version}</span><span className="ml-auto rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-foreground">{statusLabels[selected.status as ProcessStatus]}</span></div><h2 className="mt-4 font-display text-2xl font-semibold text-foreground">{selected.name}</h2><p className="mt-1 text-sm text-muted-foreground">{selected.category}</p><div className="mt-6 rounded-xl border border-border bg-secondary/20 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-foreground"><ExternalLink className="h-4 w-4 text-primary" />Documento do processo</div><p className="mt-2 text-sm leading-6 text-muted-foreground">O PDF ou imagem não é exibido dentro do card. Cada arquivo fica disponível para abertura em uma nova guia.</p><EvidenceUpload entityType="process" entityId={selected.id} canWrite={canUpdate} variant="links" title="Documento visual do processo" /></div></WorkspaceCard><WorkspaceCard><h3 className="font-display text-base font-semibold text-foreground">Resumo</h3><dl className="mt-4 space-y-3 text-xs"><KeyValue label="Código" value={selected.code} /><KeyValue label="Categoria" value={selected.category} /><KeyValue label="Status" value={statusLabels[selected.status as ProcessStatus]} /><KeyValue label="Passos" value={String(selected.steps?.length ?? 0)} /><KeyValue label="Decisões" value={String(selected.steps?.filter(step => step.stepType === "gateway").length ?? 0)} /></dl></WorkspaceCard></div>
      </WorkspaceSection>
      <WorkspaceSection title="BPMN" description="O modelo é gerado no próprio sistema usando Setor como pool, Nome do passo como atividade e decisões com caminhos Sim/Não."><WorkspaceCard><ProcessBpmnDiagram steps={bpmnSteps} /></WorkspaceCard></WorkspaceSection>
      <WorkspaceSection title="Descritivo" description="Cada passo mostra o setor responsável, o nome da etapa e a explicação. Os gateways deixam explícitas as decisões e seus próximos caminhos."><div className="grid gap-4">{selected.steps?.length ? selected.steps.map(step => <WorkspaceCard key={step.id} className={step.stepType === "gateway" ? "border-accent/50" : ""}><div className="flex items-start gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${step.stepType === "gateway" ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"}`}>{step.stepOrder}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{step.sectorName}</p>{step.stepType === "gateway" ? <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">Decisão</span> : null}</div><h3 className="mt-1 font-display text-base font-semibold text-foreground">{step.stepName}</h3>{step.stepType === "gateway" && step.gatewayQuestion ? <p className="mt-2 text-sm font-medium text-foreground">{step.gatewayQuestion}</p> : null}<p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{step.description}</p>{step.stepType === "gateway" ? <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2"><div className="rounded-lg border border-primary/25 bg-primary/5 p-3"><span className="font-semibold text-primary">Sim</span><p className="mt-1 text-muted-foreground">Vai para o passo {step.yesNextStepOrder ?? "não definido"}.</p></div><div className="rounded-lg border border-accent/30 bg-accent/5 p-3"><span className="font-semibold text-accent-foreground">Não</span><p className="mt-1 text-muted-foreground">Vai para o passo {step.noNextStepOrder ?? "não definido"}.</p></div></div> : null}</div></div></WorkspaceCard>) : <WorkspaceCard><p className="text-sm text-muted-foreground">Este processo ainda não possui passos cadastrados.</p></WorkspaceCard>}</div></WorkspaceSection>
    </>}

    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir processo?</AlertDialogTitle><AlertDialogDescription>Esta ação removerá o processo e todas as suas etapas. O histórico de auditoria será preservado, mas o registro não poderá ser recuperado pela aplicação.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel><AlertDialogAction disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => selected && deleteProcess.mutate({ id: selected.id })}>{isDeleting ? "Excluindo…" : "Excluir processo"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

    <Dialog open={formOpen} onOpenChange={setFormOpen}><DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto bg-card text-card-foreground"><DialogHeader><DialogTitle>{editingId ? "Editar processo" : "Novo processo"}</DialogTitle><DialogDescription>Cadastre a identificação do processo e organize o descritivo por setor. O BPMN será gerado automaticamente após salvar.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-6"><div className="grid gap-4 md:grid-cols-3"><Field label="Código"><Input value={form.code} onChange={event => updateField("code", event.target.value)} placeholder="PROC-TRADE-001" /></Field><Field label="Nome do processo" className="md:col-span-2"><Input value={form.name} onChange={event => updateField("name", event.target.value)} placeholder="Planejamento de ação de Trade" /></Field><Field label="Categoria"><Input value={form.category} onChange={event => updateField("category", event.target.value)} placeholder="Ações, mídias, eventos…" /></Field><SearchableSelect id="process-form-status" label="Status" value={form.status} options={statusOptions} onChange={value => updateField("status", value as ProcessStatus)} /></div><div className="rounded-xl border border-border bg-secondary/20 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-display text-base font-semibold text-foreground">Descritivo por passos</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">Use o Setor oficial de Cadastros &gt; Operação &gt; Setores. Para uma decisão, transforme o passo em gateway e indique os destinos Sim e Não.</p></div><Button type="button" variant="outline" onClick={addStep} className="h-8 rounded-lg px-3 text-xs"><Plus className="mr-1.5 h-3.5 w-3.5" />Adicionar passo</Button></div><div className="mt-4 grid gap-4">{form.steps.map((step, index) => { const targetOptions = form.steps.map((_, targetIndex) => ({ value: targetIndex + 1, label: `Passo ${targetIndex + 1}${targetIndex === index ? " (atual)" : ""}` })).filter(option => option.value !== index + 1); return <div key={`${index}-${step.stepName}`} className="rounded-xl border border-border bg-card p-4"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{index + 1}</span><span className="text-xs font-semibold text-foreground">Passo {index + 1}</span></div>{form.steps.length > 1 ? <Button type="button" variant="ghost" onClick={() => removeStep(index)} className="h-7 px-2 text-xs text-destructive"><Trash2 className="mr-1 h-3.5 w-3.5" />Remover</Button> : null}</div><div className="mt-4 grid gap-4 md:grid-cols-2"><SearchableSelect id={`process-step-sector-${index}`} label="Setor" value={step.sectorId} options={sectorOptions} onChange={value => updateStep(index, "sectorId", value)} /><Field label="Nome do passo"><Input value={step.stepName} onChange={event => updateStep(index, "stepName", event.target.value)} placeholder="Validar solicitação" /></Field><div className="md:col-span-2"><SearchableSelect id={`process-step-type-${index}`} label="Tipo de passo" value={step.stepType} options={stepTypeOptions} onChange={value => updateStep(index, "stepType", value as StepType)} /></div>{step.stepType === "gateway" ? <><Field label="Pergunta da decisão" className="md:col-span-2"><Input value={step.gatewayQuestion} onChange={event => updateStep(index, "gatewayQuestion", event.target.value)} placeholder="A solicitação está completa?" /></Field><SearchableSelect id={`process-step-yes-${index}`} label="Caminho Sim" value={step.yesNextStepOrder} options={targetOptions} onChange={value => updateStep(index, "yesNextStepOrder", value)} /><SearchableSelect id={`process-step-no-${index}`} label="Caminho Não" value={step.noNextStepOrder} options={targetOptions} onChange={value => updateStep(index, "noNextStepOrder", value)} /></> : null}<Field label="Explicação do processo" className="md:col-span-2"><Textarea rows={4} value={step.description} onChange={event => updateStep(index, "description", event.target.value)} placeholder="Descreva como executar, validar e concluir esta etapa." /></Field></div></div>; })}</div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setFormOpen(false)}><X className="mr-1.5 h-4 w-4" />Cancelar</Button><Button type="submit" disabled={isSaving} className="bg-primary text-primary-foreground">{isSaving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}{editingId ? "Salvar alterações" : "Criar processo"}</Button></DialogFooter></form></DialogContent></Dialog>
  </WorkspaceShell>;
}
