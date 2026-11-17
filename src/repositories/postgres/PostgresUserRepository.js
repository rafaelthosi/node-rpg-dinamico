import {
  mapPostgresRecord,
  PostgresTableRepository,
} from "./PostgresTableRepository.js";

export class PostgresUserRepository extends PostgresTableRepository {
  constructor(pool) {
    super(pool, "users");
  }

  async findByUsername(username) {
    const result = await this.pool.query(
      'SELECT * FROM "users" WHERE "username" = $1 LIMIT 1',
      [username],
    );
    return mapPostgresRecord("users", result.rows[0]);
  }
}
