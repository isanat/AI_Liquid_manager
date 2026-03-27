'use client';

import { Activity, Brain, Clock, Layers, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

const SECTIONS = [
  { id: 'overview',  label: 'Overview',  icon: LayoutDashboard },
  { id: 'vault',     label: 'Vault',     icon: Layers          },
  { id: 'history',   label: 'History',   icon: Clock           },
  { id: 'strategy',  label: 'Strategy',  icon: Brain           },
  { id: 'system',    label: 'System',    icon: Activity        },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

export function MobileNav() {
  const [active, setActive] = useState<SectionId>('overview');

  // Track which section is in view using IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActive(id); },
        { threshold: 0.3 },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  }, []);

  const scrollTo = (id: SectionId) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActive(id);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 safe-area-pb">
      <div className="flex items-stretch">
        {SECTIONS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors',
                isActive
                  ? 'text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]')} />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
