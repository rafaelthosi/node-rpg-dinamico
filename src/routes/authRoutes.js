import { Router } from "express";
import rateLimit from "express-rate-limit";

export function createAuthRoutes(authService, userService) {
  const router = Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Muitas tentativas de login. Tente novamente mais tarde." },
  });

  router.post("/login", loginLimiter, async (request, response, next) => {
    const { username, password } = request.body ?? {};
    if (
      typeof username !== "string"
      || username.trim().length === 0
      || username.length > 50
      || typeof password !== "string"
      || password.length === 0
      || password.length > 200
    ) {
      response.status(400).json({ error: "Informe um usuário e uma senha válidos." });
      return;
    }

    try {
      const session = await authService.login(username, password);
      if (!session) {
        response.status(401).json({ error: "Usuário ou senha inválidos." });
        return;
      }
      response.json(session);
    } catch (error) {
      next(error);
    }
  });

  router.post("/register", async (request, response, next) => {
    try {
      const { username, password } = request.body ?? {};
      const user = await userService.registerPlayer({ username, password });
      const session = await authService.login(username, password);
      response.status(201).json({ ...session, user });
    } catch (error) {
      next(error);
    }
  });

  router.post("/register/gm", async (request, response, next) => {
    try {
      const { username, password } = request.body ?? {};
      const user = await userService.registerGM({ username, password });
      const session = await authService.login(username, password);
      response.status(201).json({ ...session, user });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
