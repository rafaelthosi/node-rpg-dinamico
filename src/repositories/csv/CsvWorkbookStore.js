import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

const TABLES = {
  users: [
    ["id", "id"], ["username", "username"], ["passwordHash", "password_hash"],
    ["role", "role"], ["createdAt", "created_at"],
  ],
  campaigns: [
    ["id", "id"], ["name", "name"], ["description", "description"], ["gmId", "gm_id"],
    ["passwordHash", "password_hash"], ["createdAt", "created_at"],
  ],
  campaign_members: [
    ["id", "id"], ["campaignId", "campaign_id"], ["userId", "user_id"],
    ["joinedAt", "joined_at"], ["status", "status"],
  ],
  sections: [
    ["id", "id"], ["campaignId", "campaign_id"], ["name", "name"],
    ["description", "description"], ["position", "position"], ["createdAt", "created_at"],
  ],
  fields: [
    ["id", "id"], ["sectionId", "section_id"], ["name", "name"], ["label", "label"],
    ["type", "type"], ["required", "required"], ["editableBy", "editable_by"],
    ["visibleTo", "visible_to"], ["position", "position"],
    ["shareWithNpcs", "share_with_npcs"], ["createdAt", "created_at"],
  ],
  field_options: [
    ["id", "id"], ["fieldId", "field_id"], ["label", "label"], ["value", "value"],
    ["position", "position"],
  ],
  characters: [
    ["id", "id"], ["campaignId", "campaign_id"], ["userId", "user_id"],
    ["name", "name"], ["createdAt", "created_at"],
  ],
  field_values: [
    ["id", "id"], ["characterId", "character_id"], ["fieldId", "field_id"],
    ["value", "value"], ["updatedAt", "updated_at"],
  ],
  combats: [
    ["id", "id"], ["campaignId", "campaign_id"], ["name", "name"],
    ["currentRound", "current_round"], ["currentTurnIndex", "current_turn_index"],
    ["active", "active"], ["createdAt", "created_at"],
  ],
  combatants: [
    ["id", "id"], ["combatId", "combat_id"], ["characterId", "character_id"],
    ["name", "name"], ["isEnemy", "is_enemy"], ["initiative", "initiative"],
    ["actionsPerTurn", "actions_per_turn"],
  ],
  combat_actions: [
    ["id", "id"], ["combatId", "combat_id"], ["combatantId", "combatant_id"],
    ["round", "round"], ["description", "description"], ["damage", "damage"],
    ["createdAt", "created_at"],
  ],
  combat_action_targets: [
    ["id", "id"], ["actionId", "action_id"], ["combatantId", "combatant_id"],
  ],
  combatant_field_values: [
    ["id", "id"], ["combatantId", "combatant_id"], ["fieldId", "field_id"], ["value", "value"],
  ],
  attacks: [
    ["id", "id"], ["characterId", "character_id"], ["name", "name"],
    ["description", "description"], ["damage", "damage"], ["effects", "effects"],
    ["observation", "observation"], ["actionsConsumed", "actions_consumed"],
    ["createdAt", "created_at"],
  ],
};

const NUMERIC_COLUMNS = new Set([
  "position", "currentRound", "currentTurnIndex", "initiative", "actionsPerTurn", "round", "actionsConsumed",
]);
const BOOLEAN_COLUMNS = new Set(["required", "shareWithNpcs", "active", "isEnemy"]);

function parseCsv(content, table) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (quoted) {
      if (character === '"' && content[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"' && value.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n" || character === "\r") {
      row.push(value);
      value = "";
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      if (character === "\r" && content[index + 1] === "\n") {
        index += 1;
      }
    } else {
      value += character;
    }
  }
  if (quoted) {
    throw new Error(`O CSV da tabela "${table}" contém aspas não fechadas.`);
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  if (!rows.length) {
    return [];
  }

  let columns = TABLES[table];
  const expectedHeaders = columns.map(([, header]) => header);
  const headers = rows[0].map((header, index) => (
    index === 0 ? header.replace(/^\uFEFF/, "") : header
  ));
  const legacyFieldHeaders = table === "fields"
    ? expectedHeaders.filter((header) => header !== "share_with_npcs")
    : null;
  const isLegacyFieldsFile = legacyFieldHeaders
    && headers.length === legacyFieldHeaders.length
    && legacyFieldHeaders.every((header, index) => headers[index] === header);
  if (isLegacyFieldsFile) {
    columns = columns.filter(([key]) => key !== "shareWithNpcs");
  } else if (headers.length !== expectedHeaders.length
      || expectedHeaders.some((header, index) => headers[index] !== header)) {
    throw new Error(`O arquivo CSV da tabela "${table}" possui cabeçalhos incompatíveis.`);
  }

  return rows.slice(1).map((cells, rowIndex) => {
    const rowHeaders = isLegacyFieldsFile ? legacyFieldHeaders : expectedHeaders;
    if (cells.length !== rowHeaders.length) {
      throw new Error(`A linha ${rowIndex + 2} do CSV "${table}" possui quantidade de colunas inválida.`);
    }
    return {
      ...Object.fromEntries(
        columns.map(([key], index) => [key, parseValue(key, cells[index])]),
      ),
      ...(isLegacyFieldsFile ? { shareWithNpcs: false } : {}),
    };
  });
}

function parseValue(key, value) {
  if (value === "") {
    return null;
  }
  if (NUMERIC_COLUMNS.has(key)) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error(`Valor numérico inválido na coluna "${key}".`);
    }
    return number;
  }
  if (BOOLEAN_COLUMNS.has(key)) {
    if (value !== "true" && value !== "false") {
      throw new Error(`Valor booleano inválido na coluna "${key}".`);
    }
    return value === "true";
  }
  return value;
}

function escapeCsv(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function serializeCsv(table, records) {
  const columns = TABLES[table];
  const lines = [
    columns.map(([, header]) => escapeCsv(header)).join(","),
    ...records.map((record) => columns
      .map(([key]) => escapeCsv(record[key]))
      .join(",")),
  ];
  return `${lines.join("\r\n")}\r\n`;
}

function excelCellValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && "text" in value) {
    return String(value.text);
  }
  return String(value);
}

export class CsvWorkbookStore {
  constructor(directoryPath, legacyExcelPath) {
    this.directoryPath = path.resolve(directoryPath);
    this.legacyExcelPath = path.resolve(legacyExcelPath);
    this.tables = new Map();
    this.writeQueue = Promise.resolve();
  }

  async initialize() {
    await mkdir(this.directoryPath, { recursive: true });

    const needsLegacyImport = await Promise.all(Object.keys(TABLES).map(async (table) => {
      try {
        await access(this.#filePath(table));
        return false;
      } catch (error) {
        if (error.code === "ENOENT") {
          return true;
        }
        throw error;
      }
    }));
    const workbook = needsLegacyImport.some(Boolean)
      ? await this.#readLegacyWorkbook()
      : null;
    for (const [table, columns] of Object.entries(TABLES)) {
      const csvPath = this.#filePath(table);
      try {
        const content = await readFile(csvPath, "utf8");
        this.tables.set(table, parseCsv(content, table));
        continue;
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }

      let records = [];
      if (workbook) {
        records = this.#importExcelTable(workbook, table, columns);
      }
      if (!records.length && table === "users") {
        records = await this.#importUsersExportCsv();
      }
      this.tables.set(table, records);
      await this.#persist(table);
    }
  }

  findByUsername(username) {
    return this.list("users", (user) => user.username === username)
      .then((users) => users[0] ?? null);
  }

  async create(table, input) {
    return this.#mutate(table, (records) => {
      if (table === "users" && records.some((user) => user.username === input.username)) {
        throw this.#conflict(`Já existe um usuário com o nome "${input.username}".`);
      }
      const uniquePairs = {
        campaign_members: ["campaignId", "userId"],
        field_values: ["characterId", "fieldId"],
        field_options: ["fieldId", "value"],
        combat_action_targets: ["actionId", "combatantId"],
        combatant_field_values: ["combatantId", "fieldId"],
      };
      const keys = uniquePairs[table];
      if (keys && records.some((record) => keys.every((key) => record[key] === input[key]))) {
        throw this.#conflict("Já existe um registro com esses dados.");
      }
      const record = { ...input, id: input.id ?? randomUUID() };
      records.push(record);
      return record;
    });
  }

  async findById(table, id) {
    return (await this.list(table, (record) => record.id === id))[0] ?? null;
  }

  async list(table, predicate = () => true) {
    const records = this.#table(table);
    return records.filter(predicate).map((record) => ({ ...record }));
  }

  async update(table, id, updates) {
    return this.#mutate(table, (records) => {
      const record = records.find((item) => item.id === id);
      if (!record) {
        return null;
      }
      Object.assign(record, updates);
      return { ...record };
    });
  }

  async delete(table, id) {
    return this.#mutate(table, (records) => {
      const index = records.findIndex((record) => record.id === id);
      if (index === -1) {
        return null;
      }
      return records.splice(index, 1)[0];
    });
  }

  async deleteWhere(table, predicate) {
    return this.#mutate(table, (records) => {
      const deleted = [];
      for (let index = records.length - 1; index >= 0; index -= 1) {
        if (predicate(records[index])) {
          deleted.push(records.splice(index, 1)[0]);
        }
      }
      return deleted;
    });
  }

  #table(table) {
    const records = this.tables.get(table);
    if (!records) {
      throw new Error(`Tabela CSV desconhecida: ${table}.`);
    }
    return records;
  }

  async #mutate(table, operation) {
    const queued = this.writeQueue.then(async () => {
      const records = this.#table(table);
      const snapshot = records.map((record) => ({ ...record }));
      try {
        const result = operation(records);
        if (result === null) {
          return null;
        }
        await this.#persist(table);
        return result;
      } catch (error) {
        this.tables.set(table, snapshot);
        throw error;
      }
    });
    this.writeQueue = queued.catch(() => {});
    return queued;
  }

  #conflict(message) {
    return Object.assign(new Error(message), { status: 409 });
  }

  async #persist(table) {
    const filePath = this.#filePath(table);
    const temporaryPath = `${filePath}.tmp`;
    await writeFile(temporaryPath, serializeCsv(table, this.#table(table)), "utf8");
    await rename(temporaryPath, filePath);
  }

  #filePath(table) {
    return path.join(this.directoryPath, `${table}.csv`);
  }

  async #importUsersExportCsv() {
    const sourcePath = path.join(this.directoryPath, "users-export.csv");
    try {
      return parseCsv(await readFile(sourcePath, "utf8"), "users");
    } catch (error) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async #readLegacyWorkbook() {
    try {
      await access(this.legacyExcelPath);
    } catch (error) {
      if (error.code === "ENOENT") {
        return null;
      }
      throw error;
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.legacyExcelPath);
    return workbook;
  }

  #importExcelTable(workbook, table, columns) {
    const worksheet = workbook.getWorksheet(table);
    if (!worksheet) {
      return [];
    }
    const sourceHeaders = worksheet.getRow(1).values.slice(1);
    const legacyColumns = table === "fields"
      ? columns.filter(([key]) => key !== "shareWithNpcs")
      : columns;
    const headerKeys = columns.map(([key, header]) => (
      table === "users"
        ? ({ id: "id", username: "username", passwordHash: "password_hash", role: "role", createdAt: "created_at" })[key]
        : key
    ));
    const legacyHeaderKeys = legacyColumns.map(([key]) => key);
    const isLegacyFieldsSheet = table === "fields"
      && sourceHeaders.length === legacyHeaderKeys.length
      && legacyHeaderKeys.every((header, index) => sourceHeaders[index] === header);
    if (!isLegacyFieldsSheet && headerKeys.some((header, index) => sourceHeaders[index] !== header)) {
      throw new Error(`A aba "${table}" da planilha antiga possui colunas incompatíveis.`);
    }

    const sourceColumns = isLegacyFieldsSheet ? legacyColumns : columns;
    const records = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        records.push({
          ...Object.fromEntries(sourceColumns.map(([key], index) => [
            key,
            parseValue(key, excelCellValue(row.getCell(index + 1).value) ?? ""),
          ])),
          ...(isLegacyFieldsSheet ? { shareWithNpcs: false } : {}),
        });
      }
    });
    return records;
  }
}
