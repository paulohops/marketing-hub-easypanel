import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  CopyPlus,
  Edit3,
  FileText,
  Loader2,
  PackagePlus,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const statusOptions = [
  { id: 1, value: "scheduled", label: "Planejada" },
  { id: 2, value: "active", label: "Ativa" },
  { id: 3, value: "completed", label: "Encerrada" },
  { id: 4, value: "cancelled", label: "Cancelada" },
] as const;
type PlanForm = {
  name: string;
  speed: string;
  description: string;
  price: string;
  unit: string;
  active: boolean;
};
type PromotionForm = {
  name: string;
  description: string;
  active: boolean;
  plans: PlanForm[];
};
type TemplateForm = {
  id?: number;
  name: string;
  description: string;
  objective: string;
  defaultStatusId: number;
  defaultDurationDays: string;
  active: boolean;
  promotions: PromotionForm[];
};
const blankPlan = (): PlanForm => ({
  name: "",
  speed: "",
  description: "",
  price: "",
  unit: "mês",
  active: true,
});
const blankPromotion = (): PromotionForm => ({
  name: "",
  description: "",
  active: true,
  plans: [blankPlan()],
});
const blankForm = (): TemplateForm => ({
  name: "",
  description: "",
  objective: "",
  defaultStatusId: 1,
  defaultDurationDays: "",
  active: true,
  promotions: [],
});
const statusValue = (id: number) =>
  statusOptions.find(option => option.id === id)?.value ?? "scheduled";
const statusId = (status: string) =>
  statusOptions.find(option => option.value === status)?.id ?? 1;
const money = (value: string | number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value)
  );

export default function CampaignTemplatesWorkspace() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: templates = [], isLoading } =
    trpc.campaigns.listTemplates.useQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TemplateForm>(blankForm);
  const saveMutation = trpc.campaigns.saveTemplate.useMutation({
    onSuccess: () => {
      toast.success("Modelo de campanha salvo.");
      utils.campaigns.listTemplates.invalidate();
      setOpen(false);
      setForm(blankForm());
    },
    onError: error => toast.error(error.message),
  });
  const deleteMutation = trpc.campaigns.deleteTemplate.useMutation({
    onSuccess: () => {
      toast.success("Modelo removido.");
      utils.campaigns.listTemplates.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const updatePromotion = (
    promotionIndex: number,
    change: Partial<PromotionForm>
  ) =>
    setForm(current => ({
      ...current,
      promotions: current.promotions.map((promotion, index) =>
        index === promotionIndex ? { ...promotion, ...change } : promotion
      ),
    }));
  const updatePlan = (
    promotionIndex: number,
    planIndex: number,
    change: Partial<PlanForm>
  ) =>
    setForm(current => ({
      ...current,
      promotions: current.promotions.map((promotion, index) =>
        index !== promotionIndex
          ? promotion
          : {
              ...promotion,
              plans: promotion.plans.map((plan, nestedIndex) =>
                nestedIndex === planIndex ? { ...plan, ...change } : plan
              ),
            }
      ),
    }));
  const edit = (template: (typeof templates)[number]) => {
    setForm({
      id: template.id,
      name: template.name,
      description: template.description ?? "",
      objective: template.objective ?? "",
      defaultStatusId: statusId(template.defaultStatus),
      defaultDurationDays: template.defaultDurationDays
        ? String(template.defaultDurationDays)
        : "",
      active: template.active,
      promotions: template.promotions.map(promotion => ({
        name: promotion.name,
        description: promotion.description ?? "",
        active: promotion.active,
        plans: promotion.plans.map(plan => ({
          name: plan.name,
          speed: plan.speed ?? "",
          description: plan.description ?? "",
          price: String(plan.price),
          unit: plan.unit,
          active: plan.active,
        })),
      })),
    });
    setOpen(true);
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (
      form.promotions.some(
        promotion =>
          !promotion.name.trim() ||
          promotion.plans.some(plan => !plan.name.trim() || !plan.price)
      )
    ) {
      toast.error("Informe o nome e valor de todos os planos.");
      return;
    }
    saveMutation.mutate({
      id: form.id,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      objective: form.objective.trim() || undefined,
      defaultStatus: statusValue(form.defaultStatusId),
      defaultDurationDays: form.defaultDurationDays
        ? Number(form.defaultDurationDays)
        : null,
      active: form.active,
      promotions: form.promotions.map(promotion => ({
        name: promotion.name.trim(),
        description: promotion.description.trim() || undefined,
        active: promotion.active,
        plans: promotion.plans.map(plan => ({
          name: plan.name.trim(),
          speed: plan.speed.trim() || undefined,
          description: plan.description.trim() || undefined,
          price: Number(plan.price),
          unit: plan.unit.trim() || "unidade",
          active: plan.active,
        })),
      })),
    });
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => setLocation("/cadastros/operacionais")}
            className="-ml-2 h-8 px-2 text-xs text-primary"
          >
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" /> Cadastros
          </Button>
          <div className="mt-2 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-primary">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground">
                Modelos de campanha
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Padronize promoções, planos e duração para acelerar os próximos
                planejamentos.
              </p>
            </div>
          </div>
        </div>
        <Button
          onClick={() => {
            setForm(blankForm());
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> Novo modelo
        </Button>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        {isLoading ? (
          <div className="col-span-full grid min-h-40 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : templates.length ? (
          templates.map(template => (
            <Card key={template.id} className="border-border bg-card shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={template.active ? "secondary" : "outline"}
                      >
                        {template.active ? "Ativo" : "Inativo"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {template.defaultDurationDays
                          ? `${template.defaultDurationDays} dias`
                          : "Prazo livre"}
                      </span>
                    </div>
                    <h2 className="mt-2 font-display text-lg font-bold text-foreground">
                      {template.name}
                    </h2>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">
                      {template.description ||
                        template.objective ||
                        "Sem descrição."}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => edit(template)}
                      aria-label={`Editar ${template.name}`}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Excluir o modelo ${template.name}? As campanhas já criadas serão preservadas.`
                          )
                        )
                          deleteMutation.mutate({ id: template.id });
                      }}
                      aria-label={`Excluir ${template.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {template.promotions.length} promoção
                    {template.promotions.length === 1 ? "" : "ões"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {template.promotions
                      .flatMap(promotion => promotion.plans)
                      .slice(0, 4)
                      .map(plan => (
                        <Badge
                          key={plan.id}
                          variant="outline"
                          className="font-normal"
                        >
                          {plan.name} · {money(plan.price)}
                        </Badge>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full rounded-xl border border-dashed border-border p-10 text-center">
            <CopyPlus className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="mt-3 font-semibold text-foreground">
              Nenhum modelo cadastrado
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Crie um modelo para reutilizar promoções, planos e valores nas
              campanhas.
            </p>
          </div>
        )}
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {form.id
                ? "Editar modelo de campanha"
                : "Novo modelo de campanha"}
            </DialogTitle>
            <DialogDescription>
              O modelo serve como ponto de partida e cada campanha criada poderá
              ser ajustada livremente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-5 pt-2">
            <section className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4 md:grid-cols-2">
              <div className="md:col-span-2 grid gap-1.5">
                <Label htmlFor="template-name">Nome do modelo</Label>
                <Input
                  id="template-name"
                  value={form.name}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Ex.: Lançamento fibra regional"
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="template-description">Descrição</Label>
                <Input
                  id="template-description"
                  value={form.description}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Quando usar este modelo"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="template-objective">Objetivo padrão</Label>
                <Input
                  id="template-objective"
                  value={form.objective}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      objective: event.target.value,
                    }))
                  }
                  placeholder="Resultado esperado"
                />
              </div>
              <SearchableMultiSelect
                id="template-status"
                label="Situação inicial"
                options={statusOptions.map(status => ({
                  id: status.id,
                  label: status.label,
                }))}
                values={[form.defaultStatusId]}
                onChange={values =>
                  setForm(current => ({
                    ...current,
                    defaultStatusId: values[0] ?? 1,
                  }))
                }
                maxSelections={1}
              />
              <div className="grid gap-1.5">
                <Label htmlFor="template-duration">
                  Duração sugerida (dias)
                </Label>
                <Input
                  id="template-duration"
                  type="number"
                  min="1"
                  max="730"
                  value={form.defaultDurationDays}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      defaultDurationDays: event.target.value,
                    }))
                  }
                  placeholder="Ex.: 30"
                />
              </div>
            </section>
            <section className="rounded-xl border border-border">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                <div>
                  <h3 className="font-semibold text-foreground">
                    Promoções e planos padrão
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Esses dados serão copiados para a campanha e permanecerão
                    editáveis.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setForm(current => ({
                      ...current,
                      promotions: [...current.promotions, blankPromotion()],
                    }))
                  }
                >
                  <PackagePlus className="mr-2 h-4 w-4" /> Adicionar promoção
                </Button>
              </div>
              <div className="space-y-4 p-4">
                {form.promotions.length ? (
                  form.promotions.map((promotion, promotionIndex) => (
                    <div
                      key={promotionIndex}
                      className="rounded-xl border border-border p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                          <div className="grid gap-1.5">
                            <Label>Nome da promoção</Label>
                            <Input
                              value={promotion.name}
                              onChange={event =>
                                updatePromotion(promotionIndex, {
                                  name: event.target.value,
                                })
                              }
                              required
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label>Descrição</Label>
                            <Input
                              value={promotion.description}
                              onChange={event =>
                                updatePromotion(promotionIndex, {
                                  description: event.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setForm(current => ({
                              ...current,
                              promotions: current.promotions.filter(
                                (_, index) => index !== promotionIndex
                              ),
                            }))
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-4 space-y-3 border-t border-border pt-4">
                        {promotion.plans.map((plan, planIndex) => (
                          <div
                            key={planIndex}
                            className="grid gap-3 rounded-lg bg-muted/40 p-3 md:grid-cols-[1.2fr_.75fr_.7fr_.6fr_1.2fr_auto]"
                          >
                            <div className="grid gap-1.5">
                              <Label>Nome do plano</Label>
                              <Input
                                value={plan.name}
                                onChange={event =>
                                  updatePlan(promotionIndex, planIndex, {
                                    name: event.target.value,
                                  })
                                }
                                required
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label>Velocidade</Label>
                              <Input
                                value={plan.speed}
                                onChange={event =>
                                  updatePlan(promotionIndex, planIndex, {
                                    speed: event.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label>Valor</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={plan.price}
                                onChange={event =>
                                  updatePlan(promotionIndex, planIndex, {
                                    price: event.target.value,
                                  })
                                }
                                required
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label>Mês</Label>
                              <Input
                                value={plan.unit}
                                onChange={event =>
                                  updatePlan(promotionIndex, planIndex, {
                                    unit: event.target.value,
                                  })
                                }
                              />
                            </div>
                            <div className="grid gap-1.5">
                              <Label>Detalhes</Label>
                              <Input
                                value={plan.description}
                                onChange={event =>
                                  updatePlan(promotionIndex, planIndex, {
                                    description: event.target.value,
                                  })
                                }
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={promotion.plans.length === 1}
                              onClick={() =>
                                updatePromotion(promotionIndex, {
                                  plans: promotion.plans.filter(
                                    (_, index) => index !== planIndex
                                  ),
                                })
                              }
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            updatePromotion(promotionIndex, {
                              plans: [...promotion.plans, blankPlan()],
                            })
                          }
                          className="text-primary"
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar
                          plano
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                    Adicione promoções e planos quando este modelo precisar
                    carregar ofertas predefinidas.
                  </p>
                )}
              </div>
            </section>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar modelo
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
