import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { ArrowUpRight, CheckCircle2, LockKeyhole } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="trade-login cluster-grid min-h-screen bg-background p-4 sm:p-7">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1440px] overflow-hidden rounded-[28px] border border-border bg-white shadow-[0_32px_80px_rgba(14,114,59,0.12)] lg:grid-cols-[1.1fr_0.9fr] sm:min-h-[calc(100vh-3.5rem)]">
        <section className="relative overflow-hidden bg-primary px-7 py-8 text-white sm:px-12 sm:py-12">
          <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full border border-white/20" />
          <div className="pointer-events-none absolute bottom-[-25%] right-[-15%] h-[34rem] w-[34rem] rounded-full border-[40px] border-sidebar-primary opacity-90" />
          <div className="pointer-events-none absolute right-12 top-16 h-2 w-28 bg-sidebar-primary" />
          <div className="relative flex h-full min-h-[480px] flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-white p-1.5 shadow-[0_10px_30px_rgba(7,63,31,0.24)]"><img src="/manus-storage/cluster-mg-logo_947e1614.png" alt="Cluster MG" className="h-full w-full object-contain" /></span>
                <span>
                  <span className="block font-display text-lg font-extrabold tracking-tight">TRADE HUB</span>
                  <span className="block text-[10px] font-bold tracking-[0.2em] text-sidebar-foreground">CLUSTER MG</span>
                </span>
              </div>
              <div className="mt-20 max-w-xl sm:mt-28">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">Gestão que conecta campo e resultado</p>
                <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-white sm:text-5xl">Controle operacional com visão estratégica.</h1>
                <p className="mt-6 max-w-md text-base leading-7 text-sidebar-foreground">Planeje, acompanhe e documente cada investimento de trade marketing em uma única central segura do Cluster MG.</p>
              </div>
            </div>
            <div className="relative grid gap-3 sm:grid-cols-3">
              {["Estoque e financeiro", "Mídias e campanhas", "Ações e eventos"].map(item => (
                <div key={item} className="rounded-xl border border-white/15 bg-white/[0.09] px-4 py-3 backdrop-blur-sm"><CheckCircle2 className="mb-3 h-4 w-4 text-accent" /><p className="text-xs font-medium text-sidebar-foreground">{item}</p></div>
              ))}
            </div>
          </div>
        </section>
        <section className="flex items-center justify-center px-7 py-12 sm:px-14">
          <div className="w-full max-w-sm">
            <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-[11px] font-bold tracking-wide text-primary">ACESSO RESTRITO</span>
            <h2 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-foreground">Acesse sua operação</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Entre com sua conta autorizada para visualizar informações conforme o seu perfil de acesso.</p>
            <div className="my-8 h-px bg-border" />
            <Button onClick={() => startLogin()} className="h-12 w-full rounded-xl bg-sidebar-primary text-sm font-bold text-white shadow-[0_10px_18px_rgba(244,81,3,0.2)] transition-transform hover:bg-accent-foreground active:scale-[0.98]">
              Entrar na plataforma <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-background p-4"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary" /><p className="text-xs leading-5 text-muted-foreground">Acesso autenticado, permissões por perfil e comunicação protegida com o banco de dados.</p></div>
          </div>
        </section>
      </div>
    </div>
  );
}
