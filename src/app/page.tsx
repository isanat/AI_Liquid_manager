'use client';

import { useEffect, useState } from 'react';
import LiquidityManagerDashboard from '@/components/liquidity-dashboard';
import { MobileDashboard } from '@/components/mobile-dashboard';

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    setReady(true);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Avoid flash on first render (server renders nothing until client decides)
  if (!ready) return null;

  return isMobile ? <MobileDashboard /> : <LiquidityManagerDashboard />;
}
