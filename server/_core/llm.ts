import { ENV } from "./env";

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type JsonSchemaResponseFormat = {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: true;
    schema: Record<string, unknown>;
  };
};

type InvokeLLMInput = {
  model: string;
  messages: LLMMessage[];
  responseFormat?: JsonSchemaResponseFormat;
  maxCompletionTokens?: number;
};

type LLMResponsePayload = {
  model?: unknown;
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
  };
};

export type LLMResult = {
  model: string;
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
};

function getCompletionsEndpoint() {
  const configuredUrl = ENV.builtInForgeApiUrl.replace(/\/+$/, "");
  if (configuredUrl.endsWith("/chat/completions")) return configuredUrl;
  if (configuredUrl.endsWith("/v1")) return `${configuredUrl}/chat/completions`;
  return `${configuredUrl}/v1/chat/completions`;
}

function parseResponsePayload(value: unknown): LLMResponsePayload {
  if (!value || typeof value !== "object") return {};
  const payload = value as Record<string, unknown>;
  const choices = Array.isArray(payload.choices)
    ? payload.choices.filter((choice): choice is { message?: { content?: unknown } } => Boolean(choice && typeof choice === "object"))
    : undefined;
  const usage = payload.usage && typeof payload.usage === "object" ? payload.usage as LLMResponsePayload["usage"] : undefined;
  return {
    model: payload.model,
    choices,
    usage,
  };
}

export async function invokeLLM(input: InvokeLLMInput): Promise<LLMResult> {
  if (!ENV.builtInForgeApiUrl || !ENV.builtInForgeApiKey) {
    throw new Error("Proxy LLM não configurado no servidor.");
  }

  const response = await fetch(getCompletionsEndpoint(), {
    method: "POST",
    headers: {
      authorization: `Bearer ${ENV.builtInForgeApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
      ...(input.maxCompletionTokens ? { max_completion_tokens: input.maxCompletionTokens } : {}),
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Proxy LLM respondeu HTTP ${response.status}.`);
  }

  const payload = parseResponsePayload(await response.json() as unknown);
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Proxy LLM retornou uma resposta sem conteúdo.");
  }

  const promptTokens = typeof payload.usage?.prompt_tokens === "number" ? payload.usage.prompt_tokens : undefined;
  const completionTokens = typeof payload.usage?.completion_tokens === "number" ? payload.usage.completion_tokens : undefined;
  return {
    model: typeof payload.model === "string" ? payload.model : input.model,
    content,
    usage: promptTokens === undefined && completionTokens === undefined ? undefined : { promptTokens, completionTokens },
  };
}
