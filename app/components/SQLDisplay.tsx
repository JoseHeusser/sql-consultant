'use client';

type Props = { sql: string };

export default function SQLDisplay({ sql }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-indigo-600 uppercase tracking-wider">
          / Generated SQL
        </span>
        <button
          onClick={() => navigator.clipboard.writeText(sql)}
          className="text-[11px] text-slate-500 hover:text-slate-900 font-medium"
          title="Copy SQL"
        >
          Copy
        </button>
      </div>
      <pre className="bg-slate-900 text-slate-100 text-xs font-mono p-4 rounded-lg overflow-x-auto leading-relaxed">
        <code>{sql}</code>
      </pre>
    </div>
  );
}
