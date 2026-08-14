import { Link } from "wouter";
import { BadgeCheck, Download, FileSpreadsheet, Network, Settings2, UsersRound } from "lucide-react";

export function normalizeRegistryValue(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function hasDuplicateRegistryValue(values: Array<string | null | undefined>, candidate: string) {
  const normalizedCandidate = normalizeRegistryValue(candidate);
  return normalizedCandidate.length > 0 && values.some(value => normalizeRegistryValue(value ?? "") === normalizedCandidate);
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

const administrativeAreas = [
  { title: "Usuários e permissões", description: "Gerencie cargos, acessos por módulo e responsabilidades operacionais de cada pessoa usuária.", href: "/usuarios", icon: UsersRound, action: "Administrar usuários" },
  { title: "Equipes", description: "Visualize o organograma, defina gestores diretos e acompanhe colaboradores por responsável.", href: "/equipes", icon: Network, action: "Organizar equipes" },
  { title: "Importar cadastros", description: "Baixe um modelo, valide Empresas, Regionais, Cidades e Lojas e grave os registros em lote com segurança.", href: "/importar-dados", icon: FileSpreadsheet, action: "Importar planilha" },
  { title: "Exportar relatórios", description: "Defina o período e baixe os dados de mídias, ações, eventos e financeiro para análise externa.", href: "/exportar-relatorios", icon: Download, action: "Abrir exportações" },
];

export default function SettingsWorkspace() {
  return <div className="mx-auto max-w-5xl">
    <div className="flex gap-4 border-b border-border pb-6"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white shadow-sm"><Settings2 className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">Administração do sistema</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Configurações</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Administre pessoas, permissões, importações e exportações do Marketing HUB — Cluster MG. Os cadastros que abastecem a operação ficam disponíveis em Gestão.</p></div></div>
    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{administrativeAreas.map(area => { const Icon = area.icon; const content = <><span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><Icon className="h-4.5 w-4.5" /></span><h2 className="mt-5 font-display text-lg font-semibold text-foreground">{area.title}</h2><p className="mt-2 min-h-20 text-sm leading-6 text-muted-foreground">{area.description}</p><span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary">{area.action}<BadgeCheck className="h-4 w-4" /></span></>; return <Link key={area.title} href={area.href} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</Link>; })}</div>
  </div>;
}
