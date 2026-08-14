import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { BadgeCheck, Camera, Crop, KeyRound, Loader2, Save, UserRound } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

function roleLabel(role?: string) {
  if (role === "admin") return "Administrador";
  if (role === "regional_manager") return "Gestor regional";
  if (role === "operator") return "Operador";
  if (role === "team_member") return "Membro de equipe";
  if (role === "user") return "Usuário";
  return "Visualizador";
}

function jobLabel(jobTitle?: string | null, role?: string) {
  return jobTitle?.trim() || roleLabel(role);
}

function ProfileAvatarEditor({ avatarUrl, onUploaded }: { avatarUrl?: string | null; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [offsetX, setOffsetX] = useState(50);
  const [offsetY, setOffsetY] = useState(50);
  const uploadAvatar = trpc.users.uploadAvatar.useMutation({
    onSuccess: () => { toast.success("Foto de perfil atualizada."); setSource(null); setDimensions(null); onUploaded(); },
    onError: error => toast.error(error.message),
  });

  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("Envie uma imagem JPG, PNG ou WEBP."); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("A foto deve ter no máximo 2 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const image = new Image();
      image.onload = () => { setSource(dataUrl); setDimensions({ width: image.naturalWidth, height: image.naturalHeight }); setOffsetX(50); setOffsetY(50); };
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const uploadCroppedImage = () => {
    if (!source || !dimensions) return;
    const image = new Image();
    image.onload = () => {
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const sourceX = Math.round((image.naturalWidth - side) * (offsetX / 100));
      const sourceY = Math.round((image.naturalHeight - side) * (offsetY / 100));
      const canvas = document.createElement("canvas");
      canvas.width = 512; canvas.height = 512;
      canvas.getContext("2d")?.drawImage(image, sourceX, sourceY, side, side, 0, 0, 512, 512);
      canvas.toBlob(blob => {
        if (!blob) { toast.error("Não foi possível preparar a imagem."); return; }
        const reader = new FileReader();
        reader.onload = () => uploadAvatar.mutate({ originalName: "foto-perfil.webp", mimeType: "image/webp", dataBase64: String(reader.result).split(",")[1] ?? "" });
        reader.readAsDataURL(blob);
      }, "image/webp", 0.9);
    };
    image.src = source;
  };

  const needsCrop = Boolean(dimensions && dimensions.width !== dimensions.height);
  const preview = source ?? avatarUrl;
  return <section className="mt-5 rounded-xl border border-border bg-secondary/45 p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-background text-primary">{preview ? <img src={preview} alt="Prévia da foto de perfil" className="h-full w-full object-contain" /> : <UserRound className="h-8 w-8" />}</span><div className="min-w-0"><p className="font-semibold text-foreground">Foto de perfil</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Use JPG, PNG ou WEBP de até 2 MB. Imagens retangulares podem ser ajustadas antes do envio.</p><input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} /><Button type="button" variant="outline" className="mt-3 border-border" onClick={() => inputRef.current?.click()}><Camera className="mr-1.5 h-4 w-4" />Escolher foto</Button></div></div>{source && <div className="mt-4 rounded-lg border border-border bg-background p-3"><div className="flex items-center gap-2"><Crop className="h-4 w-4 text-primary" /><p className="text-sm font-semibold text-foreground">Ajuste de recorte</p></div><p className="mt-1 text-xs text-muted-foreground">A imagem será salva em formato quadrado para uso consistente nos avatares.</p>{needsCrop && <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-medium text-foreground">Posição horizontal<Input className="mt-1" type="range" min="0" max="100" value={offsetX} onChange={event => setOffsetX(Number(event.target.value))} /></label><label className="text-xs font-medium text-foreground">Posição vertical<Input className="mt-1" type="range" min="0" max="100" value={offsetY} onChange={event => setOffsetY(Number(event.target.value))} /></label></div>}<div className="mt-3 flex justify-end"><Button type="button" disabled={uploadAvatar.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={uploadCroppedImage}>{uploadAvatar.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}Salvar foto</Button></div></div>}</section>;
}

export default function ProfileWorkspace() {
  const utils = trpc.useUtils();
  const profile = trpc.users.profile.useQuery();
  const passwordPolicy = trpc.users.passwordPolicy.useQuery();
  const [form, setForm] = useState({ name: "", phone: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmation: "" });

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
  const displayName = form.name || "Paulo Oliveira";
  const currentJob = jobLabel(profile.data?.jobTitle, profile.data?.role);
  if (profile.isLoading) return <div className="grid min-h-[340px] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return <div className="mx-auto max-w-4xl">
    <header className="flex gap-4 border-b border-border pb-6"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white shadow-sm"><UserRound className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">Conta e segurança</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Meu perfil</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Mantenha seus dados de identificação atualizados para a operação do Marketing HUB.</p></div></header>
    <ProfileAvatarEditor avatarUrl={profile.data?.avatarUrl} onUploaded={() => { utils.users.profile.invalidate(); utils.auth.me.invalidate(); }} />
    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.72fr]">
      <form onSubmit={submitProfile} className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-semibold text-foreground">Dados pessoais</h2></div><p className="mt-1 text-xs leading-5 text-muted-foreground">O nome e telefone ficam disponíveis para identificação operacional e trilhas de auditoria.</p><div className="mt-5 rounded-xl bg-secondary/70 p-4"><p className="truncate text-sm font-semibold text-foreground">{displayName}</p><p className="mt-0.5 text-xs text-muted-foreground">Cargo: {currentJob}</p></div><div className="mt-5 grid gap-4"><div><Label htmlFor="profile-name">Nome completo</Label><Input id="profile-name" required minLength={2} maxLength={160} className="mt-1.5" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></div><div><Label htmlFor="profile-email">E-mail de acesso</Label><Input id="profile-email" disabled value={profile.data?.email ?? "Não informado pelo provedor"} className="mt-1.5 bg-secondary" /><p className="mt-1.5 text-[11px] text-muted-foreground">O e-mail de acesso só pode ser alterado por uma pessoa administradora.</p></div><div><Label htmlFor="profile-phone">Telefone</Label><Input id="profile-phone" type="tel" maxLength={32} placeholder="(31) 99999-9999" className="mt-1.5" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></div></div><Button type="submit" disabled={updateProfile.isPending || !form.name.trim()} className="mt-6 bg-primary hover:bg-primary/90">{updateProfile.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}Salvar alterações</Button></form>
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-semibold text-foreground">Acesso e senha</h2></div><dl className="mt-5 space-y-4 text-sm"><div className="rounded-xl bg-secondary p-3"><dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Cargo atual</dt><dd className="mt-1 font-semibold text-foreground">{currentJob}</dd></div><div className="rounded-xl bg-secondary p-3"><dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Método de acesso</dt><dd className="mt-1 font-semibold text-foreground">{profile.data?.loginMethod === "local" ? "E-mail e senha local" : "Autenticação institucional Manus"}</dd></div></dl>{passwordPolicy.data?.canChangePasswordHere ? <form onSubmit={submitPassword} className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-sm font-semibold text-foreground">Redefinir senha</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Crie uma nova senha com ao menos 12 caracteres, incluindo letras maiúsculas, minúsculas e números.</p><div className="mt-4 grid gap-3"><div><Label htmlFor="current-local-password">Senha atual</Label><Input id="current-local-password" type="password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={event => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} required /></div><div><Label htmlFor="new-local-password">Nova senha</Label><Input id="new-local-password" type="password" autoComplete="new-password" minLength={12} value={passwordForm.newPassword} onChange={event => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} required /></div><div><Label htmlFor="confirm-local-password">Confirmar nova senha</Label><Input id="confirm-local-password" type="password" autoComplete="new-password" minLength={12} value={passwordForm.confirmation} onChange={event => setPasswordForm({ ...passwordForm, confirmation: event.target.value })} required /></div></div><Button type="submit" disabled={changeOwnPassword.isPending} className="mt-4 bg-primary hover:bg-primary/90">{changeOwnPassword.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1.5 h-4 w-4" />}Redefinir senha</Button></form> : <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-sm font-semibold text-foreground">Senha protegida pelo provedor</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{passwordPolicy.data?.message ?? "Sua senha é administrada pelo provedor de acesso institucional."}</p><p className="mt-2 text-[11px] leading-5 text-muted-foreground">Para redefinir a senha, utilize exclusivamente os canais oficiais do provedor de acesso.</p></div>}</section>
    </div>
  </div>;
}
