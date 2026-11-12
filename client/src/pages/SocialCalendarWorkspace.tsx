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
  Copy,
  FileText,
  Play,
  Check,
  ListOrdered,
  Flame,
  DownloadCloud,
  Wand2,
  Calendar as CalendarIcon,
  Film,
  Instagram,
  Facebook,
  Linkedin,
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

const pilarPresets = [
  "🦹‍♂️ Os Vilões da Conexão",
  "💡 Você fala Tech?",
  "🛒 Black Friday Conectada",
  "🎮 Gamer & Combo Gamer",
  "📺 Globoplay Premium",
  "🩺 Novembro Azul & MediQuo",
  "☕ Humor & Home Office",
  "📲 Stories & Enquetes",
  "🎬 Vida com Alta Velocidade",
  "🏆 Por que a OnNet?",
  "🚀 Dica de Especialista",
  "⚡ Institucional & Comunidade",
];

export default function SocialCalendarWorkspace() {
  const utils = trpc.useUtils();
  const accountsQuery = trpc.social.listAccounts.useQuery();
  const postsQuery = trpc.social.listPosts.useQuery({});
  const editorialQuery = trpc.social.listEditorialPautas.useQuery();

  const [activeTab, setActiveTab] = useState<"calendar" | "editorial" | "list">("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Day drawer/modal state
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);

  // Editorial tab filters
  const [editorialPilarFilter, setEditorialPilarFilter] = useState<string>("all");
  const [editorialBrandFilter, setEditorialBrandFilter] = useState<string>("all");
  const [editorialFormatFilter, setEditorialFormatFilter] = useState<string>("all");
  const [viewScriptModalItem, setViewScriptModalItem] = useState<any | null>(null);

  // Compose Post state
  const [composeOpen, setComposeOpen] = useState(false);
  const [publishingId, setPublishingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    id: undefined as number | undefined,
    title: "",
    content: "",
    firstComment: "",
    pilar: "",
    brand: "onnet",
    postType: "feed" as "feed" | "reel" | "story" | "carousel" | "article" | "gmb_update" | "gmb_offer",
    targetAccountIds: [] as number[],
    mediaUrlInput: "",
    mediaUrls: [] as string[],
    scheduledDate: "",
    scheduledTime: "12:00",
    publishNow: false,
    gmbActionUrl: "",
    gmbActionType: "LEARN_MORE",
    script: [] as Array<{ time?: string; visual: string; audio?: string; text?: string }>,
  });

  // AI Assistant Modal State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiForm, setAiForm] = useState({
    prompt: "",
    network: "instagram" as const,
    postType: "reel" as const,
    pilar: "🦹‍♂️ Os Vilões da Conexão",
    brand: "onnet",
    tone: "Descontraído & Didático",
  });
  const [aiResult, setAiResult] = useState<any | null>(null);

  // Mutations
  const createPostMutation = trpc.social.createPost.useMutation({
    onSuccess: () => {
      utils.social.listPosts.invalidate();
      utils.social.listEditorialPautas.invalidate();
      setComposeOpen(false);
      resetComposeForm();
      toast.success("Publicação salva com sucesso!");
    },
    onError: err => toast.error(err.message || "Erro ao salvar publicação."),
  });

  const updatePostMutation = trpc.social.updatePost.useMutation({
    onSuccess: () => {
      utils.social.listPosts.invalidate();
      utils.social.listEditorialPautas.invalidate();
      setComposeOpen(false);
      resetComposeForm();
      toast.success("Publicação atualizada com sucesso!");
    },
    onError: err => toast.error(err.message || "Erro ao atualizar publicação."),
  });

  const publishNowMutation = trpc.social.publishPostNow.useMutation({
    onSuccess: () => {
      utils.social.listPosts.invalidate();
      toast.success("Post publicado nas contas de destino com sucesso!");
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

  const importMetaMutation = trpc.social.importFromMeta.useMutation({
    onSuccess: res => {
      utils.social.listPosts.invalidate();
      toast.success(res.message || "Publicações importadas da Meta com sucesso!");
    },
    onError: err => toast.error(err.message || "Erro ao importar posts da Meta."),
  });

  const importEditorialMutation = trpc.social.importEditorialDataset.useMutation({
    onSuccess: res => {
      utils.social.listEditorialPautas.invalidate();
      utils.social.listPosts.invalidate();
      toast.success(res.message || "Pautas importadas com sucesso!");
    },
    onError: err => toast.error(err.message || "Erro ao importar pautas."),
  });

  const generateAiMutation = trpc.social.generateAiContent.useMutation({
    onSuccess: data => {
      setAiResult(data);
      toast.success("Conteúdo gerado com IA!");
    },
    onError: err => toast.error(err.message || "Erro na geração com IA."),
  });

  const resetComposeForm = () => {
    setForm({
      id: undefined,
      title: "",
      content: "",
      firstComment: "",
      pilar: "",
      brand: "onnet",
      postType: "feed",
      targetAccountIds: [],
      mediaUrlInput: "",
      mediaUrls: [],
      scheduledDate: new Date().toISOString().split("T")[0],
      scheduledTime: "18:00",
      publishNow: false,
      gmbActionUrl: "",
      gmbActionType: "LEARN_MORE",
      script: [],
    });
  };

  const handleOpenCompose = (datePrefill?: string) => {
    resetComposeForm();
    const active = (accountsQuery.data || []).filter(a => a.isActive);
    const targetAccountIds = active.length > 0 ? [active[0].id] : [];
    setForm(f => ({
      ...f,
      targetAccountIds,
      scheduledDate: datePrefill || new Date().toISOString().split("T")[0],
    }));
    setComposeOpen(true);
  };

  const handleOpenEdit = (post: any) => {
    let dateStr = "";
    let timeStr = "12:00";
    if (post.scheduledFor) {
      const dt = new Date(post.scheduledFor);
      dateStr = dt.toISOString().split("T")[0];
      timeStr = dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }

    setForm({
      id: post.id > 0 ? post.id : undefined,
      title: post.title || "",
      content: post.content || "",
      firstComment: post.firstComment || "",
      pilar: post.pilar || "",
      brand: post.brand || "onnet",
      postType: post.postType || "feed",
      targetAccountIds: post.targetAccountIdsList || [],
      mediaUrlInput: "",
      mediaUrls: post.mediaUrlsList || [],
      scheduledDate: dateStr,
      scheduledTime: timeStr,
      publishNow: false,
      gmbActionUrl: post.gmbActionUrl || "",
      gmbActionType: post.gmbActionType || "LEARN_MORE",
      script: post.scriptParsed || [],
    });
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

  const handleApplyAiResult = () => {
    if (!aiResult) return;
    setForm(f => ({
      ...f,
      title: aiResult.hook ? aiResult.hook.slice(0, 80) : f.title,
      content: aiResult.caption || f.content,
      firstComment: aiResult.firstComment || f.firstComment,
      script: aiResult.script && aiResult.script.length > 0 ? aiResult.script : f.script,
      pilar: aiForm.pilar || f.pilar,
      brand: aiForm.brand || f.brand,
      postType: aiForm.postType === "reel" ? "reel" : aiForm.postType === "carousel" ? "carousel" : "feed",
    }));
    setAiModalOpen(false);
    toast.success("Conteúdo gerado inserido no formulário do post!");
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiada para a área de transferência!`);
  };

  // Filter posts
  const posts = postsQuery.data || [];
  const accounts = accountsQuery.data || [];
  const editorialItems = editorialQuery.data || [];

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
  const firstDayOfWeek = new Date(year, month, 1).getDay();

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

  // Selected Day Posts for Modal
  const selectedDayPosts = useMemo(() => {
    if (!selectedDayDate) return [];
    return postsByDate.get(selectedDayDate) || [];
  }, [selectedDayDate, postsByDate]);

  // Filtered Editorial Items
  const filteredEditorial = useMemo(() => {
    return editorialItems.filter(item => {
      if (editorialPilarFilter !== "all" && item.pilar !== editorialPilarFilter) return false;
      if (editorialBrandFilter !== "all") {
        const b = (item.brand || "").toLowerCase();
        if (editorialBrandFilter === "onnet" && !b.includes("onnet")) return false;
        if (editorialBrandFilter === "sempre" && !b.includes("sempre")) return false;
      }
      if (editorialFormatFilter !== "all") {
        const f = (item.postType || "").toLowerCase();
        if (editorialFormatFilter === "reel" && f !== "reel") return false;
        if (editorialFormatFilter === "carousel" && f !== "carousel") return false;
        if (editorialFormatFilter === "feed" && f !== "feed") return false;
        if (editorialFormatFilter === "story" && f !== "story") return false;
      }
      return true;
    });
  }, [editorialItems, editorialPilarFilter, editorialBrandFilter, editorialFormatFilter]);

  // Counts for pilares
  const pilarCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    editorialItems.forEach(item => {
      if (item.pilar) {
        counts[item.pilar] = (counts[item.pilar] || 0) + 1;
      }
    });
    return counts;
  }, [editorialItems]);

  return (
    <WorkspaceShell>
      <WorkspaceHeader
        eyebrow="Social Media Hub • Padrão SocialForge"
        title="Agendamento, Calendário & Pauta Editorial"
        description="Gestão completa de redes sociais, pauta audiovisual com roteiros cena a cena, IA integrada e sincronização via API da Meta."
        icon={CalendarDays}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Meta Sync Button */}
            <Button
              variant="outline"
              size="sm"
              disabled={importMetaMutation.isPending}
              onClick={() => importMetaMutation.mutate({})}
              title="Importar agendamentos e publicações diretamente da API do Facebook e Instagram"
              className="text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${importMetaMutation.isPending ? "animate-spin" : ""}`} />
              Sincronizar Meta (API)
            </Button>

            {/* View Mode Tabs */}
            <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5">
              <Button
                variant={activeTab === "calendar" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setActiveTab("calendar")}
              >
                <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                Calendário
              </Button>
              <Button
                variant={activeTab === "editorial" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setActiveTab("editorial")}
              >
                <Film className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                Pauta & Roteiros
              </Button>
              <Button
                variant={activeTab === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setActiveTab("list")}
              >
                <ListOrdered className="h-3.5 w-3.5 mr-1.5" />
                Lista
              </Button>
            </div>

            {/* Novo Post */}
            <Button size="sm" onClick={() => handleOpenCompose()} className="text-xs">
              <Plus className="h-4 w-4 mr-1.5" />
              Novo Post
            </Button>
          </div>
        }
      />

      {/* TAB 1: CALENDAR VIEW */}
      {activeTab === "calendar" && (
        <div className="mt-5 space-y-4">
          {/* Calendar Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-card">
            <div className="flex flex-wrap items-center gap-3">
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

            {/* Month Navigation */}
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
          </div>

          {/* Calendar Grid */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-semibold text-muted-foreground py-2.5">
              <span>Dom</span>
              <span>Seg</span>
              <span>Ter</span>
              <span>Qua</span>
              <span>Qui</span>
              <span>Sex</span>
              <span>Sáb</span>
            </div>

            <div className="grid grid-cols-7 auto-rows-[145px] divide-x divide-y divide-border">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-muted/10 p-2" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const dayPosts = postsByDate.get(dStr) || [];
                const isToday = new Date().toISOString().split("T")[0] === dStr;

                return (
                  <div
                    key={`day-${dayNum}`}
                    onClick={() => setSelectedDayDate(dStr)}
                    className={`p-2 overflow-y-auto transition cursor-pointer hover:bg-primary/5 group relative ${
                      isToday ? "bg-primary/10 border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-bold rounded-full h-5 w-5 grid place-items-center ${
                          isToday ? "bg-primary text-white" : "text-muted-foreground group-hover:text-foreground"
                        }`}
                      >
                        {dayNum}
                      </span>

                      <div className="flex items-center gap-1">
                        {dayPosts.length > 0 && (
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {dayPosts.length} post{dayPosts.length > 1 ? "s" : ""}
                          </span>
                        )}
                        <span className="opacity-0 group-hover:opacity-100 transition text-[10px] text-primary flex items-center gap-0.5">
                          <Plus className="h-3 w-3" />
                        </span>
                      </div>
                    </div>

                    {/* Post Tiles inside Day */}
                    <div className="space-y-1">
                      {dayPosts.map(p => {
                        const sConf = statusConfig[p.status] || statusConfig.scheduled;

                        return (
                          <div
                            key={p.id}
                            onClick={e => {
                              e.stopPropagation();
                              handleOpenEdit(p);
                            }}
                            className="p-1.5 rounded-md border border-border/80 bg-background/90 hover:bg-background text-xs cursor-pointer shadow-xs hover:border-primary/50 transition"
                          >
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {p.scheduledFor
                                  ? new Date(p.scheduledFor).toLocaleTimeString("pt-BR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "Rascunho"}
                              </span>
                              <Badge className={`text-[9px] px-1 py-0 h-3.5 ${sConf.badge}`}>
                                {sConf.label}
                              </Badge>
                            </div>

                            <p className="line-clamp-2 text-[10.5px] leading-tight text-foreground font-medium">
                              {p.title || p.content}
                            </p>

                            {/* Network Dispatches Badges */}
                            <div className="flex items-center gap-1 mt-1 flex-wrap">
                              {p.brand && (
                                <span className={`text-[8.5px] px-1 rounded font-bold ${
                                  p.brand === "sempre" ? "bg-orange-500/20 text-orange-600" : "bg-emerald-500/20 text-emerald-600"
                                }`}>
                                  {p.brand === "sempre" ? "SEMPRE" : "ONNET"}
                                </span>
                              )}
                              {p.dispatches?.map((d: any) => {
                                const pConf = platformColors[d.accountPlatform] || {
                                  label: d.accountPlatform,
                                  badge: "bg-muted text-foreground",
                                };
                                return (
                                  <span
                                    key={d.id}
                                    title={`${d.accountName} (${pConf.label})`}
                                    className={`text-[8.5px] px-1 py-0 rounded font-bold ${pConf.badge}`}
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
        </div>
      )}

      {/* TAB 2: EDITORIAL PAUTA & ROTEIROS (Matching painel_novembro.html) */}
      {activeTab === "editorial" && (
        <div className="mt-5 space-y-4">
          {/* Official ISP Guidelines Banner */}
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs text-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="space-y-1">
              <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Flame className="h-4 w-4" /> Diretrizes de Criação • Sempre Internet & OnNet Telecom
              </span>
              <p className="text-muted-foreground leading-relaxed">
                Priorizar estabilidade da fibra óptica 100%, suporte técnico humanizado e ganchos fortes nos primeiros 3 segundos.
                Vídeos curtos (Reels/TikTok) com roteiro estruturado em <strong>[Tempo | Visual | Áudio | Texto na Tela]</strong> e CTA para WhatsApp.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => importEditorialMutation.mutate({})}
                disabled={importEditorialMutation.isPending}
                className="text-xs border-amber-500/40 hover:bg-amber-500/10"
              >
                <DownloadCloud className="h-3.5 w-3.5 mr-1.5 text-amber-600" />
                Carregar Pautas de Novembro
              </Button>
              <Button
                size="sm"
                onClick={() => handleOpenCompose()}
                className="text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Criar Pauta
              </Button>
            </div>
          </div>

          {/* Stats Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-3.5 border-border bg-card">
              <span className="text-[11px] text-muted-foreground uppercase font-semibold">Total de Pautas</span>
              <p className="text-2xl font-black text-primary mt-0.5">{editorialItems.length}</p>
              <span className="text-[10px] text-muted-foreground">Planejadas no cronograma</span>
            </Card>

            <Card className="p-3.5 border-border bg-card">
              <span className="text-[11px] text-muted-foreground uppercase font-semibold">Roteiros Detalhados</span>
              <p className="text-2xl font-black text-amber-500 mt-0.5">
                {editorialItems.filter(i => i.scriptParsed && i.scriptParsed.length > 0).length}
              </p>
              <span className="text-[10px] text-muted-foreground">Com cenas, áudio e visual</span>
            </Card>

            <Card className="p-3.5 border-border bg-card">
              <span className="text-[11px] text-muted-foreground uppercase font-semibold">Vídeos / Reels</span>
              <p className="text-2xl font-black text-pink-500 mt-0.5">
                {editorialItems.filter(i => i.postType === "reel").length}
              </p>
              <span className="text-[10px] text-muted-foreground">Audiovisual prioritário</span>
            </Card>

            <Card className="p-3.5 border-border bg-card">
              <span className="text-[11px] text-muted-foreground uppercase font-semibold">Marcas Cobertas</span>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30 text-[10px]">
                  Sempre ({editorialItems.filter(i => (i.brand || "").toLowerCase().includes("sempre")).length})
                </Badge>
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">
                  OnNet ({editorialItems.filter(i => (i.brand || "").toLowerCase().includes("onnet")).length})
                </Badge>
              </div>
            </Card>
          </div>

          {/* Pilares Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setEditorialPilarFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
                editorialPilarFilter === "all"
                  ? "bg-primary text-white border-primary"
                  : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              Todos os Pilares ({editorialItems.length})
            </button>
            {pilarPresets.map(pilar => {
              const count = pilarCounts[pilar] || 0;
              return (
                <button
                  key={pilar}
                  onClick={() => setEditorialPilarFilter(pilar)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
                    editorialPilarFilter === pilar
                      ? "bg-primary text-white border-primary"
                      : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {pilar} {count > 0 && <span className="opacity-70 text-[10px]">({count})</span>}
                </button>
              );
            })}
          </div>

          {/* Secondary Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Marca:</Label>
                <Select value={editorialBrandFilter} onValueChange={setEditorialBrandFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Marcas</SelectItem>
                    <SelectItem value="sempre">Sempre Internet</SelectItem>
                    <SelectItem value="onnet">OnNet Telecom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Formato:</Label>
                <Select value={editorialFormatFilter} onValueChange={setEditorialFormatFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Formatos</SelectItem>
                    <SelectItem value="reel">Reels / TikTok</SelectItem>
                    <SelectItem value="carousel">Carrossel</SelectItem>
                    <SelectItem value="feed">Feed Estático</SelectItem>
                    <SelectItem value="story">Stories</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <span className="text-xs text-muted-foreground">
              Exibindo <strong>{filteredEditorial.length}</strong> de {editorialItems.length} pautas
            </span>
          </div>

          {/* Editorial Grid Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEditorial.map(item => {
              const hasScript = item.scriptParsed && item.scriptParsed.length > 0;
              const isSempre = (item.brand || "").toLowerCase().includes("sempre");

              return (
                <Card
                  key={item.id}
                  className="flex flex-col justify-between border-border bg-card hover:border-primary/40 hover:shadow-md transition group overflow-hidden"
                >
                  <CardHeader className="p-4 pb-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          isSempre
                            ? "bg-orange-500/10 text-orange-600 border border-orange-500/20"
                            : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        }`}
                      >
                        {(item as any).dateBadge ? `📅 ${(item as any).dateBadge}` : "Planejado"}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] font-medium ${
                            isSempre ? "bg-orange-500/15 text-orange-700 dark:text-orange-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {isSempre ? "Sempre Internet" : "OnNet Telecom"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {item.postType || "Feed"}
                        </Badge>
                      </div>
                    </div>

                    {item.pilar && (
                      <span className="inline-block text-[11px] font-semibold text-primary">
                        {item.pilar}
                      </span>
                    )}

                    <CardTitle className="text-sm font-bold text-foreground leading-snug group-hover:text-primary transition line-clamp-2">
                      {item.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="p-4 pt-1 space-y-3 flex-1 flex flex-col justify-between">
                    <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed whitespace-pre-line">
                      {item.content}
                    </p>

                    {item.notes && (
                      <div className="p-2 rounded bg-muted/30 border border-border/50 text-[11px] text-muted-foreground">
                        🎯 <strong>Objetivo/CTA:</strong> {item.notes}
                      </div>
                    )}

                    {hasScript && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                        <Film className="h-3.5 w-3.5" />
                        <span>Roteiro de {item.scriptParsed.length} cenas anexado</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="text-xs flex-1"
                        onClick={() => setViewScriptModalItem(item)}
                      >
                        <Film className="h-3.5 w-3.5 mr-1" />
                        Ver Roteiro & Copy
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Copiar Legenda"
                        onClick={() => handleCopyText(item.content, "Legenda")}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleOpenEdit(item)}
                      >
                        <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                        Agendar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: LIST / FEED VIEW */}
      {activeTab === "list" && (
        <div className="mt-5 space-y-3">
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
                          {p.postType === "reel" ? <Video className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
                        </div>
                      )}

                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`text-xs px-2 py-0.5 border ${sConf.badge}`}>
                            <StatusIcon className="h-3 w-3 mr-1 inline" />
                            {sConf.label}
                          </Badge>
                          {p.brand && (
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {p.brand}
                            </Badge>
                          )}
                          {p.pilar && (
                            <span className="text-[11px] font-medium text-primary">
                              {p.pilar}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground font-mono">
                            {p.scheduledFor
                              ? `Para: ${new Date(p.scheduledFor).toLocaleString("pt-BR")}`
                              : `Criado em: ${new Date(p.createdAt).toLocaleDateString("pt-BR")}`}
                          </span>
                        </div>

                        {p.title && (
                          <h4 className="text-sm font-semibold text-foreground">
                            {p.title}
                          </h4>
                        )}

                        <p className="text-xs text-foreground line-clamp-2 max-w-3xl leading-relaxed whitespace-pre-line">
                          {p.content}
                        </p>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      {p.status !== "published" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={isPublishing}
                          onClick={() => handlePublishNow(p.id)}
                          className="text-xs"
                        >
                          <Send className={`h-3.5 w-3.5 mr-1 ${isPublishing ? "animate-pulse" : ""}`} />
                          Publicar Agora
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(p)}
                        className="text-xs"
                      >
                        <Edit3 className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                        onClick={() => {
                          if (confirm("Excluir esta publicação?")) {
                            deletePostMutation.mutate({ id: p.id });
                          }
                        }}
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

      {/* DAY DETAIL MODAL (Opens when clicking any day in calendar) */}
      <Dialog open={!!selectedDayDate} onOpenChange={open => !open && setSelectedDayDate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base">
              <span>
                📅 Publicações de{" "}
                {selectedDayDate &&
                  new Date(selectedDayDate + "T12:00:00").toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
              </span>
              <Button
                size="sm"
                onClick={() => {
                  const d = selectedDayDate;
                  setSelectedDayDate(null);
                  handleOpenCompose(d || undefined);
                }}
                className="text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Novo Post neste Dia
              </Button>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Gerencie todas as publicações programadas ou enviadas nesta data.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-3 max-h-[60vh] overflow-y-auto">
            {selectedDayPosts.length === 0 ? (
              <div className="p-8 text-center border-dashed border-2 border-border rounded-xl">
                <CalendarIcon className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-foreground">Nenhum post agendado para este dia.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Clique no botão acima para agendar uma nova publicação nesta data.
                </p>
              </div>
            ) : (
              selectedDayPosts.map(p => {
                const sConf = statusConfig[p.status] || statusConfig.scheduled;
                return (
                  <div
                    key={p.id}
                    className="p-3 rounded-lg border border-border bg-card space-y-2 hover:border-primary/40 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-foreground">
                          {p.scheduledFor
                            ? new Date(p.scheduledFor).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Sem horário"}
                        </span>
                        <Badge className={`text-[10px] ${sConf.badge}`}>{sConf.label}</Badge>
                        {p.brand && (
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {p.brand}
                          </Badge>
                        )}
                        {p.pilar && (
                          <span className="text-[10px] font-semibold text-primary">{p.pilar}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {p.status !== "published" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs"
                            onClick={() => handlePublishNow(p.id)}
                          >
                            <Send className="h-3 w-3 mr-1" /> Publicar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            setSelectedDayDate(null);
                            handleOpenEdit(p);
                          }}
                        >
                          <Edit3 className="h-3 w-3 mr-1" /> Editar
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-rose-500"
                          onClick={() => {
                            if (confirm("Excluir post?")) deletePostMutation.mutate({ id: p.id });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-foreground line-clamp-3 leading-relaxed">
                      {p.content}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* SCRIPT MODAL (Full View of painel_novembro.html piece) */}
      <Dialog open={!!viewScriptModalItem} onOpenChange={open => !open && setViewScriptModalItem(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {viewScriptModalItem && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                    {viewScriptModalItem.postType?.toUpperCase() || "REELS"}
                  </Badge>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {viewScriptModalItem.pilar}
                  </span>
                </div>
                <DialogTitle className="text-lg font-bold">
                  {viewScriptModalItem.title}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {viewScriptModalItem.notes || "Roteiro e copy audiovisual oficial da campanha."}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Scene Table */}
                {viewScriptModalItem.scriptParsed && viewScriptModalItem.scriptParsed.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Film className="h-3.5 w-3.5 text-amber-500" /> Roteiro Técnico Cena a Cena:
                    </h4>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/60 text-muted-foreground font-semibold border-b border-border">
                          <tr>
                            <th className="p-2.5 w-24">Tempo</th>
                            <th className="p-2.5">Visual / Enquadramento</th>
                            <th className="p-2.5">Áudio / Fala</th>
                            <th className="p-2.5">Texto na Tela</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {viewScriptModalItem.scriptParsed.map((scene: any, i: number) => (
                            <tr key={i} className="hover:bg-muted/20">
                              <td className="p-2.5 font-mono text-[11px] font-bold text-amber-600 dark:text-amber-400">
                                {scene.time || `Cena ${i + 1}`}
                              </td>
                              <td className="p-2.5 leading-relaxed text-foreground">
                                {scene.visual}
                              </td>
                              <td className="p-2.5 leading-relaxed text-muted-foreground">
                                {scene.audio || "—"}
                              </td>
                              <td className="p-2.5 font-semibold text-primary">
                                {scene.text || "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhuma tabela de cenas detalhada para este item (post estático ou texto livre).
                  </p>
                )}

                {/* Copy Box */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-primary" /> Legenda Completa / Copy:
                    </h4>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => handleCopyText(viewScriptModalItem.content, "Legenda")}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copiar Legenda
                    </Button>
                  </div>
                  <div className="p-3.5 rounded-lg bg-muted/40 border border-border text-xs leading-relaxed whitespace-pre-line text-foreground font-mono">
                    {viewScriptModalItem.content}
                  </div>
                </div>
              </div>

              <DialogFooter className="flex items-center justify-between sm:justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewScriptModalItem(null)}
                >
                  Fechar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const item = viewScriptModalItem;
                    setViewScriptModalItem(null);
                    handleOpenEdit(item);
                  }}
                >
                  <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                  Agendar este Conteúdo
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* AI ASSISTANT DIALOG (Gerar com IA / Antigravity) */}
      <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-amber-500 animate-pulse" />
              Assistente de IA Social Media (Antigravity)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Gere legendas magnéticas, hashtags otimizadas por nicho de telecom, ganchos de 3 segundos e roteiros cena a cena.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Ideia ou Tema do Post:</Label>
              <Textarea
                rows={2}
                placeholder="Ex: Como posicionar o roteador Wi-Fi para não ter pontos cegos na casa..."
                className="text-xs resize-none"
                value={aiForm.prompt}
                onChange={e => setAiForm(f => ({ ...f, prompt: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Formato:</Label>
                <Select
                  value={aiForm.postType}
                  onValueChange={(val: any) => setAiForm(f => ({ ...f, postType: val }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reel">Reels / TikTok</SelectItem>
                    <SelectItem value="carousel">Carrossel</SelectItem>
                    <SelectItem value="feed">Feed Estático</SelectItem>
                    <SelectItem value="story">Stories</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Marca:</Label>
                <Select
                  value={aiForm.brand}
                  onValueChange={val => setAiForm(f => ({ ...f, brand: val }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onnet">OnNet Telecom</SelectItem>
                    <SelectItem value="sempre">Sempre Internet</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Pilar:</Label>
                <Select
                  value={aiForm.pilar}
                  onValueChange={val => setAiForm(f => ({ ...f, pilar: val }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pilarPresets.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Tom de Voz:</Label>
                <Select
                  value={aiForm.tone}
                  onValueChange={val => setAiForm(f => ({ ...f, tone: val }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Descontraído & Didático">Descontraído & Didático</SelectItem>
                    <SelectItem value="Comercial & Urgente">Comercial & Urgente</SelectItem>
                    <SelectItem value="Técnico & Especialista">Técnico & Confiável</SelectItem>
                    <SelectItem value="Humor & Entretenimento">Humor & Situações do Lar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              size="sm"
              className="w-full text-xs font-semibold"
              disabled={generateAiMutation.isPending || !aiForm.prompt.trim()}
              onClick={() => generateAiMutation.mutate(aiForm)}
            >
              <Sparkles className={`h-4 w-4 mr-2 ${generateAiMutation.isPending ? "animate-spin" : ""}`} />
              {generateAiMutation.isPending ? "Criando conteúdo com IA..." : "Gerar Conteúdo com IA"}
            </Button>

            {/* AI Result Preview */}
            {aiResult && (
              <div className="p-3.5 rounded-xl border border-border bg-card space-y-3 mt-3">
                {aiResult.hook && (
                  <div>
                    <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 block uppercase">
                      🎣 Gancho dos 3 Segundos:
                    </span>
                    <p className="text-xs font-bold text-foreground mt-0.5">{aiResult.hook}</p>
                  </div>
                )}

                <div>
                  <span className="text-[11px] font-bold text-muted-foreground block uppercase">
                    📝 Legenda Gerada:
                  </span>
                  <div className="p-2.5 rounded bg-muted/40 text-xs leading-relaxed whitespace-pre-line text-foreground mt-1 max-h-40 overflow-y-auto font-mono">
                    {aiResult.caption}
                  </div>
                </div>

                {aiResult.firstComment && (
                  <div>
                    <span className="text-[11px] font-bold text-muted-foreground block uppercase">
                      💬 Primeiro Comentário (Hashtags Nicho Telecom):
                    </span>
                    <p className="text-xs text-primary font-mono mt-0.5">{aiResult.firstComment}</p>
                  </div>
                )}

                {aiResult.script && aiResult.script.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-muted-foreground block uppercase mb-1">
                      🎬 Roteiro de Vídeo ({aiResult.script.length} cenas):
                    </span>
                    <div className="space-y-1 text-xs">
                      {aiResult.script.map((s: any, idx: number) => (
                        <div key={idx} className="p-2 rounded bg-muted/30 border border-border/50 text-[11px]">
                          <strong>{s.time || `Cena ${idx+1}`}:</strong> {s.visual} | <em>{s.audio}</em>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  size="sm"
                  className="w-full text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleApplyAiResult}
                >
                  <Check className="h-4 w-4 mr-1.5" />
                  Aplicar ao Post
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* POST COMPOSER DIALOG */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base">
              <span>{form.id ? "Editar Publicação" : "Nova Publicação Multi-Canal"}</span>
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                onClick={() => setAiModalOpen(true)}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-500" />
                ✨ Gerar com IA
              </Button>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Crie uma publicação e sincronize automaticamente no Instagram, Facebook, LinkedIn, TikTok e Google Meu Negócio.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={e => {
              e.preventDefault();
              if (form.targetAccountIds.length === 0) {
                toast.error("Selecione pelo menos uma conta conectada de destino.");
                return;
              }

              let scheduledFor: Date | null = null;
              if (!form.publishNow && form.scheduledDate) {
                const [y, m, d] = form.scheduledDate.split("-").map(Number);
                const [h, min] = form.scheduledTime.split(":").map(Number);
                scheduledFor = new Date(y, m - 1, d, h || 12, min || 0, 0);
              }

              const scriptJson = form.script && form.script.length > 0 ? JSON.stringify(form.script) : undefined;

              if (form.id) {
                updatePostMutation.mutate({
                  id: form.id,
                  title: form.title || undefined,
                  content: form.content,
                  firstComment: form.firstComment || undefined,
                  pilar: form.pilar || undefined,
                  brand: form.brand || "onnet",
                  postType: form.postType,
                  targetAccountIds: form.targetAccountIds,
                  mediaUrls: form.mediaUrls,
                  scheduledFor,
                  script: scriptJson,
                });
              } else {
                createPostMutation.mutate({
                  title: form.title || undefined,
                  content: form.content,
                  firstComment: form.firstComment || undefined,
                  pilar: form.pilar || undefined,
                  brand: form.brand || "onnet",
                  postType: form.postType,
                  targetAccountIds: form.targetAccountIds,
                  mediaUrls: form.mediaUrls,
                  scheduledFor,
                  publishNow: form.publishNow,
                  gmbActionUrl: form.gmbActionUrl || undefined,
                  gmbActionType: form.gmbActionType || undefined,
                  script: scriptJson,
                });
              }
            }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2"
          >
            {/* Left 7 Cols: Composer Inputs */}
            <div className="lg:col-span-7 space-y-4">
              {/* Account Multi-Selector */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  1. Perfis de Destino:
                </Label>
                <div className="flex flex-wrap gap-2">
                  {accounts.map(acc => {
                    const isSelected = form.targetAccountIds.includes(acc.id);
                    const pConf = platformColors[acc.platform] || { label: acc.platform, color: "#888" };

                    return (
                      <button
                        type="button"
                        key={acc.id}
                        onClick={() => handleToggleAccount(acc.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                          isSelected
                            ? "bg-primary text-white border-primary shadow-xs"
                            : "bg-card text-muted-foreground border-border hover:border-foreground/30"
                        }`}
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pConf.color }} />
                        <span>{acc.accountName}</span>
                        <span className="text-[10px] opacity-75">({pConf.label})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Brand, Pilar & Format */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Marca</Label>
                  <Select value={form.brand} onValueChange={v => setForm(f => ({ ...f, brand: v }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onnet">OnNet Telecom</SelectItem>
                      <SelectItem value="sempre">Sempre Internet</SelectItem>
                      <SelectItem value="geral">Geral / Ambas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Pilar Editorial</Label>
                  <Select value={form.pilar} onValueChange={v => setForm(f => ({ ...f, pilar: v }))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione o pilar" />
                    </SelectTrigger>
                    <SelectContent>
                      {pilarPresets.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Formato</Label>
                  <Select
                    value={form.postType}
                    onValueChange={(v: any) => setForm(f => ({ ...f, postType: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="feed">Feed Estático</SelectItem>
                      <SelectItem value="reel">Reels / Vídeo</SelectItem>
                      <SelectItem value="carousel">Carrossel</SelectItem>
                      <SelectItem value="story">Stories</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Internal Title */}
              <div>
                <Label className="text-xs">Título / Gancho Interno (Opcional)</Label>
                <Input
                  placeholder="Ex: 🦹‍♂️ Os Vilões da Conexão - O Espelho e o Micro-ondas"
                  className="h-8 text-xs"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>

              {/* Caption / Content Editor */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    2. Legenda / Copy:
                  </Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] text-amber-600 dark:text-amber-400 p-1"
                      onClick={() => setAiModalOpen(true)}
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      Pedir IA para melhorar
                    </Button>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {form.content.length} carac.
                    </span>
                  </div>
                </div>
                <Textarea
                  rows={5}
                  required
                  placeholder="Escreva a legenda com emojis, espaçamentos e chamada para ação..."
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  className="resize-none text-xs leading-relaxed"
                />
              </div>

              {/* First Comment (Hashtags) */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                  3. Primeiro Comentário (Hashtags e Links complementares):
                </Label>
                <Textarea
                  rows={2}
                  placeholder="#OnNetTelecom #SempreInternet #FibraOptica #InternetUltraRapida..."
                  value={form.firstComment}
                  onChange={e => setForm(f => ({ ...f, firstComment: e.target.value }))}
                  className="resize-none text-xs leading-relaxed"
                />
              </div>

              {/* Media Attachments */}
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                  4. Mídias (Imagens / Vídeos):
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="URL pública da imagem ou vídeo (https://...)"
                    className="h-8 text-xs flex-1"
                    value={form.mediaUrlInput}
                    onChange={e => setForm(f => ({ ...f, mediaUrlInput: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddMedia();
                      }
                    }}
                  />
                  <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" onClick={handleAddMedia}>
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
                  5. Data e Horário de Publicação:
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
                      className="h-8 text-xs"
                      value={form.scheduledDate}
                      onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
                    />
                    <Input
                      type="time"
                      className="h-8 text-xs"
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
                Pré-visualização em Tempo Real:
              </Label>

              <Tabs defaultValue="instagram" className="w-full flex-1 flex flex-col">
                <TabsList className="grid grid-cols-4 w-full h-8 text-xs mb-3">
                  <TabsTrigger value="instagram">Instagram</TabsTrigger>
                  <TabsTrigger value="facebook">Facebook</TabsTrigger>
                  <TabsTrigger value="linkedin">LinkedIn</TabsTrigger>
                  <TabsTrigger value="tiktok">TikTok</TabsTrigger>
                </TabsList>

                {/* Instagram Mockup */}
                <TabsContent value="instagram" className="flex-1 mt-0">
                  <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden text-xs">
                    <div className="flex items-center justify-between p-3 border-b border-border">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-amber-500 to-pink-500 p-0.5">
                          <div className="h-full w-full rounded-full bg-card grid place-items-center font-bold text-[10px]">
                            {form.brand === "sempre" ? "SI" : "OT"}
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold leading-tight">
                            {form.brand === "sempre" ? "sempreinternet" : "onnettelecom"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Patrocínio / Fibra Óptica</p>
                        </div>
                      </div>
                      <span className="text-muted-foreground">•••</span>
                    </div>

                    <div className="aspect-square bg-muted grid place-items-center overflow-hidden">
                      {form.mediaUrls[0] ? (
                        <img src={form.mediaUrls[0]} alt="Post" className="h-full w-full object-cover" />
                      ) : (
                        <div className="text-center p-6 text-muted-foreground">
                          <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
                          <span className="text-xs">Insira uma imagem ou vídeo para ver a prévia</span>
                        </div>
                      )}
                    </div>

                    <div className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Heart className="h-4 w-4" />
                          <MessageCircle className="h-4 w-4" />
                          <Share2 className="h-4 w-4" />
                        </div>
                        <Bookmark className="h-4 w-4" />
                      </div>

                      <p className="font-semibold text-[11px]">842 curtidas</p>

                      <div className="text-xs leading-relaxed space-y-1">
                        <p>
                          <span className="font-semibold mr-1.5">
                            {form.brand === "sempre" ? "sempreinternet" : "onnettelecom"}
                          </span>
                          <span className="whitespace-pre-line">
                            {form.content || "Sua legenda aparecerá aqui..."}
                          </span>
                        </p>
                      </div>

                      {form.firstComment && (
                        <div className="pt-1.5 border-t border-border/50 text-[11px] text-muted-foreground font-mono">
                          💬 {form.firstComment}
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Facebook Mockup */}
                <TabsContent value="facebook" className="flex-1 mt-0">
                  <div className="rounded-xl border border-border bg-card shadow-sm p-3 text-xs space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-full bg-blue-600 text-white font-bold grid place-items-center text-xs">
                        f
                      </div>
                      <div>
                        <p className="font-semibold">
                          {form.brand === "sempre" ? "Sempre Internet Oficial" : "OnNet Telecom"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Agora mesmo • 🌐 Público</p>
                      </div>
                    </div>

                    <p className="whitespace-pre-line leading-relaxed text-xs">
                      {form.content || "Texto da publicação no Facebook..."}
                    </p>

                    {form.mediaUrls[0] && (
                      <img src={form.mediaUrls[0]} alt="Post" className="rounded-lg w-full max-h-52 object-cover border border-border" />
                    )}

                    <div className="pt-2 border-t border-border flex items-center justify-around text-muted-foreground text-xs">
                      <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" /> Curtir</span>
                      <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> Comentar</span>
                      <span className="flex items-center gap-1"><Share2 className="h-3.5 w-3.5" /> Compartilhar</span>
                    </div>
                  </div>
                </TabsContent>

                {/* LinkedIn Mockup */}
                <TabsContent value="linkedin" className="flex-1 mt-0">
                  <div className="rounded-xl border border-border bg-card shadow-sm p-3 text-xs space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-md bg-[#0A66C2] text-white font-bold grid place-items-center text-xs">
                        in
                      </div>
                      <div>
                        <p className="font-semibold">{form.brand === "sempre" ? "Sempre Internet" : "OnNet Telecom"}</p>
                        <p className="text-[10px] text-muted-foreground">Telecomunicações • Corporativo</p>
                      </div>
                    </div>

                    <p className="whitespace-pre-line leading-relaxed text-xs">
                      {form.content || "Texto profissional no LinkedIn..."}
                    </p>

                    {form.mediaUrls[0] && (
                      <img src={form.mediaUrls[0]} alt="Post" className="rounded-lg w-full max-h-52 object-cover border border-border" />
                    )}
                  </div>
                </TabsContent>

                {/* TikTok Mockup */}
                <TabsContent value="tiktok" className="flex-1 mt-0">
                  <div className="rounded-xl border border-border bg-neutral-950 text-white shadow-sm p-4 text-xs flex flex-col justify-between aspect-[9/14] relative overflow-hidden">
                    {form.mediaUrls[0] && (
                      <img src={form.mediaUrls[0]} alt="Post" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                    )}

                    <div className="relative z-10 flex justify-end">
                      <span className="text-[11px] bg-black/50 px-2 py-0.5 rounded">TikTok Reel</span>
                    </div>

                    <div className="relative z-10 space-y-1.5 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 rounded">
                      <p className="font-bold text-xs">@{form.brand === "sempre" ? "sempreinternet" : "onnettelecom"}</p>
                      <p className="text-[11px] line-clamp-3 leading-snug">
                        {form.content || "Legenda do TikTok com hashtags..."}
                      </p>
                      <p className="text-[10px] text-amber-300 font-mono">🎵 Som original - Telecom Hits</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Footer Buttons */}
            <div className="lg:col-span-12 pt-3 border-t border-border flex items-center justify-between">
              <Button type="button" variant="outline" size="sm" onClick={() => setComposeOpen(false)}>
                Cancelar
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={createPostMutation.isPending}
                className="font-semibold text-xs"
              >
                {createPostMutation.isPending ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Salvando...
                  </>
                ) : form.publishNow ? (
                  <>
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Publicar Imediatamente
                  </>
                ) : (
                  <>
                    <Clock className="h-3.5 w-3.5 mr-1.5" />
                    Confirmar Agendamento
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </WorkspaceShell>
  );
}
