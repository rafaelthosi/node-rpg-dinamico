import assert from "node:assert/strict";
import { test } from "node:test";
import { PostgresTableRepository } from "../src/repositories/postgres/PostgresTableRepository.js";
import { PostgresUserRepository } from "../src/repositories/postgres/PostgresUserRepository.js";

test("mapeia registros PostgreSQL para o formato usado pelos serviços", async () => {
  const pool = {
    query: async () => ({
      rows: [{
        id: "user-id",
        username: "mestre",
        password_hash: "hash",
        role: "GM",
        created_at: "2026-01-01T00:00:00.000Z",
      }],
    }),
  };
  const users = new PostgresUserRepository(pool);

  assert.deepEqual(await users.findByUsername("mestre"), {
    id: "user-id",
    username: "mestre",
    passwordHash: "hash",
    role: "gm",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
});

test("salva perfis em maiúsculas conforme o esquema PostgreSQL", async () => {
  let query;
  const pool = {
    query: async (text, values) => {
      query = { text, values };
      return {
        rows: [{
          id: "user-id",
          username: "jogador",
          password_hash: "hash",
          role: values[2],
          created_at: "2026-01-01T00:00:00.000Z",
        }],
      };
    },
  };
  const users = new PostgresUserRepository(pool);
  const created = await users.create({
    username: "jogador",
    passwordHash: "hash",
    role: "player",
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.match(query.text, /INSERT INTO "users"/);
  assert.deepEqual(query.values, [
    "jogador",
    "hash",
    "PLAYER",
    "2026-01-01T00:00:00.000Z",
  ]);
  assert.equal(created.role, "player");
});

test("mantém listagem filtrável e converte conflitos de unicidade", async () => {
  const pool = {
    query: async (text) => {
      if (text.startsWith("SELECT")) {
        return {
          rows: [
            { id: "first", name: "Primeira", description: null, gm_id: "gm", password_hash: "hash", created_at: null },
            { id: "second", name: "Segunda", description: null, gm_id: "gm", password_hash: "hash", created_at: null },
          ],
        };
      }
      throw Object.assign(new Error("unique violation"), { code: "23505", constraint: "users_username_key" });
    },
  };
  const campaigns = new PostgresTableRepository(pool, "campaigns");
  assert.deepEqual((await campaigns.list(({ id }) => id === "second")).map(({ name }) => name), ["Segunda"]);

  const users = new PostgresUserRepository(pool);
  await assert.rejects(users.create({ username: "mestre" }), {
    status: 409,
    message: 'Já existe um usuário com o nome "mestre".',
  });
});

test("reconhece a tabela de valores dos combatentes", async () => {
  const repository = new PostgresTableRepository({
    query: async (text) => {
      assert.equal(text, 'SELECT * FROM "combatant_field_values"');
      return {
        rows: [{
          id: "value-id",
          combatant_id: "combatant-id",
          field_id: "field-id",
          value: "16",
        }],
      };
    },
  }, "combatant_field_values");

  assert.deepEqual(await repository.list(), [{
    id: "value-id",
    combatantId: "combatant-id",
    fieldId: "field-id",
    value: "16",
  }]);
});

test("trata identificadores inválidos como registros inexistentes", async () => {
  let queried = false;
  const repository = new PostgresTableRepository({
    query: async () => {
      queried = true;
      return { rows: [] };
    },
  }, "campaigns");

  assert.equal(await repository.findById("not-a-uuid"), null);
  assert.equal(await repository.update("not-a-uuid", { name: "Nova" }), null);
  assert.equal(await repository.delete("not-a-uuid"), null);
  assert.equal(queried, false);
});
