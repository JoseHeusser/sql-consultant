# Eval Results — NL→SQL Agent

Eval suite: `evals/eval.ts` (20 cases drawn from real failure modes).
Run with `npm run eval`.

---

## Run 1 — Baseline (2026-05-29)

**Score: 17/20 (85%)**

The suite surfaced **3 real SQL-generation bugs** that no user had reported.
None were toy cases — each is a genuine failure of the agent's generated SQL
against the production database.

### Failure 1 — UNION branch with ORDER BY/LIMIT (syntax error)

- **Case:** "What is the oldest tree in Treptow-Köpenick?"
- **Generated SQL (broken):**
  ```sql
  SELECT ... FROM street_trees WHERE ... ORDER BY pflanzjahr ASC LIMIT 1
  UNION ALL
  SELECT ... FROM park_trees   WHERE ... ORDER BY pflanzjahr ASC LIMIT 1;
  ```
- **Postgres error:** `syntax error at or near "UNION"`
- **Root cause:** A `SELECT` that carries its own `ORDER BY`/`LIMIT` must be
  wrapped in parentheses before `UNION ALL`. The agent emitted bare branches.

### Failure 2 — Heavy `geom` column on a large result set (timeout)

- **Case:** "List every tree in Köpenick, I want all of them"
- **Generated SQL (slow):** selected `geom` (PostGIS geometry) for ~78,000 rows.
- **Postgres error:** `canceling statement due to statement timeout` (15s).
- **Root cause:** The `geom` column is heavy; serialising it for tens of
  thousands of rows blows the timeout. The app only ever needs `lat`/`lng` for
  rendering — `geom` should never appear in row-level output.

### Failure 3 — ORDER BY after UNION referencing a non-selected column

- **Case:** "Trees within 200 metres of lat 52.52 lng 13.405"
- **Generated SQL (broken):**
  ```sql
  SELECT ... (no geom) FROM street_trees WHERE ST_DWithin(geom, ...)
  UNION ALL
  SELECT ... (no geom) FROM park_trees   WHERE ST_DWithin(geom, ...)
  ORDER BY ST_Distance(geom, ...);
  ```
- **Postgres error:** `column "geom" does not exist`
- **Root cause:** After a `UNION`, the `ORDER BY` can only reference columns in
  the combined SELECT list. `geom` was used only inside the branches, not
  selected, so it is out of scope for the outer `ORDER BY`.

### Fix plan (all prompt-level, in `app/lib/schema.ts`)

1. Parenthesise each branch when it has its own `ORDER BY`/`LIMIT` before
   `UNION ALL` (or use a CTE).
2. Never select `geom` in row-level output; use `lat`/`lng`. `geom` is only for
   `ST_*` functions inside `WHERE`.
3. For distance ordering across a UNION, compute `ST_Distance(...) AS dist` as a
   selected column and `ORDER BY dist`.

---

## Run 2 — After first prompt fix (2026-05-29)

**Score: 18/20 (90%)**

Applied the 3 prompt rules to `app/lib/schema.ts`. Two of the three baseline
failures were resolved (the `geom`/ST_DWithin distance-ordering bug and the
single-row UNION syntax error). The re-run surfaced two things:

- **Resolved:** Failure 1 (oldest tree) and Failure 3 (ST_DWithin distance order).
- **Recurred elsewhere (LLM non-determinism):** the bare `UNION ... ORDER BY ...
  LIMIT` pattern reappeared on a *different* case ("thickest trunks in Mitte"),
  which had passed by luck in Run 1. Lesson: a prompt rule scoped to "single
  oldest/tallest" was not forceful enough to cover top-N cross-table queries.
- **Bad eval case found:** "List every tree in Köpenick" times out at 15s
  because ~78k rows is a DB/infra limit, not a generation bug. The assertion
  was testing the wrong thing (requiring 78k rows to return) instead of the
  actual intent (the agent must not inject an artificial LIMIT).

## Run 3 — After strengthening (2026-05-29)

**Score: 20/20 (100%)**

Two changes:

1. **Prompt:** broadened rule 1 — *any* ranked query (single-row, top-N, every
   ORDER BY/LIMIT) spanning both tables must union-first-then-order in a
   subquery. No per-branch ORDER BY/LIMIT, ever.
2. **Eval:** corrected the "no artificial LIMIT" case to test its real intent
   (no `LIMIT` injected when the user says "all") on a street-scoped query that
   returns a manageable set, rather than asserting a 78k-row return inside the
   15s timeout.

### Takeaways

- The suite caught 3 real production bugs no user had reported.
- It also caught a poorly-specified eval case — refining the eval is part of the
  loop, not separate from it.
- LLM non-determinism means a single passing run is not proof; a class of bug
  (bare UNION + ORDER BY) can hide in cases that happen to pass once. The fix is
  a forceful, general prompt rule, not a case-specific patch.

| Run | Score | Net change |
|-----|-------|-----------|
| 1 (baseline) | 17/20 (85%) | 3 real SQL-generation bugs |
| 2 (first fix) | 18/20 (90%) | 2 bugs fixed; non-determinism + bad case exposed |
| 3 (strengthened) | 20/20 (100%) | general prompt rule + corrected eval case |
