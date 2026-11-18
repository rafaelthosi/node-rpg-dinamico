import { RpgServiceBase } from "./rpgServiceBase.js";
import { RpgServiceError } from "./rpgServiceError.js";

export class AttackService extends RpgServiceBase {
  async list(actor, characterId) {
    const character = await this.requireRecord("characters", characterId, "Personagem não encontrado.");
    await this.requireCharacterAccess(actor, character);
    return this.repository.list("attacks", (attack) => attack.characterId === characterId);
  }

  async create(actor, characterId, input) {
    const character = await this.requireRecord("characters", characterId, "Personagem não encontrado.");
    await this.requireCharacterAccess(actor, character);
    this.validateCharacterOwner(actor, character);
    return this.repository.create("attacks", {
      ...this.normalize(input),
      characterId,
      createdAt: new Date().toISOString(),
    });
  }

  async update(actor, attackId, input) {
    const attack = await this.requireRecord("attacks", attackId, "Ataque não encontrado.");
    const character = await this.requireRecord("characters", attack.characterId, "Personagem não encontrado.");
    await this.requireCharacterAccess(actor, character);
    this.validateCharacterOwner(actor, character);
    return this.repository.update("attacks", attackId, this.normalize(input, attack));
  }

  async delete(actor, attackId) {
    const attack = await this.requireRecord("attacks", attackId, "Ataque não encontrado.");
    const character = await this.requireRecord("characters", attack.characterId, "Personagem não encontrado.");
    await this.requireCharacterAccess(actor, character);
    this.validateCharacterOwner(actor, character);
    await this.repository.delete("attacks", attackId);
    return { deleted: true };
  }

  normalize(input, existing = null) {
    const get = (key, fallback = "") => Object.hasOwn(input, key) ? input[key] : fallback;
    const name = get("name", existing?.name);
    const description = get("description", existing?.description ?? "");
    const damage = get("damage", existing?.damage);
    const effects = get("effects", existing?.effects ?? "");
    const observation = get("observation", existing?.observation ?? "");
    const actionsConsumed = get("actionsConsumed", existing?.actionsConsumed ?? 1);
    this.validateLabel(name, "Nome do ataque");
    if (typeof damage !== "string" || !damage.trim() || damage.length > 255) {
      throw new RpgServiceError(400, "Informe o dano do ataque (até 255 caracteres).");
    }
    for (const [label, value] of [
      ["Descrição", description], ["Efeitos", effects], ["Observação", observation],
    ]) {
      if (typeof value !== "string" || value.length > 10000) {
        throw new RpgServiceError(400, `${label} inválida (até 10.000 caracteres).`);
      }
    }
    if (!Number.isInteger(actionsConsumed) || actionsConsumed < 1) {
      throw new RpgServiceError(400, "O número de ações consumidas deve ser um inteiro positivo.");
    }
    return {
      name: name.trim(),
      description,
      damage: damage.trim(),
      effects,
      observation,
      actionsConsumed,
    };
  }

  validateCharacterOwner(actor, character) {
    if (String(actor.role).toUpperCase() !== "GM" && character.userId !== actor.id) {
      throw new RpgServiceError(403, "Você não pode alterar ataques de outro personagem.");
    }
  }
}
