import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { MapPin, RadioTower, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function TraditionalMediaWorkspace() {
  const [, setLocation] = useLocation();
  const [regionalId, setRegionalId] = useState("");
  const [cityId, setCityId] = useState("");
  const references = trpc.media.referenceData.useQuery();
  const listInput = useMemo(() => ({
    operationCategory: "audio_video" as const,
    channelKind: "standard" as const,
    regionalId: regionalId ? Number(regionalId) : undefined,
    cityId: cityId ? Number(cityId) : undefined,
  }), [cityId, regionalId]);
  const programs = trpc.media.list.useQuery(listInput);
  const cities = (references.data?.cities ?? []).filter(({ city }) => !regionalId || city.regionalId === Number(regionalId));

  return <div className="mx-auto max-w-[1480px] space-y-6">
    <header className="flex flex-col gap-5 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-white shadow-sm"><RadioTower className="h-5 w-5" /></span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Módulo independente</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Mídia Tradicional</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Cadastre e acompanhe rádios, TVs, programas, spots, alcance do sinal e veiculações tradicionais. Esta área possui fluxo próprio e não compartilha a tela de Mídia Urbana.</p>
        </div>
      </div>
      <Badge variant="outline" className="w-fit border-primary/30 bg-primary/5 px-3 py-1.5 text-xs text-primary">Base preparada para construção do módulo</Badge>
    </header>

    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="flex items-center gap-2 pb-1 text-sm font-semibold text-foreground"><Search className="h-4 w-4 text-primary" />Filtrar programas tradicionais</div>
        <div className="grid flex-1 gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-medium text-foreground"><span>Regional</span><select aria-label="Regional" value={regionalId} onChange={event => { setRegionalId(event.target.value); setCityId(""); }} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground"><option value="">Todas as regionais</option>{(references.data?.regionals ?? []).map(regional => <option key={regional.id} value={regional.id}>{regional.name}</option>)}</select></label>
          <label className="space-y-1.5 text-xs font-medium text-foreground"><span>Cidade</span><select aria-label="Cidade" value={cityId} onChange={event => setCityId(event.target.value)} className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground"><option value="">Todas as cidades</option>{cities.map(({ city, regionalName }) => <option key={city.id} value={city.id}>{city.name}{regionalName ? ` · ${regionalName}` : ""}</option>)}</select></label>
        </div>
        <Button type="button" variant="outline" className="h-10 border-border" onClick={() => { setRegionalId(""); setCityId(""); }}>Limpar filtros</Button>
      </div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-display text-lg font-semibold text-foreground">Programas cadastrados</p><p className="mt-0.5 text-xs text-muted-foreground">Rádios, TVs e demais pontos de mídia tradicional com ficha própria.</p></div><Badge variant="outline" className="w-fit border-border bg-secondary text-xs text-foreground">{programs.data?.length ?? 0} programas</Badge></div>
      {programs.isLoading ? <div className="grid min-h-48 place-items-center text-sm text-muted-foreground">Carregando programas tradicionais...</div> : programs.data?.length ? <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">{programs.data.map(program => <article key={program.id} className="rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/50"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-foreground">{program.name}</p><p className="mt-1 text-xs text-muted-foreground">{program.mediaTypeName ?? "Tipo de mídia não informado"}</p></div><RadioTower className="h-4 w-4 shrink-0 text-primary" /></div><div className="mt-4 space-y-1.5 text-xs text-muted-foreground"><p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-primary" />{program.cityName ?? "Cidade não informada"}{program.regionalName ? ` · ${program.regionalName}` : ""}</p><p>Fornecedor: {program.supplierName ?? "Não informado"}</p></div><Button type="button" variant="outline" className="mt-4 w-full border-border text-xs" onClick={() => setLocation(`/midias/tradicional/${program.id}`)}>Abrir programa</Button></article>)}</div> : <div className="grid min-h-56 place-items-center px-6 py-10 text-center"><div><RadioTower className="mx-auto h-8 w-8 text-primary/70" /><p className="mt-3 font-semibold text-foreground">Nenhum programa tradicional encontrado</p><p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">A estrutura independente está pronta. O próximo passo será construir o cadastro de rádios, TVs, spots, cidades de sinal e alcance.</p></div></div>}
    </section>
  </div>;
}
