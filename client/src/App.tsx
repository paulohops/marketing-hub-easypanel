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

function renderRegistries() {
  return <ProtectedModule module="cadastros" />;
}

function renderOperationalAlias() {
  return <ProtectedModule module="cadastro-entidade" />;
}

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
    <Route path="/midias/audiovisual">{() => <ProtectedModule module="midias-audio-video" />}</Route>
    <Route path="/midias/audiovisual/veiculacao/:campaignId">{() => <ProtectedModule module="midias-tradicional-veiculacao" />}</Route>
    <Route path="/midias/audiovisual/:mediaPointId">{() => <ProtectedModule module="midias-tradicional" />}</Route>
    <Route path="/midias/tradicional/veiculacao/:campaignId">{() => <ProtectedModule module="midias-tradicional-veiculacao" />}</Route>
    <Route path="/midias/tradicional/:mediaPointId">{() => <ProtectedModule module="midias-tradicional" />}</Route>
    <Route path="/midias/externa/:mediaPointId">{() => <ProtectedModule module="midias-externa" />}</Route>
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
    <Route path="/cadastros/empresas/:providerId">{() => <ProtectedModule module="cadastro-entidade" />}</Route>
    <Route path="/cadastros/empresas">{() => <ProtectedModule module="cadastro-entidade" />}</Route>
    <Route path="/cadastros/territorio">{renderRegistries}</Route>
    <Route path="/cadastros/operacao">{renderRegistries}</Route>
    <Route path="/cadastros/parceiros">{renderRegistries}</Route>
    <Route path="/cadastros/produtos-servicos">{renderRegistries}</Route>
    <Route path="/cadastros/produtos_servicos">{() => <Redirect to="/cadastros/produtos-servicos" replace />}</Route>
    <Route path="/cadastros/categorias">{renderRegistries}</Route>
    <Route path="/cadastros/financeiro">{renderRegistries}</Route>
    <Route path="/cadastros/modelos">{renderRegistries}</Route>
    <Route path="/cadastros/regionais">{renderOperationalAlias}</Route>
    <Route path="/cadastros/cidades">{renderOperationalAlias}</Route>
    <Route path="/cadastros/lojas">{renderOperationalAlias}</Route>
    <Route path="/cadastros/fornecedores">{renderOperationalAlias}</Route>
    <Route path="/cadastros/supervisores">{renderOperationalAlias}</Route>
    <Route path="/cadastros/servicos">{renderOperationalAlias}</Route>
    <Route path="/cadastros/subservicos">{renderOperationalAlias}</Route>
    <Route path="/cadastros/tipos-de-produto">{renderOperationalAlias}</Route>
    <Route path="/cadastros/tipos-de-midia">{renderOperationalAlias}</Route>
    <Route path="/cadastros/tipos-de-acao">{renderOperationalAlias}</Route>
    <Route path="/cadastros/tipos-de-evento">{renderOperationalAlias}</Route>
    <Route path="/cadastros/tipos-de-campanha">{renderOperationalAlias}</Route>
    <Route path="/cadastros/setores-de-campanha">{renderOperationalAlias}</Route>
    <Route path="/cadastros/categorias-financeiras">{renderOperationalAlias}</Route>
    <Route path="/cadastros/:entity/:id">{() => <ProtectedModule module="cadastro-entidade" />}</Route>
    <Route path="/cadastros/modelos-acoes">{() => <ProtectedModule module="modelos-acao" />}</Route>
    <Route path="/cadastros/influencers">{() => <ProtectedModule module="cadastro-influencers" />}</Route>
    <Route path="/cadastros/operacionais">{() => <Redirect to="/cadastros/territorio" replace />}</Route>
    <Route path="/cadastros">{() => <Redirect to="/cadastros/territorio" replace />}</Route>
    <Route path="/cadastros/:entity">{() => <ProtectedModule module="cadastro-entidade" />}</Route>
    <Route path="/empresas/:providerId">{() => <ProtectedModule module="empresas" />}</Route>
    <Route path="/empresas">{() => <ProtectedModule module="empresas" />}</Route>
    <Route path="/trello">{() => <ProtectedModule module="trello" />}</Route>
    <Route path="/processos">{() => <ProtectedModule module="processos" />}</Route>
    <Route path="/importar-dados">{() => <ProtectedModule module="importacao" />}</Route>
    <Route path="/exportar-relatorios">{() => <ProtectedModule module="exportacao" />}</Route>
    <Route path="/configuracoes">{() => <ProtectedModule module="configuracoes" />}</Route>
    <Route path="/configuracoes/acessos">{() => <ProtectedModule module="usuarios" />}</Route>
    <Route path="/configuracoes/equipes">{() => <ProtectedModule module="equipes" />}</Route>
    <Route path="/configuracoes/central-de-dados">{() => <ProtectedModule module="central-de-dados" />}</Route>
    <Route path="/configuracoes/design">{() => <ProtectedModule module="design" />}</Route>
    <Route path="/configuracoes/sistema">{() => <ProtectedModule module="sistema" />}</Route>
    <Route path="/perfil">{() => <ProtectedModule module="perfil" />}</Route>
    <Route path="/usuarios">{() => <Redirect to="/configuracoes/acessos" replace />}</Route>
    <Route path="/administracao-usuarios">{() => <Redirect to="/configuracoes/acessos" replace />}</Route>
    <Route path="/equipes">{() => <Redirect to="/configuracoes/equipes" replace />}</Route>
    <Route path="/pontos-de-acao">{() => <ProtectedModule module="pontos-de-acao" />}</Route>
    <Route path="/central-conhecimento/:topicId">{({ topicId }) => <ProtectedModule module="central-conhecimento" topicId={topicId} />}</Route>
    <Route path="/central-conhecimento">{() => <ProtectedModule module="central-conhecimento" />}</Route>
    <Route path="/ajuda">{() => <Redirect to="/central-conhecimento" replace />}</Route>
    <Route path="/notificacoes">{() => <ProtectedModule module="notificacoes" />}</Route>
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><BrandingProvider><TooltipProvider><Toaster position="top-right" richColors /><Router /></TooltipProvider></BrandingProvider></ThemeProvider></ErrorBoundary>;
}
