import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { FileText, Loader2, Paperclip } from "lucide-react";
import { ChangeEvent, useRef } from "react";
import { toast } from "sonner";

type EntityType = "media_campaign" | "action" | "event" | "invoice" | "stock" | "regional_media";

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

export default function EvidenceUpload({ entityType, entityId, regionalId, canWrite = false }: { entityType: EntityType; entityId: number; regionalId?: number | null; canWrite?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const documents = trpc.documents.listForEntity.useQuery({ entityType, entityId });
  const upload = trpc.documents.upload.useMutation({ onSuccess: () => { toast.success("Evidência anexada com segurança."); utils.documents.listForEntity.invalidate({ entityType, entityId }); }, onError: error => toast.error(error.message) });
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("Envie PDF, JPG, PNG ou WEBP."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("O arquivo deve ter no máximo 5 MB."); return; }
    try { upload.mutate({ entityType, entityId, regionalId: regionalId ?? null, originalName: file.name, mimeType: file.type as "application/pdf" | "image/jpeg" | "image/png" | "image/webp", dataBase64: await fileToBase64(file) }); } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao preparar o arquivo."); }
  };
  return <div className="mt-3 rounded-xl border border-border bg-secondary px-3 py-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] font-semibold text-foreground">Evidências e comprovantes</p>{canWrite && <><input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleFile} className="hidden" /><Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={upload.isPending} className="h-7 rounded-md border-border px-2 text-[10px] text-foreground">{upload.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Paperclip className="mr-1 h-3 w-3" />} Anexar</Button></>}</div>{documents.data?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{documents.data.map(document => <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="inline-flex max-w-[220px] items-center gap-1 rounded-md bg-secondary px-2 py-1 text-[10px] text-foreground hover:bg-primary/90"><FileText className="h-3 w-3 shrink-0" /><span className="truncate">{document.originalName}</span></a>)}</div> : <p className="mt-1 text-[10px] text-foreground">Nenhum arquivo anexado.</p>}</div>;
}
