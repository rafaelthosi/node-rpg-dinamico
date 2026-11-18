export const POSTGRES_TABLES = {
  users: {
    sqlName: "users",
    columns: {
      id: "id",
      username: "username",
      passwordHash: "password_hash",
      role: "role",
      createdAt: "created_at",
    },
  },
  campaigns: {
    sqlName: "campaigns",
    columns: {
      id: "id",
      name: "name",
      description: "description",
      gmId: "gm_id",
      passwordHash: "password_hash",
      createdAt: "created_at",
    },
  },
  campaign_members: {
    sqlName: "campaign_members",
    columns: {
      id: "id",
      campaignId: "campaign_id",
      userId: "user_id",
      joinedAt: "joined_at",
      status: "status",
    },
  },
  sections: {
    sqlName: "sections",
    columns: {
      id: "id",
      campaignId: "campaign_id",
      name: "name",
      description: "description",
      position: "position",
      createdAt: "created_at",
    },
  },
  fields: {
    sqlName: "fields",
    columns: {
      id: "id",
      sectionId: "section_id",
      name: "name",
      label: "label",
      type: "type",
      required: "required",
      editableBy: "editable_by",
      visibleTo: "visible_to",
      position: "position",
      shareWithNpcs: "share_with_npcs",
      createdAt: "created_at",
    },
  },
  field_options: {
    sqlName: "field_options",
    columns: {
      id: "id",
      fieldId: "field_id",
      label: "label",
      value: "value",
      position: "position",
    },
  },
  characters: {
    sqlName: "characters",
    columns: {
      id: "id",
      campaignId: "campaign_id",
      userId: "user_id",
      name: "name",
      hitPoints: "hit_points",
      usesHitPoints: "uses_hit_points",
      createdAt: "created_at",
    },
  },
  field_values: {
    sqlName: "field_values",
    columns: {
      id: "id",
      characterId: "character_id",
      fieldId: "field_id",
      value: "value",
      updatedAt: "updated_at",
    },
  },
  combats: {
    sqlName: "combats",
    columns: {
      id: "id",
      campaignId: "campaign_id",
      name: "name",
      currentRound: "current_round",
      currentTurnIndex: "current_turn_index",
      active: "active",
      gridRows: "grid_rows",
      gridColumns: "grid_columns",
      createdAt: "created_at",
    },
  },
  combatants: {
    sqlName: "combatants",
    columns: {
      id: "id",
      combatId: "combat_id",
      characterId: "character_id",
      name: "name",
      isEnemy: "is_enemy",
      initiative: "initiative",
      actionsPerTurn: "actions_per_turn",
      position: "position",
    },
  },
  combat_actions: {
    sqlName: "combat_actions",
    columns: {
      id: "id",
      combatId: "combat_id",
      combatantId: "combatant_id",
      round: "round",
      description: "description",
      damage: "damage",
      position: "position",
      actionType: "action_type",
      attackId: "attack_id",
      attackName: "attack_name",
      actionsCount: "actions_count",
      createdAt: "created_at",
    },
  },
  combat_action_targets: {
    sqlName: "combat_action_targets",
    columns: {
      id: "id",
      actionId: "action_id",
      combatantId: "combatant_id",
    },
  },
  combatant_field_values: {
    sqlName: "combatant_field_values",
    columns: {
      id: "id",
      combatantId: "combatant_id",
      fieldId: "field_id",
      value: "value",
    },
  },
  attacks: {
    sqlName: "attacks",
    columns: {
      id: "id",
      characterId: "character_id",
      name: "name",
      description: "description",
      damage: "damage",
      effects: "effects",
      observation: "observation",
      actionsConsumed: "actions_consumed",
      createdAt: "created_at",
    },
  },
};

function definition(table) {
  const tableDefinition = POSTGRES_TABLES[table];
  if (!tableDefinition) {
    throw new Error(`Tabela PostgreSQL desconhecida: ${table}.`);
  }
  return tableDefinition;
}

export function mapPostgresRecord(table, row) {
  if (!row) {
    return null;
  }
  const columns = definition(table).columns;
  const record = Object.fromEntries(
    Object.entries(columns).map(([property, column]) => [property, row[column]]),
  );
  if (table === "users" && record.role) {
    record.role = record.role.toLowerCase();
  }
  return record;
}

function databaseValue(table, property, value) {
  if (table === "users" && property === "role" && typeof value === "string") {
    return value.toUpperCase();
  }
  return value;
}

function isUuid(value) {
  return typeof value === "string"
    && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
}

export class PostgresTableRepository {
  constructor(pool, table) {
    this.pool = pool;
    this.table = table;
    this.tableDefinition = definition(table);
  }

  async findById(id) {
    if (!isUuid(id)) {
      return null;
    }
    const result = await this.pool.query(
      `SELECT * FROM "${this.tableDefinition.sqlName}" WHERE id = $1`,
      [id],
    );
    return mapPostgresRecord(this.table, result.rows[0]);
  }

  async list(predicate = () => true) {
    const result = await this.pool.query(`SELECT * FROM "${this.tableDefinition.sqlName}"`);
    return result.rows.map((row) => mapPostgresRecord(this.table, row)).filter(predicate);
  }

  async create(input) {
    const entries = this.#entries(input);
    if (!entries.length) {
      throw new Error(`Nenhum campo informado para criar registro em "${this.table}".`);
    }
    const columns = entries.map(([property]) => `"${this.tableDefinition.columns[property]}"`);
    const placeholders = entries.map((_, index) => `$${index + 1}`);
    const values = entries.map(([property, value]) => databaseValue(this.table, property, value));

    try {
      const result = await this.pool.query(
        `INSERT INTO "${this.tableDefinition.sqlName}" (${columns.join(", ")}) `
          + `VALUES (${placeholders.join(", ")}) RETURNING *`,
        values,
      );
      return mapPostgresRecord(this.table, result.rows[0]);
    } catch (error) {
      if (error.code === "23505") {
        const message = this.table === "users" && error.constraint === "users_username_key"
          ? `Já existe um usuário com o nome "${input.username}".`
          : "Já existe um registro com esses dados.";
        throw Object.assign(new Error(message), { status: 409 });
      }
      throw error;
    }
  }

  async update(id, updates) {
    if (!isUuid(id)) {
      return null;
    }
    const entries = this.#entries(updates).filter(([property]) => property !== "id");
    if (!entries.length) {
      return this.findById(id);
    }
    const assignments = entries.map(
      ([property], index) => `"${this.tableDefinition.columns[property]}" = $${index + 1}`,
    );
    const values = entries.map(([property, value]) => databaseValue(this.table, property, value));
    values.push(id);
    const result = await this.pool.query(
      `UPDATE "${this.tableDefinition.sqlName}" SET ${assignments.join(", ")} `
        + `WHERE id = $${values.length} RETURNING *`,
      values,
    );
    return mapPostgresRecord(this.table, result.rows[0]);
  }

  async delete(id) {
    if (!isUuid(id)) {
      return null;
    }
    const result = await this.pool.query(
      `DELETE FROM "${this.tableDefinition.sqlName}" WHERE id = $1 RETURNING *`,
      [id],
    );
    return mapPostgresRecord(this.table, result.rows[0]);
  }

  async deleteWhere(predicate) {
    const matches = await this.list(predicate);
    if (!matches.length) {
      return [];
    }
    const ids = matches.map(({ id }) => id);
    const result = await this.pool.query(
      `DELETE FROM "${this.tableDefinition.sqlName}" WHERE id = ANY($1::uuid[]) RETURNING *`,
      [ids],
    );
    return result.rows.map((row) => mapPostgresRecord(this.table, row));
  }

  #entries(input) {
    return Object.entries(input).filter(([property, value]) => {
      if (value === undefined) {
        return false;
      }
      if (!Object.hasOwn(this.tableDefinition.columns, property)) {
        throw new Error(`Coluna desconhecida "${property}" na tabela "${this.table}".`);
      }
      return true;
    });
  }
}
