import { Router } from "express";
import { asyncRoute } from "./asyncRoute.js";

export function createCampaignMemberRoutes(service) {
  const router = Router();
  const actor = (request) => request.user;

  router.post("/:campaignId/join", asyncRoute(async (request, response) => {
    response.status(201).json(await service.join(
      actor(request), request.params.campaignId, request.body?.password,
    ));
  }));
  router.get("/:campaignId/members", asyncRoute(async (request, response) => {
    response.json(await service.list(actor(request), request.params.campaignId));
  }));
  router.post("/:campaignId/members", asyncRoute(async (request, response) => {
    response.status(201).json(await service.add(
      actor(request), request.params.campaignId, request.body ?? {},
    ));
  }));
  router.patch("/:campaignId/members/:userId", asyncRoute(async (request, response) => {
    response.json(await service.update(
      actor(request), request.params.campaignId, request.params.userId, request.body ?? {},
    ));
  }));
  router.delete("/:campaignId/members/:userId", asyncRoute(async (request, response) => {
    response.json(await service.remove(
      actor(request), request.params.campaignId, request.params.userId,
    ));
  }));

  return router;
}
