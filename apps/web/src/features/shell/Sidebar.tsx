'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

const NAV = [
  { href: '/', key: 'dashboard' },
  { href: '/loads', key: 'loads' },
  { href: '/vehicles', key: 'vehicles' },
] as const;

export function Sidebar() {
  const t = useTranslations('web.nav');
  // Locale-agnostic pathname (e.g. "/loads" for "/pa/loads").
  const pathname = usePathname();
  return (
    <aside className="border-b border-border bg-surface md:w-60 md:shrink-0 md:border-e md:border-b-0">
      <div className="flex h-16 items-center px-5">
        <Link href="/" className="text-lg font-extrabold italic">
          AI <span className="text-primary">Dispatcher</span>
        </Link>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
        {NAV.map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
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
