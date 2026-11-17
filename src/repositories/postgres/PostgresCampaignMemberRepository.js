import { PostgresTableRepository } from "./PostgresTableRepository.js";

export class PostgresCampaignMemberRepository extends PostgresTableRepository {
  constructor(pool) {
    super(pool, "campaign_members");
  }
}
