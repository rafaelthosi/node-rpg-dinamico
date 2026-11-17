import { CsvTableRepository } from "./CsvTableRepository.js";

export class CsvCharacterRepository extends CsvTableRepository {
  constructor(store) { super(store, "characters"); }
}
