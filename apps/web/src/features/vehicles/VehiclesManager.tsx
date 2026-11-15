'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { EQUIPMENT_TYPES, can, formatMoney, vehicleCreateSchema } from '@dispatcher/shared';
import {
  useCreateVehicleMutation,
  useDeleteVehicleMutation,
  useGetMeQuery,
  useGetVehiclesQuery,
} from '@/lib/store/api';
import { useIntlLocale } from '@/i18n/use-intl-locale';
import { Button, Card, ErrorState, Input, Label, PageHeader, Select } from '@/components/ui';

export function VehiclesManager() {
  const t = useTranslations('web.vehicles');
  const tCommon = useTranslations('common');
  const tEquipment = useTranslations('domain.equipment');
  const intlLocale = useIntlLocale();
  const { data: me } = useGetMeQuery();
  const { data: vehicles, isLoading, isError } = useGetVehiclesQuery();
  const [createVehicle, { isLoading: creating }] = useCreateVehicleMutation();
  const [deleteVehicle] = useDeleteVehicleMutation();
  const [formError, setFormError] = useState<string | null>(null);

  // Same RBAC matrix the api enforces; hiding the UI is only a convenience.
  const canManage = can(me?.role, 'vehicles:manage');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const formEl = event.currentTarget;
    const f = new FormData(formEl);
    const parsed = vehicleCreateSchema.safeParse({
      name: f.get('name'),
      equipment: f.get('equipment'),
      plate: f.get('plate') || undefined,
      capacityKg: Number(f.get('capacityKg')),
      costPerKm: Number(f.get('costPerKm')),
      homeBaseCity: f.get('homeBaseCity') || undefined,
      homeBaseProvince: f.get('homeBaseProvince') || undefined,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · '));
      return;
    }
    const result = await createVehicle(parsed.data);
    if ('error' in result) setFormError(t('saveError'));
    else formEl.reset();
  }

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {isError && <ErrorState message={tCommon('loadError')} />}
          {isLoading && <p className="text-sm text-muted">{tCommon('loading')}</p>}
          {vehicles?.length === 0 && <Card className="text-sm text-muted">{t('empty')}</Card>}
          <div className="space-y-3">
            {vehicles?.map((v) => (
              <Card key={v.id} className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">{v.name}</p>
                  <p className="text-xs text-muted">
                    {tEquipment(v.equipment)} · {v.capacityKg.toLocaleString(intlLocale)} kg ·{' '}
                    {formatMoney(v.costPerKm, 'CAD', intlLocale)}/km
                    {v.homeBaseCity && ` · ${v.homeBaseCity}, ${v.homeBaseProvince ?? ''}`}
                  </p>
                </div>
                {canManage && (
                  <Button variant="danger" onClick={() => deleteVehicle(v.id)}>
                    {tCommon('delete')}
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </div>

        {canManage && (
          <Card>
            <h2 className="mb-4 font-semibold">{t('new')}</h2>
            <form onSubmit={onSubmit} className="space-y-3" noValidate>
              <div>
                <Label htmlFor="name">{t('name')}</Label>
                <Input id="name" name="name" placeholder="Box Truck 16ft" required />
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="capacityKg">{t('capacity')}</Label>
                  <Input id="capacityKg" name="capacityKg" type="number" min={1} defaultValue={3500} />
                </div>
                <div>
                  <Label htmlFor="costPerKm">{t('costPerKm')}</Label>
                  <Input id="costPerKm" name="costPerKm" type="number" step="0.01" min={0.01} defaultValue={1.7} />
                </div>
              </div>
              <div>
                <Label htmlFor="plate">{t('plate')}</Label>
                <Input id="plate" name="plate" />
              </div>
              <div className="grid grid-cols-[1fr_80px] gap-3">
                <div>
                  <Label htmlFor="homeBaseCity">{t('homeBase')}</Label>
                  <Input id="homeBaseCity" name="homeBaseCity" placeholder="Calgary" />
                </div>
                <div>
                  <Label htmlFor="homeBaseProvince">{t('province')}</Label>
                  <Input id="homeBaseProvince" name="homeBaseProvince" placeholder="AB" maxLength={2} />
                </div>
              </div>
              {formError && (
                <p role="alert" className="text-xs text-danger">
                  {formError}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? tCommon('saving') : t('submit')}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </>
  );
}
