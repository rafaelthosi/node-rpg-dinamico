import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function validateSecret(secret) {
  const normalizedSecret = secret.trim();
  if (normalizedSecret.length < 32) {
    throw new Error("JWT_SECRET deve conter pelo menos 32 caracteres.");
  }
  return normalizedSecret;
}

async function readSecretFile(filePath) {
  const secret = await readFile(filePath, "utf8");
  return validateSecret(secret);
}

export async function resolveJwtSecret(configuredSecret, filePath) {
  if (configuredSecret?.trim()) {
    return validateSecret(configuredSecret);
  }

  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  try {
    return await readSecretFile(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const generatedSecret = randomBytes(64).toString("base64url");
  try {
    await writeFile(filePath, `${generatedSecret}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    return generatedSecret;
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error;
    }
    return readSecretFile(filePath);
  }
}
