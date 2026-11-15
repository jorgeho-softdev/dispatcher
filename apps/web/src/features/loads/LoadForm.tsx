'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import {
  EQUIPMENT_TYPES,
  estimateRoadKm,
  findCity,
  loadCreateSchema,
  type EquipmentType,
} from '@dispatcher/shared';
import { useRouter } from '@/i18n/navigation';
import { useCreateLoadMutation } from '@/lib/store/api';
import { Button, Card, Input, Label, PageHeader, Select } from '@/components/ui';
import { CityPicker, parseCityKey } from '@/components/CityPicker';

/** Manual load entry: cities come from the shared catalog, so the api can geolocate them. */
export function LoadForm() {
  const t = useTranslations('web.loadForm');
  const tEquipment = useTranslations('domain.equipment');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const [createLoad, { isLoading }] = useCreateLoadMutation();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Same estimate the api uses when distance is left empty.
  const estimatedKm = useMemo(() => {
    const o = parseCityKey(origin);
    const d = parseCityKey(destination);
    const a = o && findCity(o.city, o.province);
    const b = d && findCity(d.city, d.province);
    return a && b ? Math.round(estimateRoadKm(a, b)) : null;
  }, [origin, destination]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const f = new FormData(event.currentTarget);
    const o = parseCityKey(origin);
    const d = parseCityKey(destination);
    if (o && d && o.city === d.city && o.province === d.province) {
      setError(t('sameCity'));
      return;
    }
    const distance = f.get('distanceKm');
    const pickup = f.get('pickupAt');
    const parsed = loadCreateSchema.safeParse({
      originCity: o?.city,
      originProvince: o?.province,
      destinationCity: d?.city,
      destinationProvince: d?.province,
      // datetime-local is in the browser's time zone.
      pickupAt: typeof pickup === 'string' && pickup ? new Date(pickup) : undefined,
      weightKg: Number(f.get('weightKg')),
      equipment: f.get('equipment') as EquipmentType,
      postedRate: Number(f.get('postedRate')),
      distanceKm: distance ? Number(distance) : undefined,
      notes: (f.get('notes') as string) || undefined,
    });
    if (!parsed.success) {
      setError(tErrors('VALIDATION_FAILED'));
      return;
    }
    const result = await createLoad(parsed.data);
    if ('error' in result) {
      setError(tErrors('VALIDATION_FAILED'));
      return;
    }
    router.push('/loads');
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Card className="max-w-2xl">
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2" noValidate>
          <div>
            <Label htmlFor="origin">{t('origin')}</Label>
            <CityPicker id="origin" value={origin} onChange={setOrigin} placeholder={t('selectCity')} required />
          </div>
          <div>
            <Label htmlFor="destination">{t('destination')}</Label>
            <CityPicker
              id="destination"
              value={destination}
              onChange={setDestination}
              placeholder={t('selectCity')}
              required
            />
          </div>
          <div>
            <Label htmlFor="pickupAt">{t('pickupAt')}</Label>
            <Input id="pickupAt" name="pickupAt" type="datetime-local" required />
          </div>
          <div>
            <Label htmlFor="equipment">{t('equipment')}</Label>
            <Select id="equipment" name="equipment" defaultValue="box_truck" className="w-full">
              {EQUIPMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {tEquipment(type)}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="weightKg">{t('weightKg')}</Label>
            <Input id="weightKg" name="weightKg" type="number" min={1} required />
          </div>
          <div>
            <Label htmlFor="postedRate">{t('postedRate')}</Label>
            <Input id="postedRate" name="postedRate" type="number" min={1} step="0.01" required />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="distanceKm">{t('distanceKm')}</Label>
            <Input id="distanceKm" name="distanceKm" type="number" min={1} step="0.1" />
            {estimatedKm !== null && <p className="mt-1 text-xs text-muted">{t('distanceHint', { km: estimatedKm })}</p>}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="notes">{t('notes')}</Label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={1000}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-ink focus:border-primary focus:outline-none"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger sm:col-span-2">
              {error}
            </p>
          )}
          <div className="flex gap-3 sm:col-span-2">
            <Button type="submit" disabled={isLoading}>
              {t('submit')}
            </Button>
            <Button type="button" variant="secondary" onClick={() => router.push('/loads')}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
