import { describe, expect, it } from "vitest";
import { uniqueIds } from "./settings";

describe("uniqueIds", () => {
  it("remove vínculos repetidos antes da persistência N:N", () => {
    expect(uniqueIds([4, 2, 4, 9, 2])).toEqual([4, 2, 9]);
  });
});
