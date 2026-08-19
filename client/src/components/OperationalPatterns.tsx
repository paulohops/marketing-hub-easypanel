import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Download } from "lucide-react";
import { toast } from "sonner";

export type OperationalStatusOption<T extends string = string> = {
  value: T;
  label: string;
  className?: string;
};

export function OperationalStatusSelect<T extends string>({
  id,
  value,
  options,
  onChange,
  disabled = false,
}: {
  id: string;
  value: T;
  options: OperationalStatusOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <label className="sr-only" htmlFor={id}>
      Alterar status
      <select
        id={id}
        aria-label="Alterar status"
        value={value}
        disabled={disabled}
        onChange={event => onChange(event.target.value as T)}
        className="sr-only"
      >
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

type HistoryEntry = {
  id?: number | string;
  occurredAt: Date | string;
  actorName?: string | null;
  auditAction?: string;
  action?: string;
  afterData?: unknown;
};

type HistoryEvidence = { id?: number; url: string; name?: string };

function parsePayload(entry: HistoryEntry) {
  if (typeof entry.afterData !== "string") return (entry.afterData ?? {}) as Record<string, unknown>;
  try {
    return JSON.parse(entry.afterData) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function OperationalStatusDropdown<T extends string>({
  id,
  value,
  options,
  onChange,
  disabled = false,
  className = "",
}: {
  id: string;
  value: T;
  options: OperationalStatusOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return <select id={id} aria-label="Status" value={value} disabled={disabled} onChange={event => onChange(event.target.value as T)} className={`h-9 min-w-[9.75rem] rounded-lg border border-input bg-background px-3 text-sm font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring ${className}`}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
}

export function OperationalStatusDialog({
  open,
  onOpenChange,
  title = "Confirmar alteração de status",
  description = "Registre o contexto operacional e os arquivos que justificam esta mudança. O registro ficará disponível no histórico.",
  reason,
  onReasonChange,
  requiredReason = false,
  evidenceCount = 0,
  evidenceContent,
  contextContent,
  pending = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  reason: string;
  onReasonChange: (reason: string) => void;
  requiredReason?: boolean;
  evidenceCount?: number;
  evidenceContent?: ReactNode;
  contextContent?: ReactNode;
  pending?: boolean;
  onSubmit: () => void;
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-2xl overflow-x-hidden overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={event => { event.preventDefault(); onSubmit(); }}>{contextContent}<label className="grid gap-1.5 text-sm font-medium">Motivo {requiredReason ? "(obrigatório)" : "(opcional)"}<Textarea required={requiredReason} minLength={requiredReason ? 3 : undefined} value={reason} onChange={event => onReasonChange(event.target.value)} placeholder="Descreva a razão da alteração de status." /></label>{evidenceContent}{evidenceCount > 0 ? <p className="text-xs text-muted-foreground">{evidenceCount} evidência(s) selecionada(s).</p> : null}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Voltar</Button><Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={pending}>{pending ? "Salvando..." : "Confirmar status"}</Button></div></form></DialogContent></Dialog>;
}

export function OperationalHistory({
  entries,
  title,
  emptyMessage = "Ainda não há movimentações registradas.",
  labelFor,
  evidenceFor,
}: {
  entries: HistoryEntry[];
  title: string;
  emptyMessage?: string;
  labelFor: (entry: HistoryEntry) => string;
  evidenceFor?: (entry: HistoryEntry, payload: Record<string, unknown>) => HistoryEvidence[];
}) {
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  useEffect(() => {
    setShowAll(false);
    setSelected(null);
  }, [entries[0]?.id]);
  const ordered = useMemo(() => [...entries].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()), [entries]);
  const visible = showAll ? ordered : ordered.slice(0, 5);
  const selectedPayload = selected ? parsePayload(selected) : {};
  const selectedEvidence = selected && evidenceFor ? evidenceFor(selected, selectedPayload) : [];
  const hasDetails = (entry: HistoryEntry) => {
    const payload = parsePayload(entry);
    const evidence = evidenceFor?.(entry, payload) ?? [];
    return Boolean(String(payload.reason ?? payload.rescheduleReason ?? "").trim() || evidence.length);
  };
  const download = async (evidence: HistoryEvidence) => {
    try {
      const response = await fetch(evidence.url);
      if (!response.ok) throw new Error();
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = evidence.name ?? "evidencia";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1_000);
    } catch {
      toast.error("Não foi possível iniciar o download da evidência.");
    }
  };
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
        {ordered.length > 5 ? <Button type="button" variant="outline" size="sm" onClick={() => setShowAll(current => !current)}>{showAll ? "Mostrar últimos 5" : `Mostrar tudo (${ordered.length})`}</Button> : null}
      </div>
      {visible.length ? <div className="mt-4 space-y-3">{visible.map((entry, index) => {
        const payload = parsePayload(entry);
        return <div key={entry.id ?? `${entry.occurredAt}-${index}`} className="border-l-2 border-primary/30 pl-3">
          <p className="text-sm font-medium text-foreground">{labelFor(entry)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{new Date(entry.occurredAt).toLocaleString("pt-BR")}{entry.actorName ? ` · ${entry.actorName}` : ""}</p>
          {hasDetails(entry) ? <Button type="button" variant="link" className="mt-1 h-auto px-0 text-xs text-primary" onClick={() => setSelected(entry)}>Ver motivo e evidências</Button> : null}
          {payload.reason && !hasDetails(entry) ? <p className="mt-1 text-xs text-muted-foreground">{String(payload.reason)}</p> : null}
        </div>;
      })}</div> : <p className="mt-4 text-sm text-muted-foreground">{emptyMessage}</p>}
      <Dialog open={Boolean(selected)} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] w-[calc(100vw-1.25rem)] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>Motivo e evidências da alteração</DialogTitle><DialogDescription>{selected ? `${labelFor(selected)} em ${new Date(selected.occurredAt).toLocaleString("pt-BR")}` : ""}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><p className="text-xs font-semibold text-muted-foreground">Motivo informado</p><p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{String(selectedPayload.reason ?? selectedPayload.rescheduleReason ?? "Nenhum motivo registrado para esta alteração.")}</p></div>
            {selectedEvidence.length ? <div><p className="mb-2 text-xs font-semibold text-muted-foreground">Evidências anexadas</p><div className="grid gap-3 sm:grid-cols-2">{selectedEvidence.map((evidence, index) => <div key={`${evidence.url}-${index}`} className="overflow-hidden rounded-lg border border-border bg-muted/30"><img src={evidence.url} alt={evidence.name ?? `Evidência ${index + 1}`} className="max-h-44 w-full object-contain" /><div className="border-t border-border p-2"><Button type="button" variant="outline" size="sm" onClick={() => void download(evidence)}><Download className="mr-1.5 h-3.5 w-3.5" />Baixar arquivo</Button></div></div>)}</div></div> : null}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export type OperationalDebriefValue = {
  rating: string;
  resultSummary: string;
  notes: string;
  leadCount: string;
  saleCount: string;
  renewalCount: string;
  positives: string;
  negatives: string;
  resultAchieved: boolean;
  worthRepeating: boolean;
  completedAt: string;
};

const ratingLabel: Record<number, string> = { 1: "Insuficiente", 2: "Regular", 3: "Bom", 4: "Muito bom", 5: "Excelente" };

export function OperationalDebriefing({
  value,
  onChange,
  onSave,
  pending = false,
  canWrite = true,
  title = "Debriefing e resultado",
  summaryLabel = "História e resultado",
}: {
  value: OperationalDebriefValue;
  onChange: (value: OperationalDebriefValue) => void;
  onSave: () => void;
  pending?: boolean;
  canWrite?: boolean;
  title?: string;
  summaryLabel?: string;
}) {
  const update = (patch: Partial<OperationalDebriefValue>) => onChange({ ...value, ...patch });
  return <section className="rounded-2xl border border-border bg-card p-5"><h2 className="font-display text-lg font-semibold text-foreground">{title}</h2><form className="mt-3 space-y-3" onSubmit={event => { event.preventDefault(); onSave(); }}>
    <div className="grid gap-3 sm:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.1fr)]">
      <div className="grid content-start gap-2 rounded-xl border border-border bg-muted/25 p-4"><p className="text-xs font-semibold text-muted-foreground">Nota geral</p><strong className="text-2xl font-semibold tabular-nums text-foreground">{value.rating || "—"}</strong><Badge variant="outline" className="w-fit text-[10px]">{value.rating ? `${value.rating}/5 · ${ratingLabel[Number(value.rating)]}` : "Avaliação pendente"}</Badge><select aria-label="Nota geral" value={value.rating} onChange={event => update({ rating: event.target.value })} className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground"><option value="">Selecionar nota</option>{[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{rating} · {ratingLabel[rating]}</option>)}</select></div>
      <div className="grid gap-3"><label className="grid gap-1 text-xs font-semibold text-muted-foreground">{summaryLabel}<Textarea className="min-h-24" value={value.resultSummary} onChange={event => update({ resultSummary: event.target.value })} placeholder="Contexto, resultado alcançado e impacto percebido" /></label><label className="grid gap-1 text-xs font-semibold text-muted-foreground">Avaliação e aprendizados<Textarea className="min-h-24" value={value.notes} onChange={event => update({ notes: event.target.value })} placeholder="O que funcionou e o que deve ser aprimorado" /></label></div>
    </div>
    <div className="grid gap-2 sm:grid-cols-3"><label className="grid gap-1 text-xs font-semibold text-muted-foreground">Leads<Input type="number" min="0" value={value.leadCount} onChange={event => update({ leadCount: event.target.value })} /></label><label className="grid gap-1 text-xs font-semibold text-muted-foreground">Vendas<Input type="number" min="0" value={value.saleCount} onChange={event => update({ saleCount: event.target.value })} /></label><label className="grid gap-1 text-xs font-semibold text-muted-foreground">Renovações<Input type="number" min="0" value={value.renewalCount} onChange={event => update({ renewalCount: event.target.value })} /></label></div>
    <div className="grid gap-2 sm:grid-cols-2"><label className="grid gap-1 text-xs font-semibold text-muted-foreground">Pontos positivos<Textarea value={value.positives} onChange={event => update({ positives: event.target.value })} /></label><label className="grid gap-1 text-xs font-semibold text-muted-foreground">Pontos a melhorar<Textarea value={value.negatives} onChange={event => update({ negatives: event.target.value })} /></label></div>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs"><label className="flex items-center gap-2"><input type="checkbox" checked={value.resultAchieved} onChange={event => update({ resultAchieved: event.target.checked })} /> Objetivo atingido</label><label className="flex items-center gap-2"><input type="checkbox" checked={value.worthRepeating} onChange={event => update({ worthRepeating: event.target.checked })} /> Vale repetir</label><label className="ml-auto grid gap-1 text-xs font-semibold text-muted-foreground">Concluída em<Input type="datetime-local" required value={value.completedAt} onChange={event => update({ completedAt: event.target.value })} /></label></div>
    {canWrite ? <Button type="submit" className="w-full bg-primary" disabled={pending}>Salvar debriefing</Button> : null}
  </form></section>;
}

export function createEmptyOperationalDebrief(): OperationalDebriefValue {
  return { rating: "", resultSummary: "", notes: "", leadCount: "0", saleCount: "0", renewalCount: "0", positives: "", negatives: "", resultAchieved: true, worthRepeating: true, completedAt: new Date().toISOString().slice(0, 16) };
}

export function resolveHistoryEvidence(payload: Record<string, unknown>, documents: Array<{ id: number; url: string; originalName?: string }>): HistoryEvidence[] {
  const ids = Array.isArray(payload.evidenceDocumentIds) ? payload.evidenceDocumentIds.map(Number) : [];
  const urls = Array.isArray(payload.evidenceUrls) ? payload.evidenceUrls.filter((url): url is string => typeof url === "string") : [];
  return ids.length ? documents.filter(document => ids.includes(document.id)).map(document => ({ id: document.id, url: document.url, name: document.originalName })) : urls.map(url => ({ url }));
}
