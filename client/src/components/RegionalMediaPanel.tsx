import EvidenceUpload from "@/components/EvidenceUpload";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { RadioTower } from "lucide-react";
import { useState } from "react";

export default function RegionalMediaPanel({ canWrite }: { canWrite: boolean }) {
  const references = trpc.media.referenceData.useQuery();
  const regionals = references.data?.regionals ?? [];
  const [regionalId, setRegionalId] = useState<number | null>(null);
  const selected = regionalId ?? regionals[0]?.id ?? null;
  return <section className="mx-auto mt-6 max-w-[1480px] rounded-2xl border border-border bg-card p-5 shadow-[0_3px_12px_rgba(24,48,43,0.025)]"><div className="flex gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-foreground"><RadioTower className="h-4 w-4" /></span><div><p className="font-display text-base font-semibold text-foreground">Acervo de mídias por regional</p><p className="mt-0.5 text-xs text-foreground">Arquive materiais, comprovações e arquivos locais de cada regional.</p></div></div>{regionals.length ? <div className="mt-4 grid gap-3 md:grid-cols-[280px_1fr]"><div><Label htmlFor="regional-media">Regional</Label><select id="regional-media" value={selected ?? ""} onChange={event => setRegionalId(Number(event.target.value))} className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm">{regionals.map(regional => <option key={regional.id} value={regional.id}>{regional.name} · {regional.code}</option>)}</select></div>{selected ? <EvidenceUpload entityType="regional_media" entityId={selected} regionalId={selected} canWrite={canWrite} /> : null}</div> : <p className="mt-4 text-xs text-foreground">Cadastre uma regional para centralizar seus materiais.</p>}</section>;
}
