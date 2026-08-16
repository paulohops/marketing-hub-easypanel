import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { BrandingProvider } from "./contexts/BrandingContext";
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
    <Route path="/campanhas/:campaignId">{() => <ProtectedModule module="campanhas" />}</Route>
    <Route path="/campanhas">{() => <ProtectedModule module="campanhas" />}</Route>
    <Route path="/midias/graficas">{() => <ProtectedModule module="midias-graficas" />}</Route>
    <Route path="/midias/audio-video">{() => <ProtectedModule module="midias-audio-video" />}</Route>
    <Route path="/midias/panfletagem">{() => <ProtectedModule module="midias-panfletagem" />}</Route>
    <Route path="/midias/carro-de-som">{() => <ProtectedModule module="midias-carro-som" />}</Route>
    <Route path="/midias/influencers">{() => <ProtectedModule module="midias-influencers" />}</Route>
    <Route path="/midias/veiculacao/:campaignId">{() => <ProtectedModule module="midias-veiculacao" />}</Route>
    <Route path="/midias">{() => <Redirect to="/midias/graficas" replace />}</Route>
    <Route path="/midias/:mediaPointId">{() => <ProtectedModule module="midias-graficas" />}</Route>
    <Route path="/acoes/:actionId">{() => <ProtectedModule module="acoes" />}</Route>
    <Route path="/acoes">{() => <ProtectedModule module="acoes" />}</Route>
    <Route path="/eventos/:eventId">{() => <ProtectedModule module="eventos" />}</Route>
    <Route path="/eventos">{() => <ProtectedModule module="eventos" />}</Route>
    <Route path="/indicadores">{() => <ProtectedModule module="indicadores" />}</Route>
    <Route path="/cadastros/empresas/:providerId">{() => <ProtectedModule module="empresas" />}</Route>
    <Route path="/cadastros/empresas">{() => <ProtectedModule module="empresas" />}</Route>
    <Route path="/cadastros/:entity/:id">{() => <ProtectedModule module="cadastro-entidade" />}</Route>
    <Route path="/cadastros/modelos-acoes">{() => <ProtectedModule module="modelos-acao" />}</Route>
    <Route path="/cadastros/modelos">{() => <ProtectedModule module="modelos-campanha" />}</Route>
    <Route path="/cadastros/influencers">{() => <ProtectedModule module="cadastro-influencers" />}</Route>
    <Route path="/cadastros/operacionais">{() => <ProtectedModule module="cadastros" />}</Route>
    <Route path="/cadastros">{() => <Redirect to="/cadastros/operacionais" replace />}</Route>
    <Route path="/cadastros/:entity">{() => <ProtectedModule module="cadastro-entidade" />}</Route>
    <Route path="/empresas/:providerId">{() => <ProtectedModule module="empresas" />}</Route>
    <Route path="/empresas">{() => <ProtectedModule module="empresas" />}</Route>
    <Route path="/trello">{() => <ProtectedModule module="trello" />}</Route>
    <Route path="/importar-dados">{() => <ProtectedModule module="importacao" />}</Route>
    <Route path="/exportar-relatorios">{() => <ProtectedModule module="exportacao" />}</Route>
    <Route path="/configuracoes">{() => <ProtectedModule module="configuracoes" />}</Route>
    <Route path="/configuracoes/acessos">{() => <ProtectedModule module="usuarios" />}</Route>
    <Route path="/configuracoes/equipes">{() => <ProtectedModule module="equipes" />}</Route>
    <Route path="/configuracoes/central-de-dados">{() => <ProtectedModule module="central-de-dados" />}</Route>
    <Route path="/configuracoes/design">{() => <ProtectedModule module="design" />}</Route>
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
  return <ErrorBoundary><BrandingProvider><ThemeProvider defaultTheme="light" switchable><TooltipProvider><Toaster position="top-right" richColors /><Router /></TooltipProvider></ThemeProvider></BrandingProvider></ErrorBoundary>;
}
