# SQL Consultant — Berlin commercial real estate

Ask questions in natural language about a database of 5,000 commercial properties in Berlin. Claude generates the SQL, your browser runs it locally against an embedded SQLite database, and Claude interprets the results in plain English.

> 🔗 **Live:** _[add deployment URL]_

## What it does

```
[User question in plain English]
         ↓
[Claude Haiku] generates SQL using the schema as context
         ↓
[sql.js / SQLite WASM] runs the query in the browser
         ↓
[Claude Haiku] interprets the result rows in plain English
         ↓
UI shows: SQL · table · map · AI interpretation
```

Examples of questions it handles:

- *Top 10 offices in Mitte over 5,000 m² with vacancy under 5%*
- *Average rent by district for properties built after 2010*
- *Map all retail properties in Neukölln with rent over €18/m²*
- *Compare avg rent and vacancy between Mitte and Friedrichshain-Kreuzberg*

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Database engine:** [sql.js](https://sql.js.org/) — SQLite compiled to WebAssembly, runs entirely client-side
- **Dataset:** 5,000 synthetic commercial properties across Berlin's 12 Bezirke (~800 KB SQLite file). Generated with realistic distributions based on Berlin Mietspiegel + public open data.
- **LLM:** Anthropic Claude Haiku 4.5 — used twice per query (NL→SQL, then results→narrative)
- **Map:** [MapLibre GL JS](https://maplibre.org/) with free CARTO Positron tiles
- **Styling:** Tailwind CSS 4
- **Deployment:** Vercel

No backend database. No tracking. The only network call to a third party is to Anthropic for the two LLM completions.

## Architecture

```
app/
├── api/query/route.ts        # Anthropic NL→SQL + results→summary endpoint
├── lib/
│   ├── schema.ts             # DB schema description fed to the LLM
│   └── db.ts                 # sql.js loader + helpers
├── components/
│   ├── QueryInput.tsx        # search bar + example questions
│   ├── SQLDisplay.tsx        # syntax-highlighted SQL block
│   ├── ResultsTable.tsx      # paginated table view
│   ├── ResultsMap.tsx        # MapLibre map for geo results
│   └── AISummary.tsx         # narrative interpretation card
├── page.tsx                  # main layout
├── layout.tsx                # metadata + fonts
└── globals.css

public/
├── sql-wasm.wasm             # SQLite WebAssembly binary (660 KB)
└── data/
    └── berlin-cre.sqlite     # the embedded database (800 KB)

scripts/
└── generate-data.py          # generates the synthetic dataset
```

## Schema

A single table `properties` with the following columns:

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary key |
| `address` | TEXT | Street + number |
| `district` | TEXT | One of Berlin's 12 Bezirke |
| `postcode` | TEXT | 5-digit German postcode |
| `lat`, `lng` | REAL | Geo coordinates |
| `property_type` | TEXT | office / retail / logistics / mixed |
| `size_sqm` | INTEGER | 50 – 50,000 |
| `year_built` | INTEGER | 1880 – 2024 |
| `rent_eur_sqm` | REAL | Monthly Kaltmiete €/m² |
| `vacancy_percent` | REAL | 0 – 40 |
| `energy_class` | TEXT | A+ to G |
| `certification` | TEXT | BNB, LEED, DGNB or none |
| `tenant_count` | INTEGER | Current tenants |

## Local development

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY
npm run dev
```

Open <http://localhost:3000>.

To regenerate the dataset:

```bash
python3 scripts/generate-data.py
```

## License

MIT.

---

Built by [Jose Heusser](https://github.com/JoseHeusser) using Claude Code and Cursor.
