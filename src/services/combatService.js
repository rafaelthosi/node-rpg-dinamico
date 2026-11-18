import { RpgServiceBase, roleOf } from "./rpgServiceBase.js";
import { RpgServiceError } from "./rpgServiceError.js";

export class CombatService extends RpgServiceBase {
  async list(actor, campaignId) {
    await this.requireCampaignAccess(actor, campaignId);
    const combats = await this.repository.list("combats", (combat) => (
      combat.campaignId === campaignId
    ));
    const visible = [];
    for (const combat of combats) {
      try {
        visible.push(await this.get(actor, combat.id));
      } catch (error) {
        if (!(error instanceof RpgServiceError) || error.status !== 403) {
          throw error;
        }
      }
    }
    return visible;
  }

  async get(actor, combatId) {
    const combat = await this.requireRecord("combats", combatId, "Combate não encontrado.");
    await this.requireCampaignAccess(actor, combat.campaignId);
    const storedCombatants = await this.repository.list("combatants", (item) => item.combatId === combatId);
    const sharedFields = (await this.campaignFields(combat.campaignId))
      .filter((field) => field.shareWithNpcs);
    const combatants = await Promise.all(storedCombatants.map(async (combatant) => {
      const savedFieldValues = await this.repository.list(
        "combatant_field_values",
        (item) => item.combatantId === combatant.id,
      );
      const sharedValues = savedFieldValues.flatMap((item) => {
        const field = sharedFields.find((entry) => entry.id === item.fieldId);
        return field ? [{ fieldId: field.id, label: field.label, value: item.value }] : [];
      });
      if (!combatant.characterId) {
        return { ...combatant, isMine: false, sharedFields: sharedValues };
      }
      const character = await this.repository.findById("characters", combatant.characterId);
      return {
        ...combatant,
        isMine: character?.userId === actor.id,
        sharedFields: sharedValues,
      };
    }));
    if (roleOf(actor) !== "GM") {
      const ownedCharacterIds = new Set((await this.repository.list("characters", (character) => (
        character.campaignId === combat.campaignId && character.userId === actor.id
      ))).map(({ id }) => id));
      if (!combatants.some((item) => ownedCharacterIds.has(item.characterId))) {
        throw new RpgServiceError(403, "Este combate não possui personagens seus.");
      }
    }

    const actions = await this.repository.list("combat_actions", (item) => item.combatId === combatId);
    const actionDetails = await Promise.all(actions.map(async (action) => ({
      ...action,
      targets: await this.repository.list("combat_action_targets", (target) => (
        target.actionId === action.id
      )),
    })));
    return {
      ...combat,
      combatants,
      actions: actionDetails.sort((first, second) => (
        first.round - second.round || first.createdAt.localeCompare(second.createdAt)
      )),
    };
  }

  async create(actor, campaignId, input) {
    await this.requireCampaignGM(actor, campaignId);
    this.validateLabel(input.name, "Nome do combate");
    if (!Array.isArray(input.participants) || input.participants.length === 0) {
      throw new RpgServiceError(400, "Adicione ao menos um personagem, NPC ou criatura.");
    }

    const sharedFields = (await this.campaignFields(campaignId))
      .filter((field) => field.shareWithNpcs);
    const participants = [];
    const usedCharacters = new Set();
    for (const participant of input.participants) {
      if (!participant || typeof participant !== "object") {
        throw new RpgServiceError(400, "Participante de combate inválido.");
      }
      this.validateInteger(participant.initiative, "Iniciativa", 0);
      this.validateInteger(participant.actionsPerTurn, "Ações por turno", 1);
      if (participant.characterId) {
        if (usedCharacters.has(participant.characterId)) {
          throw new RpgServiceError(400, "Um personagem não pode ser adicionado duas vezes ao combate.");
        }
        usedCharacters.add(participant.characterId);
        const character = await this.requireRecord(
          "characters",
          participant.characterId,
          "Personagem não encontrado.",
        );
        if (character.campaignId !== campaignId) {
          throw new RpgServiceError(400, "O personagem precisa pertencer à campanha do combate.");
        }
        const membership = (await this.repository.list("campaign_members", (member) => (
          member.campaignId === campaignId
          && member.userId === character.userId
          && member.status === "ACTIVE"
        )))[0];
        if (!membership) {
          throw new RpgServiceError(400, "O personagem precisa pertencer a um jogador ativo na campanha.");
        }
        participants.push({
          characterId: character.id,
          name: character.name,
          isEnemy: false,
          initiative: participant.initiative,
          actionsPerTurn: participant.actionsPerTurn,
        });
      } else {
        this.validateLabel(participant.name, "Nome do NPC ou criatura");
        if (typeof participant.isEnemy !== "boolean") {
          throw new RpgServiceError(400, "Informe se o NPC ou criatura é um inimigo.");
        }
        const values = participant.fieldValues ?? [];
        if (!Array.isArray(values)) {
          throw new RpgServiceError(400, "Os valores compartilhados do NPC devem ser uma lista.");
        }
        const savedValues = [];
        const seenFieldIds = new Set();
        for (const entry of values) {
          const field = sharedFields.find((item) => item.id === entry?.fieldId);
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
            savedValues.push({ fieldId: field.id, value: entry.value });
          }
          seenFieldIds.add(field.id);
        }
        for (const field of sharedFields) {
          if (field.required && !seenFieldIds.has(field.id)) {
            throw new RpgServiceError(400, `O campo "${field.label}" é obrigatório para NPCs.`);
          }
        }
        participants.push({
          characterId: null,
          name: participant.name.trim(),
          isEnemy: participant.isEnemy,
          initiative: participant.initiative,
          actionsPerTurn: participant.actionsPerTurn,
          fieldValues: savedValues,
        });
      }
    }

    const combat = await this.repository.create("combats", {
      campaignId,
      name: input.name.trim(),
      currentRound: 1,
      currentTurnIndex: 0,
      active: true,
      createdAt: new Date().toISOString(),
    });
    for (const participant of participants) {
      const { fieldValues, ...combatantInput } = participant;
      const combatant = await this.repository.create("combatants", {
        ...combatantInput,
        combatId: combat.id,
      });
      for (const fieldValue of fieldValues ?? []) {
        await this.repository.create("combatant_field_values", {
          ...fieldValue,
          combatantId: combatant.id,
        });
      }
    }
    return this.get(actor, combat.id);
  }

  async addAction(actor, combatId, input) {
    const combat = await this.requireRecord("combats", combatId, "Combate não encontrado.");
    await this.requireCampaignAccess(actor, combat.campaignId);
    if (!combat.active) {
      throw new RpgServiceError(400, "Este combate já foi encerrado.");
    }
    const combatants = await this.repository.list("combatants", (item) => item.combatId === combatId);
    const combatant = combatants.find((item) => item.id === input.combatantId);
    if (!combatant) {
      throw new RpgServiceError(400, "O personagem que age não pertence a este combate.");
    }
    const ordered = [...combatants].sort((a, b) => b.initiative - a.initiative);
    if (ordered[combat.currentTurnIndex]?.id !== combatant.id) {
      throw new RpgServiceError(400, "A ação precisa ser registrada para quem está na vez pela iniciativa.");
    }
    if (roleOf(actor) !== "GM") {
      if (!combatant.characterId) {
        throw new RpgServiceError(403, "Somente o GM pode registrar ações de NPCs e criaturas.");
      }
      const character = await this.requireRecord(
        "characters",
        combatant.characterId,
        "Personagem não encontrado.",
      );
      if (character.userId !== actor.id) {
        throw new RpgServiceError(403, "Você só pode registrar ações dos seus personagens.");
      }
    }
    this.validateLabel(input.description, "Descrição da ação");
    const damage = input.damage ?? "";
    if (typeof damage !== "string" || damage.length > 255) {
      throw new RpgServiceError(400, "Dano inválido (até 255 caracteres).");
    }
    const targets = input.targets ?? [];
    if (!Array.isArray(targets) || targets.some((id) => typeof id !== "string")) {
      throw new RpgServiceError(400, "Lista de alvos inválida.");
    }
    const uniqueTargets = [...new Set(targets)];
    const targetCombatants = await this.repository.list("combatants", (item) => (
      item.combatId === combatId && uniqueTargets.includes(item.id)
    ));
    if (targetCombatants.length !== uniqueTargets.length) {
      throw new RpgServiceError(400, "Todos os alvos precisam estar neste combate.");
    }
    const turnActions = await this.repository.list("combat_actions", (item) => (
      item.combatId === combatId
      && item.combatantId === combatant.id
      && item.round === combat.currentRound
    ));
    if (turnActions.length >= combatant.actionsPerTurn) {
      throw new RpgServiceError(400, "Este personagem já usou todas as ações deste turno.");
    }
    const action = await this.repository.create("combat_actions", {
      combatId,
      combatantId: combatant.id,
      round: combat.currentRound,
      description: input.description.trim(),
      damage: damage.trim(),
      createdAt: new Date().toISOString(),
    });
    for (const target of targetCombatants) {
      await this.repository.create("combat_action_targets", {
        actionId: action.id,
        combatantId: target.id,
      });
    }
    return this.get(actor, combatId);
  }

  async advanceTurn(actor, combatId) {
    const combat = await this.requireRecord("combats", combatId, "Combate não encontrado.");
    await this.requireCampaignGM(actor, combat.campaignId);
    if (!combat.active) {
      throw new RpgServiceError(400, "Este combate já foi encerrado.");
    }
    const ordered = (await this.repository.list("combatants", (item) => item.combatId === combatId))
      .sort((a, b) => b.initiative - a.initiative);
    if (!ordered.length) {
      throw new RpgServiceError(400, "O combate não possui participantes.");
    }
    const isLast = combat.currentTurnIndex >= ordered.length - 1;
    await this.repository.update("combats", combatId, {
      currentTurnIndex: isLast ? 0 : combat.currentTurnIndex + 1,
      currentRound: isLast ? combat.currentRound + 1 : combat.currentRound,
    });
    return this.get(actor, combatId);
  }

  async setActive(actor, combatId, active) {
    const combat = await this.requireRecord("combats", combatId, "Combate não encontrado.");
    await this.requireCampaignGM(actor, combat.campaignId);
    if (typeof active !== "boolean") {
      throw new RpgServiceError(400, "O estado do combate deve ser booleano.");
    }
    await this.repository.update("combats", combatId, { active });
    return this.get(actor, combatId);
  }

  async delete(actor, combatId) {
    const combat = await this.requireRecord("combats", combatId, "Combate não encontrado.");
    await this.requireCampaignGM(actor, combat.campaignId);
    const actions = await this.repository.list("combat_actions", (item) => item.combatId === combatId);
    const actionIds = new Set(actions.map(({ id }) => id));
    const combatants = await this.repository.list("combatants", (item) => item.combatId === combatId);
    const combatantIds = new Set(combatants.map(({ id }) => id));
    await this.repository.deleteWhere("combat_action_targets", (item) => actionIds.has(item.actionId));
    await this.repository.deleteWhere("combat_actions", (item) => item.combatId === combatId);
    await this.repository.deleteWhere(
      "combatant_field_values",
      (item) => combatantIds.has(item.combatantId),
    );
    await this.repository.deleteWhere("combatants", (item) => item.combatId === combatId);
    await this.repository.delete("combats", combatId);
    return { deleted: true };
  }

  validateInteger(value, label, minimum) {
    if (!Number.isInteger(value) || value < minimum) {
      throw new RpgServiceError(400, `${label} deve ser um inteiro igual ou maior que ${minimum}.`);
    }
  }
}
