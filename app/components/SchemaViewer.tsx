'use client';

import { useState } from 'react';

const TABLES = [
  {
    name: 'street_trees',
    description: 'Straßenbäume — trees along Berlin streets',
    rows: 434765,
  },
  {
    name: 'park_trees',
    description: 'Anlagenbäume — trees in parks and green areas',
    rows: 527780,
  },
];

const COLUMNS: { name: string; type: string; desc: string }[] = [
  { name: 'id',              type: 'BIGINT',     desc: 'Primary key' },
  { name: 'gisid',           type: 'TEXT',       desc: 'Unique cadaster id' },
  { name: 'bezirk',          type: 'TEXT',       desc: 'District (12 Berlinés Bezirke)' },
  { name: 'strname',         type: 'TEXT',       desc: 'Street name' },
  { name: 'hausnr',          type: 'TEXT',       desc: 'House number' },
  { name: 'art_dtsch',       type: 'TEXT',       desc: 'Species (German)' },
  { name: 'art_bot',         type: 'TEXT',       desc: 'Botanical / Latin name' },
  { name: 'gattung_deutsch', type: 'TEXT',       desc: 'Genus (German) — e.g. LINDE, EICHE' },
  { name: 'gattung',         type: 'TEXT',       desc: 'Genus (Latin) — TILIA, QUERCUS' },
  { name: 'art_gruppe',      type: 'TEXT',       desc: 'Group: Laubbäume / Nadelbäume' },
  { name: 'pflanzjahr',      type: 'INTEGER',    desc: 'Year planted (1700-2025)' },
  { name: 'standalter',      type: 'INTEGER',    desc: 'Age in years' },
  { name: 'baumhoehe',       type: 'NUMERIC',    desc: 'Tree height (m)' },
  { name: 'kronedurch',      type: 'NUMERIC',    desc: 'Crown diameter (m)' },
  { name: 'stammumfg',       type: 'INTEGER',    desc: 'Trunk circumference (cm)' },
  { name: 'eigentuemer',     type: 'TEXT',       desc: 'Owner (usually Land Berlin)' },
  { name: 'lat',             type: 'NUMERIC',    desc: 'Latitude' },
  { name: 'lng',             type: 'NUMERIC',    desc: 'Longitude' },
  { name: 'geom',            type: 'GEOMETRY',   desc: 'PostGIS Point (EPSG:4326)' },
];

const BEZIRKE = [
  'Mitte', 'Friedrichshain-Kreuzberg', 'Pankow', 'Charlottenburg-Wilmersdorf',
  'Spandau', 'Steglitz-Zehlendorf', 'Tempelhof-Schöneberg', 'Neukölln',
  'Treptow-Köpenick', 'Marzahn-Hellersdorf', 'Lichtenberg', 'Reinickendorf',
];

export default function SchemaViewer() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="4" x2="9" y2="20"/></svg>
        View schema
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>

            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h3 className="font-bold text-slate-900">Database schema</h3>
                <p className="text-xs text-slate-500 mt-0.5">Both tables share the same column set</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-900 p-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Tables</h4>
                <div className="grid grid-cols-2 gap-3">
                  {TABLES.map(t => (
                    <div key={t.name} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="font-mono text-sm font-bold text-slate-900">{t.name}</div>
                      <div className="text-xs text-slate-600 mt-1">{t.description}</div>
                      <div className="text-xs text-indigo-600 font-mono mt-1">{t.rows.toLocaleString()} rows</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Columns</h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">Column</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">Type</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COLUMNS.map((c, i) => (
                        <tr key={c.name} className={i % 2 ? 'bg-slate-50/50' : 'bg-white'}>
                          <td className="px-3 py-2 font-mono text-slate-900 font-medium whitespace-nowrap">{c.name}</td>
                          <td className="px-3 py-2 font-mono text-indigo-600 whitespace-nowrap">{c.type}</td>
                          <td className="px-3 py-2 text-slate-700">{c.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">12 Bezirke</h4>
                <div className="flex flex-wrap gap-1.5">
                  {BEZIRKE.map(b => (
                    <span key={b} className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-medium">
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-xs text-slate-500 italic leading-relaxed border-t border-slate-200 pt-4">
                Use District names with their German umlauts exactly. For map results,
                row-level queries should include <code className="font-mono text-slate-700">lat</code> and <code className="font-mono text-slate-700">lng</code>;
                aggregate-by-district queries should return <code className="font-mono text-slate-700">bezirk</code> + a numeric column.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
