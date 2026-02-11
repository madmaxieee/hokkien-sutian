import type { Database } from "bun:sqlite";

import type { DBAdapter, QueryResult, SqlValue } from "./types";

const emptyResult: QueryResult = { columns: [], values: [] };

export class BunSqliteAdapter implements DBAdapter {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  exec(sql: string, params?: Record<string, SqlValue>): QueryResult {
    const stmt = this.db.prepare(sql);
    const rows = params ? stmt.all(params) : stmt.all();
    if (!rows || rows.length === 0) {
      return emptyResult;
    }

    const columns = Object.keys(rows[0] as Record<string, SqlValue>);
    const values = rows.map((row) =>
      columns.map(
        (column) => (row as Record<string, SqlValue>)[column] ?? null,
      ),
    );

    return { columns, values };
  }

  createFunction(name: string, fn: (...args: SqlValue[]) => SqlValue): void {
    const dbAny = this.db as unknown as {
      function?: (name: string, fn: (...args: unknown[]) => unknown) => void;
      createFunction?: (
        name: string,
        fn: (...args: unknown[]) => unknown,
      ) => void;
    };

    const wrapped = fn as (...args: unknown[]) => unknown;
    if (typeof dbAny.function === "function") {
      dbAny.function(name, wrapped);
      return;
    }
    if (typeof dbAny.createFunction === "function") {
      dbAny.createFunction(name, wrapped);
      return;
    }

    throw new Error(
      "bun:sqlite custom functions not supported by this runtime",
    );
  }
}
