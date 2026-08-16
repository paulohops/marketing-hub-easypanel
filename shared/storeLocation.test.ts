import { describe, expect, it } from "vitest";
import { parseCoordinates } from "./location";
import { createDefaultStoreHours, parseStoreHours, serializeStoreHours } from "./storeHours";

describe("parseCoordinates", () => {
  it("separa latitude e longitude coladas em formato do Google Maps", () => {
    expect(parseCoordinates("-18.5921, -46.5142")).toEqual({ latitude: "-18.5921", longitude: "-46.5142" });
  });

  it("rejeita valores fora dos limites geográficos", () => {
    expect(parseCoordinates("120, -46.5142")).toBeNull();
  });
});

describe("store hours", () => {
  it("serializa somente os dias selecionados", () => {
    const hours = createDefaultStoreHours();
    hours.monday = { enabled: true, open: "08:00", close: "18:00" };
    const serialized = serializeStoreHours(hours);
    expect(parseStoreHours(serialized).monday).toEqual({ enabled: true, open: "08:00", close: "18:00" });
    expect(parseStoreHours(serialized).sunday.enabled).toBe(false);
  });

  it("mantém texto legado sem quebrar a leitura", () => {
    expect(parseStoreHours("Segunda a sexta, das 08:00 às 18:00").monday.enabled).toBe(false);
  });
});
