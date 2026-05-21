'use client';

import { useState } from 'react';
import { useI18n } from '@/app/lib/i18n';

const COLUMNS: { name: string; type: string; desc_en: string; desc_de: string }[] = [
  { name: 'id',              type: 'BIGINT',   desc_en: 'Primary key',                        desc_de: 'Primärschlüssel' },
  { name: 'gisid',           type: 'TEXT',     desc_en: 'Unique cadaster id',                 desc_de: 'Eindeutige Kataster-ID' },
  { name: 'bezirk',          type: 'TEXT',     desc_en: 'District (12 Berlin Bezirke)',       desc_de: 'Bezirk (12 Berliner Bezirke)' },
  { name: 'strname',         type: 'TEXT',     desc_en: 'Street name',                        desc_de: 'Straßenname' },
  { name: 'hausnr',          type: 'TEXT',     desc_en: 'House number',                       desc_de: 'Hausnummer' },
  { name: 'art_dtsch',       type: 'TEXT',     desc_en: 'Species (German)',                   desc_de: 'Art (Deutsch)' },
  { name: 'art_bot',         type: 'TEXT',     desc_en: 'Botanical / Latin name',             desc_de: 'Botanischer / lateinischer Name' },
  { name: 'gattung_deutsch', type: 'TEXT',     desc_en: 'Genus (German) — e.g. LINDE, EICHE', desc_de: 'Gattung (Deutsch) — z.B. LINDE, EICHE' },
  { name: 'gattung',         type: 'TEXT',     desc_en: 'Genus (Latin) — TILIA, QUERCUS',     desc_de: 'Gattung (Latein) — TILIA, QUERCUS' },
  { name: 'art_gruppe',      type: 'TEXT',     desc_en: 'Group: Laubbäume / Nadelbäume',      desc_de: 'Gruppe: Laubbäume / Nadelbäume' },
  { name: 'pflanzjahr',      type: 'INTEGER',  desc_en: 'Year planted (1700-2025)',           desc_de: 'Pflanzjahr (1700-2025)' },
  { name: 'standalter',      type: 'INTEGER',  desc_en: 'Age in years',                       desc_de: 'Alter in Jahren' },
  { name: 'baumhoehe',       type: 'NUMERIC',  desc_en: 'Tree height (m)',                    desc_de: 'Baumhöhe (m)' },
  { name: 'kronedurch',      type: 'NUMERIC',  desc_en: 'Crown diameter (m)',                 desc_de: 'Kronendurchmesser (m)' },
  { name: 'stammumfg',       type: 'INTEGER',  desc_en: 'Trunk circumference (cm)',           desc_de: 'Stammumfang (cm)' },
  { name: 'eigentuemer',     type: 'TEXT',     desc_en: 'Owner (usually Land Berlin)',        desc_de: 'Eigentümer (meist Land Berlin)' },
  { name: 'lat',             type: 'NUMERIC',  desc_en: 'Latitude',                           desc_de: 'Breitengrad' },
  { name: 'lng',             type: 'NUMERIC',  desc_en: 'Longitude',                          desc_de: 'Längengrad' },
  { name: 'geom',            type: 'GEOMETRY', desc_en: 'PostGIS Point (EPSG:4326)',          desc_de: 'PostGIS-Punkt (EPSG:4326)' },
];

const BEZIRKE = [
  'Mitte', 'Friedrichshain-Kreuzberg', 'Pankow', 'Charlottenburg-Wilmersdorf',
  'Spandau', 'Steglitz-Zehlendorf', 'Tempelhof-Schöneberg', 'Neukölln',
  'Treptow-Köpenick', 'Marzahn-Hellersdorf', 'Lichtenberg', 'Reinickendorf',
];

export default function SchemaViewer() {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50 transition"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="4" x2="9" y2="20"/></svg>
        {t.viewSchema}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>

            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div>
                <h3 className="font-bold text-slate-900">{t.schemaTitle}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{t.schemaSubtitle}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-900 p-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t.schemaTables}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="font-mono text-sm font-bold text-slate-900">street_trees</div>
                    <div className="text-xs text-slate-600 mt-1">{t.streetTrees}</div>
                    <div className="text-xs text-indigo-600 font-mono mt-1">434,765 {lang === 'en' ? 'rows' : 'Zeilen'}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="font-mono text-sm font-bold text-slate-900">park_trees</div>
                    <div className="text-xs text-slate-600 mt-1">{t.parkTrees}</div>
                    <div className="text-xs text-indigo-600 font-mono mt-1">527,780 {lang === 'en' ? 'rows' : 'Zeilen'}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t.schemaColumns}</h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">{t.schemaColumn}</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">{t.schemaType}</th>
                        <th className="text-left px-3 py-2 font-semibold text-slate-700">{t.schemaDescription}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COLUMNS.map((c, i) => (
                        <tr key={c.name} className={i % 2 ? 'bg-slate-50/50' : 'bg-white'}>
                          <td className="px-3 py-2 font-mono text-slate-900 font-medium whitespace-nowrap">{c.name}</td>
                          <td className="px-3 py-2 font-mono text-indigo-600 whitespace-nowrap">{c.type}</td>
                          <td className="px-3 py-2 text-slate-700">{lang === 'en' ? c.desc_en : c.desc_de}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">{t.schemaBezirke}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {BEZIRKE.map(b => (
                    <span key={b} className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-medium">
                      {b}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-xs text-slate-500 italic leading-relaxed border-t border-slate-200 pt-4">
                {t.schemaFooter}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
