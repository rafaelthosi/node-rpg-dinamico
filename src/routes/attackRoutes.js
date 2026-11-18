import { Router } from "express";
import { asyncRoute } from "./asyncRoute.js";

export function createAttackRoutes(service) {
  const router = Router();
  const actor = (request) => request.user;

  router.get("/characters/:characterId/attacks", asyncRoute(async (request, response) => {
    response.json(await service.list(actor(request), request.params.characterId));
  }));
  router.post("/characters/:characterId/attacks", asyncRoute(async (request, response) => {
    response.status(201).json(await service.create(
      actor(request), request.params.characterId, request.body ?? {},
    ));
  }));
  router.patch("/attacks/:attackId", asyncRoute(async (request, response) => {
    response.json(await service.update(actor(request), request.params.attackId, request.body ?? {}));
  }));
  router.delete("/attacks/:attackId", asyncRoute(async (request, response) => {
    response.json(await service.delete(actor(request), request.params.attackId));
  }));
  return router;
}
