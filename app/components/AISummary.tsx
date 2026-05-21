'use client';

type Props = { summary: string };

export default function AISummary({ summary }: Props) {
  return (
    <div className="rounded-lg bg-gradient-to-br from-indigo-50 via-violet-50 to-blue-50 border border-indigo-200 p-5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M12 2 4.5 20.29l.71.71L12 18l6.79 3 .71-.71Z" /></svg>
        </div>
        <span className="text-[10px] font-mono text-indigo-700 uppercase tracking-wider font-semibold">
          / Analyst Interpretation
        </span>
      </div>
      <p className="text-sm text-slate-800 leading-relaxed">{summary}</p>
    </div>
  );
}
