import MediaWorkspace from "./MediaWorkspace";

/**
 * Entrada dedicada de Mídia Tradicional.
 * O fluxo é o mesmo workspace operacional de mídias, fixado na categoria
 * audio_video para manter criação, filtros e veiculações no módulo correto.
 */
export default function TraditionalMediaWorkspace() {
  return <MediaWorkspace initialCategory="audio_video" />;
}
