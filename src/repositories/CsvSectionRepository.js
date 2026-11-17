import { CsvTableRepository } from "./CsvTableRepository.js";

export class CsvSectionRepository extends CsvTableRepository {
  constructor(store) { super(store, "sections"); }
}
