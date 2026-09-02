import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodErrorToPtBrMessage } from "./trpc";

describe("zodErrorToPtBrMessage", () => {
  it("traduz erros Zod para PT-BR (campos mapeados e genéricos)", () => {
    const schema = z.object({
      name: z.string().min(2),
      regionalId: z.number().min(1),
      phone: z.string().min(8),
      email: z.string().email(),
    });
    const result = schema.safeParse({ name: "", regionalId: 0, phone: "123", email: "x" });
    expect(result.success).toBe(false);

    const message = zodErrorToPtBrMessage(result.error);
    expect(message).not.toBeNull();
    expect(message).toContain("Informe ao menos 2 caracteres em nome");
    expect(message).toContain("Preencha o campo regional");
    expect(message).toContain("Informe ao menos 8 caracteres em telefone");
    expect(message).toContain("Formato inválido no campo e-mail");
  });

  it("não vaza JSON cru nem mensagens em inglês do Zod", () => {
    const schema = z.object({ regionalId: z.number().min(1) });
    const result = schema.safeParse({ regionalId: 0 });
    const message = zodErrorToPtBrMessage(result.error) ?? "";

    expect(message).not.toContain("Too small");
    expect(message).not.toContain("expected number");
    expect(message).not.toContain('"code"');
    expect(message).not.toContain('"origin"');
  });

  it("usa label genérico para campos desconhecidos", () => {
    const schema = z.object({ someWeirdField: z.string().min(5) });
    const result = schema.safeParse({ someWeirdField: "ab" });
    const message = zodErrorToPtBrMessage(result.error) ?? "";

    expect(message).toContain("some weird field");
    expect(message).toContain("Informe ao menos 5 caracteres");
  });

  it("retorna null para causas que não são Zod", () => {
    expect(zodErrorToPtBrMessage(undefined)).toBeNull();
    expect(zodErrorToPtBrMessage(null)).toBeNull();
    expect(zodErrorToPtBrMessage({ code: "SOMETHING" })).toBeNull();
    expect(zodErrorToPtBrMessage("texto")).toBeNull();
  });

  it("aceita payload válido sem gerar mensagem", () => {
    const schema = z.object({ name: z.string().min(2) });
    const result = schema.safeParse({ name: "OK" });
    expect(result.success).toBe(true);
    expect(zodErrorToPtBrMessage(result.error)).toBeNull();
  });
});
