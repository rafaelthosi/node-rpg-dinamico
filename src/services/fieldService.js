import { RpgServiceBase } from "./rpgServiceBase.js";
import { RpgServiceError } from "./rpgServiceError.js";

export class FieldService extends RpgServiceBase {
  async list(actor, sectionId) {
    const section = await this.requireRecord("sections", sectionId, "Seção não encontrada.");
    const campaign = await this.requireCampaignAccess(actor, section.campaignId);
    const fields = await this.repository.list("fields", (field) => field.sectionId === sectionId);
    return fields.filter((field) => (
      campaign.gmId === actor.id || this.canView(field, actor)
    ));
  }

  async create(actor, sectionId, input) {
    const section = await this.requireRecord("sections", sectionId, "Seção não encontrada.");
    await this.requireCampaignGM(actor, section.campaignId);
    return this.repository.create("fields", {
      ...this.normalizeField(input), sectionId, createdAt: new Date().toISOString(),
    });
  }

  async update(actor, fieldId, input) {
    const field = await this.requireRecord("fields", fieldId, "Campo não encontrado.");
    const section = await this.requireRecord("sections", field.sectionId, "Seção não encontrada.");
    await this.requireCampaignGM(actor, section.campaignId);
    return this.repository.update("fields", fieldId, this.normalizeField(input, field));
  }

  async delete(actor, fieldId) {
    const field = await this.requireRecord("fields", fieldId, "Campo não encontrado.");
    const section = await this.requireRecord("sections", field.sectionId, "Seção não encontrada.");
    await this.requireCampaignGM(actor, section.campaignId);
    await this.deleteFields([fieldId]);
    return { deleted: true };
  }

  async listOptions(actor, fieldId) {
    const field = await this.requireRecord("fields", fieldId, "Campo não encontrado.");
    const section = await this.requireRecord("sections", field.sectionId, "Seção não encontrada.");
    const campaign = await this.requireCampaignAccess(actor, section.campaignId);
    if (campaign.gmId !== actor.id && !this.canView(field, actor)) {
      throw new RpgServiceError(403, "Você não pode visualizar este campo.");
    }
    return this.repository.list("field_options", (option) => option.fieldId === fieldId);
  }

  async createOption(actor, fieldId, input) {
    const field = await this.requireRecord("fields", fieldId, "Campo não encontrado.");
    const section = await this.requireRecord("sections", field.sectionId, "Seção não encontrada.");
    await this.requireCampaignGM(actor, section.campaignId);
    if (field.type !== "SELECT") {
      throw new RpgServiceError(400, "Somente campos SELECT aceitam opções.");
    }
    this.validateLabel(input.label, "Rótulo da opção");
    if (typeof input.value !== "string" || !input.value.trim() || input.value.length > 255) {
      throw new RpgServiceError(400, "Valor de opção inválido.");
    }
    const position = input.position ?? 0;
    this.validatePosition(position);
    if ((await this.repository.list("field_options", (option) => (
      option.fieldId === fieldId && option.value === input.value
    ))).length) {
      throw new RpgServiceError(409, "Já existe uma opção com esse valor.");
    }
    return this.repository.create("field_options", {
      fieldId, label: input.label.trim(), value: input.value, position,
    });
  }

  async updateOption(actor, optionId, input) {
    const option = await this.requireRecord("field_options", optionId, "Opção não encontrada.");
    const field = await this.requireRecord("fields", option.fieldId, "Campo não encontrado.");
    const section = await this.requireRecord("sections", field.sectionId, "Seção não encontrada.");
    await this.requireCampaignGM(actor, section.campaignId);
    const updates = {};
    if (Object.hasOwn(input, "label")) {
      this.validateLabel(input.label, "Rótulo da opção");
      updates.label = input.label.trim();
    }
    if (Object.hasOwn(input, "value")) {
      if (typeof input.value !== "string" || !input.value.trim() || input.value.length > 255) {
        throw new RpgServiceError(400, "Valor de opção inválido.");
      }
      if ((await this.repository.list("field_options", (item) => (
        item.fieldId === option.fieldId && item.value === input.value && item.id !== optionId
      ))).length) {
        throw new RpgServiceError(409, "Já existe uma opção com esse valor.");
      }
      updates.value = input.value;
    }
    if (Object.hasOwn(input, "position")) {
      this.validatePosition(input.position);
      updates.position = input.position;
    }
    return this.repository.update("field_options", optionId, updates);
  }

  async deleteOption(actor, optionId) {
    const option = await this.requireRecord("field_options", optionId, "Opção não encontrada.");
    const field = await this.requireRecord("fields", option.fieldId, "Campo não encontrado.");
    const section = await this.requireRecord("sections", field.sectionId, "Seção não encontrada.");
    await this.requireCampaignGM(actor, section.campaignId);
    await this.repository.delete("field_options", optionId);
    return { deleted: true };
  }
}
