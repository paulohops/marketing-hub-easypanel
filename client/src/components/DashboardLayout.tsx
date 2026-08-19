import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useBranding } from "@/contexts/BrandingContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import {
  BarChart3,
  BellRing,
  Boxes,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Database,
  FileSpreadsheet,
  Flag,
  Handshake,
  History,
  Landmark,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Megaphone,
  Moon,
  Network,
  PanelsTopLeft,
  Radio,
  Settings2,
  Sun,
  Trello,
  UserRound,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import OnboardingTutorial from "./OnboardingTutorial";
import { APP_VERSION, APP_VERSION_HISTORY } from "@/lib/appVersion";

type NavItem = {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  permission: string;
  aliases?: string[];
  children?: Array<Omit<NavItem, "children">>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const overviewItem: NavItem = {
  label: "Visão geral",
  path: "/",
  icon: LayoutDashboard,
  permission: "dashboard.read",
};
const quickAccessItems: NavItem[] = [
  {
    label: "Notificações",
    path: "/notificacoes",
    icon: BellRing,
    permission: "dashboard.read",
  },
  {
    label: "Trello",
    path: "/trello",
    icon: Trello,
    permission: "settings.read",
  },
];

const navigationGroups: NavGroup[] = [
  {
    label: "Operação",
    items: [
      {
        label: "Campanhas",
        path: "/campanhas",
        icon: Flag,
        permission: "actions.read",
      },
      {
        label: "Panfletagem",
        path: "/midias/panfletagem",
        icon: FileSpreadsheet,
        permission: "media.read",
      },
      {
        label: "Mídias",
        path: "/midias",
        icon: Megaphone,
        permission: "media.read",
        children: [
          {
            label: "Mídia Urbana",
            path: "/midias/graficas",
            icon: PanelsTopLeft,
            permission: "media.read",
          },
          {
            label: "Mídia Audiovisual",
            path: "/midias/audio-video",
            aliases: ["/midias/audiovisual", "/midias/tradicional"],
            icon: Radio,
            permission: "media.read",
          },
          {
            label: "Carro de som",
            path: "/midias/carro-de-som",
            icon: Volume2,
            permission: "media.read",
          },
          {
            label: "Influencers",
            path: "/midias/influencers",
            icon: UserRound,
            permission: "media.read",
          },
        ],
      },
      {
        label: "Ações",
        path: "/acoes",
        icon: CalendarDays,
        permission: "actions.read",
      },
      {
        label: "Eventos",
        path: "/eventos",
        icon: MapPinned,
        permission: "events.read",
      },
    ],
  },
  {
    label: "Gestão",
    items: [
      {
        label: "Estoque",
        path: "/estoque",
        icon: Boxes,
        permission: "inventory.read",
      },
      {
        label: "Financeiro",
        path: "/financeiro",
        icon: Landmark,
        permission: "finance.read",
      },
      {
        label: "Cadastros",
        path: "/cadastros",
        icon: Database,
        permission: "settings.read",
      },
    ],
  },
  {
    label: "Relatórios",
    items: [
      {
        label: "BI e indicadores",
        path: "/indicadores",
        icon: BarChart3,
        permission: "dashboard.read",
      },
    ],
  },
  {
    label: "Configurações",
    items: [
      {
        label: "Configurações",
        path: "/configuracoes",
        icon: Settings2,
        permission: "settings.read",
        children: [
          {
            label: "Acessos",
            path: "/configuracoes/acessos",
            icon: UserRound,
            permission: "settings.read",
          },
          {
            label: "Equipes",
            path: "/configuracoes/equipes",
            icon: Network,
            permission: "settings.read",
          },
          {
            label: "Central de Dados",
            path: "/configuracoes/central-de-dados",
            icon: Database,
            permission: "settings.read",
          },
          {
            label: "Design",
            path: "/configuracoes/design",
            icon: PanelsTopLeft,
            permission: "settings.read",
          },
          {
            label: "Sistema",
            path: "/configuracoes/sistema",
            icon: Settings2,
            permission: "settings.read",
          },
        ],
      },
    ],
  },
];

const roleNames: Record<string, string> = {
  admin: "Administrador",
  regional_manager: "Gestor regional",
  operator: "Operador",
  team_member: "Membro de equipe",
  viewer: "Visualizador",
  user: "Visualizador",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { branding } = useBranding();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(
    () => !document.cookie.includes("sidebar_state=false")
  );
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(
    {}
  );
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const { can: canNavigate } = useEffectivePermissions();

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return null;

  const allowedGroups = navigationGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => canNavigate(item.permission)),
    }))
    .filter(group => group.items.length > 0);
  const profileName = user.name?.trim() || "Paulo Oliveira";
  const initials = profileName.slice(0, 2).toUpperCase();
  const isPathActive = (path: string, aliases: string[] = []) =>
    [path, ...aliases].some(candidate => location === candidate || location.startsWith(`${candidate}/`));
  const renderItem = (item: NavItem) => {
    const visibleChildren =
      item.children?.filter(child => canNavigate(child.permission)) ?? [];
    const active =
      visibleChildren.length > 0
        ? visibleChildren.some(child => isPathActive(child.path, child.aliases)) || (location === item.path || (item.path !== "/midias" && isPathActive(item.path, item.aliases)))
        : isPathActive(item.path, item.aliases);
    const isExpanded = Boolean(expandedMenus[item.path]);
    const toggleSubmenu = () => {
      if (!sidebarOpen) setSidebarOpen(true);
      setExpandedMenus(current => ({
        ...current,
        [item.path]: !current[item.path],
      }));
    };
    return (
      <SidebarMenuItem key={item.path} className="group/menu-item relative">
        <div className="relative">
          <SidebarMenuButton
            isActive={active}
            tooltip={item.label}
            aria-expanded={visibleChildren.length > 0 ? isExpanded : undefined}
            onClick={
              visibleChildren.length > 0
                ? toggleSubmenu
                : () => setLocation(item.path)
            }
            style={active ? { backgroundColor: "var(--app-accent)", color: "var(--app-accent-foreground, #fff)" } : undefined}
            className="h-10 rounded-lg px-3 text-sidebar-foreground transition-all hover:bg-white/[0.12] hover:text-white data-[active=true]:font-bold data-[active=true]:text-white group-data-[collapsible=icon]:mx-auto"
          >
            <item.icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} />
            <span>{item.label}</span>
            {visibleChildren.length > 0 ? (
              <ChevronDown
                className={`ml-auto h-3.5 w-3.5 transition-transform duration-200 group-data-[collapsible=icon]:hidden ${isExpanded ? "rotate-180" : ""}`}
              />
            ) : null}
          </SidebarMenuButton>
        </div>
        {visibleChildren.length > 0 && (
          <SidebarMenuSub
            className={`mt-1 overflow-hidden border-l-white/20 transition-[max-height,opacity,padding] duration-200 ease-out ${isExpanded ? "pointer-events-auto max-h-64 py-0.5 opacity-100" : "pointer-events-none max-h-0 py-0 opacity-0"}`}
          >
            {visibleChildren.map(child => (
              <SidebarMenuSubItem key={child.path}>
                <SidebarMenuSubButton
                  href={child.path}
                  isActive={isPathActive(child.path, child.aliases)}
                  onClick={event => {
                    event.preventDefault();
                    setLocation(child.path);
                  }}
                  className="text-white/85 hover:bg-white/[0.12] hover:text-white data-[active=true]:bg-white/[0.16] data-[active=true]:text-white"
                >
                  <child.icon className="h-3.5 w-3.5 text-white/70" />
                  <span>{child.label}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        )}
      </SidebarMenuItem>
    );
  };

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <Sidebar
        collapsible="icon"
        className="border-r border-white/20 bg-primary text-sidebar-foreground"
      >
        <SidebarHeader className="flex-row items-center gap-1 px-3 pb-3 pt-5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
          <button
            onClick={() => setLocation("/")}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 text-left focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:hidden"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-sidebar-accent p-1 shadow-[0_8px_20px_rgba(7,63,31,0.24)]">
              <img
                src={branding.logoUrl}
                alt={branding.appName}
                className="h-full w-full object-contain"
              />
            </span>
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="block max-w-[165px] truncate whitespace-nowrap font-display text-[0.9rem] font-extrabold leading-tight tracking-tight">
                {branding.appName}
              </span>
              <span className="block max-w-[165px] truncate whitespace-nowrap text-[9px] font-bold tracking-[0.14em] text-sidebar-foreground">
                {branding.appSubtitle}
              </span>
            </span>
          </button>
          <SidebarTrigger
            aria-label="Recolher ou expandir menu"
            className="h-8 w-8 shrink-0 rounded-lg text-sidebar-foreground hover:bg-white/[0.12] hover:text-white group-data-[collapsible=icon]:mx-auto"
          />
        </SidebarHeader>

        <SidebarContent className="px-2 pb-4 pt-2 group-data-[collapsible=icon]:px-1">
          <SidebarMenu className="mb-2 shrink-0 gap-1">
            {canNavigate(overviewItem.permission) && renderItem(overviewItem)}
            {quickAccessItems
              .filter(item => canNavigate(item.permission))
              .map(renderItem)}
          </SidebarMenu>
          {allowedGroups.map(group => (
            <SidebarGroup key={group.label} className="mt-1 shrink-0 p-0 pb-3">
              <div
                data-sidebar="group-heading"
                className="mb-1 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80 group-data-[collapsible=icon]:hidden"
              >
                {group.label}
              </div>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {group.items.map(renderItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-white/20 p-3 group-data-[collapsible=icon]:px-1">
          <SidebarMenu className="mb-2 gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip={
                  theme === "dark" ? "Usar tema claro" : "Usar tema escuro"
                }
                onClick={toggleTheme}
                className="h-10 rounded-lg px-3 text-sidebar-foreground hover:bg-white/[0.12] hover:text-white group-data-[collapsible=icon]:!mx-auto group-data-[collapsible=icon]:!w-10 group-data-[collapsible=icon]:!justify-center group-data-[collapsible=icon]:!gap-0 group-data-[collapsible=icon]:!px-0 [&>svg]:shrink-0"
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                <span>{theme === "dark" ? "Tema claro" : "Tema escuro"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`Abrir menu de usuário: ${profileName}`}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
              >
                <Avatar className="h-8 w-8 border border-white/30 bg-sidebar-accent">
                  <AvatarImage
                    src={user.avatarUrl ?? undefined}
                    alt={`Perfil de ${profileName}`}
                  />
                  <AvatarFallback className="bg-sidebar-accent text-xs font-semibold text-accent">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <span className="block truncate text-xs font-semibold text-white">
                    {profileName}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-sidebar-foreground">
                    {roleNames[user.role] ?? "Usuário"}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] font-medium text-sidebar-foreground/80">
                    Versão {APP_VERSION}
                  </span>
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground group-data-[collapsible=icon]:hidden" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" sideOffset={8} className="z-50 max-h-[min(80vh,32rem)] w-[min(22rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl p-1.5">
              <DropdownMenuLabel className="px-2 py-2 font-normal">
                <p className="text-sm font-semibold">{profileName}</p>
                <p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2" onClick={() => setVersionDialogOpen(true)}>
                <History className="h-4 w-4" /> Versão {APP_VERSION}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="gap-2"
                onClick={() => setLocation("/perfil")}
              >
                <UserRound className="h-4 w-4" /> Meu perfil
              </DropdownMenuItem>
              {user.role === "admin" && (
                <DropdownMenuItem
                  className="gap-2"
                  onClick={() => setLocation("/configuracoes")}
                >
                  <Settings2 className="h-4 w-4" /> Configurações
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="gap-2"
                onClick={() => setLocation("/ajuda")}
              >
                <CircleHelp className="h-4 w-4" /> Ajuda e suporte
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-destructive focus:text-destructive"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" /> Sair da plataforma
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog open={versionDialogOpen} onOpenChange={setVersionDialogOpen}>
            <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Histórico de versões</DialogTitle>
                <DialogDescription>Consulte as alterações registradas em cada versão do Marketing HUB.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {APP_VERSION_HISTORY.map(entry => (
                  <article key={entry.version} className="rounded-xl border border-border bg-secondary/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><p className="font-display text-lg font-semibold text-foreground">v{entry.version}</p><p className="text-xs text-muted-foreground">{entry.label} · {entry.date}</p></div>
                      {entry.version === APP_VERSION && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">Atual</span>}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-foreground">{entry.summary}</p>
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground">{entry.changes.map(change => <li key={change} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{change}</li>)}</ul>
                  </article>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0 bg-background">
        <div className="min-h-screen px-4 py-5 sm:px-7 sm:py-7">{children}</div>
        <OnboardingTutorial />
      </SidebarInset>
    </SidebarProvider>
  );
}
