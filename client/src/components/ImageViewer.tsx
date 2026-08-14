import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, ImageOff, Maximize2 } from "lucide-react";
import { type ReactNode } from "react";

type ImageViewerProps = {
  src?: string | null;
  alt: string;
  title?: string;
  className?: string;
  emptyLabel?: string;
  children?: ReactNode;
};

export default function ImageViewer({ src, alt, title = "Visualização da imagem", className = "", emptyLabel = "Sem foto", children }: ImageViewerProps) {
  if (!src) return <div className={`grid aspect-square w-20 shrink-0 place-items-center rounded-xl border border-dashed border-border bg-secondary p-2 text-center text-[10px] font-medium text-muted-foreground ${className}`} aria-label={emptyLabel}><span><ImageOff className="mx-auto mb-1 h-4 w-4" />{emptyLabel}</span></div>;

  return <Dialog>
    <DialogTrigger asChild>
      <span role="button" tabIndex={0} onClick={event => event.stopPropagation()} className={`group relative block aspect-square w-20 shrink-0 cursor-zoom-in overflow-hidden rounded-xl border border-border bg-secondary shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`} aria-label={`Ampliar ${alt}`}>
        {children ?? <img src={src} alt={alt} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.04]" />}
        <span className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 transition group-hover:opacity-100"><Maximize2 className="h-4 w-4" /></span>
      </span>
    </DialogTrigger>
    <DialogContent className="max-w-3xl border-border bg-card text-card-foreground">
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Imagem ampliada. Use o botão abaixo para baixar o arquivo original.</DialogDescription></DialogHeader>
      <div className="max-h-[62vh] overflow-hidden rounded-xl bg-secondary"><img src={src} alt={alt} className="mx-auto max-h-[62vh] w-full object-contain" /></div>
      <div className="flex justify-end"><Button asChild className="rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"><a href={src} download><Download className="mr-1.5 h-4 w-4" />Baixar imagem</a></Button></div>
    </DialogContent>
  </Dialog>;
}
