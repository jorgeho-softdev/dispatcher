'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { loginSchema, toErrorCode } from '@dispatcher/shared';
import { useRouter } from '@/i18n/navigation';
import { Button, Card, Input, Label } from '@/components/ui';
import { PasswordInput } from '@/components/PasswordInput';

export function LoginForm() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    // Same schema the api validates with.
    const parsed = loginSchema.safeParse({ email: form.get('email'), password: form.get('password') });
    if (!parsed.success) {
      setError(t('invalidFormat'));
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        // The api returns a stable code; the text comes from the user's language.
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
    <Card>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">{t('password')}</Label>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t('signingIn') : t('signIn')}
        </Button>
      </form>
    </Card>
  );
}
