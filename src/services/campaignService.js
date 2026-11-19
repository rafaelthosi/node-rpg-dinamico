import bcrypt from "bcryptjs";
import { RpgServiceBase, publicCampaign, roleOf } from "./rpgServiceBase.js";
import { RpgServiceError } from "./rpgServiceError.js";

export class CampaignService extends RpgServiceBase {
  async list(actor) {
    if (roleOf(actor) === "GM") {
      return (await this.repository.list("campaigns", (campaign) => campaign.gmId === actor.id))
        .map(publicCampaign);
    }
    const memberships = await this.repository.list("campaign_members", (member) => (
      member.userId === actor.id && ["ACTIVE", "PENDING"].includes(member.status)
    ));
    const campaignIds = new Set(memberships.map(({ campaignId }) => campaignId));
    return (await this.repository.list("campaigns", ({ id }) => campaignIds.has(id)))
      .map(publicCampaign);
  }

  async create(actor, { name, description = "", password }) {
    this.requireRole(actor, "GM");
    if (typeof name !== "string" || !name.trim() || name.trim().length > 255) {
      throw new RpgServiceError(400, "O nome da campanha é obrigatório (até 255 caracteres).");
    }
    if (typeof description !== "string" || description.length > 10000) {
      throw new RpgServiceError(400, "Descrição inválida.");
    }
    if (typeof password !== "string" || password.length < 8 || password.length > 200) {
      throw new RpgServiceError(400, "A senha de acesso deve ter entre 8 e 200 caracteres.");
    }
    const campaign = await this.repository.create("campaigns", {
      name: name.trim(), description, gmId: actor.id,
      passwordHash: await bcrypt.hash(password, 12), createdAt: new Date().toISOString(),
    });
    return publicCampaign(campaign);
  }

  async get(actor, campaignId) {
    return publicCampaign(await this.requireCampaignAccess(actor, campaignId));
  }

  async update(actor, campaignId, input) {
    await this.requireCampaignGM(actor, campaignId);
    const updates = {};
    if (Object.hasOwn(input, "name")) {
      if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 255) {
        throw new RpgServiceError(400, "Nome de campanha inválido.");
      }
      updates.name = input.name.trim();
    }
    if (Object.hasOwn(input, "description")) {
      this.validateDescription(input.description);
      updates.description = input.description;
    }
    if (Object.hasOwn(input, "password")) {
      if (typeof input.password !== "string" || input.password.length < 8 || input.password.length > 200) {
        throw new RpgServiceError(400, "A senha de acesso deve ter entre 8 e 200 caracteres.");
      }
      updates.passwordHash = await bcrypt.hash(input.password, 12);
    }
    return publicCampaign(await this.repository.update("campaigns", campaignId, updates));
  }

  async delete(actor, campaignId) {
    await this.requireCampaignGM(actor, campaignId);
    const sections = await this.repository.list("sections", (section) => section.campaignId === campaignId);
    const sectionIds = new Set(sections.map(({ id }) => id));
    const fields = await this.repository.list("fields", (field) => sectionIds.has(field.sectionId));
    const fieldIds = new Set(fields.map(({ id }) => id));
    const characters = await this.repository.list("characters", (character) => (
      character.campaignId === campaignId
    ));
    const characterIds = new Set(characters.map(({ id }) => id));
    const npcs = await this.repository.list("npcs", (npc) => npc.campaignId === campaignId);
    const npcIds = new Set(npcs.map(({ id }) => id));
    const combats = await this.repository.list("combats", (combat) => combat.campaignId === campaignId);
    const combatIds = new Set(combats.map(({ id }) => id));
    const combatants = await this.repository.list("combatants", (combatant) => (
      combatIds.has(combatant.combatId)
    ));
    const combatantIds = new Set(combatants.map(({ id }) => id));
    const combatActions = await this.repository.list("combat_actions", (action) => (
      combatIds.has(action.combatId)
    ));
    const combatActionIds = new Set(combatActions.map(({ id }) => id));
    await this.repository.deleteWhere("combat_action_targets", (target) => (
      combatActionIds.has(target.actionId)
    ));
    await this.repository.deleteWhere("combat_actions", (action) => combatIds.has(action.combatId));
    await this.repository.deleteWhere("combatant_field_values", (value) => (
      combatantIds.has(value.combatantId) || fieldIds.has(value.fieldId)
    ));
    await this.repository.deleteWhere("combatants", (combatant) => combatIds.has(combatant.combatId));
    await this.repository.deleteWhere("combats", (combat) => combat.campaignId === campaignId);
    await this.repository.deleteWhere("attacks", (attack) => characterIds.has(attack.characterId));
    await this.repository.deleteWhere("field_values", (value) => (
      characterIds.has(value.characterId) || fieldIds.has(value.fieldId)
    ));
    await this.repository.deleteWhere("npc_field_values", (value) => (
      npcIds.has(value.npcId) || fieldIds.has(value.fieldId)
    ));
    await this.repository.deleteWhere("field_options", (option) => fieldIds.has(option.fieldId));
    await this.repository.deleteWhere("fields", (field) => sectionIds.has(field.sectionId));
    await this.repository.deleteWhere("sections", (section) => section.campaignId === campaignId);
    await this.repository.deleteWhere("characters", (character) => character.campaignId === campaignId);
    await this.repository.deleteWhere("npcs", (npc) => npc.campaignId === campaignId);
    await this.repository.deleteWhere("campaign_members", (member) => member.campaignId === campaignId);
    await this.repository.delete("campaigns", campaignId);
    return { deleted: true };
  }
}
