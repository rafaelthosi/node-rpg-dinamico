import { CsvTableRepository } from "./CsvTableRepository.js";

export class CsvUserRepository extends CsvTableRepository {
  constructor(store) { super(store, "users"); }

  async findByUsername(username) {
    return (await this.list((user) => user.username === username))[0] ?? null;
  }
}
