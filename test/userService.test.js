import assert from "node:assert/strict";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import { UserService } from "../src/services/userService.js";

test("cadastra GM publicamente com senha em hash", async () => {
  let createdUser;
  const service = new UserService({
    repository: {
      findByUsername: async () => null,
      create: async (_table, user) => {
        createdUser = { id: "gm-1", ...user };
        return createdUser;
      },
    },
  });

  const user = await service.registerGM({
    username: " NOVO-MESTRE ",
    password: "senha-generica-gm-123",
  });

  assert.deepEqual(user, {
    id: "gm-1",
    username: "novo-mestre",
    role: "gm",
    createdAt: createdUser.createdAt,
  });
  assert.notEqual(createdUser.passwordHash, "senha-generica-gm-123");
  assert.equal(await bcrypt.compare("senha-generica-gm-123", createdUser.passwordHash), true);
});

test("permite cadastro PLAYER e recusa nomes duplicados", async () => {
  const registered = [];
  const service = new UserService({
    repository: {
      findByUsername: async (username) => registered.find((user) => user.username === username) ?? null,
      create: async (_table, user) => {
        const created = { id: String(registered.length + 1), ...user };
        registered.push(created);
        return created;
      },
    },
  });

  const player = await service.registerPlayer({
    username: "jogador",
    password: "senha-generica-player-123",
  });
  assert.equal(player.role, "player");
  await assert.rejects(
    service.registerGM({ username: "JOGADOR", password: "senha-generica-gm-123" }),
    { status: 409 },
  );
});
