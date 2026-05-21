'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Row } from '@/app/page';

type Props = { rows: Row[] };

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

function popupHtml(props: Record<string, unknown>): string {
  const skipKeys = new Set(['lat', 'lng', 'geom', 'id', 'gisid', 'pitid']);
  const rows: string[] = [];
  for (const [k, v] of Object.entries(props)) {
    if (skipKeys.has(k)) continue;
    if (v === null || v === undefined || v === '') continue;
    rows.push(
      `<tr><td style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;padding-right:8px;vertical-align:top">${k}</td><td style="color:#0f172a;font-weight:500">${v}</td></tr>`
    );
  }
  return `<div style="font-family:Inter,Arial,sans-serif;font-size:12px;max-width:240px"><table style="border-spacing:0;border-collapse:collapse"><tbody>${rows.join('')}</tbody></table></div>`;
}

export default function ResultsMap({ rows }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!containerRef.current || initialized.current) return;
    initialized.current = true;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: [13.4050, 52.5200],
      zoom: 10,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', async () => {
      // Always-on Berlin districts background layer (subtle gray)
      try {
        const districts = await fetch('/data/berlin-bezirke.geojson').then(r => r.json());
        map.addSource('bezirke-bg', { type: 'geojson', data: districts });
        map.addLayer({
          id: 'bezirke-bg-fill',
          type: 'fill',
          source: 'bezirke-bg',
          paint: { 'fill-color': '#94a3b8', 'fill-opacity': 0.07 },
        });
        map.addLayer({
          id: 'bezirke-bg-outline',
          type: 'line',
          source: 'bezirke-bg',
          paint: { 'line-color': '#64748b', 'line-width': 1, 'line-opacity': 0.35 },
        });
        map.addLayer({
          id: 'bezirke-bg-labels',
          type: 'symbol',
          source: 'bezirke-bg',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 10,
            'text-font': ['Noto Sans Regular'],
            'text-allow-overlap': false,
          },
          paint: {
            'text-color': '#475569',
            'text-halo-color': 'rgba(255,255,255,0.9)',
            'text-halo-width': 2,
            'text-opacity': 0.6,
          },
        });
      } catch { /* if geojson missing, just skip the overlay */ }
    });

    mapRef.current = map;
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const drawMarkers = () => {
      const features = rows
        .filter(r => typeof r.lat === 'number' && typeof r.lng === 'number')
        .slice(0, 1000)
        .map(r => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [r.lng as number, r.lat as number] },
          properties: r,
        }));

      const data = { type: 'FeatureCollection' as const, features };

      if (map.getSource('results')) {
        (map.getSource('results') as maplibregl.GeoJSONSource).setData(data);
      } else {
        map.addSource('results', { type: 'geojson', data });
        map.addLayer({
          id: 'results-circles',
          type: 'circle',
          source: 'results',
          paint: {
            'circle-radius': 6,
            'circle-color': '#6366f1',
            'circle-opacity': 0.8,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
          },
        });

        map.on('mouseenter', 'results-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', 'results-circles', () => { map.getCanvas().style.cursor = ''; });

        map.on('click', 'results-circles', (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
          if (!e.features || e.features.length === 0) return;
          const f = e.features[0];
          const geom = f.geometry as { type: string; coordinates: number[] };
          const coords: [number, number] = [geom.coordinates[0], geom.coordinates[1]];
          new maplibregl.Popup({ closeButton: true, maxWidth: '300px' })
            .setLngLat(coords)
            .setHTML(popupHtml(f.properties as Record<string, unknown>))
            .addTo(map);
        });
      }

      if (features.length) {
        const lats = features.map(f => f.geometry.coordinates[1]);
        const lngs = features.map(f => f.geometry.coordinates[0]);
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 60, maxZoom: 14, duration: 600 },
        );
      }
    };

    if (map.isStyleLoaded()) drawMarkers();
    else map.once('load', drawMarkers);
  }, [rows]);

  const geoRowCount = rows.filter(r => typeof r.lat === 'number' && typeof r.lng === 'number').length;
  if (geoRowCount === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono text-indigo-600 uppercase tracking-wider">
          / Map ({geoRowCount.toLocaleString()} points · click any for details)
        </span>
      </div>
      <div ref={containerRef} className="w-full h-[520px] rounded-lg overflow-hidden border border-slate-200" />
    </div>
  );
}
