import { ArrowRight, GitBranch, Maximize2, Minus, Plus } from "lucide-react";
import { useMemo, useRef, useState } from "react";

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

const laneHeight = 148;
const nodeWidth = 188;
const nodeHeight = 64;
const columnGap = 88;
const leftLabelWidth = 178;
const firstNodeX = leftLabelWidth + 92;
const rightPadding = 112;
const startRadius = 12;
const endRadius = 12;

type ConnectorPoint = { x: number; y: number };
type StepPosition = { x: number; y: number; centerY: number };
type ShapeBounds = { left: number; right: number };
type Pan = { x: number; y: number };

function truncate(value: string, max = 28) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function orthogonalPath(
  from: ConnectorPoint,
  target: StepPosition,
  targetGateway: boolean,
  routeOffset = 0
) {
  const targetCenterX = target.x + nodeWidth / 2;
  const halfWidth = targetGateway ? 28 : nodeWidth / 2;
  const targetX = targetCenterX >= from.x ? targetCenterX - halfWidth - 12 : targetCenterX + halfWidth + 12;
  const toRight = targetX >= from.x;
  if (toRight) {
    const distance = Math.max(26, (targetX - from.x) / 2);
    const viaX = from.x + distance + routeOffset;
    return `M ${from.x} ${from.y} H ${viaX} V ${target.centerY} H ${targetX}`;
  }
  const viaX = Math.max(from.x + 34, targetX + 46) + routeOffset;
  return `M ${from.x} ${from.y} H ${viaX} V ${target.centerY} H ${targetX}`;
}

export default function ProcessBpmnDiagram({ steps }: { steps: BpmnStep[] }) {
  const ordered = useMemo(() => [...steps].sort((a, b) => a.stepOrder - b.stepOrder), [steps]);
  const sectors = useMemo(
    () => Array.from(new Set(ordered.map(step => step.sectorName || "Setor não informado"))),
    [ordered]
  );
  const sectorIndex = useMemo(
    () => new Map(sectors.map((sector, index) => [sector, index])),
    [sectors]
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const [selectedStep, setSelectedStep] = useState<BpmnStep | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; panX: number; panY: number } | null>(null);

  const width = Math.max(
    1120,
    firstNodeX + Math.max(ordered.length, 1) * nodeWidth + Math.max(ordered.length - 1, 0) * columnGap + rightPadding
  );
  const height = Math.max(210, sectors.length * laneHeight + 38);
  const stepPosition = (order: number): StepPosition | null => {
    const index = ordered.findIndex(step => step.stepOrder === order);
    if (index < 0) return null;
    const step = ordered[index];
    const lane = sectorIndex.get(step.sectorName || "Setor não informado") ?? 0;
    const x = firstNodeX + index * (nodeWidth + columnGap);
    const y = lane * laneHeight + 42;
    return { x, y, centerY: y + nodeHeight / 2 };
  };

  const clampZoom = (value: number) => Math.min(1.8, Math.max(0.65, Number(value.toFixed(2))));
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  if (!ordered.length) {
    return <div className="grid min-h-48 place-items-center rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">Adicione passos ao descritivo para gerar o BPMN.</div>;
  }

  const firstPosition = stepPosition(ordered[0].stepOrder)!;
  const lastPosition = stepPosition(ordered[ordered.length - 1].stepOrder)!;
  const startX = Math.max(startRadius + 24, firstPosition.x - 68);
  const endX = Math.min(width - endRadius - 24, lastPosition.x + nodeWidth + 68);
  const startY = firstPosition.centerY;
  const endY = lastPosition.centerY;

  return (
    <div className="rounded-xl border border-border bg-secondary/10 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <GitBranch className="h-4 w-4 text-primary" />
          <span>Pool operacional gerado automaticamente a partir de setor, passo e gateways.</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 shadow-sm" aria-label="Controles do BPMN">
          <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground" onClick={() => setZoom(value => clampZoom(value - 0.1))} aria-label="Reduzir zoom"><Minus className="h-4 w-4" /></button>
          <span className="min-w-12 text-center text-[11px] font-semibold text-muted-foreground">{Math.round(zoom * 100)}%</span>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground" onClick={() => setZoom(value => clampZoom(value + 0.1))} aria-label="Aumentar zoom"><Plus className="h-4 w-4" /></button>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground" onClick={resetView} aria-label="Restaurar visão"><Maximize2 className="h-4 w-4" /></button>
        </div>
      </div>

      <div
        className="relative max-h-[620px] min-h-[300px] touch-none cursor-grab overflow-auto rounded-lg border border-border bg-background/70 active:cursor-grabbing"
        onWheel={event => {
          if (!event.ctrlKey) return;
          event.preventDefault();
          setZoom(value => clampZoom(value + (event.deltaY > 0 ? -0.08 : 0.08)));
        }}
        onPointerDown={event => {
          if (event.button !== 0) return;
          const target = event.target;
          if (target instanceof Element && target.closest("[data-bpmn-step]")) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
        }}
        onPointerMove={event => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          setPan({ x: drag.panX + event.clientX - drag.startX, y: drag.panY + event.clientY - drag.startY });
        }}
        onPointerUp={event => {
          if (dragRef.current?.pointerId === event.pointerId) {
            dragRef.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        <svg role="img" aria-label="Modelo BPMN do processo" viewBox={`0 0 ${width} ${height}`} style={{ width: `${width}px`, minWidth: `${Math.max(width, 1120)}px`, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "top left" }} className="h-auto select-none">
          <defs>
            <marker id="bpmn-arrow-primary" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--primary)" /></marker>
            <marker id="bpmn-arrow-no" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#b45309" /></marker>
          </defs>
          {sectors.map((sector, index) => (
            <g key={sector}>
              <rect x={0} y={index * laneHeight} width={width} height={laneHeight} fill={index % 2 ? "var(--secondary)" : "var(--card)"} fillOpacity={0.55} stroke="var(--border)" />
              <rect x={0} y={index * laneHeight} width={leftLabelWidth} height={laneHeight} fill="var(--primary)" fillOpacity={0.06} stroke="var(--border)" />
              <text x={16} y={index * laneHeight + 31} fill="var(--primary)" fontSize="10" fontWeight="700" letterSpacing="1.4">POOL / SETOR</text>
              <text x={16} y={index * laneHeight + 59} fill="var(--foreground)" fontSize="14" fontWeight="650">{truncate(sector, 22)}</text>
            </g>
          ))}

          <path d={`M ${startX + startRadius} ${startY} H ${firstPosition.x - 12}`} fill="none" stroke="var(--primary)" strokeWidth="2" markerEnd="url(#bpmn-arrow-primary)" />
          <circle cx={startX} cy={startY} r={startRadius} fill="#16a34a" stroke="var(--card)" strokeWidth="3" />
          <text x={startX} y={startY + 30} textAnchor="middle" fill="var(--foreground)" fontSize="10" fontWeight="700">Início</text>

          {ordered.map((step, index) => {
            const position = stepPosition(step.stepOrder)!;
            const next = ordered[index + 1];
            const nextPosition = next ? stepPosition(next.stepOrder) : null;
            const isGateway = step.stepType === "gateway";
            const selected = selectedStep?.stepOrder === step.stepOrder;
            const diamondCenterX = position.x + nodeWidth / 2;
            const diamondCenterY = position.centerY;
            const diamond = `${diamondCenterX},${diamondCenterY - 28} ${diamondCenterX + 28},${diamondCenterY} ${diamondCenterX},${diamondCenterY + 28} ${diamondCenterX - 28},${diamondCenterY}`;
            const yesTarget = step.yesNextStepOrder ? stepPosition(step.yesNextStepOrder) : null;
            const noTarget = step.noNextStepOrder ? stepPosition(step.noNextStepOrder) : null;
            const yesStep = ordered.find(stepItem => stepItem.stepOrder === step.yesNextStepOrder);
            const noStep = ordered.find(stepItem => stepItem.stepOrder === step.noNextStepOrder);
            return (
              <g data-bpmn-step key={step.stepOrder} role="button" tabIndex={0} aria-label={`Abrir etapa ${step.stepName}`} onPointerDown={event => event.stopPropagation()} onClick={() => setSelectedStep(step)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") setSelectedStep(step); }} className="cursor-pointer">
                {!isGateway && nextPosition ? <path d={orthogonalPath({ x: position.x + nodeWidth, y: position.centerY }, nextPosition, next?.stepType === "gateway", (index % 3 - 1) * 16)} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" markerEnd="url(#bpmn-arrow-primary)" /> : null}
                {isGateway && yesTarget ? <path d={orthogonalPath({ x: diamondCenterX + 28, y: diamondCenterY - 12 }, yesTarget, yesStep?.stepType === "gateway", -10)} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" markerEnd="url(#bpmn-arrow-primary)" /> : null}
                {isGateway && noTarget ? <path d={orthogonalPath({ x: diamondCenterX + 28, y: diamondCenterY + 12 }, noTarget, noStep?.stepType === "gateway", 14)} fill="none" stroke="#b45309" strokeWidth="2" strokeLinejoin="round" markerEnd="url(#bpmn-arrow-no)" /> : null}
                {isGateway ? (
                  <>
                    <polygon points={diamond} fill="#facc15" fillOpacity="0.38" stroke="#111827" strokeWidth={selected ? "3" : "2.2"} />
                    <text x={diamondCenterX} y={diamondCenterY + 6} fill="#111827" textAnchor="middle" fontSize="18" fontWeight="800">×</text>
                    <text x={diamondCenterX} y={diamondCenterY - 42} fill="var(--foreground)" textAnchor="middle" fontSize="10" fontWeight="700">{truncate(step.gatewayQuestion || step.stepName, 25)}</text>
                    <text x={diamondCenterX + 38} y={diamondCenterY - 15} fill="var(--primary)" fontSize="10" fontWeight="800">Sim</text>
                    <text x={diamondCenterX + 38} y={diamondCenterY + 25} fill="#b45309" fontSize="10" fontWeight="800">Não</text>
                  </>
                ) : (
                  <>
                    <rect x={position.x} y={position.y} width={nodeWidth} height={nodeHeight} rx="10" fill="var(--card)" stroke={selected ? "var(--primary)" : "var(--primary)"} strokeOpacity={selected ? "1" : "0.48"} strokeWidth={selected ? "3" : "1.8"} />
                    <text x={position.x + 14} y={position.y + 22} fill="var(--primary)" fontSize="9" fontWeight="700" letterSpacing="1.2">ETAPA {String(step.stepOrder).padStart(2, "0")}</text>
                    <text x={position.x + 14} y={position.y + 47} fill="var(--foreground)" fontSize="12" fontWeight="650">{truncate(step.stepName)}</text>
                  </>
                )}
              </g>
            );
          })}

          <path d={`M ${lastPosition.x + nodeWidth + 12} ${endY} H ${endX - endRadius}`} fill="none" stroke="var(--primary)" strokeWidth="2" markerEnd="url(#bpmn-arrow-primary)" />
          <circle cx={endX} cy={endY} r={endRadius} fill="#dc2626" stroke="var(--card)" strokeWidth="3" />
          <text x={endX} y={endY + 30} textAnchor="middle" fill="var(--foreground)" fontSize="10" fontWeight="700">Fim</text>
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1.5"><ArrowRight className="h-3.5 w-3.5 text-primary" />Fluxo sequencial</span><span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rotate-45 border-2 border-[#111827] bg-[#facc15]" />Gateway de decisão</span><span>Arraste o quadro com o botão esquerdo. Para zoom, mantenha Ctrl pressionado enquanto rola o mouse.</span></div>
      {selectedStep ? <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">Etapa {String(selectedStep.stepOrder).padStart(2, "0")} · {selectedStep.sectorName || "Setor não informado"}</p><h3 className="mt-1 text-base font-semibold text-foreground">{selectedStep.stepName}</h3></div><button type="button" className="text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => setSelectedStep(null)}>Fechar</button></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{selectedStep.description || selectedStep.gatewayQuestion || "Este passo ainda não possui descrição."}</p></div> : <p className="mt-4 text-xs text-muted-foreground">Clique em uma etapa ou gateway para consultar o nome do passo e sua descrição.</p>}
    </div>
  );
}
