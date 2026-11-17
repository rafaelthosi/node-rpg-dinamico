import { CsvTableRepository } from "./CsvTableRepository.js";

export class CsvFieldOptionRepository extends CsvTableRepository {
  constructor(store) { super(store, "field_options"); }
}
