import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";

type MultiDatePickerProps = {
  value: string[];
  onChange: (dates: string[]) => void;
  label?: string;
  description?: string;
  minDate?: string;
};

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function formatDateDisplay(isoDate: string) {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function toIsoString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function MultiDatePicker({
  value = [],
  onChange,
  label = "Selecionar múltiplos dias",
  description,
  minDate,
}: MultiDatePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value.length > 0) {
      const first = new Date(`${value[0]}T12:00:00`);
      if (!isNaN(first.getTime())) return new Date(first.getFullYear(), first.getMonth(), 1);
    }
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [showRangeTool, setShowRangeTool] = useState(false);

  const selectedSet = useMemo(() => new Set(value), [value]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: Array<{
      date: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isDisabled: boolean;
    }> = [];

    // Days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const iso = toIsoString(prevDate);
      days.push({
        date: iso,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isDisabled: Boolean(minDate && iso < minDate),
      });
    }

    // Days of current month
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const curDate = new Date(year, month, dayNum);
      const iso = toIsoString(curDate);
      days.push({
        date: iso,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isDisabled: Boolean(minDate && iso < minDate),
      });
    }

    // Days for next month to complete row
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let dayNum = 1; dayNum <= remaining; dayNum++) {
        const nextDate = new Date(year, month + 1, dayNum);
        const iso = toIsoString(nextDate);
        days.push({
          date: iso,
          dayNumber: dayNum,
          isCurrentMonth: false,
          isDisabled: Boolean(minDate && iso < minDate),
        });
      }
    }

    return days;
  }, [year, month, minDate]);

  const toggleDate = (iso: string) => {
    if (selectedSet.has(iso)) {
      onChange(value.filter(d => d !== iso));
    } else {
      onChange([...value, iso].sort());
    }
  };

  const removeDate = (iso: string) => {
    onChange(value.filter(d => d !== iso));
  };

  const clearAll = () => {
    onChange([]);
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const addRange = () => {
    if (!rangeStart || !rangeEnd) return;
    const start = new Date(`${rangeStart}T12:00:00`);
    const end = new Date(`${rangeEnd}T12:00:00`);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return;

    const newDates = new Set(value);
    const cursor = new Date(start);
    while (cursor <= end) {
      const iso = toIsoString(cursor);
      if (!minDate || iso >= minDate) {
        newDates.add(iso);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    onChange(Array.from(newDates).sort());
    setRangeStart("");
    setRangeEnd("");
  };

  const addNextDays = (count: number) => {
    const newDates = new Set(value);
    const today = new Date();
    for (let i = 0; i < count; i++) {
      const target = new Date(today);
      target.setDate(today.getDate() + i);
      const iso = toIsoString(target);
      if (!minDate || iso >= minDate) {
        newDates.add(iso);
      }
    }
    onChange(Array.from(newDates).sort());
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <Label className="text-sm font-semibold text-foreground">{label}</Label>
          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-xs font-semibold text-primary">
            {value.length} dia{value.length === 1 ? "" : "s"} selecionado{value.length === 1 ? "" : "s"}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowRangeTool(current => !current)}
            className="h-7 text-xs"
          >
            {showRangeTool ? "Fechar intervalo" : "Adicionar período"}
          </Button>
          {value.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="mr-1 h-3 w-3" /> Limpar
            </Button>
          )}
        </div>
      </div>

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {showRangeTool && (
        <div className="grid gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={rangeStart}
              onChange={e => setRangeStart(e.target.value)}
              min={minDate}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={rangeEnd}
              onChange={e => setRangeEnd(e.target.value)}
              min={rangeStart || minDate}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              size="sm"
              onClick={addRange}
              disabled={!rangeStart || !rangeEnd || rangeEnd < rangeStart}
              className="h-8 w-full text-xs"
            >
              <Plus className="mr-1 h-3 w-3" /> Adicionar período
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[11px] text-muted-foreground mr-1">Atalhos:</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addNextDays(7)}
          className="h-6 px-2 text-[11px]"
        >
          Próximos 7 dias
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addNextDays(14)}
          className="h-6 px-2 text-[11px]"
        >
          Próximos 14 dias
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addNextDays(30)}
          className="h-6 px-2 text-[11px]"
        >
          Próximos 30 dias
        </Button>
      </div>

      {/* Calendar Header */}
      <div className="flex items-center justify-between pt-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={prevMonth}
          className="h-7 w-7"
          aria-label="Mês anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs font-semibold text-foreground">
          {monthNames[month]} de {year}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={nextMonth}
          className="h-7 w-7"
          aria-label="Próximo mês"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekDays.map(d => (
          <div key={d} className="py-1 text-[11px] font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
        {calendarDays.map((cell, idx) => {
          const isSelected = selectedSet.has(cell.date);
          const isToday = cell.date === toIsoString(new Date());

          return (
            <button
              key={`${cell.date}-${idx}`}
              type="button"
              disabled={cell.isDisabled}
              onClick={() => toggleDate(cell.date)}
              className={`relative flex h-8 items-center justify-center rounded-md text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
                  : cell.isCurrentMonth
                  ? "text-foreground hover:bg-accent"
                  : "text-muted-foreground/40 hover:bg-accent/50"
              } ${isToday && !isSelected ? "border border-primary font-bold text-primary" : ""} ${
                cell.isDisabled ? "cursor-not-allowed opacity-30" : "cursor-pointer"
              }`}
            >
              {cell.dayNumber}
            </button>
          );
        })}
      </div>

      {/* Selected Chips */}
      <div className="space-y-1.5 border-t border-border pt-2.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Datas selecionadas:</span>
          {value.length > 0 && (
            <span className="text-[11px] font-medium text-primary">
              Clique em uma data para remover
            </span>
          )}
        </div>
        <div className="flex max-h-28 min-h-8 flex-wrap gap-1.5 overflow-y-auto pr-1">
          {value.length === 0 ? (
            <span className="text-[11px] italic text-muted-foreground">
              Nenhuma data selecionada no calendário.
            </span>
          ) : (
            value.map(date => (
              <span
                key={date}
                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                {formatDateDisplay(date)}
                <button
                  type="button"
                  onClick={() => removeDate(date)}
                  className="rounded-xs p-0.5 hover:bg-primary/20 hover:text-primary focus-visible:outline-none"
                  aria-label={`Remover data ${formatDateDisplay(date)}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
