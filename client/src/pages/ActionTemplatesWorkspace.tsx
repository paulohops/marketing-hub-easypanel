import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ClipboardList, Edit3, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type TemplateForm = {
  id?: number;
  name: string;
  description: string;
  objective: string;
  defaultActionTypeId: number | null;
  defaultPartnershipType: "paid" | "barter" | "mixed";
  defaultDurationHours: string;
  active: boolean;
};

const partnershipOptions = [
  { id: 1, value: "paid", label: "Pago" },
  { id: 2, value: "barter", label: "Permuta" },
  { id: 3, value: "mixed", label: "Misto" },
];

const blankForm = (): TemplateForm => ({
  name: "",
  description: "",
  objective: "",
  defaultActionTypeId: null,
  defaultPartnershipType: "paid",
  defaultDurationHours: "",
  active: true,
});

const partnershipLabel = (value: string) => partnershipOptions.find(option => option.value === value)?.label ?? "Não informado";
const partnershipId = (value: string) => partnershipOptions.find(option => option.value === value)?.id ?? 1;

export default function ActionTemplatesWorkspace() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: templates = [], isLoading } = trpc.actions.listTemplates.useQuery();
  const { data: referenceData } = trpc.actions.referenceData.useQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TemplateForm>(blankForm);

  const saveMutation = trpc.actions.saveTemplate.useMutation({
    onSuccess: () => {
      toast.success("Modelo de ação salvo.");
      utils.actions.listTemplates.invalidate();
      utils.actions.referenceData.invalidate();
      setOpen(false);
      setForm(blankForm());
    },
    onError: error => toast.error(error.message),
  });
  const deleteMutation = trpc.actions.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success("Modelo removido.");
      utils.actions.listTemplates.invalidate();
      utils.actions.referenceData.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const edit = (template: (typeof templates)[number]) => {
    setForm({
      id: template.id,
      name: template.name,
      description: template.description ?? "",
      objective: template.objective ?? "",
      defaultActionTypeId: template.defaultActionTypeId ?? null,
      defaultPartnershipType: template.defaultPartnershipType,
      defaultDurationHours: template.defaultDurationHours ? String(template.defaultDurationHours) : "",
      active: template.active,
    });
    setOpen(true);
  };
  const save = () => saveMutation.mutate({
    id: form.id,
    name: form.name,
    description: form.description || undefined,
    objective: form.objective || undefined,
    defaultActionTypeId: form.defaultActionTypeId,
    defaultPartnershipType: form.defaultPartnershipType,
    defaultDurationHours: form.defaultDurationHours ? Number(form.defaultDurationHours) : null,
    active: form.active,
  });

  return <main className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><Button type="button" variant="outline" size="icon" aria-label="Voltar aos cadastros" onClick={() => setLocation("/cadastros")}><ArrowLeft className="h-4 w-4" /></Button><div><p className="text-xs font-semibold uppercase tracking-wide text-primary">Cadastros operacionais</p><h1 className="font-display text-2xl font-semibold text-foreground">Modelos de Ações</h1><p className="mt-1 text-sm text-muted-foreground">Defina um ponto de partida reutilizável para o planejamento das ações de trade.</p></div></div>
      <Button type="button" className="bg-primary" onClick={() => { setForm(blankForm()); setOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Novo modelo</Button>
    </div>
    {isLoading ? <div className="grid min-h-52 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : templates.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{templates.map(template => <Card key={template.id} className="overflow-hidden border-border shadow-sm"><CardContent className="p-0"><div className="border-b border-primary/10 bg-primary/5 p-4"><div className="flex items-start justify-between gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><ClipboardList className="h-5 w-5" /></span><Badge variant="outline" className={template.active ? "border-primary/25 bg-primary/10 text-primary" : "text-muted-foreground"}>{template.active ? "Ativo" : "Inativo"}</Badge></div><h2 className="mt-4 break-words text-base font-semibold text-foreground">{template.name}</h2><p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{template.description || "Sem descrição complementar."}</p></div><div className="space-y-3 p-4"><div className="grid gap-2 text-xs"><p><span className="font-semibold text-muted-foreground">Tipo: </span>{template.actionTypeName || "A definir no planejamento"}</p><p><span className="font-semibold text-muted-foreground">Modalidade: </span>{partnershipLabel(template.defaultPartnershipType)}</p><p><span className="font-semibold text-muted-foreground">Duração padrão: </span>{template.defaultDurationHours ? `${template.defaultDurationHours} h` : "A definir no planejamento"}</p></div><p className="line-clamp-3 min-h-14 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-xs leading-5 text-foreground">{template.objective || "Objetivo a definir no planejamento."}</p><div className="flex justify-end gap-2 border-t border-border pt-3"><Button type="button" variant="outline" size="sm" onClick={() => edit(template)}><Edit3 className="mr-1.5 h-3.5 w-3.5" /> Editar</Button><Button type="button" variant="outline" size="icon" aria-label={`Excluir ${template.name}`} disabled={deleteMutation.isPending} onClick={() => { if (window.confirm(`Excluir o modelo “${template.name}”?`)) deleteMutation.mutate({ id: template.id }); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></div></div></CardContent></Card>)}</div> : <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><ClipboardList className="mx-auto h-8 w-8 text-primary" /><h2 className="mt-4 font-semibold text-foreground">Nenhum modelo cadastrado</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Crie um modelo para reutilizar tipo, objetivo, modalidade e duração em novos planejamentos.</p><Button type="button" className="mt-5 bg-primary" onClick={() => { setForm(blankForm()); setOpen(true); }}>Criar primeiro modelo</Button></div>}
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) setForm(blankForm()); }}><DialogContent className="max-h-[90vh] w-[calc(100vw-1.25rem)] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{form.id ? "Editar modelo de ação" : "Novo modelo de ação"}</DialogTitle><DialogDescription>Os campos deste modelo serão sugeridos ao planejar uma nova Ação e continuarão editáveis.</DialogDescription></DialogHeader><form onSubmit={event => { event.preventDefault(); save(); }} className="grid gap-4"><div className="grid gap-4 sm:grid-cols-2"><Label className="grid gap-1.5">Nome do modelo<Input required value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder="Ex.: Panfletagem em loja" /></Label><Label className="grid gap-1.5">Duração padrão (horas)<Input type="number" min="1" max={24 * 30} step="1" value={form.defaultDurationHours} onChange={event => setForm(current => ({ ...current, defaultDurationHours: event.target.value }))} placeholder="Ex.: 6" /></Label></div><Label className="grid gap-1.5">Descrição<Textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="Quando este modelo deve ser utilizado?" /></Label><Label className="grid gap-1.5">Objetivo padrão<Textarea value={form.objective} onChange={event => setForm(current => ({ ...current, objective: event.target.value }))} placeholder="Objetivo que poderá ser ajustado na Ação" /></Label><div className="grid gap-4 sm:grid-cols-2"><SearchableMultiSelect id="action-template-type" label="Tipo de ação padrão" maxSelections={1} options={(referenceData?.actionTypes ?? []).map(type => ({ id: type.id, label: type.name }))} values={form.defaultActionTypeId ? [form.defaultActionTypeId] : []} onChange={ids => setForm(current => ({ ...current, defaultActionTypeId: ids[0] ? Number(ids[0]) : null }))} placeholder="Definir no planejamento" /><SearchableMultiSelect id="action-template-partnership" label="Modalidade padrão" maxSelections={1} options={partnershipOptions} values={[partnershipId(form.defaultPartnershipType)]} onChange={ids => ids[0] && setForm(current => ({ ...current, defaultPartnershipType: (partnershipOptions.find(option => option.id === Number(ids[0]))?.value ?? "paid") as TemplateForm["defaultPartnershipType"] }))} placeholder="Selecionar modalidade" /></div><label className="flex items-center gap-2 text-sm font-medium text-foreground"><input type="checkbox" checked={form.active} onChange={event => setForm(current => ({ ...current, active: event.target.checked }))} /> Modelo ativo</label><div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" className="bg-primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar modelo"}</Button></div></form></DialogContent></Dialog>
  </main>;
}
