import type { Express, Request, Response } from "express";
import type { User } from "../../drizzle/schema";
import { sdk } from "../_core/sdk";
import { verifyMcpToken } from "./tokens";
import { mcpTools } from "./tools";

async function authenticateMcpRequest(req: Request): Promise<User | null> {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const rawToken = authHeader.slice(7).trim();
    if (rawToken.startsWith("mcp_")) {
      return await verifyMcpToken(rawToken);
    }
  }

  try {
    return await sdk.authenticateRequest(req);
  } catch {
    return null;
  }
}

export async function handleMcpJsonRpc(
  body: any,
  user: User
): Promise<{ jsonrpc: "2.0"; id?: any; result?: any; error?: any }> {
  const { id, method, params } = body || {};

  if (!method || typeof method !== "string") {
    return {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code: -32600, message: "Requisição inválida: campo 'method' obrigatório." },
    };
  }

  // MCP: initialize
  if (method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: {
          name: "marketing-hub-mcp",
          version: "1.0.0",
        },
      },
    };
  }

  // MCP: notifications/initialized
  if (method === "notifications/initialized") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  // MCP: ping
  if (method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  // MCP: tools/list
  if (method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: mcpTools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      },
    };
  }

  // MCP: tools/call
  if (method === "tools/call") {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};

    const tool = mcpTools.find(t => t.name === toolName);
    if (!tool) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Ferramenta MCP '${toolName}' não encontrada no Marketing HUB.`,
        },
      };
    }

    try {
      const output = await tool.handler(toolArgs, user);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: typeof output === "string" ? output : JSON.stringify(output, null, 2),
            },
          ],
        },
      };
    } catch (err: any) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: `Erro ao executar ${toolName}: ${err?.message || String(err)}`,
            },
          ],
          isError: true,
        },
      };
    }
  }

  // Método desconhecido
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: `Método MCP '${method}' não suportado.`,
    },
  };
}

export function registerMcpEndpoint(app: Express) {
  // POST /api/mcp - Streamable HTTP JSON-RPC
  app.post("/api/mcp", async (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");

    const user = await authenticateMcpRequest(req);
    if (!user) {
      return res.status(401).json({
        jsonrpc: "2.0",
        id: req.body?.id ?? null,
        error: {
          code: -32000,
          message: "Autenticação MCP requerida. Forneça um cabeçalho 'Authorization: Bearer <mcp_token>'.",
        },
      });
    }

    // Suporta requisições únicas ou em batch
    if (Array.isArray(req.body)) {
      const responses = await Promise.all(req.body.map(item => handleMcpJsonRpc(item, user)));
      return res.json(responses);
    }

    const response = await handleMcpJsonRpc(req.body, user);
    return res.json(response);
  });

  // GET /api/mcp - SSE ou Status Info
  app.get("/api/mcp", async (req: Request, res: Response) => {
    const isSse = req.headers.accept?.includes("text/event-stream");

    if (isSse) {
      const user = await authenticateMcpRequest(req);
      if (!user) {
        return res.status(401).send("Unauthorized: forneça token MCP válido.");
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      res.write(`event: endpoint\ndata: /api/mcp\n\n`);

      const keepAlive = setInterval(() => {
        res.write(`: keepalive\n\n`);
      }, 15000);

      req.on("close", () => {
        clearInterval(keepAlive);
      });
      return;
    }

    // Retorno amigável para navegador ou checagem de status
    return res.json({
      status: "active",
      endpoint: "/api/mcp",
      transport: ["streamable-http", "sse"],
      toolsDisponiveis: mcpTools.map(t => ({
        nome: t.name,
        descricao: t.description,
      })),
      comoConectar: {
        header: "Authorization: Bearer <mcp_token>",
        exemploCursor: {
          url: "http://<host>:8978/api/mcp",
          headers: { Authorization: "Bearer mcp_hub_..." },
        },
      },
    });
  });
}
