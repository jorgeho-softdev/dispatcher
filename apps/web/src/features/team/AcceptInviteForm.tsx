'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { acceptInvitationSchema, toErrorCode } from '@dispatcher/shared';
import { useRouter } from '@/i18n/navigation';
import { Button, Input, Label } from '@/components/ui';
import { PasswordInput } from '@/components/PasswordInput';

export function AcceptInviteForm({ token }: { token: string }) {
  const t = useTranslations('web.invite');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const f = new FormData(event.currentTarget);
    const parsed = acceptInvitationSchema.safeParse({ token, name: f.get('name'), password: f.get('password'), locale });
    if (!parsed.success) {
      setError(tErrors('VALIDATION_FAILED'));
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { code?: unknown };
        setError(tErrors(toErrorCode(body.code)));
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError(tErrors('NETWORK_ERROR'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
      <div>
        <Label htmlFor="name">{t('name')}</Label>
        <Input id="name" name="name" autoComplete="name" required />
      </div>
      <div>
        <Label htmlFor="password">{t('password')}</Label>
        <PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required />
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {t('accept')}
      </Button>
    </form>
  );
}
