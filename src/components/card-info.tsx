'use client';

import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CardInfoProps {
  tip: string;
  className?: string;
}

export function CardInfo({ tip, className }: CardInfoProps) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen(v => !v)}
            className={`inline-flex items-center justify-center w-4 h-4 rounded-full
              text-[10px] font-bold text-zinc-500 border border-zinc-700
              hover:border-zinc-500 hover:text-zinc-300 transition-colors shrink-0 ${className ?? ''}`}
            aria-label="More info"
          >
            ?
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-xs leading-relaxed bg-zinc-900 border-zinc-700 text-zinc-300 shadow-xl"
        >
          {tip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
