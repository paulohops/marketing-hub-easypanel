import { describe, expect, it } from "vitest";

describe("credenciais da API do Trello", () => {
  it("autenticam a consulta leve ao perfil da conta", async () => {
    const key = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;
    expect(key, "TRELLO_API_KEY deve estar configurada").toBeTruthy();
    expect(token, "TRELLO_TOKEN deve estar configurado").toBeTruthy();

    const response = await fetch(`https://api.trello.com/1/members/me?fields=id,fullName&key=${encodeURIComponent(key!)}&token=${encodeURIComponent(token!)}`);
    expect(response.status, "A API do Trello deve aceitar as credenciais configuradas").toBe(200);
    const account = await response.json() as { id?: string; fullName?: string };
    expect(account.id).toBeTruthy();
  }, 15_000);
});
