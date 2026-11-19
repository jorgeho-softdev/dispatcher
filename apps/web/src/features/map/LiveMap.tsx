'use client';

import { useEffect, useRef } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { defaultTheme, themes } from '@dispatcher/design-tokens';
import type { FleetLiveDto } from '@dispatcher/shared';
import { Link } from '@/i18n/navigation';
import { useGetFleetLiveQuery } from '@/lib/store/api';
import { Badge, Card, ErrorState, PageHeader } from '@/components/ui';
import { MAP_STYLE } from './map-style';

// Marker colors from the brand tokens (map markers are DOM, not Tailwind).
const c = themes[defaultTheme].colors;
const colors = {
  primary: c.primary.DEFAULT,
  muted: c.muted.DEFAULT,
  info: c.info,
  background: c.background,
};

// Western Canada until there is data to fit.
const DEFAULT_CENTER: [number, number] = [-114.07, 51.04];

function dot(color: string, size: number) {
  const el = document.createElement('div');
  el.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:2px solid ${colors.background};box-shadow:0 0 0 2px ${color}55`;
  return el;
}

/** Popup content built with textContent only — never HTML from data (XSS). */
function popupNode(lines: string[]) {
  const el = document.createElement('div');
  el.style.cssText = `font:12px/1.4 system-ui;color:${colors.background}`;
  lines.forEach((line, i) => {
    const p = document.createElement('div');
    p.textContent = line;
    if (i === 0) p.style.fontWeight = '700';
    el.appendChild(p);
  });
  return el;
}

/** Live map of active trips and vehicles (polls every 30 s). */
export function LiveMap() {
  const t = useTranslations();
  const format = useFormatter();
  const { data, isError, isLoading } = useGetFleetLiveQuery(undefined, { pollingInterval: 30_000 });
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const fitted = useRef(false);

  // Create the map once (maplibre is browser-only, so it's loaded lazily).
  useEffect(() => {
    let cancelled = false;
    void import('maplibre-gl').then(({ Map }) => {
      if (cancelled || !container.current || map.current) return;
      map.current = new Map({ container: container.current, style: MAP_STYLE, center: DEFAULT_CENTER, zoom: 5 });
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Redraw markers whenever the data refreshes.
  useEffect(() => {
    if (!data) return;
    void import('maplibre-gl').then(({ Marker: M, Popup, LngLatBounds }) => {
      const m = map.current;
      if (!m) return;
      markers.current.forEach((mk) => mk.remove());
      markers.current = [];
      const bounds = new LngLatBounds();
      const add = (lng: number, lat: number, el: HTMLElement, lines: string[]) => {
        markers.current.push(new M({ element: el }).setLngLat([lng, lat]).setPopup(new Popup({ offset: 12 }).setDOMContent(popupNode(lines))).addTo(m));
        bounds.extend([lng, lat]);
      };
      for (const trip of data.trips) {
        add(trip.destination.lng, trip.destination.lat, dot(colors.muted, 10), [`#${trip.code} → ${trip.destination.city}`]);
        if (trip.lastPosition) {
          add(trip.lastPosition.lng, trip.lastPosition.lat, dot(colors.primary, 16), [
            `#${trip.code} · ${trip.driverName}`,
            `${trip.origin.city} → ${trip.destination.city}`,
            trip.etaAt ? `ETA ${format.dateTime(new Date(trip.etaAt), { hour: '2-digit', minute: '2-digit' })}` : '',
          ]);
        }
      }
      for (const v of data.vehicles) {
        if (v.position && !v.onTrip) add(v.position.lng, v.position.lat, dot(colors.info, 12), [v.name, t('web.map.idle')]);
      }
      if (!fitted.current && !bounds.isEmpty()) {
        m.fitBounds(bounds, { padding: 60, maxZoom: 9, duration: 0 });
        fitted.current = true;
      }
    });
  }, [data, format, t]);

  const positioned = (data?.trips.filter((x) => x.lastPosition).length ?? 0) + (data?.vehicles.filter((v) => v.position).length ?? 0);

  return (
    <>
      <PageHeader title={t('web.map.title')} subtitle={t('web.map.subtitle')} />
      {isError && <ErrorState message={t('common.loadError')} />}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="relative overflow-hidden rounded-card border border-border">
          <div ref={container} className="h-[60vh] min-h-[360px] w-full" />
          {!isLoading && positioned === 0 && (
            <p className="absolute inset-x-4 top-4 rounded-xl bg-surface/90 p-3 text-sm text-muted">{t('web.map.noPositions')}</p>
          )}
        </div>
        <Card className="h-fit space-y-4">
          <h2 className="font-semibold">{t('web.map.activeTrips', { count: data?.trips.length ?? 0 })}</h2>
          <ul className="space-y-3 text-sm">
            {data?.trips.map((trip) => (
              <li key={trip.id}>
                <Link href={`/trips/${trip.id}`} className="font-semibold hover:text-primary">
                  #{trip.code}
                </Link>{' '}
                <Badge tone="primary">{t(`domain.tripStatus.${trip.status}`)}</Badge>
                <p className="text-xs text-muted">
                  {trip.origin.city} → {trip.destination.city} · {trip.driverName}
                </p>
              </li>
            ))}
          </ul>
          <VehicleList vehicles={data?.vehicles ?? []} />
        </Card>
      </div>
    </>
  );
}

function VehicleList({ vehicles }: { vehicles: FleetLiveDto['vehicles'] }) {
  const t = useTranslations();
  if (vehicles.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium text-muted">{t('web.map.vehicles')}</h3>
      <ul className="space-y-1 text-sm">
        {vehicles.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-2">
            <span>{v.name}</span>
            <span className="text-xs text-muted">
              {v.onTrip ? t('web.map.onTrip') : v.position?.source === 'home_base' ? t('web.map.atHomeBase') : t('web.map.idle')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
