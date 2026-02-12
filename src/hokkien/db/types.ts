export type SqlValue = string | number | Uint8Array | null;

export type QueryResult = {
  columns: string[];
  values: SqlValue[][];
};

export interface DBAdapter {
  exec(sql: string, params?: Record<string, SqlValue>): QueryResult;
  createFunction?(name: string, fn: (...args: SqlValue[]) => SqlValue): void;
}
