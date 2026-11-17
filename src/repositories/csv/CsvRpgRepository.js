import { CsvWorkbookStore } from "./CsvWorkbookStore.js";
import { CsvCampaignMemberRepository } from "./CsvCampaignMemberRepository.js";
import { CsvCampaignRepository } from "./CsvCampaignRepository.js";
import { CsvCharacterRepository } from "./CsvCharacterRepository.js";
import { CsvFieldOptionRepository } from "./CsvFieldOptionRepository.js";
import { CsvFieldRepository } from "./CsvFieldRepository.js";
import { CsvFieldValueRepository } from "./CsvFieldValueRepository.js";
import { CsvSectionRepository } from "./CsvSectionRepository.js";
import { CsvUserRepository } from "./CsvUserRepository.js";

export class CsvRpgRepository {
  constructor(directoryPath, legacyExcelPath) {
    this.store = new CsvWorkbookStore(directoryPath, legacyExcelPath);
    this.users = new CsvUserRepository(this.store);
    this.campaigns = new CsvCampaignRepository(this.store);
    this.campaignMembers = new CsvCampaignMemberRepository(this.store);
    this.sections = new CsvSectionRepository(this.store);
    this.fields = new CsvFieldRepository(this.store);
    this.fieldOptions = new CsvFieldOptionRepository(this.store);
    this.characters = new CsvCharacterRepository(this.store);
    this.fieldValues = new CsvFieldValueRepository(this.store);
    this.tables = new Map([
      ["users", this.users],
      ["campaigns", this.campaigns],
      ["campaign_members", this.campaignMembers],
      ["sections", this.sections],
      ["fields", this.fields],
      ["field_options", this.fieldOptions],
      ["characters", this.characters],
      ["field_values", this.fieldValues],
    ]);
  }

  initialize() { return this.store.initialize(); }
  findByUsername(username) { return this.users.findByUsername(username); }
  findById(table, id) { return this.#table(table).findById(id); }
  list(table, predicate) { return this.#table(table).list(predicate); }
  create(table, input) { return this.#table(table).create(input); }
  update(table, id, updates) { return this.#table(table).update(id, updates); }
  delete(table, id) { return this.#table(table).delete(id); }
  deleteWhere(table, predicate) { return this.#table(table).deleteWhere(predicate); }

  #table(name) {
    const repository = this.tables.get(name);
    if (!repository) {
      throw new Error(`Tabela CSV desconhecida: ${name}.`);
    }
    return repository;
  }
}
