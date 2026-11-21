// In-memory stand-ins for the unit tests of offline/*: the few Dexie table/collection calls those
// modules use, and a Storage for localStorage. Not imported by the app.

type Row = Record<string, unknown>;
type Predicate = (row: Row) => boolean;

export class FakeCollection {
  constructor(
    private readonly table: FakeTable,
    private readonly predicate: Predicate,
  ) {}

  private matches(): Row[] {
    return this.table.rows.filter(this.predicate);
  }

  filter(fn: Predicate) {
    return new FakeCollection(this.table, (row) => this.predicate(row) && fn(row));
  }

  async toArray() {
    return this.matches().map((r) => ({ ...r }));
  }

  async count() {
    return this.matches().length;
  }

  async first() {
    const [row] = this.matches();
    return row ? { ...row } : undefined;
  }

  async sortBy(field: string) {
    return (await this.toArray()).sort((a, b) => String(a[field]).localeCompare(String(b[field])));
  }

  async delete() {
    const before = this.table.rows.length;
    this.table.rows = this.table.rows.filter((row) => !this.predicate(row));
    return before - this.table.rows.length;
  }
}

export class FakeTable {
  rows: Row[] = [];
  private nextId = 1;

  constructor(
    private readonly primaryKey: string,
    private readonly autoIncrement = false,
  ) {}

  async add(row: Row) {
    const copy = { ...row };
    if (this.autoIncrement && copy[this.primaryKey] == null) copy[this.primaryKey] = this.nextId++;
    this.rows.push(copy);
    return copy[this.primaryKey];
  }

  async put(row: Row) {
    const key = row[this.primaryKey];
    const index = this.rows.findIndex((r) => r[this.primaryKey] === key);
    if (index >= 0) this.rows[index] = { ...row };
    else this.rows.push({ ...row });
    return key;
  }

  async update(key: unknown, changes: Row) {
    const row = this.rows.find((r) => r[this.primaryKey] === key);
    if (row) Object.assign(row, changes);
    return row ? 1 : 0;
  }

  async get(key: unknown) {
    const row = this.rows.find((r) => r[this.primaryKey] === key);
    return row ? { ...row } : undefined;
  }

  async delete(key: unknown) {
    this.rows = this.rows.filter((r) => r[this.primaryKey] !== key);
  }

  async clear() {
    this.rows = [];
  }

  async toArray() {
    return this.rows.map((r) => ({ ...r }));
  }

  async count() {
    return this.rows.length;
  }

  where(field: string) {
    return { equals: (value: unknown) => new FakeCollection(this, (row) => row[field] === value) };
  }

  filter(fn: Predicate) {
    return new FakeCollection(this, fn);
  }
}

export function createFakeOfflineDb() {
  const tables = {
    workoutLogs: new FakeTable("clientId"),
    pendingMutations: new FakeTable("id", true),
    workoutSessions: new FakeTable("clientId"),
    pendingSessionMutations: new FakeTable("id", true),
    failedMutations: new FakeTable("id", true),
    pendingCardioLogs: new FakeTable("id", true),
    queryCache: new FakeTable("key"),
    customSounds: new FakeTable("key"),
    exerciseCatalog: new FakeTable("id"),
    catalogMeta: new FakeTable("key"),
  };
  return {
    ...tables,
    table: (name: keyof typeof tables) => tables[name],
    // Runs the callback right away; the last argument is always the transaction body.
    transaction: async (...args: unknown[]) => (args[args.length - 1] as () => Promise<unknown>)(),
    reset() {
      for (const table of Object.values(tables)) table.rows = [];
    },
  };
}

export type FakeOfflineDb = ReturnType<typeof createFakeOfflineDb>;

export class MemoryStorage {
  private readonly map = new Map<string, string>();

  get length() {
    return this.map.size;
  }

  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }

  removeItem(key: string) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  keys() {
    return [...this.map.keys()];
  }
}
