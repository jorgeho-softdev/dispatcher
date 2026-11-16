import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { InvitationPreviewDto } from '@dispatcher/shared';
import { resolveLocale } from '@/i18n/params';
import { callApi } from '@/lib/server/session';
import { Card } from '@/components/ui';
import { AcceptInviteForm } from '@/features/team/AcceptInviteForm';

export async function generateMetadata({ params }: PageProps<'/[locale]/invite'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'web.invite' });
  return { title: t('accept'), robots: { index: false } };
}

// The token is request data (?token=…): the preview streams in behind Suspense.
export default async function InvitePage({ params, searchParams }: PageProps<'/[locale]/invite'>) {
  await resolveLocale(params);
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center text-3xl font-extrabold italic">
          AI <span className="text-primary">Dispatcher</span>
        </p>
        <Suspense fallback={<Card className="text-sm text-muted">…</Card>}>
          <Invitation params={params} searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Invitation({ params, searchParams }: Pick<PageProps<'/[locale]/invite'>, 'params' | 'searchParams'>) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'web.invite' });
  const tRole = await getTranslations({ locale, namespace: 'domain.role' });
  const token = (await searchParams).token;
  if (typeof token !== 'string' || token.length < 20) return <Card className="text-sm text-danger">{t('invalid')}</Card>;

  const res = await callApi(`/invitations/preview?token=${encodeURIComponent(token)}`);
  if (!res.ok) return <Card className="text-sm text-danger">{t('invalid')}</Card>;
  const invite = (await res.json()) as InvitationPreviewDto;

  return (
    <Card>
      <h1 className="text-xl font-bold">{t('title', { organization: invite.organizationName })}</h1>
      <p className="mt-1 text-sm text-muted">{t('subtitle', { role: tRole(invite.role), email: invite.email })}</p>
      {invite.role === 'driver' && <p className="mt-3 text-xs text-muted">{t('driverHint')}</p>}
      <AcceptInviteForm token={token} />
    </Card>
  );
}
