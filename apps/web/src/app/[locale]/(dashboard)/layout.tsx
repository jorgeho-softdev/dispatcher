import { Sidebar } from '@/features/shell/Sidebar';
import { UserMenu } from '@/features/shell/UserMenu';
import { LanguageSwitcher } from '@/features/i18n/LanguageSwitcher';

// Static shell: no session read here (Cache Components prerenders it per
// locale). User-specific data loads client-side through RTK Query.
export default function DashboardLayout({ children }: LayoutProps<'/[locale]'>) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-end gap-4 border-b border-border px-4 md:px-8">
          <LanguageSwitcher persist />
          <UserMenu />
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
