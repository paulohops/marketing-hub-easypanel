import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import { BellRing, Building2, Check, ChevronRight, Globe2, Loader2, Mail, MapPin, Pencil, Plus, Save, ShieldCheck, Trash2, UserRound, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type RecipientType = "user" | "regional" | "city" | "company";
type Recipient = { type: RecipientType; id: number };

type Draft = {
  id?: number;
  name: string;
  description: string;
  entityType: string;
  eventType: "created" | "updated" | "status_changed" | "deleted" | "due" | "expiry" | "*";
  titleTemplate: string;
  messageTemplate: string;
  category: "campaign_expiry" | "payment_due" | "action_pending" | "stock_minimum" | "entity_created" | "entity_updated" | "entity_status_changed" | "entity_deleted" | "task_assigned" | "task_due";
  active: boolean;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  excludeActor: boolean;
  recipients: Recipient[];
};

const eventLabels: Record<Draft["eventType"], string> = { created: "Registro criado", updated: "Registro alterado", status_changed: "Status alterado", deleted: "Registro excluído", due: "Prazo vencendo", expiry: "Vencimento próximo", "*": "Qualquer evento" };
const categoryLabels: Record<Draft["category"], string> = { campaign_expiry: "Vencimento de mídia", payment_due: "Pagamento pendente", action_pending: "Ação pendente", stock_minimum: "Estoque mínimo", entity_created: "Novo registro", entity_updated: "Registro atualizado", entity_status_changed: "Mudança de status", entity_deleted: "Registro excluído", task_assigned: "Tarefa atribuída", task_due: "Tarefa vencendo" };
const recipientLabels: Record<RecipientType, string> = { user: "Usuário", regional: "Regional", city: "Cidade", company: "Empresa" };

const emptyDraft: Draft = { name: "", description: "", entityType: "media_campaign", eventType: "created", titleTemplate: "Novo registro: {{entity}}", messageTemplate: "O registro {{entity}} #{{entityId}} foi criado e precisa ser acompanhado.", category: "entity_created", active: true, inAppEnabled: true, emailEnabled: false, excludeActor: true, recipients: [] };

function recipientIcon(type: RecipientType) {
  if (type === "user") return UserRound;
  if (type === "regional") return MapPin;
  if (type === "city") return Globe2;
  return Building2;
}

export default function NotificationSettingsWorkspace() {
  const { can } = useEffectivePermissions();
  const canWrite = can("settings.write");
  const referencesQuery = trpc.settings.notificationRules.referenceData.useQuery();
  const rulesQuery = trpc.settings.notificationRules.listRules.useQuery();
  const utils = trpc.useUtils();
  const saveRule = trpc.settings.notificationRules.saveRule.useMutation({ onSuccess: () => { toast.success("Regra de notificação salva."); setOpen(false); void utils.settings.notificationRules.listRules.invalidate(); }, onError: error => toast.error(error.message) });
  const setRuleActive = trpc.settings.notificationRules.setRuleActive.useMutation({ onSuccess: () => { toast.success("Status da regra atualizado."); void utils.settings.notificationRules.listRules.invalidate(); }, onError: error => toast.error(error.message) });
  const deleteRule = trpc.settings.notificationRules.deleteRule.useMutation({ onSuccess: () => { toast.success("Regra excluída."); void utils.settings.notificationRules.listRules.invalidate(); }, onError: error => toast.error(error.message) });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [recipientType, setRecipientType] = useState<RecipientType>("user");
  const [recipientId, setRecipientId] = useState("");
  const references = referencesQuery.data;
  const entityLabel = useMemo(() => new Map<string, string>((references?.entityOptions ?? []).map(item => [item.value, item.label])), [references?.entityOptions]);

  const recipientOptions = recipientType === "user" ? (references?.users ?? []).map(item => ({ id: item.id, label: item.name || item.email || `Usuário #${item.id}` }))
    : recipientType === "regional" ? (references?.regionals ?? []).map(item => ({ id: item.id, label: item.name }))
      : recipientType === "city" ? (references?.cities ?? []).map(item => ({ id: item.id, label: `${item.name} · ${item.state}` }))
        : (references?.companies ?? []).map(item => ({ id: item.id, label: `${item.name} · ${item.code}` }));

  function updateDraft(values: Partial<Draft>) { setDraft(current => ({ ...current, ...values })); }
  function openCreate() { setDraft({ ...emptyDraft, recipients: [] }); setRecipientType("user"); setRecipientId(""); setOpen(true); }
  function openEdit(rule: NonNullable<typeof rulesQuery.data>[number]) {
    setDraft({ id: rule.id, name: rule.name, description: rule.description ?? "", entityType: rule.entityType, eventType: rule.eventType as Draft["eventType"], titleTemplate: rule.titleTemplate, messageTemplate: rule.messageTemplate, category: rule.category as Draft["category"], active: rule.active, inAppEnabled: rule.inAppEnabled, emailEnabled: rule.emailEnabled, excludeActor: rule.excludeActor, recipients: rule.recipients });
    setRecipientType("user"); setRecipientId(""); setOpen(true);
  }
  function addRecipient() {
    const id = Number(recipientId);
    if (!id || draft.recipients.some(item => item.type === recipientType && item.id === id)) return;
    setDraft(current => ({ ...current, recipients: [...current.recipients, { type: recipientType, id }] }));
    setRecipientId("");
  }
  function save() {
    if (!draft.recipients.length) { toast.error("Adicione ao menos um destinatário."); return; }
    saveRule.mutate(draft);
  }
  function recipientName(recipient: Recipient) {
    if (recipient.type === "user") {
      const item = references?.users.find(candidate => candidate.id === recipient.id);
      return item?.name || item?.email || `${recipientLabels.user} #${recipient.id}`;
    }
    if (recipient.type === "regional") {
      const item = references?.regionals.find(candidate => candidate.id === recipient.id);
      return item?.name || `${recipientLabels.regional} #${recipient.id}`;
    }
    if (recipient.type === "city") {
      const item = references?.cities.find(candidate => candidate.id === recipient.id);
      return item ? `${item.name} · ${item.state}` : `${recipientLabels.city} #${recipient.id}`;
    }
    const item = references?.companies.find(candidate => candidate.id === recipient.id);
    return item ? `${item.name} · ${item.code}` : `${recipientLabels.company} #${recipient.id}`;
  }
  const rules = rulesQuery.data ?? [];
  const activeCount = rules.filter(rule => rule.active).length;
  const emailCount = rules.filter(rule => rule.emailEnabled).length;

  return <div className="mx-auto max-w-6xl">
    <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><BellRing className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Governança operacional</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Central de notificações</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Defina quais eventos geram alertas, quem deve recebê-los e em quais canais, sem depender de ajustes manuais em cada módulo.</p></div></div>
      {canWrite && <Button onClick={openCreate} className="rounded-xl"><Plus className="mr-2 h-4 w-4" /> Nova regra</Button>}
    </header>

    <section className="mt-6 grid gap-3 sm:grid-cols-3"><Card className="rounded-2xl border-border shadow-sm"><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-medium text-muted-foreground">Regras cadastradas</p><p className="mt-1 font-display text-2xl font-semibold text-foreground">{rules.length}</p></div><ShieldCheck className="h-5 w-5 text-primary" /></CardContent></Card><Card className="rounded-2xl border-border shadow-sm"><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-medium text-muted-foreground">Regras ativas</p><p className="mt-1 font-display text-2xl font-semibold text-foreground">{activeCount}</p></div><Check className="h-5 w-5 text-emerald-600" /></CardContent></Card><Card className="rounded-2xl border-border shadow-sm"><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-medium text-muted-foreground">Com e-mail habilitado</p><p className="mt-1 font-display text-2xl font-semibold text-foreground">{emailCount}</p></div><Mail className="h-5 w-5 text-primary" /></CardContent></Card></section>

    <section className="mt-6 rounded-2xl border border-primary/15 bg-primary/[0.045] p-5"><div className="flex gap-3"><UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><h2 className="font-display text-base font-semibold text-foreground">Destinatários por escopo</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Uma regra pode entregar o mesmo evento a usuários específicos, responsáveis por uma regional, pessoas vinculadas a uma cidade ou usuários relacionados à empresa. Os destinatários são deduplicados automaticamente.</p></div></div></section>

    <section className="mt-6 space-y-3" aria-live="polite">
      {rulesQuery.isLoading && <div className="grid min-h-48 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
      {!rulesQuery.isLoading && !rules.length && <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><BellRing className="mx-auto h-7 w-7 text-muted-foreground" /><h2 className="mt-4 font-display text-lg font-semibold text-foreground">Nenhuma regra configurada</h2><p className="mt-2 text-sm text-muted-foreground">Comece definindo um evento de campanha, mídia, veiculação, tarefa, estoque ou financeiro.</p>{canWrite && <Button onClick={openCreate} variant="outline" className="mt-5 rounded-xl border-border text-primary"><Plus className="mr-2 h-4 w-4" /> Criar primeira regra</Button>}</div>}
      {rules.map(rule => <Card key={rule.id} className={`rounded-2xl border-border shadow-sm transition ${rule.active ? "bg-card" : "bg-muted/30 opacity-80"}`}><CardHeader className="gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge className={rule.active ? "rounded-full bg-primary/10 text-primary hover:bg-primary/10" : "rounded-full bg-muted text-muted-foreground hover:bg-muted"}>{rule.active ? "Ativa" : "Pausada"}</Badge><Badge variant="outline" className="rounded-full border-border">{categoryLabels[rule.category as Draft["category"]] ?? rule.category}</Badge></div><CardTitle className="mt-2 font-display text-lg">{rule.name}</CardTitle><CardDescription className="mt-1">{entityLabel.get(rule.entityType) ?? rule.entityType} · {eventLabels[rule.eventType as Draft["eventType"]] ?? rule.eventType}</CardDescription></div><div className="flex shrink-0 gap-2">{canWrite && <><Button variant="outline" size="sm" onClick={() => setRuleActive.mutate({ id: rule.id, active: !rule.active })} disabled={setRuleActive.isPending} className="rounded-lg border-border text-xs">{rule.active ? "Pausar" : "Ativar"}</Button><Button variant="outline" size="icon" onClick={() => openEdit(rule)} className="rounded-lg border-border" aria-label={`Editar ${rule.name}`}><Pencil className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => { if (window.confirm(`Excluir a regra “${rule.name}”? Esta ação não pode ser desfeita.`)) deleteRule.mutate({ id: rule.id }); }} disabled={deleteRule.isPending} className="rounded-lg border-border text-destructive" aria-label={`Excluir ${rule.name}`}><Trash2 className="h-4 w-4" /></Button></>}</div></CardHeader><CardContent className="space-y-4 pt-0"><div className="grid gap-3 md:grid-cols-[1.3fr_1fr]"><div className="rounded-xl border border-border bg-background/60 p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Mensagem</p><p className="mt-2 text-sm font-medium text-foreground">{rule.titleTemplate}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{rule.messageTemplate}</p></div><div className="rounded-xl border border-border bg-background/60 p-3"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Destinatários</p><div className="mt-2 flex flex-wrap gap-1.5">{rule.recipients.map((recipient, index) => { const Icon = recipientIcon(recipient.type); return <Badge key={`${recipient.type}-${recipient.id}-${index}`} variant="outline" className="rounded-full border-border text-xs"><Icon className="mr-1 h-3 w-3" />{recipientName(recipient)}</Badge>; })}</div><div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><BellRing className="h-3 w-3" />{rule.inAppEnabled ? "In-app" : "Sem in-app"}</span><span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{rule.emailEnabled ? "E-mail" : "Sem e-mail"}</span></div></div></div></CardContent></Card>)}
    </section>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{draft.id ? "Editar regra de notificação" : "Nova regra de notificação"}</DialogTitle><DialogDescription>Escolha o evento, personalize a mensagem e adicione um ou mais escopos de destinatários.</DialogDescription></DialogHeader><div className="grid gap-5 py-2"><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Label htmlFor="rule-name">Nome da regra</Label><Input id="rule-name" value={draft.name} onChange={event => updateDraft({ name: event.target.value })} placeholder="Ex.: Supervisores avisados sobre novas veiculações" className="mt-1.5" /></div><div><Label htmlFor="rule-entity">Módulo / registro</Label><Select value={draft.entityType} onValueChange={entityType => updateDraft({ entityType })}><SelectTrigger id="rule-entity" className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{(references?.entityOptions ?? []).map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="rule-event">Gatilho</Label><Select value={draft.eventType} onValueChange={eventType => updateDraft({ eventType: eventType as Draft["eventType"] })}><SelectTrigger id="rule-event" className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{(references?.eventTypes ?? []).map(item => <SelectItem key={item} value={item}>{eventLabels[item as Draft["eventType"]]}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="rule-category">Categoria da notificação</Label><Select value={draft.category} onValueChange={category => updateDraft({ category: category as Draft["category"] })}><SelectTrigger id="rule-category" className="mt-1.5"><SelectValue /></SelectTrigger><SelectContent>{(references?.categories ?? []).map(item => <SelectItem key={item} value={item}>{categoryLabels[item as Draft["category"]] ?? item}</SelectItem>)}</SelectContent></Select></div><div className="flex items-end"><label className="flex min-h-10 w-full items-center gap-2 rounded-lg border border-input px-3 text-sm"><Checkbox checked={draft.excludeActor} onCheckedChange={checked => updateDraft({ excludeActor: checked === true })} /> Não notificar quem realizou a ação</label></div></div><div><Label htmlFor="rule-title">Título com variáveis</Label><Input id="rule-title" value={draft.titleTemplate} onChange={event => updateDraft({ titleTemplate: event.target.value })} placeholder="Novo registro: {{entity}}" className="mt-1.5" /><p className="mt-1 text-xs text-muted-foreground">Variáveis disponíveis: <code>{"{{entity}}"}</code>, <code>{"{{entityId}}"}</code>, <code>{"{{action}}"}</code>.</p></div><div><Label htmlFor="rule-message">Mensagem</Label><Textarea id="rule-message" value={draft.messageTemplate} onChange={event => updateDraft({ messageTemplate: event.target.value })} rows={3} className="mt-1.5" placeholder="O registro {{entity}} #{{entityId}} foi criado." /></div><div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm"><Checkbox checked={draft.inAppEnabled} onCheckedChange={checked => updateDraft({ inAppEnabled: checked === true })} /><span><strong className="font-medium">Notificação in-app</strong><span className="block text-xs text-muted-foreground">Aparece na central operacional.</span></span></label><label className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm"><Checkbox checked={draft.emailEnabled} onCheckedChange={checked => updateDraft({ emailEnabled: checked === true })} /><span><strong className="font-medium">E-mail</strong><span className="block text-xs text-muted-foreground">Usa o SMTP configurado no sistema.</span></span></label></div><div className="rounded-2xl border border-border bg-muted/20 p-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-display text-sm font-semibold">Destinatários</h3><p className="mt-1 text-xs text-muted-foreground">Combine usuários e escopos. A mesma pessoa receberá apenas uma cópia.</p></div><Badge variant="outline" className="rounded-full">{draft.recipients.length} selecionado{draft.recipients.length === 1 ? "" : "s"}</Badge></div><div className="mt-4 grid gap-3 sm:grid-cols-[150px_1fr_auto]"><Select value={recipientType} onValueChange={value => { setRecipientType(value as RecipientType); setRecipientId(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(recipientLabels) as RecipientType[]).map(type => <SelectItem key={type} value={type}>{recipientLabels[type]}</SelectItem>)}</SelectContent></Select><Select value={recipientId || "none"} onValueChange={value => setRecipientId(value === "none" ? "" : value)}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent><SelectItem value="none">Selecione um destinatário</SelectItem>{recipientOptions.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.label}</SelectItem>)}</SelectContent></Select><Button type="button" variant="outline" onClick={addRecipient} className="rounded-lg border-border text-primary"><Plus className="mr-1.5 h-4 w-4" /> Adicionar</Button></div><div className="mt-3 flex flex-wrap gap-2">{draft.recipients.map((recipient, index) => { const Icon = recipientIcon(recipient.type); return <Badge key={`${recipient.type}-${recipient.id}-${index}`} variant="secondary" className="rounded-full pr-1"><Icon className="mr-1 h-3 w-3" />{recipientName(recipient)}<button type="button" className="ml-1 rounded-full p-0.5 hover:bg-background" aria-label={`Remover ${recipientName(recipient)}`} onClick={() => setDraft(current => ({ ...current, recipients: current.recipients.filter((_, currentIndex) => currentIndex !== index) }))}>×</button></Badge>; })}</div></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)} className="rounded-lg border-border">Cancelar</Button><Button onClick={save} disabled={saveRule.isPending || !canWrite} className="rounded-lg"><Save className="mr-2 h-4 w-4" />{saveRule.isPending ? "Salvando..." : "Salvar regra"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
