import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { resolveJwtSecret } from "./jwtSecret.js";

dotenv.config();

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`A variável de ambiente ${name} é obrigatória.`);
  }
  return value;
}

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT deve ser um número entre 1 e 65535.");
}

const jwtSecret = await resolveJwtSecret(
  process.env.JWT_SECRET,
  fileURLToPath(new URL("../../data/jwt.secret", import.meta.url)),
);

export const config = {
  port,
  jwtSecret,
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  storageDriver: process.env.STORAGE_DRIVER ?? "csv",
  databaseUrl: process.env.DATABASE_URL?.trim(),
  csvDatabasePath: process.env.CSV_DATABASE_PATH ?? "./data/csv",
  legacyExcelDatabasePath:
    process.env.LEGACY_EXCEL_DATABASE_PATH ?? process.env.EXCEL_DATABASE_PATH ?? "./data/users.xlsx",
};

if (!["csv", "postgres"].includes(config.storageDriver)) {
  throw new Error("STORAGE_DRIVER deve ser csv ou postgres.");
}

if (config.storageDriver === "postgres" && !config.databaseUrl) {
  throw new Error("DATABASE_URL é obrigatória quando STORAGE_DRIVER=postgres.");
}
