'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { isAuthenticated, removeToken } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { versionAPI } from '@/lib/api';
import { FRONTEND_VERSION } from '@/lib/version';
import {
  ChartBarIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  WalletIcon,
  ListBulletIcon,
  ChartPieIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { href: '/dashboard/portfolio', label: 'Portfolio', icon: WalletIcon },
  { href: '/dashboard/history', label: 'History', icon: ClockIcon },
  { href: '/dashboard/watchlist', label: 'Watchlist', icon: ListBulletIcon },
  { href: '/dashboard/analysis', label: 'Analysis', icon: ChartPieIcon },
  { href: '/dashboard/settings', label: 'Settings', icon: Cog6ToothIcon },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [backendVersion, setBackendVersion] = useState<string>('...');

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    versionAPI.getBackendVersion().then((r) => setBackendVersion(r.data.version)).catch(() => setBackendVersion('unknown'));
  }, [router]);

  const handleLogout = () => {
    removeToken();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Left sidebar */}
      <aside className="w-56 shrink-0 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <Link href="/dashboard/portfolio" className="flex items-center gap-2 text-white font-semibold">
            <ChartBarIcon className="h-6 w-6 text-primary-500" />
            <span>Portfolio</span>
          </Link>
          <p className="text-xs text-gray-500 mt-1">v{FRONTEND_VERSION}</p>
        </div>
        <nav className="p-2 flex-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/dashboard/portfolio' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-red-600/20 hover:text-red-300 transition-colors"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="shrink-0 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700 px-6 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Backend v{backendVersion}
            </p>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
