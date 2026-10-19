import { describe, expect, it } from "vitest";
import { hashMcpToken } from "./tokens";
import { handleMcpJsonRpc } from "./handler";
import { mcpTools } from "./tools";
import type { User } from "../../drizzle/schema";

const mockUser: User = {
  id: 1,
  openId: "test-user-openid",
  name: "Administrador Teste",
  email: "admin@empresa.com",
  phone: "31999999999",
  avatarStorageKey: null,
  avatarUrl: null,
  loginMethod: "local",
  jobTitle: "Administrador",
  managerUserId: null,
  passwordHash: "hash",
  passwordUpdatedAt: new Date(),
  isActive: true,
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
  mustChangePassword: false,
  authCodeHash: null,
  authCodePurpose: null,
  authCodeExpiresAt: null,
};

describe("MCP Protocol Handler & Tools", () => {
  it("hashMcpToken gera hash sha256 consistente", () => {
    const hash1 = hashMcpToken("mcp_hub_1234567890abcdef");
    const hash2 = hashMcpToken("mcp_hub_1234567890abcdef");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("responde ao método initialize com protocolo e capabilities válidos", async () => {
    const res = await handleMcpJsonRpc(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { clientInfo: { name: "test-client" } },
      },
      mockUser
    );

    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe(1);
    expect(res.result.serverInfo.name).toBe("marketing-hub-mcp");
    expect(res.result.capabilities.tools).toBeDefined();
  });

  it("responde ao método tools/list listando todas as ferramentas disponíveis", async () => {
    const res = await handleMcpJsonRpc(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      },
      mockUser
    );

    expect(res.jsonrpc).toBe("2.0");
    expect(res.id).toBe(2);
    expect(Array.isArray(res.result.tools)).toBe(true);

    const toolNames = res.result.tools.map((t: any) => t.name);
    expect(toolNames).toContain("mcp_status");
    expect(toolNames).toContain("consultar_territorio");
    expect(toolNames).toContain("listar_campanhas");
    expect(toolNames).toContain("criar_campanha");
    expect(toolNames).toContain("listar_acoes");
    expect(toolNames).toContain("criar_acao");
    expect(toolNames).toContain("preencher_dados_trade_lote");
    expect(toolNames).toContain("obter_indicadores_trade");
  });

  it("executa a ferramenta mcp_status via tools/call", async () => {
    const res = await handleMcpJsonRpc(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "mcp_status",
          arguments: {},
        },
      },
      mockUser
    );

    expect(res.id).toBe(3);
    expect(res.result.content).toBeDefined();
    expect(res.result.content[0].type).toBe("text");

    const parsed = JSON.parse(res.result.content[0].text);
    expect(parsed.status).toBe("online");
    expect(parsed.user.name).toBe("Administrador Teste");
    expect(parsed.service).toBe("marketing-hub-mcp");
  });

  it("retorna erro amigável ao tentar chamar uma ferramenta inexistente", async () => {
    const res = await handleMcpJsonRpc(
      {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "ferramenta_que_nao_existe",
          arguments: {},
        },
      },
      mockUser
    );

    expect(res.error).toBeDefined();
    expect(res.error.code).toBe(-32601);
  });

  it("expõe ferramentas criar_campanha e atualizar_status_acao com schemas válidos", () => {
    const criarCampanha = mcpTools.find(t => t.name === "criar_campanha");
    expect(criarCampanha).toBeDefined();
    expect(criarCampanha?.inputSchema.required).toContain("name");

    const atualizarStatus = mcpTools.find(t => t.name === "atualizar_status_acao");
    expect(atualizarStatus).toBeDefined();
    expect(atualizarStatus?.inputSchema.required).toEqual(["actionId", "status"]);
  });
});
