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
}
