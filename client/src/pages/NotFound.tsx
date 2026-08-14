import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="cluster-grid min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="mx-4 w-full max-w-lg overflow-hidden border-border bg-card shadow-[0_20px_50px_rgba(14,114,59,0.12)] backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mb-6 flex items-center justify-center gap-2">
            <img src="/manus-storage/cluster-mg-logo_947e1614.png" alt="Cluster MG" className="h-8 w-8 rounded-lg bg-background object-contain p-0.5" />
            <span className="font-display text-sm font-extrabold tracking-tight text-foreground">MARKETING HUB <span className="text-primary">— CLUSTER MG</span></span>
          </div>
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-accent animate-pulse" />
              <AlertCircle className="relative h-16 w-16 text-sidebar-primary" />
            </div>
          </div>

          <h1 className="mb-2 font-display text-4xl font-extrabold text-foreground">404</h1>

          <h2 className="mb-4 text-xl font-semibold text-foreground">
            Página não encontrada
          </h2>

          <p className="mb-8 leading-relaxed text-muted-foreground">
            O endereço informado não está disponível nesta operação.
            <br />
            Ele pode ter sido movido, removido ou exigir outra permissão de acesso.
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              onClick={handleGoHome}
              className="rounded-xl bg-sidebar-primary px-6 py-2.5 text-white shadow-md transition-all duration-200 hover:bg-accent-foreground hover:shadow-lg"
            >
              <Home className="w-4 h-4 mr-2" />
              Voltar ao início
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
