import { RpgServiceBase, roleOf } from "./rpgServiceBase.js";
import { RpgServiceError } from "./rpgServiceError.js";

export class CharacterService extends RpgServiceBase {
  async list(actor, campaignId) {
    await this.requireCampaignAccess(actor, campaignId);
    return this.repository.list("characters", (character) => (
      character.campaignId === campaignId && (roleOf(actor) === "GM" || character.userId === actor.id)
    ));
  }

  async create(actor, campaignId, { name, userId }) {
    await this.requireCampaignAccess(actor, campaignId);
    this.validateLabel(name, "Nome do personagem");
    const characterUserId = userId ?? actor.id;
    if (characterUserId !== actor.id) {
      this.requireRole(actor, "GM");
      const user = await this.requireRecord("users", characterUserId, "Usuário não encontrado.");
      if (roleOf(user) !== "PLAYER") {
        throw new RpgServiceError(400, "Somente usuários PLAYER podem possuir personagens na campanha.");
      }
      const membership = (await this.repository.list("campaign_members", (member) => (
        member.campaignId === campaignId
        && member.userId === characterUserId
        && member.status === "ACTIVE"
      )))[0];
      if (!membership) {
        throw new RpgServiceError(400, "O jogador precisa estar ativo na campanha antes de criar um personagem.");
      }
    }
    return this.repository.create("characters", {
      campaignId, userId: characterUserId, name: name.trim(), createdAt: new Date().toISOString(),
    });
  }

  async update(actor, characterId, { name }) {
    const character = await this.requireRecord("characters", characterId, "Personagem não encontrado.");
    await this.requireCharacterAccess(actor, character);
    this.validateLabel(name, "Nome do personagem");
    return this.repository.update("characters", characterId, { name: name.trim() });
  }

  async delete(actor, characterId) {
    const character = await this.requireRecord("characters", characterId, "Personagem não encontrado.");
    await this.requireCharacterAccess(actor, character);
    await this.repository.deleteWhere("field_values", (value) => value.characterId === characterId);
    await this.repository.delete("characters", characterId);
    return { deleted: true };
  }

  async listValues(actor, characterId) {
    const character = await this.requireRecord("characters", characterId, "Personagem não encontrado.");
    await this.requireCharacterAccess(actor, character);
    const fields = await this.campaignFields(character.campaignId);
    const visibleFields = new Set(fields.filter((field) => this.canView(field, actor)).map(({ id }) => id));
    return this.repository.list("field_values", (value) => (
      value.characterId === characterId && visibleFields.has(value.fieldId)
    ));
  }

  async setValue(actor, characterId, fieldId, { value }) {
    const character = await this.requireRecord("characters", characterId, "Personagem não encontrado.");
    await this.requireCharacterAccess(actor, character);
    if (typeof value !== "string" || value.length > 10000) {
      throw new RpgServiceError(400, "O valor do campo deve ser texto de até 10.000 caracteres.");
    }
    const field = await this.requireRecord("fields", fieldId, "Campo não encontrado.");
    const section = await this.requireRecord("sections", field.sectionId, "Seção não encontrada.");
    if (section.campaignId !== character.campaignId) {
      throw new RpgServiceError(400, "O campo não pertence à campanha do personagem.");
    }
    if (!this.canView(field, actor)) {
      throw new RpgServiceError(403, "Você não pode visualizar este campo.");
    }
    const permission = roleOf(actor) === "GM" ? "GM" : "PLAYER";
    if (!["BOTH", permission].includes(field.editableBy)) {
      throw new RpgServiceError(403, "Você não tem permissão para editar este campo.");
    }
    if (field.required && !value.trim()) {
      throw new RpgServiceError(400, "Este campo é obrigatório.");
    }

    const existing = (await this.repository.list("field_values", (item) => (
      item.characterId === characterId && item.fieldId === fieldId
    )))[0];
    if (!value.trim()) {
      if (existing) {
        await this.repository.delete("field_values", existing.id);
      }
      return { characterId, fieldId, value: "" };
    }

    await this.validateFieldValue(field, value);
    if (existing) {
      return this.repository.update("field_values", existing.id, {
        value, updatedAt: new Date().toISOString(),
      });
    }
    return this.repository.create("field_values", {
      characterId, fieldId, value, updatedAt: new Date().toISOString(),
    });
  }

  async deleteValue(actor, characterId, fieldId) {
    const character = await this.requireRecord("characters", characterId, "Personagem não encontrado.");
    await this.requireCharacterAccess(actor, character);
    const field = await this.requireRecord("fields", fieldId, "Campo não encontrado.");
    const section = await this.requireRecord("sections", field.sectionId, "Seção não encontrada.");
    if (section.campaignId !== character.campaignId) {
      throw new RpgServiceError(400, "O campo não pertence à campanha do personagem.");
    }
    const permission = roleOf(actor) === "GM" ? "GM" : "PLAYER";
    if (!["BOTH", permission].includes(field.editableBy)) {
      throw new RpgServiceError(403, "Você não tem permissão para editar este campo.");
    }
    const existing = (await this.repository.list("field_values", (item) => (
      item.characterId === characterId && item.fieldId === fieldId
    )))[0];
    if (!existing) {
      throw new RpgServiceError(404, "Valor não encontrado.");
    }
    await this.repository.delete("field_values", existing.id);
    return { deleted: true };
  }
}
