import { useEffect, useState } from "react";

export type ListDensity = "comfortable" | "compact";

const storageKey = "marketing_hub_list_density";
const changeEvent = "marketing-hub:list-density-change";

function readDensity(): ListDensity {
  if (typeof window === "undefined") return "comfortable";
  return localStorage.getItem(storageKey) === "compact" ? "compact" : "comfortable";
}

export function useListDensity() {
  const [density, setDensityState] = useState<ListDensity>(readDensity);

  useEffect(() => {
    const sync = () => setDensityState(readDensity());
    window.addEventListener("storage", sync);
    window.addEventListener(changeEvent, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(changeEvent, sync);
    };
  }, []);

  const setDensity = (next: ListDensity) => {
    localStorage.setItem(storageKey, next);
    setDensityState(next);
    window.dispatchEvent(new Event(changeEvent));
  };

  return {
    density,
    compact: density === "compact",
    toggleDensity: () => setDensity(density === "compact" ? "comfortable" : "compact"),
  };
}
