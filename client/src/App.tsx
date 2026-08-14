import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";
import ProtectedModule from "./pages/ProtectedModule";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/login" component={LoginPage} />
    <Route path="/estoque">{() => <ProtectedModule module="estoque" />}</Route>
    <Route path="/financeiro">{() => <ProtectedModule module="financeiro" />}</Route>
    <Route path="/operacoes">{() => <ProtectedModule module="operacoes" />}</Route>
    <Route path="/campanhas">{() => <ProtectedModule module="campanhas" />}</Route>
    <Route path="/midias">{() => <ProtectedModule module="midias" />}</Route>
    <Route path="/acoes">{() => <ProtectedModule module="acoes" />}</Route>
    <Route path="/eventos">{() => <ProtectedModule module="eventos" />}</Route>
    <Route path="/indicadores">{() => <ProtectedModule module="indicadores" />}</Route>
    <Route path="/cadastros/:entity/:id">{() => <ProtectedModule module="cadastro-entidade" />}</Route>
    <Route path="/cadastros/modelos">{() => <ProtectedModule module="modelos-campanha" />}</Route>
    <Route path="/cadastros/:entity">{() => <ProtectedModule module="cadastro-entidade" />}</Route>
    <Route path="/cadastros">{() => <ProtectedModule module="cadastros" />}</Route>
    <Route path="/empresas">{() => <ProtectedModule module="empresas" />}</Route>
    <Route path="/trello">{() => <ProtectedModule module="trello" />}</Route>
    <Route path="/importar-dados">{() => <ProtectedModule module="importacao" />}</Route>
    <Route path="/exportar-relatorios">{() => <ProtectedModule module="exportacao" />}</Route>
    <Route path="/configuracoes">{() => <ProtectedModule module="configuracoes" />}</Route>
    <Route path="/perfil">{() => <ProtectedModule module="perfil" />}</Route>
    <Route path="/usuarios">{() => <ProtectedModule module="usuarios" />}</Route>
    <Route path="/administracao-usuarios">{() => <ProtectedModule module="usuarios" />}</Route>
    <Route path="/equipes">{() => <ProtectedModule module="equipes" />}</Route>
    <Route path="/pontos-de-acao">{() => <ProtectedModule module="pontos-de-acao" />}</Route>
    <Route path="/ajuda">{() => <ProtectedModule module="ajuda" />}</Route>
    <Route path="/notificacoes">{() => <ProtectedModule module="notificacoes" />}</Route>
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><Toaster position="top-right" richColors /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
