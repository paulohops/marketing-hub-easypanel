import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Download, FileText, Loader2, Paperclip, Video, Volume2 } from "lucide-react";
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

export default function EvidenceUpload({ entityType, entityId, regionalId, canWrite = false, variant = "default", onUploadComplete }: { entityType: EntityType; entityId: number; regionalId?: number | null; canWrite?: boolean; variant?: "default" | "side"; onUploadComplete?: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();
  const documents = trpc.documents.listForEntity.useQuery({ entityType, entityId });
  const upload = trpc.documents.upload.useMutation({
    onSuccess: document => {
      toast.success("Evidência anexada com segurança.");
      onUploadComplete?.(document.url);
      utils.documents.listForEntity.invalidate({ entityType, entityId });
    },
    onError: error => toast.error(error.message),
  });
  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/wav", "audio/x-wav", "video/mp4", "video/webm"].includes(file.type)) { toast.error("Envie PDF, imagem, MP3, WAV, MP4 ou WEBM."); return; }
    if (file.size > 50 * 1024 * 1024) { toast.error("O arquivo deve ter no máximo 50 MB."); return; }
    try {
      upload.mutate({ entityType, entityId, regionalId: regionalId ?? null, originalName: file.name, mimeType: file.type as "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | "audio/mpeg" | "audio/wav" | "audio/x-wav" | "video/mp4" | "video/webm", dataBase64: await fileToBase64(file) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao preparar o arquivo.");
    }
  };
  const download = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Falha ao obter o arquivo.");
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1_000);
    } catch {
      toast.error("Não foi possível iniciar o download do arquivo.");
    }
  };
  const compact = variant === "side";
  return <div className={`mt-3 rounded-xl border border-border bg-secondary ${compact ? "p-3" : "px-3 py-2.5"}`}><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[11px] font-semibold text-foreground">Evidências, comprovantes e mídias</p><p className="mt-0.5 text-[10px] text-muted-foreground">PDF, imagens, áudio e vídeo de até 50 MB.</p></div>{canWrite && <><input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp,audio/mpeg,audio/wav,audio/x-wav,video/mp4,video/webm" onChange={handleFile} className="hidden" /><Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={upload.isPending} className="h-7 rounded-md border-border px-2 text-[10px] text-foreground">{upload.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Paperclip className="mr-1 h-3 w-3" />} Anexar</Button></>}</div>{documents.data?.length ? <div className={`mt-3 ${compact ? "grid gap-3" : "flex flex-wrap gap-2"}`}>{documents.data.map(document => <article key={document.id} className={`overflow-hidden rounded-lg border border-border bg-card ${compact ? "" : "max-w-[220px]"}`}>{document.mimeType.startsWith("image/") ? <img src={document.url} alt={document.originalName} className={`w-full bg-muted object-contain ${compact ? "max-h-44" : "h-28"}`} /> : document.mimeType.startsWith("video/") ? <video controls preload="metadata" className={`w-full bg-black/90 ${compact ? "max-h-44" : "h-28"}`}><source src={document.url} type={document.mimeType} /></video> : document.mimeType.startsWith("audio/") ? <div className="p-3"><p className="mb-2 flex items-center gap-1 text-xs font-medium text-foreground"><Volume2 className="h-3.5 w-3.5" /> Áudio</p><audio controls className="w-full"><source src={document.url} type={document.mimeType} /></audio></div> : document.mimeType === "application/pdf" && compact ? <iframe title={document.originalName} src={document.url} className="h-44 w-full bg-background" /> : <div className="flex items-center gap-2 p-3 text-xs font-medium text-foreground"><FileText className="h-4 w-4 text-primary" /> Documento anexado</div>}<div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5"><span className="min-w-0 truncate text-[10px] font-medium text-foreground">{document.mimeType.startsWith("video/") ? <Video className="mr-1 inline h-3 w-3" /> : null}{document.originalName}</span><Button type="button" variant="ghost" size="sm" onClick={() => void download(document.url, document.originalName)} className="h-7 shrink-0 px-2 text-[10px]"><Download className="mr-1 h-3 w-3" /> Baixar</Button></div></article>)}</div> : <p className="mt-2 text-[10px] text-foreground">Nenhum arquivo anexado.</p>}</div>;
}
