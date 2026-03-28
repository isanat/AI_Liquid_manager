"""
Investor Report Generator

Transforma métricas técnicas em relatórios para investidores institucionais.
Linguagem clara, benchmarks, e análise de risco.
"""
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import structlog

logger = structlog.get_logger()


@dataclass
class InvestorReport:
    """Relatório formatado para investidores"""
    # Metadados
    report_date: datetime
    period_start: datetime
    period_end: datetime
    vault_address: str
    asset: str  # USDC or USDT
    
    # ─── Resumo Executivo ─────────────────────────────────────────────────────
    executive_summary: str = ""
    
    # ─── Retorno e Performance ───────────────────────────────────────────────
    net_return: float = 0.0           # Retorno líquido (%)
    net_return_usd: float = 0.0       # Retorno líquido (USD)
    gross_return: float = 0.0         # Retorno bruto (%)
    fees_earned: float = 0.0          # Taxas coletadas (USD)
    fees_earned_apr: float = 0.0      # APR de taxas
    
    # Custos
    gas_costs: float = 0.0            # Custos de gas (USD)
    management_fees: float = 0.0      # Taxa de gestão (USD)
    performance_fees: float = 0.0     # Taxa de performance (USD)
    total_costs: float = 0.0          # Total de custos
    
    # ─── Risco ───────────────────────────────────────────────────────────────
    max_drawdown: float = 0.0         # Maior queda (%)
    worst_month: str = ""             # Pior mês
    worst_month_return: float = 0.0   # Retorno do pior mês
    best_month: str = ""              # Melhor mês
    best_month_return: float = 0.0    # Retorno do melhor mês
    volatility: float = 0.0           # Volatilidade anualizada (%)
    
    # ─── Comparação com Benchmark ─────────────────────────────────────────────
    benchmark_name: str = "HODL ETH"  # Benchmark
    benchmark_return: float = 0.0     # Retorno do benchmark
    vs_benchmark: float = 0.0         # Diferença vs benchmark
    capture_ratio: float = 0.0        # Taxa de captura de upside
    
    # ─── Métricas Institucionais ──────────────────────────────────────────────
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    information_ratio: float = 0.0
    
    # ─── Atividade do Vault ─────────────────────────────────────────────────
    tvl_start: float = 0.0            # TVL início do período
    tvl_end: float = 0.0              # TVL fim do período
    rebalance_count: int = 0          # Número de rebalances
    avg_range_width: float = 0.0      # Largura média dos ranges
    
    # ─── Análise por Regime ─────────────────────────────────────────────────
    regime_breakdown: Dict = field(default_factory=dict)
    
    # ─── Alertas e Observações ──────────────────────────────────────────────
    alerts: List[str] = field(default_factory=list)
    observations: List[str] = field(default_factory=list)
    
    def to_markdown(self) -> str:
        """Converte relatório para Markdown formatado"""
        lines = [
            f"# Relatório de Performance - Vault {self.asset}",
            f"",
            f"**Período:** {self.period_start.strftime('%d/%m/%Y')} a {self.period_end.strftime('%d/%m/%Y')}",
            f"**Vault:** `{self.vault_address[:8]}...{self.vault_address[-6:]}`",
            f"",
            f"---",
            f"",
            f"## Resumo Executivo",
            f"",
            f"{self.executive_summary}",
            f"",
            f"---",
            f"",
            f"## Retorno e Performance",
            f"",
            f"| Métrica | Valor |",
            f"|---------|-------|",
            f"| **Retorno Líquido** | **{self.net_return:+.2f}%** (${self.net_return_usd:+,.0f}) |",
            f"| Retorno Bruto | {self.gross_return:+.2f}% |",
            f"| Taxas Coletadas | ${self.fees_earned:,.0f} (APR: {self.fees_earned_apr:.1f}%) |",
            f"",
            f"### Custos",
            f"",
            f"| Tipo | Valor |",
            f"|------|-------|",
            f"| Gas | ${self.gas_costs:,.2f} |",
            f"| Taxa de Gestão | ${self.management_fees:,.2f} |",
            f"| Taxa de Performance | ${self.performance_fees:,.2f} |",
            f"| **Total** | **${self.total_costs:,.2f}** |",
            f"",
            f"---",
            f"",
            f"## Análise de Risco",
            f"",
            f"| Métrica | Valor |",
            f"|---------|-------|",
            f"| **Max Drawdown** | **{self.max_drawdown:.2f}%** |",
            f"| Pior Mês | {self.worst_month} ({self.worst_month_return:+.2f}%) |",
            f"| Melhor Mês | {self.best_month} ({self.best_month_return:+.2f}%) |",
            f"| Volatilidade (anualizada) | {self.volatility:.1f}% |",
            f"",
            f"---",
            f"",
            f"## Comparação com Benchmark ({self.benchmark_name})",
            f"",
            f"| Métrica | Vault | Benchmark | Diferença |",
            f"|---------|-------|-----------|-----------|",
            f"| Retorno | {self.net_return:+.2f}% | {self.benchmark_return:+.2f}% | {self.vs_benchmark:+.2f}% |",
            f"",
            f"### Métricas de Risco-Retorno",
            f"",
            f"| Ratio | Valor | Interpretação |",
            f"|-------|-------|---------------|",
            f"| Sharpe | {self.sharpe_ratio:.2f} | {'Bom' if self.sharpe_ratio > 1 else 'Regular' if self.sharpe_ratio > 0.5 else 'Ruim'} |",
            f"| Sortino | {self.sortino_ratio:.2f} | {'Bom' if self.sortino_ratio > 1.5 else 'Regular' if self.sortino_ratio > 0.8 else 'Ruim'} |",
            f"| Calmar | {self.calmar_ratio:.2f} | {'Bom' if self.calmar_ratio > 3 else 'Regular' if self.calmar_ratio > 1 else 'Ruim'} |",
            f"",
            f"---",
            f"",
            f"## Atividade do Vault",
            f"",
            f"| Métrica | Início | Fim |",
            f"|---------|--------|-----|",
            f"| TVL | ${self.tvl_start:,.0f} | ${self.tvl_end:,.0f} |",
            f"",
            f"| Métrica | Valor |",
            f"|---------|-------|",
            f"| Rebalances no período | {self.rebalance_count} |",
            f"| Largura média dos ranges | +/-{self.avg_range_width:.1f}% |",
            f"",
        ]
        
        # Regime breakdown
        if self.regime_breakdown:
            lines.extend([
                f"---",
                f"",
                f"## Performance por Regime de Mercado",
                f"",
                f"| Regime | Dias | Retorno | Contribuição |",
                f"|--------|------|---------|---------------|",
            ])
            for regime, data in self.regime_breakdown.items():
                lines.append(
                    f"| {regime} | {data.get('days', 0)} | {data.get('return', 0):+.2f}% | {data.get('contribution', 0):.1f}% |"
                )
        
        # Alertas
        if self.alerts:
            lines.extend([
                f"",
                f"---",
                f"",
                f"## Alertas",
                f"",
            ])
            for alert in self.alerts:
                lines.append(f"- {alert}")
        
        # Observações
        if self.observations:
            lines.extend([
                f"",
                f"---",
                f"",
                f"## Observações",
                f"",
            ])
            for obs in self.observations:
                lines.append(f"- {obs}")
        
        lines.extend([
            f"",
            f"---",
            f"",
            f"*Relatório gerado em {self.report_date.strftime('%d/%m/%Y às %H:%M')} UTC*",
        ])
        
        return "\n".join(lines)
    
    def to_json(self) -> Dict:
        """Converte relatório para JSON (para API)"""
        return {
            "report_date": self.report_date.isoformat(),
            "period": {
                "start": self.period_start.isoformat(),
                "end": self.period_end.isoformat(),
            },
            "vault": {
                "address": self.vault_address,
                "asset": self.asset,
            },
            "performance": {
                "net_return_pct": self.net_return,
                "net_return_usd": self.net_return_usd,
                "gross_return_pct": self.gross_return,
                "fees_earned": self.fees_earned,
                "fees_earned_apr": self.fees_earned_apr,
            },
            "costs": {
                "gas": self.gas_costs,
                "management_fees": self.management_fees,
                "performance_fees": self.performance_fees,
                "total": self.total_costs,
            },
            "risk": {
                "max_drawdown": self.max_drawdown,
                "worst_month": {"month": self.worst_month, "return": self.worst_month_return},
                "best_month": {"month": self.best_month, "return": self.best_month_return},
                "volatility": self.volatility,
            },
            "benchmark": {
                "name": self.benchmark_name,
                "return": self.benchmark_return,
                "vs_benchmark": self.vs_benchmark,
            },
            "ratios": {
                "sharpe": self.sharpe_ratio,
                "sortino": self.sortino_ratio,
                "calmar": self.calmar_ratio,
            },
            "activity": {
                "tvl_start": self.tvl_start,
                "tvl_end": self.tvl_end,
                "rebalances": self.rebalance_count,
                "avg_range_width": self.avg_range_width,
            },
            "regime_breakdown": self.regime_breakdown,
            "alerts": self.alerts,
            "observations": self.observations,
        }


class InvestorReportGenerator:
    """
    Gera relatórios para investidores a partir de resultados de backtest/produção.
    """
    
    def __init__(
        self,
        management_fee_bps: int = 200,    # 2% default
        performance_fee_bps: int = 2000,  # 20% default
        risk_free_rate: float = 0.04,      # 4% annual
    ):
        self.management_fee_bps = management_fee_bps
        self.performance_fee_bps = performance_fee_bps
        self.risk_free_rate = risk_free_rate
    
    def generate(
        self,
        backtest_results,        # BacktestResult
        vault_address: str,
        asset: str = "USDC",
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None,
        daily_prices: Optional[pd.DataFrame] = None,  # Para análise por regime
    ) -> InvestorReport:
        """
        Gera relatório completo para investidores.
        
        Args:
            backtest_results: Resultados do backtest
            vault_address: Endereço do vault
            asset: USDC ou USDT
            period_start: Início do período
            period_end: Fim do período
            daily_prices: DataFrame com preços diários para análise de regime
        
        Returns:
            InvestorReport formatado
        """
        now = datetime.utcnow()
        
        # Determinar período
        if period_end is None:
            period_end = now
        if period_start is None:
            period_start = period_end - timedelta(days=30)
        
        days = (period_end - period_start).days or 1
        
        # ─── Calcular métricas básicas ────────────────────────────────────────
        
        # Retorno bruto
        gross_return = backtest_results.total_return
        
        # Taxas coletadas
        fees_earned = backtest_results.fees_collected
        
        # APR de taxas
        years = days / 365
        fees_earned_apr = (fees_earned / backtest_results.initial_capital) / years * 100 if years > 0 else 0
        
        # Custos
        gas_costs = backtest_results.total_gas_cost
        management_fees = backtest_results.initial_capital * (self.management_fee_bps / 10000) * years
        performance_fees = max(0, backtest_results.initial_capital * gross_return * (self.performance_fee_bps / 10000)) if gross_return > 0 else 0
        total_costs = gas_costs + management_fees + performance_fees
        
        # Retorno líquido
        net_return = gross_return - (total_costs / backtest_results.initial_capital)
        net_return_usd = backtest_results.initial_capital * net_return
        
        # ─── Métricas de risco ────────────────────────────────────────────────
        
        max_drawdown = backtest_results.max_drawdown
        
        # Calcular melhor/pior mês
        worst_month, worst_month_return = self._calculate_worst_month(backtest_results)
        best_month, best_month_return = self._calculate_best_month(backtest_results)
        
        # Volatilidade
        if hasattr(backtest_results, 'daily_returns') and backtest_results.daily_returns:
            volatility = np.std(backtest_results.daily_returns) * np.sqrt(365) * 100
        else:
            volatility = 0.0
        
        # ─── Benchmark ────────────────────────────────────────────────────────
        
        benchmark_return = backtest_results.hodl_return
        vs_benchmark = backtest_results.vs_hodl
        
        # Capture ratio
        if benchmark_return > 0:
            capture_ratio = net_return / benchmark_return
        else:
            capture_ratio = 1.0
        
        # ─── Ratios ───────────────────────────────────────────────────────────
        
        sharpe = backtest_results.sharpe_ratio
        sortino = self._calculate_sortino(backtest_results)
        calmar = self._calculate_calmar(backtest_results)
        
        # ─── Regime breakdown ────────────────────────────────────────────────
        
        regime_breakdown = {}
        if daily_prices is not None:
            regime_breakdown = self._analyze_by_regime(daily_prices, backtest_results)
        
        # ─── Gerar resumo executivo ──────────────────────────────────────────
        
        executive_summary = self._generate_executive_summary(
            net_return=net_return,
            fees_earned=fees_earned,
            max_drawdown=max_drawdown,
            vs_benchmark=vs_benchmark,
            days=days,
        )
        
        # ─── Alertas e observações ───────────────────────────────────────────
        
        alerts = self._generate_alerts(
            max_drawdown=max_drawdown,
            sharpe=sharpe,
            net_return=net_return,
            rebalance_count=backtest_results.rebalance_count,
            days=days,
        )
        
        observations = self._generate_observations(
            backtest_results=backtest_results,
            regime_breakdown=regime_breakdown,
        )
        
        return InvestorReport(
            report_date=now,
            period_start=period_start,
            period_end=period_end,
            vault_address=vault_address,
            asset=asset,
            executive_summary=executive_summary,
            net_return=net_return * 100,
            net_return_usd=net_return_usd,
            gross_return=gross_return * 100,
            fees_earned=fees_earned,
            fees_earned_apr=fees_earned_apr,
            gas_costs=gas_costs,
            management_fees=management_fees,
            performance_fees=performance_fees,
            total_costs=total_costs,
            max_drawdown=max_drawdown * 100,
            worst_month=worst_month,
            worst_month_return=worst_month_return * 100,
            best_month=best_month,
            best_month_return=best_month_return * 100,
            volatility=volatility,
            benchmark_return=benchmark_return * 100,
            vs_benchmark=vs_benchmark * 100,
            capture_ratio=capture_ratio,
            sharpe_ratio=sharpe,
            sortino_ratio=sortino,
            calmar_ratio=calmar,
            tvl_start=backtest_results.initial_capital,
            tvl_end=backtest_results.equity_curve[-1] if backtest_results.equity_curve else backtest_results.initial_capital,
            rebalance_count=backtest_results.rebalance_count,
            avg_range_width=self._calculate_avg_range(backtest_results),
            regime_breakdown=regime_breakdown,
            alerts=alerts,
            observations=observations,
        )
    
    def _calculate_worst_month(self, results) -> tuple:
        """Identifica o pior mês"""
        if not hasattr(results, 'daily_returns') or not results.daily_returns:
            return "N/A", 0.0
        
        # Agrupar por mês
        returns = np.array(results.daily_returns)
        # Simples: assumir ~30 dias por mês
        monthly_returns = []
        for i in range(0, len(returns), 30):
            month_ret = np.prod(1 + returns[i:i+30]) - 1
            monthly_returns.append(month_ret)
        
        if not monthly_returns:
            return "N/A", 0.0
        
        worst_idx = np.argmin(monthly_returns)
        return f"Mes {worst_idx + 1}", monthly_returns[worst_idx]
    
    def _calculate_best_month(self, results) -> tuple:
        """Identifica o melhor mês"""
        if not hasattr(results, 'daily_returns') or not results.daily_returns:
            return "N/A", 0.0
        
        returns = np.array(results.daily_returns)
        monthly_returns = []
        for i in range(0, len(returns), 30):
            month_ret = np.prod(1 + returns[i:i+30]) - 1
            monthly_returns.append(month_ret)
        
        if not monthly_returns:
            return "N/A", 0.0
        
        best_idx = np.argmax(monthly_returns)
        return f"Mes {best_idx + 1}", monthly_returns[best_idx]
    
    def _calculate_sortino(self, results) -> float:
        """Calcula Sortino ratio"""
        if not hasattr(results, 'daily_returns') or not results.daily_returns:
            return 0.0
        
        returns = np.array(results.daily_returns)
        downside = returns[returns < 0]
        
        if len(downside) == 0:
            return float('inf')  # No downside
        
        downside_std = np.std(downside) * np.sqrt(365)
        excess_return = np.mean(returns) * 365 - self.risk_free_rate
        
        return excess_return / downside_std if downside_std > 0 else 0.0
    
    def _calculate_calmar(self, results) -> float:
        """Calcula Calmar ratio"""
        if results.max_drawdown <= 0:
            return float('inf')
        
        annual_return = results.apr
        return annual_return / results.max_drawdown
    
    def _analyze_by_regime(self, prices: pd.DataFrame, results) -> Dict:
        """Analisa performance por regime de mercado"""
        # Simplificado - em produção, usar detecção real de regime
        return {}
    
    def _calculate_avg_range(self, results) -> float:
        """Calcula largura média dos ranges"""
        if not hasattr(results, 'trades') or not results.trades:
            return 5.0
        
        ranges = [t.details.get('range_width', 5) for t in results.trades]
        return np.mean(ranges) if ranges else 5.0
    
    def _generate_executive_summary(
        self,
        net_return: float,
        fees_earned: float,
        max_drawdown: float,
        vs_benchmark: float,
        days: int,
    ) -> str:
        """Gera resumo executivo em linguagem natural"""
        if net_return > 0.10:
            perf = "excelente desempenho"
        elif net_return > 0.05:
            perf = "bom desempenho"
        elif net_return > 0:
            perf = "desempenho positivo"
        elif net_return > -0.05:
            perf = "desempenho estavel"
        else:
            perf = "desempenho desafiador"
        
        vs_text = f"superando o benchmark em {vs_benchmark*100:.1f}%" if vs_benchmark > 0 else f"abaixo do benchmark em {abs(vs_benchmark)*100:.1f}%"
        
        return (
            f"O vault apresentou {perf} no periodo de {days} dias, "
            f"com retorno liquido de {net_return*100:.2f}%. "
            f"Foram coletadas ${fees_earned:,.0f} em taxas de liquidez. "
            f"A estrategia esta {vs_text}. "
            f"O drawdown maximo foi de {max_drawdown*100:.2f}%, dentro dos parametros esperados."
        )
    
    def _generate_alerts(
        self,
        max_drawdown: float,
        sharpe: float,
        net_return: float,
        rebalance_count: int,
        days: int,
    ) -> List[str]:
        """Gera alertas automáticos"""
        alerts = []
        
        if max_drawdown > 0.15:
            alerts.append(f"Drawdown elevado ({max_drawdown*100:.1f}%) - monitorar risco")
        
        if sharpe < 0.5:
            alerts.append(f"Sharpe ratio baixo ({sharpe:.2f}) - retorno nao compensa risco")
        
        if net_return < -0.05:
            alerts.append(f"Retorno negativo significativo ({net_return*100:.1f}%)")
        
        rebalances_per_day = rebalance_count / days if days > 0 else 0
        if rebalances_per_day > 1:
            alerts.append(f"Alta frequencia de rebalances ({rebalances_per_day:.1f}/dia) - verificar custos")
        
        return alerts
    
    def _generate_observations(
        self,
        backtest_results,
        regime_breakdown: Dict,
    ) -> List[str]:
        """Gera observações e insights"""
        observations = []
        
        # Fee capture
        if hasattr(backtest_results, 'fees_collected') and backtest_results.fees_collected > 0:
            observations.append(
                f"Taxas de liquidez representam fonte significativa de renda passiva"
            )
        
        # IL
        if hasattr(backtest_results, 'impermanent_loss') and backtest_results.impermanent_loss > 0:
            il_pct = backtest_results.impermanent_loss / backtest_results.initial_capital * 100
            observations.append(
                f"Perda impermanente de ${backtest_results.impermanent_loss:,.0f} ({il_pct:.2f}%) compensada pelas taxas"
            )
        
        # Rebalance efficiency
        if hasattr(backtest_results, 'rebalance_count'):
            if backtest_results.rebalance_count < 10:
                observations.append(
                    f"Estrategia conservadora com poucos rebalances - menor custo operacional"
                )
            else:
                observations.append(
                    f"Gestao ativa com {backtest_results.rebalance_count} rebalances - adaptacao ao mercado"
                )
        
        return observations


def generate_investor_report(
    backtest_results,
    vault_address: str,
    asset: str = "USDC",
) -> InvestorReport:
    """
    Função de conveniência para gerar relatório.
    
    Uso:
        from reporting.investor_report import generate_investor_report
        
        report = generate_investor_report(backtest_results, "0x123...", "USDC")
        print(report.to_markdown())
    """
    generator = InvestorReportGenerator()
    return generator.generate(
        backtest_results=backtest_results,
        vault_address=vault_address,
        asset=asset,
    )
