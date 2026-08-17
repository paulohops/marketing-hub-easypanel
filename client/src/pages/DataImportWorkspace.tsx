import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { IMPORT_MODULES, getImportModuleDefinition, normalizeImportHeader, type ImportModuleId } from "@shared/import-modules";
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { type ChangeEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type ImportRow = Record<string, string>;

type ModulePreview = {
  moduleId: ImportModuleId;
  rows: ImportRow[];
  issues: string[];
  fileName: string;
};

type LegacyImportRows = {
  providers: Array<{ name: string; legalName?: string; billingCnpj?: string; contactName?: string; phone?: string; email?: string; address?: string }>;
  regionals: Array<{ providerName?: string; name: string; code: string }>;
  cities: Array<{ regionalCode: string; name: string; state: string; ibgeCode?: string; address?: string; zipCode?: string; latitude?: number; longitude?: number; locationNotes?: string }>;
  stores: Array<{ regionalCode: string; cityName: string; name: string; code: string; address?: string }>;
};

function text(value: unknown) { return String(value ?? "").trim(); }
function optional(value: unknown) { const parsed = text(value); return parsed || undefined; }
function numberOrUndefined(value: unknown) { const parsed = text(value).replace(",", "."); return parsed ? Number(parsed) : undefined; }
function safeFileName(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase(); }

function readModuleRows(workbook: XLSX.WorkBook, moduleId: ImportModuleId): ImportRow[] {
  const definition = getImportModuleDefinition(moduleId);
  if (!definition) return [];
  const sheetName = workbook.SheetNames.includes(definition.sheetName) ? definition.sheetName : workbook.SheetNames[0];
  if (!sheetName || !workbook.Sheets[sheetName]) return [];
  const sourceRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" });
  return sourceRows.map(sourceRow => {
    const normalizedKeys = Object.keys(sourceRow).reduce<Record<string, string>>((result, key) => {
      result[normalizeImportHeader(key)] = key;
      return result;
    }, {});
    return definition.columns.reduce<ImportRow>((result, column) => {
      const sourceKey = normalizedKeys[normalizeImportHeader(column.label)] ?? normalizedKeys[normalizeImportHeader(column.key)] ?? column.key;
      result[column.key] = text(sourceRow[sourceKey]);
      return result;
    }, {});
  });
}

export function parseModuleWorkbook(workbook: XLSX.WorkBook, moduleId: ImportModuleId) {
  return readModuleRows(workbook, moduleId);
}

export function validateModuleRows(moduleId: ImportModuleId, rows: ImportRow[]) {
  const definition = getImportModuleDefinition(moduleId);
  if (!definition) return ["Módulo de importação não reconhecido."];
  const issues: string[] = [];
  if (!rows.length) issues.push(`${definition.label}: a planilha não possui linhas preenchidas.`);
  rows.forEach((row, index) => {
    definition.columns.filter(column => "required" in column && column.required).forEach(column => {
      if (!text(row[column.key])) issues.push(`${definition.label}: a linha ${index + 2} precisa de ${column.label}.`);
    });
    if (moduleId === "cities" && text(row.state).length !== 2) issues.push(`${definition.label}: a linha ${index + 2} precisa de uma UF com 2 letras.`);
    if (moduleId === "regionals" && text(row.code)) row.code = text(row.code).toUpperCase();
    if (moduleId === "stores" && text(row.code)) row.code = text(row.code).toUpperCase();
  });
  return issues;
}

export function parseOperationalWorkbook(workbook: XLSX.WorkBook): LegacyImportRows {
  const providers = parseModuleWorkbook(workbook, "providers");
  const regionals = parseModuleWorkbook(workbook, "regionals");
  const cities = parseModuleWorkbook(workbook, "cities");
  const stores = parseModuleWorkbook(workbook, "stores");
  return {
    providers: providers.map(row => ({ name: text(row.name), legalName: optional(row.legalName), billingCnpj: optional(row.billingCnpj), contactName: optional(row.contactName), phone: optional(row.phone), email: optional(row.email), address: optional(row.address) })),
    regionals: regionals.map(row => ({ providerName: optional(row.providerName), name: text(row.name), code: text(row.code).toUpperCase() })),
    cities: cities.map(row => ({ regionalCode: text(row.regionalCode).toUpperCase(), name: text(row.name), state: text(row.state).toUpperCase(), ibgeCode: optional(row.ibgeCode), address: optional(row.address), zipCode: optional(row.zipCode), latitude: numberOrUndefined(row.latitude), longitude: numberOrUndefined(row.longitude), locationNotes: optional(row.locationNotes) })),
    stores: stores.map(row => ({ regionalCode: text(row.regionalCode).toUpperCase(), cityName: text(row.cityName), name: text(row.name), code: text(row.code).toUpperCase(), address: optional(row.address) })),
  };
}

export function validateOperationalRows(rows: LegacyImportRows) {
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
  const [selectedModule, setSelectedModule] = useState<ImportModuleId>(IMPORT_MODULES[0].id);
  const [preview, setPreview] = useState<ModulePreview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const definition = getImportModuleDefinition(selectedModule)!;
  const importRows = trpc.settings.importRegistrySpreadsheet.useMutation({
    onSuccess: result => { toast.success(`Importação concluída: ${result.created} novos registros e ${result.skipped} já existentes.`); setConfirmOpen(false); setPreview(null); utils.settings.overview.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const totalRows = preview?.rows.length ?? 0;
  const selectedIssues = preview?.issues ?? [];
  const moduleCount = useMemo(() => IMPORT_MODULES.length, []);

  const downloadTemplate = (moduleId = selectedModule) => {
    const selected = getImportModuleDefinition(moduleId);
    if (!selected) return;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([selected.columns.map(column => column.label)]), selected.sheetName);
    XLSX.writeFile(workbook, `modelo-${safeFileName(selected.label)}.xlsx`);
  };

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = parseModuleWorkbook(workbook, selectedModule);
      const issues = validateModuleRows(selectedModule, rows);
      setPreview({ moduleId: selectedModule, rows, issues, fileName: file.name });
      if (issues.length) toast.error("Corrija os campos indicados antes de importar."); else toast.success("Planilha validada. Revise o resumo e confirme a gravação.");
    } catch {
      setPreview({ moduleId: selectedModule, rows: [], issues: ["Não foi possível ler esta planilha. Use XLSX ou CSV gerado a partir do modelo."], fileName: file.name });
    }
    event.target.value = "";
  };

  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Configurações · dados estruturados</p><h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-foreground">Importar cadastros por módulo</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Escolha um módulo, baixe sua planilha-modelo com os mesmos nomes dos campos dos formulários e importe os registros em lote. Cada planilha corresponde a um único módulo.</p></div><Button variant="outline" onClick={() => downloadTemplate()} className="border-primary/30 text-primary"><Download className="mr-2 h-4 w-4" />Baixar modelo de {definition.label}</Button></header>
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-lg font-semibold text-foreground">Módulos disponíveis</h2><p className="mt-1 text-sm text-muted-foreground">{moduleCount} módulos com modelos independentes de importação.</p></div><FileSpreadsheet className="h-5 w-5 text-primary" /></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{IMPORT_MODULES.map(module => <button type="button" key={module.id} onClick={() => { setSelectedModule(module.id); setPreview(null); }} className={`rounded-xl border p-4 text-left transition ${selectedModule === module.id ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background hover:border-primary/40"}`}><div className="flex items-center justify-between gap-2"><p className="font-semibold text-foreground">{module.label}</p>{selectedModule === module.id && <CheckCircle2 className="h-4 w-4 text-primary" />}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{module.description}</p><span className="mt-3 inline-flex text-xs font-semibold text-primary">Baixar modelo</span></button>)}</div></section>
    <section className="rounded-2xl border border-dashed border-primary/35 bg-primary/5 p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Upload className="h-5 w-5" /></span><div><h2 className="font-display text-lg font-semibold text-foreground">Importar {definition.label}</h2><p className="mt-1 text-sm text-muted-foreground">Formatos aceitos: XLSX e CSV. Use os cabeçalhos do modelo, sem substituir os nomes dos formulários.</p></div></div><label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"><Upload className="mr-2 h-4 w-4" />Selecionar planilha<Input type="file" className="sr-only" accept=".xlsx,.xls,.csv" onChange={selectFile} /></label></div>{preview?.fileName && <p className="mt-5 border-t border-primary/15 pt-4 text-sm text-foreground"><strong>Arquivo:</strong> {preview.fileName}</p>}</section>
    {preview && <section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-lg font-semibold text-foreground">Validação antes da gravação</h2><p className="mt-1 text-sm text-muted-foreground">{selectedIssues.length ? "A planilha precisa de ajustes antes da confirmação." : "A estrutura está pronta para importação."}</p></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground">{totalRows} linha{totalRows === 1 ? "" : "s"} identificada{totalRows === 1 ? "" : "s"}</span></div>{selectedIssues.length ? <div className="mt-5 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive"><div className="flex items-center gap-2 font-semibold"><AlertCircle className="h-4 w-4" />Pendências encontradas</div><ul className="mt-2 list-disc space-y-1 pl-5">{selectedIssues.slice(0, 10).map(issue => <li key={issue}>{issue}</li>)}</ul>{selectedIssues.length > 10 && <p className="mt-2">E mais {selectedIssues.length - 10} pendência(s).</p>}</div> : <div className="mt-5 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between"><span className="flex items-center gap-2 text-sm font-medium text-primary"><CheckCircle2 className="h-4 w-4" />Validação concluída. Registros repetidos serão ignorados.</span><Button onClick={() => setConfirmOpen(true)} disabled={!totalRows}>Confirmar importação</Button></div>}</section>}
    <section className="rounded-2xl border border-border bg-card p-6 shadow-sm"><h2 className="font-display text-lg font-semibold text-foreground">Como preencher</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><p className="text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Cabeçalhos:</strong> use os nomes apresentados no formulário, como “Nome”, “E-mail”, “Código da Regional” e “Tipo de mídia”. O sistema ignora diferenças de maiúsculas, minúsculas e acentuação.</p><p className="text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Referências:</strong> quando um campo relaciona outro cadastro, informe o nome ou código mostrado na própria planilha-modelo. A validação final das relações é feita no servidor antes da gravação.</p></div></section>
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}><DialogContent><DialogHeader><DialogTitle>Confirmar importação de {definition.label}</DialogTitle><DialogDescription>Os dados validados serão gravados em lote. Registros repetidos não serão alterados.</DialogDescription></DialogHeader><p className="rounded-xl bg-secondary p-4 text-sm text-foreground">Serão analisadas {totalRows} linhas. As relações serão conferidas novamente no servidor.</p><DialogFooter><Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button><Button onClick={() => preview && importRows.mutate({ module: preview.moduleId, rows: preview.rows })} disabled={importRows.isPending}>{importRows.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importar dados</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
