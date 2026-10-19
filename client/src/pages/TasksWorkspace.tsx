import { WorkspaceActions, WorkspaceHeader, WorkspaceSection, WorkspaceShell } from "@/components/WorkspaceChrome";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import SearchableSelect from "@/components/SearchableSelect";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import {
  AlignLeft,
  CalendarClock,
  CheckCircle2,
  Circle,
  CircleAlert,
  ClipboardCheck,
  ExternalLink,
  GripVertical,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const statusColumns = [
  { value: "todo", label: "A Fazer", color: "border-t-sky-500", dot: "bg-sky-500" },
  { value: "in_progress", label: "Em Andamento", color: "border-t-amber-500", dot: "bg-amber-500" },
  { value: "done", label: "Concluído", color: "border-t-emerald-500", dot: "bg-emerald-500" },
] as const;

type StatusColumnValue = (typeof statusColumns)[number]["value"];

const priorityLabels = {
  low: { label: "Baixa", class: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20" },
  normal: { label: "Normal", class: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20" },
  high: { label: "Alta", class: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  urgent: { label: "Urgente", class: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-bold" },
} as const;

type Priority = keyof typeof priorityLabels;

type TaskParticipant = {
  id: number;
  name: string | null;
  email: string;
  role?: string;
};

type Task = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: Priority;
  assignedToUserId: number | null;
  assignedToName: string | null;
  participants?: TaskParticipant[];
  dueDate: string | null;
  source: string;
  entityType: string | null;
  entityId: number | null;
  completedAt?: Date | string | null;
  createdAt: Date | string;
};

const emptyDraft = {
  title: "",
  description: "",
  priority: "normal" as Priority,
  status: "todo" as StatusColumnValue,
  assignedUserIds: [] as number[],
  dueDate: "",
};

type Draft = typeof emptyDraft;

function displayStatus(status: string): StatusColumnValue {
  if (status === "backlog") return "todo";
  if (status === "blocked") return "in_progress";
  if (status === "done") return "done";
  if (status === "in_progress") return "in_progress";
  return "todo";
}

function getUserInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "U";
}

function contextRoute(entityType: string, entityId: number) {
  const routes: Record<string, string> = {
    campaign: `/campanhas/${entityId}`,
    trade_campaign: `/campanhas/${entityId}`,
    media_campaign: `/midias/veiculacao/${entityId}`,
    media_point: `/midias/${entityId}`,
    action: `/acoes/${entityId}`,
    event: `/eventos/${entityId}`,
    stock_item: `/estoque?item=${entityId}`,
    invoice: `/financeiro?invoice=${entityId}`,
    purchase_order: `/financeiro?purchaseOrder=${entityId}`,
    task: `/tarefas?task=${entityId}`,
  };
  return routes[entityType] ?? "/";
}

function getDueDateState(dueDateStr: string | null, isDone: boolean) {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (isDone) {
    return {
      text: new Date(dueDateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    };
  }

  if (diffDays < 0) {
    return {
      text: `${new Date(dueDateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} (Atrasada)`,
      className: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-semibold",
    };
  }

  if (diffDays === 0) {
    return {
      text: "Hoje",
      className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold",
    };
  }

  return {
    text: new Date(dueDateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    className: "bg-muted text-muted-foreground border-border",
  };
}

export default function TasksWorkspace() {
  const { can, isLoading: permissionsLoading } = useEffectivePermissions();
  const utils = trpc.useUtils();
  const [scope, setScope] = useState<"mine" | "team">("team");
  const [filterUserId, setFilterUserId] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);

  const tasksQuery = trpc.tasks.list.useQuery(
    { scope, assignedToUserId: filterUserId ? Number(filterUserId) : undefined },
    { staleTime: 10_000 }
  );
  const referenceQuery = trpc.tasks.referenceData.useQuery(undefined, { staleTime: 60_000 });
  const historyQuery = trpc.tasks.history.useQuery(
    { taskId: editingTask?.id ?? 0 },
    { enabled: Boolean(editingTask), staleTime: 10_000 }
  );

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: async () => {
      await utils.tasks.list.invalidate();
      setIsDialogOpen(false);
      setDraft(emptyDraft);
      toast.success("Cartão criado com sucesso!");
    },
    onError: error => toast.error(error.message),
  });

  const updateTask = trpc.tasks.update.useMutation({
    onSuccess: async () => {
      await utils.tasks.list.invalidate();
      if (isDialogOpen) setIsDialogOpen(false);
      setEditingTask(null);
      toast.success("Tarefa atualizada.");
    },
    onError: error => toast.error(error.message),
  });

  const deleteTask = trpc.tasks.delete.useMutation({
    onSuccess: async () => {
      await utils.tasks.list.invalidate();
      setEditingTask(null);
      setIsDialogOpen(false);
      toast.success("Cartão excluído com segurança.");
    },
    onError: error => toast.error(error.message),
  });

  const canCreate = can("tasks.create");
  const canUpdate = can("tasks.update");
  const canDelete = can("tasks.delete");

  const tasks = (tasksQuery.data ?? []) as Task[];
  const users = referenceQuery.data?.users ?? [];

  const userSelectOptions = useMemo(
    () =>
      users.map(u => ({
        id: u.id,
        label: u.name || u.email || `Usuário #${u.id}`,
        description: u.email ?? undefined,
      })),
    [users]
  );

  const grouped = useMemo(
    () =>
      Object.fromEntries(
        statusColumns.map(column => [
          column.value,
          tasks.filter(task => displayStatus(task.status) === column.value),
        ])
      ),
    [tasks]
  );

  const openCreateForColumn = (columnStatus: StatusColumnValue = "todo") => {
    setEditingTask(null);
    setDraft({
      ...emptyDraft,
      status: columnStatus,
    });
    setIsDialogOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    const assignedIds =
      task.participants && task.participants.length > 0
        ? task.participants.map(p => p.id)
        : task.assignedToUserId
        ? [task.assignedToUserId]
        : [];

    setDraft({
      title: task.title,
      description: task.description ?? "",
      priority: task.priority,
      status: displayStatus(task.status),
      assignedUserIds: assignedIds,
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
    });
    setIsDialogOpen(true);
  };

  // Quick toggle task completion directly on the card
  const toggleTaskDone = (task: Task) => {
    if (!canUpdate) return;
    const isDone = task.status === "done";
    const nextStatus = isDone ? "todo" : "done";
    updateTask.mutate({
      id: task.id,
      status: nextStatus,
    });
    if (!isDone) {
      toast.success("Tarefa marcada como concluída! 🎉");
    } else {
      toast.info("Tarefa reaberta para 'A Fazer'.");
    }
  };

  const saveTask = async () => {
    if (!draft.title.trim()) return toast.error("Informe o título do cartão.");

    if (editingTask) {
      updateTask.mutate({
        id: editingTask.id,
        title: draft.title.trim(),
        description: draft.description || null,
        status: draft.status,
        priority: draft.priority,
        assignedUserIds: draft.assignedUserIds,
        dueDate: draft.dueDate || null,
      });
    } else {
      createTask.mutate({
        title: draft.title.trim(),
        description: draft.description || null,
        status: draft.status,
        priority: draft.priority,
        assignedUserIds: draft.assignedUserIds,
        dueDate: draft.dueDate || null,
      });
    }
  };

  const moveTask = (status: StatusColumnValue) => {
    if (!draggedTaskId || !canUpdate) return;
    updateTask.mutate({ id: draggedTaskId, status });
    setDraggedTaskId(null);
  };

  if (tasksQuery.isLoading || referenceQuery.isLoading || permissionsLoading) {
    return (
      <div className="grid min-h-[360px] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <WorkspaceShell>
      <WorkspaceHeader
        eyebrow="Trade · Kanban"
        title="Quadro de Tarefas"
        description="Organize o fluxo de trabalho da equipe com cartões visuais estilo Trello, divisão colaborativa de tarefas e conclusão ágil."
        icon={ClipboardCheck}
        actions={
          <WorkspaceActions>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void tasksQuery.refetch()}
              disabled={tasksQuery.isFetching}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${tasksQuery.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            {canCreate ? (
              <Button type="button" size="sm" onClick={() => openCreateForColumn("todo")}>
                <Plus className="mr-1.5 h-4 w-4" />
                Novo Cartão
              </Button>
            ) : null}
          </WorkspaceActions>
        }
      />

      <WorkspaceSection
        title="Quadro Operacional"
        description="Arraste os cartões entre as colunas, marque tarefas concluídas diretamente no cartão ou divida responsabilidades com a equipe."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
              <Button
                size="sm"
                variant={scope === "team" ? "default" : "ghost"}
                className="h-8 text-xs font-medium"
                onClick={() => setScope("team")}
              >
                <Users className="mr-1.5 h-3.5 w-3.5" />
                Toda a equipe
              </Button>
              <Button
                size="sm"
                variant={scope === "mine" ? "default" : "ghost"}
                className="h-8 text-xs font-medium"
                onClick={() => {
                  setScope("mine");
                  setFilterUserId("");
                }}
              >
                <UserRound className="mr-1.5 h-3.5 w-3.5" />
                Minhas tarefas
              </Button>
            </div>
          </div>
        }
      >
        <div className="mb-5 flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="w-full sm:w-72">
            <SearchableSelect
              id="tasks-user-filter"
              label="Filtrar por responsável"
              value={filterUserId}
              onChange={setFilterUserId}
              placeholder="Todos os membros"
              options={users.map(user => ({
                value: user.id,
                label: user.name || user.email || `Usuário #${user.id}`,
              }))}
              disabled={scope === "mine"}
            />
          </div>
          {filterUserId ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setFilterUserId("")}
            >
              Limpar filtro
            </Button>
          ) : null}
        </div>

        {/* Trello-style Columns */}
        <div className="grid gap-5 xl:grid-cols-3">
          {statusColumns.map(column => {
            const columnTasks = grouped[column.value] ?? [];
            return (
              <div
                key={column.value}
                className={`flex flex-col min-h-[30rem] rounded-2xl border border-border/80 bg-secondary/50 p-3 shadow-sm border-t-4 ${column.color}`}
                onDragOver={event => event.preventDefault()}
                onDrop={() => moveTask(column.value)}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between gap-2 px-1 pb-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${column.dot}`} />
                    <h3 className="truncate font-semibold text-sm text-foreground">{column.label}</h3>
                  </div>
                  <Badge variant="secondary" className="font-semibold text-xs px-2 py-0.5">
                    {columnTasks.length}
                  </Badge>
                </div>

                {/* Cards Container */}
                <div className="flex-1 space-y-3">
                  {columnTasks.map(task => {
                    const isDone = task.status === "done";
                    const priorityConfig = priorityLabels[task.priority] ?? priorityLabels.normal;
                    const dueState = getDueDateState(task.dueDate, isDone);
                    const participants = task.participants && task.participants.length > 0
                      ? task.participants
                      : task.assignedToUserId
                      ? [{ id: task.assignedToUserId, name: task.assignedToName, email: "" }]
                      : [];

                    return (
                      <div
                        key={task.id}
                        draggable={canUpdate}
                        onDragStart={() => setDraggedTaskId(task.id)}
                        onClick={() => openEdit(task)}
                        className={`group relative rounded-xl border border-border/70 bg-card p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md cursor-pointer ${
                          isDone ? "bg-muted/30 border-muted" : ""
                        }`}
                      >
                        {/* Top row: Checkbox + Title + Priority */}
                        <div className="flex items-start gap-2.5">
                          {/* Quick completion toggle button */}
                          <button
                            type="button"
                            title={isDone ? "Reabrir tarefa" : "Marcar como concluída"}
                            onClick={e => {
                              e.stopPropagation();
                              toggleTaskDone(task);
                            }}
                            className="mt-0.5 shrink-0 rounded-full transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-950/40" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground hover:text-emerald-500 transition-colors" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <span
                              className={`line-clamp-2 text-sm font-medium leading-snug transition-colors ${
                                isDone
                                  ? "line-through text-muted-foreground"
                                  : "text-foreground group-hover:text-primary"
                              }`}
                            >
                              {task.title}
                            </span>
                          </div>

                          {/* Priority badge */}
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-[10px] px-2 py-0 font-medium ${priorityConfig.class}`}
                          >
                            {priorityConfig.label}
                          </Badge>
                        </div>

                        {/* Description snippet */}
                        {task.description ? (
                          <div className="mt-2.5 flex items-start gap-1.5 text-xs text-muted-foreground pl-7">
                            <AlignLeft className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground/70" />
                            <p className="line-clamp-2 leading-relaxed">{task.description}</p>
                          </div>
                        ) : null}

                        {/* Operational link badge */}
                        {task.entityType && task.entityId ? (
                          <div className="mt-2 pl-7">
                            <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              <ExternalLink className="h-2.5 w-2.5" />
                              {task.entityType} #{task.entityId}
                            </span>
                          </div>
                        ) : null}

                        {/* Bottom Row: Due Date & Member Avatars (Dividir Tarefas) */}
                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/40 pt-2.5 pl-7">
                          {dueState ? (
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] ${dueState.className}`}
                            >
                              <CalendarClock className="h-3 w-3" />
                              {dueState.text}
                            </span>
                          ) : (
                            <span />
                          )}

                          {/* Multi-member overlapping avatars */}
                          {participants.length > 0 ? (
                            <div className="flex items-center -space-x-2 overflow-hidden">
                              {participants.slice(0, 3).map(p => (
                                <Avatar
                                  key={p.id}
                                  className="h-6 w-6 border-2 border-card ring-1 ring-border shadow-xs"
                                  title={p.name || p.email}
                                >
                                  <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                                    {getUserInitials(p.name, p.email)}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {participants.length > 3 ? (
                                <span className="grid h-6 w-6 place-items-center rounded-full border-2 border-card bg-secondary text-[10px] font-semibold text-muted-foreground">
                                  +{participants.length - 3}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                              <UserRound className="h-3 w-3" />
                              Sem membros
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {!columnTasks.length ? (
                    <div className="rounded-xl border border-dashed border-border/70 bg-background/30 p-8 text-center text-xs text-muted-foreground">
                      Nenhum cartão nesta etapa.
                    </div>
                  ) : null}
                </div>

                {/* Bottom Add Card Button like Trello */}
                {canCreate ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 w-full justify-start text-xs text-muted-foreground hover:text-foreground hover:bg-background/60"
                    onClick={() => openCreateForColumn(column.value)}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Adicionar cartão
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </WorkspaceSection>

      {/* Trello Card Modal Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="hub-form-dialog max-w-2xl max-h-[92vh] overflow-y-auto">
          <form
            className="hub-form space-y-4"
            onSubmit={event => {
              event.preventDefault();
              void saveTask();
            }}
          >
            <DialogHeader>
              <div className="flex items-center justify-between gap-2">
                <DialogTitle>{editingTask ? "Detalhes do Cartão" : "Novo Cartão"}</DialogTitle>
                {editingTask ? (
                  <Badge
                    variant={editingTask.status === "done" ? "default" : "outline"}
                    className={
                      editingTask.status === "done"
                        ? "bg-emerald-600 text-white"
                        : "border-primary/30 text-primary"
                    }
                  >
                    {editingTask.status === "done" ? "Concluído" : "Em Aberto"}
                  </Badge>
                ) : null}
              </div>
              <DialogDescription>
                {editingTask
                  ? "Edite as informações, divida o cartão com outros membros da equipe e atualize o status."
                  : "Crie um novo cartão no quadro, atribua responsáveis e determine o prazo."}
              </DialogDescription>
            </DialogHeader>

            {/* Quick Completion Button inside modal if editing */}
            {editingTask ? (
              <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/40 p-3">
                <div className="flex items-center gap-2">
                  {editingTask.status === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="text-xs font-semibold text-foreground">
                    Status atual: {editingTask.status === "done" ? "Concluído" : "Pendente"}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={editingTask.status === "done" ? "outline" : "default"}
                  className={
                    editingTask.status !== "done"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "border-border text-foreground"
                  }
                  onClick={() => {
                    const next = editingTask.status === "done" ? "todo" : "done";
                    setDraft(cur => ({ ...cur, status: next }));
                    toggleTaskDone(editingTask);
                  }}
                >
                  {editingTask.status === "done" ? "Reabrir tarefa" : "Marcar como concluída"}
                </Button>
              </div>
            ) : null}

            {/* Title */}
            <label className="grid gap-1.5 text-sm font-medium">
              Título do cartão
              <input
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={draft.title}
                onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
                placeholder="Ex.: Validar evidências e debriefing da ação"
                required
              />
            </label>

            {/* Status & Priority Row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">
                Coluna / Etapa
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={draft.status}
                  onChange={event =>
                    setDraft(current => ({ ...current, status: event.target.value as StatusColumnValue }))
                  }
                >
                  {statusColumns.map(col => (
                    <option key={col.value} value={col.value}>
                      {col.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-sm font-medium">
                Prioridade
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={draft.priority}
                  onChange={event =>
                    setDraft(current => ({ ...current, priority: event.target.value as Priority }))
                  }
                >
                  {Object.entries(priorityLabels).map(([value, conf]) => (
                    <option key={value} value={value}>
                      {conf.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Dividir com a equipe (Multi-Assignees) */}
            <div className="rounded-xl border border-border/80 bg-background/50 p-3.5 space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Membros da Tarefa (Dividir com a equipe)
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione um ou mais responsáveis para colaborar e acompanhar as entregas deste cartão.
              </p>

              <SearchableMultiSelect
                id="task-assignees"
                label="Responsáveis atribuídos"
                options={userSelectOptions}
                values={draft.assignedUserIds}
                onChange={selected => setDraft(cur => ({ ...cur, assignedUserIds: selected }))}
                placeholder="Selecione membros da equipe..."
                emptyMessage="Nenhum colaborador encontrado"
              />

              {draft.assignedUserIds.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {draft.assignedUserIds.map(uid => {
                    const u = users.find(x => x.id === uid);
                    return (
                      <span
                        key={uid}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-foreground"
                      >
                        <Avatar className="h-4 w-4">
                          <AvatarFallback className="text-[9px] bg-primary/20 text-primary">
                            {getUserInitials(u?.name, u?.email)}
                          </AvatarFallback>
                        </Avatar>
                        {u?.name || u?.email || `#${uid}`}
                        <button
                          type="button"
                          onClick={() =>
                            setDraft(cur => ({
                              ...cur,
                              assignedUserIds: cur.assignedUserIds.filter(id => id !== uid),
                            }))
                          }
                          className="ml-0.5 text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {/* Prazo */}
            <label className="grid gap-1.5 text-sm font-medium">
              Data de Entrega / Prazo
              <input
                type="date"
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={draft.dueDate}
                onChange={event => setDraft(current => ({ ...current, dueDate: event.target.value }))}
              />
            </label>

            {/* Description */}
            <label className="grid gap-1.5 text-sm font-medium">
              Descrição detalhada / Checklist
              <Textarea
                className="min-h-24"
                value={draft.description}
                onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
                placeholder="Detalhes, passos operacionais ou notas do cartão..."
              />
            </label>

            {/* Context link */}
            {editingTask?.entityType && editingTask.entityId ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.045] p-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                    Registro operacional relacionado
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {editingTask.entityType} #{editingTask.entityId}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg border-border text-primary"
                  onClick={() =>
                    window.location.assign(contextRoute(editingTask.entityType!, editingTask.entityId!))
                  }
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Abrir registro
                </Button>
              </div>
            ) : null}

            {/* History */}
            {editingTask ? (
              <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Histórico do cartão
                  </p>
                  {historyQuery.isFetching ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : null}
                </div>
                {(historyQuery.data ?? []).length ? (
                  <div className="max-h-28 space-y-2 overflow-y-auto">
                    {historyQuery.data?.map(item => (
                      <div key={item.id} className="border-l-2 border-primary/30 pl-3 text-xs">
                        <p className="font-medium text-foreground">{item.note || item.action}</p>
                        <p className="text-muted-foreground">
                          {item.actorName || "Sistema"} ·{" "}
                          {new Date(item.createdAt).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhuma alteração registrada ainda.</p>
                )}
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <div>
                {editingTask && canDelete ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                    disabled={deleteTask.isPending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Excluir o cartão “${editingTask.title}”? Esta ação é permanente e será auditada.`
                        )
                      ) {
                        deleteTask.mutate({ id: editingTask.id });
                      }
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {deleteTask.isPending ? "Excluindo..." : "Excluir cartão"}
                  </Button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createTask.isPending || updateTask.isPending}>
                  {editingTask ? "Salvar alterações" : "Criar cartão"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </WorkspaceShell>
  );
}
