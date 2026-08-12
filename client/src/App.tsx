import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import ProtectedModule from "./pages/ProtectedModule";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/estoque">{() => <ProtectedModule module="estoque" />}</Route>
    <Route path="/financeiro">{() => <ProtectedModule module="financeiro" />}</Route>
    <Route path="/midias">{() => <ProtectedModule module="midias" />}</Route>
    <Route path="/acoes">{() => <ProtectedModule module="acoes" />}</Route>
    <Route path="/eventos">{() => <ProtectedModule module="eventos" />}</Route>
    <Route path="/indicadores">{() => <ProtectedModule module="indicadores" />}</Route>
    <Route path="/configuracoes">{() => <ProtectedModule module="configuracoes" />}</Route>
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster position="top-right" richColors /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
