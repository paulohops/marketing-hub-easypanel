import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SearchableSelect from "@/components/SearchableSelect";
import { trpc } from "@/lib/trpc";
import { ClipboardCheck, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Priority = "low" | "normal" | "high" | "urgent";

type Props = {
  entityType: string;
  entityId: number;
  entityName: string;
  defaultDescription?: string;
  defaultTitle?: string;
  regionalId?: number | null;
  cityId?: number | null;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
};

const priorityLabels: Record<Priority, string> = { low: "Baixa", normal: "Normal", high: "Alta", urgent: "Urgente" };

export default function ContextTaskDialog({ entityType, entityId, entityName, defaultDescription, defaultTitle, regionalId, cityId, variant = "outline", size = "sm", className }: Props) {
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const [title, setTitle] = useState(defaultTitle ?? `Acompanhar ${entityName}`);
  const [description, setDescription] = useState(defaultDescription ?? "");
  const [priority, setPriority] = useState<Priority>("normal");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const usersQuery = trpc.tasks.referenceData.useQuery(undefined, { enabled: open, staleTime: 60_000 });
  const createTask = trpc.tasks.create.useMutation({
    onSuccess: async () => { toast.success("Tarefa contextual criada."); await utils.tasks.list.invalidate(); setOpen(false); },
    onError: error => toast.error(error.message),
  });
  function openChanged(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setTitle(defaultTitle ?? `Acompanhar ${entityName}`);
      setDescription(defaultDescription ?? "");
      setPriority("normal");
      setAssignedToUserId("");
      setDueDate("");
    }
  }
  function submit() {
    if (!title.trim()) { toast.error("Informe o título da tarefa."); return; }
    createTask.mutate({ title: title.trim(), description: description.trim() || null, priority, status: "todo", assignedToUserId: assignedToUserId ? Number(assignedToUserId) : null, dueDate: dueDate || null, entityType, entityId, source: "context" });
  }
  return <Dialog open={open} onOpenChange={openChanged}><DialogTrigger asChild><Button type="button" variant={variant} size={size} className={className}><ClipboardCheck className="mr-1.5 h-4 w-4" />Criar tarefa</Button></DialogTrigger><DialogContent className="hub-form-dialog"><DialogHeader><DialogTitle>Nova tarefa contextual</DialogTitle><DialogDescription>Esta tarefa ficará vinculada a <strong>{entityName}</strong> e poderá ser aberta novamente a partir do Kanban.</DialogDescription></DialogHeader><div className="grid gap-4"><div><Label htmlFor="context-task-title">Título</Label><Input id="context-task-title" value={title} onChange={event => setTitle(event.target.value)} className="mt-1.5" /></div><div><Label htmlFor="context-task-description">Orientação</Label><Textarea id="context-task-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="Explique o que precisa ser verificado ou alterado." className="mt-1.5 min-h-24" /></div><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="context-task-priority">Prioridade</Label><select id="context-task-priority" value={priority} onChange={event => setPriority(event.target.value as Priority)} className="mt-1.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><Label htmlFor="context-task-due">Prazo</Label><Input id="context-task-due" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} className="mt-1.5" /></div></div><SearchableSelect id="context-task-assignee" label="Responsável" value={assignedToUserId} onChange={setAssignedToUserId} placeholder="Não definido" options={(usersQuery.data?.users ?? []).map(user => ({ value: user.id, label: user.name || user.email || `Usuário #${user.id}` }))} /><div className="rounded-xl border border-primary/20 bg-primary/[0.045] p-3 text-xs text-muted-foreground">Registro vinculado: <strong className="text-foreground">{entityType} #{entityId}</strong>{regionalId ? ` · Regional #${regionalId}` : ""}{cityId ? ` · Cidade #${cityId}` : ""}</div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="button" onClick={submit} disabled={createTask.isPending}>{createTask.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Criar tarefa</Button></DialogFooter></DialogContent></Dialog>;
}
