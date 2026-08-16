import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Building2, ChevronRight, Eye, EyeOff, Loader2, Network, UserCog, UserRound, UsersRound } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const roleLabel: Record<string, string> = {
  admin: "Administrador",
  regional_manager: "Gestor regional",
  operator: "Operador",
  team_member: "Membro de equipe",
  viewer: "Visualizador",
  user: "Usuário",
};

const moduleLabels: Record<string, string> = { dashboard: "Visão geral", settings: "Configurações", inventory: "Estoque", finance: "Financeiro", media: "Mídias", actions: "Ações", events: "Eventos", operations: "Operações", documents: "Documentos", map: "Mapa", notifications: "Notificações" };

type TeamUser = {
  id: number;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  jobTitle: string | null;
  role: string;
  managerUserId: number | null;
  isActive: boolean;
};

function Avatar({ user }: { user: TeamUser }) {
  return <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-primary">{user.avatarUrl ? <img src={user.avatarUrl} alt={`Foto de ${user.name || "usuário"}`} className="h-full w-full object-contain" /> : <UserRound className="h-4 w-4" />}</span>;
}

export default function TeamsWorkspace() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [expandedModuleUserId, setExpandedModuleUserId] = useState<number | null>(null);
  const users = trpc.users.adminList.useQuery();
  const moduleSettings = trpc.users.adminModuleSettings.useQuery();
  const setUserManager = trpc.users.setUserManager.useMutation({
    onSuccess: () => { utils.users.adminList.invalidate(); toast.success("Gestor da equipe atualizado."); },
    onError: error => toast.error(error.message),
  });
  const setUserModuleEnabled = trpc.users.setUserModuleEnabled.useMutation({
    onSuccess: () => { utils.users.adminModuleSettings.invalidate(); toast.success("Visibilidade do módulo atualizada."); },
    onError: error => toast.error(error.message),
  });
  const activeUsers = useMemo(() => (users.data ?? []).filter(user => user.isActive) as TeamUser[], [users.data]);
  const usersById = useMemo(() => new Map(activeUsers.map(user => [user.id, user])), [activeUsers]);
  const membersByManager = useMemo(() => activeUsers.reduce<Map<number, TeamUser[]>>((acc, user) => {
    if (user.managerUserId) (acc.get(user.managerUserId) ?? acc.set(user.managerUserId, []).get(user.managerUserId)!).push(user);
    return acc;
  }, new Map()), [activeUsers]);
  const rootUsers = activeUsers.filter(user => !user.managerUserId || !usersById.has(user.managerUserId));
  const moduleSettingsByUser = useMemo(() => new Map((moduleSettings.data ?? []).map(setting => [`${setting.userId}:${setting.module}`, setting.enabled])), [moduleSettings.data]);

  if (users.isLoading) return <div className="grid min-h-[340px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const renderPerson = (user: TeamUser, depth = 0, lineage = new Set<number>()): ReactNode => {
    if (lineage.has(user.id)) return null;
    const nextLineage = new Set(lineage); nextLineage.add(user.id);
    const members = membersByManager.get(user.id) ?? [];
    return <li key={user.id} className={depth ? "relative ml-4 border-l border-primary/25 pl-4 sm:ml-7" : ""}>
      {depth > 0 && <span className="absolute -left-px top-7 h-px w-4 bg-primary/25 sm:w-7" />}
      <article className="rounded-xl border border-border bg-card p-4 shadow-sm"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-center gap-3"><Avatar user={user} /><div className="min-w-0"><p className="truncate font-semibold text-foreground">{user.name || "Nome não informado"}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{user.jobTitle || roleLabel[user.role] || "Usuário"}</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary">{roleLabel[user.role] || "Usuário"}</Badge><Badge variant="outline" className="border-border text-muted-foreground">{members.length} {members.length === 1 ? "colaborador" : "colaboradores"}</Badge></div></div></div><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><label className="sr-only">Gestor direto<select aria-label={`Gestor direto de ${user.name || "usuário"}`} value={user.managerUserId ?? "none"} disabled={setUserManager.isPending} onChange={event => setUserManager.mutate({ userId: user.id, managerUserId: event.target.value === "none" ? null : Number(event.target.value) })} className="mt-1 block h-9 min-w-52 rounded-md border border-input bg-background px-2 text-sm text-foreground"><option value="none">Sem gestor definido</option>{activeUsers.filter(candidate => candidate.id !== user.id).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name || candidate.email || `Usuário ${candidate.id}`}</option>)}</select></label><Button type="button" variant="outline" className="border-border" onClick={() => setExpandedModuleUserId(expandedModuleUserId === user.id ? null : user.id)}><Eye className="mr-1.5 h-4 w-4" />Módulos</Button><Button type="button" variant="outline" className="border-border" onClick={() => setLocation("/usuarios")}><UserCog className="mr-1.5 h-4 w-4" />Editar perfil</Button></div></div>{expandedModuleUserId === user.id && <div className="mt-4 border-t border-border pt-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Visibilidade no menu</p><p className="mt-1 text-xs leading-5 text-muted-foreground">A pessoa só verá módulos habilitados aqui e autorizados pelas permissões do seu papel.</p><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(moduleLabels).map(([module, label]) => { const enabled = moduleSettingsByUser.get(`${user.id}:${module}`) ?? true; return <div key={module} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2"><span className="text-sm font-medium text-foreground">{label}</span><Button type="button" size="sm" disabled={setUserModuleEnabled.isPending} variant={enabled ? "outline" : "default"} className={enabled ? "border-border" : "bg-primary text-primary-foreground hover:bg-primary/90"} onClick={() => setUserModuleEnabled.mutate({ userId: user.id, module: module as never, enabled: !enabled })}>{enabled ? <><EyeOff className="mr-1.5 h-3.5 w-3.5" />Ocultar</> : <><Eye className="mr-1.5 h-3.5 w-3.5" />Exibir</>}</Button></div>; })}</div></div>}</article>
      {members.length > 0 && <ul className="mt-3 space-y-3">{members.map(member => renderPerson(member, depth + 1, nextLineage))}</ul>}
    </li>;
  };

  return <div className="mx-auto max-w-6xl space-y-6"><header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between"><div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><Network className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">Administração da organização</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Equipes</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Organize a cadeia de gestão do Cluster MG, relacione responsáveis e acompanhe a estrutura operacional em um único painel.</p></div></div><Button type="button" variant="outline" className="border-border" onClick={() => setLocation("/usuarios")}><UsersRound className="mr-2 h-4 w-4" />Usuários e permissões</Button></header>
    <section className="rounded-2xl border border-border bg-secondary/35 p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-4.5 w-4.5" /></span><div><p className="font-semibold text-foreground">Como funciona a hierarquia</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Cada pessoa pode ter um gestor direto. A atribuição é registrada no cadastro do usuário e aparece aqui como uma estrutura de equipe. Contas inativas são omitidas do organograma.</p></div></div></section>
    {rootUsers.length ? <section className="rounded-2xl border border-border bg-background p-4 shadow-sm sm:p-5"><div className="mb-5 flex items-center gap-2"><ChevronRight className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-semibold text-foreground">Organograma atual</h2></div><ul className="space-y-4">{rootUsers.map(user => renderPerson(user))}</ul></section> : <section className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><UsersRound className="mx-auto h-8 w-8 text-primary" /><p className="mt-3 font-semibold text-foreground">Nenhuma pessoa ativa encontrada</p><p className="mt-1 text-sm text-muted-foreground">Crie ou reative usuários para estruturar a equipe.</p><Button type="button" className="mt-5 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setLocation("/usuarios")}>Abrir usuários e permissões</Button></section>}</div>;
}
