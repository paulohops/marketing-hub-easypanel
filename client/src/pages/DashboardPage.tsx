import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, BellRing, Boxes, CalendarClock, Landmark, Map, Megaphone, Plus } from "lucide-react";
import { useLocation } from "wouter";

const modules = [
  { title: "Estoque de brindes", description: "Entradas, saídas e saldo por regional", icon: Boxes, href: "/estoque", color: "bg-[#e8f0df] text-[#4e6b47]" },
  { title: "Controle financeiro", description: "Notas fiscais, contas e pagamentos", icon: Landmark, href: "/financeiro", color: "bg-[#f6ead7] text-[#a86228]" },
  { title: "Mídias e campanhas", description: "Pontos, renovação e histórico", icon: Megaphone, href: "/midias", color: "bg-[#e0eeed] text-[#327174]" },
  { title: "Ações e eventos", description: "Planejamento, execução e debriefing", icon: CalendarClock, href: "/acoes", color: "bg-[#ece8f4] text-[#65528a]" },
];

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  return (
    <div className="mx-auto max-w-[1480px]">
      <section className="relative overflow-hidden rounded-[22px] bg-[#183b3c] px-6 py-7 text-white shadow-[0_16px_42px_rgba(25,55,55,0.15)] sm:px-8 sm:py-9">
        <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full border-[26px] border-[#275557]" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <Badge className="border-0 bg-[#f0a63c] px-3 py-1 text-[10px] font-semibold tracking-[0.12em] text-[#193434]">CENTRAL DE OPERAÇÕES</Badge>
            <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Visão geral da operação</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#b8cfca]">Acompanhe seus módulos e comece estruturando os cadastros essenciais para sua operação.</p>
          </div>
          <Button onClick={() => setLocation("/configuracoes")} className="h-10 rounded-xl bg-white px-4 text-xs font-semibold text-[#1c4545] hover:bg-[#f2f6f2]"><Plus className="mr-1.5 h-4 w-4" /> Novo cadastro</Button>
        </div>
      </section>

      <section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map(module => (
          <button key={module.title} onClick={() => setLocation(module.href)} className="group rounded-2xl border border-[#e0e4de] bg-white p-5 text-left shadow-[0_3px_12px_rgba(24,48,43,0.03)] transition-all hover:-translate-y-0.5 hover:border-[#ccd8cf] hover:shadow-[0_12px_28px_rgba(24,48,43,0.08)]">
            <span className={`grid h-10 w-10 place-items-center rounded-xl ${module.color}`}><module.icon className="h-5 w-5" /></span>
            <p className="mt-5 font-display text-base font-semibold text-[#243836]">{module.title}</p>
            <p className="mt-1 text-xs leading-5 text-[#788782]">{module.description}</p>
            <span className="mt-5 flex items-center gap-1 text-xs font-semibold text-[#40685e]">Abrir módulo <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
          </button>
        ))}
      </section>

      <section className="mt-7 grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <div className="rounded-2xl border border-[#e0e4de] bg-white p-6">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#789088]">Atividade operacional</p><h2 className="mt-1 font-display text-xl font-semibold text-[#243836]">Sua operação começa aqui</h2></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f0f4ee] text-[#4f7168]"><Map className="h-4 w-4" /></span></div>
          <div className="mt-10 flex flex-col items-center justify-center rounded-xl border border-dashed border-[#d8dfd7] bg-[#fafbf9] px-6 py-10 text-center"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#eaf1e9] text-[#50706a]"><Map className="h-5 w-5" /></span><p className="mt-4 text-sm font-semibold text-[#37534e]">Ainda não há dados operacionais</p><p className="mt-1 max-w-sm text-xs leading-5 text-[#788782]">Cadastre regionais, cidades e fornecedores para iniciar o acompanhamento consolidado.</p><Button variant="outline" onClick={() => setLocation("/configuracoes")} className="mt-5 h-9 rounded-lg border-[#d5dfd5] bg-white text-xs text-[#34584e] hover:bg-[#f1f6f1]">Abrir configurações</Button></div>
        </div>
        <div className="rounded-2xl border border-[#e0e4de] bg-white p-6"><div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#789088]">Alertas</p><h2 className="mt-1 font-display text-xl font-semibold text-[#243836]">Acompanhar</h2></div><BellRing className="h-5 w-5 text-[#b97925]" /></div><div className="mt-7 rounded-xl bg-[#faf5eb] p-4"><p className="text-xs font-semibold text-[#9c6623]">Nenhum alerta pendente</p><p className="mt-1 text-xs leading-5 text-[#927c5e]">Os alertas de campanha, pagamentos e ações serão exibidos neste painel.</p></div><Button variant="ghost" onClick={() => setLocation("/indicadores")} className="mt-5 h-8 px-0 text-xs font-semibold text-[#416a60] hover:bg-transparent hover:text-[#244e44]">Ver indicadores <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></div>
      </section>
    </div>
  );
}
