import { Label } from "@/components/ui/label";
import EvidenceUpload from "@/components/EvidenceUpload";
import { trpc } from "@/lib/trpc";
import { Paperclip } from "lucide-react";
import { useState } from "react";

export default function TradeEvidencePanel({ mode, canWrite }: { mode: "action" | "event"; canWrite: boolean }) {
  const actions = trpc.actions.list.useQuery(undefined, { enabled: mode === "action" });
  const events = trpc.events.list.useQuery(undefined, { enabled: mode === "event" });
  const options = mode === "action" ? (actions.data ?? []).map(({ action }) => ({ id: action.id, label: action.name })) : (events.data ?? []).map(({ event }) => ({ id: event.id, label: event.name }));
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = selectedId ?? options[0]?.id ?? null;
  return <section className="mx-auto mt-6 max-w-[1480px] rounded-2xl border border-border bg-white p-5 shadow-[0_3px_12px_rgba(24,48,43,0.025)]"><div className="flex gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-foreground"><Paperclip className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="font-display text-base font-semibold text-foreground">Evidências de {mode === "action" ? "ações" : "eventos"}</p><p className="mt-0.5 text-xs text-foreground">Anexe fotos, PDFs e comprovantes à execução operacional.</p></div></div>{options.length ? <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,300px)_1fr]"><div><Label htmlFor={`${mode}-evidence`}>{mode === "action" ? "Ação" : "Evento"}</Label><select id={`${mode}-evidence`} value={selected ?? ""} onChange={event => setSelectedId(Number(event.target.value))} className="mt-1.5 h-9 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="">Selecionar</option>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></div>{selected ? <EvidenceUpload entityType={mode} entityId={selected} canWrite={canWrite} /> : null}</div> : <p className="mt-4 text-xs text-foreground">Crie primeiro um registro para disponibilizar o envio de evidências.</p>}</section>;
}
