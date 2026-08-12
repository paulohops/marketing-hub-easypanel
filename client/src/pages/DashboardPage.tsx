import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, BellRing, Boxes, CalendarClock, Landmark, Map, Megaphone, Plus } from "lucide-react";
import { useLocation } from "wouter";

const modules = [
  { title: "Estoque de brindes", description: "Entradas, saídas e saldo por regional", icon: Boxes, href: "/estoque", color: "bg-secondary text-primary" },
  { title: "Controle financeiro", description: "Notas fiscais, contas e pagamentos", icon: Landmark, href: "/financeiro", color: "bg-accent text-accent-foreground" },
  { title: "Mídias e campanhas", description: "Pontos, renovação e histórico", icon: Megaphone, href: "/midias", color: "bg-secondary text-primary" },
  { title: "Ações e eventos", description: "Planejamento, execução e debriefing", icon: CalendarClock, href: "/acoes", color: "bg-accent text-accent-foreground" },
];

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  return (
    <div className="mx-auto max-w-[1480px]">
      <section className="cluster-grid relative overflow-hidden rounded-[22px] bg-primary px-6 py-7 text-white shadow-[0_16px_42px_rgba(14,114,59,0.18)] sm:px-8 sm:py-9">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full border-[26px] border-sidebar-primary opacity-90" />
        <div className="absolute bottom-[-75px] right-[18%] h-40 w-40 rounded-full border border-white/20" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <Badge className="border-0 bg-sidebar-primary px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-white">CLUSTER MG</Badge>
            <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Trade HUB em movimento</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-sidebar-foreground">A central de gestão do Cluster MG para conectar território, campanhas, fornecedores e resultados.</p>
          </div>
          <Button onClick={() => setLocation("/configuracoes")} className="h-10 rounded-xl bg-sidebar-primary px-4 text-xs font-bold text-white hover:bg-accent-foreground"><Plus className="mr-1.5 h-4 w-4" /> Novo cadastro</Button>
        </div>
      </section>

      <section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map(module => (
          <button key={module.title} onClick={() => setLocation(module.href)} className="group rounded-2xl border border-border bg-white p-5 text-left shadow-[0_3px_12px_rgba(14,114,59,0.04)] transition-all hover:-translate-y-0.5 hover:border-sidebar-primary/50 hover:shadow-[0_12px_28px_rgba(14,114,59,0.1)]">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${module.color}`}><module.icon className="h-5 w-5" /></span>
            <p className="mt-5 font-display text-base font-bold text-foreground">{module.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{module.description}</p>
            <span className="mt-5 flex items-center gap-1 text-xs font-bold text-primary group-hover:text-sidebar-primary">Abrir módulo <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
          </button>
        ))}
      </section>

      <section className="mt-7 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <div className="rounded-2xl border border-border bg-white p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Atividade operacional</p><h2 className="mt-1 font-display text-xl font-semibold text-foreground">Sua operação começa aqui</h2></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-primary"><Map className="h-4 w-4" /></span></div>
          <div className="mt-10 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background px-6 py-10 text-center"><span className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-primary"><Map className="h-5 w-5" /></span><p className="mt-4 text-sm font-semibold text-foreground">Ainda não há dados operacionais</p><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Cadastre regionais, cidades e fornecedores para iniciar o acompanhamento consolidado.</p><Button variant="outline" onClick={() => setLocation("/configuracoes")} className="mt-5 h-9 rounded-lg border-border bg-white text-xs text-primary hover:bg-secondary">Abrir configurações</Button></div>
        </div>
        <div className="rounded-2xl border border-border bg-white p-6"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Alertas</p><h2 className="mt-1 font-display text-xl font-semibold text-foreground">Acompanhar</h2></div><BellRing className="h-5 w-5 text-accent-foreground" /></div><div className="mt-7 rounded-xl bg-accent p-4"><p className="text-xs font-semibold text-accent-foreground">Nenhum alerta pendente</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Os alertas de campanha, pagamentos e ações serão exibidos neste painel.</p></div><Button variant="ghost" onClick={() => setLocation("/indicadores")} className="mt-5 h-8 px-0 text-xs font-semibold text-primary hover:bg-transparent hover:text-primary">Ver indicadores <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></div>
      </section>
    </div>
  );
}
