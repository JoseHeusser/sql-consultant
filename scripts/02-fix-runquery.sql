CREATE OR REPLACE FUNCTION public.run_query(query_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '5s'
AS $func$
DECLARE
  result JSONB;
  trimmed TEXT;
  final_query TEXT;
BEGIN
  trimmed := lower(btrim(query_text));
  IF NOT (trimmed LIKE 'select%' OR trimmed LIKE 'with%') THEN
    RAISE EXCEPTION 'Only SELECT/WITH queries are allowed.';
  END IF;

  -- Strip trailing semicolon
  final_query := regexp_replace(query_text, ';\s*$', '');

  -- Append LIMIT 10000 only if the query doesn't already have a LIMIT
  IF lower(final_query) !~ 'limit\s+[0-9]+\s*$' THEN
    final_query := final_query || ' LIMIT 10000';
  END IF;

  EXECUTE 'SELECT COALESCE(jsonb_agg(t), ''[]''::jsonb) FROM (' || final_query || ') t'
  INTO result;
  RETURN result;
END;
$func$;
