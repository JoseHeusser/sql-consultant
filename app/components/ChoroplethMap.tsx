'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Row } from '@/app/page';

type Props = {
  rows: Row[];
  valueColumn: string;   // numeric column to color by
  bezirkColumn: string;  // column holding the district name (typically 'bezirk')
};

const mapStyle: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
        'https://cartodb-basemaps-b.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#f8fafc' } },
    { id: 'carto', type: 'raster', source: 'carto' },
  ],
};

const STOPS = ['#dbeafe', '#a5b4fc', '#818cf8', '#6366f1', '#3730a3'];

function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

function colorFor(value: number, min: number, max: number): string {
  if (max === min) return STOPS[2];
  const t = (value - min) / (max - min);
  const i = Math.min(STOPS.length - 2, Math.floor(t * (STOPS.length - 1)));
  const localT = t * (STOPS.length - 1) - i;
  return lerpColor(STOPS[i], STOPS[i + 1], localT);
}

function fmtValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `${(v / 1_000).toFixed(0)}k`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  if (!Number.isInteger(v)) return v.toFixed(1);
  return v.toString();
}

export default function ChoroplethMap({ rows, valueColumn, bezirkColumn }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!containerRef.current || initialized.current) return;
    initialized.current = true;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      bounds: [[13.085, 52.34], [13.770, 52.68]],
      fitBoundsOptions: { padding: 30 },
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', async () => {
      const geojson = await fetch('/data/berlin-bezirke.geojson').then(r => r.json());

      // Build a lookup of bezirk → value
      const valueByBezirk = new Map<string, number>();
      for (const r of rows) {
        const k = String(r[bezirkColumn]);
        const v = r[valueColumn];
        if (typeof v === 'number') valueByBezirk.set(k, v);
      }

      const values = Array.from(valueByBezirk.values());
      const min = Math.min(...values);
      const max = Math.max(...values);

      // Inject the value as a feature property + compute label centroid
      type LabelFeature = {
        type: 'Feature';
        geometry: { type: 'Point'; coordinates: [number, number] };
        properties: { name: string; value: number; label: string };
      };
      const labelFeatures: LabelFeature[] = [];
      for (const f of geojson.features) {
        const name = f.properties.name as string;
        const v = valueByBezirk.get(name);
        f.properties.value = v ?? null;
        f.properties.fillColor = v != null ? colorFor(v, min, max) : '#e2e8f0';
        f.properties.label = v != null ? fmtValue(v) : '';

        // crude centroid of the multipolygon's first ring
        try {
          const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
          let lonSum = 0, latSum = 0, count = 0;
          for (const poly of polys) {
            for (const pt of poly[0]) {
              lonSum += pt[0]; latSum += pt[1]; count++;
            }
          }
          if (count > 0 && v != null) {
            labelFeatures.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lonSum / count, latSum / count] },
              properties: { name, value: v, label: fmtValue(v) },
            });
          }
        } catch { /* noop */ }
      }

      map.addSource('bezirke', { type: 'geojson', data: geojson });
      map.addLayer({
        id: 'bezirke-fill',
        type: 'fill',
        source: 'bezirke',
        paint: {
          'fill-color': ['get', 'fillColor'],
          'fill-opacity': 0.75,
        },
      });
      map.addLayer({
        id: 'bezirke-outline',
        type: 'line',
        source: 'bezirke',
        paint: { 'line-color': '#ffffff', 'line-width': 1.5 },
      });

      map.addSource('labels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: labelFeatures },
      });
      map.addLayer({
        id: 'bezirke-labels',
        type: 'symbol',
        source: 'labels',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 14,
          'text-font': ['Noto Sans Regular'],
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2.5,
        },
      });
      map.addLayer({
        id: 'bezirke-names',
        type: 'symbol',
        source: 'labels',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 10,
          'text-font': ['Noto Sans Regular'],
          'text-anchor': 'top',
          'text-offset': [0, 0.8],
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#475569',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; initialized.current = false; };
  }, [rows, valueColumn, bezirkColumn]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-indigo-600 uppercase tracking-wider">
          / Choropleth — {valueColumn} by district
        </span>
      </div>
      <div ref={containerRef} className="w-full h-96 rounded-lg overflow-hidden border border-slate-200" />
    </div>
  );
}
