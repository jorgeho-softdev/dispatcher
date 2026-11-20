import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { resolveLocale } from '@/i18n/params';
import { Link } from '@/i18n/navigation';
import { SignupForm } from '@/features/auth/SignupForm';
import { LanguageSwitcher } from '@/features/i18n/LanguageSwitcher';
import { BrandLogo } from '@/features/shell/BrandLogo';

export async function generateMetadata({ params }: PageProps<'/[locale]/signup'>): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'auth' });
  return { title: t('createAccount') };
}

export default async function SignupPage({ params }: PageProps<'/[locale]/signup'>) {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <BrandLogo width={200} priority />
          <p className="mt-4 text-sm text-muted">{t('signupSubtitle')}</p>
        </div>
        <SignupForm />
        <p className="mt-6 text-center text-sm text-muted">
          {t('haveAccount')}{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            {t('signIn')}
          </Link>
        </p>
        <div className="mt-6 flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </main>
  );
}
