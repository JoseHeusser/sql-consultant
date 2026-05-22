-- Safe SQL executor for the SQL Consultant API.
--
-- Design:
--   * Only accepts queries starting with SELECT or WITH (whitespace/case insensitive).
--   * Wraps the user query in `SELECT jsonb_agg(t) FROM (<sql>) t` so any attempt
--     to escape via multiple statements fails parsing.
--   * Statement timeout (15s) is the only safety net against runaway queries.
--     No artificial row cap — if the dataset honestly has 962k matching rows,
--     return them. Display layers (map / table / summary) decide their own limits.
--   * SECURITY DEFINER so the API can call this with the service_role key
--     without exposing data-mutating capabilities to clients.

CREATE OR REPLACE FUNCTION public.run_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '15s'
AS $func$
DECLARE
  result JSONB;
  trimmed TEXT;
  final_query TEXT;
BEGIN
  trimmed := lower(btrim(query_text, E' \t\n\r'));
  IF NOT (trimmed LIKE 'select%' OR trimmed LIKE 'with%') THEN
    RAISE EXCEPTION 'Only SELECT/WITH queries are allowed.';
  END IF;

  final_query := regexp_replace(query_text, ';\s*$', '');

  EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || final_query || ') t'
  INTO result;
  RETURN result;
END;
$func$;
