import { Button } from "@/components/ui/button";
import { startLogin } from "@/const";
import { ArrowUpRight, BarChart3, CheckCircle2, LockKeyhole } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="trade-login min-h-screen bg-[#f3f2eb] p-4 sm:p-7">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1440px] overflow-hidden rounded-[28px] border border-[#dfe2da] bg-white shadow-[0_32px_80px_rgba(24,44,42,0.12)] lg:grid-cols-[1.1fr_0.9fr] sm:min-h-[calc(100vh-3.5rem)]">
        <section className="relative overflow-hidden bg-[#10282a] px-7 py-8 text-white sm:px-12 sm:py-12">
          <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full border border-[#eaa13b]/25" />
          <div className="pointer-events-none absolute bottom-[-25%] right-[-15%] h-[34rem] w-[34rem] rounded-full bg-[#183f40]" />
          <div className="pointer-events-none absolute right-12 top-16 h-2 w-28 bg-[#eaa13b]" />
          <div className="relative flex h-full min-h-[480px] flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eaa13b] text-[#173033] shadow-[0_10px_30px_rgba(234,161,59,0.25)]"><BarChart3 className="h-5 w-5" strokeWidth={2.7} /></span>
                <span>
                  <span className="block font-display text-lg font-semibold tracking-tight">HUB TRADE</span>
                  <span className="block text-[10px] font-semibold tracking-[0.2em] text-[#8ca6a0]">OPERATIONS</span>
                </span>
              </div>
              <div className="mt-20 max-w-xl sm:mt-28">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eaa13b]">Gestão que conecta campo e resultado</p>
                <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.06] tracking-tight text-[#f4f4ed] sm:text-5xl">Controle operacional com visão estratégica.</h1>
                <p className="mt-6 max-w-md text-base leading-7 text-[#a9c0ba]">Planeje, acompanhe e documente cada investimento de trade marketing em uma única central segura.</p>
              </div>
            </div>
            <div className="relative grid gap-3 sm:grid-cols-3">
              {["Estoque e financeiro", "Mídias e campanhas", "Ações e eventos"].map(item => (
                <div key={item} className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm"><CheckCircle2 className="mb-3 h-4 w-4 text-[#f5b651]" /><p className="text-xs font-medium text-[#d8e4df]">{item}</p></div>
              ))}
            </div>
          </div>
        </section>
        <section className="flex items-center justify-center px-7 py-12 sm:px-14">
          <div className="w-full max-w-sm">
            <span className="inline-flex rounded-full bg-[#edf1eb] px-3 py-1 text-[11px] font-semibold tracking-wide text-[#506961]">ACESSO RESTRITO</span>
            <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight text-[#193030]">Acesse sua operação</h2>
            <p className="mt-3 text-sm leading-6 text-[#6f7f79]">Entre com sua conta autorizada para visualizar informações conforme o seu perfil de acesso.</p>
            <div className="my-8 h-px bg-[#e4e7e1]" />
            <Button onClick={() => startLogin()} className="h-12 w-full rounded-xl bg-[#173b3b] text-sm font-semibold text-white shadow-[0_10px_18px_rgba(23,59,59,0.18)] transition-transform hover:bg-[#215252] active:scale-[0.98]">
              Entrar na plataforma <ArrowUpRight className="ml-2 h-4 w-4" />
            </Button>
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#e5e8e3] bg-[#fbfcfa] p-4"><LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#c78326]" /><p className="text-xs leading-5 text-[#687a73]">Acesso autenticado, permissões por perfil e comunicação protegida com o banco de dados.</p></div>
          </div>
        </section>
      </div>
    </div>
  );
}
