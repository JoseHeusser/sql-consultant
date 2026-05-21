'use client';

import { useState } from 'react';
import QueryInput from '@/app/components/QueryInput';
import SQLDisplay from '@/app/components/SQLDisplay';
import ResultsTable from '@/app/components/ResultsTable';
import ResultsMap from '@/app/components/ResultsMap';
import ChoroplethMap from '@/app/components/ChoroplethMap';
import AISummary from '@/app/components/AISummary';

const BERLIN_BEZIRKE = new Set([
  'Mitte', 'Friedrichshain-Kreuzberg', 'Pankow', 'Charlottenburg-Wilmersdorf',
  'Spandau', 'Steglitz-Zehlendorf', 'Tempelhof-Schöneberg', 'Neukölln',
  'Treptow-Köpenick', 'Marzahn-Hellersdorf', 'Lichtenberg', 'Reinickendorf',
]);

function detectChoropleth(rows: Row[], columns: string[]): { bezirkCol: string; valueCol: string } | null {
  if (rows.length === 0 || rows.length > 20) return null;
  // Find a column whose values match Berlin Bezirke names
  const bezirkCol = columns.find(c => {
    const vals = rows.map(r => r[c]);
    return vals.length > 0 && vals.every(v => typeof v === 'string' && BERLIN_BEZIRKE.has(v));
  });
  if (!bezirkCol) return null;
  // Find a numeric column other than the bezirk one
  const valueCol = columns.find(c => c !== bezirkCol && typeof rows[0][c] === 'number');
  if (!valueCol) return null;
  return { bezirkCol, valueCol };
}

export type Row = Record<string, string | number | null>;

type Stage = 'idle' | 'sql' | 'run' | 'summary';

export default function Home() {
  const [stage, setStage] = useState<Stage>('idle');
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
    setQuestion(q);

    try {
      // 1. NL → SQL
      setStage('sql');
      const sqlRes = await fetch('/api/query', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'sql', question: q }),
      });
      const sqlData = await sqlRes.json();
      if (!sqlRes.ok) throw new Error(sqlData.error ?? 'Failed to generate SQL');
      const generatedSql = sqlData.sql as string;
      setSql(generatedSql);

      // 2. Run SQL against Supabase
      setStage('run');
      const runRes = await fetch('/api/query', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'run', sql: generatedSql }),
      });
      const runData = await runRes.json();
      if (!runRes.ok) throw new Error(runData.error ?? 'Query failed');
      const r = runData.rows as Row[];
      setRows(r);
      setColumns(r[0] ? Object.keys(r[0]) : []);

      // 3. AI summary
      if (r.length > 0) {
        setStage('summary');
        const sumRes = await fetch('/api/query', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'summary', question: q, sql: generatedSql, rows: r }),
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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-emerald-50 border-emerald-200 text-emerald-700 text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Supabase · PostGIS · 962k trees
          </span>
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
              against the official Berlin tree cadaster on Supabase, and Claude interprets the
              result rows. The generated SQL appears immediately, the map and table render as soon
              as the data is back.
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

        {/* Stage indicator only — does NOT hide the content that's already loaded */}
        {isWorking && (
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            {stageLabel[stage]}
          </div>
        )}

        {/* SQL — appears as soon as step 1 finishes */}
        {sql && (
          <div className="mt-6">
            <SQLDisplay sql={sql} />
          </div>
        )}

        {/* Map: choropleth (district aggregates) takes precedence over point map (individual rows) */}
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

        {/* Table — appears as soon as step 2 finishes */}
        {columns.length > 0 && (
          <div className="mt-6">
            <ResultsTable columns={columns} rows={rows} />
          </div>
        )}

        {/* AI summary — appears last */}
        {summary && (
          <div className="mt-6">
            <AISummary summary={summary} />
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
