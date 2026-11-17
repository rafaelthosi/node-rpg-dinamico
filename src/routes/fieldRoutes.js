import { Router } from "express";
import { asyncRoute } from "./asyncRoute.js";

export function createFieldRoutes(service) {
  const router = Router();
  const actor = (request) => request.user;

  router.get("/sections/:sectionId/fields", asyncRoute(async (request, response) => {
    response.json(await service.list(actor(request), request.params.sectionId));
  }));
  router.post("/sections/:sectionId/fields", asyncRoute(async (request, response) => {
    response.status(201).json(await service.create(
      actor(request), request.params.sectionId, request.body ?? {},
    ));
  }));
  router.patch("/fields/:fieldId", asyncRoute(async (request, response) => {
    response.json(await service.update(actor(request), request.params.fieldId, request.body ?? {}));
  }));
  router.delete("/fields/:fieldId", asyncRoute(async (request, response) => {
    response.json(await service.delete(actor(request), request.params.fieldId));
  }));
  router.get("/fields/:fieldId/options", asyncRoute(async (request, response) => {
    response.json(await service.listOptions(actor(request), request.params.fieldId));
  }));
  router.post("/fields/:fieldId/options", asyncRoute(async (request, response) => {
    response.status(201).json(await service.createOption(
      actor(request), request.params.fieldId, request.body ?? {},
    ));
  }));
  router.patch("/field-options/:optionId", asyncRoute(async (request, response) => {
    response.json(await service.updateOption(
      actor(request), request.params.optionId, request.body ?? {},
    ));
  }));
  router.delete("/field-options/:optionId", asyncRoute(async (request, response) => {
    response.json(await service.deleteOption(actor(request), request.params.optionId));
  }));

  return router;
}
