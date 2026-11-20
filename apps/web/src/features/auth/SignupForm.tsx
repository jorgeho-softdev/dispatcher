'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { registerSchema, toErrorCode } from '@dispatcher/shared';
import { useRouter } from '@/i18n/navigation';
import { Button, Card, Input, Label } from '@/components/ui';
import { PasswordInput } from '@/components/PasswordInput';

/** Self sign-up: the new user becomes owner of a new organization. */
export function SignupForm() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    // Same schema the api validates with (@dispatcher/shared).
    const parsed = registerSchema.safeParse({
      name: form.get('name'),
      companyName: form.get('companyName'),
      email: form.get('email'),
      password: form.get('password'),
      locale,
    });
    if (!parsed.success) {
      setError(t('signupInvalid'));
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/auth/register', {
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
    <Card>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <Label htmlFor="name">{t('name')}</Label>
          <Input id="name" name="name" autoComplete="name" required minLength={2} maxLength={100} />
        </div>
        <div>
          <Label htmlFor="companyName">{t('companyName')}</Label>
          <Input id="companyName" name="companyName" autoComplete="organization" required minLength={2} maxLength={120} aria-describedby="companyHint" />
          <p id="companyHint" className="mt-1 text-xs text-muted">
            {t('companyHint')}
          </p>
        </div>
        <div>
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">{t('password')}</Label>
          <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={8} aria-describedby="passwordHint" />
          <p id="passwordHint" className="mt-1 text-xs text-muted">
            {t('passwordHint')}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t('creatingAccount') : t('createAccount')}
        </Button>
      </form>
    </Card>
  );
}
