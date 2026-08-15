import { Button } from "@/components/ui/button";
import { useListDensity } from "@/hooks/useListDensity";
import { Rows3 } from "lucide-react";

export default function CompactListToggle() {
  const { compact, toggleDensity } = useListDensity();
  return (
    <Button
      type="button"
      variant={compact ? "secondary" : "outline"}
      onClick={toggleDensity}
      aria-pressed={compact}
      title={compact ? "Usar espaçamento confortável" : "Usar modo compacto"}
    >
      <Rows3 className="mr-2 h-4 w-4" />
      {compact ? "Compacto" : "Modo compacto"}
    </Button>
  );
}
