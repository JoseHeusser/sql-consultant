'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Row } from '@/app/page';
import { useI18n } from '@/app/lib/i18n';

type Props = {
  rows: Row[];
  valueColumn: string;
  bezirkColumn: string;
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

function lerp(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const r = Math.round(((ah >> 16) & 0xff) + (((bh >> 16) & 0xff) - ((ah >> 16) & 0xff)) * t);
  const g = Math.round(((ah >> 8) & 0xff) + (((bh >> 8) & 0xff) - ((ah >> 8) & 0xff)) * t);
  const bl = Math.round((ah & 0xff) + ((bh & 0xff) - (ah & 0xff)) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

function color(value: number, min: number, max: number): string {
  if (max === min) return STOPS[2];
  const t = (value - min) / (max - min);
  const i = Math.min(STOPS.length - 2, Math.floor(t * (STOPS.length - 1)));
  return lerp(STOPS[i], STOPS[i + 1], t * (STOPS.length - 1) - i);
}

function fmt(v: number): string {
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
  const [glUnavailable, setGlUnavailable] = useState(false);

  useEffect(() => {
    if (!containerRef.current || initialized.current) return;
    initialized.current = true;

    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: mapStyle,
        bounds: [[13.085, 52.34], [13.770, 52.68]],
        fitBoundsOptions: { padding: 30 },
        attributionControl: { compact: true },
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    } catch {
      // WebGL may be unavailable on some mobile devices / privacy browsers.
      initialized.current = false;
      setGlUnavailable(true);
      return;
    }

    map.on('load', async () => {
      const geojson = await fetch('/data/berlin-bezirke.geojson').then(r => r.json());

      // Build value lookup and find row by bezirk for popup content
      const valueByBezirk = new Map<string, number>();
      const rowByBezirk = new Map<string, Row>();
      for (const r of rows) {
        const k = String(r[bezirkColumn]);
        const v = r[valueColumn];
        if (typeof v === 'number') valueByBezirk.set(k, v);
        rowByBezirk.set(k, r);
      }

      const values = Array.from(valueByBezirk.values());
      const min = Math.min(...values);
      const max = Math.max(...values);

      type LabelFeature = {
        type: 'Feature';
        geometry: { type: 'Point'; coordinates: [number, number] };
        properties: { name: string; label: string };
      };
      const labelFeatures: LabelFeature[] = [];
      for (const f of geojson.features) {
        const name = f.properties.name as string;
        const v = valueByBezirk.get(name);
        f.properties.fillColor = v != null ? color(v, min, max) : '#e2e8f0';
        f.properties.value = v ?? null;
        try {
          const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
          let lonSum = 0, latSum = 0, count = 0;
          for (const poly of polys) for (const pt of poly[0]) { lonSum += pt[0]; latSum += pt[1]; count++; }
          if (count > 0 && v != null) {
            labelFeatures.push({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [lonSum / count, latSum / count] },
              properties: { name, label: fmt(v) },
            });
          }
        } catch { /* noop */ }
      }

      map.addSource('bezirke', { type: 'geojson', data: geojson });
      map.addLayer({
        id: 'bezirke-fill',
        type: 'fill',
        source: 'bezirke',
        paint: { 'fill-color': ['get', 'fillColor'], 'fill-opacity': 0.78 },
      });
      map.addLayer({
        id: 'bezirke-outline',
        type: 'line',
        source: 'bezirke',
        paint: { 'line-color': '#ffffff', 'line-width': 1.5 },
      });

      // Click → popup with district full row
      map.on('mouseenter', 'bezirke-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'bezirke-fill', () => { map.getCanvas().style.cursor = ''; });
      map.on('click', 'bezirke-fill', (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        if (!e.features || e.features.length === 0) return;
        const name = e.features[0].properties?.name as string;
        const row = rowByBezirk.get(name);
        const fillRows: string[] = [`<tr><td colspan="2" style="font-weight:700;font-size:13px;color:#0f172a;padding-bottom:4px">${name}</td></tr>`];
        if (row) {
          for (const [k, v] of Object.entries(row)) {
            if (v == null || v === '') continue;
            fillRows.push(
              `<tr><td style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;padding-right:8px;vertical-align:top">${k}</td><td style="color:#0f172a;font-weight:500">${v}</td></tr>`
            );
          }
        }
        new maplibregl.Popup({ closeButton: true, maxWidth: '280px' })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-family:Inter,Arial,sans-serif;font-size:12px"><table style="border-spacing:0;border-collapse:collapse"><tbody>${fillRows.join('')}</tbody></table></div>`)
          .addTo(map);
      });

      map.addSource('labels', { type: 'geojson', data: { type: 'FeatureCollection', features: labelFeatures } });
      map.addLayer({
        id: 'bezirke-labels',
        type: 'symbol',
        source: 'labels',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 16,
          'text-font': ['Noto Sans Regular'],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#0f172a', 'text-halo-color': '#ffffff', 'text-halo-width': 2.5 },
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
        paint: { 'text-color': '#475569', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
      });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; initialized.current = false; };
  }, [rows, valueColumn, bezirkColumn]);

  const { t } = useI18n();
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-indigo-600 uppercase tracking-wider">
          {t.mapChoropleth(valueColumn)}
        </span>
      </div>
      <div className="relative w-full h-[520px] rounded-lg overflow-hidden border border-slate-200">
        <div ref={containerRef} className="w-full h-full" />
        {glUnavailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 p-6 text-center">
            <p className="max-w-xs text-sm text-slate-500">{t.mapUnavailable}</p>
          </div>
        )}
      </div>
    </div>
  );
}
