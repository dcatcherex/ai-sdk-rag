'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BotIcon,
  CoinsIcon,
  LayoutDashboardIcon,
  MenuIcon,
  SearchIcon,
  MessageSquareIcon,
  SparklesIcon,
  ShieldIcon,
  TestTubeDiagonalIcon,
  UsersIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboardIcon },
  { href: '/admin/agents', label: 'Agents', icon: BotIcon },
  { href: '/admin/skills', label: 'Skills', icon: SparklesIcon },
  { href: '/admin/users', label: 'Users', icon: UsersIcon },
  { href: '/admin/credits', label: 'Credits', icon: CoinsIcon },
  { href: '/admin/chat-runs', label: 'AI Runs', icon: SearchIcon },
  { href: '/admin/tests', label: 'Tests', icon: TestTubeDiagonalIcon },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/admin/users?limit=1');
        if (res.ok) {
          setAuthorized(true);
        } else {
          router.replace('/');
        }
      } catch {
        router.replace('/');
      } finally {
        setChecking(false);
      }
    };
    void check();
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Checking access…</div>
      </div>
    );
  }

  if (!authorized) return null;

  const navContent = (
    <>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileNavOpen(false)}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <Link
          href="/"
          onClick={() => setMobileNavOpen(false)}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <MessageSquareIcon className="size-4" />
          Back to Chat
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-muted/40 dark:bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 flex-col border-r bg-card md:flex">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <ShieldIcon className="size-5 text-primary" />
          <span className="text-sm font-bold tracking-tight">Admin Panel</span>
        </div>
        {navContent}
      </aside>

      {/* Mobile sidebar drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[75vw] max-w-xs p-0 sm:max-w-xs">
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <ShieldIcon className="size-5 text-primary" />
            <span className="text-sm font-bold tracking-tight">Admin Panel</span>
          </div>
          {navContent}
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile top bar */}
        <div className="flex items-center gap-3 border-b bg-card px-4 py-3 md:hidden">
          <Button size="icon" variant="ghost" onClick={() => setMobileNavOpen(true)}>
            <MenuIcon className="size-5" />
          </Button>
          <div className="flex items-center gap-2">
            <ShieldIcon className="size-4 text-primary" />
            <span className="text-sm font-bold tracking-tight">Admin</span>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">{children}</div>
      </main>
    </div>
  );
}
