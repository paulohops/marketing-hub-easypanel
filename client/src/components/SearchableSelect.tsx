import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

export type SearchableSelectOption = {
  value: string | number;
  label: string;
  description?: string;
};

type SearchableSelectProps = {
  id: string;
  label: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
};

export default function SearchableSelect({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = "Selecionar",
  emptyMessage = "Nenhuma opção disponível",
  disabled = false,
  hideLabel = false,
  triggerClassName = "",
  contentClassName = "",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const normalizedValue = String(value ?? "");
  const selected = options.find(option => String(option.value) === normalizedValue);
  const available = useMemo(() => {
    const query = search.toLocaleLowerCase("pt-BR");
    return options.filter(option => `${option.label} ${option.description ?? ""}`.toLocaleLowerCase("pt-BR").includes(query));
  }, [options, search]);

  const choose = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="grid gap-1.5">
      {!hideLabel && <Label htmlFor={id}>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" disabled={disabled} className={`h-10 w-full justify-between rounded-lg px-3 text-left font-normal ${triggerClassName}`}>
            <span className="truncate">{selected?.label ?? placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-55" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className={`w-[min(24rem,calc(100vw-2rem))] p-3 ${contentClassName}`}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input autoFocus value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar…" className="h-9 pl-9" />
          </div>
          <div role="listbox" className="mt-2 max-h-60 touch-pan-y overflow-y-auto overscroll-contain rounded-lg border border-border p-1" onWheelCapture={event => event.stopPropagation()}>
            {available.length ? available.map(option => {
              const optionValue = String(option.value);
              const isSelected = optionValue === normalizedValue;
              return (
                <button key={optionValue} type="button" role="option" aria-selected={isSelected} onClick={() => choose(optionValue)} className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50"}`}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{option.label}</span>
                    {option.description && <span className="block truncate text-xs text-muted-foreground">{option.description}</span>}
                  </span>
                </button>
              );
            }) : <p className="px-2 py-5 text-center text-xs text-muted-foreground">{emptyMessage}</p>}
          </div>
          {normalizedValue && <Button type="button" variant="ghost" size="sm" onClick={() => choose("")} className="mt-2 h-7 px-2 text-xs">Limpar seleção</Button>}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { SearchableSelect };
