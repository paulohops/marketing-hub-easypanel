// @ts-nocheck
import ImageViewer from "@/components/ImageViewer";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useEffectivePermissions } from "@/hooks/useEffectivePermissions";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft,
  CalendarDays,
  Edit3,
  ImagePlus,
  Loader2,
  MapPinned,
  PackagePlus,
  Plus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation, useRoute } from "wouter";

const statuses = [
  {
    id: 1,
    value: "scheduled",
    label: "Planejadas",
    singular: "Planejada",
    className:
      "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
  },
  {
    id: 2,
    value: "active",
    label: "Ativas",
    singular: "Ativa",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  {
    id: 3,
    value: "completed",
    label: "Encerradas",
    singular: "Encerrada",
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
  },
  {
    id: 4,
    value: "cancelled",
    label: "Canceladas",
    singular: "Cancelada",
    className:
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
  },
];

const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const ratingDefinitions = {
  1: { label: "Muito ruim", className: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300" },
  2: { label: "Ruim", className: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300" },
  3: { label: "Regular", className: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300" },
  4: { label: "Bom", className: "border-lime-200 bg-lime-50 text-lime-800 dark:border-lime-900 dark:bg-lime-950/40 dark:text-lime-300" },
  5: { label: "Excelente", className: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" },
};

const blankPlan = () => ({
  name: "",
  speed: "",
  description: "",
  price: "",
  unit: "mês",
  active: true,
});
const blankPromotion = () => ({
  name: "",
  description: "",
  active: true,
  cityIds: [],
  plans: [blankPlan()],
});
const blankForm = () => ({
  id: undefined,
  name: "",
  objective: "",
  providerId: null,
  campaignTypeId: null,
  campaignSectorId: null,
  regionalIds: [],
  cityIds: [],
  templateId: null,
  startsAt: "",
  endsAt: "",
  status: "active",
  promotions: [],
});
const money = value =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number(value ?? 0)
  );
const date = value =>
  value
    ? new Date(value).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "A definir";
const compactDate = value =>
  value ? new Date(value).toLocaleDateString("pt-BR") : "—";
const companyClass = name => {
  const normalized = String(name ?? "").toLocaleLowerCase("pt-BR");
  if (normalized.includes("sempre"))
    return "border-[#f45103]/25 bg-[#f45103]/10 text-[#c33c00] dark:text-[#ff8a55]";
  if (normalized.includes("onnet") || normalized.includes("on net"))
    return "border-[#0e723b]/25 bg-[#0e723b]/10 text-[#0e723b] dark:text-[#76d596]";
  return "border-border bg-muted text-muted-foreground";
};
const partnershipLabel = value =>
  ({ paid: "Pago", barter: "Permuta", mixed: "Misto" })[value] ?? value;

function StatusBadge({ status }) {
  const item = statuses.find(candidate => candidate.value === status);
  return (
    <Badge variant="outline" className={item?.className}>
      {item?.singular ?? status}
    </Badge>
  );
}

function CompanyBadge({ name }) {
  return name ? (
    <Badge variant="outline" className={companyClass(name)}>
      {name}
    </Badge>
  ) : null;
}

function RatingBadge({ rating }) {
  const definition = ratingDefinitions[Number(rating)];
  return definition ? (
    <Badge variant="outline" className={definition.className}>
      Nota {rating} · {definition.label}
    </Badge>
  ) : null;
}

function Editor({
  open,
  onOpenChange,
  form,
  setForm,
  refs,
  templates,
  onSubmit,
  pending,
}) {
  const regionalOptions = (refs?.regionals ?? []).filter(
    regional => !form.providerId || regional.providerId === form.providerId
  );
  const cityOptions = (refs?.cities ?? []).filter(
    city =>
      (!form.providerId || city.providerId === form.providerId) &&
      (!form.regionalIds.length || form.regionalIds.includes(city.regionalId))
  );
  const updatePromotion = (index, patch) =>
    setForm(current => ({
      ...current,
      promotions: current.promotions.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item
      ),
    }));
  const updatePlan = (promotionIndex, planIndex, patch) =>
    updatePromotion(promotionIndex, {
      plans: form.promotions[promotionIndex].plans.map((item, itemIndex) =>
        itemIndex === planIndex ? { ...item, ...patch } : item
      ),
    });
  const promotionCityOptions = () =>
    form.cityIds.length
      ? cityOptions.filter(city => form.cityIds.includes(city.id))
      : cityOptions;
  const applyTemplate = values => {
    const template = (templates ?? []).find(item => item.id === values[0]);
    if (!template)
      return setForm(current => ({ ...current, templateId: null }));
    setForm(current => ({
      ...current,
      templateId: template.id,
      name: current.name || template.name,
      objective: current.objective || template.objective || "",
      status: template.defaultStatus,
      promotions: template.promotions.map(promotion => ({
        name: promotion.name,
        description: promotion.description ?? "",
        active: promotion.active,
        cityIds: [],
        plans: promotion.plans.map(plan => ({
          name: plan.name,
          speed: plan.speed ?? "",
          description: plan.description ?? "",
          price: String(plan.price),
          unit: plan.unit,
          active: plan.active,
        })),
      })),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {form.id ? "Editar campanha" : "Nova campanha"}
          </DialogTitle>
          <DialogDescription>
            Defina o território, as promoções, os planos e o cronograma.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-5">
          <section className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <SearchableMultiSelect
                id="campaign-template"
                label="Começar com um modelo"
                options={(templates ?? [])
                  .filter(template => template.active)
                  .map(template => ({
                    id: template.id,
                    label: template.name,
                    description: template.description ?? "",
                  }))}
                values={form.templateId ? [form.templateId] : []}
                onChange={applyTemplate}
                maxSelections={1}
                placeholder="Planejamento em branco"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Nome da campanha</Label>
              <Input
                value={form.name}
                onChange={event =>
                  setForm(current => ({ ...current, name: event.target.value }))
                }
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Objetivo</Label>
              <Input
                value={form.objective}
                onChange={event =>
                  setForm(current => ({
                    ...current,
                    objective: event.target.value,
                  }))
                }
              />
            </div>
            <SearchableMultiSelect
              id="campaign-type"
              label="Tipo de campanha"
              options={(refs?.campaignTypes ?? []).map(item => ({
                id: item.id,
                label: item.name,
              }))}
              values={form.campaignTypeId ? [form.campaignTypeId] : []}
              onChange={values =>
                setForm(current => ({
                  ...current,
                  campaignTypeId: values[0] ?? null,
                }))
              }
              maxSelections={1}
              placeholder="Selecione o tipo"
            />
            <SearchableMultiSelect
              id="campaign-sector"
              label="Setor"
              options={(refs?.campaignSectors ?? []).map(item => ({
                id: item.id,
                label: item.name,
              }))}
              values={form.campaignSectorId ? [form.campaignSectorId] : []}
              onChange={values =>
                setForm(current => ({
                  ...current,
                  campaignSectorId: values[0] ?? null,
                }))
              }
              maxSelections={1}
              placeholder="Selecione o setor"
            />
            <div className="md:col-span-2">
              <SearchableMultiSelect
                id="campaign-company"
                label="Empresa responsável"
                options={(refs?.providers ?? []).map(provider => ({
                  id: provider.id,
                  label: provider.name,
                }))}
                values={form.providerId ? [form.providerId] : []}
                onChange={values =>
                  setForm(current => ({
                    ...current,
                    providerId: values[0] ?? null,
                    regionalIds: [],
                    cityIds: [],
                    promotions: current.promotions.map(promotion => ({
                      ...promotion,
                      cityIds: [],
                    })),
                  }))
                }
                maxSelections={1}
                placeholder="Campanha global"
              />
            </div>
            <SearchableMultiSelect
              id="campaign-regionals"
              label="Regionais atendidas"
              options={regionalOptions.map(regional => ({
                id: regional.id,
                label: regional.name,
              }))}
              values={form.regionalIds}
              onChange={regionalIds =>
                setForm(current => ({
                  ...current,
                  regionalIds,
                  cityIds: [],
                  promotions: current.promotions.map(promotion => ({
                    ...promotion,
                    cityIds: [],
                  })),
                }))
              }
              placeholder="Todas as regionais"
            />
            <SearchableMultiSelect
              id="campaign-cities"
              label="Cidades atendidas (opcional)"
              options={cityOptions.map(city => ({
                id: city.id,
                label: city.name,
                description: `${city.state ?? ""}${city.regionalName ? ` · ${city.regionalName}` : ""}`,
              }))}
              values={form.cityIds}
              onChange={cityIds =>
                setForm(current => ({
                  ...current,
                  cityIds,
                  promotions: current.promotions.map(promotion => ({
                    ...promotion,
                    cityIds: promotion.cityIds.filter(
                      id => !cityIds.length || cityIds.includes(id)
                    ),
                  })),
                }))
              }
              placeholder="Todas as cidades"
            />
            <SearchableMultiSelect
              id="campaign-status"
              label="Situação"
              options={statuses.map(status => ({
                id: status.id,
                label: status.singular,
              }))}
              values={[
                statuses.find(status => status.value === form.status)?.id ?? 2,
              ]}
              onChange={values =>
                setForm(current => ({
                  ...current,
                  status:
                    statuses.find(status => status.id === values[0])?.value ??
                    "active",
                }))
              }
              maxSelections={1}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Início</Label>
                <Input
                  type="date"
                  value={form.startsAt}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      startsAt: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Término</Label>
                <Input
                  type="date"
                  value={form.endsAt}
                  onChange={event =>
                    setForm(current => ({
                      ...current,
                      endsAt: event.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </section>
          <section className="rounded-xl border border-border">
            <div className="flex items-center justify-between gap-3 border-b border-border p-4">
              <div>
                <h3 className="font-semibold text-foreground">
                  Promoções e planos
                </h3>
                <p className="text-xs text-muted-foreground">
                  Adicione cada promoção com seus respectivos planos e valores.
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
                <PackagePlus className="mr-2 h-4 w-4" />
                Adicionar promoção
              </Button>
            </div>
            <div className="divide-y divide-border">
              {form.promotions.map((promotion, promotionIndex) => (
                <div key={promotionIndex} className="space-y-3 p-4">
                  <div className="flex gap-3">
                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                      <Input
                        value={promotion.name}
                        onChange={event =>
                          updatePromotion(promotionIndex, {
                            name: event.target.value,
                          })
                        }
                        placeholder="Nome da promoção"
                        required
                      />
                      <Input
                        value={promotion.description}
                        onChange={event =>
                          updatePromotion(promotionIndex, {
                            description: event.target.value,
                          })
                        }
                        placeholder="Descrição"
                      />
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
                  <SearchableMultiSelect
                    id={`promotion-cities-${promotionIndex}`}
                    label="Cidades específicas da promoção"
                    options={promotionCityOptions().map(city => ({
                      id: city.id,
                      label: city.name,
                      description: city.state ?? "",
                    }))}
                    values={promotion.cityIds}
                    onChange={cityIds =>
                      updatePromotion(promotionIndex, { cityIds })
                    }
                    placeholder="Todas as cidades"
                  />
                  <div className="space-y-2 border-l-2 border-primary/20 pl-3">
                    {promotion.plans.map((plan, planIndex) => (
                      <div
                        key={planIndex}
                        className="grid gap-2 md:grid-cols-[minmax(150px,1.2fr)_120px_110px_82px_minmax(160px,1.2fr)_auto]"
                      >
                        <Input
                          value={plan.name}
                          onChange={event =>
                            updatePlan(promotionIndex, planIndex, {
                              name: event.target.value,
                            })
                          }
                          placeholder="Nome do plano"
                          required
                        />
                        <Input
                          value={plan.speed}
                          onChange={event =>
                            updatePlan(promotionIndex, planIndex, {
                              speed: event.target.value,
                            })
                          }
                          placeholder="Velocidade"
                        />
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
                          placeholder="Valor"
                          required
                        />
                        <Input
                          value={plan.unit}
                          onChange={event =>
                            updatePlan(promotionIndex, planIndex, {
                              unit: event.target.value,
                            })
                          }
                          placeholder="Mês"
                        />
                        <Input
                          value={plan.description}
                          onChange={event =>
                            updatePlan(promotionIndex, planIndex, {
                              description: event.target.value,
                            })
                          }
                          placeholder="Detalhes"
                        />
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
                      className="text-primary"
                      onClick={() =>
                        updatePromotion(promotionIndex, {
                          plans: [...promotion.plans, blankPlan()],
                        })
                      }
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Adicionar plano
                    </Button>
                  </div>
                </div>
              ))}
              {!form.promotions.length && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nenhuma promoção cadastrada.
                </p>
              )}
            </div>
          </section>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {form.id ? "Salvar alterações" : "Criar campanha"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Detail({
  campaign,
  canWrite,
  back,
  edit,
  upload,
  saveDebrief,
  saveCities,
  saving,
}) {
  const [rating, setRating] = useState(campaign.debriefRating ?? 5);
  const [notes, setNotes] = useState(campaign.debriefNotes ?? "");
  const [result, setResult] = useState(campaign.debriefResult ?? "");
  const [promotion, setPromotion] = useState(null);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [cityIds, setCityIds] = useState([]);
  const [operationFilter, setOperationFilter] = useState("all");
  const [, setLocation] = useLocation();
  const openPromotion = item => {
    setPromotion(item);
    setCityIds(item.cities.map(city => city.id));
  };
  const operations = [
    ...campaign.actions.map(item => ({
      ...item,
      kind: "action",
      label: "Ação",
      href: `/acoes/${item.id}`,
    })),
    ...campaign.events.map(item => ({
      ...item,
      kind: "event",
      label: "Evento",
      href: `/eventos/${item.id}`,
    })),
    ...campaign.media.map(item => ({
      ...item,
      kind: "media",
      label: "Mídia",
      href: `/midias/${item.id}`,
    })),
  ];
  const operationKinds = [
    { id: "all", label: "Todas", count: operations.length },
    { id: "action", label: "Ações", count: campaign.actions.length },
    { id: "media", label: "Mídias", count: campaign.media.length },
    { id: "event", label: "Eventos", count: campaign.events.length },
  ];
  const visibleOperations =
    operationFilter === "all"
      ? operations
      : operations.filter(operation => operation.kind === operationFilter);
  const citySummary = campaign.hasExplicitCities
    ? `${campaign.cities.length} cidades selecionadas`
    : "Todas as cidades";
  const currentMedia =
    campaign.media.find(item => item.status === "active") ?? campaign.media[0];

  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <Button variant="outline" onClick={back}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar para campanhas
      </Button>
      <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:justify-between">
        <div className="flex gap-4">
          <ImageViewer
            src={campaign.logoUrl ?? campaign.providerLogoUrl}
            alt={campaign.name}
            title={campaign.name}
            emptyLabel="Sem imagem"
            className="h-20 w-20 rounded-xl"
          />
          <div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={campaign.status} />
              <CompanyBadge name={campaign.providerName} />
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold text-foreground">
              {campaign.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {campaign.objective || "Objetivo ainda não informado."}
            </p>
          </div>
        </div>
        {canWrite && (
          <Button variant="outline" onClick={edit}>
            <Edit3 className="mr-2 h-4 w-4" />
            Editar campanha
          </Button>
        )}
      </header>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold">Segmentação e vigência</h2>
          <p className="mt-3 flex gap-2 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
            {date(campaign.startsAt)} — {date(campaign.endsAt)}
          </p>
          <p className="mt-2 flex gap-2 text-sm text-muted-foreground">
            <MapPinned className="h-4 w-4 shrink-0 text-primary" />
            {campaign.regionals?.length
              ? campaign.regionals.map(regional => regional.name).join(", ")
              : campaign.regionalName || "Todas as regionais"}
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            <Badge variant="secondary">{citySummary}</Badge>
            {campaign.campaignTypeName && (
              <Badge variant="outline">{campaign.campaignTypeName}</Badge>
            )}
            {campaign.campaignSectorName && (
              <Badge variant="outline">{campaign.campaignSectorName}</Badge>
            )}
            {campaign.hasExplicitCities &&
              campaign.cities.slice(0, 8).map(city => (
                <Badge key={city.id} variant="outline">
                  {city.name}
                  {city.state ? ` · ${city.state}` : ""}
                </Badge>
              ))}
            {campaign.hasExplicitCities && campaign.cities.length > 8 && (
              <Badge variant="outline">+{campaign.cities.length - 8}</Badge>
            )}
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex justify-between gap-3">
            <div>
              <h2 className="font-semibold">Identidade visual</h2>
              <p className="text-xs text-muted-foreground">
                Imagem da campanha.
              </p>
            </div>
            {canWrite && (
              <label className="shrink-0 cursor-pointer rounded-lg border border-border px-3 py-2 text-xs text-primary">
                <ImagePlus className="mr-1 inline h-3.5 w-3.5" />
                Enviar
                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={event => upload(event.target.files?.[0])}
                />
              </label>
            )}
          </div>
          <ImageViewer
            src={campaign.logoUrl ?? campaign.providerLogoUrl}
            alt={campaign.name}
            title={campaign.name}
            emptyLabel="Sem imagem"
            className="mt-3 h-24 w-24"
          />
        </section>
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Mídia atual</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Mídia ativa vinculada a esta campanha.
              </p>
            </div>
            {currentMedia ? (
              <Button type="button" variant="outline" onClick={() => setSelectedMedia(currentMedia)}>
                Ver detalhes
              </Button>
            ) : null}
          </div>
          {currentMedia ? (
            <button
              type="button"
              onClick={() => setSelectedMedia(currentMedia)}
              className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3 py-3 text-left transition hover:border-primary/40 hover:bg-muted/50"
            >
              <span className="min-w-0">
                <strong className="block truncate text-sm text-foreground">{currentMedia.name}</strong>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {date(currentMedia.startsOn)} — {date(currentMedia.endsOn)}
                </span>
              </span>
              <StatusBadge status={currentMedia.status} />
            </button>
          ) : (
            <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nenhuma mídia vinculada a esta campanha.
            </p>
          )}
        </section>
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold">Promoções e planos</h2>
              <p className="text-xs text-muted-foreground">
                Selecione uma promoção para consultar e atualizar seus detalhes.
              </p>
            </div>
            <Badge variant="secondary">
              {campaign.promotions.length}{" "}
              {campaign.promotions.length === 1 ? "promoção" : "promoções"}
            </Badge>
          </div>
          <div className="mt-3 divide-y divide-border rounded-xl border border-border">
            {campaign.promotions.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => openPromotion(item)}
                className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <strong className="block text-sm text-foreground">
                    {item.name}
                  </strong>
                  {item.description && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                  <span className="mt-1 block text-xs text-primary">
                    {item.cities.length
                      ? `${item.cities.length} cidades específicas`
                      : "Todas as cidades"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="outline">
                    {item.plans.length} plano
                    {item.plans.length === 1 ? "" : "s"}
                  </Badge>
                </div>
              </button>
            ))}
            {!campaign.promotions.length && (
              <p className="p-4 text-sm text-muted-foreground">
                Nenhuma promoção cadastrada.
              </p>
            )}
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold">Operações vinculadas</h2>
              <p className="text-xs text-muted-foreground">
                Acompanhe os registros ligados a esta campanha.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {operationKinds.map(item => (
                <Button
                  key={item.id}
                  type="button"
                  size="sm"
                  variant={operationFilter === item.id ? "default" : "outline"}
                  onClick={() => setOperationFilter(item.id)}
                >
                  {item.label}
                  <span className="ml-1.5 rounded bg-background/20 px-1.5 text-xs">
                    {item.count}
                  </span>
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {visibleOperations.map(item => (
              <button
                key={`${item.kind}-${item.id}`}
                onClick={() => setLocation(item.href)}
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-muted/25 px-3 py-2.5 text-left transition hover:border-primary/40"
              >
                <span className="truncate text-sm font-medium text-foreground">
                  {item.name}
                </span>
                <Badge variant="outline">{item.label}</Badge>
              </button>
            ))}
            {!visibleOperations.length && (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                Nenhuma operação neste filtro.
              </p>
            )}
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
          <h2 className="font-semibold">Debriefing</h2>
          <form
            onSubmit={event => {
              event.preventDefault();
              saveDebrief({
                campaignId: campaign.id,
                rating,
                notes: notes || undefined,
                result: result || undefined,
                completedAt: new Date(),
              });
            }}
            className="mt-3 grid gap-3 md:grid-cols-[180px_1fr_1fr_auto] md:items-end"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="campaign-debrief-rating">Nota geral</Label>
              <Input
                id="campaign-debrief-rating"
                type="number"
                min="1"
                max="5"
                step="1"
                value={rating}
                onChange={event =>
                  setRating(
                    Math.min(5, Math.max(1, Number(event.target.value) || 1))
                  )
                }
                className={ratingDefinitions[rating]?.className}
              />
              <p className="text-xs text-muted-foreground">
                {ratingDefinitions[rating]?.label}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label>História da campanha</Label>
              <Input
                value={result}
                onChange={event => setResult(event.target.value)}
                placeholder="História da campanha"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Avaliação e aprendizados</Label>
              <Textarea
                value={notes}
                onChange={event => setNotes(event.target.value)}
                placeholder="Avaliação e aprendizados"
                className="min-h-10"
              />
            </div>
            {canWrite && <Button type="submit">Salvar debriefing</Button>}
          </form>
        </section>
      </div>
      <Dialog
        open={Boolean(promotion)}
        onOpenChange={open => !open && setPromotion(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{promotion?.name}</DialogTitle>
            <DialogDescription>
              {promotion?.description || "Detalhes da promoção."}
            </DialogDescription>
          </DialogHeader>
          {promotion && (
            <div className="space-y-4">
              <section>
                <h3 className="text-sm font-semibold">Planos e valores</h3>
                <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                  <div className="hidden min-w-[740px] grid-cols-[1.2fr_.8fr_.9fr_1.5fr] gap-3 border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground md:grid">
                    <span>Nome do plano</span>
                    <span>Velocidade</span>
                    <span>Valor / mês</span>
                    <span>Detalhes</span>
                  </div>
                  {promotion.plans.map(plan => (
                    <div
                      key={plan.id}
                      className="grid min-w-[740px] gap-3 border-b border-border px-3 py-3 text-sm last:border-b-0 md:grid-cols-[1.2fr_.8fr_.9fr_1.5fr]"
                    >
                      <strong className="text-foreground">{plan.name}</strong>
                      <span className="text-muted-foreground">{plan.speed || "—"}</span>
                      <span className="font-semibold text-primary">
                        {money(plan.price)}/{plan.unit}
                      </span>
                      <span className="text-muted-foreground">{plan.description || "—"}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <SearchableMultiSelect
                  id={`promotion-cities-${promotion.id}`}
                  label="Cidades específicas"
                  options={campaign.cities.map(city => ({
                    id: city.id,
                    label: city.name,
                    description: city.state ?? "",
                  }))}
                  values={cityIds}
                  onChange={setCityIds}
                  placeholder="Todas as cidades"
                />
                <div className="mt-2 flex flex-wrap gap-1">
                  {cityIds.length ? (
                    campaign.cities
                      .filter(city => cityIds.includes(city.id))
                      .map(city => (
                        <Badge key={city.id} variant="secondary">
                          {city.name}
                        </Badge>
                      ))
                  ) : (
                    <Badge variant="secondary">Todas as cidades</Badge>
                  )}
                </div>
              </section>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPromotion(null)}>
                  Fechar
                </Button>
                {canWrite && (
                  <Button
                    disabled={saving}
                    onClick={() =>
                      saveCities({ promotionId: promotion.id, cityIds })
                    }
                  >
                    Salvar cidades
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(selectedMedia)} onOpenChange={open => !open && setSelectedMedia(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selectedMedia?.name}</DialogTitle>
            <DialogDescription>Detalhes da mídia atual vinculada a esta campanha.</DialogDescription>
          </DialogHeader>
          {selectedMedia && (
            <div className="grid gap-4">
              <div className="grid gap-3 rounded-xl border border-border bg-muted/25 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Situação</p>
                  <div className="mt-1"><StatusBadge status={selectedMedia.status} /></div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Modalidade</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{partnershipLabel(selectedMedia.partnershipType)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Vigência</p>
                  <p className="mt-1 text-sm text-foreground">{date(selectedMedia.startsOn)} — {date(selectedMedia.endsOn)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Valor previsto</p>
                  <p className="mt-1 text-sm font-semibold text-primary">{money(selectedMedia.estimatedCost)}</p>
                </div>
              </div>
              {(selectedMedia.campaignDetails || selectedMedia.notes) && (
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs font-medium text-muted-foreground">Detalhes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{selectedMedia.campaignDetails || selectedMedia.notes}</p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedMedia(null)}>Fechar</Button>
                <Button onClick={() => { setSelectedMedia(null); setLocation(`/midias/${selectedMedia.id}`); }}>
                  Abrir mídia
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function CampaignsWorkspace() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [detail, params] = useRoute("/campanhas/:campaignId");
  const { can } = useEffectivePermissions();
  const canWrite = can("actions.write");
  const [providerId, setProviderId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState(null);
  const [yearFilter, setYearFilter] = useState(null);
  const [monthFilter, setMonthFilter] = useState(null);
  const [campaignTypeFilter, setCampaignTypeFilter] = useState(null);
  const [campaignSectorFilter, setCampaignSectorFilter] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankForm());
  const listInput = useMemo(
    () => (providerId ? { providerId } : undefined),
    [providerId]
  );
  const { data: campaigns = [], isLoading } =
    trpc.campaigns.list.useQuery(listInput);
  const { data: refs } = trpc.campaigns.referenceData.useQuery();
  const { data: templates = [] } = trpc.campaigns.listTemplates.useQuery();
  const selected = detail
    ? campaigns.find(item => item.id === Number(params?.campaignId))
    : null;
  const refresh = () => utils.campaigns.list.invalidate();
  const create = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      toast.success("Campanha criada.");
      refresh();
      setOpen(false);
      setForm(blankForm());
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.campaigns.update.useMutation({
    onSuccess: () => {
      toast.success("Campanha atualizada.");
      refresh();
      setOpen(false);
    },
    onError: error => toast.error(error.message),
  });
  const debrief = trpc.campaigns.saveDebrief.useMutation({
    onSuccess: () => {
      toast.success("Debriefing salvo.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const promotionCities = trpc.campaigns.savePromotionCities.useMutation({
    onSuccess: () => {
      toast.success("Cidades da promoção atualizadas.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const logo = trpc.campaigns.uploadLogo.useMutation({
    onSuccess: () => {
      toast.success("Imagem atualizada.");
      refresh();
    },
    onError: error => toast.error(error.message),
  });
  const edit = campaign => {
    setForm({
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective ?? "",
      providerId: campaign.providerId,
      campaignTypeId: campaign.campaignTypeId ?? null,
      campaignSectorId: campaign.campaignSectorId ?? null,
      regionalIds:
        campaign.regionals?.map(regional => regional.id) ??
        (campaign.regionalId ? [campaign.regionalId] : []),
      cityIds: campaign.hasExplicitCities
        ? campaign.cities.map(city => city.id)
        : [],
      templateId: campaign.campaignTemplateId,
      startsAt: campaign.startsAt
        ? new Date(campaign.startsAt).toISOString().slice(0, 10)
        : "",
      endsAt: campaign.endsAt
        ? new Date(campaign.endsAt).toISOString().slice(0, 10)
        : "",
      status: campaign.status,
      promotions: campaign.promotions.map(promotion => ({
        name: promotion.name,
        description: promotion.description ?? "",
        active: promotion.active,
        cityIds: promotion.cities.map(city => city.id),
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
  const submit = event => {
    event.preventDefault();
    const invalid = form.promotions.some(
      promotion =>
        !promotion.name.trim() ||
        promotion.plans.some(plan => !plan.name.trim() || plan.price === "")
    );
    if (invalid) return toast.error("Informe nome e valor de cada plano.");
    const payload = {
      name: form.name.trim(),
      objective: form.objective.trim() || undefined,
      providerId: form.providerId,
      campaignTypeId: form.campaignTypeId,
      campaignSectorId: form.campaignSectorId,
      regionalId: form.regionalIds[0] ?? null,
      regionalIds: form.regionalIds,
      cityIds: form.cityIds,
      campaignTemplateId: form.templateId,
      startsAt: form.startsAt ? new Date(`${form.startsAt}T12:00:00`) : null,
      endsAt: form.endsAt ? new Date(`${form.endsAt}T12:00:00`) : null,
      status: form.status,
      promotions: form.promotions.map(promotion => ({
        name: promotion.name.trim(),
        description: promotion.description.trim() || undefined,
        active: promotion.active,
        cityIds: promotion.cityIds,
        plans: promotion.plans.map(plan => ({
          name: plan.name.trim(),
          speed: plan.speed.trim() || undefined,
          description: plan.description.trim() || undefined,
          price: Number(plan.price),
          unit: plan.unit || "unidade",
          active: plan.active,
        })),
      })),
    };
    form.id
      ? update.mutate({ id: form.id, ...payload })
      : create.mutate(payload);
  };
  const upload = async file => {
    if (!file || !selected) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 3 * 1024 * 1024
    )
      return toast.error("Envie JPG, PNG ou WEBP de até 3 MB.");
    const reader = new FileReader();
    reader.onload = () =>
      logo.mutate({
        campaignId: selected.id,
        originalName: file.name,
        mimeType: file.type,
        dataBase64: String(reader.result).split(",")[1] ?? "",
      });
    reader.readAsDataURL(file);
  };
  if (detail)
    return selected ? (
      <>
        <Detail
          campaign={selected}
          canWrite={canWrite}
          back={() => setLocation("/campanhas")}
          edit={() => edit(selected)}
          upload={upload}
          saveDebrief={debrief.mutate}
          saveCities={promotionCities.mutate}
          saving={promotionCities.isPending}
        />
        <Editor
          open={open}
          onOpenChange={setOpen}
          form={form}
          setForm={setForm}
          refs={refs}
          templates={templates}
          onSubmit={submit}
          pending={update.isPending}
        />
      </>
    ) : (
      <main className="mx-auto max-w-6xl p-6 text-muted-foreground">
        Campanha não encontrada.
      </main>
    );
  const statusCounts = Object.fromEntries(
    statuses.map(status => [
      status.value,
      campaigns.filter(campaign => campaign.status === status.value).length,
    ])
  );
  const availableYears = Array.from(
    new Set(
      campaigns
        .map(campaign =>
          campaign.startsAt ? new Date(campaign.startsAt).getFullYear() : null
        )
        .filter(Boolean)
    )
  ).sort((first, second) => second - first);
  const visible = campaigns.filter(campaign => {
    const campaignStart = campaign.startsAt ? new Date(campaign.startsAt) : null;
    return (
      (statusFilter === "all" || campaign.status === statusFilter) &&
      (!ratingFilter || Number(campaign.debriefRating) === ratingFilter) &&
      (!yearFilter || campaignStart?.getFullYear() === yearFilter) &&
      (!monthFilter || campaignStart?.getMonth() + 1 === monthFilter) &&
      (!campaignTypeFilter || campaign.campaignTypeId === campaignTypeFilter) &&
      (!campaignSectorFilter || campaign.campaignSectorId === campaignSectorFilter)
    );
  });
  return (
    <main className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">Operação</p>
          <h1 className="font-display text-3xl font-bold">Campanhas</h1>
          <p className="text-sm text-muted-foreground">
            Planeje, segmente e acompanhe operações integradas.
          </p>
        </div>
        {canWrite && (
          <Button
            onClick={() => {
              setForm(blankForm());
              setOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova campanha
          </Button>
        )}
      </header>
      <section className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <SearchableMultiSelect
            id="campaign-filter-company"
            label="Filtrar por empresa"
            options={(refs?.providers ?? []).map(provider => ({
              id: provider.id,
              label: provider.name,
            }))}
            values={providerId ? [providerId] : []}
            onChange={values => setProviderId(values[0] ?? null)}
            maxSelections={1}
            placeholder="Todas as empresas"
          />
          <SearchableMultiSelect
            id="campaign-filter-rating"
            label="Filtrar por nota de debriefing"
            options={[1, 2, 3, 4, 5].map(value => ({
              id: value,
              label: `Nota ${value} · ${ratingDefinitions[value].label}`,
            }))}
            values={ratingFilter ? [ratingFilter] : []}
            onChange={values => setRatingFilter(values[0] ?? null)}
            maxSelections={1}
            placeholder="Todas as notas"
          />
          <SearchableMultiSelect
            id="campaign-filter-year"
            label="Filtrar por ano"
            options={availableYears.map(year => ({ id: year, label: String(year) }))}
            values={yearFilter ? [yearFilter] : []}
            onChange={values => setYearFilter(values[0] ?? null)}
            maxSelections={1}
            placeholder="Todos os anos"
          />
          <SearchableMultiSelect
            id="campaign-filter-month"
            label="Filtrar por mês"
            options={months.map((month, index) => ({
              id: index + 1,
              label: month,
            }))}
            values={monthFilter ? [monthFilter] : []}
            onChange={values => setMonthFilter(values[0] ?? null)}
            maxSelections={1}
            placeholder="Todos os meses"
          />
          <SearchableMultiSelect
            id="campaign-filter-type"
            label="Filtrar por tipo de campanha"
            options={(refs?.campaignTypes ?? []).map(item => ({
              id: item.id,
              label: item.name,
            }))}
            values={campaignTypeFilter ? [campaignTypeFilter] : []}
            onChange={values => setCampaignTypeFilter(values[0] ?? null)}
            maxSelections={1}
            placeholder="Todos os tipos"
          />
          <SearchableMultiSelect
            id="campaign-filter-sector"
            label="Filtrar por setor"
            options={(refs?.campaignSectors ?? []).map(item => ({
              id: item.id,
              label: item.name,
            }))}
            values={campaignSectorFilter ? [campaignSectorFilter] : []}
            onChange={values => setCampaignSectorFilter(values[0] ?? null)}
            maxSelections={1}
            placeholder="Todos os setores"
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Situação da campanha
          </p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <Button
              type="button"
              variant={statusFilter === "all" ? "default" : "outline"}
              onClick={() => setStatusFilter("all")}
              className="justify-between"
            >
              Todas{" "}
              <span className="rounded bg-background/20 px-1.5 text-xs">
                {campaigns.length}
              </span>
            </Button>
            {statuses.map(status => (
              <Button
                key={status.value}
                type="button"
                variant="outline"
                onClick={() => setStatusFilter(status.value)}
                className={`justify-between ${statusFilter === status.value ? status.className : ""}`}
              >
                <span>{status.label}</span>
                <span className="rounded bg-background/20 px-1.5 text-xs">
                  {statusCounts[status.value]}
                </span>
              </Button>
            ))}
          </div>
        </div>
      </section>
      {isLoading ? (
        <p className="text-muted-foreground">Carregando campanhas...</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {visible.map(item => (
            <button
              key={item.id}
              onClick={() => setLocation(`/campanhas/${item.id}`)}
              className="grid w-full gap-3 border-b border-border px-4 py-4 text-left transition last:border-b-0 hover:bg-muted/40 md:grid-cols-[auto_minmax(150px,1.15fr)_minmax(140px,.75fr)_minmax(136px,.7fr)_minmax(180px,.85fr)_auto] md:items-center"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted text-sm font-bold text-primary">
                {item.logoUrl || item.providerLogoUrl ? (
                  <img src={item.logoUrl ?? item.providerLogoUrl} alt="" className="h-full w-full bg-card object-contain p-2" />
                ) : (
                  item.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-foreground">{item.name}</h2>
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{item.objective || "Objetivo ainda não informado."}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CompanyBadge name={item.providerName} />
                <StatusBadge status={item.status} />
                {item.campaignTypeName && <Badge variant="outline">{item.campaignTypeName}</Badge>}
                {item.campaignSectorName && <Badge variant="outline">{item.campaignSectorName}</Badge>}
              </div>
              <div className="text-sm text-muted-foreground">
                <p className="whitespace-nowrap tabular-nums">{compactDate(item.startsAt)} — {compactDate(item.endsAt)}</p>
                <p className="mt-1 whitespace-nowrap text-xs">{item.hasExplicitCities ? `${item.cities.length} cidades` : "Todas as cidades"}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs font-medium text-primary">
                <span className="whitespace-nowrap rounded-md bg-primary/10 px-2 py-1">{item.actions.length} ações</span>
                <span className="whitespace-nowrap rounded-md bg-primary/10 px-2 py-1">{item.media.length} mídias</span>
                <span className="whitespace-nowrap rounded-md bg-primary/10 px-2 py-1">{item.events.length} eventos</span>
              </div>
              {item.debriefRating ? <RatingBadge rating={item.debriefRating} /> : <span className="text-xs text-muted-foreground">Sem nota</span>}
            </button>
          ))}
          {!visible.length && (
            <p className="p-8 text-center text-muted-foreground">
              Nenhuma campanha encontrada neste recorte.
            </p>
          )}
        </div>
      )}
      <Editor
        open={open}
        onOpenChange={setOpen}
        form={form}
        setForm={setForm}
        refs={refs}
        templates={templates}
        onSubmit={submit}
        pending={create.isPending || update.isPending}
      />
    </main>
  );
}
