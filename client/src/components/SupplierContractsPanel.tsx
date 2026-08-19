import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ClipboardCheck, Paperclip, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const acceptedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;

type ContractItemKind = "product" | "service" | "media" | "other";
type ContractStatus = "draft" | "active" | "expired" | "terminated";
type BillingMode = "single" | "recurring";
type BillingRecurrence = "one_time" | "weekly" | "biweekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";

type ContractItem = {
  kind: ContractItemKind;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  supplierOfferingId: string;
  stockItemId: string;
};

const recurrenceLabel: Record<BillingRecurrence, string> = {
  one_time: "Único",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

function emptyItem(): ContractItem {
  return { kind: "service", description: "", quantity: "1", unit: "unidade", unitPrice: "", supplierOfferingId: "", stockItemId: "" };
}

function emptyForm(supplierId?: number) {
  return {
    supplierId: supplierId ? String(supplierId) : "",
    companyId: "",
    fiscalEntityId: "",
    purchaseOrderCode: "",
    contractType: "",
    objectDescription: "",
    signatureDate: "",
    contractCode: "",
    billingNames: "",
    startsOn: "",
    endsOn: "",
    termMonths: "",
    billingMode: "recurring" as BillingMode,
    billingRecurrence: "monthly" as BillingRecurrence,
    billingStartsOn: "",
    billingEndsOn: "",
    autoRenew: false,
    paymentDay: "",
    expectedAmount: "",
    paymentMethod: "",
    bankName: "",
    bankBranch: "",
    bankAccount: "",
    bankHolder: "",
    pixKey: "",
    status: "draft" as ContractStatus,
    notes: "",
  };
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function SupplierContractsPanel({ canWrite, supplierId, openSignal = 0 }: { canWrite: boolean; supplierId?: number; openSignal?: number }) {
  const financeApi = (trpc as unknown as { finance?: typeof trpc.finance }).finance;
  if (!financeApi) return null;
  const utils = trpc.useUtils();
  const suppliers = financeApi.referenceData.useQuery(undefined, { enabled: supplierId == null });
  const dimensions = financeApi.financeDimensions.useQuery();
  const contracts = financeApi.listSupplierContracts.useQuery(supplierId ? { supplierId } : undefined);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm(supplierId));
  const [items, setItems] = useState<ContractItem[]>([emptyItem()]);

  useEffect(() => {
    if (openSignal > 0) setShowForm(true);
  }, [openSignal]);

  useEffect(() => {
    if (supplierId) setForm(current => ({ ...current, supplierId: String(supplierId) }));
  }, [supplierId]);

  const create = financeApi.createSupplierContract.useMutation({
    onSuccess: () => {
      toast.success("Contrato de fornecedor registrado e competências geradas.");
      utils.finance.listSupplierContracts.invalidate();
      utils.finance.listBillings.invalidate();
      setShowForm(false);
      setForm(emptyForm(supplierId));
      setItems([emptyItem()]);
    },
    onError: error => toast.error(error.message),
  });
  const upload = trpc.documents.upload.useMutation({
    onSuccess: () => {
      toast.success("Documento contratual anexado.");
      utils.finance.listSupplierContracts.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const selectedCompany = dimensions.data?.companies.find(company => String(company.id) === form.companyId);
  const fiscalOptions = dimensions.data?.fiscalEntities.filter(item => !selectedCompany?.providerId || item.fiscalEntity.providerId === selectedCompany.providerId) ?? [];
  const selectedSupplierOfferings = dimensions.data?.offerings.filter(item => !form.supplierId || item.offering.supplierId === Number(form.supplierId)) ?? [];
  const itemsTotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0), [items]);

  const updateItem = (index: number, patch: Partial<ContractItem>) => {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.supplierId) {
      toast.error("Selecione o fornecedor do contrato.");
      return;
    }
    if (!form.startsOn || !form.contractType) {
      toast.error("Preencha o tipo e o início da vigência do contrato.");
      return;
    }
    if (!items.length || items.some(item => !item.description.trim() || Number(item.quantity) <= 0 || Number(item.unitPrice) < 0 || item.kind === "product" && !item.stockItemId)) {
      toast.error("Preencha todos os itens. Produtos precisam estar vinculados ao estoque.");
      return;
    }
    const billingStartsOn = form.billingStartsOn || form.startsOn;
    const billingEndsOn = form.billingEndsOn || form.endsOn;
    if (form.billingMode === "recurring" && !billingEndsOn) {
      toast.error("Informe o fim da cobrança para gerar as competências recorrentes.");
      return;
    }
    if (form.endsOn && form.endsOn < form.startsOn) {
      toast.error("A vigência final não pode ser anterior ao início do contrato.");
      return;
    }
    create.mutate({
      supplierId: Number(form.supplierId),
      companyId: form.companyId ? Number(form.companyId) : null,
      fiscalEntityId: form.fiscalEntityId ? Number(form.fiscalEntityId) : null,
      purchaseOrderCode: form.purchaseOrderCode || undefined,
      contractType: form.contractType,
      objectDescription: form.objectDescription || undefined,
      signatureDate: form.signatureDate || undefined,
      contractCode: form.contractCode || undefined,
      billingNames: form.billingNames.split(";").map(value => value.trim()).filter(Boolean),
      startsOn: form.startsOn,
      endsOn: form.endsOn || undefined,
      termMonths: form.termMonths ? Number(form.termMonths) : undefined,
      recurrence: recurrenceLabel[form.billingMode === "single" ? "one_time" : form.billingRecurrence],
      billingMode: form.billingMode,
      billingRecurrence: form.billingMode === "single" ? "one_time" : form.billingRecurrence,
      billingStartsOn: form.billingMode === "recurring" ? billingStartsOn : undefined,
      billingEndsOn: form.billingMode === "recurring" ? billingEndsOn : undefined,
      autoRenew: form.autoRenew,
      paymentDay: form.paymentDay ? Number(form.paymentDay) : undefined,
      expectedAmount: Number(form.expectedAmount || itemsTotal),
      paymentMethod: form.paymentMethod || undefined,
      bankName: form.bankName || undefined,
      bankBranch: form.bankBranch || undefined,
      bankAccount: form.bankAccount || undefined,
      bankHolder: form.bankHolder || undefined,
      pixKey: form.pixKey || undefined,
      status: form.status,
      notes: form.notes || undefined,
      items: items.map(item => ({
        kind: item.kind,
        description: item.description,
        quantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: Number(item.unitPrice),
        supplierOfferingId: item.supplierOfferingId ? Number(item.supplierOfferingId) : null,
        stockItemId: item.stockItemId ? Number(item.stockItemId) : null,
      })),
    });
  };

  const handleFile = async (contractId: number, file?: File) => {
    if (!file) return;
    if (!acceptedTypes.includes(file.type as (typeof acceptedTypes)[number]) || file.size > 5 * 1024 * 1024) {
      toast.error("Envie PDF ou imagem de até 5 MB.");
      return;
    }
    upload.mutate({ entityType: "supplier_contract", entityId: contractId, regionalId: null, originalName: file.name, mimeType: file.type as (typeof acceptedTypes)[number], dataBase64: await fileToBase64(file) });
  };

  return <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
    <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-primary" /><p className="font-display text-lg font-semibold text-foreground">Contratos e ordens de compra</p></div><p className="mt-1 text-xs text-muted-foreground">Controle vigência, recorrência, dia de pagamento, empresa fiscal, itens e documentos por fornecedor.</p></div>
      {canWrite && <Button size="sm" onClick={() => setShowForm(true)} className="h-8 bg-primary text-xs hover:bg-primary/90"><Plus className="mr-1.5 h-3.5 w-3.5" /> Novo contrato</Button>}
    </div>
    {contracts.isLoading ? <p className="p-5 text-sm text-muted-foreground">Carregando contratos...</p> : contracts.data?.length ? <div className="divide-y divide-border">{contracts.data.map(contract => <article key={contract.id} className="px-5 py-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-foreground">{contract.supplierName}</p><Badge className="border-0 bg-secondary text-[10px] text-foreground">{contract.contractType}</Badge><Badge variant="outline" className="text-[10px]">{contract.status === "active" ? "Ativo" : contract.status === "draft" ? "Rascunho" : contract.status === "expired" ? "Encerrado" : "Rescindido"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">OC: {contract.purchaseOrderCode || "não informada"} · Contrato: {contract.contractCode || "não informado"} · {contract.recurrence}{contract.paymentDay ? ` · pagamento dia ${contract.paymentDay}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">Vigência: {new Date(`${contract.startsOn}T12:00:00`).toLocaleDateString("pt-BR")}{contract.endsOn ? ` a ${new Date(`${contract.endsOn}T12:00:00`).toLocaleDateString("pt-BR")}` : ""} · NFs: {contract.invoices.length}</p>{contract.billingNames.length ? <p className="mt-1 text-xs text-muted-foreground">Faturar como: {contract.billingNames.join(", ")}</p> : null}{contract.attachedDocuments.length ? <div className="mt-2 flex flex-wrap gap-2">{contract.attachedDocuments.map(document => <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-foreground hover:bg-primary/10"><Paperclip className="h-3 w-3" />{document.originalName}</a>)}</div> : null}</div><div className="flex items-start gap-3"><div className="grid grid-cols-2 gap-4 text-right"><div><p className="text-sm font-semibold text-foreground">{currency.format(Number(contract.expectedAmount))}</p><p className="text-[10px] text-muted-foreground">previsto</p></div><div><p className="text-sm font-semibold text-primary">{currency.format(contract.outstandingAmount)}</p><p className="text-[10px] text-muted-foreground">a pagar</p></div></div>{canWrite && <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border px-2 text-foreground hover:bg-secondary"><Paperclip className="h-3.5 w-3.5" /><input type="file" className="hidden" accept="application/pdf,image/jpeg,image/png,image/webp" aria-label={`Anexar documento do contrato ${contract.supplierName}`} onChange={event => handleFile(contract.id, event.target.files?.[0])} /></label>}</div></div></article>)}</div> : <p className="p-5 text-sm text-muted-foreground">Nenhum contrato registrado. Use uma ordem de compra guarda-chuva para acompanhar recorrências e pagamentos de cada fornecedor.</p>}
    {showForm && <Dialog open={showForm} onOpenChange={setShowForm}><DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto"><DialogHeader><DialogTitle>Novo contrato de fornecedor</DialogTitle><DialogDescription>Registre o contrato real, defina quem será faturado e gere automaticamente as competências para cada ciclo de cobrança.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
      {supplierId == null ? <div className="md:col-span-2"><Label>Fornecedor</Label><select required value={form.supplierId} onChange={event => setForm({ ...form, supplierId: event.target.value })} className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecionar</option>{suppliers.data?.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.displayName}</option>)}</select></div> : <input type="hidden" value={form.supplierId} />}
      <div><Label>Tipo de contrato</Label><Input required value={form.contractType} onChange={event => setForm({ ...form, contractType: event.target.value })} className="mt-1.5" placeholder="Prestação de serviço" /></div><div><Label>Código do contrato</Label><Input value={form.contractCode} onChange={event => setForm({ ...form, contractCode: event.target.value })} className="mt-1.5" /></div>
      <div><Label>Empresa operacional</Label><select value={form.companyId} onChange={event => setForm({ ...form, companyId: event.target.value, fiscalEntityId: "" })} className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecionar</option>{dimensions.data?.companies.map(company => <option key={company.id} value={company.id}>{company.name} · {company.code}</option>)}</select></div><div><Label>Empresa fiscal / CNPJ</Label><select value={form.fiscalEntityId} onChange={event => setForm({ ...form, fiscalEntityId: event.target.value })} className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecionar</option>{fiscalOptions.map(item => <option key={item.fiscalEntity.id} value={item.fiscalEntity.id}>{item.fiscalEntity.name} · {item.fiscalEntity.cnpj}</option>)}</select></div>
      <div className="md:col-span-2"><Label>Objeto do contrato</Label><Textarea value={form.objectDescription} onChange={event => setForm({ ...form, objectDescription: event.target.value })} className="mt-1.5 min-h-20" placeholder="Descreva o escopo, praça, mídia, serviço ou fornecimento contratado." /></div><div><Label>Data de assinatura</Label><Input type="date" value={form.signatureDate} onChange={event => setForm({ ...form, signatureDate: event.target.value })} className="mt-1.5" /></div><div><Label>Ordem guarda-chuva</Label><Input value={form.purchaseOrderCode} onChange={event => setForm({ ...form, purchaseOrderCode: event.target.value })} className="mt-1.5" placeholder="Código da OC" /></div>
      <div><Label>Início da vigência</Label><Input required type="date" value={form.startsOn} onChange={event => setForm({ ...form, startsOn: event.target.value })} className="mt-1.5" /></div><div><Label>Fim da vigência</Label><Input type="date" value={form.endsOn} onChange={event => setForm({ ...form, endsOn: event.target.value })} className="mt-1.5" /></div><div><Label>Meses de vigência</Label><Input type="number" min="1" value={form.termMonths} onChange={event => setForm({ ...form, termMonths: event.target.value })} className="mt-1.5" /></div><div><Label>Status</Label><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as ContractStatus })} className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="draft">Rascunho</option><option value="active">Ativo</option><option value="expired">Encerrado</option><option value="terminated">Rescindido</option></select></div>
      <div><Label>Modo de faturamento</Label><select value={form.billingMode} onChange={event => setForm({ ...form, billingMode: event.target.value as BillingMode })} className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="recurring">Recorrente</option><option value="single">Único</option></select></div>{form.billingMode === "recurring" ? <><div><Label>Periodicidade</Label><select value={form.billingRecurrence} onChange={event => setForm({ ...form, billingRecurrence: event.target.value as BillingRecurrence })} className="mt-1.5 h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm">{Object.entries(recurrenceLabel).filter(([value]) => value !== "one_time").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div><Label>Início da cobrança</Label><Input type="date" value={form.billingStartsOn} onChange={event => setForm({ ...form, billingStartsOn: event.target.value })} className="mt-1.5" /></div><div><Label>Fim da cobrança</Label><Input type="date" value={form.billingEndsOn} onChange={event => setForm({ ...form, billingEndsOn: event.target.value })} className="mt-1.5" /></div></> : <div><Label>Periodicidade</Label><Input value="Único" readOnly className="mt-1.5 bg-muted" /></div>}
      <div><Label>Dia de vencimento</Label><Input type="number" min="1" max="31" value={form.paymentDay} onChange={event => setForm({ ...form, paymentDay: event.target.value })} className="mt-1.5" placeholder="13" /></div><div><Label>Valor previsto (R$)</Label><Input type="number" min="0" step="0.01" value={form.expectedAmount} onChange={event => setForm({ ...form, expectedAmount: event.target.value })} className="mt-1.5" placeholder={itemsTotal > 0 ? itemsTotal.toFixed(2) : "0,00"} /></div><div><Label>Forma de pagamento</Label><Input value={form.paymentMethod} onChange={event => setForm({ ...form, paymentMethod: event.target.value })} className="mt-1.5" placeholder="Boleto, PIX..." /></div><label className="flex items-center gap-2 pt-7 text-xs text-muted-foreground"><input type="checkbox" checked={form.autoRenew} onChange={event => setForm({ ...form, autoRenew: event.target.checked })} className="h-4 w-4 accent-primary" /> Renovação automática</label>
      <div className="rounded-xl border border-border bg-secondary/30 p-4 md:col-span-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-foreground">Itens do contrato</p><p className="mt-1 text-xs text-muted-foreground">Produtos exigem vínculo com estoque; serviços podem usar a oferta cadastrada do fornecedor.</p></div><Badge variant="outline">Total dos itens: {currency.format(itemsTotal)}</Badge></div><div className="mt-3 space-y-3">{items.map((item, index) => <div key={index} className="grid gap-2 rounded-lg border border-border bg-card p-3 md:grid-cols-12"><div className="md:col-span-2"><Label className="text-xs">Natureza</Label><select value={item.kind} onChange={event => updateItem(index, { kind: event.target.value as ContractItemKind, stockItemId: event.target.value === "product" ? item.stockItemId : "", supplierOfferingId: event.target.value === "service" ? item.supplierOfferingId : "" })} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="product">Produto</option><option value="service">Serviço</option><option value="media">Mídia</option><option value="other">Outro</option></select></div><div className="md:col-span-4"><Label className="text-xs">Descrição</Label><Input value={item.description} onChange={event => updateItem(index, { description: event.target.value })} className="mt-1 h-9 text-xs" placeholder="Item contratado" /></div><div className="md:col-span-1"><Label className="text-xs">Qtd.</Label><Input type="number" min="0.01" step="0.01" value={item.quantity} onChange={event => updateItem(index, { quantity: event.target.value })} className="mt-1 h-9 text-xs" /></div><div className="md:col-span-1"><Label className="text-xs">Un.</Label><Input value={item.unit} onChange={event => updateItem(index, { unit: event.target.value })} className="mt-1 h-9 text-xs" /></div><div className="md:col-span-2"><Label className="text-xs">Valor unitário</Label><Input required type="number" min="0" step="0.01" value={item.unitPrice} onChange={event => updateItem(index, { unitPrice: event.target.value })} className="mt-1 h-9 text-xs" /></div><div className="md:col-span-2 flex items-end gap-2">{item.kind === "product" ? <select required value={item.stockItemId} onChange={event => updateItem(index, { stockItemId: event.target.value })} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"><option value="">Produto do estoque</option>{dimensions.data?.stock.map(stock => <option key={stock.id} value={stock.id}>{stock.name}</option>)}</select> : item.kind === "service" ? <select value={item.supplierOfferingId} onChange={event => updateItem(index, { supplierOfferingId: event.target.value })} className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"><option value="">Serviço do fornecedor</option>{selectedSupplierOfferings.map(offering => <option key={offering.offering.id} value={offering.offering.id}>{offering.offering.name}</option>)}</select> : <span className="flex-1" />}{items.length > 1 && <Button type="button" variant="ghost" size="sm" className="h-9 px-2 text-destructive" onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-3.5 w-3.5" /></Button>}</div></div>)}</div><Button type="button" variant="outline" size="sm" className="mt-3 h-8 text-xs" onClick={() => setItems(current => [...current, emptyItem()])}><Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar item</Button></div>
      <div className="rounded-xl border border-border bg-secondary/20 p-4 md:col-span-4"><p className="text-sm font-semibold text-foreground">Dados bancários do fornecedor</p><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><div><Label className="text-xs">Banco</Label><Input value={form.bankName} onChange={event => setForm({ ...form, bankName: event.target.value })} className="mt-1.5" /></div><div><Label className="text-xs">Agência</Label><Input value={form.bankBranch} onChange={event => setForm({ ...form, bankBranch: event.target.value })} className="mt-1.5" /></div><div><Label className="text-xs">Conta</Label><Input value={form.bankAccount} onChange={event => setForm({ ...form, bankAccount: event.target.value })} className="mt-1.5" /></div><div><Label className="text-xs">Titular</Label><Input value={form.bankHolder} onChange={event => setForm({ ...form, bankHolder: event.target.value })} className="mt-1.5" /></div><div><Label className="text-xs">Chave PIX</Label><Input value={form.pixKey} onChange={event => setForm({ ...form, pixKey: event.target.value })} className="mt-1.5" /></div></div></div>
      <div className="md:col-span-4"><Label>Nomes que podem constar na nota fiscal</Label><Input value={form.billingNames} onChange={event => setForm({ ...form, billingNames: event.target.value })} className="mt-1.5" placeholder="Razão social A; razão social B" /><p className="mt-1 text-[11px] text-muted-foreground">Separe alternativas por ponto e vírgula.</p></div><div className="md:col-span-4"><Label>Observações</Label><Textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} className="mt-1.5" /></div><div className="flex justify-end gap-2 md:col-span-4"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" disabled={create.isPending} className="bg-primary hover:bg-primary/90">{create.isPending ? "Salvando..." : "Salvar contrato e gerar competências"}</Button></div>
    </form></DialogContent></Dialog>}
  </section>;
}
