import { PostgresTableRepository } from "./PostgresTableRepository.js";

export class PostgresFieldValueRepository extends PostgresTableRepository {
  constructor(pool) {
    super(pool, "field_values");
  }
}
