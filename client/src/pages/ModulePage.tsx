import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";

type ModulePageProps = { eyebrow: string; title: string; description: string; icon: React.ComponentType<{ className?: string }>; resources: ReadonlyArray<{ title: string; description: string }>; accent?: string };

export default function ModulePage({ eyebrow, title, description, icon: Icon, resources, accent = "var(--primary)" }: ModulePageProps) {
  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white shadow-sm" style={{ background: accent }}><Icon className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div></div>
        <Button onClick={() => toast.info("A criação de registros será liberada com as permissões do seu perfil.")} className="h-10 rounded-xl bg-primary px-4 text-xs font-semibold hover:bg-primary/90"><Plus className="mr-1.5 h-4 w-4" /> Novo registro</Button>
      </div>
      <div className="mt-7 grid gap-4 lg:grid-cols-3">
        {resources.map((resource, index) => <div key={resource.title} className="rounded-2xl border border-border bg-white p-5"><span className="text-[11px] font-semibold text-muted-foreground">0{index + 1}</span><h2 className="mt-5 font-display text-lg font-semibold text-foreground">{resource.title}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{resource.description}</p><button onClick={() => toast.info("Este painel será conectado aos registros reais da sua operação.")} className="mt-6 flex items-center gap-1 text-xs font-semibold text-primary">Ver painel <ArrowRight className="h-3.5 w-3.5" /></button></div>)}
      </div>
      <Empty className="mt-6 min-h-[320px] rounded-2xl border border-dashed border-border bg-white">
        <EmptyHeader><EmptyMedia variant="icon" className="bg-secondary text-primary"><Icon className="h-5 w-5" /></EmptyMedia><EmptyTitle>Nenhum registro para exibir</EmptyTitle><EmptyDescription>Quando sua operação estiver cadastrada, os dados e o histórico deste módulo aparecerão aqui.</EmptyDescription></EmptyHeader>
        <Button variant="outline" className="mt-2 h-9 rounded-lg border-border text-xs text-primary" onClick={() => toast.info("Configure os cadastros-base antes de incluir registros operacionais.")}>Conhecer o fluxo</Button>
      </Empty>
      <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3"><Badge className="border-0 bg-primary/15 text-[10px] text-primary">BASE SEGURA</Badge><p className="text-xs text-muted-foreground">Dados vinculados por regional, cidade, fornecedor e usuário conforme suas permissões.</p></div>
    </div>
  );
}
