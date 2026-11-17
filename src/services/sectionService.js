import { RpgServiceBase } from "./rpgServiceBase.js";

export class SectionService extends RpgServiceBase {
  async list(actor, campaignId) {
    await this.requireCampaignAccess(actor, campaignId);
    return this.repository.list("sections", (section) => section.campaignId === campaignId);
  }

  async create(actor, campaignId, { name, description = "", position = 0 }) {
    await this.requireCampaignGM(actor, campaignId);
    this.validateLabel(name, "Nome da seção");
    this.validateDescription(description);
    this.validatePosition(position);
    return this.repository.create("sections", {
      campaignId, name: name.trim(), description, position, createdAt: new Date().toISOString(),
    });
  }

  async update(actor, sectionId, input) {
    const section = await this.requireRecord("sections", sectionId, "Seção não encontrada.");
    await this.requireCampaignGM(actor, section.campaignId);
    const updates = {};
    if (Object.hasOwn(input, "name")) {
      this.validateLabel(input.name, "Nome da seção");
      updates.name = input.name.trim();
    }
    if (Object.hasOwn(input, "description")) {
      this.validateDescription(input.description);
      updates.description = input.description;
    }
    if (Object.hasOwn(input, "position")) {
      this.validatePosition(input.position);
      updates.position = input.position;
    }
    return this.repository.update("sections", sectionId, updates);
  }

  async delete(actor, sectionId) {
    const section = await this.requireRecord("sections", sectionId, "Seção não encontrada.");
    await this.requireCampaignGM(actor, section.campaignId);
    const fields = await this.repository.list("fields", (field) => field.sectionId === sectionId);
    await this.deleteFields(fields.map(({ id }) => id));
    await this.repository.delete("sections", sectionId);
    return { deleted: true };
  }
}
