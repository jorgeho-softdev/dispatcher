import type { StyleSpecification } from 'maplibre-gl';

/**
 * Map style. Production: set NEXT_PUBLIC_MAP_STYLE_URL to a hosted vector
 * style (MapTiler, Stadia, Protomaps…). The default uses OpenStreetMap's
 * public raster tiles, fine for development only (OSM tile usage policy),
 * darkened to match the theme. See docs/adr/0017-web-maps.md.
 */
export const MAP_STYLE: string | StyleSpecification = process.env.NEXT_PUBLIC_MAP_STYLE_URL ?? {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
      // Inverted + desaturated: a dark basemap from light tiles.
      paint: { 'raster-brightness-min': 0.9, 'raster-brightness-max': 0.08, 'raster-saturation': -0.85, 'raster-contrast': 0.2 },
    },
  ],
};
