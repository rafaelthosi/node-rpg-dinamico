import { RpgServiceBase, roleOf } from "./rpgServiceBase.js";
import { RpgServiceError } from "./rpgServiceError.js";

function gridColumnName(index) {
  let value = index + 1;
  let label = "";
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label.toLowerCase();
}

function gridPositionAt(index, columns) {
  return `${gridColumnName(index % columns)}${Math.floor(index / columns) + 1}`;
}

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
    const combatants = await Promise.all(storedCombatants.map(async (combatant, index) => {
      const savedFieldValues = await this.repository.list(
        "combatant_field_values",
        (item) => item.combatantId === combatant.id,
      );
      const sharedValues = savedFieldValues.flatMap((item) => {
        const field = sharedFields.find((entry) => entry.id === item.fieldId);
        return field ? [{ fieldId: field.id, label: field.label, value: item.value }] : [];
      });
      if (!combatant.characterId) {
        return {
          ...combatant,
          position: combatant.position ?? gridPositionAt(index, combat.gridColumns ?? 10),
          isMine: false,
          sharedFields: sharedValues,
        };
      }
      const character = await this.repository.findById("characters", combatant.characterId);
      return {
        ...combatant,
        position: combatant.position ?? gridPositionAt(index, combat.gridColumns ?? 10),
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
    const sortedActions = actions.sort((first, second) => (
      first.round - second.round || first.createdAt.localeCompare(second.createdAt)
    ));
    const latestPositions = new Map();
    for (const action of sortedActions) {
      if (action.position) {
        latestPositions.set(action.combatantId, action.position);
      }
    }
    const positionedCombatants = combatants.map((combatant) => ({
      ...combatant,
      position: latestPositions.get(combatant.id) ?? combatant.position,
    }));
    const actionDetails = await Promise.all(sortedActions.map(async (action) => ({
      ...action,
      targets: await this.repository.list("combat_action_targets", (target) => (
        target.actionId === action.id
      )),
    })));
    return {
      ...combat,
      gridRows: combat.gridRows ?? 10,
      gridColumns: combat.gridColumns ?? 10,
      combatants: positionedCombatants,
      actions: actionDetails,
    };
  }

  async create(actor, campaignId, input) {
    await this.requireCampaignGM(actor, campaignId);
    this.validateLabel(input.name, "Nome do combate");
    const gridRows = input.gridRows ?? 10;
    const gridColumns = input.gridColumns ?? 10;
    this.validateGridSize(gridRows, "Linhas");
    this.validateGridSize(gridColumns, "Colunas");
    if (!Array.isArray(input.participants) || input.participants.length === 0) {
      throw new RpgServiceError(400, "Adicione ao menos um personagem, NPC ou criatura.");
    }

    const sharedFields = (await this.campaignFields(campaignId))
      .filter((field) => field.shareWithNpcs);
    const participants = [];
    const usedCharacters = new Set();
    const usedPositions = new Set();
    for (const participant of input.participants) {
      if (!participant || typeof participant !== "object") {
        throw new RpgServiceError(400, "Participante de combate inválido.");
      }
      this.validateInteger(participant.initiative, "Iniciativa", 0);
      this.validateInteger(participant.actionsPerTurn, "Ações por turno", 1);
      const position = participant.position === undefined
        ? this.nextAvailablePosition(gridRows, gridColumns, usedPositions)
        : this.validateGridPosition(participant.position, gridRows, gridColumns);
      if (usedPositions.has(position)) {
        throw new RpgServiceError(400, `A posição ${position} já está ocupada.`);
      }
      usedPositions.add(position);
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
          position,
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
          position,
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
      gridRows,
      gridColumns,
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

  async addParticipant(actor, combatId, participant) {
    const combat = await this.requireRecord("combats", combatId, "Combate não encontrado.");
    await this.requireCampaignGM(actor, combat.campaignId);
    if (!participant || typeof participant !== "object") {
      throw new RpgServiceError(400, "Participante de combate inválido.");
    }
    this.validateInteger(participant.initiative, "Iniciativa", 0);
    this.validateInteger(participant.actionsPerTurn, "Ações por turno", 1);

    const combatants = (await this.get(actor, combatId)).combatants;
    const currentCombatantId = [...combatants]
      .sort((first, second) => second.initiative - first.initiative)[combat.currentTurnIndex]?.id;
    const usedPositions = new Set(combatants.map((item) => item.position));
    const position = participant.position === undefined
      ? this.nextAvailablePosition(combat.gridRows ?? 10, combat.gridColumns ?? 10, usedPositions)
      : this.validateGridPosition(
        participant.position,
        combat.gridRows ?? 10,
        combat.gridColumns ?? 10,
      );
    if (usedPositions.has(position)) {
      throw new RpgServiceError(400, `A posição ${position} já está ocupada.`);
    }

    let combatantInput;
    let fieldValues = [];

    if (participant.characterId) {
      if (combatants.some((item) => item.characterId === participant.characterId)) {
        throw new RpgServiceError(400, "Este personagem já participa do combate.");
      }
      const character = await this.requireRecord(
        "characters",
        participant.characterId,
        "Personagem não encontrado.",
      );
      if (character.campaignId !== combat.campaignId) {
        throw new RpgServiceError(400, "O personagem precisa pertencer à campanha do combate.");
      }
      const membership = (await this.repository.list("campaign_members", (member) => (
        member.campaignId === combat.campaignId
        && member.userId === character.userId
        && member.status === "ACTIVE"
      )))[0];
      if (!membership) {
        throw new RpgServiceError(400, "O personagem precisa pertencer a um jogador ativo na campanha.");
      }
      combatantInput = {
        characterId: character.id,
        name: character.name,
        isEnemy: false,
        initiative: participant.initiative,
        actionsPerTurn: participant.actionsPerTurn,
        position,
      };
    } else {
      this.validateLabel(participant.name, "Nome do NPC ou criatura");
      if (typeof participant.isEnemy !== "boolean") {
        throw new RpgServiceError(400, "Informe se o NPC ou criatura é um inimigo.");
      }
      if (!Array.isArray(participant.fieldValues)) {
        throw new RpgServiceError(400, "Os valores compartilhados do NPC devem ser uma lista.");
      }
      const sharedFields = (await this.campaignFields(combat.campaignId))
        .filter((field) => field.shareWithNpcs);
      const seenFieldIds = new Set();
      for (const entry of participant.fieldValues) {
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
          fieldValues.push({ fieldId: field.id, value: entry.value });
        }
        seenFieldIds.add(field.id);
      }
      for (const field of sharedFields) {
        if (field.required && !seenFieldIds.has(field.id)) {
          throw new RpgServiceError(400, `O campo "${field.label}" é obrigatório para NPCs.`);
        }
      }
      combatantInput = {
        characterId: null,
        name: participant.name.trim(),
        isEnemy: participant.isEnemy,
        initiative: participant.initiative,
        actionsPerTurn: participant.actionsPerTurn,
        position,
      };
    }

    const combatant = await this.repository.create("combatants", {
      ...combatantInput,
      combatId,
    });
    for (const fieldValue of fieldValues) {
      await this.repository.create("combatant_field_values", {
        ...fieldValue,
        combatantId: combatant.id,
      });
    }
    if (currentCombatantId) {
      const sortedCombatants = [...combatants, { ...combatantInput, id: combatant.id }]
        .sort((first, second) => second.initiative - first.initiative);
      await this.repository.update("combats", combatId, {
        currentTurnIndex: sortedCombatants.findIndex((item) => item.id === currentCombatantId),
      });
    }
    return this.get(actor, combatId);
  }

  async setGridSize(actor, combatId, input) {
    const combat = await this.requireRecord("combats", combatId, "Combate não encontrado.");
    await this.requireCampaignGM(actor, combat.campaignId);
    if (!combat.active) {
      throw new RpgServiceError(400, "O tamanho do grid só pode ser alterado enquanto o combate estiver em andamento.");
    }
    this.validateGridSize(input.gridRows, "Linhas");
    this.validateGridSize(input.gridColumns, "Colunas");
    const currentCombat = await this.get(actor, combatId);
    const occupiedPositions = new Set();
    for (const combatant of currentCombat.combatants) {
      const position = this.validateGridPosition(
        combatant.position,
        input.gridRows,
        input.gridColumns,
      );
      if (occupiedPositions.has(position)) {
        throw new RpgServiceError(400, `A nova dimensão deixa mais de um participante em ${position}.`);
      }
      occupiedPositions.add(position);
    }
    await this.repository.update("combats", combatId, {
      gridRows: input.gridRows,
      gridColumns: input.gridColumns,
    });
    return this.get(actor, combatId);
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
    if (
      (typeof damage !== "string" && typeof damage !== "number")
      || String(damage).length > 255
      || (String(damage).trim() && (!Number.isFinite(Number(damage)) || Number(damage) < 0))
    ) {
      throw new RpgServiceError(400, "A quantidade de dano deve ser um número igual ou maior que zero.");
    }
    const actionType = input.actionType ?? "FREE";
    if (!["ATTACK", "FREE"].includes(actionType)) {
      throw new RpgServiceError(400, "Escolha uma ação do tipo ataque ou livre.");
    }
    let attackId = null;
    let attackName = null;
    let actionsCount;
    if (actionType === "ATTACK") {
      if (!combatant.characterId || typeof input.attackId !== "string") {
        throw new RpgServiceError(400, "Selecione um ataque do personagem que está agindo.");
      }
      const attack = await this.requireRecord("attacks", input.attackId, "Ataque não encontrado.");
      if (attack.characterId !== combatant.characterId) {
        throw new RpgServiceError(400, "O ataque selecionado não pertence ao personagem que está agindo.");
      }
      attackId = attack.id;
      attackName = attack.name;
      actionsCount = attack.actionsConsumed;
    } else {
      actionsCount = input.actionsCount ?? 1;
      this.validateInteger(actionsCount, "Quantidade de ações", 1);
    }
    const priorActions = await this.repository.list("combat_actions", (item) => (
      item.combatId === combatId
    ));
    const sortedPriorActions = priorActions.sort((first, second) => (
      first.round - second.round || first.createdAt.localeCompare(second.createdAt)
    ));
    const latestPositions = new Map();
    for (const priorAction of sortedPriorActions) {
      if (priorAction.position) {
        latestPositions.set(priorAction.combatantId, priorAction.position);
      }
    }
    const currentPosition = latestPositions.get(combatant.id)
      ?? combatant.position
      ?? gridPositionAt(combatants.indexOf(combatant), combat.gridColumns ?? 10);
    const position = this.validateGridPosition(
      input.position ?? currentPosition,
      combat.gridRows ?? 10,
      combat.gridColumns ?? 10,
    );
    const occupiedPosition = combatants.some((other, index) => {
      if (other.id === combatant.id) {
        return false;
      }
      const otherPosition = latestPositions.get(other.id)
        ?? other.position
        ?? gridPositionAt(index, combat.gridColumns ?? 10);
      return otherPosition === position;
    });
    if (occupiedPosition) {
      throw new RpgServiceError(400, `A posição ${position} já está ocupada.`);
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
    const actionsUsed = turnActions.reduce((total, action) => total + (action.actionsCount ?? 1), 0);
    if (actionsUsed + actionsCount > combatant.actionsPerTurn) {
      throw new RpgServiceError(400, "Este personagem já usou todas as ações deste turno.");
    }
    const action = await this.repository.create("combat_actions", {
      combatId,
      combatantId: combatant.id,
      round: combat.currentRound,
      description: input.description.trim(),
      damage: String(damage).trim(),
      position,
      actionType,
      attackId,
      attackName,
      actionsCount,
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

  validateGridSize(value, label) {
    if (!Number.isInteger(value) || value < 1 || value > 100) {
      throw new RpgServiceError(400, `O número de ${label.toLowerCase()} deve ser um inteiro entre 1 e 100.`);
    }
  }

  validateGridPosition(position, rows, columns) {
    if (typeof position !== "string" || position.length > 5) {
      throw new RpgServiceError(400, "Informe uma posição válida no grid, como b12.");
    }
    const match = position.trim().match(/^([a-z]+)([1-9]\d*)$/i);
    if (!match) {
      throw new RpgServiceError(400, "Informe uma posição válida no grid, como b12.");
    }
    const column = [...match[1].toLowerCase()].reduce(
      (total, letter) => total * 26 + letter.charCodeAt(0) - 96,
      0,
    );
    const row = Number(match[2]);
    if (column > columns || row > rows) {
      throw new RpgServiceError(400, `A posição ${position} está fora do grid ${rows}×${columns}.`);
    }
    return `${match[1].toLowerCase()}${row}`;
  }

  nextAvailablePosition(rows, columns, usedPositions) {
    for (let index = 0; index < rows * columns; index += 1) {
      const position = gridPositionAt(index, columns);
      if (!usedPositions.has(position)) {
        return position;
      }
    }
    throw new RpgServiceError(400, "Não há quadrados livres no grid para outro participante.");
  }

  validateInteger(value, label, minimum) {
    if (!Number.isInteger(value) || value < minimum) {
      throw new RpgServiceError(400, `${label} deve ser um inteiro igual ou maior que ${minimum}.`);
    }
  }
}
