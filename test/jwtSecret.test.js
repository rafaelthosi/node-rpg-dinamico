import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { resolveJwtSecret } from "../src/config/jwtSecret.js";

let directory;
let secretFile;

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "rpg-jwt-secret-"));
  secretFile = path.join(directory, "data", "jwt.secret");
});

after(async () => {
  await rm(directory, { recursive: true, force: true });
});

test("gera um segredo seguro e reutiliza-o após reinicialização", async () => {
  const generatedSecret = await resolveJwtSecret("", secretFile);
  const persistedSecret = await readFile(secretFile, "utf8");

  assert.ok(generatedSecret.length >= 32);
  assert.equal(persistedSecret.trim(), generatedSecret);
  assert.equal((await stat(secretFile)).mode & 0o777, 0o600);
  assert.equal(await resolveJwtSecret(undefined, secretFile), generatedSecret);
});

test("prioriza segredo configurado e rejeita valor curto", async () => {
  const configuredSecret = "configured-secret-with-at-least-32-characters";
  assert.equal(await resolveJwtSecret(configuredSecret, secretFile), configuredSecret);
  await assert.rejects(
    resolveJwtSecret("short", secretFile),
    /JWT_SECRET deve conter pelo menos 32 caracteres/,
  );
});
