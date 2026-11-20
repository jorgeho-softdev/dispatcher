import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/params';
import { LoginForm } from '@/features/auth/LoginForm';
import { LanguageSwitcher } from '@/features/i18n/LanguageSwitcher';
import { BrandLogo } from '@/features/shell/BrandLogo';
import { Link } from '@/i18n/navigation';

export async function generateMetadata({ params }: PageProps<'/[locale]/login'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('signIn') };
}

export default async function LoginPage({ params }: PageProps<'/[locale]/login'>) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'web.login' });
  const tAuth = await getTranslations({ locale, namespace: 'auth' });

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandLogo width={220} priority />
          <p className="mt-4 text-sm text-muted">{t('subtitle')}</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-muted">
          {tAuth('noAccount')}{' '}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            {tAuth('createAccount')}
          </Link>
        </p>
        <div className="mt-6 flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </main>
  );
}
