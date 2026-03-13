'use client';

import { useState, useEffect } from 'react';
import {
  Activity, ChevronRight, Shield, RefreshCw, CheckCircle,
  XCircle, AlertTriangle, Server, Cpu, Database, Zap, Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface KeeperState {
  last_run?: string;
  last_run_timestamp?: number;
  last_tx_hash?: string;
  last_error?: string | null;
  total_runs?: number;
  total_rebalances?: number;
  status?: string;
  next_run_in_seconds?: number;
  interval_seconds?: number;
}

interface HealthData {
  status?: string;
  model_loaded?: boolean;
  model_version?: string;
  uptime_seconds?: number;
  data_source?: string;
}

function StatusBadge({ ok, loading }: { ok: boolean | null; loading?: boolean }) {
  if (loading) return <Badge variant="outline" className="text-[9px] border-zinc-600 text-zinc-400">Verificando…</Badge>;
  if (ok === null) return <Badge variant="outline" className="text-[9px] border-zinc-600 text-zinc-400">Desconhecido</Badge>;
  return ok
    ? <Badge className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Online</Badge>
    : <Badge className="text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/20">Offline</Badge>;
}

function EnvRow({ label, envKey, value, required }: { label: string; envKey: string; value?: string; required?: boolean }) {
  const set = !!value && value !== 'not-set';
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
      <div>
        <p className="text-xs font-medium text-zinc-300">{label}</p>
        <p className="text-[10px] font-mono text-zinc-600">{envKey}</p>
      </div>
      <div className="flex items-center gap-2">
        {set
          ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
          : required
            ? <XCircle className="h-3.5 w-3.5 text-rose-400" />
            : <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
        }
        <span className={`text-[10px] font-mono ${set ? 'text-emerald-400' : required ? 'text-rose-400' : 'text-amber-500'}`}>
          {set ? (value!.length > 20 ? value!.slice(0, 8) + '…' + value!.slice(-4) : value) : required ? 'NÃO DEFINIDO' : 'opcional'}
        </span>
      </div>
    </div>
  );
}

export default function SystemPage() {
  const [health, setHealth]         = useState<HealthData | null>(null);
  const [keeper, setKeeper]         = useState<KeeperState | null>(null);
  const [aiUrl,  setAiUrl]          = useState<string>('');
  const [loading, setLoading]       = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calls our own Next.js API route (server-side proxy to AI Engine).
  // This avoids CORS issues and uses AI_ENGINE_URL (fromService) instead
  // of the hardcoded NEXT_PUBLIC_AI_ENGINE_URL.
  const refresh = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/system-status', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        // 503 = AI_ENGINE_URL not set on server, 502 = URL set but fetch failed
        setErrorMsg(data.error ?? `HTTP ${res.status}`);
        return;
      }
      if (data.health) setHealth(data.health);
      if (data.keeper) setKeeper(data.keeper);
      if (data.ai_url) setAiUrl(data.ai_url);
      if (!data.health) {
        setErrorMsg(data.health_error ?? 'AI Engine não respondeu (pode estar a acordar — tente de novo em 30s)');
      }
    } catch (e) {
      setErrorMsg('Falha ao chamar /api/system-status — verifique o servidor Next.js');
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  };

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 30_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uptime = health?.uptime_seconds
    ? health.uptime_seconds < 3600
      ? `${Math.floor(health.uptime_seconds / 60)} min`
      : `${(health.uptime_seconds / 3600).toFixed(1)} h`
    : '—';

  const nextRun = keeper?.next_run_in_seconds != null
    ? keeper.next_run_in_seconds < 60
      ? `${keeper.next_run_in_seconds}s`
      : `${Math.round(keeper.next_run_in_seconds / 60)} min`
    : '—';

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
            <Shield className="h-3 w-3" />
            <span>Admin</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-zinc-300">Sistema ao Vivo</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Monitorização do Sistema</h1>
          <p className="text-zinc-400 mt-1 text-sm">
            Status em tempo real dos serviços, keeper bot e variáveis de ambiente.
          </p>
        </div>
        <Button size="sm" variant="outline" className="border-zinc-700 text-zinc-400 self-start" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      <p className="text-[10px] text-zinc-600">
        Última actualização: {lastRefresh.toLocaleTimeString('pt-PT')} · Auto-refresh: 30s
      </p>

      {/* Service Status Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: Server, color: 'text-violet-400', label: 'Frontend (Next.js)',
            ok: true, // Always online if this page loads
            detail: process.env.NEXT_PUBLIC_FRONTEND_URL ?? 'ai-liquidity-frontend (Render)',
          },
          {
            icon: Cpu, color: 'text-emerald-400', label: 'AI Engine (FastAPI)',
            ok: health ? health.status === 'healthy' : null,
            detail: aiUrl || 'Ligando via /api/system-status…',
          },
          {
            icon: Zap, color: 'text-amber-400', label: 'Keeper Bot',
            ok: keeper ? keeper.status !== undefined : null,
            detail: keeper?.status === 'running' ? 'Em execução' : keeper?.status === 'idle' ? 'Aguardando próximo ciclo' : 'Status desconhecido',
          },
        ].map(s => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Icon className={`h-5 w-5 ${s.color}`} />
                  <StatusBadge ok={s.ok} loading={loading && s.ok === null} />
                </div>
                <p className="text-sm font-semibold text-zinc-100">{s.label}</p>
                <p className="text-[10px] text-zinc-500 font-mono truncate">{s.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* AI Engine Health */}
      {health ? (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-zinc-100 flex items-center gap-2">
              <Cpu className="h-5 w-5 text-emerald-400" />
              AI Engine — Detalhes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { label: 'Status',            value: health?.status        ?? '—' },
                { label: 'Modelo carregado',  value: health?.model_loaded  ? 'Sim' : 'Não' },
                { label: 'Versão do modelo',  value: health?.model_version ?? '—' },
                { label: 'Fonte de dados',    value: health?.data_source   ?? '—' },
                { label: 'Uptime',            value: uptime },
                { label: 'URL (server-side)', value: aiUrl || '—' },
              ].map(r => (
                <div key={r.label} className="flex justify-between py-2 border-b border-zinc-800/50 last:border-0 col-span-1">
                  <span className="text-xs text-zinc-400">{r.label}</span>
                  <span className="text-xs font-mono text-zinc-200 text-right ml-4 truncate max-w-[200px]">{r.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : !loading && (
        <Card className="bg-rose-500/5 border-rose-500/20">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-rose-400" />
              <p className="text-sm text-rose-300 font-medium">AI Engine não responde</p>
            </div>
            {errorMsg && (
              <p className="text-xs font-mono text-rose-300/70 ml-6 break-all">{errorMsg}</p>
            )}
            <div className="ml-6 space-y-1 text-xs text-zinc-500">
              {errorMsg?.includes('not configured') ? (
                <p>
                  <strong className="text-zinc-400">AI_ENGINE_URL não está definida no servidor.</strong>{' '}
                  Vá ao Render → <code className="text-zinc-400">ai-liquid-frontend</code> → Environment e adicione:
                  <br/>
                  <code className="text-emerald-400">AI_ENGINE_URL = https://ai-liquid-manager.onrender.com</code>
                </p>
              ) : (
                <p>
                  O serviço <code className="text-zinc-400">ai-liquid-manager</code> pode estar a dormir (Render free tier adormece após 15 min).
                  Aguarde 30–60 segundos e clique em <strong className="text-zinc-400">Actualizar</strong>.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Keeper Status */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-zinc-100 flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-400" />
                Keeper Bot — Status ao Vivo
              </CardTitle>
              <CardDescription>Responsável pelo ciclo de rebalance a cada 15 minutos</CardDescription>
            </div>
            {keeper && (
              <Badge
                className={keeper.status === 'running'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-zinc-700/50 text-zinc-400 border-zinc-600'
                }
              >
                {keeper.status === 'running' ? 'Em execução' : 'Idle'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {keeper ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { label: 'Última execução', value: keeper.last_run ? new Date(keeper.last_run).toLocaleString('pt-PT') : '—' },
                { label: 'Próxima execução em', value: nextRun },
                { label: 'Intervalo do ciclo', value: keeper.interval_seconds ? `${(keeper.interval_seconds / 60).toFixed(0)} minutos` : '—' },
                { label: 'Total de ciclos', value: keeper.total_runs?.toString() ?? '0' },
                { label: 'Total de rebalances', value: keeper.total_rebalances?.toString() ?? '0' },
                { label: 'Último TX Hash', value: keeper.last_tx_hash ? `${keeper.last_tx_hash.slice(0, 10)}…` : 'nenhum' },
              ].map(r => (
                <div key={r.label} className="flex justify-between py-2 border-b border-zinc-800/50">
                  <span className="text-xs text-zinc-400">{r.label}</span>
                  <span className="text-xs font-mono text-zinc-200">{r.value}</span>
                </div>
              ))}
              {keeper.last_error && (
                <div className="col-span-2 mt-2 p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
                  <div className="flex items-center gap-2 text-xs text-rose-400 font-semibold mb-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Último Erro
                  </div>
                  <p className="text-[10px] font-mono text-rose-300">{keeper.last_error}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-zinc-600 text-sm">
              {loading ? 'A carregar…' : 'Não foi possível obter status do keeper. Verifique se o AI Engine está online.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Database className="h-5 w-5 text-cyan-400" />
            Variáveis de Ambiente
          </CardTitle>
          <CardDescription>Checklist de configuração do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-semibold">Frontend (públicas)</p>
            <EnvRow label="Vault Address"    envKey="NEXT_PUBLIC_VAULT_ADDRESS"    value={process.env.NEXT_PUBLIC_VAULT_ADDRESS}    required />
            <EnvRow label="Chain ID"         envKey="NEXT_PUBLIC_CHAIN_ID"         value={process.env.NEXT_PUBLIC_CHAIN_ID}          required />
            <EnvRow label="AI Engine URL"    envKey="NEXT_PUBLIC_AI_ENGINE_URL"    value={process.env.NEXT_PUBLIC_AI_ENGINE_URL}    />
            <EnvRow label="WalletConnect ID" envKey="NEXT_PUBLIC_WC_PROJECT_ID"    value={process.env.NEXT_PUBLIC_WC_PROJECT_ID}    />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 font-semibold">Blockchain Configurada</p>
            <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 space-y-1">
              {[
                { k: 'Chain ID', v: process.env.NEXT_PUBLIC_CHAIN_ID },
                { k: 'Vault', v: process.env.NEXT_PUBLIC_VAULT_ADDRESS },
                { k: 'Rede', v: process.env.NEXT_PUBLIC_CHAIN_ID === '421614' ? 'Arbitrum Sepolia (Testnet)' : process.env.NEXT_PUBLIC_CHAIN_ID === '42161' ? 'Arbitrum One (Produção)' : 'Desconhecida' },
              ].map(r => (
                <div key={r.k} className="flex justify-between text-xs">
                  <span className="text-zinc-500">{r.k}</span>
                  <span className="font-mono text-zinc-300 text-right">{r.v || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Reference */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-zinc-100 flex items-center gap-2">
            <Clock className="h-5 w-5 text-violet-400" />
            Referência Rápida — Endereços e URLs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { label: 'Vault Contract (Sepolia)', value: process.env.NEXT_PUBLIC_VAULT_ADDRESS ?? '0x69d8ec9d32c26e652cd5643100a2ec0149d76c3d' },
              { label: 'USDC Arbitrum One',        value: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
              { label: 'USDC Arbitrum Sepolia',    value: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d' },
              { label: 'WETH Arbitrum',            value: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' },
              { label: 'NPM Arbitrum Sepolia',     value: '0x6b2937Bde17889EDCf8fbD8dE31C3C2a70Bc4d65' },
              { label: 'ETH/USDC Pool (Sepolia)',  value: '0x77F8dA77c8fb5ADAf3088937B934beC2B0ff97bF' },
              { label: 'Arbiscan Sepolia',         value: 'https://sepolia.arbiscan.io' },
              { label: 'Arbiscan Mainnet',         value: 'https://arbiscan.io' },
            ].map(r => (
              <div key={r.label} className="flex flex-col sm:flex-row sm:justify-between py-1.5 border-b border-zinc-800/50 last:border-0 gap-0.5">
                <span className="text-xs text-zinc-400 shrink-0">{r.label}</span>
                <span className="text-[10px] font-mono text-zinc-500 text-right ml-4 truncate">{r.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
