import { CsvTableRepository } from "./CsvTableRepository.js";

export class CsvFieldValueRepository extends CsvTableRepository {
  constructor(store) { super(store, "field_values"); }
}
