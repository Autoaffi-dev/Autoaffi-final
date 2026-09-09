import type { UserFunnelRow, UserFunnelsDb } from "./repo";

type Store = { rows: UserFunnelRow[] };

export function createMemoryUserFunnelsDb(
  initial: UserFunnelRow[] = []
): UserFunnelsDb & { store: Store } {
  const store: Store = { rows: initial.map((row) => ({ ...row })) };

  return {
    store,
    from(table: "user_funnels") {
      if (table !== "user_funnels") {
        throw new Error(`unexpected table ${table}`);
      }

      const state: {
        op: "select" | "insert" | "delete";
        payload?: Record<string, unknown>;
        filters: Record<string, string>;
      } = { op: "select", filters: {} };

      const builder: any = {
        select() {
          if (state.op !== "delete") state.op = "select";
          return builder;
        },
        insert(payload: Record<string, unknown>) {
          state.op = "insert";
          state.payload = payload;
          return builder;
        },
        delete() {
          state.op = "delete";
          return builder;
        },
        eq(column: string, value: string) {
          state.filters[column] = value;
          return builder;
        },
        order() {
          return builder;
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve(execute()).then(resolve, reject);
        },
      };

      function execute() {
        if (state.op === "select") {
          const userId = state.filters.user_id;
          const data = store.rows
            .filter((row) => row.user_id === userId)
            .slice()
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
          return { data, error: null };
        }

        if (state.op === "insert") {
          const row: UserFunnelRow = {
            id: `funnel-${store.rows.length + 1}`,
            user_id: String(state.payload?.user_id || ""),
            name: String(state.payload?.name || ""),
            funnel_url: String(state.payload?.funnel_url || ""),
            created_at: "2026-09-09T00:00:00.000Z",
          };
          store.rows.push(row);
          return { data: [row], error: null };
        }

        const id = state.filters.id;
        const userId = state.filters.user_id;
        const kept: UserFunnelRow[] = [];
        const removed: UserFunnelRow[] = [];
        for (const row of store.rows) {
          if (row.id === id && row.user_id === userId) removed.push(row);
          else kept.push(row);
        }
        store.rows = kept;
        return { data: removed.map((row) => ({ id: row.id })), error: null };
      }

      return builder;
    },
  };
}
