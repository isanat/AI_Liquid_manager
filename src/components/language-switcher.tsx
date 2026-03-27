'use client';

import { Check, Globe } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useI18n, LOCALES, type Locale } from '@/contexts/i18n-context';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  const current = LOCALES.find(l => l.code === locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm
            text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors
            border border-zinc-700 hover:border-zinc-600 focus:outline-none focus-visible:ring-2
            focus-visible:ring-zinc-500"
          aria-label="Select language"
        >
          <Globe className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">{current?.flag}</span>
          <span className="hidden sm:inline text-xs font-medium uppercase">{locale}</span>
          <span className="sm:hidden">{current?.flag ?? <Globe className="h-3.5 w-3.5" />}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[160px] bg-zinc-900 border-zinc-700 text-zinc-300"
      >
        {LOCALES.map(l => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLocale(l.code as Locale)}
            className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800 hover:text-white focus:bg-zinc-800 focus:text-white"
          >
            <span className="text-base leading-none">{l.flag}</span>
            <span className="flex-1 text-sm">{l.label}</span>
            {locale === l.code && (
              <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
