'use client';

import { useState } from 'react';
import { useI18n } from '@/app/lib/i18n';

type Props = { sql: string };

export default function SQLDisplay({ sql }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-indigo-600 uppercase tracking-wider">
            {t.sqlLabel}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {sql.split('\n').length} {t.sqlLines} · {sql.length} {t.sqlChars}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(sql); }}
            className="text-[11px] text-slate-500 hover:text-slate-900 font-medium cursor-pointer"
          >
            {t.copy}
          </span>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {open && (
        <pre className="bg-slate-900 text-slate-100 text-xs font-mono p-4 overflow-x-auto leading-relaxed border-t border-slate-200 rounded-b-lg">
          <code>{sql}</code>
        </pre>
      )}
    </div>
  );
}
