import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Plus,
  Filter,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Video,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit3,
  ExternalLink,
  Sparkles,
  Layers,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  ThumbsUp,
  MapPin,
  Store,
  Eye,
  RefreshCw,
} from "lucide-react";
import { WorkspaceHeader, WorkspaceShell, WorkspaceSection } from "@/components/WorkspaceChrome";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";

const platformColors: Record<string, { label: string; badge: string; color: string }> = {
  instagram: { label: "Instagram", badge: "bg-pink-600 text-white", color: "#E1306C" },
  facebook: { label: "Facebook", badge: "bg-blue-600 text-white", color: "#1877F2" },
  linkedin: { label: "LinkedIn", badge: "bg-sky-700 text-white", color: "#0A66C2" },
  tiktok: { label: "TikTok", badge: "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900", color: "#000000" },
  google_business: { label: "Google Negócio", badge: "bg-amber-600 text-white", color: "#EA4335" },
};

const statusConfig: Record<string, { label: string; badge: string; icon: any }> = {
  scheduled: { label: "Agendado", badge: "bg-sky-500/10 text-sky-600 border-sky-300 dark:border-sky-800", icon: Clock },
  published: { label: "Publicado", badge: "bg-emerald-500/10 text-emerald-600 border-emerald-300 dark:border-emerald-800", icon: CheckCircle2 },
  publishing: { label: "Enviando...", badge: "bg-amber-500/10 text-amber-600 border-amber-300 dark:border-amber-800", icon: RefreshCw },
  failed: { label: "Falha", badge: "bg-rose-500/10 text-rose-600 border-rose-300 dark:border-rose-800", icon: AlertCircle },
  draft: { label: "Rascunho", badge: "bg-muted text-muted-foreground border-border", icon: Edit3 },
  cancelled: { label: "Cancelado", badge: "bg-muted text-muted-foreground", icon: AlertCircle },
};

export default function SocialCalendarWorkspace() {
  const utils = trpc.useUtils();
  const accountsQuery = trpc.social.listAccounts.useQuery();
  const postsQuery = trpc.social.listPosts.useQuery({});

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  const [composeOpen, setComposeOpen] = useState(false);
  const [publishingId, setPublishingId] = useState<number | null>(null);

  // Form State
  const [form, setForm] = useState({
    title: "",
    content: "",
    postType: "feed" as const,
    targetAccountIds: [] as number[],
    mediaUrlInput: "",
    mediaUrls: [] as string[],
    scheduledDate: "",
    scheduledTime: "12:00",
    publishNow: false,
    gmbActionUrl: "",
    gmbActionType: "LEARN_MORE",
  });

  const createPostMutation = trpc.social.createPost.useMutation({
    onSuccess: () => {
      utils.social.listPosts.invalidate();
      setComposeOpen(false);
      resetComposeForm();
      toast.success("Post agendado com sucesso!");
    },
    onError: err => toast.error(err.message || "Erro ao agendar publicação."),
  });

  const publishNowMutation = trpc.social.publishPostNow.useMutation({
    onSuccess: () => {
      utils.social.listPosts.invalidate();
      toast.success("Post publicado nas contas de destino!");
    },
    onError: err => toast.error(err.message || "Falha ao publicar."),
  });

  const deletePostMutation = trpc.social.deletePost.useMutation({
    onSuccess: () => {
      utils.social.listPosts.invalidate();
      toast.success("Post excluído.");
    },
    onError: err => toast.error(err.message),
  });

  const resetComposeForm = () => {
    setForm({
      title: "",
      content: "",
      postType: "feed",
      targetAccountIds: [],
      mediaUrlInput: "",
      mediaUrls: [],
      scheduledDate: new Date().toISOString().split("T")[0],
      scheduledTime: "18:00",
      publishNow: false,
      gmbActionUrl: "",
      gmbActionType: "LEARN_MORE",
    });
  };

  const handleOpenCompose = () => {
    resetComposeForm();
    // Default select all active accounts or first
    const active = (accountsQuery.data || []).filter(a => a.isActive);
    if (active.length > 0) {
      setForm(f => ({ ...f, targetAccountIds: [active[0].id] }));
    }
    setComposeOpen(true);
  };

  const handleToggleAccount = (id: number) => {
    setForm(f => {
      const exists = f.targetAccountIds.includes(id);
      return {
        ...f,
        targetAccountIds: exists
          ? f.targetAccountIds.filter(x => x !== id)
          : [...f.targetAccountIds, id],
      };
    });
  };

  const handleAddMedia = () => {
    if (!form.mediaUrlInput.trim()) return;
    setForm(f => ({
      ...f,
      mediaUrls: [...f.mediaUrls, f.mediaUrlInput.trim()],
      mediaUrlInput: "",
    }));
  };

  const handleRemoveMedia = (index: number) => {
    setForm(f => ({
      ...f,
      mediaUrls: f.mediaUrls.filter((_, i) => i !== index),
    }));
  };

  const handlePublishNow = async (id: number) => {
    setPublishingId(id);
    try {
      await publishNowMutation.mutateAsync({ id });
    } finally {
      setPublishingId(null);
    }
  };

  // Filter posts
  const posts = postsQuery.data || [];
  const accounts = accountsQuery.data || [];

  const filteredPosts = useMemo(() => {
    return posts.filter(item => {
      if (selectedAccountId !== "all") {
        const accId = Number(selectedAccountId);
        if (!item.targetAccountIdsList?.includes(accId)) return false;
      }
      if (selectedStatus !== "all" && item.status !== selectedStatus) {
        return false;
      }
      return true;
    });
  }, [posts, selectedAccountId, selectedStatus]);

  // Calendar logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 is Sunday

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const monthName = currentDate.toLocaleString("pt-BR", { month: "long", year: "numeric" });

  // Map posts by date string: YYYY-MM-DD
  const postsByDate = useMemo(() => {
    const map = new Map<string, typeof posts>();
    filteredPosts.forEach(p => {
      const d = p.scheduledFor
        ? new Date(p.scheduledFor).toISOString().split("T")[0]
        : p.createdAt
          ? new Date(p.createdAt).toISOString().split("T")[0]
          : "";
      if (d) {
        if (!map.has(d)) map.set(d, []);
        map.get(d)!.push(p);
      }
    });
    return map;
  }, [filteredPosts]);

  return (
    <WorkspaceShell>
      <WorkspaceHeader
        eyebrow="Social Media Hub"
        title="Agendamento & Publicação"
        description="Planeje, aprove e agende publicações em múltiplos perfis simultaneamente com prévia em tempo real das redes sociais."
        icon={CalendarDays}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode(v => (v === "calendar" ? "list" : "calendar"))}
            >
              {viewMode === "calendar" ? "Ver em Lista" : "Ver em Calendário"}
            </Button>
            <Button size="sm" onClick={handleOpenCompose}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Post
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3">
          {/* Account Filter */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Filtrar por Conta:</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="Todas as Contas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Contas</SelectItem>
                {accounts.map(acc => (
                  <SelectItem key={acc.id} value={String(acc.id)}>
                    {acc.accountName} ({platformColors[acc.platform]?.label || acc.platform})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Status:</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Todos os Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="scheduled">Agendados</SelectItem>
                <SelectItem value="published">Publicados</SelectItem>
                <SelectItem value="draft">Rascunhos</SelectItem>
                <SelectItem value="failed">Com Falha</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Month Navigation for Calendar */}
        {viewMode === "calendar" && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-semibold text-foreground capitalize min-w-[130px] text-center">
              {monthName}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Main View: Calendar or List */}
      <div className="mt-5">
        {viewMode === "calendar" ? (
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            {/* Days of week header */}
            <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-semibold text-muted-foreground py-2.5">
              <span>Dom</span>
              <span>Seg</span>
              <span>Ter</span>
              <span>Qua</span>
              <span>Qui</span>
              <span>Sex</span>
              <span>Sáb</span>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 auto-rows-[140px] divide-x divide-y divide-border">
              {/* Empty leading cells */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-muted/10 p-2" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const dayPosts = postsByDate.get(dStr) || [];
                const isToday =
                  new Date().toISOString().split("T")[0] === dStr;

                return (
                  <div
                    key={`day-${dayNum}`}
                    className={`p-2 overflow-y-auto transition hover:bg-muted/20 ${
                      isToday ? "bg-primary/5" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-bold rounded-full h-5 w-5 grid place-items-center ${
                          isToday ? "bg-primary text-white" : "text-muted-foreground"
                        }`}
                      >
                        {dayNum}
                      </span>
                      {dayPosts.length > 0 && (
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {dayPosts.length} post{dayPosts.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    {/* Post Tiles inside Day */}
                    <div className="space-y-1">
                      {dayPosts.map(p => {
                        const sConf = statusConfig[p.status] || statusConfig.scheduled;
                        const firstMedia = p.mediaUrlsList?.[0];

                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              // Click to view post
                              toast.info(`Post #${p.id}: ${p.content.slice(0, 60)}...`);
                            }}
                            className="group p-1.5 rounded-md border border-border/80 bg-background/80 hover:bg-background text-xs cursor-pointer shadow-xs hover:border-primary/40 transition"
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {p.scheduledFor
                                  ? new Date(p.scheduledFor).toLocaleTimeString("pt-BR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "Rascunho"}
                              </span>
                              <Badge className={`text-[9px] px-1 py-0 h-4 ${sConf.badge}`}>
                                {sConf.label}
                              </Badge>
                            </div>

                            <p className="line-clamp-2 text-[11px] leading-tight text-foreground group-hover:text-primary">
                              {p.content}
                            </p>

                            {/* Network Dispatches Badges */}
                            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                              {p.dispatches?.map((d: any) => {
                                const pConf = platformColors[d.accountPlatform] || {
                                  label: d.accountPlatform,
                                  badge: "bg-muted text-foreground",
                                };
                                return (
                                  <span
                                    key={d.id}
                                    title={`${d.accountName} (${pConf.label})`}
                                    className={`text-[9px] px-1 py-0 rounded font-bold ${pConf.badge}`}
                                  >
                                    {pConf.label.slice(0, 2).toUpperCase()}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* List / Feed View */
          <div className="space-y-3">
            {filteredPosts.length === 0 ? (
              <Card className="p-8 text-center border-dashed border-2 border-border bg-card/40">
                <p className="text-sm text-muted-foreground">Nenhuma publicação encontrada para o filtro selecionado.</p>
              </Card>
            ) : (
              filteredPosts.map(p => {
                const sConf = statusConfig[p.status] || statusConfig.scheduled;
                const StatusIcon = sConf.icon;
                const isPublishing = publishingId === p.id;

                return (
                  <Card key={p.id} className="border-border bg-card shadow-sm p-4 hover:border-primary/30 transition">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      {/* Left: Thumbnail & Copy */}
                      <div className="flex items-start gap-4 flex-1">
                        {p.mediaUrlsList?.[0] ? (
                          <img
                            src={p.mediaUrlsList[0]}
                            alt="Mídia"
                            className="h-16 w-16 rounded-lg object-cover border border-border shrink-0"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-lg bg-muted grid place-items-center text-muted-foreground shrink-0 border border-border">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={sConf.badge}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {sConf.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                              <Clock className="h-3 w-3" />
                              {p.scheduledFor
                                ? new Date(p.scheduledFor).toLocaleString("pt-BR")
                                : "Não agendado"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              por {p.authorName || "Sistema"}
                            </span>
                          </div>

                          <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                            {p.content}
                          </p>

                          {/* Network Pills */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <span className="text-xs text-muted-foreground">Destinos:</span>
                            {p.dispatches?.map((d: any) => {
                              const pConf = platformColors[d.accountPlatform] || {
                                label: d.accountPlatform,
                                badge: "bg-muted text-foreground",
                              };
                              return (
                                <Badge key={d.id} className={`text-xs ${pConf.badge}`}>
                                  {d.accountName} ({pConf.label})
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        {p.status !== "published" && (
                          <Button
                            size="sm"
                            variant="default"
                            disabled={isPublishing}
                            onClick={() => handlePublishNow(p.id)}
                          >
                            <Send className={`h-3.5 w-3.5 mr-1.5 ${isPublishing ? "animate-spin" : ""}`} />
                            Publicar Agora
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                          onClick={() => deletePostMutation.mutate({ id: p.id })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Modal: New Post Composer (mLabs Style with Live Preview) */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-primary" />
              Compositor de Post Multi-Redes
            </DialogTitle>
            <DialogDescription>
              Crie o conteúdo uma única vez e visualize a prévia exata em cada rede social selecionada.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-3">
            {/* Left 7 Cols: Editor */}
            <div className="lg:col-span-7 space-y-4">
              {/* Account Selection */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  1. Selecione as Redes e Contas de Destino:
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 rounded-lg border border-border bg-muted/20">
                  {accounts.map(acc => {
                    const isSelected = form.targetAccountIds.includes(acc.id);
                    const pConf = platformColors[acc.platform] || { label: acc.platform, color: "#666" };
                    return (
                      <label
                        key={acc.id}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition text-xs ${
                          isSelected
                            ? "border-primary bg-primary/10 font-semibold"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleAccount(acc.id)}
                          className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: pConf.color }}
                        />
                        <span className="truncate flex-1">{acc.accountName}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{pConf.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Post Type & Format */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Formato da Publicação</Label>
                  <Select
                    value={form.postType}
                    onValueChange={(val: any) => setForm(f => ({ ...f, postType: val }))}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feed">Feed / Imagem</SelectItem>
                      <SelectItem value="reel">Reels / TikTok Vídeo</SelectItem>
                      <SelectItem value="carousel">Carrossel de Imagens</SelectItem>
                      <SelectItem value="story">Story</SelectItem>
                      <SelectItem value="gmb_update">Novidade Google Meu Negócio</SelectItem>
                      <SelectItem value="gmb_offer">Oferta Especial Google</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Título / Rótulo Interno (Opcional)</Label>
                  <Input
                    placeholder="Ex: Campanha Black Friday Fibra"
                    className="h-9 text-xs"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  />
                </div>
              </div>

              {/* Content / Caption Editor */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    2. Legenda / Conteúdo:
                  </Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {form.content.length} caracteres
                  </span>
                </div>
                <Textarea
                  rows={5}
                  required
                  placeholder="Escreva a legenda aqui... Use #hashtags e emojis para aumentar o engajamento!"
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  className="resize-none text-sm"
                />
              </div>

              {/* Media Attachments */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  3. Mídias (Imagens / Vídeos):
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="URL pública da imagem ou vídeo (https://...)"
                    className="h-9 text-xs flex-1"
                    value={form.mediaUrlInput}
                    onChange={e => setForm(f => ({ ...f, mediaUrlInput: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddMedia();
                      }
                    }}
                  />
                  <Button type="button" size="sm" variant="secondary" onClick={handleAddMedia}>
                    Adicionar
                  </Button>
                </div>

                {form.mediaUrls.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {form.mediaUrls.map((url, i) => (
                      <div key={i} className="relative group rounded-md overflow-hidden border border-border">
                        <img src={url} alt="Thumbnail" className="h-12 w-12 object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(i)}
                          className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Google Meu Negócio Call-To-Action (if selected) */}
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-2">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5" /> Botão de Ação do Google Meu Negócio
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={form.gmbActionType}
                    onValueChange={val => setForm(f => ({ ...f, gmbActionType: val }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEARN_MORE">Saiba Mais</SelectItem>
                      <SelectItem value="CALL">Ligue Agora</SelectItem>
                      <SelectItem value="ORDER">Fazer Pedido</SelectItem>
                      <SelectItem value="SIGN_UP">Cadastre-se</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="https://onnetmais.com.br/planos"
                    className="h-8 text-xs"
                    value={form.gmbActionUrl}
                    onChange={e => setForm(f => ({ ...f, gmbActionUrl: e.target.value }))}
                  />
                </div>
              </div>

              {/* Scheduling Options */}
              <div className="pt-2 border-t border-border">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  4. Data e Horário de Publicação:
                </Label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="schedule-type"
                      checked={form.publishNow}
                      onChange={() => setForm(f => ({ ...f, publishNow: true }))}
                      className="text-primary"
                    />
                    Publicar Agora Imediatamente
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="schedule-type"
                      checked={!form.publishNow}
                      onChange={() => setForm(f => ({ ...f, publishNow: false }))}
                      className="text-primary"
                    />
                    Agendar para mais tarde
                  </label>
                </div>

                {!form.publishNow && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <Input
                      type="date"
                      className="h-9 text-xs"
                      value={form.scheduledDate}
                      onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
                    />
                    <Input
                      type="time"
                      className="h-9 text-xs"
                      value={form.scheduledTime}
                      onChange={e => setForm(f => ({ ...f, scheduledTime: e.target.value }))}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right 5 Cols: Live Social Media Preview Tabs */}
            <div className="lg:col-span-5 bg-muted/30 rounded-xl p-4 border border-border flex flex-col">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-primary" />
                Prévia da Postagem:
              </Label>

              <Tabs defaultValue="instagram" className="w-full flex-1 flex flex-col">
                <TabsList className="grid grid-cols-4 bg-muted/60 h-8 p-0.5">
                  <TabsTrigger value="instagram" className="text-[11px]">Instagram</TabsTrigger>
                  <TabsTrigger value="linkedin" className="text-[11px]">LinkedIn</TabsTrigger>
                  <TabsTrigger value="tiktok" className="text-[11px]">TikTok</TabsTrigger>
                  <TabsTrigger value="gmb" className="text-[11px]">Google</TabsTrigger>
                </TabsList>

                {/* Instagram Preview */}
                <TabsContent value="instagram" className="mt-3 flex-1 flex items-center justify-center">
                  <div className="w-full max-w-[280px] rounded-2xl border border-border bg-card overflow-hidden shadow-lg text-xs">
                    {/* Header */}
                    <div className="flex items-center gap-2 p-2.5 border-b border-border/50">
                      <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[1.5px]">
                        <div className="h-full w-full rounded-full bg-background grid place-items-center text-[10px] font-bold">
                          ON
                        </div>
                      </div>
                      <span className="font-semibold text-[11px]">onnettelecom</span>
                    </div>

                    {/* Image / Media */}
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                      {form.mediaUrls[0] ? (
                        <img src={form.mediaUrls[0]} alt="Post" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                      )}
                    </div>

                    {/* Interaction Bar */}
                    <div className="p-2 space-y-1">
                      <div className="flex items-center justify-between text-foreground">
                        <div className="flex items-center gap-2.5">
                          <Heart className="h-4 w-4" />
                          <MessageCircle className="h-4 w-4" />
                          <Share2 className="h-4 w-4" />
                        </div>
                        <Bookmark className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-[10px] block">1.482 curtidas</span>
                      <p className="text-[11px] leading-tight line-clamp-3">
                        <span className="font-semibold mr-1">onnettelecom</span>
                        {form.content || "Sua legenda aparecerá aqui..."}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* LinkedIn Preview */}
                <TabsContent value="linkedin" className="mt-3 flex-1 flex items-center justify-center">
                  <div className="w-full max-w-[300px] rounded-xl border border-border bg-card overflow-hidden shadow-lg text-xs p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded bg-sky-700 text-white font-bold grid place-items-center text-xs">
                        ON
                      </div>
                      <div>
                        <span className="font-semibold block text-[11px] leading-tight">OnNet Telecom</span>
                        <span className="text-[9px] text-muted-foreground">Telecomunicações • Agora</span>
                      </div>
                    </div>

                    <p className="text-[11px] leading-relaxed line-clamp-3">
                      {form.content || "Texto profissional para o LinkedIn..."}
                    </p>

                    <div className="aspect-video bg-muted rounded overflow-hidden flex items-center justify-center">
                      {form.mediaUrls[0] ? (
                        <img src={form.mediaUrls[0]} alt="LinkedIn" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                      )}
                    </div>

                    <div className="pt-2 border-t border-border/50 flex items-center justify-between text-muted-foreground text-[10px]">
                      <span className="flex items-center gap-1"><ThumbsUp className="h-3 w-3" /> Gostei</span>
                      <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> Comentar</span>
                      <span className="flex items-center gap-1"><Share2 className="h-3 w-3" /> Compartilhar</span>
                    </div>
                  </div>
                </TabsContent>

                {/* TikTok Preview */}
                <TabsContent value="tiktok" className="mt-3 flex-1 flex items-center justify-center">
                  <div className="w-[220px] aspect-[9/16] rounded-2xl bg-neutral-950 text-white overflow-hidden shadow-xl relative flex flex-col justify-between p-3 text-xs">
                    {form.mediaUrls[0] ? (
                      <img src={form.mediaUrls[0]} alt="TikTok" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center text-neutral-600">
                        <Video className="h-12 w-12" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                    <div className="relative z-10 flex justify-between items-center text-[10px] text-neutral-300">
                      <span>Para você</span>
                      <span>TikTok</span>
                    </div>

                    <div className="relative z-10 space-y-1">
                      <span className="font-bold text-[11px] block">@onnettelecom</span>
                      <p className="text-[10px] line-clamp-2 text-neutral-200">
                        {form.content || "Descrição do vídeo #foryou #fibra"}
                      </p>
                      <span className="text-[9px] text-neutral-400 flex items-center gap-1">
                        🎵 Som original - OnNet Telecom
                      </span>
                    </div>
                  </div>
                </TabsContent>

                {/* Google Meu Negócio Preview */}
                <TabsContent value="gmb" className="mt-3 flex-1 flex items-center justify-center">
                  <div className="w-full max-w-[290px] rounded-xl border border-border bg-card p-3 shadow-lg text-xs space-y-2">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-amber-600" />
                      <span className="font-bold text-[11px]">OnNet Telecom - Patrocínio</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-300">
                      Novidade no Perfil do Google
                    </Badge>
                    <div className="aspect-video bg-muted rounded overflow-hidden flex items-center justify-center">
                      {form.mediaUrls[0] ? (
                        <img src={form.mediaUrls[0]} alt="GMB" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                      )}
                    </div>
                    <p className="text-[11px] leading-tight line-clamp-2">
                      {form.content || "Novidades da sua loja local..."}
                    </p>
                    <Button size="sm" variant="outline" className="w-full h-7 text-xs border-primary text-primary">
                      {form.gmbActionType === "CALL" ? "Ligar Agora" : "Saiba Mais"}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <DialogFooter className="mt-4 pt-3 border-t border-border flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              {form.targetAccountIds.length} conta(s) selecionada(s)
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setComposeOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={
                  createPostMutation.isPending ||
                  !form.content.trim() ||
                  form.targetAccountIds.length === 0
                }
                onClick={() => {
                  let scheduleDate: Date | null = null;
                  if (!form.publishNow && form.scheduledDate) {
                    scheduleDate = new Date(`${form.scheduledDate}T${form.scheduledTime || "12:00"}:00`);
                  }
                  createPostMutation.mutate({
                    title: form.title,
                    content: form.content,
                    postType: form.postType,
                    mediaUrls: form.mediaUrls,
                    targetAccountIds: form.targetAccountIds,
                    scheduledFor: scheduleDate,
                    publishNow: form.publishNow,
                    gmbActionUrl: form.gmbActionUrl,
                    gmbActionType: form.gmbActionType,
                  });
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                {form.publishNow ? "Publicar Agora" : "Agendar Post"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceShell>
  );
}
