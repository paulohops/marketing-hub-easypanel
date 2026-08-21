import { Button } from "@/components/ui/button";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, Plus, Trash2, X } from "lucide-react";

export type TraditionalScheduleItem = {
  programName: string;
  weekdays: number[];
  specificDate: string | null;
  specificDates?: string[];
  neighborhoodId?: number | null;
  startsAt: string;
  endsAt: string;
  notes?: string;
};

const weekdays = [
  [0, "Domingo"],
  [1, "Segunda-feira"],
  [2, "Terça-feira"],
  [3, "Quarta-feira"],
  [4, "Quinta-feira"],
  [5, "Sexta-feira"],
  [6, "Sábado"],
] as const;

export function createEmptyTraditionalSchedule(): TraditionalScheduleItem {
  return { programName: "", weekdays: [1], specificDate: null, specificDates: [], neighborhoodId: null, startsAt: "08:00", endsAt: "08:30", notes: "" };
}

type Props = {
  value: TraditionalScheduleItem[];
  onChange: (value: TraditionalScheduleItem[]) => void;
  neighborhoodOptions?: Array<{ id: number; label: string; description?: string }>;
  territorialMode?: boolean;
};

export default function TraditionalScheduleEditor({ value, onChange, neighborhoodOptions = [], territorialMode = false }: Props) {
  const update = (index: number, patch: Partial<TraditionalScheduleItem>) => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const remove = (index: number) => onChange(value.filter((_, itemIndex) => itemIndex !== index));
  const add = () => onChange([...value, createEmptyTraditionalSchedule()]);
  const addDate = (index: number, date: string) => {
    if (!date) return;
    const item = value[index];
    const dates = Array.from(new Set([...(item.specificDates ?? []), date])).sort();
    update(index, { specificDates: dates, specificDate: null, weekdays: [] });
  };
  const removeDate = (index: number, date: string) => {
    const item = value[index];
    update(index, { specificDates: (item.specificDates ?? []).filter(selectedDate => selectedDate !== date) });
  };

  return <section className="space-y-3 rounded-xl border border-border bg-secondary/40 p-4 md:col-span-2">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
        <div><Label className="text-sm font-semibold">{territorialMode ? "Calendário da operação" : "Programação da veiculação"}</Label><p className="mt-1 text-xs leading-5 text-muted-foreground">{territorialMode ? "Selecione as datas, os horários e o bairro de cada rodada. Cada linha representa um período de circulação." : "Cadastre uma linha para cada programa, dias e horário. Use uma data específica para entrevistas ou participações únicas."}</p></div>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add} className="h-8 border-primary/30 text-xs"><Plus className="mr-1.5 h-3.5 w-3.5" />{territorialMode ? "Adicionar rodada" : "Adicionar horário"}</Button>
    </div>
    {value.length === 0 ? <button type="button" onClick={add} className="w-full rounded-lg border border-dashed border-primary/40 bg-card px-3 py-4 text-left text-xs text-muted-foreground transition hover:border-primary hover:text-foreground">Nenhuma programação cadastrada. Clique para adicionar o primeiro horário.</button> : <div className="space-y-3">{value.map((item, index) => <article key={`schedule-${index}`} className="rounded-lg border border-border bg-card p-3">
      <div className={territorialMode ? "grid gap-3 md:grid-cols-[minmax(0,1.6fr)_110px_110px_auto] md:items-end" : "grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_110px_110px_auto] md:items-end"}>
        <label className="space-y-1.5"><Label htmlFor={`schedule-program-${index}`}>{territorialMode ? "Veiculação ou atividade" : "Programa"}</Label><Input id={`schedule-program-${index}`} value={item.programName} onChange={event => update(index, { programName: event.target.value })} placeholder={territorialMode ? "Ex.: Rota de lançamento" : "Ex.: Jornal da manhã"} required /></label>
        {!territorialMode && <SearchableMultiSelect id={`schedule-type-${index}`} label="Tipo de ocorrência" options={[{ id: 1, label: "Toda semana" }, { id: 2, label: "Data específica" }]} values={[item.specificDate ? 2 : 1]} maxSelections={1} onChange={values => values[0] === 2 ? update(index, { weekdays: [], specificDate: item.specificDate ?? new Date().toISOString().slice(0, 10), specificDates: [] }) : update(index, { weekdays: item.weekdays.length ? item.weekdays : [1], specificDate: null, specificDates: [] })} placeholder="Selecionar tipo" emptyMessage="Nenhum tipo disponível" />}
        <label className="space-y-1.5"><Label htmlFor={`schedule-start-${index}`}>Início</Label><Input id={`schedule-start-${index}`} type="time" value={item.startsAt} onChange={event => update(index, { startsAt: event.target.value })} required /></label>
        <label className="space-y-1.5"><Label htmlFor={`schedule-end-${index}`}>Fim</Label><Input id={`schedule-end-${index}`} type="time" value={item.endsAt} onChange={event => update(index, { endsAt: event.target.value })} required /></label>
        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="h-10 w-10 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Remover horário ${index + 1}`}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start">
        {neighborhoodOptions.length ? <SearchableMultiSelect id={`schedule-neighborhood-${index}`} label="Bairro da rodada" options={neighborhoodOptions} values={item.neighborhoodId ? [item.neighborhoodId] : []} maxSelections={1} onChange={values => update(index, { neighborhoodId: values[0] ?? null })} placeholder="Selecionar bairro" emptyMessage="Nenhum bairro disponível" /> : null}
        {territorialMode ? <div className="space-y-1.5"><Label htmlFor={`schedule-date-picker-${index}`}>Dias da rodagem</Label><Input id={`schedule-date-picker-${index}`} type="date" onChange={event => { addDate(index, event.target.value); event.currentTarget.value = ""; }} /><div className="flex min-h-8 flex-wrap gap-1.5 pt-1">{(item.specificDates ?? []).map(date => <span key={date} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">{new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR")}<button type="button" onClick={() => removeDate(index, date)} className="rounded-sm hover:bg-primary/15" aria-label={`Remover ${date}`}><X className="h-3 w-3" /></button></span>)}{!(item.specificDates ?? []).length && <span className="text-[11px] text-muted-foreground">Selecione uma ou mais datas.</span>}</div></div> : item.specificDate ? <label className="space-y-1.5"><Label htmlFor={`schedule-date-${index}`}>Data da entrevista ou inserção</Label><Input id={`schedule-date-${index}`} type="date" value={item.specificDate} onChange={event => update(index, { specificDate: event.target.value || null })} required /></label> : <div className="space-y-1.5"><Label>Dias da semana</Label><div className="flex flex-wrap gap-1.5">{weekdays.map(([day, label]) => { const selected = item.weekdays.includes(day); return <Button key={day} type="button" variant={selected ? "default" : "outline"} size="sm" onClick={() => update(index, { weekdays: selected ? item.weekdays.filter(value => value !== day) : [...item.weekdays, day], specificDate: null })} className="h-8 px-2 text-[11px]">{label.slice(0, 3)}</Button>; })}</div><p className="mt-1 text-[11px] text-muted-foreground">Selecione um ou mais dias.</p></div>}
        <label className="space-y-1.5"><Label htmlFor={`schedule-notes-${index}`}>Observação</Label><Input id={`schedule-notes-${index}`} value={item.notes ?? ""} onChange={event => update(index, { notes: event.target.value })} placeholder={territorialMode ? "Ex.: rota da manhã" : "Ex.: entrevista ao vivo"} /></label>
      </div>
    </article>)}</div>}
  </section>;
}
