import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpenCheck, ChevronLeft, ChevronRight, CircleHelp, LayoutDashboard, MapPinned, Settings2, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

const onboardingStorageKey = "trade_hub_onboarding_done";

const steps = [
  { title: "Bem-vindo ao Marketing HUB", description: "Você está na central de gestão do Cluster MG. Aqui, a operação e os investimentos ficam reunidos em uma única visão.", icon: Sparkles, accent: "bg-accent text-sidebar-primary" },
  { title: "Acompanhe a operação", description: "Planeje ações, mídias e eventos, registre responsáveis, fornecedores, custos e decisões pós-execução.", icon: MapPinned, accent: "bg-secondary text-primary" },
  { title: "Administre a gestão", description: "Controle materiais, orçamento, notas fiscais e pagamentos com os vínculos originados pela operação.", icon: LayoutDashboard, accent: "bg-secondary text-primary" },
  { title: "Mantenha os cadastros organizados", description: "Em Gestão > Cadastros, configure empresas, territórios, fornecedores, parceiros, serviços e parâmetros que abastecem os módulos.", icon: Settings2, accent: "bg-secondary text-primary" },
  { title: "Conte com a central de ajuda", description: "Encontre documentação por módulo, boas práticas e o canal para solicitar suporte no menu do seu perfil.", icon: CircleHelp, accent: "bg-secondary text-primary" },
] as const;

export default function OnboardingTutorial() {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setOpen(window.localStorage.getItem(onboardingStorageKey) !== "true");
  }, []);

  const dismiss = (remember: boolean) => {
    if (remember) window.localStorage.setItem(onboardingStorageKey, "true");
    setOpen(false);
  };
  const step = steps[stepIndex];
  const StepIcon = step.icon;
  const isLastStep = stepIndex === steps.length - 1;

  return <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) dismiss(false); }}>
    <DialogContent showCloseButton={false} className="max-w-lg overflow-hidden rounded-2xl border-border bg-card p-0 text-card-foreground sm:max-w-lg">
      <div className="relative overflow-hidden bg-primary px-6 pb-12 pt-7 text-white">
        <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full border-[22px] border-sidebar-primary/90" />
        <div className="relative flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"><BookOpenCheck className="h-3.5 w-3.5" /> Primeiros passos</span>
          <button aria-label="Pular tutorial" onClick={() => dismiss(false)} className="rounded-lg p-1.5 text-white/85 transition hover:bg-white/15 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="relative mt-7 flex gap-1.5">{steps.map((item, index) => <span key={item.title} className={`h-1.5 flex-1 rounded-full ${index <= stepIndex ? "bg-sidebar-primary" : "bg-white/25"}`} />)}</div>
      </div>
      <div className="px-6 pb-6 -mt-7">
        <span className={`grid h-14 w-14 place-items-center rounded-2xl shadow-lg ${step.accent}`}><StepIcon className="h-6 w-6" /></span>
        <DialogHeader className="mt-5 text-left">
          <DialogTitle className="font-display text-2xl font-semibold">{step.title}</DialogTitle>
          <DialogDescription className="pt-2 text-sm leading-6 text-muted-foreground">{step.description}</DialogDescription>
        </DialogHeader>
        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={() => dismiss(true)} className="justify-start px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground">Não mostrar novamente</Button>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <Button variant="outline" size="sm" disabled={stepIndex === 0} onClick={() => setStepIndex(index => index - 1)} className="rounded-lg border-border"><ChevronLeft className="mr-1 h-3.5 w-3.5" /> Voltar</Button>
            <Button size="sm" onClick={() => isLastStep ? dismiss(true) : setStepIndex(index => index + 1)} className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">{isLastStep ? "Concluir" : "Próximo"}{!isLastStep && <ChevronRight className="ml-1 h-3.5 w-3.5" />}</Button>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
