'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import {
  AUTONOMY_LEVELS,
  PROVINCES,
  aiSettingsUpdateSchema,
  can,
  type AiSettingsDto,
  type Province,
} from '@dispatcher/shared';
import { useGetAiSettingsQuery, useGetMeQuery, useUpdateAiSettingsMutation } from '@/lib/store/api';
import { Button, Card, ErrorState, Input, Label, PageHeader, Select } from '@/components/ui';

function ProvinceChips({
  label,
  value,
  disabled,
  onToggle,
}: {
  label: string;
  value: string[];
  disabled: (p: Province) => boolean;
  onToggle: (p: Province) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-medium text-muted">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {PROVINCES.map((p) => {
          const on = value.includes(p);
          return (
            <button
              key={p}
              type="button"
              aria-pressed={on}
              disabled={disabled(p)}
              onClick={() => onToggle(p)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-30 ${
                on ? 'border-primary bg-primary text-on-primary' : 'border-border text-ink hover:bg-surface-raised'
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Carrier preferences: drive the match score now and the AI agent's limits in Phase 2. */
export function PreferencesForm() {
  const tCommon = useTranslations('common');
  const { data, isError } = useGetAiSettingsQuery();
  if (isError) return <ErrorState message={tCommon('loadError')} />;
  if (!data) return <p className="text-sm text-muted">{tCommon('loading')}</p>;
  // Keyed so the form re-initializes if the saved settings change elsewhere.
  return <PreferencesFormInner key={JSON.stringify(data)} initial={data} />;
}

function PreferencesFormInner({ initial }: { initial: AiSettingsDto }) {
  const t = useTranslations('web.settings');
  const tCommon = useTranslations('common');
  const tDomain = useTranslations('domain');
  const tErrors = useTranslations('errors');
  const { data: me } = useGetMeQuery();
  const [update, { isLoading }] = useUpdateAiSettingsMutation();
  const [form, setForm] = useState<AiSettingsDto>(initial);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const canEdit = can(me?.role, 'ai_settings:manage');

  const toggle = (key: 'preferredProvinces' | 'avoidProvinces', p: Province) =>
    setForm({ ...form, [key]: form[key].includes(p) ? form[key].filter((x) => x !== p) : [...form[key], p] });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('idle');
    const parsed = aiSettingsUpdateSchema.safeParse(form);
    if (!parsed.success) {
      setStatus('error');
      return;
    }
    const result = await update(parsed.data);
    setStatus('error' in result ? 'error' : 'saved');
  }

  const num = (key: keyof AiSettingsDto) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: Number(e.target.value) });

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
        <fieldset disabled={!canEdit} className="space-y-6">
          <Card className="grid gap-4 sm:grid-cols-3">
            <h2 className="font-semibold sm:col-span-3">{t('profitability')}</h2>
            <div>
              <Label htmlFor="minRatePerKm">{t('minRatePerKm')}</Label>
              <Input id="minRatePerKm" type="number" step="0.05" min={0.1} value={form.minRatePerKm} onChange={num('minRatePerKm')} />
            </div>
            <div>
              <Label htmlFor="minMarginPct">{t('minMarginPct')}</Label>
              <Input id="minMarginPct" type="number" min={0} max={100} value={form.minMarginPct} onChange={num('minMarginPct')} />
            </div>
            <div>
              <Label htmlFor="maxDeadheadKm">{t('maxDeadheadKm')}</Label>
              <Input id="maxDeadheadKm" type="number" min={0} max={2000} value={form.maxDeadheadKm} onChange={num('maxDeadheadKm')} />
            </div>
          </Card>

          <Card className="space-y-4">
            <h2 className="font-semibold">{t('regions')}</h2>
            <p className="text-xs text-muted">{t('regionsHint')}</p>
            <ProvinceChips
              label={t('preferredProvinces')}
              value={form.preferredProvinces}
              disabled={(p) => form.avoidProvinces.includes(p)}
              onToggle={(p) => toggle('preferredProvinces', p)}
            />
            <ProvinceChips
              label={t('avoidProvinces')}
              value={form.avoidProvinces}
              disabled={(p) => form.preferredProvinces.includes(p)}
              onToggle={(p) => toggle('avoidProvinces', p)}
            />
          </Card>

          <Card className="grid gap-4 sm:grid-cols-2">
            <h2 className="font-semibold sm:col-span-2">{t('aiSection')}</h2>
            <div>
              <Label htmlFor="autonomyLevel">{t('autonomy')}</Label>
              <Select
                id="autonomyLevel"
                className="w-full"
                value={form.autonomyLevel}
                onChange={(e) => setForm({ ...form, autonomyLevel: e.target.value as AiSettingsDto['autonomyLevel'] })}
              >
                {AUTONOMY_LEVELS.map((a) => (
                  <option key={a} value={a}>
                    {tDomain(`autonomy.${a}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="maxCounterOfferPct">{t('maxCounterOfferPct')}</Label>
              <Input
                id="maxCounterOfferPct"
                type="number"
                min={0}
                max={100}
                value={form.maxCounterOfferPct}
                onChange={num('maxCounterOfferPct')}
              />
            </div>
            <p className="text-xs text-muted sm:col-span-2">{t('autonomyHint')}</p>
          </Card>
        </fieldset>

        {canEdit && (
          <div className="flex items-center gap-4">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? tCommon('saving') : t('save')}
            </Button>
            {status === 'saved' && <p className="text-sm text-success">{t('saved')}</p>}
            {status === 'error' && (
              <p role="alert" className="text-sm text-danger">
                {tErrors('VALIDATION_FAILED')}
              </p>
            )}
          </div>
        )}
      </form>
    </>
  );
}
