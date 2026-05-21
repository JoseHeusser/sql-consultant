'use client';

import { useEffect, useRef } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Row } from '@/app/lib/db';

type Props = {
  rows: Row[];
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

export default function ResultsMap({ rows }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!mapRef.current) {
      mapRef.current = new maplibregl.Map({
        container: containerRef.current,
        style: mapStyle,
        center: [13.4050, 52.5200],
        zoom: 10,
        attributionControl: { compact: true },
      });
    }
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
            'circle-radius': 5,
            'circle-color': '#6366f1',
            'circle-opacity': 0.7,
            'circle-stroke-width': 1.2,
            'circle-stroke-color': '#ffffff',
          },
        });
      }

      // Fit bounds
      if (features.length) {
        const lats = features.map(f => f.geometry.coordinates[1]);
        const lngs = features.map(f => f.geometry.coordinates[0]);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 40, maxZoom: 14, duration: 600 },
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
          / Map ({geoRowCount.toLocaleString()} located)
        </span>
      </div>
      <div ref={containerRef} className="w-full h-80 rounded-lg overflow-hidden border border-slate-200" />
    </div>
  );
}
