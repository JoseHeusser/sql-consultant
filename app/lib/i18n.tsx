'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Lang = 'en' | 'de';

export const MESSAGES = {
  en: {
    appTitle: 'Berlin Trees · SQL Consultant',
    appSubtitle: "Ask Berlin's official tree cadaster in natural language",
    viewSchema: 'View schema',
    treeCount: '962k trees',
    headline: "Ask Berlin's 962,000 trees anything.",
    inputPlaceholder: "Ask anything about Berlin's trees...",
    examplesLabel: 'Examples',
    askBtn: 'Ask',
    queryingBtn: 'Querying…',
    questionLabel: '/ Question',
    sqlLabel: '/ Generated SQL',
    sqlLines: 'lines',
    sqlChars: 'chars',
    copy: 'Copy',
    mapPoint: (n: number) => `/ Map (${n.toLocaleString()} points · click any for details)`,
    mapChoropleth: (col: string) => `/ Choropleth — ${col} by district · click for details`,
    resultsLabel: '/ Results',
    rowsLabel: (n: number) => `${n.toLocaleString()} row${n === 1 ? '' : 's'}`,
    showingFirst: '(showing first 100)',
    summaryLabel: '/ Analyst Interpretation',
    stageSql: 'Generating SQL with Claude…',
    stageRun: 'Running query on Supabase…',
    stageRetry: (n: number, m: number) => `Query failed, asking Claude to fix it (attempt ${n}/${m})…`,
    stageSummary: 'Interpreting results…',
    errorLabel: 'Error:',
    emptyTitle: 'No results.',
    emptyHint: 'The query ran successfully but returned zero rows. Try rephrasing (German street names use ß and umlauts — e.g. Seestraße, Schöneberg) or check the schema.',
    schemaTitle: 'Database schema',
    schemaSubtitle: 'Both tables share the same column set',
    schemaTables: 'Tables',
    schemaColumns: 'Columns',
    schemaBezirke: '12 Bezirke',
    schemaColumn: 'Column',
    schemaType: 'Type',
    schemaDescription: 'Description',
    schemaFooter: 'Use district names with their German umlauts exactly. For map results, row-level queries should include lat and lng; aggregate-by-district queries should return bezirk + a numeric column.',
    streetTrees: 'Straßenbäume — trees along Berlin streets',
    parkTrees: 'Anlagenbäume — trees in parks and green areas',
    examples: [
      'Oldest tree in Treptow-Köpenick',
      'Tallest 50 trees in Berlin parks',
      'Map all trees on Unter den Linden',
      'Linden trees over 100 years old in Kreuzberg',
      'Cherry trees (Kirsche) in Pankow with location',
      'Conifers taller than 25m anywhere in Berlin',
      'Trees per district, street and park combined',
      'Average tree height by district',
      'Average tree age by district for oaks',
      'How many Linden trees in each Bezirk?',
      'Top 10 species across all street trees',
      'Top 20 streets with most trees in Mitte',
      'Number of trees planted per decade since 1900',
    ],
    footerData: 'Data',
    footerCredit: '435k street trees + 528k park trees · Senatsverwaltung Berlin · CC0',
    footerGithub: 'GitHub',
    footerPortfolio: 'Portfolio',
  },
  de: {
    appTitle: 'Berliner Bäume · SQL-Berater',
    appSubtitle: 'Frag Berlins offizielles Baumkataster in natürlicher Sprache',
    viewSchema: 'Schema',
    treeCount: '962k Bäume',
    headline: 'Frag Berlins 962.000 Bäume alles.',
    inputPlaceholder: 'Frag etwas über Berlins Bäume...',
    examplesLabel: 'Beispiele',
    askBtn: 'Fragen',
    queryingBtn: 'Suche…',
    questionLabel: '/ Frage',
    sqlLabel: '/ Generiertes SQL',
    sqlLines: 'Zeilen',
    sqlChars: 'Zeichen',
    copy: 'Kopieren',
    mapPoint: (n: number) => `/ Karte (${n.toLocaleString('de-DE')} Punkte · für Details klicken)`,
    mapChoropleth: (col: string) => `/ Choropleth — ${col} pro Bezirk · für Details klicken`,
    resultsLabel: '/ Ergebnisse',
    rowsLabel: (n: number) => `${n.toLocaleString('de-DE')} Zeile${n === 1 ? '' : 'n'}`,
    showingFirst: '(erste 100 angezeigt)',
    summaryLabel: '/ Analyse',
    stageSql: 'SQL wird mit Claude generiert…',
    stageRun: 'Abfrage läuft auf Supabase…',
    stageRetry: (n: number, m: number) => `Abfrage fehlgeschlagen, Claude korrigiert (Versuch ${n}/${m})…`,
    stageSummary: 'Ergebnisse werden interpretiert…',
    errorLabel: 'Fehler:',
    emptyTitle: 'Keine Ergebnisse.',
    emptyHint: 'Die Abfrage war erfolgreich, aber hat keine Zeilen zurückgegeben. Formuliere die Frage anders oder schau ins Schema.',
    schemaTitle: 'Datenbank-Schema',
    schemaSubtitle: 'Beide Tabellen haben dieselbe Spalten-Struktur',
    schemaTables: 'Tabellen',
    schemaColumns: 'Spalten',
    schemaBezirke: '12 Bezirke',
    schemaColumn: 'Spalte',
    schemaType: 'Typ',
    schemaDescription: 'Beschreibung',
    schemaFooter: 'Verwende Bezirksnamen mit Umlauten und ß exakt. Für Karten-Ergebnisse: Zeilen-Queries sollten lat und lng enthalten; Aggregat-Queries pro Bezirk sollten bezirk + eine numerische Spalte zurückgeben.',
    streetTrees: 'Straßenbäume — Bäume entlang Berliner Straßen',
    parkTrees: 'Anlagenbäume — Bäume in Parks und Grünanlagen',
    examples: [
      'Ältester Baum in Treptow-Köpenick',
      'Die 50 höchsten Bäume in Berlins Parks',
      'Alle Bäume auf Unter den Linden auf der Karte',
      'Linden über 100 Jahre alt in Kreuzberg',
      'Kirschbäume in Pankow mit Standort',
      'Nadelbäume höher als 25m in ganz Berlin',
      'Bäume pro Bezirk, Straße und Park kombiniert',
      'Durchschnittliche Baumhöhe pro Bezirk',
      'Durchschnittliches Alter der Eichen pro Bezirk',
      'Wie viele Linden in jedem Bezirk?',
      'Top 10 Arten aller Straßenbäume',
      'Top 20 Straßen mit den meisten Bäumen in Mitte',
      'Anzahl der Bäume gepflanzt pro Jahrzehnt seit 1900',
    ],
    footerData: 'Daten',
    footerCredit: '435k Straßenbäume + 528k Anlagenbäume · Senatsverwaltung Berlin · CC0',
    footerGithub: 'GitHub',
    footerPortfolio: 'Portfolio',
  },
} as const;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: typeof MESSAGES['en'] };

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('lang') : null;
    if (stored === 'en' || stored === 'de') setLangState(stored);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== 'undefined') localStorage.setItem('lang', l);
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t: MESSAGES[lang] as typeof MESSAGES['en'] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
