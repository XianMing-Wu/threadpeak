export type Sql = {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  transaction<T>(fn: (sql: Sql) => Promise<T>): Promise<T>
  close(): Promise<void>
}
