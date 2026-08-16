import { ArrowLeft, Database, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function DataCenterWorkspace() {
  const [, setLocation] = useLocation();
  const cards = [{ title: "Importar cadastros", description: "Carregue planilhas validadas para atualizar cadastros em lote.", href: "/importar-dados", icon: Upload }, { title: "Exportar Relatórios", description: "Gere arquivos com os dados operacionais para análise externa.", href: "/exportar-relatorios", icon: Download }];
  return <div className="mx-auto max-w-5xl">
    <Button type="button" variant="outline" className="mb-5 border-border" onClick={() => setLocation("/configuracoes")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar para Configurações</Button>
    <div className="flex gap-4 border-b border-border pb-6"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white shadow-sm"><Database className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">Administração do sistema</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Central de Dados</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Concentre as entradas e saídas de dados do Marketing HUB em um único lugar.</p></div></div>
    <div className="mt-5 grid gap-4 md:grid-cols-2">{cards.map(card => { const Icon = card.icon; return <button type="button" key={card.href} onClick={() => setLocation(card.href)} className="rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><Icon className="h-5 w-5" /></span><h2 className="mt-5 font-display text-lg font-semibold text-foreground">{card.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{card.description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"><FileSpreadsheet className="h-4 w-4" />Abrir</span></button>; })}</div>
  </div>;
}
