import { CsvTableRepository } from "./CsvTableRepository.js";

export class CsvCampaignMemberRepository extends CsvTableRepository {
  constructor(store) { super(store, "campaign_members"); }
}
