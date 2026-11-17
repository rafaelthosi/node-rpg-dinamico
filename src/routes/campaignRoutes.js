import { Router } from "express";
import { asyncRoute } from "./asyncRoute.js";

export function createCampaignRoutes(service) {
  const router = Router();
  const actor = (request) => request.user;

  router.get("/", asyncRoute(async (request, response) => {
    response.json(await service.list(actor(request)));
  }));
  router.post("/", asyncRoute(async (request, response) => {
    response.status(201).json(await service.create(actor(request), request.body ?? {}));
  }));
  router.get("/:campaignId", asyncRoute(async (request, response) => {
    response.json(await service.get(actor(request), request.params.campaignId));
  }));
  router.patch("/:campaignId", asyncRoute(async (request, response) => {
    response.json(await service.update(
      actor(request), request.params.campaignId, request.body ?? {},
    ));
  }));
  router.delete("/:campaignId", asyncRoute(async (request, response) => {
    response.json(await service.delete(actor(request), request.params.campaignId));
  }));
  return router;
}
