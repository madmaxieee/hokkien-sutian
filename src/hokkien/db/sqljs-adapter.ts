import type { Database } from "sql.js";

import type { DBAdapter, QueryResult, SqlValue } from "./types";

const emptyResult: QueryResult = { columns: [], values: [] };

export class SqlJsAdapter implements DBAdapter {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  exec(sql: string, params?: Record<string, SqlValue>): QueryResult {
    if (!params || Object.keys(params).length === 0) {
      const result = this.db.exec(sql);
      return result[0] ?? emptyResult;
    }

    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const columns = stmt.getColumnNames();
      const values: SqlValue[][] = [];
      while (stmt.step()) {
        values.push(stmt.get() as SqlValue[]);
      }
      return { columns, values };
    } finally {
      stmt.free();
    }
  }

  createFunction(name: string, fn: (...args: SqlValue[]) => SqlValue): void {
    this.db.create_function(name, fn as (...args: unknown[]) => unknown);
  }
}
