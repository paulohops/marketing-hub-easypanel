import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type QuickCreateKind = "service" | "subservice" | "product" | "media";

type CreatedRecord = {
  id: number;
  name: string;
  unit?: string | null;
};

const metadata: Record<QuickCreateKind, { title: string; description: string; placeholder: string }> = {
  service: {
    title: "Novo serviço",
    description: "Cadastre o serviço sem interromper o preenchimento atual.",
    placeholder: "Ex.: Produção gráfica",
  },
  subservice: {
    title: "Novo subserviço",
    description: "Cadastre uma modalidade reutilizável para os serviços e mídias.",
    placeholder: "Ex.: Impressão em lona",
  },
  product: {
    title: "Novo produto ou material",
    description: "Cadastre o produto mestre para usar no estoque, financeiro e operações.",
    placeholder: "Ex.: Lona 440g",
  },
  media: {
    title: "Novo tipo de mídia",
    description: "Cadastre o tipo de mídia para continuar o formulário atual.",
    placeholder: "Ex.: Outdoor",
  },
};

export function InlineRegistryCreateDialog({
  kind,
  onCreated,
  triggerLabel = "Novo cadastro",
}: {
  kind: QuickCreateKind;
  onCreated?: (record: CreatedRecord) => void;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unit, setUnit] = useState("unidade");
  const utils = trpc.useUtils();
  const createType = trpc.settings.createType.useMutation({
    onSuccess: record => {
      const created = record as CreatedRecord;
      toast.success(`${metadata[kind].title} criado.`);
      void utils.settings.overview.invalidate();
      void utils.media.referenceData.invalidate();
      void utils.finance.financeDimensions.invalidate();
      setName("");
      setDescription("");
      setUnit("unidade");
      setOpen(false);
      onCreated?.(created);
    },
    onError: error => toast.error(error.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      toast.error("Informe um nome válido para o cadastro.");
      return;
    }

    createType.mutate({
      kind,
      name: trimmedName,
      description: description.trim() || undefined,
      ...(kind === "subservice" ? { unit: unit.trim() || "unidade", subserviceParentIds: [] } : {}),
      ...(kind === "media" ? { operationCategory: "graphics" as const } : {}),
    });
  };

  const details = metadata[kind];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0 px-2 text-xs text-primary">
          <Plus className="mr-1 h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{details.title}</DialogTitle>
          <DialogDescription>{details.description}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={submit}>
          <div className="grid gap-1.5">
            <Label htmlFor={`quick-create-${kind}-name`}>Nome</Label>
            <Input
              id={`quick-create-${kind}-name`}
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder={details.placeholder}
              autoFocus
              required
            />
          </div>
          {kind === "subservice" && (
            <div className="grid gap-1.5">
              <Label htmlFor="quick-create-subservice-unit">Unidade padrão</Label>
              <Input
                id="quick-create-subservice-unit"
                value={unit}
                onChange={event => setUnit(event.target.value)}
                placeholder="unidade, m², hora, milheiro..."
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor={`quick-create-${kind}-description`}>Descrição (opcional)</Label>
            <Input
              id={`quick-create-${kind}-description`}
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Detalhes para facilitar a identificação"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createType.isPending}>
              {createType.isPending && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
              Criar e selecionar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export type { CreatedRecord };
export default InlineRegistryCreateDialog;
