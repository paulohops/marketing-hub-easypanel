import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { generateMcpToken, listUserMcpTokens, revokeMcpToken } from "../mcp/tokens";
import { protectedProcedure, router } from "../_core/trpc";

export const mcpTokensRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return listUserMcpTokens(ctx.user.id);
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(2, "Informe um nome para identificar o token.").max(100),
        expiresInDays: z.number().int().min(1).max(365).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const created = await generateMcpToken({
          userId: ctx.user.id,
          name: input.name,
          expiresInDays: input.expiresInDays ?? null,
        });

        return {
          success: true,
          token: created.token,
          prefix: created.tokenPrefix,
          name: created.name,
          expiresAt: created.expiresAt,
        };
      } catch (err: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err?.message || "Falha ao gerar o token MCP.",
        });
      }
    }),

  revoke: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const revoked = await revokeMcpToken(input.id, ctx.user.id);
      if (!revoked) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Token não encontrado ou já revogado.",
        });
      }
      return { success: true };
    }),
});
