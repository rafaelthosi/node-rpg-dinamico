export class CsvTableRepository {
  constructor(store, table) {
    this.store = store;
    this.table = table;
  }

  findById(id) { return this.store.findById(this.table, id); }
  list(predicate) { return this.store.list(this.table, predicate); }
  create(input) { return this.store.create(this.table, input); }
  update(id, updates) { return this.store.update(this.table, id, updates); }
  delete(id) { return this.store.delete(this.table, id); }
  deleteWhere(predicate) { return this.store.deleteWhere(this.table, predicate); }
}
