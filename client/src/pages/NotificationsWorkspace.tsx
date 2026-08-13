import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { BellRing, CheckCheck, FilterX, Loader2, MapPin, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const categoryLabels = {
  campaign_expiry: "Vencimento de mídia",
  payment_due: "Pagamento pendente",
  action_pending: "Ação pendente",
  stock_minimum: "Estoque mínimo",
} as const;

type FilterState = { userId?: number; regionalId?: number; cityId?: number; category?: keyof typeof categoryLabels; unreadOnly: boolean };
const initialFilters: FilterState = { unreadOnly: false };

function selectedNumber(value: string) { return value === "all" ? undefined : Number(value); }

export default function NotificationsWorkspace() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const input = useMemo(() => ({ ...filters, limit: 100 }), [filters]);
  const utils = trpc.useUtils();
  const notificationsQuery = trpc.notifications.list.useQuery(input);
  const referencesQuery = trpc.notifications.referenceData.useQuery(undefined, { enabled: isAdmin });
  const markRead = trpc.notifications.markRead.useMutation({
    onSuccess: () => utils.notifications.list.invalidate(),
    onError: error => toast.error(error.message),
  });
  const cities = (referencesQuery.data?.cities ?? []).filter(city => !filters.regionalId || city.regionalId === filters.regionalId);
  const unreadCount = (notificationsQuery.data ?? []).filter(notification => !notification.readAt).length;

  return <div className="mx-auto max-w-6xl">
    <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><BellRing className="h-5 w-5" /></span>
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Central de acompanhamento</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Notificações</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{isAdmin ? "Acompanhe alertas operacionais de toda a equipe e filtre por pessoa ou território." : "Acompanhe os alertas direcionados a você e aos territórios sob sua responsabilidade."}</p></div>
      </div>
      <Badge className="w-fit rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent">{unreadCount} não {unreadCount === 1 ? "lida" : "lidas"}</Badge>
    </header>

    <section className="mt-6 rounded-2xl border border-border bg-card p-4 shadow-sm" aria-label="Filtros de notificações">
      <div className={`grid gap-3 ${isAdmin ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {isAdmin && <><div><Label htmlFor="notification-user">Usuário</Label><Select value={filters.userId?.toString() ?? "all"} onValueChange={value => setFilters(current => ({ ...current, userId: selectedNumber(value) }))}><SelectTrigger id="notification-user" className="mt-1.5 bg-background"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os usuários</SelectItem>{(referencesQuery.data?.users ?? []).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name || item.email || `Usuário #${item.id}`}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="notification-regional">Regional</Label><Select value={filters.regionalId?.toString() ?? "all"} onValueChange={value => setFilters(current => ({ ...current, regionalId: selectedNumber(value), cityId: undefined }))}><SelectTrigger id="notification-regional" className="mt-1.5 bg-background"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as regionais</SelectItem>{(referencesQuery.data?.regionals ?? []).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="notification-city">Cidade</Label><Select value={filters.cityId?.toString() ?? "all"} onValueChange={value => setFilters(current => ({ ...current, cityId: selectedNumber(value) }))}><SelectTrigger id="notification-city" className="mt-1.5 bg-background"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as cidades</SelectItem>{cities.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name} · {item.state}</SelectItem>)}</SelectContent></Select></div></>}
        <div><Label htmlFor="notification-category">Categoria</Label><Select value={filters.category ?? "all"} onValueChange={value => setFilters(current => ({ ...current, category: value === "all" ? undefined : value as keyof typeof categoryLabels }))}><SelectTrigger id="notification-category" className="mt-1.5 bg-background"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas as categorias</SelectItem>{Object.entries(categoryLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex items-end"><label className="flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm text-foreground"><Checkbox checked={filters.unreadOnly} onCheckedChange={checked => setFilters(current => ({ ...current, unreadOnly: checked === true }))} /> Apenas não lidas</label></div>
        <div className="flex items-end"><Button variant="outline" onClick={() => setFilters(initialFilters)} className="h-10 w-full rounded-lg border-border text-xs text-primary"><FilterX className="mr-1.5 h-3.5 w-3.5" /> Limpar filtros</Button></div>
      </div>
    </section>

    <section className="mt-5" aria-live="polite">
      {notificationsQuery.isLoading && <div className="grid min-h-48 place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
      {!notificationsQuery.isLoading && (notificationsQuery.data?.length ?? 0) === 0 && <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><BellRing className="mx-auto h-7 w-7 text-muted-foreground" /><h2 className="mt-4 font-display text-lg font-semibold text-foreground">Nenhuma notificação encontrada</h2><p className="mt-2 text-sm text-muted-foreground">Ajuste os filtros ou aguarde os próximos alertas operacionais.</p></div>}
      <div className="grid gap-3">{(notificationsQuery.data ?? []).map(notification => {
        const territory = notification.cityName ? `${notification.cityName}${notification.cityState ? ` · ${notification.cityState}` : ""}` : notification.regionalName;
        const recipient = notification.userName || notification.userEmail;
        return <article key={notification.id} className={`flex flex-col gap-4 rounded-2xl border p-5 shadow-sm transition sm:flex-row sm:items-start sm:justify-between ${notification.readAt ? "border-border bg-card" : "border-primary/25 bg-primary/[0.045]"}`}>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full border-border bg-card text-[11px] font-semibold text-muted-foreground">{categoryLabels[notification.category]}</Badge>{!notification.readAt && <Badge className="rounded-full bg-primary text-[11px] text-primary-foreground">Nova</Badge>}</div><h2 className="mt-3 font-display text-lg font-semibold text-foreground">{notification.title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{notification.message}</p><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">{recipient && <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />{recipient}</span>}{territory && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{territory}</span>}<span>{new Date(notification.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span></div></div>
          {!notification.readAt && <Button variant="outline" size="sm" disabled={markRead.isPending} onClick={() => markRead.mutate({ notificationId: notification.id })} className="shrink-0 rounded-lg border-border text-xs text-primary"><CheckCheck className="mr-1.5 h-3.5 w-3.5" /> Marcar como lida</Button>}
        </article>;
      })}</div>
    </section>
  </div>;
}
