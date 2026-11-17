import { PostgresTableRepository } from "./PostgresTableRepository.js";

export class PostgresSectionRepository extends PostgresTableRepository {
  constructor(pool) {
    super(pool, "sections");
  }
}
