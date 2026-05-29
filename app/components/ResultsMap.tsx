'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Row } from '@/app/page';
import { useI18n } from '@/app/lib/i18n';

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
  const layersAdded = useRef(false);
  const [glUnavailable, setGlUnavailable] = useState(false);
  const { t } = useI18n();

  // init map once
  useEffect(() => {
    if (!containerRef.current) return;
    if (!mapRef.current) {
      try {
        mapRef.current = new maplibregl.Map({
          container: containerRef.current,
          style: mapStyle,
          center: [13.4050, 52.5200],
          zoom: 10,
          attributionControl: { compact: true },
        });
        mapRef.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      } catch {
        // WebGL may be unavailable on some mobile devices / privacy browsers.
        setGlUnavailable(true);
      }
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const drawMarkers = () => {
      // No slice — render all geo rows. MapLibre's clustering keeps it fast.
      const features = rows
        .filter(r => typeof r.lat === 'number' && typeof r.lng === 'number')
        .map(r => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [r.lng as number, r.lat as number] },
          properties: r,
        }));

      const data = { type: 'FeatureCollection' as const, features };

      if (!layersAdded.current) {
        // Optional context: faint Bezirke outlines underneath everything
        fetch('/data/berlin-bezirke.geojson')
          .then(r => r.ok ? r.json() : null)
          .then(g => {
            if (!g || map.getSource('bezirke-bg')) return;
            map.addSource('bezirke-bg', { type: 'geojson', data: g });
            map.addLayer({
              id: 'bezirke-bg-fill', type: 'fill', source: 'bezirke-bg',
              paint: { 'fill-color': '#94a3b8', 'fill-opacity': 0.07 },
            }, 'carto');
            map.addLayer({
              id: 'bezirke-bg-line', type: 'line', source: 'bezirke-bg',
              paint: { 'line-color': '#64748b', 'line-opacity': 0.35, 'line-width': 1 },
            });
          })
          .catch(() => { /* noop */ });

        map.addSource('results', {
          type: 'geojson',
          data,
          cluster: true,
          clusterMaxZoom: 14,
          clusterRadius: 50,
        });

        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'results',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'step', ['get', 'point_count'],
              '#a5b4fc', 100,
              '#818cf8', 1000,
              '#6366f1', 5000,
              '#4338ca',
            ],
            'circle-radius': [
              'step', ['get', 'point_count'],
              16, 100, 22, 1000, 28, 5000, 34,
            ],
            'circle-opacity': 0.9,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        map.addLayer({
          id: 'cluster-count',
          type: 'symbol',
          source: 'results',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-size': 13,
            'text-font': ['Noto Sans Regular'],
            'text-allow-overlap': true,
          },
          paint: { 'text-color': '#ffffff' },
        });

        map.addLayer({
          id: 'results-circles',
          type: 'circle',
          source: 'results',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': 6,
            'circle-color': '#6366f1',
            'circle-opacity': 0.85,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
          },
        });

        // Hover cursors
        for (const id of ['clusters', 'results-circles']) {
          map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
        }

        // Click cluster → zoom in
        map.on('click', 'clusters', async (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
          if (!e.features || e.features.length === 0) return;
          const f = e.features[0];
          const geom = f.geometry as { coordinates: number[] };
          const src = map.getSource('results') as maplibregl.GeoJSONSource;
          const clusterId = f.properties?.cluster_id as number;
          try {
            const zoom = await src.getClusterExpansionZoom(clusterId);
            map.easeTo({ center: [geom.coordinates[0], geom.coordinates[1]], zoom });
          } catch {
            map.easeTo({ center: [geom.coordinates[0], geom.coordinates[1]], zoom: Math.min(15, map.getZoom() + 2) });
          }
        });

        // Click individual point → popup
        map.on('click', 'results-circles', (e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
          if (!e.features || e.features.length === 0) return;
          const f = e.features[0];
          const geom = f.geometry as { coordinates: number[] };
          new maplibregl.Popup({ closeButton: true, maxWidth: '300px' })
            .setLngLat([geom.coordinates[0], geom.coordinates[1]])
            .setHTML(popupHtml(f.properties as Record<string, unknown>))
            .addTo(map);
        });

        layersAdded.current = true;
      } else {
        (map.getSource('results') as maplibregl.GeoJSONSource).setData(data);
      }

      // Fit bounds to all geo rows
      if (features.length) {
        // Use a sample if there are millions, for speed
        const sample = features.length > 50000
          ? features.filter((_, i) => i % Math.ceil(features.length / 50000) === 0)
          : features;
        const lats = sample.map(f => f.geometry.coordinates[1]);
        const lngs = sample.map(f => f.geometry.coordinates[0]);
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
          {t.mapPoint(geoRowCount)}
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
