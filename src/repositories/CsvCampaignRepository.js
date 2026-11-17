import { CsvTableRepository } from "./CsvTableRepository.js";

export class CsvCampaignRepository extends CsvTableRepository {
  constructor(store) { super(store, "campaigns"); }
}
