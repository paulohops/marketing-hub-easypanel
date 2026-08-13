import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import { CalendarClock, ExternalLink, LayoutDashboard, Loader2, RefreshCw, Save, Settings2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function TrelloWorkspace() {
  const utils = trpc.useUtils();
  const { can, isLoading: permissionsLoading } = useEffectivePermissions();
  const configuration = trpc.settings.getTrelloConfiguration.useQuery();
  const boardQuery = trpc.trello.currentBoard.useQuery(undefined, { staleTime: 60_000 });
  const [draftUrl, setDraftUrl] = useState("");
  const [isConfigurationOpen, setIsConfigurationOpen] = useState(false);
  const canConfigure = can("settings.write");

  useEffect(() => {
    if (configuration.data) setDraftUrl(configuration.data.url);
  }, [configuration.data]);

  const updateConfiguration = trpc.settings.updateTrelloConfiguration.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.settings.getTrelloConfiguration.invalidate(), utils.trello.currentBoard.invalidate()]);
      toast.success("Integração do Trello atualizada.");
    },
    onError: error => toast.error(error.message),
  });

  if (configuration.isLoading || boardQuery.isLoading || permissionsLoading) {
    return <div className="grid min-h-[320px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const boardState = boardQuery.data;
  const syncedBoard = boardState?.status === "ready" ? boardState.board : null;
  const boardUrl = syncedBoard?.url ?? boardState?.boardUrl ?? configuration.data?.url ?? "";
  const boardSource = boardState?.source ?? configuration.data?.source ?? "none";

  return <div className="mx-auto max-w-7xl space-y-5">
    <header className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><LayoutDashboard className="h-5 w-5" /></span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Gestão integrada</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Trello</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Consulte os cartões abertos do quadro conectado ao Trade HUB, sem depender de incorporação bloqueada.</p>
            {boardSource === "personal" ? <span className="mt-3 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">Quadro exclusivo atribuído a você</span> : boardSource === "shared" ? <span className="mt-3 inline-flex rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-primary">Quadro compartilhado da equipe</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {syncedBoard ? <Button type="button" variant="outline" size="sm" onClick={() => void boardQuery.refetch()} disabled={boardQuery.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${boardQuery.isFetching ? "animate-spin" : ""}`} />Atualizar</Button> : null}
          {boardUrl ? <a href={boardUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent"><ExternalLink className="mr-2 h-4 w-4" />Abrir no Trello</a> : null}
        </div>
      </div>
    </header>

    {canConfigure ? <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex gap-3"><Settings2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><h2 className="font-display text-lg font-semibold text-foreground">Configurar quadro compartilhado</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Defina o quadro padrão do time. Quadros específicos podem ser atribuídos a cada funcionário em Usuários e permissões e sempre terão prioridade para a pessoa vinculada.</p><Button type="button" variant="outline" className="mt-4" onClick={() => setIsConfigurationOpen(true)}><Settings2 className="mr-2 h-4 w-4" />{boardUrl ? "Editar quadro padrão" : "Conectar quadro padrão"}</Button></div></div></section> : null}

    {syncedBoard ? <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Quadro sincronizado</p><h2 className="mt-1 font-display text-2xl font-semibold text-foreground">{syncedBoard.name}</h2>{syncedBoard.description ? <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-6 text-muted-foreground">{syncedBoard.description}</p> : null}</div><div className="rounded-xl bg-secondary px-3 py-2 text-sm font-semibold text-primary">{syncedBoard.cardCount} cartões abertos</div></div>
      <div className="mt-5 grid gap-4 xl:grid-cols-3">{syncedBoard.lists.map(list => <article key={list.id} className="min-w-0 rounded-xl border border-border bg-background/50 p-3"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="truncate text-sm font-semibold text-foreground">{list.name}</h3><span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-primary">{list.cards.length}</span></div><div className="space-y-2">{list.cards.length ? list.cards.map(card => <a key={card.id} href={card.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-border bg-card p-3 transition hover:border-primary/40 hover:bg-secondary/40"><p className="line-clamp-2 text-sm font-medium text-foreground">{card.name}</p>{card.labels.length ? <div className="mt-2 flex flex-wrap gap-1">{card.labels.map(label => <span key={label.id} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{label.name}</span>)}</div> : null}{card.due ? <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" />{card.dueComplete ? "Concluído em " : "Entrega em "}{new Date(card.due).toLocaleDateString("pt-BR")}</p> : null}</a>) : <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">Nenhum cartão aberto</p>}</div></article>)}</div>
      {syncedBoard.lastActivityAt ? <p className="mt-5 text-xs text-muted-foreground">Última atividade no quadro: {new Date(syncedBoard.lastActivityAt).toLocaleString("pt-BR")}. A atualização exibe até 200 cartões abertos.</p> : null}
    </section> : boardUrl ? <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"><div className="mx-auto max-w-2xl text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><ShieldCheck className="h-6 w-6" /></span><h2 className="mt-4 font-display text-xl font-semibold text-foreground">Quadro disponível fora do sistema</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{boardState?.status === "unauthorized" || boardState?.status === "not_found" ? "A conta conectada à API não possui acesso a este quadro. Abra-o no Trello ou atribua uma conta autorizada à integração." : "Não foi possível sincronizar este quadro agora. A abertura em uma nova aba continua disponível e preserva sua sessão do Trello."}</p><a href={boardUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><ExternalLink className="mr-2 h-4 w-4" />Abrir quadro no Trello</a><p className="mt-4 text-xs text-muted-foreground">{boardSource === "personal" ? "Este é o quadro individual configurado para você." : "Este é o quadro compartilhado configurado para a equipe."}</p></div></section> : <section className="grid min-h-[360px] place-items-center rounded-2xl border border-dashed border-border bg-card p-8 text-center"><div className="max-w-md"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary"><LayoutDashboard className="h-5 w-5" /></span><h2 className="mt-4 font-display text-xl font-semibold text-foreground">Nenhum quadro conectado</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{canConfigure ? "Conecte a URL do quadro para disponibilizá-lo a toda a equipe." : "Peça a uma pessoa administradora para conectar o quadro Trello deste ambiente."}</p></div></section>}

    <Dialog open={isConfigurationOpen} onOpenChange={setIsConfigurationOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Configurar quadro compartilhado</DialogTitle><DialogDescription>Informe a URL do quadro Trello. Pessoas com quadro exclusivo atribuído manterão sua configuração individual.</DialogDescription></DialogHeader><form className="grid gap-4 pt-2" onSubmit={event => { event.preventDefault(); updateConfiguration.mutate({ url: draftUrl }, { onSuccess: () => setIsConfigurationOpen(false) }); }}><div><Label htmlFor="trello-url">URL do quadro</Label><Input id="trello-url" className="mt-1.5" value={draftUrl} onChange={event => setDraftUrl(event.target.value)} placeholder="https://trello.com/b/..." /></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setIsConfigurationOpen(false)}>Cancelar</Button><Button type="submit" disabled={updateConfiguration.isPending}><Save className="mr-2 h-4 w-4" />Salvar</Button></div></form></DialogContent></Dialog>
  </div>;
}
