import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, test } from "node:test";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";

const jwtSecret = "test-secret-with-more-than-thirty-two-characters";
const server = createApp({
  authService: {
    login: async (username, password) => (
      (username === "mestre" && password === "senha-correta")
      || (username === "gm-aberto" && password === "senha-generica-gm-123")
        ? { token: "jwt-de-teste", user: { username, role: "gm" } }
        : null
    ),
  },
  rpgService: {
    users: {
      registerPlayer: async () => ({}),
      registerGM: async ({ username }) => ({ id: "gm-open-id", username, role: "gm" }),
    },
    campaigns: { list: async (actor) => [{ ownerId: actor.id }] },
    members: {},
    sections: {},
    fields: {},
    characters: {},
  },
  jwtSecret,
  corsOrigin: "http://localhost:5173",
}).listen(0);

let baseUrl;

before(async () => {
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await once(server, "close");
});

test("expõe saúde da API e autenticação de GM", async () => {
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: "ok" });

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "mestre", password: "senha-correta" }),
  });
  assert.equal(loginResponse.status, 200);
  assert.deepEqual(await loginResponse.json(), {
    token: "jwt-de-teste",
    user: { username: "mestre", role: "gm" },
  });

  const invalidLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "mestre", password: "errada" }),
  });
  assert.equal(invalidLoginResponse.status, 401);
});

test("protege endpoints de campanhas com token e identidade autenticada", async () => {
  const unauthorized = await fetch(`${baseUrl}/api/campaigns`);
  assert.equal(unauthorized.status, 401);

  const token = jwt.sign({ role: "player" }, jwtSecret, { subject: "player-123" });
  const response = await fetch(`${baseUrl}/api/campaigns`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{ ownerId: "player-123" }]);
});

test("permite cadastro público de GM e devolve uma sessão autenticada", async () => {
  const response = await fetch(`${baseUrl}/api/auth/register/gm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "gm-aberto", password: "senha-generica-gm-123" }),
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    token: "jwt-de-teste",
    user: { id: "gm-open-id", username: "gm-aberto", role: "gm" },
  });
});
