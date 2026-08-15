import type { Express } from "express";

/**
 * OAuth institucional pertence à instalação Manus original e não faz parte
 * da edição standalone. A rota é mantida apenas para responder claramente a
 * links antigos, sem tentar contactar qualquer serviço externo.
 */
export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", (_req, res) => {
    res.status(410).json({
      error: "OAuth institucional desativado nesta instalação.",
      hint: "Use o login local com e-mail e senha.",
    });
  });
}
