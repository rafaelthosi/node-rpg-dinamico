import { PostgresTableRepository } from "./PostgresTableRepository.js";

export class PostgresFieldRepository extends PostgresTableRepository {
  constructor(pool) {
    super(pool, "fields");
  }
}
