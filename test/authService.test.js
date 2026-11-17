import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AuthService } from "../src/services/authService.js";

const jwtSecret = "test-secret-with-more-than-thirty-two-characters";
const password = "correct-horse-battery-staple";
const user = {
  id: "gm-id",
  username: "mestre",
  passwordHash: "",
  role: "gm",
  createdAt: new Date().toISOString(),
};

let authService;

before(async () => {
  user.passwordHash = await bcrypt.hash(password, 4);
  authService = new AuthService({
    userRepository: {
      findByUsername: async (username) => username === user.username ? user : null,
    },
    jwtSecret,
  });
});

after(() => {
  user.passwordHash = "";
});

test("faz login de GM com a senha correta e retorna JWT", async () => {
  const session = await authService.login(" MESTRE ", password);

  assert.equal(session.user.username, "mestre");
  assert.equal(session.user.role, "gm");
  assert.equal(jwt.verify(session.token, jwtSecret).sub, user.id);
});

test("recusa senha incorreta e usuário ausente", async () => {
  assert.equal(await authService.login("mestre", "senha-incorreta"), null);
  assert.equal(await authService.login("desconhecido", password), null);
});

test("autentica usuários PLAYER", async () => {
  const player = {
    ...user,
    id: "player-id",
    username: "jogador",
    role: "player",
  };
  const playerAuthService = new AuthService({
    userRepository: {
      findByUsername: async (username) => username === player.username ? player : null,
    },
    jwtSecret,
  });

  const session = await playerAuthService.login("JOGADOR", password);
  assert.equal(session.user.role, "player");
  assert.equal(jwt.verify(session.token, jwtSecret).sub, player.id);
});
