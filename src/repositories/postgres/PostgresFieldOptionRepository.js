import { PostgresTableRepository } from "./PostgresTableRepository.js";

export class PostgresFieldOptionRepository extends PostgresTableRepository {
  constructor(pool) {
    super(pool, "field_options");
  }
}
