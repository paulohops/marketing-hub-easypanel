import { useAuth } from "@/_core/hooks/useAuth";
import { hasModulePermission } from "@/lib/permissions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  BarChart3,
  Boxes,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  FolderCog,
  Landmark,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Megaphone,
  Settings2,
} from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

type NavItem = {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  permission: string;
};

const navigation: NavItem[] = [
  { label: "Visão geral", path: "/", icon: LayoutDashboard, permission: "dashboard.read" },
  { label: "Estoque", path: "/estoque", icon: Boxes, permission: "inventory.read" },
  { label: "Financeiro", path: "/financeiro", icon: Landmark, permission: "finance.read" },
  { label: "Mídias", path: "/midias", icon: Megaphone, permission: "media.read" },
  { label: "Ações", path: "/acoes", icon: CalendarDays, permission: "actions.read" },
  { label: "Eventos", path: "/eventos", icon: MapPinned, permission: "events.read" },
  { label: "BI & indicadores", path: "/indicadores", icon: BarChart3, permission: "dashboard.read" },
  { label: "Configurações", path: "/configuracoes", icon: Settings2, permission: "settings.read" },
];

const roleNames: Record<string, string> = {
  admin: "Administrador",
  regional_manager: "Gestor regional",
  operator: "Operador",
  viewer: "Visualizador",
  user: "Visualizador",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) return null;

  const allowedNavigation = navigation.filter(item => hasModulePermission(user.role, item.permission));
  const initials = (user.name || user.email || "U").slice(0, 2).toUpperCase();

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" className="border-r border-white/10 bg-[#0c171a] text-[#e6f1ed]">
        <SidebarHeader className="px-3 pb-3 pt-5">
          <button onClick={() => setLocation("/")} className="flex w-full items-center gap-3 rounded-xl px-2 text-left focus-visible:ring-2 focus-visible:ring-[#f3a940]">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#ed9f34] text-[#15292a] shadow-[0_8px_20px_rgba(237,159,52,0.22)]">
              <FolderCog className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="block font-display text-[1.05rem] font-semibold tracking-tight">HUB TRADE</span>
              <span className="block text-[10px] font-semibold tracking-[0.18em] text-[#8fa59f]">OPERATIONS</span>
            </span>
          </button>
        </SidebarHeader>

        <SidebarContent className="px-2 pb-4 pt-2">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#77908a] group-data-[collapsible=icon]:hidden">Operação</p>
          <SidebarMenu className="gap-1">
            {allowedNavigation.map(item => {
              const active = location === item.path;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={active}
                    tooltip={item.label}
                    onClick={() => setLocation(item.path)}
                    className="h-10 rounded-lg px-3 text-[#b7c7c2] transition-all hover:bg-white/[0.08] hover:text-white data-[active=true]:bg-[#f3a940] data-[active=true]:font-semibold data-[active=true]:text-[#172527]"
                  >
                    <item.icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t border-white/10 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-[#f3a940] group-data-[collapsible=icon]:justify-center">
                <Avatar className="h-8 w-8 border border-[#d3a161]/50 bg-[#18373a]">
                  <AvatarFallback className="bg-[#18373a] text-xs font-semibold text-[#f7c267]">{initials}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <span className="block truncate text-xs font-semibold text-white">{user.name || "Usuário"}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-[#8fa59f]">{roleNames[user.role] ?? "Usuário"}</span>
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-[#8fa59f] group-data-[collapsible=icon]:hidden" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
              <DropdownMenuLabel className="px-2 py-2 font-normal">
                <p className="text-sm font-semibold">{user.name || "Usuário"}</p>
                <p className="mt-0.5 truncate text-xs font-normal text-muted-foreground">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2" onClick={() => setLocation("/configuracoes")}>
                <Settings2 className="h-4 w-4" /> Preferências
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => window.open("mailto:suporte@hubtrade.app", "_blank")}>
                <CircleHelp className="h-4 w-4" /> Ajuda e suporte
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={logout}>
                <LogOut className="h-4 w-4" /> Sair da plataforma
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-[#f5f4ee]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-[#dfe4df] bg-[#f5f4ee]/90 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="rounded-lg border border-[#d9dfd9] bg-white shadow-sm hover:bg-[#f8faf8]" />
            <div className="hidden sm:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#788782]">Central operacional</p>
              <p className="font-display text-sm font-semibold text-[#1b2d2d]">Gestão integrada de trade marketing</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden rounded-full border-[#d8dfd8] bg-white px-3 py-1 text-[11px] font-medium text-[#59716b] sm:flex">Ambiente protegido</Badge>
            <Button variant="outline" size="sm" className="h-9 rounded-lg border-[#d8dfd8] bg-white px-3 text-xs text-[#425955] hover:bg-[#eef3ef]" onClick={() => setLocation("/configuracoes")}>Configurar</Button>
          </div>
        </header>
        <div className="min-h-[calc(100vh-72px)] px-4 py-5 sm:px-7 sm:py-7">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
