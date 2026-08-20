import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import { CalendarClock, CheckCircle2, CircleAlert, ClipboardCheck, GripVertical, Loader2, Plus, RefreshCw, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const statusColumns = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "A fazer" },
  { value: "in_progress", label: "Em andamento" },
  { value: "blocked", label: "Bloqueadas" },
  { value: "done", label: "Concluídas" },
] as const;

const priorityLabels = { low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" } as const;
type Priority = keyof typeof priorityLabels;
const emptyDraft = { title: "", description: "", priority: "normal" as Priority, assignedToUserId: "", dueDate: "" };

type Draft = typeof emptyDraft;
type Task = { id: number; title: string; description: string | null; status: string; priority: Priority; assignedToUserId: number | null; assignedToName: string | null; dueDate: string | null; source: string; entityType: string | null; entityId: number | null };

export default function TasksWorkspace() {
  const { can, isLoading: permissionsLoading } = useEffectivePermissions();
  const utils = trpc.useUtils();
  const [scope, setScope] = useState<"mine" | "team">("team");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const tasksQuery = trpc.tasks.list.useQuery({ scope }, { staleTime: 10_000 });
  const referenceQuery = trpc.tasks.referenceData.useQuery(undefined, { staleTime: 60_000 });
  const historyQuery = trpc.tasks.history.useQuery({ taskId: editingTask?.id ?? 0 }, { enabled: Boolean(editingTask), staleTime: 10_000 });
  const createTask = trpc.tasks.create.useMutation({ onSuccess: async () => { await utils.tasks.list.invalidate(); setIsDialogOpen(false); setDraft(emptyDraft); toast.success("Tarefa criada."); }, onError: error => toast.error(error.message) });
  const updateTask = trpc.tasks.update.useMutation({ onSuccess: async () => { await utils.tasks.list.invalidate(); setEditingTask(null); toast.success("Tarefa atualizada."); }, onError: error => toast.error(error.message) });
  const canCreate = can("tasks.create");
  const canUpdate = can("tasks.update");
  const tasks = (tasksQuery.data ?? []) as Task[];
  const users = referenceQuery.data?.users ?? [];
  const grouped = useMemo(() => Object.fromEntries(statusColumns.map(column => [column.value, tasks.filter(task => task.status === column.value)])), [tasks]);

  const openCreate = (status = "todo") => {
    setEditingTask(null);
    setDraft({ ...emptyDraft });
    setIsDialogOpen(true);
  };
  const openEdit = (task: Task) => {
    setEditingTask(task);
    setDraft({ title: task.title, description: task.description ?? "", priority: task.priority, assignedToUserId: task.assignedToUserId ? String(task.assignedToUserId) : "", dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "" });
    setIsDialogOpen(true);
  };
  const saveTask = async () => {
    if (!draft.title.trim()) return toast.error("Informe o título da tarefa.");
    const assignedToUserId = draft.assignedToUserId ? Number(draft.assignedToUserId) : null;
    if (editingTask) {
      updateTask.mutate({ id: editingTask.id, title: draft.title, description: draft.description || null, priority: draft.priority, assignedToUserId, dueDate: draft.dueDate || null });
    } else {
      createTask.mutate({ title: draft.title, description: draft.description || null, priority: draft.priority, assignedToUserId, dueDate: draft.dueDate || null, status: "todo" });
    }
  };
  const moveTask = (status: (typeof statusColumns)[number]["value"]) => {
    if (!draggedTaskId || !canUpdate) return;
    updateTask.mutate({ id: draggedTaskId, status });
    setDraggedTaskId(null);
  };

  if (tasksQuery.isLoading || referenceQuery.isLoading || permissionsLoading) return <div className="grid min-h-[360px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return <div className="hub-entity-page">
    <header className="hub-entity-header">
      <div className="flex min-w-0 items-start gap-4"><span className="hub-entity-icon"><ClipboardCheck className="h-5 w-5" /></span><div className="min-w-0"><p className="hub-eyebrow">Gestão integrada</p><h1 className="hub-title">Tarefas</h1><p className="hub-description">Organize responsabilidades, pendências e entregas do Trade em um painel Kanban compartilhado.</p></div></div>
      <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => void tasksQuery.refetch()} disabled={tasksQuery.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${tasksQuery.isFetching ? "animate-spin" : ""}`} />Atualizar</Button>{canCreate ? <Button size="sm" onClick={() => openCreate()}><Plus className="mr-2 h-4 w-4" />Nova tarefa</Button> : null}</div>
    </header>

    <section className="hub-entity-card">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="hub-eyebrow">Painel de responsabilidades</p><h2 className="hub-section-title">Acompanhamento operacional</h2><p className="hub-muted">Arraste as tarefas entre as colunas ou abra um card para editar seus detalhes.</p></div><div className="flex items-center gap-2"><Button size="sm" variant={scope === "team" ? "default" : "outline"} onClick={() => setScope("team")}>Equipe</Button><Button size="sm" variant={scope === "mine" ? "default" : "outline"} onClick={() => setScope("mine")}>Minhas tarefas</Button></div></div>
      <div className="mt-5 grid gap-4 xl:grid-cols-5">
        {statusColumns.map(column => <article key={column.value} className="hub-kanban-column" onDragOver={event => event.preventDefault()} onDrop={() => moveTask(column.value)}><div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><GripVertical className="h-4 w-4 text-muted-foreground" /><h3 className="truncate text-sm font-semibold text-foreground">{column.label}</h3></div><span className="hub-count-badge">{grouped[column.value]?.length ?? 0}</span></div><div className="mt-3 space-y-3">{(grouped[column.value] ?? []).map(task => <button key={task.id} type="button" draggable={canUpdate} onDragStart={() => setDraggedTaskId(task.id)} onClick={() => openEdit(task)} className="hub-task-card"><div className="flex items-start justify-between gap-2"><span className="line-clamp-2 text-sm font-semibold text-foreground">{task.title}</span>{task.priority === "urgent" || task.priority === "high" ? <CircleAlert className="h-4 w-4 shrink-0 text-destructive" /> : null}</div>{task.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{task.description}</p> : null}<div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span className="rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">{priorityLabels[task.priority]}</span>{task.assignedToName ? <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{task.assignedToName}</span> : null}{task.dueDate ? <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />{new Date(task.dueDate).toLocaleDateString("pt-BR")}</span> : null}</div>{task.source === "notification" ? <span className="mt-2 inline-flex text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Originada de notificação</span> : null}</button>)}{!(grouped[column.value] ?? []).length ? <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">Nenhuma tarefa nesta etapa.</p> : null}</div>{canCreate ? <Button variant="ghost" size="sm" className="mt-3 w-full justify-start" onClick={() => openCreate(column.value)}><Plus className="mr-2 h-4 w-4" />Adicionar tarefa</Button> : null}</article>)}
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-3"><div className="hub-entity-card"><CheckCircle2 className="h-5 w-5 text-primary" /><h3 className="mt-3 font-display text-lg font-semibold text-foreground">Responsabilidade clara</h3><p className="mt-2 hub-muted">Cada tarefa pode ter uma pessoa responsável, prazo e prioridade definidos.</p></div><div className="hub-entity-card"><BellIcon /><h3 className="mt-3 font-display text-lg font-semibold text-foreground">Origem rastreável</h3><p className="mt-2 hub-muted">Notificações podem virar tarefas sem perder o vínculo com o registro de origem.</p></div><div className="hub-entity-card"><HistoryIcon /><h3 className="mt-3 font-display text-lg font-semibold text-foreground">Histórico operacional</h3><p className="mt-2 hub-muted">Mudanças de status e responsáveis ficam registradas para acompanhamento.</p></div></section>

    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{editingTask ? "Editar tarefa" : "Nova tarefa"}</DialogTitle><DialogDescription>Defina a responsabilidade e o prazo para facilitar o acompanhamento.</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={event => { event.preventDefault(); void saveTask(); }}><label className="grid gap-1.5 text-sm font-medium">Título<input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.title} onChange={event => setDraft(current => ({ ...current, title: event.target.value }))} placeholder="Ex.: Validar evidências da campanha" /></label><label className="grid gap-1.5 text-sm font-medium">Descrição<Textarea className="min-h-28" value={draft.description} onChange={event => setDraft(current => ({ ...current, description: event.target.value }))} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">Prioridade<select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={draft.priority} onChange={event => setDraft(current => ({ ...current, priority: event.target.value as Draft["priority"] }))}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="grid gap-1.5 text-sm font-medium">Responsável<select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={draft.assignedToUserId} onChange={event => setDraft(current => ({ ...current, assignedToUserId: event.target.value }))}><option value="">Não definido</option>{users.map(user => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}</select></label></div><label className="grid gap-1.5 text-sm font-medium">Prazo<input type="date" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={draft.dueDate} onChange={event => setDraft(current => ({ ...current, dueDate: event.target.value }))} /></label>{editingTask ? <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Histórico da tarefa</p>{historyQuery.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}</div>{(historyQuery.data ?? []).length ? <div className="max-h-32 space-y-2 overflow-y-auto">{historyQuery.data?.map(item => <div key={item.id} className="border-l-2 border-primary/30 pl-3 text-xs"><p className="font-medium text-foreground">{item.note || item.action}</p><p className="text-muted-foreground">{item.actorName || "Sistema"} · {new Date(item.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p></div>)}</div> : <p className="text-xs text-muted-foreground">Nenhuma alteração registrada ainda.</p>}</div> : null}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button><Button type="submit" disabled={createTask.isPending || updateTask.isPending}>{editingTask ? "Salvar alterações" : "Criar tarefa"}</Button></div></form></DialogContent></Dialog>
  </div>;
}

function BellIcon() { return <svg aria-hidden="true" className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M13.7 21h-3.4" /></svg>; }
function HistoryIcon() { return <svg aria-hidden="true" className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2" /></svg>; }
