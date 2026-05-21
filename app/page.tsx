'use client';

import { useState } from 'react';
import QueryInput from '@/app/components/QueryInput';
import SQLDisplay from '@/app/components/SQLDisplay';
import ResultsTable from '@/app/components/ResultsTable';
import ResultsMap from '@/app/components/ResultsMap';
import ChoroplethMap from '@/app/components/ChoroplethMap';
import AISummary from '@/app/components/AISummary';
import SchemaViewer from '@/app/components/SchemaViewer';

export type Row = Record<string, string | number | null>;

type Stage = 'idle' | 'sql' | 'run' | 'retry' | 'summary';

const BERLIN_BEZIRKE = new Set([
  'Mitte', 'Friedrichshain-Kreuzberg', 'Pankow', 'Charlottenburg-Wilmersdorf',
  'Spandau', 'Steglitz-Zehlendorf', 'Tempelhof-Schöneberg', 'Neukölln',
  'Treptow-Köpenick', 'Marzahn-Hellersdorf', 'Lichtenberg', 'Reinickendorf',
]);

function detectChoropleth(rows: Row[], columns: string[]): { bezirkCol: string; valueCol: string } | null {
  if (rows.length === 0 || rows.length > 20) return null;
  const bezirkCol = columns.find(c => {
    const vals = rows.map(r => r[c]);
    return vals.length > 0 && vals.every(v => typeof v === 'string' && BERLIN_BEZIRKE.has(v));
  });
  if (!bezirkCol) return null;
  const valueCol = columns.find(c => c !== bezirkCol && typeof rows[0][c] === 'number');
  if (!valueCol) return null;
  return { bezirkCol, valueCol };
}

const MAX_RETRIES = 3;

export default function Home() {
  const [stage, setStage] = useState<Stage>('idle');
  const [retry, setRetry] = useState(0);
  const [question, setQuestion] = useState<string | null>(null);
  const [sql, setSql] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (q: string) => {
    setError(null);
    setSummary(null);
    setRows([]);
    setColumns([]);
    setSql(null);
    setRetry(0);
    setQuestion(q);

    try {
      // 1. NL → SQL (initial)
      setStage('sql');
      const sqlRes = await fetch('/api/query', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'sql', question: q }),
      });
      const sqlData = await sqlRes.json();
      if (!sqlRes.ok) throw new Error(sqlData.error ?? 'Failed to generate SQL');
      let currentSql = sqlData.sql as string;
      setSql(currentSql);

      // 2. Run + retry loop (max 3 attempts incl. initial)
      setStage('run');
      let runRows: Row[] | null = null;
      let lastError: string | null = null;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          setStage('retry');
          setRetry(attempt);
          // Ask LLM to fix the SQL given the error
          const fixRes: Response = await fetch('/api/query', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'fix', question: q, previousSql: currentSql, error: lastError ?? 'unknown' }),
          });
          const fixData: { sql?: string; error?: string } = await fixRes.json();
          if (!fixRes.ok) { lastError = fixData.error ?? 'fix failed'; continue; }
          currentSql = fixData.sql as string;
          setSql(currentSql);
          setStage('run');
        }
        const runRes = await fetch('/api/query', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'run', sql: currentSql }),
        });
        const runData = await runRes.json();
        if (runRes.ok) {
          runRows = runData.rows as Row[];
          lastError = null;
          break;
        }
        lastError = runData.error ?? `HTTP ${runRes.status}`;
      }
      if (!runRows) throw new Error(`Query failed after ${MAX_RETRIES} attempts: ${lastError ?? 'unknown'}`);
      setRows(runRows);
      setColumns(runRows[0] ? Object.keys(runRows[0]) : []);

      // 3. AI summary
      if (runRows.length > 0) {
        setStage('summary');
        const sumRes = await fetch('/api/query', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'summary', question: q, sql: currentSql, rows: runRows }),
        });
        const sumData = await sumRes.json();
        if (sumRes.ok) setSummary(sumData.summary);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStage('idle');
    }
  };

  const isWorking = stage !== 'idle';
  const hasGeo = rows.some(r => typeof r.lat === 'number' && typeof r.lng === 'number');
  const choropleth = detectChoropleth(rows, columns);

  const stageLabel: Record<Stage, string> = {
    idle: '',
    sql: 'Generating SQL with Claude…',
    run: 'Running query on Supabase…',
    retry: `Query failed, asking Claude to fix it (attempt ${retry + 1}/${MAX_RETRIES})…`,
    summary: 'Interpreting results…',
  };

  return (
    <main className="min-h-screen">

      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
              🌳
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">Berlin Trees · SQL Consultant</h1>
              <p className="text-xs text-slate-500 mt-0.5">Ask Berlin&apos;s official tree cadaster in natural language</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SchemaViewer />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              962k trees
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {!question && (
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Ask Berlin&apos;s 962,000 trees anything.
            </h2>
            <p className="text-sm text-slate-600 mt-3 max-w-2xl leading-relaxed">
              Type a question in plain English. Claude converts it to PostgreSQL, the query runs
              against Berlin&apos;s official tree cadaster on Supabase, and Claude interprets the
              result rows. If a query fails, Claude retries up to 3 times automatically.
            </p>
          </div>
        )}

        <QueryInput onSubmit={handleSubmit} loading={isWorking} />

        {error && (
          <div className="mt-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">
            <strong>Error:</strong> {error}
          </div>
        )}

        {question && (
          <div className="mt-8 mb-2">
            <span className="text-[10px] font-mono text-indigo-600 uppercase tracking-wider">/ Question</span>
            <p className="text-lg font-semibold text-slate-900 mt-1">&ldquo;{question}&rdquo;</p>
          </div>
        )}

        {isWorking && (
          <div className={`mt-4 flex items-center gap-2 text-xs font-mono ${stage === 'retry' ? 'text-amber-700' : 'text-slate-500'}`}>
            <span className={`inline-block w-2 h-2 rounded-full animate-pulse ${stage === 'retry' ? 'bg-amber-500' : 'bg-indigo-500'}`}></span>
            {stageLabel[stage]}
          </div>
        )}

        {/* 1. MAP (first and biggest) — choropleth or point */}
        {choropleth && (
          <div className="mt-6">
            <ChoroplethMap rows={rows} bezirkColumn={choropleth.bezirkCol} valueColumn={choropleth.valueCol} />
          </div>
        )}
        {!choropleth && hasGeo && (
          <div className="mt-6">
            <ResultsMap rows={rows} />
          </div>
        )}

        {/* 2. AI summary */}
        {summary && (
          <div className="mt-6">
            <AISummary summary={summary} />
          </div>
        )}

        {/* 3. Table */}
        {columns.length > 0 && (
          <div className="mt-6">
            <ResultsTable columns={columns} rows={rows} />
          </div>
        )}

        {/* 4. SQL (collapsed) at the end */}
        {sql && (
          <div className="mt-6">
            <SQLDisplay sql={sql} />
          </div>
        )}

        <footer className="mt-16 pt-6 border-t border-slate-200 text-xs text-slate-500 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <p>
            Data: <a href="https://daten.berlin.de/datensaetze/baumbestand-berlin-wms" className="underline">Berlin Baumbestand</a> · 435k street trees + 528k park trees · Senatsverwaltung Berlin · CC0
          </p>
          <div className="flex gap-4">
            <a href="https://github.com/JoseHeusser/sql-consultant" target="_blank" className="hover:text-slate-900">GitHub</a>
            <a href="https://joseheusser.vercel.app" target="_blank" className="hover:text-slate-900">Portfolio</a>
          </div>
        </footer>

      </div>
    </main>
  );
}
