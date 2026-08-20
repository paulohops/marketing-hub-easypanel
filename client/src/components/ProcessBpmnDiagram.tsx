import { ArrowRight, GitBranch } from "lucide-react";

export type BpmnStep = {
  stepOrder: number;
  sectorName: string;
  stepType: "task" | "gateway";
  stepName: string;
  description?: string | null;
  gatewayQuestion?: string | null;
  yesNextStepOrder?: number | null;
  noNextStepOrder?: number | null;
};

const laneHeight = 132;
const nodeWidth = 174;
const nodeHeight = 58;
const columnGap = 54;
const leftLabelWidth = 178;
const rightPadding = 96;

type ConnectorPoint = { x: number; y: number };

type ShapeBounds = { left: number; right: number };

function truncate(value: string, max = 28) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export default function ProcessBpmnDiagram({ steps }: { steps: BpmnStep[] }) {
  const ordered = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
  const sectors = Array.from(new Set(ordered.map(step => step.sectorName || "Setor não informado")));
  const sectorIndex = new Map(sectors.map((sector, index) => [sector, index]));
  const width = Math.max(920, leftLabelWidth + Math.max(ordered.length, 1) * (nodeWidth + columnGap) + rightPadding);
  const height = Math.max(190, sectors.length * laneHeight + 36);
  const stepPosition = (order: number) => {
    const index = ordered.findIndex(step => step.stepOrder === order);
    if (index < 0) return null;
    const step = ordered[index];
    const lane = sectorIndex.get(step.sectorName || "Setor não informado") ?? 0;
    return { x: leftLabelWidth + index * (nodeWidth + columnGap), y: lane * laneHeight + 38, centerY: lane * laneHeight + 38 + nodeHeight / 2 };
  };

  const shapeBounds = (position: NonNullable<ReturnType<typeof stepPosition>>, gateway: boolean): ShapeBounds => {
    const centerX = position.x + nodeWidth / 2;
    const halfWidth = gateway ? 24 : nodeWidth / 2;
    return { left: centerX - halfWidth, right: centerX + halfWidth };
  };

  const orthogonalPath = (from: ConnectorPoint, target: NonNullable<ReturnType<typeof stepPosition>>, targetGateway: boolean) => {
    const targetBounds = shapeBounds(target, targetGateway);
    const targetIsToRight = target.x >= from.x;
    if (targetIsToRight) {
      const targetX = targetBounds.left - 8;
      if (Math.abs(targetX - from.x) < 8) return `M ${from.x} ${from.y} V ${target.centerY} H ${targetX}`;
      const viaX = from.x + Math.max(18, (targetX - from.x) / 2);
      return `M ${from.x} ${from.y} H ${viaX} V ${target.centerY} H ${targetX}`;
    }
    const targetX = targetBounds.right + 8;
    const viaX = Math.max(from.x, targetX) + 28;
    return `M ${from.x} ${from.y} H ${viaX} V ${target.centerY} H ${targetX}`;
  };

  if (!ordered.length) {
    return <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">Adicione passos ao descritivo para gerar o BPMN.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-secondary/10 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
        <GitBranch className="h-4 w-4 text-primary" />
        <span>Pool operacional gerado automaticamente a partir de Setor, Nome do passo e gateways.</span>
      </div>
      <svg role="img" aria-label="Modelo BPMN do processo" viewBox={`0 0 ${width} ${height}`} className="h-auto min-w-[920px] w-full">
        <defs>
          <marker id="bpmn-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="var(--primary)" />
          </marker>
        </defs>
        {sectors.map((sector, index) => (
          <g key={sector}>
            <rect x={0} y={index * laneHeight} width={width} height={laneHeight} fill={index % 2 ? "var(--secondary)" : "var(--card)"} fillOpacity={0.55} stroke="var(--border)" />
            <rect x={0} y={index * laneHeight} width={leftLabelWidth} height={laneHeight} fill="var(--primary)" fillOpacity={0.06} stroke="var(--border)" />
            <text x={16} y={index * laneHeight + 31} fill="var(--primary)" fontSize="10" fontWeight="700" letterSpacing="1.4">POOL / SETOR</text>
            <text x={16} y={index * laneHeight + 59} fill="var(--foreground)" fontSize="14" fontWeight="650">{truncate(sector, 22)}</text>
          </g>
        ))}
        <circle cx={leftLabelWidth - 22} cy={height / 2} r="8" fill="var(--primary)" />
        {ordered.map((step, index) => {
          const position = stepPosition(step.stepOrder)!;
          const next = ordered[index + 1];
          const nextPosition = next ? stepPosition(next.stepOrder) : null;
          const isGateway = step.stepType === "gateway";
          const diamondCenterX = position.x + nodeWidth / 2;
          const diamondCenterY = position.centerY;
          const diamond = `${diamondCenterX},${diamondCenterY - 24} ${diamondCenterX + 24},${diamondCenterY} ${diamondCenterX},${diamondCenterY + 24} ${diamondCenterX - 24},${diamondCenterY}`;
          const yesTarget = step.yesNextStepOrder ? stepPosition(step.yesNextStepOrder) : null;
          const noTarget = step.noNextStepOrder ? stepPosition(step.noNextStepOrder) : null;
          return (
            <g key={step.stepOrder}>
              {!isGateway && nextPosition ? <path d={orthogonalPath({ x: position.x + nodeWidth, y: position.centerY }, nextPosition, next?.stepType === "gateway")} fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinejoin="round" markerEnd="url(#bpmn-arrow)" /> : null}
              {isGateway && yesTarget ? <path d={orthogonalPath({ x: diamondCenterX + 24, y: diamondCenterY - 8 }, yesTarget, ordered.find(stepItem => stepItem.stepOrder === step.yesNextStepOrder)?.stepType === "gateway")} fill="none" stroke="var(--primary)" strokeWidth="1.8" strokeLinejoin="round" markerEnd="url(#bpmn-arrow)" /> : null}
              {isGateway && noTarget ? <path d={orthogonalPath({ x: diamondCenterX + 24, y: diamondCenterY + 8 }, noTarget, ordered.find(stepItem => stepItem.stepOrder === step.noNextStepOrder)?.stepType === "gateway")} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" markerEnd="url(#bpmn-arrow)" /> : null}
              {isGateway ? (
                <>
                  <polygon points={diamond} fill="var(--accent)" fillOpacity="0.16" stroke="var(--accent)" strokeWidth="2" />
                  <text x={diamondCenterX} y={diamondCenterY + 4} fill="var(--foreground)" textAnchor="middle" fontSize="16" fontWeight="700">×</text>
                  <text x={diamondCenterX} y={diamondCenterY - 38} fill="var(--foreground)" textAnchor="middle" fontSize="10" fontWeight="650">{truncate(step.gatewayQuestion || step.stepName, 24)}</text>
                  <text x={diamondCenterX + 34} y={diamondCenterY - 12} fill="var(--primary)" fontSize="10" fontWeight="700">Sim</text>
                  <text x={diamondCenterX + 34} y={diamondCenterY + 22} fill="var(--accent)" fontSize="10" fontWeight="700">Não</text>
                </>
              ) : (
                <>
                  <rect x={position.x} y={position.y} width={nodeWidth} height={nodeHeight} rx="10" fill="var(--card)" stroke="var(--primary)" strokeOpacity="0.42" />
                  <text x={position.x + 12} y={position.y + 20} fill="var(--primary)" fontSize="9" fontWeight="700" letterSpacing="1.2">ETAPA {String(step.stepOrder).padStart(2, "0")}</text>
                  <text x={position.x + 12} y={position.y + 42} fill="var(--foreground)" fontSize="12" fontWeight="650">{truncate(step.stepName)}</text>
                </>
              )}
              {index === ordered.length - 1 ? <circle cx={position.x + nodeWidth + 28} cy={position.centerY} r="8" fill="var(--accent)" /> : null}
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1.5"><ArrowRight className="h-3.5 w-3.5 text-primary" />Fluxo sequencial</span><span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rotate-45 border-2 border-accent" />Gateway de decisão</span><span>Sim segue o caminho principal; Não segue o desvio configurado.</span></div>
    </div>
  );
}
