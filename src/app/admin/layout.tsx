'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, BookOpen, Globe, Activity, Code2,
  DollarSign, ChevronRight, Zap, Shield, Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { WalletConnect } from '@/components/wallet-connect';

const nav = [
  {
    group: 'Visão Geral',
    items: [
      { href: '/admin',           label: 'Dashboard',        icon: LayoutDashboard },
      { href: '/admin/system',    label: 'Sistema ao Vivo',  icon: Activity },
    ],
  },
  {
    group: 'Documentação',
    items: [
      { href: '/admin/docs',      label: 'Como Funciona',    icon: BookOpen },
      { href: '/admin/api',       label: 'API Reference',    icon: Code2 },
    ],
  },
  {
    group: 'White-Label',
    items: [
      { href: '/admin/whitelabel',  label: 'Guia de Negócio', icon: Globe },
      { href: '/admin/revenue',     label: 'Calculadora',     icon: DollarSign },
    ],
  },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-emerald-500">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-100">AI Liquid Manager</p>
            <p className="text-[10px] text-zinc-500 flex items-center gap-1">
              <Shield className="h-2.5 w-2.5" /> Área Administrativa
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
        {nav.map(section => (
          <div key={section.group}>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1.5 px-2">
              {section.group}
            </p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm transition-all',
                      active
                        ? 'bg-violet-600/20 text-violet-300 font-medium'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                    {active && <ChevronRight className="h-3 w-3 ml-auto" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-zinc-800">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ChevronRight className="h-3 w-3 rotate-180" />
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col md:flex-row">

      {/* ── Desktop sidebar (hidden on mobile) ─────────────────────────────── */}
      <aside className="hidden md:flex w-64 bg-zinc-900/80 border-r border-zinc-800 flex-col shrink-0">
        <NavContent />
      </aside>

      {/* ── Mobile header (hidden on desktop) ──────────────────────────────── */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-zinc-900/90 border-b border-zinc-800 sticky top-0 z-50 backdrop-blur-sm">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-emerald-500">
            <Zap className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-zinc-100">AI Liquid</span>
        </div>

        {/* Right: wallet + hamburger */}
        <div className="flex items-center gap-2">
          <WalletConnect />

          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-72 p-0 bg-zinc-900 border-r border-zinc-800"
            >
              <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
              <NavContent onNavigate={() => setDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
