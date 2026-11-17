import { PostgresTableRepository } from "./PostgresTableRepository.js";

export class PostgresCampaignRepository extends PostgresTableRepository {
  constructor(pool) {
    super(pool, "campaigns");
  }
}
