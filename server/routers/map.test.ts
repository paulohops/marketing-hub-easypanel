import { describe, expect, it } from "vitest";
import { resolveActionCoordinates } from "./map";

describe("resolveActionCoordinates", () => {
  it("prioriza as coordenadas registradas diretamente na Ação", () => {
    expect(resolveActionCoordinates({
      action: { latitude: "-19.921", longitude: "-43.938" },
      actionPoint: { latitude: "-20.000", longitude: "-44.000" },
      cityLatitude: "-18.000",
      cityLongitude: "-42.000",
    })).toEqual({ latitude: -19.921, longitude: -43.938 });
  });

  it("usa ponto comercial e, na ausência dele, as coordenadas da cidade", () => {
    expect(resolveActionCoordinates({
      action: { latitude: null, longitude: null },
      actionPoint: { latitude: "-19.930", longitude: "-43.940" },
      cityLatitude: "-18.000",
      cityLongitude: "-42.000",
    })).toEqual({ latitude: -19.93, longitude: -43.94 });

    expect(resolveActionCoordinates({
      action: { latitude: null, longitude: null },
      actionPoint: null,
      cityLatitude: "-18.501",
      cityLongitude: "-41.992",
    })).toEqual({ latitude: -18.501, longitude: -41.992 });
  });
});
