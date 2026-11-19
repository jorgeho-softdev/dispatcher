'use client';

import { CANADIAN_CITIES, PROVINCES, type City } from '@dispatcher/shared';
import { Select } from './ui';

const BY_PROVINCE = PROVINCES.map((p) => ({ province: p, cities: CANADIAN_CITIES.filter((c) => c.province === p) })).filter(
  (g) => g.cities.length > 0,
);

export const cityKey = (c: Pick<City, 'city' | 'province'>) => `${c.city}|${c.province}`;

export function parseCityKey(key: string): Pick<City, 'city' | 'province'> | null {
  const [city, province] = key.split('|');
  const found = CANADIAN_CITIES.find((c) => c.city === city && c.province === province);
  return found ?? null;
}

/**
 * City selector backed by the shared CANADIAN_CITIES catalog (so the api can
 * resolve coordinates). Proper names aren't translated.
 */
export function CityPicker({
  id,
  name,
  value,
  onChange,
  placeholder,
  required,
}: {
  id: string;
  name?: string;
  value: string;
  onChange: (key: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <Select id={id} name={name} value={value} required={required} onChange={(e) => onChange(e.target.value)} className="w-full">
      <option value="">{placeholder}</option>
      {BY_PROVINCE.map((g) => (
        <optgroup key={g.province} label={g.province}>
          {g.cities.map((c) => (
            <option key={cityKey(c)} value={cityKey(c)}>
              {c.city}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
