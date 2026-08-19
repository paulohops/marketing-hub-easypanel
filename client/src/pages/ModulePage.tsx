import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { WorkspaceActions, WorkspaceCard, WorkspaceHeader, WorkspaceSection, WorkspaceShell } from "@/components/WorkspaceChrome";
import { ArrowRight, Plus } from "lucide-react";
import { toast } from "sonner";

type ModulePageProps = { eyebrow: string; title: string; description: string; icon: React.ComponentType<{ className?: string }>; resources: ReadonlyArray<{ title: string; description: string }>; accent?: string };

export default function ModulePage({ eyebrow, title, description, icon: Icon, resources, accent = "var(--primary)" }: ModulePageProps) {
  return (
    <WorkspaceShell>
      <WorkspaceHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        icon={Icon}
        actions={
          <WorkspaceActions>
            <Button onClick={() => toast.info("A criação de registros será liberada com as permissões do seu perfil.")}>
              <Plus className="h-4 w-4" />
              Novo registro
            </Button>
          </WorkspaceActions>
        }
      />
      <WorkspaceSection>
        <div className="grid gap-4 lg:grid-cols-3">
          {resources.map((resource, index) => (
            <WorkspaceCard key={resource.title} className="hub-card--padded hub-card--interactive">
              <span className="text-[11px] font-semibold text-muted-foreground">0{index + 1}</span>
              <h2 className="mt-5 font-display text-lg font-semibold text-foreground">{resource.title}</h2>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{resource.description}</p>
              <button onClick={() => toast.info("Este painel será conectado aos registros reais da sua operação.")} className="mt-6 flex items-center gap-1 text-xs font-semibold text-primary">
                Ver painel <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </WorkspaceCard>
          ))}
        </div>
      </WorkspaceSection>
      <Empty className="mt-5 min-h-[320px] rounded-2xl border border-dashed border-border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-secondary text-primary"><Icon className="h-5 w-5" /></EmptyMedia>
          <EmptyTitle>Nenhum registro para exibir</EmptyTitle>
          <EmptyDescription>Quando sua operação estiver cadastrada, os dados e o histórico deste módulo aparecerão aqui.</EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" className="mt-2" onClick={() => toast.info("Configure os cadastros-base antes de incluir registros operacionais.")}>Conhecer o fluxo</Button>
      </Empty>
      <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-secondary px-4 py-3">
        <Badge className="border-0 bg-primary/15 text-[10px] text-primary">BASE SEGURA</Badge>
        <p className="text-xs text-muted-foreground">Dados vinculados por regional, cidade, fornecedor e usuário conforme suas permissões.</p>
      </div>
    </WorkspaceShell>
  );
}
