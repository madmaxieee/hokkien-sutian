export type SqlValue = string | number | Uint8Array | null;

export type QueryResult = {
  columns: string[];
  values: SqlValue[][];
};

export type LimitedQueryResult = {
  result: QueryResult;
  hasMore: boolean;
};

export interface DBAdapter {
  exec(sql: string, params?: Record<string, SqlValue>): QueryResult;
  execWithLimit?(
    sql: string,
    params: Record<string, SqlValue> | undefined,
    limit: number,
  ): LimitedQueryResult;
  createFunction?(name: string, fn: (...args: SqlValue[]) => SqlValue): void;
}
