import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { ReactNode, useMemo, useState } from "react";

export type SelectableOption = { id: number; label: string; description?: string };

type SearchableMultiSelectProps = {
  id: string;
  label: string;
  options: SelectableOption[];
  values: number[];
  onChange: (values: number[]) => void;
  disabled?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  maxSelections?: number;
  hideLabel?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
  onCreate?: () => void;
  createLabel?: string;
  createAction?: ReactNode;
  legacyChangeInput?: boolean;
  legacyValueMap?: Record<string, number>;
};

export default function SearchableMultiSelect({
  id,
  label,
  options,
  values,
  onChange,
  disabled = false,
  placeholder = "Selecionar itens",
  emptyMessage = "Nenhuma opção disponível",
  maxSelections,
  hideLabel = false,
  triggerClassName = "",
  contentClassName = "",
  onCreate,
  createLabel = "Novo cadastro",
  createAction,
  legacyChangeInput = false,
  legacyValueMap,
}: SearchableMultiSelectProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const isSingleChoice = maxSelections === 1;
  const available = useMemo(
    () =>
      options.filter(option =>
        `${option.label} ${option.description ?? ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(search.toLocaleLowerCase("pt-BR"))
      ),
    [options, search]
  );
  const selectedLabels = options.filter(option => values.includes(option.id)).map(option => option.label);
  const selectedSummary = isSingleChoice
    ? selectedLabels[0] ?? placeholder
    : selectedLabels.length
      ? `${selectedLabels.length} selecionado${selectedLabels.length > 1 ? "s" : ""}: ${selectedLabels.slice(0, 2).join(", ")}${selectedLabels.length > 2 ? "…" : ""}`
      : placeholder;

  const toggle = (idToToggle: number) => {
    if (isSingleChoice) {
      onChange(values.includes(idToToggle) ? [] : [idToToggle]);
      setOpen(false);
      return;
    }

    onChange(values.includes(idToToggle) ? values.filter(value => value !== idToToggle) : [...values, idToToggle]);
  };

  return (
    <div className="grid gap-1.5">
      {!hideLabel && <Label htmlFor={legacyChangeInput ? id : `${id}-trigger`}>{label}</Label>}
      {legacyChangeInput && (
        <input
          id={id}
          type="text"
          className="sr-only"
          tabIndex={-1}
          value={values[0] ? String(values[0]) : ""}
          onChange={event => {
            const mappedValue = legacyValueMap?.[event.target.value];
            const nextValue = mappedValue ?? Number(event.target.value);
            onChange(Number.isFinite(nextValue) && nextValue > 0 ? [nextValue] : []);
          }}
        />
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={legacyChangeInput ? `${id}-trigger` : id}
            aria-label={legacyChangeInput ? undefined : label}
            type="button"
            value={isSingleChoice ? String(values[0] ?? "") : undefined}
            onChange={event => {
              if (!isSingleChoice) return;
              const nextValue = Number((event.target as HTMLButtonElement).value);
              if (Number.isFinite(nextValue) && nextValue > 0) onChange([nextValue]);
            }}
            variant="outline"
            disabled={disabled}
            className={`h-10 w-full justify-between rounded-lg px-3 text-left font-normal ${triggerClassName}`}
          >
            <span className="truncate">{selectedSummary}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-55" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className={`w-[min(24rem,calc(100vw-2rem))] p-3 ${contentClassName}`}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar…" className="h-9 pl-9" />
          </div>
          <div
            role="listbox"
            aria-multiselectable={!isSingleChoice}
            className="mt-2 max-h-60 touch-pan-y overflow-y-auto overscroll-contain rounded-lg border border-border p-1"
            onWheelCapture={event => event.stopPropagation()}
          >
            {available.length ? (
              available.map(option => {
                const selected = values.includes(option.id);
                const optionContent = (
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{option.label}</span>
                    {option.description && <span className="block truncate text-xs text-muted-foreground">{option.description}</span>}
                  </span>
                );

                if (isSingleChoice) {
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-label={`Selecionar ${option.label}`}
                      aria-selected={selected}
                      onClick={() => toggle(option.id)}
                      className="flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50"}`}>
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                      {optionContent}
                    </button>
                  );
                }

                return (
                  <label key={option.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted">
                    <Checkbox checked={selected} onCheckedChange={() => toggle(option.id)} aria-label={`Selecionar ${option.label}`} />
                    {optionContent}
                    {selected && <Check className="ml-auto mt-0.5 h-3.5 w-3.5 text-primary" />}
                  </label>
                );
              })
            ) : (
              <p className="px-2 py-5 text-center text-xs text-muted-foreground">{emptyMessage}</p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            {values.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])} className="h-7 px-2 text-xs">
                Limpar seleção
              </Button>
            )}
            {onCreate && (
              <Button type="button" variant="outline" size="sm" onClick={onCreate} className="h-7 px-2 text-xs text-primary">
                <Plus className="mr-1 h-3.5 w-3.5" />
                {createLabel}
              </Button>
            )}
            {createAction}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
