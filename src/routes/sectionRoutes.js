import { Router } from "express";
import { asyncRoute } from "./asyncRoute.js";

export function createSectionRoutes(service) {
  const router = Router();
  const actor = (request) => request.user;

  router.get("/campaigns/:campaignId/sections", asyncRoute(async (request, response) => {
    response.json(await service.list(actor(request), request.params.campaignId));
  }));
  router.post("/campaigns/:campaignId/sections", asyncRoute(async (request, response) => {
    response.status(201).json(await service.create(
      actor(request), request.params.campaignId, request.body ?? {},
    ));
  }));
  router.patch("/sections/:sectionId", asyncRoute(async (request, response) => {
    response.json(await service.update(
      actor(request), request.params.sectionId, request.body ?? {},
    ));
  }));
  router.delete("/sections/:sectionId", asyncRoute(async (request, response) => {
    response.json(await service.delete(actor(request), request.params.sectionId));
  }));

  return router;
}
