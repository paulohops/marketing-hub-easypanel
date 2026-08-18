import { afterEach, describe, expect, it } from "vitest";
import { loadMapScript, resetMapLoaderForTests } from "./Map";

describe("loadMapScript", () => {
  afterEach(() => {
    (window as { google?: typeof google }).google = undefined;
    resetMapLoaderForTests();
  });

  it("usa a chave configurada na URL oficial do Google Maps", () => {
    loadMapScript("browser-key");

    const script = document.querySelector<HTMLScriptElement>('script[data-hub-trade-google-maps="true"]');
    expect(script?.src).toContain("https://maps.googleapis.com/maps/api/js");
    expect(script?.src).toContain("key=browser-key");
  });

  it("reutiliza a mesma promessa e injeta somente um script", async () => {
    const firstLoad = loadMapScript();
    const secondLoad = loadMapScript();

    expect(secondLoad).toBe(firstLoad);
    const scripts = document.querySelectorAll('script[data-hub-trade-google-maps="true"]');
    expect(scripts).toHaveLength(1);

    window.google = { maps: {} } as typeof google;
    scripts[0]?.dispatchEvent(new Event("load"));
    await expect(firstLoad).resolves.toBeUndefined();
  });
});
