import { PostgresTableRepository } from "./PostgresTableRepository.js";

export class PostgresCharacterRepository extends PostgresTableRepository {
  constructor(pool) {
    super(pool, "characters");
  }
}
