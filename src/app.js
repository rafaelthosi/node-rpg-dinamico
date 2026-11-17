import cors from "cors";
import express from "express";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { createAuthRoutes } from "./routes/authRoutes.js";
import { createRpgRoutes } from "./routes/index.js";
import { RpgServiceError } from "./services/rpgService.js";

export function createApp({ authService, rpgService, jwtSecret, corsOrigin }) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: "10kb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });
  app.use("/api/auth", createAuthRoutes(authService, rpgService.users));

  app.use("/api", (request, response, next) => {
    const authorization = request.get("authorization") ?? "";
    const [scheme, token] = authorization.split(" ");
    if (scheme !== "Bearer" || !token) {
      response.status(401).json({ error: "Autenticação obrigatória." });
      return;
    }
    try {
      const claims = jwt.verify(token, jwtSecret);
      if (
        typeof claims !== "object"
        || typeof claims.sub !== "string"
        || !["gm", "player", "GM", "PLAYER"].includes(claims.role)
      ) {
        response.status(401).json({ error: "Token inválido." });
        return;
      }
      request.user = { id: claims.sub, role: claims.role };
      next();
    } catch {
      response.status(401).json({ error: "Token inválido ou expirado." });
    }
  });
  app.use("/api", createRpgRoutes(rpgService));

  app.use((error, _request, response, _next) => {
    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ error: "O corpo da requisição não contém JSON válido." });
      return;
    }

    const status = error instanceof RpgServiceError
      ? error.status
      : Number.isInteger(error.status) && error.status >= 400 && error.status < 500
      ? error.status
      : 500;
    if (status === 500) {
      console.error("Erro não tratado na API:", error);
    }
    response.status(status).json({
      error: status === 500
        ? "Erro interno do servidor."
        : error instanceof RpgServiceError
          ? error.message
          : "Requisição inválida.",
    });
  });

  return app;
}
