'use client';

import { useState } from 'react';
import QueryInput from '@/app/components/QueryInput';
import SQLDisplay from '@/app/components/SQLDisplay';
import ResultsTable from '@/app/components/ResultsTable';
import ResultsMap from '@/app/components/ResultsMap';
import AISummary from '@/app/components/AISummary';

export type Row = Record<string, string | number | null>;

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<'idle' | 'sql' | 'run' | 'summary'>('idle');
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
    setLoading(true);

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
      setLoading(false);
      setStage('idle');
    }
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
            Supabase · PostGIS · 960k trees
          </span>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {!question && (
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Ask Berlin&apos;s 960,000 trees anything.
            </h2>
            <p className="text-sm text-slate-600 mt-3 max-w-2xl leading-relaxed">
              Type a question in plain English. Claude converts it to PostgreSQL, the query runs
              against the official Berlin tree cadaster on Supabase, and Claude interprets the
              result rows. You see the generated SQL, the raw data, and a plain-English summary.
            </p>
          </div>
        )}

        <QueryInput onSubmit={handleSubmit} loading={loading} />

        {error && (
          <div className="mt-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">
            <strong>Error:</strong> {error}
          </div>
        )}

        {question && (
          <div className="mt-8 mb-4">
            <span className="text-[10px] font-mono text-indigo-600 uppercase tracking-wider">/ Question</span>
            <p className="text-lg font-semibold text-slate-900 mt-1">&ldquo;{question}&rdquo;</p>
          </div>
        )}

        {loading && (
          <div className="mt-6 space-y-3">
            <div className="text-xs text-slate-500 font-mono uppercase tracking-wider">
              {stage === 'sql' && '› Generating SQL…'}
              {stage === 'run' && '› Running against Supabase…'}
              {stage === 'summary' && '› Interpreting results…'}
            </div>
            <div className="h-12 rounded-lg bg-slate-100 animate-pulse"></div>
          </div>
        )}

        {sql && !loading && (
          <div className="mt-6">
            <SQLDisplay sql={sql} />
          </div>
        )}

        {rows.length > 0 && !loading && (
          <div className="mt-6">
            <ResultsMap rows={rows} />
          </div>
        )}

        {summary && !loading && (
          <div className="mt-6">
            <AISummary summary={summary} />
          </div>
        )}

        {columns.length > 0 && !loading && (
          <div className="mt-6">
            <ResultsTable columns={columns} rows={rows} />
          </div>
        )}

        <footer className="mt-16 pt-6 border-t border-slate-200 text-xs text-slate-500 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <p>
            Data: <a href="https://daten.berlin.de/datensaetze/baumbestand-berlin-wms" className="underline">Berlin Baumbestand</a> · 435k street trees + 525k park trees · Senatsverwaltung Berlin · CC0
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
