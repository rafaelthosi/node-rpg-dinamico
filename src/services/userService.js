import bcrypt from "bcryptjs";
import { RpgServiceBase, publicUser } from "./rpgServiceBase.js";
import { RpgServiceError } from "./rpgServiceError.js";

export class UserService extends RpgServiceBase {
  registerPlayer(input) {
    return this.#register(input, "player");
  }

  registerGM(input) {
    return this.#register(input, "gm");
  }

  async #register({ username, password }, role) {
    if (
      typeof username !== "string"
      || !/^[a-z0-9._-]{3,50}$/i.test(username.trim())
      || typeof password !== "string"
      || password.length < 12
      || password.length > 200
    ) {
      throw new RpgServiceError(400, "Informe usuário válido e senha com pelo menos 12 caracteres.");
    }

    const normalizedUsername = username.trim().toLowerCase();
    if (await this.repository.findByUsername(normalizedUsername)) {
      throw new RpgServiceError(409, "Já existe um usuário com esse nome.");
    }

    const user = await this.repository.create("users", {
      username: normalizedUsername,
      passwordHash: await bcrypt.hash(password, 12),
      role,
      createdAt: new Date().toISOString(),
    });
    return publicUser(user);
  }
}
