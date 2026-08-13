import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Network } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function selectedIds(event: React.ChangeEvent<HTMLSelectElement>) {
  return Array.from(event.currentTarget.selectedOptions, option => Number(option.value));
}

export default function SupplierCoverageManager() {
  const utils = trpc.useUtils();
  const data = trpc.settings.overview.useQuery();
  const coverage = trpc.settings.supplierCoverage.useQuery();
  const [supplierId, setSupplierId] = useState("");
  const [cityIds, setCityIds] = useState<number[]>([]);
  const [serviceTypeIds, setServiceTypeIds] = useState<number[]>([]);
  const [mediaTypeIds, setMediaTypeIds] = useState<number[]>([]);
  const save = trpc.settings.setSupplierCoverage.useMutation({ onSuccess: () => { toast.success("Cobertura do fornecedor atualizada."); utils.settings.supplierCoverage.invalidate(); }, onError: error => toast.error(error.message) });

  useEffect(() => {
    if (!supplierId || !coverage.data) return;
    const id = Number(supplierId);
    setCityIds(coverage.data.citiesBySupplier.filter(link => link.supplierId === id).map(link => link.cityId));
    setServiceTypeIds(coverage.data.servicesBySupplier.filter(link => link.supplierId === id).map(link => link.serviceTypeId));
    setMediaTypeIds(coverage.data.mediaBySupplier.filter(link => link.supplierId === id).map(link => link.mediaTypeId));
  }, [supplierId, coverage.data]);

  return <section className="mt-4 rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-foreground"><Network className="h-4 w-4" /></span><div><h2 className="font-display text-lg font-semibold text-foreground">Cobertura dos fornecedores</h2><p className="text-xs text-foreground">Defina em quais cidades, serviços e tipos de mídia cada fornecedor pode atuar.</p></div></div><div className="mt-5 grid gap-4 lg:grid-cols-4"><div><Label htmlFor="coverage-supplier">Fornecedor</Label><select id="coverage-supplier" value={supplierId} onChange={event => setSupplierId(event.target.value)} className="mt-2 h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"><option value="">Selecione</option>{data.data?.suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.displayName}</option>)}</select></div><div><Label htmlFor="coverage-cities">Cidades atendidas</Label><select id="coverage-cities" multiple value={cityIds.map(String)} onChange={event => setCityIds(selectedIds(event))} className="mt-2 h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm">{data.data?.cities.map(city => <option key={city.id} value={city.id}>{city.name} · {city.state}</option>)}</select></div><div><Label htmlFor="coverage-services">Serviços</Label><select id="coverage-services" multiple value={serviceTypeIds.map(String)} onChange={event => setServiceTypeIds(selectedIds(event))} className="mt-2 h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm">{data.data?.serviceTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></div><div><Label htmlFor="coverage-media">Tipos de mídia</Label><select id="coverage-media" multiple value={mediaTypeIds.map(String)} onChange={event => setMediaTypeIds(selectedIds(event))} className="mt-2 h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm">{data.data?.mediaTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></div></div><Button type="button" disabled={!supplierId || save.isPending} onClick={() => save.mutate({ supplierId: Number(supplierId), cityIds, serviceTypeIds, mediaTypeIds })} className="mt-4 bg-primary hover:bg-primary/90">Salvar cobertura</Button></section>;
}
