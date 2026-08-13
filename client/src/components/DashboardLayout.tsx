import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
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
  Landmark,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Megaphone,
  Moon,
  RadioTower,
  Network,
  Settings2,
  Sun,
  Trello,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import OnboardingTutorial from "./OnboardingTutorial";

type NavItem = {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  permission: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const overviewItem: NavItem = { label: "Visão geral", path: "/", icon: LayoutDashboard, permission: "dashboard.read" };
const quickAccessItems: NavItem[] = [
  { label: "Notificações", path: "/notificacoes", icon: BellRing, permission: "dashboard.read" },
  { label: "Trello", path: "/trello", icon: Trello, permission: "settings.read" },
];

const navigationGroups: NavGroup[] = [
  {
    label: "Operação",
    items: [
      { label: "Ações", path: "/acoes", icon: CalendarDays, permission: "actions.read" },
      { label: "Mídias", path: "/midias", icon: Megaphone, permission: "media.read" },
      { label: "Mídias externas", path: "/midias-externas", icon: RadioTower, permission: "media.read" },
      { label: "Eventos", path: "/eventos", icon: MapPinned, permission: "events.read" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Estoque", path: "/estoque", icon: Boxes, permission: "inventory.read" },
      { label: "Financeiro", path: "/financeiro", icon: Landmark, permission: "finance.read" },
      { label: "Cadastros", path: "/cadastros", icon: Database, permission: "settings.read" },
      { label: "Empresas", path: "/empresas", icon: Building2, permission: "settings.read" },
    ],
  },
  {
    label: "Relatórios",
    items: [{ label: "BI e indicadores", path: "/indicadores", icon: BarChart3, permission: "dashboard.read" }],
  },
  {
    label: "Configurações",
    items: [
      { label: "Configurações", path: "/configuracoes", icon: Settings2, permission: "settings.read" },
      { label: "Equipes", path: "/equipes", icon: Network, permission: "settings.read" },
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(() => !document.cookie.includes("sidebar_state=false"));
  const { can: canNavigate } = useEffectivePermissions();

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return null;

  const allowedGroups = navigationGroups
    .map(group => ({ ...group, items: group.items.filter(item => canNavigate(item.permission)) }))
    .filter(group => group.items.length > 0);
  const profileName = user.name?.trim() || "Paulo Oliveira";
  const initials = profileName.slice(0, 2).toUpperCase();
  const renderItem = (item: NavItem) => {
    const active = location === item.path;
    return <SidebarMenuItem key={item.path}>
      <SidebarMenuButton isActive={active} tooltip={item.label} onClick={() => setLocation(item.path)} className="h-10 rounded-lg px-3 text-sidebar-foreground transition-all hover:bg-white/[0.12] hover:text-white data-[active=true]:bg-sidebar-primary data-[active=true]:font-bold data-[active=true]:text-white group-data-[collapsible=icon]:mx-auto">
        <item.icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} />
        <span>{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>;
  };

  return <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
    <Sidebar collapsible="icon" className="border-r border-white/20 bg-primary text-sidebar-foreground">
      <SidebarHeader className="flex-row items-center gap-2 px-3 pb-3 pt-5 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
        <button onClick={() => setLocation("/")} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:hidden">
          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-sidebar-accent p-1 shadow-[0_8px_20px_rgba(7,63,31,0.24)]">
            <img src="/manus-storage/cluster-mg-logo_947e1614.png" alt="Cluster MG" className="h-full w-full object-contain" />
          </span>
          <span className="min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="block font-display text-[1.05rem] font-extrabold tracking-tight">TRADE HUB</span>
            <span className="block text-[10px] font-bold tracking-[0.18em] text-sidebar-foreground">CLUSTER MG</span>
          </span>
        </button>
        <SidebarTrigger aria-label="Recolher ou expandir menu" className="h-8 w-8 shrink-0 rounded-lg text-sidebar-foreground hover:bg-white/[0.12] hover:text-white group-data-[collapsible=icon]:mx-auto" />
      </SidebarHeader>

      <SidebarContent className="px-2 pb-4 pt-2 group-data-[collapsible=icon]:px-1">
        <SidebarMenu className="mb-2 shrink-0 gap-1">
          {canNavigate(overviewItem.permission) && renderItem(overviewItem)}
          {quickAccessItems.filter(item => canNavigate(item.permission)).map(renderItem)}
        </SidebarMenu>
        {allowedGroups.map(group => <SidebarGroup key={group.label} className="mt-1 shrink-0 p-0 pb-3">
          <div data-sidebar="group-heading" className="mb-1 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80 group-data-[collapsible=icon]:hidden">{group.label}</div>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">{group.items.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>)}
      </SidebarContent>

      <SidebarFooter className="border-t border-white/20 p-3 group-data-[collapsible=icon]:px-1">
        <SidebarMenu className="mb-2 gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"} onClick={toggleTheme} className="h-10 rounded-lg px-3 text-sidebar-foreground hover:bg-white/[0.12] hover:text-white group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}<span>{theme === "dark" ? "Tema claro" : "Tema escuro"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label={`Abrir menu de usuário: ${profileName}`} className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <Avatar className="h-8 w-8 border border-white/30 bg-sidebar-accent"><AvatarImage src={user.avatarUrl ?? undefined} alt={`Perfil de ${profileName}`} /><AvatarFallback className="bg-sidebar-accent text-xs font-semibold text-accent">{initials}</AvatarFallback></Avatar>
              <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><span className="block truncate text-xs font-semibold text-white">{profileName}</span><span className="mt-0.5 block truncate text-[11px] text-sidebar-foreground">{roleNames[user.role] ?? "Usuário"}</span></span>
              <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground group-data-[collapsible=icon]:hidden" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
            <DropdownMenuLabel className="px-2 py-2 font-normal"><p className="text-sm font-semibold">{profileName}</p><p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">{user.email}</p></DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2" onClick={() => setLocation("/perfil")}><UserRound className="h-4 w-4" /> Meu perfil</DropdownMenuItem>
            {user.role === "admin" && <DropdownMenuItem className="gap-2" onClick={() => setLocation("/configuracoes")}><Settings2 className="h-4 w-4" /> Configurações</DropdownMenuItem>}
            <DropdownMenuItem className="gap-2" onClick={() => setLocation("/ajuda")}><CircleHelp className="h-4 w-4" /> Ajuda e suporte</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={logout}><LogOut className="h-4 w-4" /> Sair da plataforma</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
    <SidebarInset className="min-w-0 bg-background"><div className="min-h-screen px-4 py-5 sm:px-7 sm:py-7">{children}</div><OnboardingTutorial /></SidebarInset>
  </SidebarProvider>;
}
