/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
  }
}

const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL = import.meta.env.VITE_FRONTEND_FORGE_API_URL || "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;
const MAP_SCRIPT_SELECTOR = 'script[data-hub-trade-google-maps="true"]';
let mapsLoader: Promise<void> | null = null;

export function loadMapScript() {
  if (window.google?.maps) return Promise.resolve();
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise<void>((resolve, reject) => {
    const handleLoad = () => resolve();
    const handleError = () => { mapsLoader = null; reject(new Error("Não foi possível carregar a API do Google Maps.")); };
    const existing = document.querySelector<HTMLScriptElement>(MAP_SCRIPT_SELECTOR);
    if (existing) { existing.addEventListener("load", handleLoad, { once: true }); existing.addEventListener("error", handleError, { once: true }); return; }
    const script = document.createElement("script");
    script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY || ""}&v=weekly&libraries=marker,places,geocoding,geometry`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.hubTradeGoogleMaps = "true";
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    document.head.appendChild(script);
  });
  return mapsLoader;
}

export function resetMapLoaderForTests() { mapsLoader = null; document.querySelector(MAP_SCRIPT_SELECTOR)?.remove(); }

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}

export function MapView({ className, initialCenter = { lat: 37.7749, lng: -122.4194 }, initialZoom = 12, onMapReady }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [fallback, setFallback] = useState(false);
  const init = usePersistFn(async () => {
    try {
      await loadMapScript();
      if (!mapContainer.current || !window.google?.maps) throw new Error("Mapa indisponível");
      map.current = new window.google.maps.Map(mapContainer.current, { zoom: initialZoom, center: initialCenter, mapTypeControl: true, fullscreenControl: true, zoomControl: true, streetViewControl: true, mapId: "DEMO_MAP_ID" });
      onMapReady?.(map.current);
    } catch (error) {
      console.warn("Google Maps indisponível; usando mapa alternativo.", error);
      setFallback(true);
    }
  });
  useEffect(() => { init(); }, [init]);
  const bbox = `${initialCenter.lng - 0.01},${initialCenter.lat - 0.01},${initialCenter.lng + 0.01},${initialCenter.lat + 0.01}`;
  return fallback ? <div className={cn("relative w-full h-[500px] overflow-hidden bg-muted", className)}><iframe title="Mapa da localização" className="h-full w-full border-0" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${initialCenter.lat},${initialCenter.lng}`} /><div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">Mapa alternativo</div></div> : <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />;
}
