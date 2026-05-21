-- ============================================================================
-- Berlin Trees · SQL Consultant — initial schema
-- Run this once in the Supabase SQL Editor for the project that will host
-- the tree cadaster. Idempotent: re-running is safe.
-- ============================================================================

-- 1. Extensions ---------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Tables -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.street_trees (
  id              BIGSERIAL PRIMARY KEY,
  gisid           TEXT,
  bezirk          TEXT,
  strname         TEXT,
  hausnr          TEXT,
  art_dtsch       TEXT,
  art_bot         TEXT,
  gattung_deutsch TEXT,
  gattung         TEXT,
  art_gruppe      TEXT,
  pflanzjahr      INTEGER,
  standalter      INTEGER,
  baumhoehe       NUMERIC,
  kronedurch      NUMERIC,
  stammumfg       INTEGER,
  eigentuemer     TEXT,
  lat             NUMERIC,
  lng             NUMERIC,
  geom            GEOMETRY(Point, 4326)
);

CREATE TABLE IF NOT EXISTS public.park_trees (LIKE public.street_trees INCLUDING ALL);

-- 3. Indices ------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_street_trees_bezirk     ON public.street_trees (bezirk);
CREATE INDEX IF NOT EXISTS idx_street_trees_gattung    ON public.street_trees (gattung);
CREATE INDEX IF NOT EXISTS idx_street_trees_art_dtsch  ON public.street_trees (art_dtsch);
CREATE INDEX IF NOT EXISTS idx_street_trees_pflanzjahr ON public.street_trees (pflanzjahr);
CREATE INDEX IF NOT EXISTS idx_street_trees_strname    ON public.street_trees (strname);
CREATE INDEX IF NOT EXISTS idx_street_trees_geom       ON public.street_trees USING GIST (geom);

CREATE INDEX IF NOT EXISTS idx_park_trees_bezirk       ON public.park_trees (bezirk);
CREATE INDEX IF NOT EXISTS idx_park_trees_gattung      ON public.park_trees (gattung);
CREATE INDEX IF NOT EXISTS idx_park_trees_art_dtsch    ON public.park_trees (art_dtsch);
CREATE INDEX IF NOT EXISTS idx_park_trees_pflanzjahr   ON public.park_trees (pflanzjahr);
CREATE INDEX IF NOT EXISTS idx_park_trees_strname      ON public.park_trees (strname);
CREATE INDEX IF NOT EXISTS idx_park_trees_geom         ON public.park_trees USING GIST (geom);

-- 4. Read-only role for LLM-generated SQL ------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'llm_readonly') THEN
    CREATE ROLE llm_readonly NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO llm_readonly;
GRANT SELECT ON public.street_trees TO llm_readonly;
GRANT SELECT ON public.park_trees   TO llm_readonly;
-- Make sure they cannot see anything else
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM llm_readonly;
GRANT SELECT ON public.street_trees TO llm_readonly;
GRANT SELECT ON public.park_trees   TO llm_readonly;

-- 5. Safe run_query function -------------------------------------------------
-- The API only ever calls this. It enforces:
--   - read-only role
--   - statement timeout (5 s)
--   - row limit (10,000 cap)
--   - block of any DDL/DML by virtue of role permissions
-- Returns a JSON array of rows.
CREATE OR REPLACE FUNCTION public.run_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
  trimmed TEXT;
BEGIN
  trimmed := lower(btrim(query_text));
  IF NOT (trimmed LIKE 'select%' OR trimmed LIKE 'with%') THEN
    RAISE EXCEPTION 'Only SELECT/WITH queries are allowed.';
  END IF;

  SET LOCAL ROLE llm_readonly;
  SET LOCAL statement_timeout = '5s';

  EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || query_text || ' LIMIT 10000) t'
  INTO result;

  RESET ROLE;
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RAISE;
END $$;

REVOKE ALL ON FUNCTION public.run_query(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_query(TEXT) TO service_role, authenticated, anon;

-- ============================================================================
-- Verification queries (optional — run separately to confirm setup)
-- ============================================================================
-- SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis';
-- SELECT * FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- SELECT proname FROM pg_proc WHERE proname = 'run_query';
