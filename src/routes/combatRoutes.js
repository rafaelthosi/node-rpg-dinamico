import { Router } from "express";
import { asyncRoute } from "./asyncRoute.js";

export function createCombatRoutes(service) {
  const router = Router();
  const actor = (request) => request.user;

  router.get("/campaigns/:campaignId/combats", asyncRoute(async (request, response) => {
    response.json(await service.list(actor(request), request.params.campaignId));
  }));
  router.post("/campaigns/:campaignId/combats", asyncRoute(async (request, response) => {
    response.status(201).json(await service.create(
      actor(request), request.params.campaignId, request.body ?? {},
    ));
  }));
  router.get("/combats/:combatId", asyncRoute(async (request, response) => {
    response.json(await service.get(actor(request), request.params.combatId));
  }));
  router.post("/combats/:combatId/participants", asyncRoute(async (request, response) => {
    response.status(201).json(await service.addParticipant(
      actor(request), request.params.combatId, request.body ?? {},
    ));
  }));
  router.patch("/combats/:combatId/grid", asyncRoute(async (request, response) => {
    response.json(await service.setGridSize(
      actor(request), request.params.combatId, request.body ?? {},
    ));
  }));
  router.post("/combats/:combatId/actions", asyncRoute(async (request, response) => {
    response.status(201).json(await service.addAction(
      actor(request), request.params.combatId, request.body ?? {},
    ));
  }));
  router.post("/combats/:combatId/advance", asyncRoute(async (request, response) => {
    response.json(await service.advanceTurn(actor(request), request.params.combatId));
  }));
  router.patch("/combats/:combatId", asyncRoute(async (request, response) => {
    response.json(await service.setActive(
      actor(request), request.params.combatId, request.body?.active,
    ));
  }));
  router.delete("/combats/:combatId", asyncRoute(async (request, response) => {
    response.json(await service.delete(actor(request), request.params.combatId));
  }));
  return router;
}
