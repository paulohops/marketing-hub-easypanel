import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type ImportRows = {
  providers: Array<{ name: string; legalName?: string; billingCnpj?: string; contactName?: string; phone?: string; email?: string; address?: string }>;
  regionals: Array<{ providerName?: string; name: string; code: string }>;
  cities: Array<{ regionalCode: string; name: string; state: string; ibgeCode?: string; address?: string; zipCode?: string; latitude?: number; longitude?: number; locationNotes?: string }>;
  stores: Array<{ regionalCode: string; cityName: string; name: string; code: string; address?: string }>;
};

const emptyRows: ImportRows = { providers: [], regionals: [], cities: [], stores: [] };
const columns = {
  Empresas: ["name", "legalName", "billingCnpj", "contactName", "phone", "email", "address"],
  Regionais: ["providerName", "name", "code"],
  Cidades: ["regionalCode", "name", "state", "ibgeCode", "address", "zipCode", "latitude", "longitude", "locationNotes"],
  Lojas: ["regionalCode", "cityName", "name", "code", "address"],
} as const;

function text(value: unknown) { return String(value ?? "").trim(); }
function optional(value: unknown) { const parsed = text(value); return parsed || undefined; }
function numberOrUndefined(value: unknown) { const parsed = text(value).replace(",", "."); return parsed ? Number(parsed) : undefined; }

export function parseOperationalWorkbook(workbook: XLSX.WorkBook): ImportRows {
  const rows = (sheetName: keyof typeof columns) => workbook.SheetNames.includes(sheetName) ? XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" }) : [];
  return {
    providers: rows("Empresas").map(row => ({ name: text(row.name), legalName: optional(row.legalName), billingCnpj: optional(row.billingCnpj), contactName: optional(row.contactName), phone: optional(row.phone), email: optional(row.email), address: optional(row.address) })),
    regionals: rows("Regionais").map(row => ({ providerName: optional(row.providerName), name: text(row.name), code: text(row.code).toUpperCase() })),
    cities: rows("Cidades").map(row => ({ regionalCode: text(row.regionalCode).toUpperCase(), name: text(row.name), state: text(row.state).toUpperCase(), ibgeCode: optional(row.ibgeCode), address: optional(row.address), zipCode: optional(row.zipCode), latitude: numberOrUndefined(row.latitude), longitude: numberOrUndefined(row.longitude), locationNotes: optional(row.locationNotes) })),
    stores: rows("Lojas").map(row => ({ regionalCode: text(row.regionalCode).toUpperCase(), cityName: text(row.cityName), name: text(row.name), code: text(row.code).toUpperCase(), address: optional(row.address) })),
  };
}

export function validateOperationalRows(rows: ImportRows) {
  const issues: string[] = [];
  if (!Object.values(rows).some(group => group.length)) issues.push("A planilha não possui linhas preenchidas nas abas reconhecidas.");
  rows.providers.forEach((row, index) => { if (!row.name) issues.push(`Empresas: a linha ${index + 2} precisa de name.`); });
  rows.regionals.forEach((row, index) => { if (!row.name || !row.code) issues.push(`Regionais: a linha ${index + 2} precisa de name e code.`); });
  rows.cities.forEach((row, index) => { if (!row.regionalCode || !row.name || row.state.length !== 2) issues.push(`Cidades: a linha ${index + 2} precisa de regionalCode, name e state com UF de 2 letras.`); });
  rows.stores.forEach((row, index) => { if (!row.regionalCode || !row.cityName || !row.name || !row.code) issues.push(`Lojas: a linha ${index + 2} precisa de regionalCode, cityName, name e code.`); });
  return issues;
}

export default function DataImportWorkspace() {
  const utils = trpc.useUtils();
  const [rows, setRows] = useState<ImportRows>(emptyRows);
  const [issues, setIssues] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const importRows = trpc.settings.importOperationalSpreadsheet.useMutation({
    onSuccess: result => { toast.success(`Importação concluída: ${Object.values(result.created).reduce((sum, value) => sum + value, 0)} novos registros.`); setConfirmOpen(false); setRows(emptyRows); setIssues([]); setFileName(""); utils.settings.overview.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const totalRows = useMemo(() => Object.values(rows).reduce((sum, group) => sum + group.length, 0), [rows]);

  const downloadTemplate = () => {
    const workbook = XLSX.utils.book_new();
    Object.entries(columns).forEach(([name, headers]) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([Array.from(headers)]), name));
    XLSX.writeFile(workbook, "modelo-importacao-trade-hub.xlsx");
  };
  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const parsed = parseOperationalWorkbook(workbook);
      const validation = validateOperationalRows(parsed);
      setRows(parsed); setIssues(validation); setFileName(file.name);
      if (validation.length) toast.error("Corrija os campos indicados antes de importar."); else toast.success("Planilha validada. Revise o resumo e confirme a gravação.");
    } catch { setRows(emptyRows); setIssues(["Não foi possível ler esta planilha. Use XLSX ou CSV gerado a partir do modelo."]); setFileName(file.name); }
    event.target.value = "";
  };

  return <div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Configurações · dados estruturados</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Importar cadastros por planilha</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Use o modelo para cadastrar Empresas, Regionais, Cidades e Lojas em lote. A plataforma valida as referências antes de criar qualquer registro e ignora códigos já existentes.</p></div><Button variant="outline" onClick={downloadTemplate} className="border-primary/30 text-primary"><Download className="mr-2 h-4 w-4" />Baixar modelo XLSX</Button></header>
    <section className="rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><FileSpreadsheet className="h-5 w-5" /></span><div><h2 className="font-display text-lg font-semibold text-foreground">Selecionar planilha</h2><p className="mt-1 text-sm text-muted-foreground">Formatos aceitos: XLSX e CSV. Para importar todas as abas, prefira o modelo XLSX.</p></div></div><label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><Upload className="mr-2 h-4 w-4" />Selecionar arquivo<Input type="file" className="sr-only" accept=".xlsx,.xls,.csv" onChange={selectFile} /></label></div>{fileName && <p className="mt-5 border-t border-primary/15 pt-4 text-sm text-foreground"><strong>Arquivo:</strong> {fileName}</p>}</section>
    {fileName && <section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-lg font-semibold text-foreground">Validação antes da gravação</h2><p className="mt-1 text-sm text-muted-foreground">{issues.length ? "A planilha precisa de ajustes antes da confirmação." : "A estrutura está pronta para importação."}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground">{totalRows} linha{totalRows === 1 ? "" : "s"} identificada{totalRows === 1 ? "" : "s"}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-4">{[["Empresas", rows.providers.length], ["Regionais", rows.regionals.length], ["Cidades", rows.cities.length], ["Lojas", rows.stores.length]].map(([label, count]) => <article key={String(label)} className="rounded-xl bg-secondary p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold text-foreground">{count}</p></article>)}</div>{issues.length ? <div className="mt-5 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"><div className="flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4" />Pendências encontradas</div><ul className="mt-2 list-disc space-y-1 pl-5">{issues.slice(0, 8).map(issue => <li key={issue}>{issue}</li>)}</ul>{issues.length > 8 && <p className="mt-2">E mais {issues.length - 8} pendência(s).</p>}</div> : <div className="mt-5 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2 text-sm font-medium text-primary"><CheckCircle2 className="h-4 w-4" />Validação concluída. A importação criará somente registros ainda inexistentes.</span><Button onClick={() => setConfirmOpen(true)} disabled={!totalRows}>Confirmar importação</Button></div>}</section>}
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><h2 className="font-display text-lg font-semibold text-foreground">Como preencher o modelo</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><p className="text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Ordem de referência:</strong> Empresas → Regionais → Cidades → Lojas. Em Regionais, use <code>providerName</code> igual ao nome da Empresa. Em Cidades e Lojas, use o <code>regionalCode</code> definido na aba Regionais.</p><p className="text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Duplicidades:</strong> Empresas pelo nome, Regionais pelo código, Cidades pela Regional + nome e Lojas pelo código são preservadas e contabilizadas como registros ignorados.</p></div></section>
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}><DialogContent><DialogHeader><DialogTitle>Confirmar importação</DialogTitle><DialogDescription>Os dados validados serão gravados em lote. Registros repetidos não serão alterados.</DialogDescription></DialogHeader><p className="rounded-xl bg-secondary p-4 text-sm text-foreground">Serão analisadas {totalRows} linhas. As relações territoriais serão conferidas novamente no servidor.</p><DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button><Button onClick={() => importRows.mutate(rows)} disabled={importRows.isPending}>{importRows.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importar dados</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
