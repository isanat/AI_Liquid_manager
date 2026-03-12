'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, BookOpen, Globe, Activity, Code2,
  DollarSign, ChevronRight, Zap, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900/80 border-r border-zinc-800 flex flex-col shrink-0">
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
                      className={cn(
                        'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all',
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
            className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ChevronRight className="h-3 w-3 rotate-180" />
            Voltar ao Dashboard
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
