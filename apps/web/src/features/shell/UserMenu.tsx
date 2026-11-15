'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useGetMeQuery } from '@/lib/store/api';
import { Button } from '@/components/ui';

export function UserMenu() {
  const t = useTranslations('auth');
  const tRole = useTranslations('domain.role');
  const locale = useLocale();
  const { data: me } = useGetMeQuery();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    // Full reload drops the Redux store and its cached server data.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload on purpose: wipes the Redux store and cached data of the old session
    window.location.assign(`/${locale}/login`);
  }

  return (
    <div className="flex items-center gap-4">
      {me && (
        <div className="text-end">
          <p className="text-sm font-semibold">{me.user.name}</p>
          <p className="text-xs text-muted">
            {me.organization.name} · {tRole(me.role)}
          </p>
        </div>
      )}
      <Button variant="secondary" onClick={logout} disabled={pending}>
        {t('signOut')}
      </Button>
    </div>
  );
}
