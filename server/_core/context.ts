import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk, type AuthenticatedUser } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const authenticated = await sdk.authenticateRequest(opts.req);
    // SEC-04: Se user.passwordUpdatedAt existir e o token foi emitido antes (payload.iat * 1000 < passwordUpdatedAt),
    // invalida a sessão pois a senha foi alterada após a emissão do JWT.
    if (authenticated) {
      const payloadIat = (authenticated as AuthenticatedUser).tokenPayload?.iat;
      if (
        authenticated.passwordUpdatedAt &&
        payloadIat !== undefined &&
        payloadIat * 1000 < authenticated.passwordUpdatedAt.getTime()
      ) {
        user = null;
      } else {
        user = authenticated;
      }
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
