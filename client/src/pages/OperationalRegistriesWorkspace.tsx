import OperationalRegistriesPanel from "@/components/OperationalRegistriesPanel";
import { Database } from "lucide-react";

export default function OperationalRegistriesWorkspace() {
  return <div className="mx-auto max-w-6xl">
    <div className="flex gap-4 border-b border-border pb-6">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white shadow-sm"><Database className="h-5 w-5" /></span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground">Gestão operacional</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Cadastros operacionais</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Mantenha empresas, territórios, fornecedores, ofertas, serviços e parâmetros que estruturam a operação do Trade HUB.</p>
      </div>
    </div>
    <OperationalRegistriesPanel />
  </div>;
}
