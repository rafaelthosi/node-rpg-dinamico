import { RpgServiceError } from "./rpgServiceError.js";

export const roleOf = (actor) => String(actor.role).toUpperCase();
export const publicCampaign = ({ passwordHash: _passwordHash, ...campaign }) => campaign;
export const publicUser = ({ id, username, role, createdAt }) => ({ id, username, role, createdAt });

export class RpgServiceBase {
  constructor({ repository }) {
    this.repositories = {
      users: repository.users ?? repository,
      campaigns: repository.campaigns ?? repository,
      campaignMembers: repository.campaignMembers ?? repository,
      sections: repository.sections ?? repository,
      fields: repository.fields ?? repository,
      fieldOptions: repository.fieldOptions ?? repository,
      characters: repository.characters ?? repository,
      fieldValues: repository.fieldValues ?? repository,
      fallback: repository,
    };
    this.repository = {
      findByUsername: (username) => {
        const users = this.repositories.users;
        if (typeof users.findByUsername === "function") {
          return users.findByUsername(username);
        }
        return this.repositories.fallback.findByUsername(username);
      },
      findById: (table, id) => {
        const target = this.tableRepository(table);
        return target === this.repositories.fallback
          ? target.findById(table, id)
          : target.findById(id);
      },
      list: (table, predicate) => {
        const target = this.tableRepository(table);
        return target === this.repositories.fallback
          ? target.list(table, predicate)
          : target.list(predicate);
      },
      create: (table, input) => {
        const target = this.tableRepository(table);
        return target === this.repositories.fallback
          ? target.create(table, input)
          : target.create(input);
      },
      update: (table, id, updates) => {
        const target = this.tableRepository(table);
        return target === this.repositories.fallback
          ? target.update(table, id, updates)
          : target.update(id, updates);
      },
      delete: (table, id) => {
        const target = this.tableRepository(table);
        return target === this.repositories.fallback
          ? target.delete(table, id)
          : target.delete(id);
      },
      deleteWhere: (table, predicate) => {
        const target = this.tableRepository(table);
        return target === this.repositories.fallback
          ? target.deleteWhere(table, predicate)
          : target.deleteWhere(predicate);
      },
    };
  }

  async requireRecord(table, id, message) {
    const record = await this.repository.findById(table, id);
    if (!record) {
      throw new RpgServiceError(404, message);
    }
    return record;
  }

  tableRepository(table) {
    const repositories = {
      users: this.repositories.users,
      campaigns: this.repositories.campaigns,
      campaign_members: this.repositories.campaignMembers,
      sections: this.repositories.sections,
      fields: this.repositories.fields,
      field_options: this.repositories.fieldOptions,
      characters: this.repositories.characters,
      field_values: this.repositories.fieldValues,
    };
    const repository = repositories[table];
    if (!repository) {
      throw new Error(`Repositório não configurado para "${table}".`);
    }
    return repository;
  }

  requireRole(actor, expectedRole) {
    if (roleOf(actor) !== expectedRole) {
      throw new RpgServiceError(403, "Você não tem permissão para esta operação.");
    }
  }

  async requireCampaignGM(actor, campaignId) {
    const campaign = await this.requireRecord("campaigns", campaignId, "Campanha não encontrada.");
    if (roleOf(actor) !== "GM" || campaign.gmId !== actor.id) {
      throw new RpgServiceError(403, "Somente o GM responsável pode alterar esta campanha.");
    }
    return campaign;
  }

  async requireCampaignAccess(actor, campaignId) {
    const campaign = await this.requireRecord("campaigns", campaignId, "Campanha não encontrada.");
    if (roleOf(actor) === "GM" && campaign.gmId === actor.id) {
      return campaign;
    }
    const membership = (await this.repositories.campaignMembers.list((member) => (
      member.campaignId === campaignId && member.userId === actor.id && member.status === "ACTIVE"
    )))[0];
    if (!membership) {
      throw new RpgServiceError(403, "Você não participa desta campanha.");
    }
    return campaign;
  }

  async requireCharacterAccess(actor, character) {
    await this.requireCampaignAccess(actor, character.campaignId);
    if (roleOf(actor) !== "GM" && character.userId !== actor.id) {
      throw new RpgServiceError(403, "Você não pode acessar o personagem de outro usuário.");
    }
  }

  canView(field, actor) {
    const permission = roleOf(actor) === "GM" ? "GM" : "PLAYER";
    return field.visibleTo === "BOTH" || field.visibleTo === permission;
  }

  async campaignFields(campaignId) {
    const sections = await this.repositories.sections.list((section) => section.campaignId === campaignId);
    const sectionIds = new Set(sections.map(({ id }) => id));
    return this.repositories.fields.list((field) => sectionIds.has(field.sectionId));
  }

  normalizeField(input, existing = null) {
    const fieldTypes = new Set(["TEXT", "NUMBER", "TEXTAREA", "SELECT", "CHECKBOX", "BOOLEAN", "DATE"]);
    const permissions = new Set(["GM", "PLAYER", "BOTH"]);
    const value = (key, fallback) => Object.hasOwn(input, key) ? input[key] : fallback;
    const name = value("name", existing?.name);
    const label = value("label", existing?.label);
    const type = value("type", existing?.type);
    const required = value("required", existing?.required ?? false);
    const editableBy = value("editableBy", existing?.editableBy);
    const visibleTo = value("visibleTo", existing?.visibleTo);
    const position = value("position", existing?.position ?? 0);
    this.validateLabel(name, "Identificador do campo");
    this.validateLabel(label, "Rótulo do campo");
    if (typeof type !== "string" || !fieldTypes.has(type.toUpperCase())) {
      throw new RpgServiceError(400, "Tipo de campo inválido.");
    }
    if (typeof required !== "boolean") {
      throw new RpgServiceError(400, "A propriedade required deve ser booleana.");
    }
    if (!permissions.has(editableBy) || !permissions.has(visibleTo)) {
      throw new RpgServiceError(400, "Permissão de edição ou visualização inválida.");
    }
    this.validatePosition(position);
    return {
      name: name.trim(), label: label.trim(), type: type.toUpperCase(),
      required, editableBy, visibleTo, position,
    };
  }

  async validateFieldValue(field, value) {
    if (field.type === "NUMBER" && value.trim() && !Number.isFinite(Number(value))) {
      throw new RpgServiceError(400, "Informe um número válido.");
    }
    if (["BOOLEAN", "CHECKBOX"].includes(field.type) && !["true", "false"].includes(value)) {
      throw new RpgServiceError(400, "Informe true ou false para este campo.");
    }
    if (field.type === "DATE") {
      const match = /^\d{4}-\d{2}-\d{2}$/.test(value);
      const date = match ? new Date(`${value}T00:00:00.000Z`) : null;
      if (!date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new RpgServiceError(400, "Informe uma data válida no formato AAAA-MM-DD.");
      }
    }
    if (field.type === "SELECT") {
      const options = await this.repositories.fieldOptions.list((option) => (
        option.fieldId === field.id && option.value === value
      ));
      if (!options.length) {
        throw new RpgServiceError(400, "Selecione uma opção válida para este campo.");
      }
    }
  }

  async deleteFields(fieldIds) {
    const ids = new Set(fieldIds);
    if (!ids.size) {
      return;
    }
    await this.repositories.fieldValues.deleteWhere((value) => ids.has(value.fieldId));
    await this.repositories.fieldOptions.deleteWhere((option) => ids.has(option.fieldId));
    await this.repositories.fields.deleteWhere((field) => ids.has(field.id));
  }

  validateLabel(value, label) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 255) {
      throw new RpgServiceError(400, `${label} obrigatório (até 255 caracteres).`);
    }
  }

  validateDescription(value) {
    if (typeof value !== "string" || value.length > 10000) {
      throw new RpgServiceError(400, "Descrição inválida.");
    }
  }

  validatePosition(value) {
    if (!Number.isInteger(value) || value < 0) {
      throw new RpgServiceError(400, "A posição deve ser um inteiro não negativo.");
    }
  }
}
