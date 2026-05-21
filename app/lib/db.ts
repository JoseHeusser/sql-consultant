// Client-side SQLite loader using sql.js (WebAssembly).
// The compiled SQLite database file is loaded once and cached in memory.

import initSqlJs, { Database, QueryExecResult } from 'sql.js';

let dbPromise: Promise<Database> | null = null;

async function loadDb(): Promise<Database> {
  const SQL = await initSqlJs({
    // sql-wasm.wasm is served from /public/sql-wasm.wasm (copied at install time)
    locateFile: (file: string) => `/${file}`,
  });
  const buf = await fetch('/data/berlin-cre.sqlite').then(r => {
    if (!r.ok) throw new Error(`Failed to fetch database (${r.status})`);
    return r.arrayBuffer();
  });
  return new SQL.Database(new Uint8Array(buf));
}

export async function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = loadDb();
  return dbPromise;
}

export type Row = Record<string, string | number | null>;

export function runQuery(db: Database, sql: string): { columns: string[]; rows: Row[] } {
  let result: QueryExecResult[];
  try {
    result = db.exec(sql);
  } catch (e) {
    throw new Error(`SQL error: ${(e as Error).message}`);
  }
  if (!result.length) return { columns: [], rows: [] };
  const { columns, values } = result[0];
  const rows = values.map(v => {
    const o: Row = {};
    columns.forEach((c, i) => {
      o[c] = v[i] as string | number | null;
    });
    return o;
  });
  return { columns, rows };
}
