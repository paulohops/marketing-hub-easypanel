import { describe, expect, it } from "vitest";
import { average } from "./analytics";

describe("analytics.average", () => {
  it("calcula a média apenas das avaliações válidas", () => {
    expect(average([5, null, 4, 2])).toBe(3.7);
  });

  it("retorna nulo quando não há avaliações", () => {
    expect(average([null, null])).toBeNull();
  });
});
