import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { PostgresCampaignRepository } from "./PostgresCampaignRepository.js";
import { PostgresCampaignMemberRepository } from "./PostgresCampaignMemberRepository.js";
import { PostgresCharacterRepository } from "./PostgresCharacterRepository.js";
import { PostgresFieldOptionRepository } from "./PostgresFieldOptionRepository.js";
import { PostgresFieldRepository } from "./PostgresFieldRepository.js";
import { PostgresFieldValueRepository } from "./PostgresFieldValueRepository.js";
import { PostgresSectionRepository } from "./PostgresSectionRepository.js";
import { PostgresUserRepository } from "./PostgresUserRepository.js";
import { PostgresTableRepository } from "./PostgresTableRepository.js";

const { Pool } = pg;

export class PostgresRpgRepository {
  constructor(connectionString) {
    this.pool = new Pool({ connectionString });
    this.users = new PostgresUserRepository(this.pool);
    this.campaigns = new PostgresCampaignRepository(this.pool);
    this.campaignMembers = new PostgresCampaignMemberRepository(this.pool);
    this.sections = new PostgresSectionRepository(this.pool);
    this.fields = new PostgresFieldRepository(this.pool);
    this.fieldOptions = new PostgresFieldOptionRepository(this.pool);
    this.characters = new PostgresCharacterRepository(this.pool);
    this.fieldValues = new PostgresFieldValueRepository(this.pool);
    this.combats = new PostgresTableRepository(this.pool, "combats");
    this.combatants = new PostgresTableRepository(this.pool, "combatants");
    this.combatActions = new PostgresTableRepository(this.pool, "combat_actions");
    this.combatActionTargets = new PostgresTableRepository(this.pool, "combat_action_targets");
    this.combatantFieldValues = new PostgresTableRepository(this.pool, "combatant_field_values");
    this.attacks = new PostgresTableRepository(this.pool, "attacks");
    this.tables = new Map([
      ["users", this.users],
      ["campaigns", this.campaigns],
      ["campaign_members", this.campaignMembers],
      ["sections", this.sections],
      ["fields", this.fields],
      ["field_options", this.fieldOptions],
      ["characters", this.characters],
      ["field_values", this.fieldValues],
      ["combats", this.combats],
      ["combatants", this.combatants],
      ["combat_actions", this.combatActions],
      ["combat_action_targets", this.combatActionTargets],
      ["combatant_field_values", this.combatantFieldValues],
      ["attacks", this.attacks],
    ]);
  }

  async initialize() {
    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS rpg_schema_migrations (
          version TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      for (const version of [
        "001_create_database_schema.sql",
        "002_add_combats_attacks.sql",
      ]) {
        const applied = await client.query(
          "SELECT 1 FROM rpg_schema_migrations WHERE version = $1",
          [version],
        );
        if (applied.rowCount) {
          continue;
        }

        const migration = await readFile(
          fileURLToPath(new URL(`./migrations/${version}`, import.meta.url)),
          "utf8",
        );
        await client.query("BEGIN");
        try {
          await client.query(migration);
          await client.query(
            "INSERT INTO rpg_schema_migrations (version) VALUES ($1)",
            [version],
          );
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    } finally {
      client.release();
    }
  }

  findByUsername(username) {
    return this.users.findByUsername(username);
  }

  findById(table, id) {
    return this.#table(table).findById(id);
  }

  list(table, predicate) {
    return this.#table(table).list(predicate);
  }

  create(table, input) {
    return this.#table(table).create(input);
  }

  update(table, id, updates) {
    return this.#table(table).update(id, updates);
  }

  delete(table, id) {
    return this.#table(table).delete(id);
  }

  deleteWhere(table, predicate) {
    return this.#table(table).deleteWhere(predicate);
  }

  #table(name) {
    const repository = this.tables.get(name);
    if (!repository) {
      throw new Error(`Tabela PostgreSQL desconhecida: ${name}.`);
    }
    return repository;
  }
}
