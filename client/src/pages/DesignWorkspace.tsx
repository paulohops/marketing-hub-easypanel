import BrandingSettingsPanel from "@/components/BrandingSettingsPanel";
import { ArrowLeft, Palette } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export default function DesignWorkspace() {
  const [, setLocation] = useLocation();
  return <div className="mx-auto max-w-5xl">
    <Button type="button" variant="outline" className="mb-5 border-border" onClick={() => setLocation("/configuracoes")}><ArrowLeft className="mr-2 h-4 w-4" />Voltar para Configurações</Button>
    <div className="flex gap-4 border-b border-border pb-6"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white shadow-sm"><Palette className="h-5 w-5" /></span><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">Identidade visual</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Design</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Personalize a identidade visual, a paleta e o contraste dos temas da aplicação.</p></div></div>
    <div className="mt-5"><BrandingSettingsPanel /></div>
  </div>;
}
