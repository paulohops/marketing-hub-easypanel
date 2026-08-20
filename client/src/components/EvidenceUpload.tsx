import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Download, ExternalLink, FileText, Loader2, Paperclip, Play, Video, Volume2 } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

type EntityType = "process" | "media_campaign" | "media_point" | "action" | "event" | "invoice" | "stock" | "regional_media";
type DocumentKind = "evidence" | "history_evidence" | "art" | "spot";
type UploadMimeType = "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | "audio/mpeg" | "audio/wav" | "audio/x-wav" | "audio/ogg" | "audio/mp4" | "video/mp4" | "video/webm";
type EvidenceVariant = "default" | "side" | "gallery" | "links";

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

function documentDescription(documentKind: DocumentKind) {
  if (documentKind === "art") return "PDF, PNG ou JPEG de até 50 MB.";
  if (documentKind === "spot") return "MP3, WAV, áudio compatível ou vídeo de até 50 MB.";
  if (documentKind === "history_evidence") return "Arquivos exclusivos do histórico; não serão exibidos no acervo geral.";
  return "PDF, imagens, áudio e vídeo de até 50 MB.";
}

export default function EvidenceUpload({
  entityType,
  entityId,
  regionalId,
  canWrite = false,
  variant = "default",
  documentKind = "evidence",
  title,
  onUploadComplete,
}: {
  entityType: EntityType;
  entityId: number;
  regionalId?: number | null;
  canWrite?: boolean;
  variant?: EvidenceVariant;
  documentKind?: DocumentKind;
  title?: string;
  onUploadComplete?: (document: { id: number; url: string }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const documents = trpc.documents.listForEntity.useQuery({ entityType, entityId });
  const upload = trpc.documents.upload.useMutation({
    onSuccess: document => {
      toast.success(entityType === "process" ? "Arquivo do processo anexado com segurança." : "Evidência anexada com segurança.");
      onUploadComplete?.({ id: document.id, url: document.url });
      void utils.documents.listForEntity.invalidate({ entityType, entityId });
    },
    onError: error => toast.error(error.message),
  });

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const acceptedTypes = documentKind === "art"
      ? ["application/pdf", "image/jpeg", "image/png", "image/webp"]
      : documentKind === "spot"
        ? ["audio/mpeg", "audio/wav", "audio/x-wav", "video/mp4", "video/webm"]
        : ["application/pdf", "image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4", "video/mp4", "video/webm"];
    if (!acceptedTypes.includes(file.type)) {
      toast.error(documentKind === "art" ? "Envie a arte em PDF, PNG ou JPEG." : documentKind === "spot" ? "Envie o spot em MP3, WAV, áudio compatível ou vídeo." : "Envie PDF, imagem, MP3, WAV, MP4 ou WEBM.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 50 MB.");
      return;
    }
    try {
      upload.mutate({ entityType, entityId, regionalId: regionalId ?? null, documentKind, originalName: file.name, mimeType: file.type as UploadMimeType, dataBase64: await fileToBase64(file) });
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
  const gallery = variant === "gallery";
  const links = variant === "links";
  const visibleDocuments = documents.data?.filter(document => documentKind === "evidence" ? !document.kind || document.kind === "evidence" : documentKind === "history_evidence" ? document.kind === "history_evidence" : documentKind === "art" ? document.kind === "art" : document.kind === "spot") ?? [];
  const selectedDocument = visibleDocuments.find(document => document.id === previewId) ?? null;

  return <div className={`mt-3 rounded-xl border border-border bg-secondary ${compact || gallery || links ? "p-3" : "px-3 py-2.5"}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-[11px] font-semibold text-foreground">{title ?? (documentKind === "art" ? "Arte da veiculação" : documentKind === "spot" ? "Spot da veiculação" : documentKind === "history_evidence" ? "Pasta de motivo e evidências" : "Evidências, comprovantes e mídias")}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{links ? "Os arquivos ficam disponíveis somente como links internos e abrem em nova guia." : documentDescription(documentKind)}</p></div>
      {canWrite && <><input ref={inputRef} type="file" accept={documentKind === "art" ? "application/pdf,image/jpeg,image/png,image/webp" : documentKind === "spot" ? "audio/mpeg,audio/wav,audio/x-wav,video/mp4,video/webm" : "application/pdf,image/jpeg,image/png,image/webp,audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/mp4,video/mp4,video/webm"} onChange={handleFile} className="hidden" /><Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={upload.isPending} className="h-7 rounded-md border-border px-2 text-[10px] text-foreground">{upload.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Paperclip className="mr-1 h-3 w-3" />} Anexar</Button></>}
    </div>
    {visibleDocuments.length ? links ? <div className="mt-3 grid gap-2">{visibleDocuments.map(document => <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><FileText className="h-4 w-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{document.originalName}</span><ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="sr-only">Abrir em nova guia</span></a>)}</div> : gallery ? <>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{visibleDocuments.map(document => <button key={document.id} type="button" onClick={() => setPreviewId(document.id)} className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-card text-left shadow-sm transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Abrir ${document.originalName}`}>{document.mimeType.startsWith("image/") ? <img src={document.url} alt={document.originalName} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.04]" /> : document.mimeType.startsWith("video/") ? <div className="grid h-full w-full place-items-center bg-black/90 text-white"><Video className="h-7 w-7" /><Play className="absolute h-4 w-4" /></div> : document.mimeType.startsWith("audio/") ? <div className="grid h-full w-full place-items-center bg-primary/10 text-primary"><Volume2 className="h-7 w-7" /></div> : <div className="grid h-full w-full place-items-center bg-muted text-primary"><FileText className="h-7 w-7" /></div>}<span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1.5 text-[10px] font-medium text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">{document.originalName}</span></button>)}</div>
      <Dialog open={Boolean(selectedDocument)} onOpenChange={open => { if (!open) setPreviewId(null); }}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto bg-card text-card-foreground"><DialogHeader><DialogTitle>{selectedDocument?.originalName}</DialogTitle><DialogDescription>Visualização do arquivo. O download fica disponível somente nesta etapa.</DialogDescription></DialogHeader>{selectedDocument ? <div className="overflow-hidden rounded-xl bg-muted/60">{selectedDocument.mimeType.startsWith("image/") ? <img src={selectedDocument.url} alt={selectedDocument.originalName} className="mx-auto max-h-[60vh] w-full object-contain" /> : selectedDocument.mimeType.startsWith("video/") ? <video controls className="max-h-[60vh] w-full bg-black"><source src={selectedDocument.url} type={selectedDocument.mimeType} /></video> : selectedDocument.mimeType.startsWith("audio/") ? <div className="p-6"><audio controls className="w-full"><source src={selectedDocument.url} type={selectedDocument.mimeType} /></audio></div> : <iframe title={selectedDocument.originalName} src={selectedDocument.url} className="h-[55vh] w-full bg-background" />}</div> : null}{selectedDocument ? <div className="flex justify-end"><Button type="button" onClick={() => void download(selectedDocument.url, selectedDocument.originalName)} className="bg-primary"><Download className="mr-1.5 h-4 w-4" />Baixar arquivo</Button></div> : null}</DialogContent></Dialog>
    </> : <div className={`mt-3 ${compact ? "grid gap-3" : "flex flex-wrap gap-2"}`}>{visibleDocuments.map(document => <article key={document.id} className={`overflow-hidden rounded-lg border border-border bg-card ${compact ? "" : "max-w-[220px]"}`}>{document.mimeType.startsWith("image/") ? <img src={document.url} alt={document.originalName} className={`w-full bg-muted object-contain ${compact ? "max-h-44" : "h-28"}`} /> : document.mimeType.startsWith("video/") ? <video controls preload="metadata" className={`w-full bg-black/90 ${compact ? "max-h-44" : "h-28"}`}><source src={document.url} type={document.mimeType} /></video> : document.mimeType.startsWith("audio/") ? <div className="p-3"><p className="mb-2 flex items-center gap-1 text-xs font-medium text-foreground"><Volume2 className="h-3.5 w-3.5" /> Áudio</p><audio controls className="w-full"><source src={document.url} type={document.mimeType} /></audio></div> : document.mimeType === "application/pdf" && compact ? <iframe title={document.originalName} src={document.url} className="h-44 w-full bg-background" /> : <div className="flex items-center gap-2 p-3 text-xs font-medium text-foreground"><FileText className="h-4 w-4 text-primary" /> Documento anexado</div>}<div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5"><span className="min-w-0 truncate text-[10px] font-medium text-foreground">{document.mimeType.startsWith("video/") ? <Video className="mr-1 inline h-3 w-3" /> : null}{document.originalName}</span><Button type="button" variant="ghost" size="sm" onClick={() => void download(document.url, document.originalName)} className="h-7 shrink-0 px-2 text-[10px]"><Download className="mr-1 h-3 w-3" /> Baixar</Button></div></article>)}</div> : <p className="mt-2 text-[10px] text-foreground">Nenhum arquivo anexado.</p>}
  </div>;
}
