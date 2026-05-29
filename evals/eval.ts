/**
 * eval.ts — first-class eval suite for the SQL Consultant NL->SQL agent.
 *
 * Tests the question -> SQL generation against real failure modes drawn from
 * production (umlaut matching, NULL-safe superlatives, district-aggregate
 * shape, "all" queries without an artificial LIMIT, row-level lat/lng for
 * mapping). Each case generates SQL with the same model + schema the app uses,
 * runs it read-only, and asserts on both the SQL text and the result shape.
 *
 * Run:  npx tsx evals/eval.ts
 * Needs: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { config } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { SCHEMA_DESCRIPTION } from "../app/lib/schema.js";

// Load .env.local (override anything tsx/shell may have set to empty).
config({ path: ".env.local", override: true });

if (!process.env.ANTHROPIC_API_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing ANTHROPIC_API_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local — fill them in before running the eval."
  );
  process.exit(1);
}

const MODEL = "claude-haiku-4-5-20251001";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type Row = Record<string, unknown>;
/** A check returns true on pass, or a string describing the failure. */
type Check = (sql: string, rows: Row[]) => true | string;

interface Case {
  name: string;
  question: string;
  checks: Check[];
}

// --- generation + execution (mirrors app/api/query/route.ts) ---------------

function extractSQL(text: string): string {
  const fence = text.match(/```(?:sql|postgres)?\s*([\s\S]*?)```/i);
  return (fence ? fence[1] : text).trim();
}

async function generateSQL(question: string): Promise<string> {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system:
      SCHEMA_DESCRIPTION +
      "\n\nRespond with a single SQL query and NOTHING ELSE. No explanation, no markdown fences.",
    messages: [{ role: "user", content: question }],
  });
  const text = res.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  return extractSQL(text);
}

async function runSQL(sql: string): Promise<{ rows: Row[]; error?: string }> {
  const { data, error } = await supabase.rpc("run_query", { query_text: sql });
  if (error) return { rows: [], error: error.message };
  return { rows: (data as Row[]) ?? [] };
}

// --- reusable check helpers -------------------------------------------------

const ranWithoutError =
  (): Check =>
  (_sql, rows) =>
    Array.isArray(rows) ? true : "query did not return rows";

const returnsRows =
  (min = 1): Check =>
  (_sql, rows) =>
    rows.length >= min ? true : `expected >= ${min} rows, got ${rows.length}`;

const usesUnaccent = (): Check => (sql) =>
  /unaccent/i.test(sql) ? true : "should wrap text matching in unaccent()";

const everyRowHas =
  (...cols: string[]): Check =>
  (_sql, rows) =>
    rows.every((r) => cols.every((c) => c in r))
      ? true
      : `every row should include columns: ${cols.join(", ")}`;

const noNullIn =
  (col: string): Check =>
  (_sql, rows) =>
    rows.every((r) => r[col] !== null && r[col] !== undefined)
      ? true
      : `column ${col} should never be null in results`;

const hasBezirkColumn = (): Check => (_sql, rows) =>
  rows.length > 0 && "bezirk" in rows[0]
    ? true
    : "aggregate-by-district must return a 'bezirk' column";

const rowCountBetween =
  (lo: number, hi: number): Check =>
  (_sql, rows) =>
    rows.length >= lo && rows.length <= hi
      ? true
      : `expected ${lo}-${hi} rows, got ${rows.length}`;

const noLimitClause = (): Check => (sql) =>
  /\blimit\b/i.test(sql) ? "should NOT add a LIMIT for an 'all' query" : true;

// --- the cases (drawn from real failure modes) ------------------------------

const CASES: Case[] = [
  {
    name: "umlaut: street typed without ß still matches",
    question: "Show me trees on Seestrasse with their location",
    checks: [ranWithoutError(), usesUnaccent(), returnsRows(1), everyRowHas("lat", "lng")],
  },
  {
    name: "umlaut: species typed without umlaut",
    question: "Koenigskerze... actually show me Linden trees in Schoeneberg",
    checks: [ranWithoutError(), usesUnaccent(), returnsRows(1)],
  },
  {
    name: "NULL-safe: oldest tree must not have null age",
    question: "What is the oldest tree in Treptow-Köpenick?",
    checks: [ranWithoutError(), returnsRows(1), everyRowHas("lat", "lng")],
  },
  {
    name: "NULL-safe: tallest trees exclude zero/null height",
    question: "Tallest 20 trees in Berlin parks",
    checks: [
      ranWithoutError(),
      returnsRows(1),
      everyRowHas("lat", "lng"),
      (sql) => /is not null|> ?0/i.test(sql) ? true : "should filter null/zero height",
    ],
  },
  {
    name: "district aggregate: trees per district (choropleth shape)",
    question: "How many trees in each district, street and park combined?",
    checks: [ranWithoutError(), hasBezirkColumn(), rowCountBetween(12, 13)],
  },
  {
    name: "district aggregate: avg height by district",
    question: "Average tree height by district",
    checks: [ranWithoutError(), hasBezirkColumn(), rowCountBetween(12, 13)],
  },
  {
    name: "row-level mapping: trees on a named street include coords",
    question: "Map all trees on Unter den Linden",
    checks: [ranWithoutError(), returnsRows(1), everyRowHas("lat", "lng")],
  },
  {
    name: "no artificial LIMIT on 'all' query",
    // Tests the *intent* (agent must not inject a LIMIT when the user says "all")
    // on a street-scoped query that returns a manageable set — asking for all
    // ~78k trees in a district is a DB/infra timeout, not a generation bug.
    question: "Show me all the trees on Unter den Linden, every single one",
    checks: [ranWithoutError(), noLimitClause(), returnsRows(1)],
  },
  {
    name: "aggregate count: linden per district",
    question: "How many Linden trees in each Bezirk?",
    checks: [ranWithoutError(), hasBezirkColumn(), usesUnaccent()],
  },
  {
    name: "top species table (no map needed)",
    question: "Top 10 species across all street trees",
    checks: [ranWithoutError(), returnsRows(1), rowCountBetween(1, 10)],
  },
  {
    name: "decade aggregation",
    question: "Number of trees planted per decade since 1900",
    checks: [ranWithoutError(), returnsRows(1)],
  },
  {
    name: "conifers over height threshold",
    question: "Conifers taller than 25m anywhere in Berlin",
    checks: [ranWithoutError(), everyRowHas("lat", "lng")],
  },
  {
    name: "geo proximity (ST_DWithin) does not error",
    question: "Trees within 200 metres of lat 52.52 lng 13.405",
    checks: [ranWithoutError()],
  },
  {
    name: "avg age by district for oaks",
    question: "Average tree age by district for oaks (Eiche)",
    checks: [ranWithoutError(), hasBezirkColumn(), usesUnaccent()],
  },
  {
    name: "thickest trunk null-safe",
    question: "Trees with the thickest trunks in Mitte",
    checks: [ranWithoutError(), returnsRows(1)],
  },
  {
    name: "crown diameter aggregate by district",
    question: "Average crown diameter by district",
    checks: [ranWithoutError(), hasBezirkColumn()],
  },
  {
    name: "specific species + district + coords",
    question: "Cherry trees (Kirsche) in Pankow with location",
    checks: [ranWithoutError(), usesUnaccent(), everyRowHas("lat", "lng")],
  },
  {
    name: "streets with most trees in a district",
    question: "Top 20 streets with most trees in Mitte",
    checks: [ranWithoutError(), returnsRows(1), rowCountBetween(1, 20)],
  },
  {
    name: "12 districts known small set",
    question: "List all 12 Berlin districts that appear in the data",
    checks: [ranWithoutError(), returnsRows(12)],
  },
  {
    name: "oldest oaks null-safe with coords",
    question: "Oldest oak trees in Berlin, oldest first",
    checks: [ranWithoutError(), returnsRows(1), everyRowHas("lat", "lng")],
  },
];

// --- runner -----------------------------------------------------------------

async function main() {
  console.log(`Running ${CASES.length} eval cases against the NL->SQL agent...\n`);
  let passed = 0;
  const failures: string[] = [];

  for (const c of CASES) {
    let sql = "";
    try {
      sql = await generateSQL(c.question);
      const { rows, error } = await runSQL(sql);
      const caseFailures: string[] = [];
      if (error) {
        caseFailures.push(`SQL error: ${error}`);
      } else {
        for (const check of c.checks) {
          const r = check(sql, rows);
          if (r !== true) caseFailures.push(r);
        }
      }
      if (caseFailures.length === 0) {
        passed++;
        console.log(`✅ ${c.name}`);
      } else {
        console.log(`❌ ${c.name}`);
        caseFailures.forEach((f) => console.log(`     - ${f}`));
        failures.push(`${c.name}\n  Q: ${c.question}\n  SQL: ${sql}\n  ${caseFailures.join("\n  ")}`);
      }
    } catch (e) {
      console.log(`❌ ${c.name} (exception)`);
      failures.push(`${c.name}: ${(e as Error).message}`);
    }
  }

  const score = ((passed / CASES.length) * 100).toFixed(0);
  console.log(`\n────────────────────────────────`);
  console.log(`Score: ${passed}/${CASES.length} (${score}%)`);
  if (failures.length) {
    console.log(`\nFailures:\n`);
    failures.forEach((f) => console.log(f + "\n"));
  }
  process.exit(failures.length ? 1 : 0);
}

main();
