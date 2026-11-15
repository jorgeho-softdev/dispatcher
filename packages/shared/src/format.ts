import type { Currency } from './constants';

/** "CA$1,280" / "US$950" — matches the mockup's money style. */
export function formatMoney(amount: number, currency: Currency = 'CAD', locale = 'en-CA'): string {
  const prefix = currency === 'CAD' ? 'CA$' : 'US$';
  const value = new Intl.NumberFormat(locale, {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(amount);
  return `${prefix}${value}`;
}

export function formatDistance(km: number, unit: 'km' | 'mi' = 'km'): string {
  const value = unit === 'km' ? km : km * 0.621371;
  return `${Math.round(value).toLocaleString('en-CA')} ${unit}`;
}
