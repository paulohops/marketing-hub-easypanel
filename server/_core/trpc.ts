import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

/**
 * Traduz erros de validação Zod para mensagens amigáveis em PT-BR.
 * O toast do cliente recebe `error.message`; sem este formatter o usuário
 * via JSON cru em inglês (ex.: "Too small: expected number to be >0").
 */
const ZOD_FIELD_LABELS: Record<string, string> = {
  regionalId: "regional",
  cityId: "cidade",
  supplierId: "fornecedor",
  providerId: "empresa",
  name: "nome",
  displayName: "nome de exibição",
  legalName: "razão social",
  cnpj: "CNPJ",
  phone: "telefone",
  email: "e-mail",
  startsOn: "início",
  endsOn: "término",
  quantity: "quantidade",
  unitPrice: "valor unitário",
  description: "descrição",
  title: "título",
};

function zodPathToLabel(path: (string | number)[] | undefined): string {
  const last = path?.filter(p => typeof p === "string").pop();
  if (!last) return "campo";
  return ZOD_FIELD_LABELS[last] ?? last.replace(/([A-Z])/g, " $1").toLowerCase();
}

function formatZodMessage(issue: {
  code?: string;
  path?: (string | number)[];
  message?: string;
  minimum?: number;
}): string {
  const label = zodPathToLabel(issue.path);
  switch (issue.code) {
    case "too_small": {
      const min = issue.minimum;
      return min && min > 1
        ? `Informe ao menos ${min} caracteres em ${label}.`
        : `Preencha o campo ${label}.`;
    }
    case "too_big":
      return `O campo ${label} excede o tamanho permitido.`;
    case "invalid_type":
      return `Informe um valor válido para ${label}.`;
    case "invalid_format":
      return `Formato inválido no campo ${label}.`;
    case "invalid_string":
      return `Formato inválido no campo ${label}.`;
    default:
      return issue.message && !issue.message.includes("expected")
        ? issue.message
        : `Verifique o campo ${label}.`;
  }
}

function isZodErrorShape(cause: unknown): cause is { issues: { code?: string; path?: (string | number)[]; message?: string; minimum?: number }[] } {
  return typeof cause === "object" && cause !== null && Array.isArray((cause as { issues?: unknown }).issues);
}

/** Formata um erro Zod (cause de TRPCError) para mensagem PT-BR, ou null se não for Zod. */
export function zodErrorToPtBrMessage(cause: unknown): string | null {
  if (!isZodErrorShape(cause) || cause.issues.length === 0) return null;
  return cause.issues
    .map(formatZodMessage)
    .filter((message, index, all) => all.indexOf(message) === index)
    .join(" ");
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    const message = zodErrorToPtBrMessage(error.cause);
    if (message) return { ...shape, message };
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
