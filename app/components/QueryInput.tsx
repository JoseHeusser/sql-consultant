'use client';

import { useState } from 'react';
import { useI18n } from '@/app/lib/i18n';

type Props = {
  onSubmit: (q: string) => void;
  loading: boolean;
};

export default function QueryInput({ onSubmit, loading }: Props) {
  const { t } = useI18n();
  const [value, setValue] = useState('');

  const submit = () => {
    if (loading) return;
    const q = value.trim();
    if (!q) return;
    onSubmit(q);
  };

  return (
    <div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder={t.inputPlaceholder}
          className="flex-1 px-4 py-3 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-sm"
          disabled={loading}
        />
        <button
          onClick={submit}
          disabled={loading || !value.trim()}
          className="px-5 py-3 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:from-indigo-700 hover:to-violet-800 transition"
        >
          {loading ? t.queryingBtn : t.askBtn}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold self-center mr-2">
          {t.examplesLabel}
        </span>
        {t.examples.map(q => (
          <button
            key={q}
            type="button"
            onClick={() => {
              setValue(q);
              onSubmit(q);
            }}
            disabled={loading}
            className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded-md text-[11px] hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 transition disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
