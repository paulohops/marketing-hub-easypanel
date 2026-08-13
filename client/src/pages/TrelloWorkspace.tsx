import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import { ExternalLink, LayoutDashboard, Loader2, Save, Settings2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function TrelloWorkspace() {
  const utils = trpc.useUtils();
  const { can, isLoading: permissionsLoading } = useEffectivePermissions();
  const configuration = trpc.settings.getTrelloConfiguration.useQuery();
  const [draftUrl, setDraftUrl] = useState("");
  const [isConfigurationOpen, setIsConfigurationOpen] = useState(false);
  const canConfigure = can("settings.write");

  useEffect(() => {
    if (configuration.data) setDraftUrl(configuration.data.url);
  }, [configuration.data]);

  const updateConfiguration = trpc.settings.updateTrelloConfiguration.useMutation({
    onSuccess: async () => {
      await utils.settings.getTrelloConfiguration.invalidate();
      toast.success("Integração do Trello atualizada.");
    },
    onError: error => toast.error(error.message),
  });

  if (configuration.isLoading || permissionsLoading) return <div className="grid min-h-[320px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const boardUrl = configuration.data?.url ?? "";
  const boardSource = configuration.data?.source ?? "none";

  return <div className="mx-auto max-w-7xl space-y-5">
    <header className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><LayoutDashboard className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Gestão integrada</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Trello</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Consulte o quadro de gestão conectado ao Trade HUB sem perder o contexto operacional.</p>{boardSource === "personal" ? <span className="mt-3 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">Quadro exclusivo atribuído a você</span> : boardSource === "shared" ? <span className="mt-3 inline-flex rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-primary">Quadro compartilhado da equipe</span> : null}</div></div>
        {boardUrl ? <a href={boardUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent"><ExternalLink className="mr-2 h-4 w-4" />Abrir no Trello</a> : null}
      </div>
    </header>

    {canConfigure ? <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex gap-3"><Settings2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="min-w-0 flex-1"><h2 className="font-display text-lg font-semibold text-foreground">Configurar quadro compartilhado</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Defina o quadro padrão do time. Quadros específicos podem ser atribuídos a cada funcionário em Usuários e permissões e sempre terão prioridade para a pessoa vinculada.</p><Button type="button" variant="outline" className="mt-4" onClick={() => setIsConfigurationOpen(true)}><Settings2 className="mr-2 h-4 w-4" />{boardUrl ? "Editar quadro padrão" : "Conectar quadro padrão"}</Button></div></div></section> : null}

    {boardUrl ? <section className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"><div className="mx-auto max-w-2xl text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-primary"><ShieldCheck className="h-6 w-6" /></span><h2 className="mt-4 font-display text-xl font-semibold text-foreground">Quadro pronto para abrir</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">O Trello protege alguns quadros contra incorporação dentro de outros sistemas. Para evitar a mensagem de conexão recusada e preservar sua sessão segura, o quadro será aberto em uma nova aba.</p><a href={boardUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><ExternalLink className="mr-2 h-4 w-4" />Abrir quadro no Trello</a><p className="mt-4 text-xs text-muted-foreground">{boardSource === "personal" ? "Este é o quadro individual configurado para você." : "Este é o quadro compartilhado configurado para a equipe."}</p></div></section> : <section className="grid min-h-[360px] place-items-center rounded-2xl border border-dashed border-border bg-card p-8 text-center"><div className="max-w-md"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-primary"><LayoutDashboard className="h-5 w-5" /></span><h2 className="mt-4 font-display text-xl font-semibold text-foreground">Nenhum quadro conectado</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{canConfigure ? "Conecte a URL do quadro para disponibilizá-lo a toda a equipe." : "Peça a uma pessoa administradora para conectar o quadro Trello deste ambiente."}</p></div></section>}
    <Dialog open={isConfigurationOpen} onOpenChange={setIsConfigurationOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Configurar quadro compartilhado</DialogTitle><DialogDescription>Informe a URL do quadro Trello. Pessoas com quadro exclusivo atribuído manterão sua configuração individual.</DialogDescription></DialogHeader><form className="grid gap-4 pt-2" onSubmit={event => { event.preventDefault(); updateConfiguration.mutate({ url: draftUrl }, { onSuccess: () => setIsConfigurationOpen(false) }); }}><div><Label htmlFor="trello-url">URL do quadro</Label><Input id="trello-url" className="mt-1.5" value={draftUrl} onChange={event => setDraftUrl(event.target.value)} placeholder="https://trello.com/b/..." /></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setIsConfigurationOpen(false)}>Cancelar</Button><Button type="submit" disabled={updateConfiguration.isPending}><Save className="mr-2 h-4 w-4" />Salvar</Button></div></form></DialogContent></Dialog>
  </div>;
}
