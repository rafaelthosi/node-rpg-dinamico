import { CsvTableRepository } from "./CsvTableRepository.js";

export class CsvFieldRepository extends CsvTableRepository {
  constructor(store) { super(store, "fields"); }
}
