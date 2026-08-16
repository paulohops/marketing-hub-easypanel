import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useBranding } from "@/contexts/BrandingContext";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function LoginPage() {
  const { branding } = useBranding();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [stage, setStage] = useState<"credentials" | "reset-request" | "reset-code">("credentials");
  const login = trpc.auth.local.login.useMutation({ onSuccess: () => window.location.assign("/"), onError: error => toast.error(error.message) });
  const requestPasswordReset = trpc.auth.local.requestPasswordReset.useMutation({ onSuccess: () => { setCode(""); setStage("reset-code"); toast.success("Se o e-mail estiver cadastrado, o código foi enviado."); }, onError: error => toast.error(error.message) });
  const resetPasswordMutation = trpc.auth.local.resetPassword.useMutation({ onSuccess: () => { setCode(""); setResetPassword(""); setStage("credentials"); toast.success("Senha redefinida. Faça o login novamente."); }, onError: error => toast.error(error.message) });

  const submit = (event: React.FormEvent) => { event.preventDefault(); login.mutate({ email, password }); };
  const submitResetRequest = (event: React.FormEvent) => { event.preventDefault(); requestPasswordReset.mutate({ email }); };
  const submitReset = (event: React.FormEvent) => { event.preventDefault(); resetPasswordMutation.mutate({ email, code, newPassword: resetPassword }); };

  return (
    <div className="trade-login cluster-grid min-h-screen bg-background p-4 sm:p-7">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1440px] overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_32px_80px_rgba(14,114,59,0.12)] sm:min-h-[calc(100vh-3.5rem)] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative overflow-hidden bg-primary px-7 py-8 text-white sm:px-12 sm:py-12">
          <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full border border-white/20" />
          <div className="pointer-events-none absolute bottom-[-25%] right-[-15%] h-[34rem] w-[34rem] rounded-full border-[40px] border-sidebar-primary opacity-90" />
          <div className="pointer-events-none absolute right-12 top-16 h-2 w-28 bg-sidebar-primary" />
          <div className="relative flex h-full min-h-[480px] flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-card p-1.5 shadow-[0_10px_30px_rgba(7,63,31,0.24)]">
                  <img src={branding.logoUrl} alt={branding.appName} className="h-full w-full object-contain" />
                </span>
                <span>
                  <span className="block max-w-[180px] truncate font-display text-lg font-extrabold tracking-tight">{branding.appName}</span>
                  <span className="block max-w-[180px] truncate text-[10px] font-bold tracking-[0.2em] text-sidebar-foreground">{branding.appSubtitle}</span>
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
                <div key={item} className="rounded-xl border border-white/15 bg-white/[0.09] px-4 py-3 backdrop-blur-sm">
                  <CheckCircle2 className="mb-3 h-4 w-4 text-accent" />
                  <p className="text-xs font-medium text-sidebar-foreground">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="flex items-center justify-center px-7 py-12 sm:px-14">
          <div className="w-full max-w-sm">
            <span className="inline-flex rounded-full bg-secondary px-3 py-1 text-[11px] font-bold tracking-wide text-primary">ACESSO RESTRITO</span>
            <h2 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-foreground">Acesse sua operação</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Acesse com sua conta local usando seu e-mail e senha.</p>
            {stage === "credentials" && <form className="mt-7 space-y-4" onSubmit={submit}>
              <div className="space-y-2"><label className="text-sm font-semibold text-foreground" htmlFor="local-email">E-mail</label><Input id="local-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="nome@empresa.com" /></div>
              <div className="space-y-2"><label className="text-sm font-semibold text-foreground" htmlFor="local-password">Senha</label><Input id="local-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Sua senha local" /></div>
              <Button type="submit" disabled={login.isPending} className="h-12 w-full rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-[0_10px_18px_rgba(14,114,59,0.2)] hover:bg-primary/90">{login.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Continuar</Button>
              <button type="button" className="w-full text-sm font-semibold text-primary hover:underline" onClick={() => setStage("reset-request")}>Esqueci minha senha</button>
            </form>}
            {stage === "reset-request" && <form className="mt-7 space-y-4" onSubmit={submitResetRequest}><p className="text-sm text-muted-foreground">Informe seu e-mail e enviaremos um código para redefinir a senha.</p><div className="space-y-2"><label className="text-sm font-semibold text-foreground" htmlFor="reset-email">E-mail</label><Input id="reset-email" type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="nome@empresa.com" /></div><Button type="submit" disabled={requestPasswordReset.isPending} className="h-12 w-full bg-primary text-primary-foreground">Enviar código</Button><button type="button" className="inline-flex items-center text-sm font-semibold text-primary" onClick={() => setStage("credentials")}><ArrowLeft className="mr-1 h-4 w-4" />Voltar ao login</button></form>}
            {stage === "reset-code" && <form className="mt-7 space-y-4" onSubmit={submitReset}><div className="space-y-2"><label className="text-sm font-semibold text-foreground" htmlFor="reset-code">Código recebido</label><Input id="reset-code" inputMode="numeric" maxLength={6} required value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" /></div><div className="space-y-2"><label className="text-sm font-semibold text-foreground" htmlFor="new-password">Nova senha</label><Input id="new-password" type="password" minLength={12} required value={resetPassword} onChange={event => setResetPassword(event.target.value)} placeholder="Mínimo de 12 caracteres" /></div><Button type="submit" disabled={resetPasswordMutation.isPending} className="h-12 w-full bg-primary text-primary-foreground">Redefinir senha</Button></form>}
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-border bg-background p-4">
              <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-sidebar-primary" />
              <p className="text-xs leading-5 text-muted-foreground">O acesso está disponível por e-mail e senha. A confirmação por código está desabilitada temporariamente.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
