# Berlin Trees · SQL Consultant

Ask Berlin's official tree cadaster of **962,000 trees** in natural language (English or German). Claude generates PostgreSQL, the query runs against Supabase Postgres + PostGIS, and Claude interprets the results in plain language.

> 🔗 **Live:** <https://sql-consultant.vercel.app>

## What it does

```
[User question in English or German]
         ↓
[Claude Haiku 4.5] generates PostgreSQL using the schema as context
         ↓
[Supabase Postgres + PostGIS] runs the query via a SECURITY DEFINER
function that blocks anything other than SELECT/WITH
         ↓
[Claude Haiku 4.5] interprets the result rows in the user's language
         ↓
UI shows: SQL (collapsed) · map (point / choropleth) · summary · table
```

If a query fails, the UI automatically asks Claude to fix the SQL given the
Postgres error, retrying up to 3 times.

## Highlights

- **Real data:** 434,765 street trees + 527,780 park trees, fetched from the
  official Berlin WFS service (Senatsverwaltung Berlin, CC0)
- **Two map modes:** point markers for individual-row queries, choropleth of
  the 12 Berliner Bezirke for aggregate-by-district queries
- **Always-on context:** district outlines are drawn even when not the focus
- **Safe SQL:** the LLM-generated SQL runs through a `run_query` function that
  enforces SELECT-only, 5s statement timeout, 10,000-row cap
- **German text matching:** `unaccent` extension normalises `ß` / `ä` / `ö`
  / `ü` so "Seestrasse" matches "Seestraße"
- **Bilingual:** UI and AI summary both available in English and German,
  toggle persisted in localStorage
- **Auto-retry:** failed queries are sent back to Claude with the error
  message, up to 3 attempts

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Database:** Supabase Postgres 17 + PostGIS 3 (Frankfurt region)
- **LLM:** Anthropic Claude Haiku 4.5
- **Map:** [MapLibre GL JS](https://maplibre.org/) with CARTO Positron tiles
- **Styling:** Tailwind CSS 4
- **Deployment:** Vercel
- **Built with:** Claude Code (Anthropic) + Supabase MCP server for database
  migration and ingestion management

## Architecture

```
app/
├── api/query/route.ts        # 4 modes: sql, run, fix, summary
├── lib/
│   ├── schema.ts             # DB schema description fed to the LLM
│   ├── supabase.ts           # Server-side Supabase client + run_query RPC
│   └── i18n.tsx              # React Context for EN/DE
├── components/
│   ├── QueryInput.tsx        # Search bar + example questions
│   ├── SQLDisplay.tsx        # Collapsible SQL block
│   ├── ResultsTable.tsx      # Paginated result table
│   ├── ResultsMap.tsx        # Point map with click popups + district borders
│   ├── ChoroplethMap.tsx     # 12 Bezirke coloured + labelled by metric
│   ├── AISummary.tsx         # Claude's plain-language interpretation
│   ├── SchemaViewer.tsx      # Modal with full schema + Bezirke
│   └── LanguageToggle.tsx    # EN/DE switch in the header
└── page.tsx                  # Main orchestrator

scripts/
├── 01-init-schema.sql        # PostGIS + tables + role + run_query function
├── 02-fix-runquery.sql       # Iterations of the safe SQL executor
└── ingest-trees.py           # Paginated WFS → Postgres ingestion

public/data/
└── berlin-bezirke.geojson    # District polygons for map overlays
```

## Database

Two tables, identical schema:

| Column | Type | Notes |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `gisid` | TEXT | Unique cadaster id |
| `bezirk` | TEXT | One of Berlin's 12 districts |
| `strname`, `hausnr` | TEXT | Street and number |
| `art_dtsch` / `art_bot` | TEXT | Species (German / Latin) |
| `gattung_deutsch` / `gattung` | TEXT | Genus |
| `art_gruppe` | TEXT | `Laubbäume` / `Nadelbäume` |
| `pflanzjahr`, `standalter` | INTEGER | Year planted, age in years |
| `baumhoehe`, `kronedurch` | NUMERIC | Tree height / crown diameter (m) |
| `stammumfg` | INTEGER | Trunk circumference (cm) |
| `lat`, `lng` | NUMERIC | Coordinates |
| `geom` | GEOMETRY(Point, 4326) | PostGIS point with GIST index |

Plus a SECURITY DEFINER function `run_query(text)` that the API calls. It:
- Rejects anything other than `SELECT` or `WITH`
- Sets `statement_timeout = '5s'`
- Wraps the user SQL in `SELECT jsonb_agg(t) FROM (... LIMIT 10000) t`
- Returns rows as JSONB

## Local development

```bash
npm install
cp .env.local.example .env.local
# fill in ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
npm run dev
```

Open <http://localhost:3000>.

To re-ingest the cadaster from scratch (this hits Berlin's WFS service):

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install psycopg2-binary
psql "$DATABASE_URL" -f scripts/01-init-schema.sql
psql "$DATABASE_URL" -f scripts/02-fix-runquery.sql
python3 scripts/ingest-trees.py --layer strassenbaeume
python3 scripts/ingest-trees.py --layer anlagenbaeume
```

Total ingestion is ~10-15 min for both layers (rate-limited by the WFS).

## Data source

- [Berlin Baumbestand WFS](https://daten.berlin.de/datensaetze/baumbestand-berlin-wms)
  · Senatsverwaltung für Mobilität, Verkehr, Klimaschutz und Umwelt Berlin
  · Datenlizenz Deutschland — Zero — Version 2.0 (CC0-equivalent)

## License

MIT.

---

Built by [Jose Heusser](https://github.com/JoseHeusser) using Claude Code +
Cursor + Codex + the Supabase MCP server.
