import { ArrowLeft, Database, Download, FileSpreadsheet, ShieldAlert, Upload } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";

const moduleOptions = [
  { id: 1, value: "media" as const, label: "Mídias e veiculações", description: "Pontos, registros, veiculações, spots e evidências." },
  { id: 2, value: "actions" as const, label: "Ações e eventos", description: "Ações, eventos, equipes, serviços, fornecedores e debriefings." },
  { id: 3, value: "campaigns" as const, label: "Campanhas comerciais", description: "Campanhas, promoções, cidades, regionais e planos." },
  { id: 4, value: "inventory" as const, label: "Estoque", description: "Itens, saldos, movimentações e transferências." },
  { id: 5, value: "operational_catalogs" as const, label: "Cadastros operacionais", description: "Vínculos de fornecedores, serviços e tipos de mídia." },
];

type ModuleValue = (typeof moduleOptions)[number]["value"];

export default function DataCenterWorkspace() {
  const [, setLocation] = useLocation();
  const { can } = useEffectivePermissions();
  const utils = trpc.useUtils();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmation, setConfirmation] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const selectedModules = selectedIds
    .map(id => moduleOptions.find(option => option.id === id)?.value)
    .filter((value): value is ModuleValue => Boolean(value));
  const clearModuleData = trpc.settings.clearModuleData.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.settings.overview.invalidate(),
        utils.media.list.invalidate(),
        utils.actions.list.invalidate(),
        utils.events.list.invalidate(),
      ]);
      const totalDeleted = Object.values(result.deleted ?? {}).reduce((sum, value) => sum + value, 0);
      toast.success(`Dados apagados: ${totalDeleted} registro(s) em ${result.modules.length} módulo(s).`);
      setSelectedIds([]);
      setConfirmation("");
      setConfirmOpen(false);
    },
    onError: error => toast.error(error.message),
  });

  return (
    <div className="mx-auto max-w-5xl">
      <Button type="button" variant="outline" className="mb-5 border-border" onClick={() => setLocation("/configuracoes")}>
        <ArrowLeft className="mr-2 h-4 w-4" />Voltar para Configurações
      </Button>
      <div className="flex gap-4 border-b border-border pb-6">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white shadow-sm"><Database className="h-5 w-5" /></span>
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">Administração do sistema</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Central de Dados</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Concentre as entradas, saídas e ações administrativas dos dados do Marketing HUB em um único lugar.</p></div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {[
          { title: "Importar cadastros", description: "Carregue planilhas validadas para atualizar cadastros em lote.", href: "/importar-dados", icon: Upload },
          { title: "Exportar Relatórios", description: "Gere arquivos com os dados operacionais para análise externa.", href: "/exportar-relatorios", icon: Download },
        ].map(card => { const Icon = card.icon; return <button type="button" key={card.href} onClick={() => setLocation(card.href)} className="rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><Icon className="h-5 w-5" /></span><h2 className="mt-5 font-display text-lg font-semibold text-foreground">{card.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{card.description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"><FileSpreadsheet className="h-4 w-4" />Abrir</span></button>; })}
      </div>
      {can("settings.write") && <section className="mt-5 rounded-2xl border border-destructive/30 bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive"><ShieldAlert className="h-5 w-5" /></span><div><h2 className="font-display text-lg font-semibold text-foreground">Apagar dados por módulo</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Selecione somente os módulos que deseja limpar. Usuários, permissões, configurações e histórico de auditoria não são apagados por esta operação.</p></div></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end"><div><SearchableMultiSelect id="data-center-delete-modules" label="Módulos para apagar" options={moduleOptions.map(option => ({ id: option.id, label: option.label, description: option.description }))} values={selectedIds} onChange={setSelectedIds} placeholder="Selecione os módulos" emptyMessage="Nenhum módulo disponível" /><div className="mt-3 space-y-2">{selectedModules.map(value => { const option = moduleOptions.find(item => item.value === value); return option ? <p key={value} className="text-xs text-muted-foreground"><strong className="text-foreground">{option.label}:</strong> {option.description}</p> : null; })}</div></div><Button type="button" variant="destructive" disabled={!selectedModules.length} onClick={() => setConfirmOpen(true)}>Apagar dados selecionados</Button></div>
      </section>}
      <AlertDialog open={confirmOpen} onOpenChange={open => { setConfirmOpen(open); if (!open) setConfirmation(""); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar exclusão dos dados</AlertDialogTitle><AlertDialogDescription>Esta ação é permanente para os módulos selecionados e não pode ser desfeita. Para continuar, digite <strong>APAGAR</strong>.</AlertDialogDescription></AlertDialogHeader><div className="space-y-2"><Label htmlFor="delete-confirmation">Confirmação</Label><Input id="delete-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value.toUpperCase())} placeholder="APAGAR" autoComplete="off" /></div><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={confirmation !== "APAGAR" || clearModuleData.isPending} onClick={event => { event.preventDefault(); clearModuleData.mutate({ modules: selectedModules, confirmation: "APAGAR" }); }}>{clearModuleData.isPending ? "Apagando..." : "Confirmar exclusão"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
