#!/usr/bin/env python3
"""
Paginate Berlin's official tree WFS and stream the data to a Supabase Postgres
database. The connection string is read from .env.local (DATABASE_URL).

Usage:
  python3 scripts/ingest-trees.py --layer strassenbaeume
  python3 scripts/ingest-trees.py --layer anlagenbaeume

Both layers share the same column set; we keep them in separate tables so
queries can scope to street-only or park-only without a discriminator column.
"""
import argparse
import os
import sys
import time
import urllib.parse
import urllib.request
import json
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

WFS_BASE = 'https://gdi.berlin.de/services/wfs/baumbestand'
PAGE_SIZE = 2000  # WFS chunk size; Berlin WFS is generous

TABLE_DDL = """
CREATE TABLE IF NOT EXISTS {table} (
  id            BIGSERIAL PRIMARY KEY,
  gisid         TEXT,
  bezirk        TEXT,
  strname       TEXT,
  hausnr        TEXT,
  art_dtsch     TEXT,
  art_bot       TEXT,
  gattung_deutsch TEXT,
  gattung       TEXT,
  art_gruppe    TEXT,
  pflanzjahr    INTEGER,
  standalter    INTEGER,
  baumhoehe     NUMERIC,
  kronedurch    NUMERIC,
  stammumfg     INTEGER,
  eigentuemer   TEXT,
  lat           NUMERIC,
  lng           NUMERIC,
  geom          GEOMETRY(Point, 4326)
);
CREATE INDEX IF NOT EXISTS idx_{table}_bezirk     ON {table} (bezirk);
CREATE INDEX IF NOT EXISTS idx_{table}_gattung    ON {table} (gattung);
CREATE INDEX IF NOT EXISTS idx_{table}_art_dtsch  ON {table} (art_dtsch);
CREATE INDEX IF NOT EXISTS idx_{table}_pflanzjahr ON {table} (pflanzjahr);
CREATE INDEX IF NOT EXISTS idx_{table}_strname    ON {table} (strname);
CREATE INDEX IF NOT EXISTS idx_{table}_geom_gist  ON {table} USING GIST (geom);
"""

INSERT_SQL = """
INSERT INTO {table}
  (gisid, bezirk, strname, hausnr, art_dtsch, art_bot,
   gattung_deutsch, gattung, art_gruppe, pflanzjahr, standalter,
   baumhoehe, kronedurch, stammumfg, eigentuemer, lat, lng, geom)
VALUES %s
"""

def fetch_page(layer: str, start: int, count: int):
    params = {
        'service': 'WFS',
        'version': '2.0.0',
        'request': 'GetFeature',
        'typeNames': f'baumbestand:{layer}',
        'outputFormat': 'application/json',
        'srsName': 'EPSG:4326',
        'startIndex': start,
        'count': count,
    }
    url = WFS_BASE + '?' + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=120) as resp:
        return json.load(resp)

def to_int(v):
    try:
        if v in (None, '', 'null'): return None
        i = int(float(v))  # tolerate "12.0" strings
        # Postgres INTEGER range
        if i < -2147483648 or i > 2147483647:
            return None
        return i
    except (ValueError, TypeError):
        return None

def to_num(v):
    try:
        if v in (None, '', 'null'): return None
        return float(v)
    except (ValueError, TypeError):
        return None

def row_from_feature(f):
    p = f.get('properties', {})
    geom = f.get('geometry') or {}
    coords = geom.get('coordinates') or [None, None]
    lng, lat = (coords + [None, None])[:2]
    return (
        p.get('gisid'),
        p.get('bezirk'),
        p.get('strname'),
        p.get('hausnr'),
        p.get('art_dtsch'),
        p.get('art_bot'),
        p.get('gattung_deutsch'),
        p.get('gattung'),
        p.get('art_gruppe'),
        to_int(p.get('pflanzjahr')),
        to_int(p.get('standalter')),
        to_num(p.get('baumhoehe')),
        to_num(p.get('kronedurch')),
        to_int(p.get('stammumfg')),
        p.get('eigentuemer'),
        lat,
        lng,
        f"SRID=4326;POINT({lng} {lat})" if (lat and lng) else None,
    )

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--layer', required=True, choices=['strassenbaeume', 'anlagenbaeume'])
    parser.add_argument('--limit', type=int, default=None, help='Optional cap on rows for testing')
    parser.add_argument('--start', type=int, default=0, help='Resume from this WFS startIndex')
    args = parser.parse_args()

    db_url = os.environ.get('DATABASE_URL')
    if not db_url:
        env_file = Path(__file__).parent.parent / '.env.local'
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith('DATABASE_URL='):
                    db_url = line.split('=', 1)[1].strip().strip('"').strip("'")
                    break
    if not db_url:
        sys.exit('DATABASE_URL not set. Add it to .env.local or export it.')

    table = 'street_trees' if args.layer == 'strassenbaeume' else 'park_trees'

    print(f'Connecting to Postgres…')
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()

    print(f'Ensuring table {table} exists…')
    cur.execute(TABLE_DDL.format(table=table))
    conn.commit()

    # Sanity: PostGIS available?
    cur.execute("SELECT 1 FROM pg_extension WHERE extname = 'postgis'")
    if not cur.fetchone():
        sys.exit('PostGIS not enabled. Run: CREATE EXTENSION postgis; in Supabase SQL editor.')

    start = args.start
    total = 0
    t0 = time.time()
    while True:
        page_size = PAGE_SIZE
        if args.limit:
            page_size = min(PAGE_SIZE, args.limit - total)
            if page_size <= 0:
                break
        print(f'Fetching {args.layer} startIndex={start} count={page_size}…')
        data = fetch_page(args.layer, start, page_size)
        features = data.get('features', [])
        if not features:
            break
        rows = [row_from_feature(f) for f in features]
        execute_values(cur, INSERT_SQL.format(table=table), rows, page_size=500)
        conn.commit()
        total += len(rows)
        start += len(features)
        elapsed = time.time() - t0
        rate = total / max(elapsed, 0.1)
        print(f'  ✓ {total:,} rows ({rate:.0f}/s)')
        if len(features) < page_size:
            break

    cur.close()
    conn.close()
    print(f'\n✓ Done. Inserted {total:,} rows into {table}.')

if __name__ == '__main__':
    main()
