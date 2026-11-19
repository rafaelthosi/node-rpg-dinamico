import { RpgServiceBase } from "./rpgServiceBase.js";
import { RpgServiceError } from "./rpgServiceError.js";

export class NpcService extends RpgServiceBase {
  async list(actor, campaignId) {
    await this.requireCampaignGM(actor, campaignId);
    const npcs = await this.repository.list("npcs", (npc) => npc.campaignId === campaignId);
    const npcIds = new Set(npcs.map(({ id }) => id));
    const fieldValues = await this.repository.list("npc_field_values", (value) => npcIds.has(value.npcId));
    return npcs.map((npc) => ({
      ...npc,
      fieldValues: fieldValues.filter((value) => value.npcId === npc.id),
    }));
  }

  async create(actor, campaignId, input) {
    await this.requireCampaignGM(actor, campaignId);
    this.validateLabel(input.name, "Nome do NPC");
    if (typeof input.isEnemy !== "boolean") {
      throw new RpgServiceError(400, "Informe se o NPC é um inimigo.");
    }
    const fieldValues = await this.normalizeFieldValues(campaignId, input.fieldValues);
    const npc = await this.repository.create("npcs", {
      campaignId,
      name: input.name.trim(),
      isEnemy: input.isEnemy,
      createdAt: new Date().toISOString(),
    });
    for (const fieldValue of fieldValues) {
      await this.repository.create("npc_field_values", { ...fieldValue, npcId: npc.id });
    }
    return { ...npc, fieldValues: await this.listValues(npc.id) };
  }

  async update(actor, npcId, input) {
    const npc = await this.requireRecord("npcs", npcId, "NPC não encontrado.");
    await this.requireCampaignGM(actor, npc.campaignId);
    const updates = {};
    if (Object.hasOwn(input, "name")) {
      this.validateLabel(input.name, "Nome do NPC");
      updates.name = input.name.trim();
    }
    if (Object.hasOwn(input, "isEnemy")) {
      if (typeof input.isEnemy !== "boolean") {
        throw new RpgServiceError(400, "Informe se o NPC é um inimigo.");
      }
      updates.isEnemy = input.isEnemy;
    }
    let fieldValues;
    if (Object.hasOwn(input, "fieldValues")) {
      fieldValues = await this.normalizeFieldValues(npc.campaignId, input.fieldValues);
    }
    if (!Object.keys(updates).length && !fieldValues) {
      throw new RpgServiceError(400, "Informe ao menos um campo válido para atualizar o NPC.");
    }
    const updatedNpc = Object.keys(updates).length
      ? await this.repository.update("npcs", npcId, updates)
      : npc;
    if (fieldValues) {
      await this.repository.deleteWhere("npc_field_values", (value) => value.npcId === npcId);
      for (const fieldValue of fieldValues) {
        await this.repository.create("npc_field_values", { ...fieldValue, npcId });
      }
    }
    return { ...updatedNpc, fieldValues: await this.listValues(npcId) };
  }

  async delete(actor, npcId) {
    const npc = await this.requireRecord("npcs", npcId, "NPC não encontrado.");
    await this.requireCampaignGM(actor, npc.campaignId);
    await this.repository.deleteWhere("npc_field_values", (value) => value.npcId === npcId);
    await this.repository.delete("npcs", npcId);
    return { deleted: true };
  }

  async listValues(npcId) {
    return this.repository.list("npc_field_values", (value) => value.npcId === npcId);
  }

  async normalizeFieldValues(campaignId, input) {
    if (!Array.isArray(input)) {
      throw new RpgServiceError(400, "Os valores dos campos do NPC devem ser uma lista.");
    }
    const fields = (await this.campaignFields(campaignId)).filter((field) => field.shareWithNpcs);
    const seenFieldIds = new Set();
    const values = [];
    for (const entry of input) {
      const field = fields.find((item) => item.id === entry?.fieldId);
      if (!field || seenFieldIds.has(field.id)) {
        throw new RpgServiceError(400, "Campo compartilhado inválido ou duplicado.");
      }
      if (typeof entry.value !== "string" || entry.value.length > 10000) {
        throw new RpgServiceError(400, "Valor de campo do NPC inválido.");
      }
      if (field.required && !entry.value.trim()) {
        throw new RpgServiceError(400, `O campo "${field.label}" é obrigatório para NPCs.`);
      }
      if (entry.value.trim()) {
        await this.validateFieldValue(field, entry.value);
        values.push({ fieldId: field.id, value: entry.value });
      }
      seenFieldIds.add(field.id);
    }
    for (const field of fields) {
      if (field.required && !seenFieldIds.has(field.id)) {
        throw new RpgServiceError(400, `O campo "${field.label}" é obrigatório para NPCs.`);
      }
    }
    return values;
  }
}
