'use client';

import { Row } from '@/app/lib/db';

type Props = {
  columns: string[];
  rows: Row[];
};

function fmtCell(v: string | number | null): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') {
    if (!Number.isInteger(v)) return v.toFixed(2);
    return v.toLocaleString('en-US');
  }
  return String(v);
}

export default function ResultsTable({ columns, rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="text-sm text-slate-500 italic">No results.</div>
    );
  }

  const displayRows = rows.slice(0, 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-indigo-600 uppercase tracking-wider">
          / Results
        </span>
        <span className="text-[11px] text-slate-500">
          {rows.length.toLocaleString()} row{rows.length === 1 ? '' : 's'}
          {rows.length > 100 && ' (showing first 100)'}
        </span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {columns.map(c => (
                <th key={c} className="text-left px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((r, i) => (
              <tr key={i} className={i % 2 ? 'bg-slate-50/50' : 'bg-white'}>
                {columns.map(c => (
                  <td key={c} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                    {fmtCell(r[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
