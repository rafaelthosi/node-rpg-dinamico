import { Router } from "express";
import { asyncRoute } from "./asyncRoute.js";

export function createCharacterRoutes(service) {
  const router = Router();
  const actor = (request) => request.user;

  router.get("/campaigns/:campaignId/characters", asyncRoute(async (request, response) => {
    response.json(await service.list(actor(request), request.params.campaignId));
  }));
  router.post("/campaigns/:campaignId/characters", asyncRoute(async (request, response) => {
    response.status(201).json(await service.create(
      actor(request), request.params.campaignId, request.body ?? {},
    ));
  }));
  router.patch("/characters/:characterId", asyncRoute(async (request, response) => {
    response.json(await service.update(
      actor(request), request.params.characterId, request.body ?? {},
    ));
  }));
  router.delete("/characters/:characterId", asyncRoute(async (request, response) => {
    response.json(await service.delete(actor(request), request.params.characterId));
  }));
  router.get("/characters/:characterId/values", asyncRoute(async (request, response) => {
    response.json(await service.listValues(actor(request), request.params.characterId));
  }));
  router.put("/characters/:characterId/values/:fieldId", asyncRoute(async (request, response) => {
    response.json(await service.setValue(
      actor(request), request.params.characterId, request.params.fieldId, request.body ?? {},
    ));
  }));
  router.delete("/characters/:characterId/values/:fieldId", asyncRoute(async (request, response) => {
    response.json(await service.deleteValue(
      actor(request), request.params.characterId, request.params.fieldId,
    ));
  }));

  return router;
}
