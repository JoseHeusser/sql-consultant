'use client';

import { useEffect, useState } from 'react';
import QueryInput from '@/app/components/QueryInput';
import SQLDisplay from '@/app/components/SQLDisplay';
import ResultsTable from '@/app/components/ResultsTable';
import ResultsMap from '@/app/components/ResultsMap';
import AISummary from '@/app/components/AISummary';
import { getDb, runQuery, Row } from '@/app/lib/db';

export default function Home() {
  const [dbReady, setDbReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);
  const [sql, setSql] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDb()
      .then(() => setDbReady(true))
      .catch(e => setError(`Failed to load database: ${e.message}`));
  }, []);

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
      const sqlRes = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'sql', question: q }),
      });
      const sqlData = await sqlRes.json();
      if (!sqlRes.ok) throw new Error(sqlData.error ?? 'Failed to generate SQL');
      const generatedSql = sqlData.sql as string;
      setSql(generatedSql);

      // 2. Execute SQL locally
      const db = await getDb();
      const { columns: cols, rows: r } = runQuery(db, generatedSql);
      setColumns(cols);
      setRows(r);

      // 3. AI summary
      if (r.length > 0) {
        const sumRes = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'summary', question: q, sql: generatedSql, rows: r }),
        });
        const sumData = await sumRes.json();
        if (sumRes.ok) setSummary(sumData.summary);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen">

      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
              SQL
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-none">SQL Consultant</h1>
              <p className="text-xs text-slate-500 mt-0.5">Ask Berlin&apos;s commercial real-estate database in natural language</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${dbReady ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
              <span className={`w-2 h-2 rounded-full ${dbReady ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
              {dbReady ? '5,000 rows loaded' : 'Loading SQLite WASM…'}
            </span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Intro */}
        {!question && (
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              What do you want to know about Berlin&apos;s commercial market?
            </h2>
            <p className="text-sm text-slate-600 mt-3 max-w-2xl leading-relaxed">
              Type a question in plain English. Claude converts it to SQL, the query runs
              in your browser against a 5,000-property SQLite database, and you get a table,
              a map, and an AI-generated interpretation. No backend database, no tracking.
            </p>
          </div>
        )}

        {/* Input */}
        <QueryInput onSubmit={handleSubmit} loading={loading || !dbReady} />

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Question echo */}
        {question && (
          <div className="mt-8 mb-4">
            <span className="text-[10px] font-mono text-indigo-600 uppercase tracking-wider">/ Question</span>
            <p className="text-lg font-semibold text-slate-900 mt-1">&ldquo;{question}&rdquo;</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="mt-6 space-y-3">
            <div className="h-16 rounded-lg bg-slate-100 animate-pulse"></div>
            <div className="h-40 rounded-lg bg-slate-100 animate-pulse"></div>
          </div>
        )}

        {/* SQL */}
        {sql && !loading && (
          <div className="mt-6">
            <SQLDisplay sql={sql} />
          </div>
        )}

        {/* Map */}
        {rows.length > 0 && !loading && (
          <div className="mt-6">
            <ResultsMap rows={rows} />
          </div>
        )}

        {/* AI summary */}
        {summary && !loading && (
          <div className="mt-6">
            <AISummary summary={summary} />
          </div>
        )}

        {/* Table */}
        {columns.length > 0 && !loading && (
          <div className="mt-6">
            <ResultsTable columns={columns} rows={rows} />
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-6 border-t border-slate-200 text-xs text-slate-500 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <p>
            5,000 synthetic-but-realistic commercial properties across Berlin&apos;s 12 Bezirke ·
            distributions based on Mietspiegel + public Berlin data.
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
