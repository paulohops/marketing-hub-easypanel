import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { BadgeCheck, KeyRound, Loader2, Save, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

export default function ProfileWorkspace() {
  const utils = trpc.useUtils();
  const profile = trpc.users.profile.useQuery();
  const passwordPolicy = trpc.users.passwordPolicy.useQuery();
  const [form, setForm] = useState({ name: "", phone: "" });

  useEffect(() => {
    if (profile.data) {
      const storedName = typeof profile.data.name === "string" ? profile.data.name.trim() : "";
      const storedPhone = typeof profile.data.phone === "string" ? profile.data.phone : "";
      setForm({ name: storedName || "Paulo Oliveira", phone: storedPhone });
    }
  }, [profile.data]);

  const updateProfile = trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Dados do perfil atualizados.");
      utils.users.profile.invalidate();
      utils.auth.me.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    updateProfile.mutate(form);
  };

  if (profile.isLoading) return <div className="grid min-h-[340px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return <div className="mx-auto max-w-4xl">
    <div className="flex gap-4 border-b border-border pb-6"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white shadow-sm"><UserRound className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">Conta e segurança</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Meu perfil</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Mantenha seus dados de identificação atualizados para a operação do Trade HUB.</p></div></div>
    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.72fr]">
      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-semibold text-foreground">Dados pessoais</h2></div><p className="mt-1 text-xs leading-5 text-muted-foreground">O nome e telefone ficam disponíveis para identificação operacional e trilhas de auditoria.</p><div className="mt-5 grid gap-4"><div><Label htmlFor="profile-name">Nome completo</Label><Input id="profile-name" required minLength={2} maxLength={160} className="mt-1.5" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></div><div><Label htmlFor="profile-email">E-mail de acesso</Label><Input id="profile-email" disabled value={profile.data?.email ?? "Não informado pelo provedor"} className="mt-1.5 bg-secondary" /><p className="mt-1.5 text-[11px] text-muted-foreground">O e-mail é vinculado ao seu provedor de autenticação e não pode ser alterado aqui.</p></div><div><Label htmlFor="profile-phone">Telefone</Label><Input id="profile-phone" type="tel" maxLength={32} placeholder="(31) 99999-9999" className="mt-1.5" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></div></div><Button type="submit" disabled={updateProfile.isPending || !form.name.trim()} className="mt-6 bg-primary hover:bg-primary/90">{updateProfile.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />} Salvar alterações</Button></form>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-semibold text-foreground">Acesso e senha</h2></div><dl className="mt-5 space-y-4 text-sm"><div className="rounded-xl bg-secondary p-3"><dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Papel atual</dt><dd className="mt-1 font-semibold text-foreground">{profile.data?.role === "admin" ? "Administrador" : profile.data?.role === "regional_manager" ? "Gestor regional" : profile.data?.role === "operator" ? "Operador" : "Visualizador"}</dd></div><div className="rounded-xl bg-secondary p-3"><dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Método de acesso</dt><dd className="mt-1 font-semibold text-foreground">{profile.data?.loginMethod ?? "Autenticação institucional"}</dd></div></dl><div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-sm font-semibold text-foreground">Senha protegida pelo provedor</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{passwordPolicy.data?.message ?? "Sua senha é administrada pelo provedor de acesso institucional."}</p></div></section>
    </div>
  </div>;
}
