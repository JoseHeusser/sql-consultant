import Link from "next/link";

export const metadata = {
  title: "Eval-Driven Development · Berlin Trees SQL Consultant",
  description:
    "How a first-class eval suite drove the natural-language-to-SQL agent from 85% to 100%, catching three real production bugs.",
};

const runs = [
  { run: "1 · Baseline", score: "17/20", pct: "85%", note: "3 real SQL-generation bugs surfaced" },
  { run: "2 · First fix", score: "18/20", pct: "90%", note: "2 bugs fixed; LLM non-determinism + a bad eval case exposed" },
  { run: "3 · Strengthened", score: "20/20", pct: "100%", note: "general prompt rule + corrected eval case" },
];

const bugs = [
  {
    title: "UNION branch with ORDER BY / LIMIT",
    q: "What is the oldest tree in Treptow-Köpenick?",
    err: "syntax error at or near \"UNION\"",
    cause:
      "A SELECT carrying its own ORDER BY/LIMIT must be parenthesised before UNION ALL. The agent emitted bare branches.",
  },
  {
    title: "Heavy geom column on a large result set",
    q: "List every tree in Köpenick, all of them",
    err: "canceling statement due to statement timeout (15s)",
    cause:
      "Serialising the PostGIS geom column for ~78k rows blows the timeout. Row-level output only needs lat/lng.",
  },
  {
    title: "ORDER BY after UNION referencing a non-selected column",
    q: "Trees within 200 m of a point",
    err: "column \"geom\" does not exist",
    cause:
      "After a UNION, ORDER BY can only reference columns in the combined SELECT list. Distance must be selected as an aliased column first.",
  },
];

export default function EvalsPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="text-sm font-medium text-indigo-600 hover:underline">
          ← Back to the app
        </Link>

        <h1 className="mt-6 text-3xl font-bold tracking-tight">Eval-Driven Development</h1>
        <p className="mt-3 text-lg text-slate-600">
          The natural-language-to-SQL agent is backed by a first-class eval suite
          (<code className="rounded bg-slate-200 px-1.5 py-0.5 text-sm">evals/eval.ts</code>, 20 cases
          drawn from real failure modes). Each case generates SQL with the same model and schema the
          app uses, runs it read-only against the 962k-row cadaster, and asserts on both the SQL text
          and the result shape.
        </p>

        <h2 className="mt-12 text-xl font-semibold">From 85% to 100% in three runs</h2>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Run</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">What changed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.map((r) => (
                <tr key={r.run}>
                  <td className="px-4 py-3 font-medium">{r.run}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.score} <span className="text-slate-400">({r.pct})</span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-12 text-xl font-semibold">The three real bugs it caught</h2>
        <p className="mt-2 text-slate-600">
          None were toy cases — each was a genuine failure of the agent&apos;s generated SQL that no
          user had reported.
        </p>
        <div className="mt-6 space-y-4">
          {bugs.map((b, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-rose-600">#{i + 1}</span>
                <h3 className="font-semibold">{b.title}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Question: <span className="italic">&ldquo;{b.q}&rdquo;</span>
              </p>
              <p className="mt-1 font-mono text-xs text-rose-700">{b.err}</p>
              <p className="mt-2 text-sm text-slate-600">{b.cause}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-xl font-semibold">What the loop taught</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
          <li>The suite caught three real production bugs no user had reported.</li>
          <li>
            It also caught a poorly-specified eval case — refining the eval is part of the loop, not
            separate from it.
          </li>
          <li>
            LLM non-determinism means a single passing run is not proof: a class of bug (bare UNION +
            ORDER BY) hid in a case that happened to pass once. The fix was a forceful, general prompt
            rule, not a case-specific patch.
          </li>
        </ul>

        <div className="mt-12 flex flex-wrap gap-4 text-sm font-medium">
          <a
            href="https://github.com/JoseHeusser/sql-consultant/blob/main/evals/eval.ts"
            target="_blank"
            rel="noopener"
            className="text-indigo-600 hover:underline"
          >
            View eval.ts on GitHub →
          </a>
          <a
            href="https://github.com/JoseHeusser/berlin-trees-mcp"
            target="_blank"
            rel="noopener"
            className="text-indigo-600 hover:underline"
          >
            Custom MCP server →
          </a>
        </div>
      </div>
    </main>
  );
}
