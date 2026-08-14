import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("identificação pública da aplicação", () => {
  it("mantém o título configurado como Marketing HUB", async () => {
    const document = await readFile(new URL("../index.html", import.meta.url), "utf8");

    expect(document).toContain("<title>Marketing HUB — Cluster MG</title>");
  });
});
