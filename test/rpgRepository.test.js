import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import ExcelJS from "exceljs";
import { CsvRpgRepository } from "../src/repositories/CsvRpgRepository.js";
import { RpgService } from "../src/services/rpgService.js";

let directory;

after(async () => {
  if (directory) {
    await rm(directory, { recursive: true, force: true });
  }
});

test("persiste entidades do RPG e aplica escopo de personagem/campanha", async () => {
  directory = await mkdtemp(path.join(tmpdir(), "rpg-database-"));
  const repository = new CsvRpgRepository(directory, path.join(directory, "missing.xlsx"));
  await repository.initialize();

  const gm = await repository.create("users", {
    username: "mestre", passwordHash: "hash-gm", role: "gm", createdAt: new Date().toISOString(),
  });
  const player = await repository.create("users", {
    username: "jogador", passwordHash: "hash-player", role: "player",
    createdAt: new Date().toISOString(),
  });
  const otherPlayer = await repository.create("users", {
    username: "outro", passwordHash: "hash-outro", role: "player",
    createdAt: new Date().toISOString(),
  });
  const unlinkedPlayer = await repository.create("users", {
    username: "sem-vinculo", passwordHash: "hash-sem-vinculo", role: "player",
    createdAt: new Date().toISOString(),
  });
  const service = new RpgService({ repository });
  const gmActor = { id: gm.id, role: "gm" };
  const playerActor = { id: player.id, role: "player" };
  const campaign = await service.createCampaign(gmActor, {
    name: "Aventura", description: "Teste", password: "senha-campanha",
  });
  const otherCampaign = await service.createCampaign(gmActor, {
    name: "Outra aventura", password: "senha-campanha",
  });

  await repository.create("campaign_members", {
    campaignId: campaign.id, userId: player.id, status: "ACTIVE",
    joinedAt: new Date().toISOString(),
  });
  await repository.create("campaign_members", {
    campaignId: campaign.id, userId: otherPlayer.id, status: "ACTIVE",
    joinedAt: new Date().toISOString(),
  });
  const section = await service.createSection(gmActor, campaign.id, { name: "Ficha" });
  const field = await service.createField(gmActor, section.id, {
    name: "name", label: "Nome", type: "TEXT", required: true,
    editableBy: "PLAYER", visibleTo: "BOTH",
  });
  const classField = await service.createField(gmActor, section.id, {
    name: "class", label: "Classe", type: "SELECT", required: true,
    editableBy: "PLAYER", visibleTo: "BOTH",
  });
  await service.createFieldOption(gmActor, classField.id, {
    label: "Guerreiro", value: "warrior", position: 0,
  });
  const privateField = await service.createField(gmActor, section.id, {
    name: "secret", label: "Segredo", type: "TEXT", required: false,
    editableBy: "GM", visibleTo: "GM",
  });
  const playerOnlyField = await service.createField(gmActor, section.id, {
    name: "privateToPlayers", label: "Notas do jogador", type: "TEXT", required: false,
    editableBy: "PLAYER", visibleTo: "PLAYER",
  });
  const character = await service.createCharacter(playerActor, campaign.id, { name: "Thorin" });
  const gmCreatedCharacter = await service.createCharacter(gmActor, campaign.id, {
    name: "Brisa", userId: player.id,
  });
  assert.equal(gmCreatedCharacter.userId, player.id);
  await assert.rejects(
    service.createCharacter(gmActor, campaign.id, { name: "Sem vínculo", userId: unlinkedPlayer.id }),
    { status: 400 },
  );
  await assert.rejects(
    service.createCharacter(playerActor, campaign.id, { name: "Outro jogador", userId: otherPlayer.id }),
    { status: 403 },
  );
  assert.equal((await service.joinCampaign(playerActor, campaign.id, "senha-campanha")).status, "ACTIVE");
  await service.addMember(gmActor, campaign.id, { userId: unlinkedPlayer.id, status: "PENDING" });
  assert.equal(
    (await service.listCampaigns({ id: unlinkedPlayer.id, role: "player" })).some(
      ({ id }) => id === campaign.id,
    ),
    true,
  );
  assert.equal((await service.joinCampaign(
    { id: unlinkedPlayer.id, role: "player" }, campaign.id, "senha-campanha",
  )).status,
    "ACTIVE",
  );

  const savedValue = await service.setFieldValue(playerActor, character.id, field.id, { value: "Thorin" });
  assert.equal(savedValue.value, "Thorin");
  const savedClass = await service.setFieldValue(
    playerActor,
    character.id,
    classField.id,
    { value: "warrior" },
  );
  assert.equal(savedClass.characterId, character.id);
  assert.equal(savedClass.fieldId, classField.id);
  assert.equal(savedClass.value, "warrior");
  assert.deepEqual(
    (await service.listFields(playerActor, section.id)).map(({ id }) => id),
    [field.id, classField.id, playerOnlyField.id],
  );
  assert.deepEqual(
    (await service.listFields(gmActor, section.id)).map(({ id }) => id),
    [field.id, classField.id, privateField.id, playerOnlyField.id],
  );
  assert.deepEqual((await service.listFieldValues(playerActor, character.id)).map(({ fieldId }) => fieldId), [
    field.id,
    classField.id,
  ]);
  await assert.rejects(
    service.setFieldValue(playerActor, character.id, privateField.id, { value: "oculto" }),
    { status: 403 },
  );
  await assert.rejects(
    service.setFieldValue(playerActor, character.id, (await service.createField(
      gmActor,
      (await service.createSection(gmActor, otherCampaign.id, { name: "Outra ficha" })).id,
      {
        name: "other", label: "Outro", type: "TEXT", required: false,
        editableBy: "BOTH", visibleTo: "BOTH",
      },
    )).id, { value: "inválido" }),
    { status: 400 },
  );
  await assert.rejects(
    service.updateCharacter({ id: otherPlayer.id, role: "player" }, character.id, { name: "Não permitido" }),
    { status: 403 },
  );

  const reloaded = new CsvRpgRepository(directory, path.join(directory, "missing.xlsx"));
  await reloaded.initialize();
  assert.equal((await reloaded.findById("characters", character.id)).name, "Thorin");
  const reloadedValues = await reloaded.list("field_values", (value) => (
    value.characterId === character.id
  ));
  assert.deepEqual(reloadedValues.map(({ characterId, fieldId, value }) => (
    { characterId, fieldId, value }
  )), [
    { characterId: character.id, fieldId: field.id, value: "Thorin" },
    { characterId: character.id, fieldId: classField.id, value: "warrior" },
  ]);
  assert.equal((await reloaded.findById("users", player.id)).passwordHash, "hash-player");
  assert.match(await readFile(path.join(directory, "users.csv"), "utf8"), /^id,username,password_hash,role,created_at\r\n/);
  await assert.rejects(access(path.join(directory, "missing.xlsx")), { code: "ENOENT" });
});

test("importa dados de uma planilha Excel antiga para arquivos CSV", async () => {
  const fixtureDirectory = await mkdtemp(path.join(directory, "legacy-"));
  const legacyPath = path.join(fixtureDirectory, "legacy.xlsx");
  const workbook = new ExcelJS.Workbook();
  const users = workbook.addWorksheet("users");
  users.addRow(["id", "username", "password_hash", "role", "created_at"]);
  users.addRow(["user-1", "mestre-antigo", "bcrypt-hash", "gm", "2026-01-01T00:00:00.000Z"]);
  const campaigns = workbook.addWorksheet("campaigns");
  campaigns.addRow(["id", "name", "description", "gmId", "passwordHash", "createdAt"]);
  campaigns.addRow(["campaign-1", "Aventura antiga", "", "user-1", "campaign-hash", "2026-01-01"]);
  await workbook.xlsx.writeFile(legacyPath);

  const repository = new CsvRpgRepository(path.join(fixtureDirectory, "csv"), legacyPath);
  await repository.initialize();
  assert.equal((await repository.findByUsername("mestre-antigo")).id, "user-1");
  assert.equal((await repository.findById("campaigns", "campaign-1")).name, "Aventura antiga");
  assert.match(
    await readFile(path.join(fixtureDirectory, "csv", "campaigns.csv"), "utf8"),
    /^id,name,description,gm_id,password_hash,created_at\r\n/,
  );
});

test("usa users-export.csv como fonte inicial se não houver planilha antiga", async () => {
  const fixtureDirectory = await mkdtemp(path.join(directory, "export-"));
  const exportPath = path.join(fixtureDirectory, "users-export.csv");
  await writeFile(
    exportPath,
    "id,username,password_hash,role,created_at\r\nuser-export,exportado,bcrypt-hash,gm,2026-01-01T00:00:00.000Z\r\n",
  );
  const repository = new CsvRpgRepository(fixtureDirectory, path.join(fixtureDirectory, "missing.xlsx"));
  await repository.initialize();

  assert.equal((await repository.findByUsername("exportado")).id, "user-export");
});

test("faz round-trip de CSV com vírgula, aspas e quebras de linha", async () => {
  const repository = new CsvRpgRepository(
    directory,
    path.join(directory, "missing.xlsx"),
  );
  await repository.initialize();
  const campaign = await repository.create("campaigns", {
    name: 'Aventura, "A Grande"',
    description: "Primeira linha\nsegunda linha",
    gmId: "gm-id",
    passwordHash: "hash",
    createdAt: new Date().toISOString(),
  });
  const reloaded = new CsvRpgRepository(directory, path.join(directory, "missing.xlsx"));
  await reloaded.initialize();
  assert.deepEqual(await reloaded.findById("campaigns", campaign.id), campaign);
});
