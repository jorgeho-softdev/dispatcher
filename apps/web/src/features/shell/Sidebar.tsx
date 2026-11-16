'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

const NAV = [
  { href: '/', key: 'dashboard' },
  { href: '/loads', key: 'loads' },
  { href: '/negotiations', key: 'negotiations' },
  { href: '/trips', key: 'trips' },
  { href: '/vehicles', key: 'vehicles' },
  { href: '/settings', key: 'settings' },
] as const;

/** Active-item highlighting needs the URL, which is request data under Cache Components. */
export function Sidebar() {
  // Locale-agnostic pathname (e.g. "/loads" for "/pa/loads").
  return <SidebarView pathname={usePathname()} />;
}

/** Static variant (no URL access): used as the Suspense fallback. */
export function SidebarView({ pathname }: { pathname: string | null }) {
  const t = useTranslations('web.nav');
  return (
    <aside className="border-b border-border bg-surface md:w-60 md:shrink-0 md:border-e md:border-b-0">
      <div className="flex h-16 items-center px-5">
        <Link href="/" className="text-lg font-extrabold italic">
          AI <span className="text-primary">Dispatcher</span>
        </Link>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
        {NAV.map((item) => {
          const active = pathname !== null && (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap ${
                active ? 'bg-primary-light text-primary' : 'text-muted hover:bg-surface-raised hover:text-ink'
              }`}
            >
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
