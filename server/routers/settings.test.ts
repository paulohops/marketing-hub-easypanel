import { describe, expect, it } from "vitest";
import { normalizeCnpj, uniqueIds } from "./settings";

describe("uniqueIds", () => {
  it("remove vínculos repetidos antes da persistência N:N", () => {
    expect(uniqueIds([4, 2, 4, 9, 2])).toEqual([4, 2, 9]);
  });
});

describe("normalizeCnpj", () => {
  it("remove a formatação e preserva os 14 dígitos do CNPJ", () => {
    expect(normalizeCnpj("12.345.678/0001-95")).toBe("12345678000195");
  });
});
