/**
 * In-memory Supabase-like client for G7-A/G7-B unit tests.
 * NOT for production. NOT a silent fallback of createSupabase* stores.
 */

type Row = Record<string, unknown>;

export type FakeDb = {
  packages: Row[];
  package_items: Row[];
  occurrences: Row[];
  reservations: Row[];
  boletos: Row[];
  notifications: Row[];
  residents: Row[];
  api_idempotency_keys: Row[];
  api_confirmations: Row[];
  api_domain_events: Row[];
  organizations: Row[];
  condominiums: Row[];
};

export type FakeClientOptions = {
  failTables?: Partial<Record<keyof FakeDb, string>>;
};

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}`;
}

export function createFakePersistenceDb(seed?: Partial<FakeDb>, options?: FakeClientOptions) {
  const db: FakeDb = {
    packages: seed?.packages ? [...seed.packages] : [],
    package_items: seed?.package_items ? [...seed.package_items] : [],
    occurrences: seed?.occurrences ? [...seed.occurrences] : [],
    reservations: seed?.reservations ? [...seed.reservations] : [],
    boletos: seed?.boletos ? [...seed.boletos] : [],
    notifications: seed?.notifications ? [...seed.notifications] : [],
    residents: seed?.residents ? [...seed.residents] : [],
    api_idempotency_keys: seed?.api_idempotency_keys ? [...seed.api_idempotency_keys] : [],
    api_confirmations: seed?.api_confirmations ? [...seed.api_confirmations] : [],
    api_domain_events: seed?.api_domain_events ? [...seed.api_domain_events] : [],
    organizations: seed?.organizations ? [...seed.organizations] : [],
    condominiums: seed?.condominiums ? [...seed.condominiums] : []
  };

  const failTables = { ...(options?.failTables || {}) };

  function tableStore(name: string): Row[] {
    if (!(name in db)) throw new Error(`unknown table ${name}`);
    return (db as Record<string, Row[]>)[name];
  }

  const client = {
    __db: db,
    setFail(table: keyof FakeDb, message: string | null) {
      if (message) failTables[table] = message;
      else delete failTables[table];
    },
    from(table: string) {
      const store = tableStore(table);
      let filters: Array<(row: Row) => boolean> = [];
      let pendingInsert: Row | Row[] | null = null;
      let pendingUpdate: Row | null = null;
      let doDelete = false;
      let orderKey: string | null = null;
      let orderAsc = true;
      let limitN: number | null = null;
      let selectCols: string | null = null;

      const failIfNeeded = () => {
        const msg = failTables[table as keyof FakeDb];
        if (msg) return { data: null, error: { message: msg, code: 'FAKE' } };
        return null;
      };

      const applyFilters = () => store.filter((row) => filters.every((f) => f(row)));

      const runMutation = () => {
        const failed = failIfNeeded();
        if (failed) return failed;

        if (pendingInsert) {
          const rows = Array.isArray(pendingInsert) ? pendingInsert : [pendingInsert];
          // unique simulation for api_idempotency_keys
          if (table === 'api_idempotency_keys') {
            for (const row of rows) {
              const dup = store.find(
                (r) =>
                  r.organization_id === row.organization_id &&
                  r.condominium_id === row.condominium_id &&
                  r.idempotency_key === row.idempotency_key
              );
              if (dup) {
                return { data: null, error: { message: 'duplicate key', code: '23505' } };
              }
            }
          }
          if (table === 'api_domain_events') {
            for (const row of rows) {
              const dup = store.find((r) => r.event_id === row.event_id);
              if (dup) {
                return { data: null, error: { message: 'duplicate event_id', code: '23505' } };
              }
            }
          }
          const inserted: Row[] = [];
          for (const row of rows) {
            const withId = { id: row.id ?? newId(table.slice(0, 3)), ...row };
            store.push(withId);
            inserted.push(withId);
          }
          pendingInsert = null;
          return { data: inserted.length === 1 ? inserted[0] : inserted, error: null };
        }

        if (pendingUpdate) {
          const rows = applyFilters();
          for (const row of rows) Object.assign(row, pendingUpdate);
          pendingUpdate = null;
          return { data: rows.map((r) => ({ id: r.id ?? r.confirmation_id })), error: null };
        }

        if (doDelete) {
          const rows = applyFilters();
          for (const row of rows) {
            const idx = store.indexOf(row);
            if (idx >= 0) store.splice(idx, 1);
          }
          doDelete = false;
          return { data: rows.map((r) => ({ id: r.id ?? r.confirmation_id })), error: null };
        }

        let rows = applyFilters();
        if (orderKey) {
          const key = orderKey;
          rows = [...rows].sort((a, b) => {
            const av = String(a[key] ?? '');
            const bv = String(b[key] ?? '');
            return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
          });
        }
        if (limitN != null) rows = rows.slice(0, limitN);
        void selectCols;
        return { data: rows, error: null };
      };

      const api: any = {
        select(_cols?: string) {
          selectCols = _cols ?? null;
          return api;
        },
        insert(rows: Row | Row[]) {
          pendingInsert = rows;
          return api;
        },
        update(patch: Row) {
          pendingUpdate = patch;
          return api;
        },
        delete() {
          doDelete = true;
          return api;
        },
        eq(col: string, value: unknown) {
          filters.push((row) => row[col] === value);
          return api;
        },
        is(col: string, value: null) {
          filters.push((row) => row[col] === value);
          return api;
        },
        gt(col: string, value: unknown) {
          filters.push((row) => String(row[col] ?? '') > String(value ?? ''));
          return api;
        },
        lte(col: string, value: unknown) {
          filters.push((row) => String(row[col] ?? '') <= String(value ?? ''));
          return api;
        },
        order(col: string, opts?: { ascending?: boolean }) {
          orderKey = col;
          orderAsc = opts?.ascending !== false;
          return api;
        },
        limit(n: number) {
          limitN = n;
          return api;
        },
        async single() {
          const result = runMutation();
          if (result.error) return result;
          const data = result.data;
          if (Array.isArray(data)) {
            if (data.length !== 1) return { data: null, error: { message: 'single() expected 1 row' } };
            return { data: data[0], error: null };
          }
          return { data, error: null };
        },
        async maybeSingle() {
          const result = runMutation();
          if (result.error) return result;
          const data = result.data;
          if (Array.isArray(data)) {
            if (data.length === 0) return { data: null, error: null };
            return { data: data[0], error: null };
          }
          return { data: data ?? null, error: null };
        },
        then(resolve: (v: unknown) => void, reject?: (e: unknown) => void) {
          return Promise.resolve()
            .then(() => runMutation())
            .then(resolve, reject);
        }
      };

      return api;
    }
  };

  return client;
}
