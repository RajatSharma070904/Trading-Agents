'use client';

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AgentNeuralCore3D from './components/AgentNeuralCore3D';
import Card3DTilt from './components/Card3DTilt';
import TacticalGauge3D from './components/TacticalGauge3D';
import LiveTickerTape3D from './components/LiveTickerTape3D';
import WatchlistHeatmap from './components/WatchlistHeatmap';

interface QuoteData {
  ticker: string;
  name: string;
  price?: number;
  currency?: string;
  change?: number;
  change_percent?: number;
  market_cap?: number;
  pe_ratio?: number;
  high_52?: number;
  low_52?: number;
  history?: Array<{ date: string; close: number }>;
}

interface SavedReport {
  filename: string;
  updated_at: string;
  size_bytes: number;
  summary_preview: string;
}

interface QuantData {
  ticker: string;
  current_price: number;
  composite_score: number;
  quantitative_rating: string;
  optimal_target: number;
  optimal_stop_loss: number;
  risk_reward_ratio: string;
  atr_14: number;
  technical_summary: {
    rsi_14?: number;
    macd?: number;
    macd_signal?: number;
    macd_hist?: number;
    ema_20?: number;
    sma_50?: number;
    sma_200?: number;
    trend?: string;
    golden_cross?: boolean;
    bollinger_upper?: number;
    bollinger_lower?: number;
    bollinger_pct_b?: number;
    annual_volatility_pct?: number;
  };
  fundamental_summary: {
    piotroski_f_score?: number;
    piotroski_rating?: string;
    piotroski_details?: string[];
    altman_z_score?: number;
    altman_zone?: string;
    pe_trailing?: number;
    pe_forward?: number;
    peg_ratio?: number;
    debt_to_equity?: number;
    roe_pct?: number;
    profit_margin_pct?: number;
    current_ratio?: number;
  };
}

interface PeerItem {
  ticker: string;
  name: string;
  price?: number;
  pe_ratio?: number;
  market_cap_b?: number;
  beta?: number;
  one_month_return_pct?: number;
  is_target: boolean;
}

interface PositionSizingResult {
  capital: number;
  entry_price: number;
  stop_loss: number;
  target_price: number;
  risk_per_trade_pct: number;
  dollar_risk_budget: number;
  recommended_shares: number;
  total_position_value: number;
  portfolio_allocation_pct: number;
  potential_profit: number;
  half_kelly_pct: number;
}

interface AnalysisResult {
  ticker: string;
  date: string;
  rating?: string;
  price_target?: string;
  stop_loss?: string;
  time_horizon?: string;
  executive_summary?: string;
  decision: string;
  quant_summary?: QuantData;
  indicators?: {
    rsi?: number;
    macd?: number;
    macd_hist?: number;
    ema10?: number;
    sma50?: number;
    sma200?: number;
    atr?: number;
    peg?: number;
    fwd_pe?: number;
    trailing_pe?: number;
    pb_ratio?: number;
    beta?: number;
    book_value?: number;
  };
  details: {
    technical?: string;
    fundamental?: string;
    sentiment?: string;
    investment_debate?: string;
    risk_analysis?: string;
    trader_plan?: string;
  };
  report_filename: string;
}

const POPULAR_TICKERS = [
  { label: 'Reliance', symbol: 'RELIANCE.NS' },
  { label: 'TCS', symbol: 'TCS.NS' },
  { label: 'Tata Steel', symbol: 'TATASTEEL.NS' },
  { label: 'HDFC Bank', symbol: 'HDFCBANK.NS' },
  { label: 'Nvidia', symbol: 'NVDA' },
  { label: 'Apple', symbol: 'AAPL' },
  { label: 'Tesla', symbol: 'TSLA' },
  { label: 'Palantir', symbol: 'PLTR' },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export default function Home() {
  const [ticker, setTicker] = useState('RELIANCE.NS');
  const [analysisDate, setAnalysisDate] = useState('2026-10-20');
  const [forceFresh, setForceFresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeJobStage, setActiveJobStage] = useState('initializing');
  const [jobStageLabel, setJobStageLabel] = useState('Initializing multi-agent graph...');
  const [jobProgressPct, setJobProgressPct] = useState(10);
  const [show3DCore, setShow3DCore] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [quantData, setQuantData] = useState<QuantData | null>(null);
  const [peers, setPeers] = useState<PeerItem[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Position Sizing Calculator State
  const [calcCapital, setCalcCapital] = useState(100000);
  const [calcRiskPct, setCalcRiskPct] = useState(1.5);
  const [calcEntry, setCalcEntry] = useState(1200);
  const [calcStopLoss, setCalcStopLoss] = useState(1150);
  const [calcTarget, setCalcTarget] = useState(1320);
  const [sizingResult, setSizingResult] = useState<PositionSizingResult | null>(null);

  const [activeTab, setActiveTab] = useState<'verdict' | 'screener' | 'quant' | 'sizing' | 'peers' | 'technical' | 'fundamental' | 'debate' | 'risk' | 'history'>('verdict');
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [viewingReportContent, setViewingReportContent] = useState<{ name: string; text: string } | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ date: string; close: number; x: number; y: number } | null>(null);
  const [copiedDossier, setCopiedDossier] = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

  // Initialize theme from localStorage or default to light
  useEffect(() => {
    try {
      const saved = localStorage.getItem('alphaswarm_theme') as 'light' | 'dark' | null;
      const initial = saved || 'light';
      setTheme(initial);
      document.documentElement.setAttribute('data-theme', initial);
    } catch {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, []);

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('alphaswarm_theme', next);
    } catch {
      // Ignore
    }
  }

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch(`${API_BASE}/api/status`);
        setBackendOnline(res.ok);
      } catch {
        setBackendOnline(false);
      }
    }
    checkHealth();
    fetchReports();
    autoLoadInitialReport();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  async function autoLoadInitialReport() {
    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: 'RELIANCE.NS', date: '2026-10-20', force_fresh: false }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        if (data.quant_summary) setQuantData(data.quant_summary);
      }
    } catch {
      // Ignore
    }
  }

  useEffect(() => {
    if (!ticker.trim()) return;
    const timeout = setTimeout(() => {
      fetchQuote(ticker.trim());
      fetchQuant(ticker.trim());
      fetchPeers(ticker.trim());
    }, 400);
    return () => clearTimeout(timeout);
  }, [ticker]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [loading]);

  async function fetchQuote(symbol: string) {
    try {
      const res = await fetch(`${API_BASE}/api/quote/${encodeURIComponent(symbol)}`);
      if (res.ok) {
        const data = await res.json();
        setQuote(data);
        if (data.price) {
          setCalcEntry(data.price);
        }
      }
    } catch {
      // Ignore
    }
  }

  async function fetchQuant(symbol: string) {
    try {
      const res = await fetch(`${API_BASE}/api/quant/${encodeURIComponent(symbol)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setQuantData(json.data);
          if (json.data.optimal_stop_loss) setCalcStopLoss(json.data.optimal_stop_loss);
          if (json.data.optimal_target) setCalcTarget(json.data.optimal_target);
        }
      }
    } catch {
      // Ignore
    }
  }

  async function fetchPeers(symbol: string) {
    try {
      const res = await fetch(`${API_BASE}/api/peers/${encodeURIComponent(symbol)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.peers) setPeers(json.peers);
      }
    } catch {
      // Ignore
    }
  }

  async function fetchReports() {
    try {
      const res = await fetch(`${API_BASE}/api/reports`);
      if (res.ok) {
        const data = await res.json();
        setSavedReports(data.reports || []);
      }
    } catch {
      // Ignore
    }
  }

  // Position sizing calculation
  useEffect(() => {
    async function calculateSizing() {
      try {
        const res = await fetch(`${API_BASE}/api/position-size`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            capital: calcCapital,
            entry_price: calcEntry,
            stop_loss: calcStopLoss,
            target_price: calcTarget,
            risk_pct: calcRiskPct,
            win_rate: 0.55,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          setSizingResult(json.data);
        }
      } catch {
        // Ignore
      }
    }
    calculateSizing();
  }, [calcCapital, calcEntry, calcStopLoss, calcTarget, calcRiskPct]);

  async function handleAnalyze(e?: React.FormEvent, overrideTicker?: string) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const targetSymbol = (overrideTicker || ticker).trim().toUpperCase();
    if (!targetSymbol) return;

    setTicker(targetSymbol);
    setLoading(true);
    setError(null);
    setActiveJobStage('initializing');
    setJobStageLabel('Initiating multi-agent graph with deterministic quantitative engine...');
    setJobProgressPct(10);

    try {
      const startRes = await fetch(`${API_BASE}/api/analyze/async`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: targetSymbol,
          date: analysisDate,
          force_fresh: forceFresh,
        }),
      });

      if (!startRes.ok) {
        const errData = await startRes.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errData.detail || 'Failed to start analysis job.');
      }

      const { job_id } = await startRes.json();

      const pollInterval = setInterval(async () => {
        try {
          const pollRes = await fetch(`${API_BASE}/api/analyze/job/${job_id}`);
          if (!pollRes.ok) return;

          const jobData = await pollRes.json();
          setActiveJobStage(jobData.stage);
          setJobStageLabel(jobData.stage_label);
          setJobProgressPct(jobData.progress_pct || 50);

          if (jobData.status === 'completed' && jobData.result) {
            clearInterval(pollInterval);
            setResult(jobData.result);
            if (jobData.result.quant_summary) {
              setQuantData(jobData.result.quant_summary);
            }
            setActiveTab('verdict');
            setLoading(false);
            fetchReports();
            setTimeout(() => {
              resultsRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 150);
          } else if (jobData.status === 'error') {
            clearInterval(pollInterval);
            setError(jobData.error || 'Multi-agent analysis encountered an error.');
            setLoading(false);
          }
        } catch {
          // Keep polling
        }
      }, 1200);

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Error communicating with backend server.');
      }
      setLoading(false);
    }
  }

  async function loadReportContent(fname: string) {
    try {
      const res = await fetch(`${API_BASE}/api/reports/${encodeURIComponent(fname)}`);
      if (res.ok) {
        const data = await res.json();
        setViewingReportContent({ name: fname, text: data.content });
      }
    } catch {
      // Ignore
    }
  }

  function copyMarkdownDossier() {
    if (!result) return;
    const reportText = `# AlphaSwarm AI Institutional Report: ${result.ticker} (${result.date})
Recommendation: ${result.rating}
Price Target: ${result.price_target}
Stop Loss: ${result.stop_loss}
Time Horizon: ${result.time_horizon}

## Executive Summary
${result.executive_summary}

## Full Agent Consensus
${result.decision}
`;
    navigator.clipboard.writeText(reportText);
    setCopiedDossier(true);
    setTimeout(() => setCopiedDossier(false), 2500);
  }

  const ratingText = (result?.rating || result?.decision || quantData?.quantitative_rating || '').toUpperCase();
  const isBuy = /BUY|OVERWEIGHT|OUTPERFORM|LONG|ACCUMULATE|BULLISH/i.test(ratingText);
  const isSell = /SELL|UNDERWEIGHT|UNDERPERFORM|SHORT|REDUCE|BEARISH/i.test(ratingText);
  const actionBadge = isBuy ? 'BUY / ACCUMULATE' : isSell ? 'SELL / REDUCE' : 'HOLD / NEUTRAL';

  const historyData = quote?.history || [];
  const chartWidth = 680;
  const chartHeight = 210;
  const padding = 20;

  const prices = historyData.map((d) => d.close);
  const targetNum = Number(result?.price_target || quantData?.optimal_target || 0);
  const stopLossNum = Number(result?.stop_loss || quantData?.optimal_stop_loss || 0);

  const allVals = [...prices];
  if (targetNum > 0) allVals.push(targetNum);
  if (stopLossNum > 0) allVals.push(stopLossNum);

  const minPrice = allVals.length ? Math.min(...allVals) * 0.98 : 0;
  const maxPrice = allVals.length ? Math.max(...allVals) * 1.02 : 100;
  const priceRange = maxPrice - minPrice || 1;

  const points = historyData.map((d, i) => {
    const x = padding + (i / Math.max(historyData.length - 1, 1)) * (chartWidth - padding * 2);
    const y = chartHeight - padding - ((d.close - minPrice) / priceRange) * (chartHeight - padding * 2);
    return { ...d, x, y };
  });

  const targetY = targetNum > 0
    ? chartHeight - padding - ((targetNum - minPrice) / priceRange) * (chartHeight - padding * 2)
    : null;

  const stopLossY = stopLossNum > 0
    ? chartHeight - padding - ((stopLossNum - minPrice) / priceRange) * (chartHeight - padding * 2)
    : null;

  const linePath = points.length
    ? `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')
    : '';

  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight} L ${points[0].x} ${chartHeight} Z`
    : '';

  return (
    <>
      {/* 3D Top Live Market Ticker Tape */}
      <LiveTickerTape3D />

      {/* Sticky Institutional Glass Navigation Bar */}
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--bg-surface)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '12px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        flexWrap: 'wrap',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #2563eb, #0284c7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(37, 99, 235, 0.35)',
          }}>
            <span style={{ fontSize: '18px', color: '#fff' }}>⚡</span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '17px', fontWeight: 900, letterSpacing: '-0.3px', color: 'var(--text-main)' }}>
                AlphaSwarm AI
              </span>
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'var(--accent-cyan-bg)',
                color: 'var(--accent-primary)',
                fontWeight: 800,
                border: '1px solid var(--border-accent)',
                letterSpacing: '0.4px'
              }}>
                PRO TERMINAL
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Autonomous Multi-Agent Swarm &amp; Quantitative Engine
            </div>
          </div>
        </div>

        {/* Status Indicators, 3D Toggle & Light/Dark Theme Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Premium Segmented Theme Switcher */}
          <div
            onClick={toggleTheme}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleTheme(); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '24px',
              padding: '3px',
              cursor: 'pointer',
              userSelect: 'none',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.2s ease',
            }}
            title={`Active: ${theme === 'light' ? 'Light Mode' : 'Dark Mode'}. Click to switch.`}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 11px',
              borderRadius: '18px',
              fontSize: '11.5px',
              fontWeight: 700,
              background: theme === 'light' ? 'var(--bg-surface)' : 'transparent',
              color: theme === 'light' ? 'var(--accent-primary)' : 'var(--text-muted)',
              boxShadow: theme === 'light' ? '0 1px 4px rgba(15, 23, 42, 0.08)' : 'none',
              border: theme === 'light' ? '1px solid var(--border-subtle)' : '1px solid transparent',
              transition: 'all 0.2s ease',
            }}>
              <span>☀️</span> Light
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 11px',
              borderRadius: '18px',
              fontSize: '11.5px',
              fontWeight: 700,
              background: theme === 'dark' ? 'var(--accent-primary)' : 'transparent',
              color: theme === 'dark' ? '#070a12' : 'var(--text-muted)',
              boxShadow: theme === 'dark' ? '0 2px 8px rgba(56, 189, 248, 0.3)' : 'none',
              border: theme === 'dark' ? '1px solid var(--border-glow)' : '1px solid transparent',
              transition: 'all 0.2s ease',
            }}>
              <span>🌙</span> Dark
            </div>
          </div>

          <button
            onClick={() => setShow3DCore(!show3DCore)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: show3DCore ? 'var(--accent-cyan-bg)' : 'var(--bg-secondary)',
              border: show3DCore ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
              color: show3DCore ? 'var(--accent-primary)' : 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>🌐</span> {show3DCore ? '3D Active' : 'Show 3D'}
          </button>

          <div style={{
            padding: '6px 10px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11.5px'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>Engine:</span>
            <strong style={{ color: 'var(--accent-primary)' }}>Gemini Flash</strong>
          </div>

          <div style={{
            padding: '6px 10px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11.5px'
          }}>
            <span className="pulse-dot" style={{ backgroundColor: backendOnline ? 'var(--bull-green)' : 'var(--bear-red)', boxShadow: backendOnline ? '0 0 8px var(--bull-green)' : '0 0 8px var(--bear-red)' }} />
            <span style={{ color: backendOnline ? 'var(--bull-green)' : 'var(--bear-red)', fontWeight: 700 }}>
              {backendOnline === null ? 'Connecting...' : backendOnline ? 'Port 8000 Online' : 'Backend Offline'}
            </span>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 24px 80px' }}>
        {/* 3D Neural Swarm Interactive Canvas */}
        {show3DCore && (
          <section style={{ marginBottom: '22px' }}>
            <AgentNeuralCore3D
              activeStage={activeJobStage}
              verdictRating={result?.rating || 'BUY'}
              theme={theme}
              onSelectAgent={(agentId) => {
                if (agentId === 'quant_engine') setActiveTab('quant');
                else if (agentId === 'analysts_gathering') setActiveTab('technical');
                else if (agentId === 'bull_bear_debate') setActiveTab('debate');
                else if (agentId === 'risk_management') setActiveTab('risk');
                else setActiveTab('verdict');
              }}
            />
          </section>
        )}

        {/* Master Command & Execution Bar */}
        <Card3DTilt glowColor="var(--accent-blue-glow)" style={{ padding: '20px 22px', marginBottom: '22px' }}>
          <form onSubmit={handleAnalyze} style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) minmax(160px, 1.2fr) minmax(180px, 1.2fr) minmax(200px, 1.5fr)', gap: '14px', alignItems: 'flex-end' }}>
            {/* Ticker Input */}
            <div>
              <label htmlFor="ticker-input" style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                Asset Ticker (NSE / US / Megacap)
              </label>
              <input
                id="ticker-input"
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value)}
                placeholder="e.g. RELIANCE.NS, TCS.NS, NVDA"
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                  fontSize: '14.5px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  textTransform: 'uppercase'
                }}
              />
            </div>

            {/* Analysis Date */}
            <div>
              <label htmlFor="date-input" style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                Anchor Date
              </label>
              <input
                id="date-input"
                type="date"
                value={analysisDate}
                onChange={(e) => setAnalysisDate(e.target.value)}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 12px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                  fontSize: '13.5px',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>

            {/* Bypass Cache Toggle */}
            <div style={{
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 12px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px'
            }}>
              <input
                id="force-fresh"
                type="checkbox"
                checked={forceFresh}
                onChange={(e) => setForceFresh(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
              <label htmlFor="force-fresh" style={{ fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none', fontWeight: 600 }}>
                Bypass Cache (Fresh)
              </label>
            </div>

            {/* Deploy CTA */}
            <div>
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  height: '44px',
                  padding: '0 18px',
                  background: loading ? 'var(--border-medium)' : 'var(--accent-primary)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '13.5px',
                  borderRadius: '6px',
                  boxShadow: loading ? 'none' : '0 2px 12px rgba(37, 99, 235, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  letterSpacing: '0.2px'
                }}
              >
                {loading ? (
                  <>
                    <span className="spinning">⚡</span>
                    Deliberating ({elapsedSeconds}s)...
                  </>
                ) : (
                  <>
                    <span>🚀</span> Deploy Multi-Agent Swarm
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Tickers & Radar Toggle Row */}
          <div style={{
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10.5px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>
                Quick Universe:
              </span>
              {POPULAR_TICKERS.map((t) => (
                <button
                  key={t.symbol}
                  onClick={() => {
                    setTicker(t.symbol);
                    fetchQuote(t.symbol);
                    fetchQuant(t.symbol);
                  }}
                  style={{
                    background: ticker === t.symbol ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: ticker === t.symbol ? '#ffffff' : 'var(--text-secondary)',
                    border: ticker === t.symbol ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    padding: '3px 10px',
                    borderRadius: '4px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowHeatmap(!showHeatmap)}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                background: showHeatmap ? 'var(--accent-cyan-bg)' : 'var(--bg-secondary)',
                border: showHeatmap ? '1px solid var(--border-accent)' : '1px solid var(--border-subtle)',
                color: showHeatmap ? 'var(--accent-primary)' : 'var(--text-muted)',
                fontSize: '11.5px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>⚡</span> {showHeatmap ? 'Hide Market Heatmap' : 'Show Market Heatmap & Radar'}
            </button>
          </div>

          {loading && (
            <div style={{ marginTop: '14px', padding: '10px 14px', background: 'var(--accent-cyan-bg)', borderRadius: '6px', borderLeft: '3px solid var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="spinning" style={{ fontSize: '16px' }}>⚙️</span>
              <div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-main)', fontWeight: 600 }}>{jobStageLabel}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Progress: {jobProgressPct}% | 6 Agent Threads Deliberating</div>
              </div>
            </div>
          )}
        </Card3DTilt>

        {/* Real-time Market Watchlist & Swarm Heatmap */}
        {showHeatmap && (
          <WatchlistHeatmap
            apiBase={API_BASE}
            currentTicker={ticker}
            onSelectTicker={(newTicker) => {
              setTicker(newTicker);
              fetchQuote(newTicker);
              fetchQuant(newTicker);
              fetchPeers(newTicker);
            }}
            onAnalyzeTicker={(newTicker) => {
              handleAnalyze(undefined, newTicker);
            }}
          />
        )}

        {error && (
          <div style={{ padding: '12px 16px', background: 'var(--bear-red-bg)', border: '1px solid var(--bear-red-border)', borderRadius: '8px', color: 'var(--bear-red)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <div>
              <strong>Analysis Alert:</strong> {error}
            </div>
          </div>
        )}

        {/* Dual-Wing Tactical Cockpit: (Left: Market Action & Chart, Right: Swarm Consensus & Conviction) */}
        {quote && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: result ? 'minmax(0, 1.25fr) minmax(0, 1fr)' : '1fr',
            gap: '18px',
            marginBottom: '24px',
            alignItems: 'stretch'
          }}>
            {/* Left Wing: Price Action, Key Multiples & Interactive SVG Chart */}
            <Card3DTilt glowColor="var(--accent-blue-glow)" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                      <h2 style={{ fontSize: '28px', fontWeight: 900, fontFamily: 'var(--font-mono)', letterSpacing: '-0.5px', color: 'var(--text-main)' }}>
                        {quote.currency === 'INR' ? '₹' : '$'}{quote.price?.toLocaleString() || '---'}
                      </h2>
                      {quote.change !== undefined && (
                        <span style={{
                          fontSize: '13.5px',
                          fontWeight: 800,
                          color: (quote.change >= 0) ? 'var(--bull-green)' : 'var(--bear-red)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontFamily: 'var(--font-mono)'
                        }}>
                          {quote.change >= 0 ? '▲ +' : '▼ '}{quote.change} ({quote.change_percent}%)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>
                      {quote.name} ({quote.ticker})
                    </div>
                  </div>

                  {/* Valuation Stats */}
                  <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>52W Range</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                        {quote.low_52} - {quote.high_52}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>P/E Multiple</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                        {quote.pe_ratio || 'N/A'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Market Cap</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                        {quote.market_cap ? `${(quote.market_cap / 1e9).toFixed(1)}B` : '---'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* SVG Chart with Target and Stop Loss reference lines */}
                {historyData.length > 0 && (
                  <div style={{ position: 'relative', width: '100%', height: `${chartHeight}px`, overflow: 'hidden', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
                      <defs>
                        <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      <path d={areaPath} fill="url(#chartGradient)" />
                      <path d={linePath} fill="none" stroke="var(--accent-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

                      {/* Target Price Line */}
                      {targetY !== null && targetY >= 0 && targetY <= chartHeight && (
                        <g>
                          <line x1="0" y1={targetY} x2={chartWidth} y2={targetY} stroke="var(--bull-green)" strokeWidth="1.5" strokeDasharray="4 4" />
                          <text x={chartWidth - 10} y={targetY - 5} fill="var(--bull-green)" fontSize="10" textAnchor="end" fontWeight="800">
                            Target: {targetNum}
                          </text>
                        </g>
                      )}

                      {/* Stop Loss Line */}
                      {stopLossY !== null && stopLossY >= 0 && stopLossY <= chartHeight && (
                        <g>
                          <line x1="0" y1={stopLossY} x2={chartWidth} y2={stopLossY} stroke="var(--bear-red)" strokeWidth="1.5" strokeDasharray="4 4" />
                          <text x={chartWidth - 10} y={stopLossY + 12} fill="var(--bear-red)" fontSize="10" textAnchor="end" fontWeight="800">
                            Stop Loss: {stopLossNum}
                          </text>
                        </g>
                      )}

                      {hoveredPoint && (
                        <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="5" fill="var(--accent-primary)" stroke="var(--bg-surface)" strokeWidth="2" />
                      )}
                    </svg>

                    <div
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'crosshair' }}
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const relX = ((e.clientX - rect.left) / rect.width) * chartWidth;
                        let closest = points[0];
                        let minDiff = Infinity;
                        for (const pt of points) {
                          const diff = Math.abs(pt.x - relX);
                          if (diff < minDiff) {
                            minDiff = diff;
                            closest = pt;
                          }
                        }
                        if (closest) setHoveredPoint(closest);
                      }}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />

                    {hoveredPoint && (
                      <div style={{
                        position: 'absolute',
                        top: '10px',
                        left: '10px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-medium)',
                        boxShadow: 'var(--shadow-card)',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-main)',
                        pointerEvents: 'none'
                      }}>
                        <span>{hoveredPoint.date}: </span>
                        <strong style={{ color: 'var(--accent-primary)' }}>{quote.currency === 'INR' ? '₹' : '$'}{hoveredPoint.close}</strong>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card3DTilt>

            {/* Right Wing: Swarm Consensus Verdict & Conviction Meter */}
            {result && (
              <Card3DTilt
                glowColor={isBuy ? 'var(--bull-green-glow)' : isSell ? 'var(--bear-red-glow)' : 'var(--hold-amber-glow)'}
                style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{
                      padding: '3px 12px',
                      borderRadius: '20px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      letterSpacing: '0.5px',
                      background: isBuy ? 'var(--bull-green-bg)' : isSell ? 'var(--bear-red-bg)' : 'var(--hold-amber-bg)',
                      border: `1px solid ${isBuy ? 'var(--bull-green-border)' : isSell ? 'var(--bear-red-border)' : 'var(--hold-amber-border)'}`,
                      color: isBuy ? 'var(--bull-green)' : isSell ? 'var(--bear-red)' : 'var(--hold-amber)'
                    }}>
                      {actionBadge}
                    </span>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      As of <strong>{result.date}</strong> | Consensus
                    </span>
                  </div>

                  <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
                    {result.rating || 'Consensus Formulated'}
                  </h3>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {result.executive_summary}
                  </p>

                  {/* Tactical Conviction Speedometer & Target Cards */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(140px, 1.2fr) minmax(180px, 1.5fr)',
                    gap: '12px',
                    alignItems: 'center',
                    background: 'var(--bg-secondary)',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-subtle)',
                    marginBottom: '14px'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <TacticalGauge3D
                        score={quantData?.composite_score ?? (isBuy ? 55 : isSell ? -55 : 0)}
                        ratingText={result.rating || 'HOLD'}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: 'var(--bull-green-bg)', border: '1px solid var(--bull-green-border)', borderRadius: '4px' }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--bull-green)', fontWeight: 800 }}>TARGET:</span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--bull-green)', fontFamily: 'var(--font-mono)' }}>
                          {result.price_target || quantData?.optimal_target || '---'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: 'var(--bear-red-bg)', border: '1px solid var(--bear-red-border)', borderRadius: '4px' }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--bear-red)', fontWeight: 800 }}>STOP LOSS:</span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--bear-red)', fontFamily: 'var(--font-mono)' }}>
                          {result.stop_loss || quantData?.optimal_stop_loss || '---'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 6px', fontSize: '10.5px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        <span>R:R {quantData?.risk_reward_ratio || '1 : 2.0'}</span>
                        <span>Horizon: {result.time_horizon || '3-6 Mo'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={copyMarkdownDossier}
                    style={{
                      flex: 1,
                      padding: '7px 12px',
                      borderRadius: '6px',
                      background: 'var(--accent-cyan-bg)',
                      border: '1px solid var(--border-accent)',
                      color: 'var(--accent-primary)',
                      fontSize: '12px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>📋</span> {copiedDossier ? 'Copied Dossier!' : 'Copy Dossier'}
                  </button>
                  <button
                    onClick={() => window.print()}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '6px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>🖨️</span> PDF
                  </button>
                </div>
              </Card3DTilt>
            )}
          </div>
        )}

        {/* Detailed Multi-Agent Dossier Navigation Tabs */}
        {result && (
          <div ref={resultsRef} style={{ marginTop: '8px' }}>
            <div style={{
              display: 'flex',
              gap: '4px',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '18px',
              overflowX: 'auto',
              paddingBottom: '2px'
            }}>
              {[
                { id: 'verdict', label: '🏆 Final Verdict' },
                { id: 'screener', label: '⚡ Swarm Radar' },
                { id: 'quant', label: '🔢 Quant Matrix' },
                { id: 'sizing', label: '📐 Position Sizing' },
                { id: 'peers', label: '👥 Peer Benchmarks' },
                { id: 'technical', label: '📊 Market Technicals' },
                { id: 'fundamental', label: '💼 Fundamentals' },
                { id: 'debate', label: '⚔️ Bull vs Bear' },
                { id: 'risk', label: '🛡️ Risk Defense' },
                { id: 'history', label: '📁 Saved Reports' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    padding: '8px 14px',
                    fontSize: '12.5px',
                    fontWeight: activeTab === tab.id ? 800 : 500,
                    color: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--text-muted)',
                    borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    background: activeTab === tab.id ? 'var(--accent-cyan-bg)' : 'transparent',
                    borderRadius: '4px 4px 0 0',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab: Swarm Screener & Heatmap */}
            {activeTab === 'screener' && (
              <WatchlistHeatmap
                apiBase={API_BASE}
                currentTicker={ticker}
                onSelectTicker={(newTicker) => {
                  setTicker(newTicker);
                  fetchQuote(newTicker);
                  fetchQuant(newTicker);
                  fetchPeers(newTicker);
                }}
                onAnalyzeTicker={(newTicker) => {
                  handleAnalyze(undefined, newTicker);
                }}
              />
            )}

            {/* Tab 1: Verdict & Full Decision */}
            {activeTab === 'verdict' && (
              <Card3DTilt style={{ padding: '24px' }}>
                <div className="pro-report">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.decision || 'No final decision content recorded.'}
                  </ReactMarkdown>
                </div>
              </Card3DTilt>
            )}

            {/* Tab 2: Deterministic Quant Matrix */}
            {activeTab === 'quant' && quantData && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                <Card3DTilt glowColor="var(--bull-green-glow)" style={{ padding: '22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>Piotroski F-Score</h3>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '10px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      background: (quantData.fundamental_summary.piotroski_f_score || 0) >= 7 ? 'var(--bull-green-bg)' : 'var(--hold-amber-bg)',
                      border: `1px solid ${(quantData.fundamental_summary.piotroski_f_score || 0) >= 7 ? 'var(--bull-green-border)' : 'var(--hold-amber-border)'}`,
                      color: (quantData.fundamental_summary.piotroski_f_score || 0) >= 7 ? 'var(--bull-green)' : 'var(--hold-amber)',
                    }}>
                      {quantData.fundamental_summary.piotroski_f_score} / 9 ({quantData.fundamental_summary.piotroski_rating})
                    </span>
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Measures operating efficiency, cash conversion quality, and balance sheet resilience. Scores 7-9 indicate stellar quality.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {(quantData.fundamental_summary.piotroski_details || []).map((detail, idx) => (
                      <div key={idx} style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ color: 'var(--bull-green)' }}>✓</span> {detail}
                      </div>
                    ))}
                  </div>
                </Card3DTilt>

                <Card3DTilt glowColor="var(--accent-blue-glow)" style={{ padding: '22px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)' }}>Altman Z-Score</h3>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '10px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      background: (quantData.fundamental_summary.altman_z_score || 0) >= 2.99 ? 'var(--bull-green-bg)' : 'var(--bear-red-bg)',
                      border: `1px solid ${(quantData.fundamental_summary.altman_z_score || 0) >= 2.99 ? 'var(--bull-green-border)' : 'var(--bear-red-border)'}`,
                      color: (quantData.fundamental_summary.altman_z_score || 0) >= 2.99 ? 'var(--bull-green)' : 'var(--bear-red)',
                    }}>
                      {quantData.fundamental_summary.altman_z_score}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '6px' }}>
                    {quantData.fundamental_summary.altman_zone}
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                    Evaluates likelihood of corporate distress and bankruptcy. Values &gt; 2.99 reflect strong solvency protection.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    <div style={{ padding: '8px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>Debt-to-Equity</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>{quantData.fundamental_summary.debt_to_equity || '---'}</div>
                    </div>
                    <div style={{ padding: '8px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>Current Ratio</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>{quantData.fundamental_summary.current_ratio || '---'}</div>
                    </div>
                    <div style={{ padding: '8px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>ROE</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>{quantData.fundamental_summary.roe_pct}%</div>
                    </div>
                    <div style={{ padding: '8px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>Profit Margin</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>{quantData.fundamental_summary.profit_margin_pct}%</div>
                    </div>
                  </div>
                </Card3DTilt>

                <Card3DTilt glowColor="var(--accent-blue-glow)" style={{ padding: '22px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '12px' }}>Technical Signal Radar</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>RSI (14-Day)</div>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: (quantData.technical_summary.rsi_14 || 50) > 70 ? 'var(--bear-red)' : (quantData.technical_summary.rsi_14 || 50) < 30 ? 'var(--bull-green)' : 'var(--accent-primary)' }}>
                        {quantData.technical_summary.rsi_14}
                      </div>
                    </div>
                    <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>Trend Alignment</div>
                      <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--accent-primary)' }}>
                        {quantData.technical_summary.trend || 'Consolidating'}
                      </div>
                    </div>
                    <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>Golden Cross</div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: quantData.technical_summary.golden_cross ? 'var(--bull-green)' : 'var(--hold-amber)' }}>
                        {quantData.technical_summary.golden_cross ? 'Bullish (50>200)' : 'Neutral / Below'}
                      </div>
                    </div>
                    <div style={{ padding: '10px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-dim)' }}>Annual Volatility</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-main)' }}>
                        {quantData.technical_summary.annual_volatility_pct}%
                      </div>
                    </div>
                  </div>
                </Card3DTilt>
              </div>
            )}

            {/* Tab 3: Interactive Position Sizing */}
            {activeTab === 'sizing' && (
              <Card3DTilt style={{ padding: '24px' }}>
                <div style={{ maxWidth: '860px', margin: '0 auto' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '6px', color: 'var(--text-main)' }}>
                    📐 Position Sizing &amp; Kelly Criterion Allocation Calculator
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                    Calculates exact shares, dollar risk limits, and Half-Kelly allocation percentage based on stop distance and ATR volatility.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                        TOTAL ACCOUNT CAPITAL
                      </label>
                      <input
                        type="number"
                        value={calcCapital}
                        onChange={(e) => setCalcCapital(Number(e.target.value))}
                        style={{ width: '100%', height: '40px', padding: '0 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '14px', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                        MAX RISK PER TRADE (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={calcRiskPct}
                        onChange={(e) => setCalcRiskPct(Number(e.target.value))}
                        style={{ width: '100%', height: '40px', padding: '0 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '14px', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                        ENTRY PRICE
                      </label>
                      <input
                        type="number"
                        value={calcEntry}
                        onChange={(e) => setCalcEntry(Number(e.target.value))}
                        style={{ width: '100%', height: '40px', padding: '0 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '14px', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                        STOP LOSS
                      </label>
                      <input
                        type="number"
                        value={calcStopLoss}
                        onChange={(e) => setCalcStopLoss(Number(e.target.value))}
                        style={{ width: '100%', height: '40px', padding: '0 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '14px', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '5px' }}>
                        TARGET PRICE
                      </label>
                      <input
                        type="number"
                        value={calcTarget}
                        onChange={(e) => setCalcTarget(Number(e.target.value))}
                        style={{ width: '100%', height: '40px', padding: '0 10px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '14px', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                  </div>

                  {sizingResult && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', fontWeight: 700 }}>RECOMMENDED SHARES</div>
                        <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>
                          {sizingResult.recommended_shares.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', fontWeight: 700 }}>MAX DOLLAR RISK</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--bear-red)', fontFamily: 'var(--font-mono)' }}>
                          ${sizingResult.dollar_risk_budget.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', fontWeight: 700 }}>TOTAL POSITION VALUE</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                          ${sizingResult.total_position_value.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', fontWeight: 700 }}>HALF-KELLY ALLOCATION</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--bull-green)', fontFamily: 'var(--font-mono)' }}>
                          {sizingResult.half_kelly_pct}%
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card3DTilt>
            )}

            {/* Tab 4: Peer Benchmarks */}
            {activeTab === 'peers' && (
              <Card3DTilt style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 800, marginBottom: '4px', color: 'var(--text-main)' }}>Sector Peer Comparison &amp; Relative Multiples</h3>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Evaluates target asset against direct sector competitors across valuation multiples, 1-month momentum, and market cap.
                </p>

                {peers.length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="peer-table">
                      <thead>
                        <tr>
                          <th>Instrument</th>
                          <th>Price</th>
                          <th>P/E Multiple</th>
                          <th>1-Month Return</th>
                          <th>Market Cap</th>
                          <th>Beta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {peers.map((p) => (
                          <tr key={p.ticker} className={p.is_target ? 'target-row' : ''}>
                            <td>
                              <strong>{p.ticker}</strong> {p.is_target && <span style={{ fontSize: '9.5px', background: 'var(--accent-primary)', color: '#fff', padding: '1px 5px', borderRadius: '3px', marginLeft: '6px', fontWeight: 800 }}>TARGET</span>}
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{p.name}</div>
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>${p.price || '---'}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{p.pe_ratio || 'N/A'}</td>
                            <td style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              color: (p.one_month_return_pct || 0) >= 0 ? 'var(--bull-green)' : 'var(--bear-red)'
                            }}>
                              {(p.one_month_return_pct || 0) >= 0 ? '+' : ''}{p.one_month_return_pct}%
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>${p.market_cap_b}B</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{p.beta || '1.0'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                    Loading sector peers for {ticker}...
                  </div>
                )}
              </Card3DTilt>
            )}

            {/* Tab 5: Technical Analyst Report */}
            {activeTab === 'technical' && (
              <Card3DTilt style={{ padding: '24px' }}>
                <div className="pro-report">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.details.technical || 'No technical report generated.'}
                  </ReactMarkdown>
                </div>
              </Card3DTilt>
            )}

            {/* Tab 6: Fundamental Analyst Report */}
            {activeTab === 'fundamental' && (
              <Card3DTilt style={{ padding: '24px' }}>
                <div className="pro-report">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.details.fundamental || 'No fundamental report generated.'}
                  </ReactMarkdown>
                </div>
              </Card3DTilt>
            )}

            {/* Tab 7: Bull vs Bear Debate */}
            {activeTab === 'debate' && (
              <Card3DTilt style={{ padding: '24px' }}>
                <div className="pro-report">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.details.investment_debate || 'No debate transcript recorded.'}
                  </ReactMarkdown>
                </div>
              </Card3DTilt>
            )}

            {/* Tab 8: Risk Defense */}
            {activeTab === 'risk' && (
              <Card3DTilt style={{ padding: '24px' }}>
                <div className="pro-report">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.details.risk_analysis || 'No risk evaluation recorded.'}
                  </ReactMarkdown>
                </div>
              </Card3DTilt>
            )}

            {/* Tab 9: Saved Historical Reports */}
            {activeTab === 'history' && (
              <Card3DTilt style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '17px', fontWeight: 800, marginBottom: '14px', color: 'var(--text-main)' }}>Historical Run Records</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {savedReports.map((r) => (
                    <div
                      key={r.filename}
                      onClick={() => loadReportContent(r.filename)}
                      style={{
                        padding: '12px 16px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div>
                        <strong style={{ color: 'var(--accent-primary)' }}>{r.filename}</strong>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '2px' }}>
                          Saved: {r.updated_at} | {(r.size_bytes / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>View &gt;</span>
                    </div>
                  ))}
                </div>
              </Card3DTilt>
            )}
          </div>
        )}

        {/* Modal for viewing historical report text */}
        {viewingReportContent && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '24px'
          }}>
            <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', padding: '22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--accent-primary)' }}>{viewingReportContent.name}</h3>
                <button
                  onClick={() => setViewingReportContent(null)}
                  style={{ background: 'transparent', color: 'var(--text-main)', fontSize: '18px', padding: '4px 8px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, paddingRight: '8px' }}>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {viewingReportContent.text}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}