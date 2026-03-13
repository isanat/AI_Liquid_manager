'use client';

import { useState } from 'react';
import {
  Code2, ChevronRight, Shield, ChevronDown, ChevronUp,
  Server, Globe, ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function Method({ type }: { type: 'GET' | 'POST' }) {
  return (
    <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
      type === 'GET'
        ? 'bg-emerald-500/10 text-emerald-400'
        : 'bg-violet-500/10 text-violet-400'
    }`}>{type}</span>
  );
}

function Block({ children, label }: { children: string; label?: string }) {
  return (
    <div className="rounded-lg bg-zinc-950/80 border border-zinc-800 overflow-hidden">
      {label && <div className="px-3 py-1.5 border-b border-zinc-800 text-[10px] text-zinc-500 font-mono">{label}</div>}
      <pre className="p-3 text-[11px] text-zinc-300 font-mono overflow-x-auto whitespace-pre">{children}</pre>
    </div>
  );
}

function Endpoint({
  method, path, desc, params, reqBody, resBody, notes,
}: {
  method: 'GET' | 'POST';
  path: string;
  desc: string;
  params?: string[][];
  reqBody?: string;
  resBody: string;
  notes?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-3 hover:bg-zinc-800/30 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
        <Method type={method} />
        <code className="text-sm font-mono text-zinc-100 flex-1">{path}</code>
        <span className="text-xs text-zinc-500 hidden md:block">{desc}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-zinc-600 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-600 shrink-0" />}
      </button>
      {open && (
        <div className="border-t border-zinc-800 p-4 space-y-3 bg-zinc-900/30">
          <p className="text-sm text-zinc-400">{desc}</p>
          {params && (
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">Parâmetros</p>
              <div className="space-y-1">
                {params.map(([name, type, req, desc_]) => (
                  <div key={name} className="flex items-start gap-3 text-xs">
                    <code className="font-mono text-emerald-400 w-32 shrink-0">{name}</code>
                    <span className="text-zinc-600 w-16 shrink-0">{type}</span>
                    <Badge variant="outline" className={`text-[9px] shrink-0 ${req === 'required' ? 'text-rose-400 border-rose-500/30' : 'text-zinc-500 border-zinc-700'}`}>{req}</Badge>
                    <span className="text-zinc-500">{desc_}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {reqBody && <Block label="Request Body">{reqBody}</Block>}
          <Block label="Response">{resBody}</Block>
          {notes && (
            <div className="flex items-start gap-2 text-[11px] text-zinc-500 p-2 bg-zinc-800/50 rounded">
              <span className="text-amber-400 shrink-0">Nota:</span> {notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApiPage() {
  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
          <Shield className="h-3 w-3" />
          <span>Admin</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-300">API Reference</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100 flex items-center gap-3">
          <Code2 className="h-7 w-7 text-amber-400" />
          API Reference
        </h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Todos os endpoints do AI Engine e do Frontend documentados com exemplos.
        </p>
      </div>

      {/* Base URLs */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 space-y-1">
            <div className="flex items-center gap-2">
              <Server className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-xs font-semibold text-zinc-200">AI Engine</p>
            </div>
            <code className="text-[10px] font-mono text-emerald-400">http://localhost:8000</code>
            <p className="text-[10px] text-zinc-600">Produção: NEXT_PUBLIC_AI_ENGINE_URL</p>
          </div>
          <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 space-y-1">
            <div className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-violet-400" />
              <p className="text-xs font-semibold text-zinc-200">Frontend API Routes</p>
            </div>
            <code className="text-[10px] font-mono text-violet-400">http://localhost:3000/api</code>
            <p className="text-[10px] text-zinc-600">Server-side — não expostas ao cliente</p>
          </div>
        </CardContent>
      </Card>

      {/* AI Engine Endpoints */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Server className="h-4 w-4 text-emerald-400" />
          <h2 className="text-lg font-bold text-zinc-100">AI Engine (Port 8000)</h2>
        </div>
        <div className="space-y-2">

          <Endpoint
            method="GET" path="/health"
            desc="Status de saúde do AI Engine e informações sobre o modelo carregado."
            resBody={`{
  "status": "healthy",
  "model_loaded": true,
  "model_version": "lgbm-v1-loaded",
  "uptime_seconds": 3600.5,
  "data_source": "The Graph (key: configured)"
}`} />

          <Endpoint
            method="GET" path="/predict"
            desc="Chamado automaticamente pelo keeper a cada 15 minutos. Retorna parâmetros de estratégia para o próximo rebalance."
            resBody={`{
  "current_price": 2500.00,
  "range_width": 0.06,          // ±6% à volta do preço
  "core_pct": 0.70,             // 70% do capital idle a deployar
  "confidence": 0.85,           // Confiança do modelo [0-1]
  "regime": "range",            // trend | range | high-vol | low-vol
  "model_version": "lgbm-v1-loaded"
}`}
            notes="Se current_price estiver em falta na resposta, o keeper recusa o rebalance e apenas colecta fees." />

          <Endpoint
            method="POST" path="/inference"
            desc="Inferência manual com dados fornecidos pelo caller. Útil para testar o modelo com dados específicos."
            reqBody={`{
  "price": 2500,
  "twap_1h": 2490,
  "twap_24h": 2450,
  "volume_1h": 5000000,
  "volume_24h": 120000000,
  "total_liquidity": 25000000,
  "active_liquidity": 12000000,
  "tick": 194100
}`}
            resBody={`{
  "range_width": 7.0,                // % de largura da range
  "range_bias": 0.0045,              // desvio do centro (>0 = bullish)
  "core_allocation": 70.0,           // % capital para posição core
  "defensive_allocation": 20.0,      // % para posição defensiva (wide)
  "opportunistic_allocation": 10.0,  // % para posição tight
  "cash_buffer": 5.0,                // % mantido idle
  "rebalance_threshold": 0.08,       // % desvio para forçar rebalance
  "confidence": 0.85,
  "detected_regime": "range",
  "regime_confidence": 0.88,
  "reasoning": "Normal market conditions with range-bound price action.",
  "model_version": "lgbm-v1-loaded"
}`} />

          <Endpoint
            method="POST" path="/inference/pool/{pool_address}"
            desc="Busca dados ao vivo do The Graph para o pool indicado e corre inferência automática."
            params={[
              ['pool_address', 'string', 'required', 'Endereço do pool Uniswap V3 ou alias (ex: eth-usdc)'],
            ]}
            resBody={`// Mesmo formato que POST /inference
{
  "range_width": 6.5,
  "core_allocation": 72.0,
  ...
  "data_source": "the-graph:0xC6962004..."
}`} />

          <Endpoint
            method="POST" path="/train"
            desc="Dispara o treino (ou re-treino) do modelo LightGBM com dados históricos."
            reqBody={`{
  "pool_address": "0xC6962004f452bE9203591991D15f6b388e09E8D0",
  "days": 90,                      // Dias de histórico
  "use_synthetic_fallback": true   // Usar sintéticos se The Graph falhar
}`}
            resBody={`{
  "success": true,
  "message": "Trained on 252 samples from the-graph",
  "model_version": "lgbm-v1-the-graph",
  "metrics": {
    "range_rmse": 1.23,
    "allocation_rmse": 5.67,
    "regime_accuracy": 0.82         // 82% de acurácia na classificação
  },
  "data_source": "the-graph",
  "training_samples": 252
}`} />

          <Endpoint
            method="POST" path="/backtest"
            desc="Corre um backtest da estratégia com dados históricos reais ou sintéticos."
            reqBody={`{
  "days": 30,
  "initial_capital": 100000,     // USDC
  "volatility": 0.04,            // Volatilidade sintética (se sem dados)
  "trend": 0.0,                  // Tendência de preço sintética
  "pool_address": "0xC6962004..."  // Opcional — usa dados reais
}`}
            resBody={`{
  "total_return": 0.0450,         // 4.5% de retorno total
  "apr": 0.168,                   // 16.8% anualizado
  "sharpe_ratio": 1.23,
  "max_drawdown": -0.082,         // -8.2% pior queda
  "fees_collected": 4500.25,      // USDC ganho em fees LP
  "impermanent_loss": -120.50,    // USDC perdido em IL
  "rebalance_count": 45,
  "total_gas_cost": 450.75,
  "vs_hodl": 0.035,               // +3.5% vs segurar os activos
  "data_source": "the-graph:0x..."
}`} />

          <Endpoint
            method="GET" path="/keeper/status"
            desc="Estado actual do keeper bot: último run, próximo run, erros, totais."
            resBody={`{
  "last_run": "2024-03-12T15:30:00Z",
  "last_run_timestamp": 1710248400.5,
  "last_tx_hash": "0xabc123...",
  "last_error": null,
  "total_runs": 42,
  "total_rebalances": 38,
  "status": "idle",               // idle | running
  "next_run_in_seconds": 450,
  "interval_seconds": 900
}`} />

          <Endpoint
            method="GET" path="/features/importance"
            desc="Importância de cada feature no modelo treinado (ou ranking baseado em regras)."
            resBody={`{
  "feature_importance": {
    "volatility_1d": 0.18,
    "volume_spike_ratio": 0.15,
    "price_drift": 0.12,
    "liquidity_concentration": 0.10,
    "volume_24h": 0.08,
    "total_liquidity": 0.07,
    "fee_rate_24h": 0.06,
    "realized_volatility": 0.05,
    "price_velocity": 0.05,
    "hour_of_day": 0.04
  },
  "source": "trained_model",
  "model_version": "lgbm-v1-loaded"
}`} />

          <Endpoint
            method="GET" path="/pools"
            desc="Lista de pools suportados com os seus aliases."
            resBody={`{
  "pools": {
    "eth-usdc":     "0x8ad599c3a0ff1de082011efddc58f1908eb6e6d8",
    "eth-usdc-arb": "0xC6962004f452bE9203591991D15f6b388e09E8D0",
    "wbtc-eth":     "0xcbcdf9626bc03e24f779434178a73a0b4bad62ed"
  }
}`} />

        </div>
      </div>

      {/* Frontend API Routes */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-4 w-4 text-violet-400" />
          <h2 className="text-lg font-bold text-zinc-100">Frontend API Routes (Port 3000)</h2>
        </div>
        <p className="text-xs text-zinc-500 mb-3">
          Estas rotas correm server-side no Next.js. Servem para proxy (The Graph, AI Engine) e
          para expor dados do vault sem expor as API keys ao browser.
        </p>
        <div className="space-y-2">

          <Endpoint
            method="GET" path="/api/liquidity?action=full"
            desc="Dados completos do sistema: mercado, features, outputs IA, regime, ranges calculadas."
            params={[
              ['action', 'string', 'optional', 'full | market | ai-inference | regime | ranges | rebalance-score'],
            ]}
            resBody={`{
  "success": true,
  "data": {
    "market": {
      "price": 2500.0,
      "tick": 194100,
      "twap": 2490.0,
      "priceVelocity": 0.023,
      "liquidity": 25000000,
      "volume24h": 120000000,
      "fees24h": 60000
    },
    "aiInputs": { /* 29 features */ },
    "aiOutputs": {
      "rangeWidth": 6.0,
      "confidence": 0.85,
      "regime": "range"
    },
    "ranges": [
      { "type": "core",         "lower": 2350, "upper": 2650 },
      { "type": "defensive",    "lower": 2000, "upper": 3000 },
      { "type": "opportunistic","lower": 2450, "upper": 2550 }
    ]
  }
}`} />

          <Endpoint
            method="POST" path="/api/ai?action=inference"
            desc="Proxy server-side para o AI Engine. Evita expor a URL do engine ao browser."
            reqBody={`{ "price": 2500, "volume_24h": 120000000, ... }`}
            resBody={`// Mesmo formato que POST /inference no AI Engine`} />

          <Endpoint
            method="GET" path="/api/vault"
            desc="Dados do contrato vault: totalAssets, sharePrice, deployedCapital, positions."
            resBody={`{
  "totalAssets": "1000000000000",       // USDC em wei (6 dec)
  "sharePrice": "1050000",              // Por share vAI (em USDC 6dec)
  "deployedCapital": "700000000000",
  "activePositions": 1,
  "managementFeeBps": 200,
  "performanceFeeBps": 2000
}`} />

          <Endpoint
            method="GET" path="/api"
            desc="Health check geral da aplicação frontend."
            resBody={`{ "status": "ok", "timestamp": "2024-03-12T15:00:00Z" }`} />

        </div>
      </div>

      {/* Error Codes */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-sm text-zinc-100">Códigos de Erro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {[
              ['200', 'OK', 'Sucesso'],
              ['422', 'Validation Error', 'Parâmetros inválidos (FastAPI)'],
              ['500', 'Internal Server Error', 'Erro interno — verificar logs do serviço'],
              ['503', 'Service Unavailable', 'The Graph ou RPC indisponível'],
            ].map(([code, name, desc_]) => (
              <div key={code} className="flex items-center gap-4 py-1.5 border-b border-zinc-800/50 last:border-0 text-xs">
                <code className={`font-mono font-bold w-10 ${code === '200' ? 'text-emerald-400' : 'text-rose-400'}`}>{code}</code>
                <span className="text-zinc-300 w-36">{name}</span>
                <span className="text-zinc-500">{desc_}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 pt-2">
        <a href="/admin" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
          <ArrowRight className="h-3 w-3 rotate-180" /> Voltar ao Admin
        </a>
      </div>

    </div>
  );
}
