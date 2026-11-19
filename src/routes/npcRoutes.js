import { Router } from "express";
import { asyncRoute } from "./asyncRoute.js";

export function createNpcRoutes(service) {
  const router = Router();
  const actor = (request) => request.user;

  router.get("/campaigns/:campaignId/npcs", asyncRoute(async (request, response) => {
    response.json(await service.list(actor(request), request.params.campaignId));
  }));
  router.post("/campaigns/:campaignId/npcs", asyncRoute(async (request, response) => {
    response.status(201).json(await service.create(
      actor(request), request.params.campaignId, request.body ?? {},
    ));
  }));
  router.patch("/npcs/:npcId", asyncRoute(async (request, response) => {
    response.json(await service.update(actor(request), request.params.npcId, request.body ?? {}));
  }));
  router.delete("/npcs/:npcId", asyncRoute(async (request, response) => {
    response.json(await service.delete(actor(request), request.params.npcId));
  }));

  return router;
}
