import { Router } from "express";
import { createCampaignMemberRoutes } from "./campaignMemberRoutes.js";
import { createCampaignRoutes } from "./campaignRoutes.js";
import { createCharacterRoutes } from "./characterRoutes.js";
import { createFieldRoutes } from "./fieldRoutes.js";
import { createSectionRoutes } from "./sectionRoutes.js";

export function createRpgRoutes(service) {
  const router = Router();
  router.use("/campaigns", createCampaignRoutes(service.campaigns));
  router.use("/campaigns", createCampaignMemberRoutes(service.members));
  router.use(createSectionRoutes(service.sections));
  router.use(createFieldRoutes(service.fields));
  router.use(createCharacterRoutes(service.characters));
  return router;
}
