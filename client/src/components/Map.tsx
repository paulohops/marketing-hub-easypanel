/// <reference types="@types/google.maps" />

import { useEffect, useRef, useState } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

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
let mapsLoaderUrl = "";

function mapScriptUrl(apiKey?: string) {
  const configuredKey = apiKey?.trim();
  if (configuredKey) return `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(configuredKey)}&v=weekly&libraries=marker,places,geocoding,geometry`;
  return `${MAPS_PROXY_URL}/maps/api/js?key=${encodeURIComponent(API_KEY || "")}&v=weekly&libraries=marker,places,geocoding,geometry`;
}

export function loadMapScript(apiKey?: string) {
  if (window.google?.maps) return Promise.resolve();
  const scriptUrl = mapScriptUrl(apiKey);
  if (mapsLoader && mapsLoaderUrl === scriptUrl) return mapsLoader;
  if (mapsLoaderUrl && mapsLoaderUrl !== scriptUrl) {
    document.querySelector<HTMLScriptElement>(MAP_SCRIPT_SELECTOR)?.remove();
    mapsLoader = null;
  }
  mapsLoaderUrl = scriptUrl;
  mapsLoader = new Promise<void>((resolve, reject) => {
    let timeoutId: number | undefined;
    const clearTimeoutIfNeeded = () => { if (timeoutId !== undefined) window.clearTimeout(timeoutId); };
    const handleLoad = () => { clearTimeoutIfNeeded(); resolve(); };
    const handleError = () => { clearTimeoutIfNeeded(); mapsLoader = null; mapsLoaderUrl = ""; reject(new Error("Não foi possível carregar a API do Google Maps.")); };
    const armTimeout = (target: HTMLScriptElement) => { timeoutId = window.setTimeout(() => { target.remove(); mapsLoader = null; mapsLoaderUrl = ""; reject(new Error("A API do Google Maps não respondeu a tempo.")); }, 10000); };
    const existing = document.querySelector<HTMLScriptElement>(MAP_SCRIPT_SELECTOR);
    if (existing) {
      if (existing.dataset.hubTradeGoogleMapsUrl !== scriptUrl) existing.remove();
      else { existing.addEventListener("load", handleLoad, { once: true }); existing.addEventListener("error", handleError, { once: true }); armTimeout(existing); return; }
    }
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.hubTradeGoogleMaps = "true";
    script.dataset.hubTradeGoogleMapsUrl = scriptUrl;
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    armTimeout(script);
    document.head.appendChild(script);
  });
  return mapsLoader;
}

export function resetMapLoaderForTests() { mapsLoader = null; mapsLoaderUrl = ""; document.querySelector(MAP_SCRIPT_SELECTOR)?.remove(); }

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}

export function MapView({ className, initialCenter = { lat: 37.7749, lng: -122.4194 }, initialZoom = 12, onMapReady }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const mapConfig = trpc.media.mapConfig.useQuery(undefined, { staleTime: 5 * 60 * 1000, retry: false });
  const [fallback, setFallback] = useState(false);
  const init = usePersistFn(async () => {
    try {
      setFallback(false);
      await loadMapScript(mapConfig.data?.apiKey);
      if (!mapContainer.current || !window.google?.maps) throw new Error("Mapa indisponível");
      map.current = new window.google.maps.Map(mapContainer.current, { zoom: initialZoom, center: initialCenter, mapTypeControl: true, fullscreenControl: true, zoomControl: true, streetViewControl: true, mapId: "DEMO_MAP_ID" });
      onMapReady?.(map.current);
    } catch (error) {
      console.warn("Google Maps indisponível; usando mapa alternativo.", error);
      setFallback(true);
    }
  });
  useEffect(() => { if (!mapConfig.isLoading) init(); }, [init, mapConfig.isLoading, mapConfig.data?.apiKey]);
  const bbox = `${initialCenter.lng - 0.01},${initialCenter.lat - 0.01},${initialCenter.lng + 0.01},${initialCenter.lat + 0.01}`;
  return fallback ? <div className={cn("relative w-full h-[500px] overflow-hidden bg-muted", className)}><iframe title="Mapa da localização" className="h-full w-full border-0" loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${initialCenter.lat},${initialCenter.lng}`} /><div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">Mapa alternativo</div></div> : <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />;
}
