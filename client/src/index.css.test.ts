import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");

describe("tema escuro", () => {
  it("define superfícies escuras sem depender de branco e substitui variantes claras remanescentes", () => {
    expect(stylesheet).toContain(".dark {");
    expect(stylesheet).toMatch(/--background:\s*color-mix\(in srgb, var\(--app-primary/);
    expect(stylesheet).toMatch(/--card:\s*color-mix\(in srgb, var\(--app-primary/);
    expect(stylesheet).toMatch(/--popover:\s*color-mix\(in srgb, var\(--app-primary/);
    expect(stylesheet).toContain(".dark .bg-white");
    expect(stylesheet).toContain(".dark .bg-white\\/90");
    expect(stylesheet).toContain(".dark .hover\\:bg-white:hover");
  });
});
