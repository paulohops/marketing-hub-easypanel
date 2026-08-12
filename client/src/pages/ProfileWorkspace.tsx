import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { BadgeCheck, Camera, KeyRound, Loader2, Save, Upload, UserRound } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const avatarMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;

function roleLabel(role?: string) {
  if (role === "admin") return "Administrador";
  if (role === "regional_manager") return "Gestor regional";
  if (role === "operator") return "Operador";
  if (role === "user") return "Usuário";
  return "Visualizador";
}

function jobLabel(jobTitle?: string | null, role?: string) {
  return jobTitle?.trim() || roleLabel(role);
}

export default function ProfileWorkspace() {
  const utils = trpc.useUtils();
  const profile = trpc.users.profile.useQuery();
  const passwordPolicy = trpc.users.passwordPolicy.useQuery();
  const [form, setForm] = useState({ name: "", phone: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmation: "" });
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile.data) return;
    const storedName = typeof profile.data.name === "string" ? profile.data.name.trim() : "";
    const storedPhone = typeof profile.data.phone === "string" ? profile.data.phone : "";
    setForm({ name: storedName || "Paulo Oliveira", phone: storedPhone });
  }, [profile.data]);

  const updateProfile = trpc.users.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("Dados do perfil atualizados.");
      utils.users.profile.invalidate();
      utils.auth.me.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const uploadAvatar = trpc.users.uploadAvatar.useMutation({
    onSuccess: () => {
      toast.success("Foto de perfil atualizada.");
      utils.users.profile.invalidate();
      utils.auth.me.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const changeOwnPassword = trpc.users.changeOwnLocalPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha local atualizada com segurança.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmation: "" });
      utils.users.passwordPolicy.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const submitProfile = (event: FormEvent) => {
    event.preventDefault();
    updateProfile.mutate(form);
  };
  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmation) {
      toast.error("A confirmação da nova senha não confere.");
      return;
    }
    changeOwnPassword.mutate({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
  };
  const selectAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!avatarMimeTypes.includes(file.type as (typeof avatarMimeTypes)[number])) return toast.error("Selecione uma imagem JPG, PNG ou WEBP.");
    if (file.size > 2 * 1024 * 1024) return toast.error("A foto de perfil deve ter até 2 MB.");
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const dataBase64 = result.split(",")[1];
      if (!dataBase64) return toast.error("Não foi possível preparar a imagem selecionada.");
      uploadAvatar.mutate({ originalName: file.name, mimeType: file.type as (typeof avatarMimeTypes)[number], dataBase64 });
    };
    reader.onerror = () => toast.error("Não foi possível ler a imagem selecionada.");
    reader.readAsDataURL(file);
  };

  const displayName = form.name || "Paulo Oliveira";
  const currentJob = jobLabel(profile.data?.jobTitle, profile.data?.role);
  if (profile.isLoading) return <div className="grid min-h-[340px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return <div className="mx-auto max-w-4xl">
    <header className="flex gap-4 border-b border-border pb-6"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white shadow-sm"><UserRound className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">Conta e segurança</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Meu perfil</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Mantenha seus dados de identificação atualizados para a operação do Trade HUB.</p></div></header>
    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.72fr]">
      <form onSubmit={submitProfile} className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-semibold text-foreground">Dados pessoais</h2></div><p className="mt-1 text-xs leading-5 text-muted-foreground">O nome e telefone ficam disponíveis para identificação operacional e trilhas de auditoria.</p><div className="mt-5 flex items-center gap-4 rounded-xl bg-secondary/70 p-4"><Avatar className="h-16 w-16 border-2 border-background shadow-sm"><AvatarImage src={profile.data?.avatarUrl ?? undefined} alt={`Foto de ${displayName}`} /><AvatarFallback className="bg-primary text-lg font-semibold text-white">{displayName.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{displayName}</p><p className="mt-0.5 text-xs text-muted-foreground">Cargo: {currentJob}</p><input ref={avatarInputRef} onChange={selectAvatar} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label="Selecionar foto de perfil" /><Button type="button" variant="outline" size="sm" disabled={uploadAvatar.isPending} onClick={() => avatarInputRef.current?.click()} className="mt-2 bg-background">{uploadAvatar.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Camera className="mr-1.5 h-3.5 w-3.5" />}{uploadAvatar.isPending ? "Enviando" : "Alterar foto"}</Button></div></div><p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Upload className="h-3.5 w-3.5" /> JPG, PNG ou WEBP de até 2 MB.</p><div className="mt-5 grid gap-4"><div><Label htmlFor="profile-name">Nome completo</Label><Input id="profile-name" required minLength={2} maxLength={160} className="mt-1.5" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></div><div><Label htmlFor="profile-email">E-mail de acesso</Label><Input id="profile-email" disabled value={profile.data?.email ?? "Não informado pelo provedor"} className="mt-1.5 bg-secondary" /><p className="mt-1.5 text-[11px] text-muted-foreground">O e-mail de acesso só pode ser alterado por uma pessoa administradora.</p></div><div><Label htmlFor="profile-phone">Telefone</Label><Input id="profile-phone" type="tel" maxLength={32} placeholder="(31) 99999-9999" className="mt-1.5" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></div></div><Button type="submit" disabled={updateProfile.isPending || !form.name.trim()} className="mt-6 bg-primary hover:bg-primary/90">{updateProfile.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}Salvar alterações</Button></form>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-semibold text-foreground">Acesso e senha</h2></div><dl className="mt-5 space-y-4 text-sm"><div className="rounded-xl bg-secondary p-3"><dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Cargo atual</dt><dd className="mt-1 font-semibold text-foreground">{currentJob}</dd></div><div className="rounded-xl bg-secondary p-3"><dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Método de acesso</dt><dd className="mt-1 font-semibold text-foreground">{profile.data?.loginMethod === "local" ? "E-mail e senha local" : "Autenticação institucional Manus"}</dd></div></dl>{passwordPolicy.data?.canChangePasswordHere ? <form onSubmit={submitPassword} className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-sm font-semibold text-foreground">Trocar senha local</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Use ao menos 12 caracteres, incluindo letras maiúsculas, minúsculas e números.</p><div className="mt-4 grid gap-3"><div><Label htmlFor="current-local-password">Senha atual</Label><Input id="current-local-password" type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={event => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required /></div><div><Label htmlFor="new-local-password">Nova senha</Label><Input id="new-local-password" type="password" autoComplete="new-password" minLength={12} value={passwordForm.newPassword} onChange={event => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} required /></div><div><Label htmlFor="confirm-local-password">Confirmar nova senha</Label><Input id="confirm-local-password" type="password" autoComplete="new-password" minLength={12} value={passwordForm.confirmation} onChange={event => setPasswordForm({ ...passwordForm, confirmation: event.target.value })} required /></div></div><Button type="submit" disabled={changeOwnPassword.isPending} className="mt-4 bg-primary hover:bg-primary/90">{changeOwnPassword.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1.5 h-4 w-4" />}Atualizar senha</Button></form> : <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-sm font-semibold text-foreground">Senha protegida pelo provedor</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{passwordPolicy.data?.message ?? "Sua senha é administrada pelo provedor de acesso institucional."}</p><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Para alterar a senha, utilize exclusivamente os canais oficiais do provedor de acesso.</p></div>}</section>
    </div>
  </div>;
}
