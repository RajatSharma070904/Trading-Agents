'use client';

import React, { useState, useEffect } from 'react';

export interface ScreenerStock {
  ticker: string;
  name: string;
  market: string;
  currency: string;
  price: number;
  change_1d: number;
  change_1w: number;
  change_1m: number;
  rsi_14: number;
  sma_50: number;
  trend: string;
  volume_ratio: number;
  score: number;
  signal: string;
  badge_type: 'bull' | 'bear' | 'neutral';
}

interface WatchlistHeatmapProps {
  apiBase: string;
  currentTicker: string;
  onSelectTicker: (ticker: string) => void;
  onAnalyzeTicker?: (ticker: string) => void;
}

export default function WatchlistHeatmap({
  apiBase,
  currentTicker,
  onSelectTicker,
  onAnalyzeTicker,
}: WatchlistHeatmapProps) {
  const [stocks, setStocks] = useState<ScreenerStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'all' | 'nse' | 'us' | 'bull' | 'bear'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [customTickerInput, setCustomTickerInput] = useState('');
  const [customList, setCustomList] = useState<string[]>([]);
  const [refreshCountdown, setRefreshCountdown] = useState(60);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load custom watchlist from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('alphaswarm_custom_watchlist');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setCustomList(parsed);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Fetch screener data
  async function fetchScreener(category = activeCategory, customSymbols = customList) {
    setIsRefreshing(true);
    try {
      let endpoint = `${apiBase}/api/screener?category=${category}`;
      if (customSymbols.length > 0) {
        endpoint += `&tickers=${encodeURIComponent(customSymbols.join(','))}`;
      }
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        if (data.stocks) {
          setStocks(data.stocks);
        }
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
      setIsRefreshing(false);
      setRefreshCountdown(60);
    }
  }

  useEffect(() => {
    fetchScreener(activeCategory, customList);
  }, [activeCategory, customList.length]);

  // Auto refresh timer
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          fetchScreener(activeCategory, customList);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [activeCategory, customList]);

  // Handle adding custom ticker
  function handleAddCustomTicker(e: React.FormEvent) {
    e.preventDefault();
    const clean = customTickerInput.trim().toUpperCase();
    if (!clean || customList.includes(clean)) {
      setCustomTickerInput('');
      return;
    }
    const updated = [...customList, clean];
    setCustomList(updated);
    try {
      localStorage.setItem('alphaswarm_custom_watchlist', JSON.stringify(updated));
    } catch {
      // Ignore
    }
    setCustomTickerInput('');
    fetchScreener(activeCategory, updated);
  }

  function handleRemoveCustomTicker(sym: string) {
    const updated = customList.filter((s) => s !== sym);
    setCustomList(updated);
    try {
      localStorage.setItem('alphaswarm_custom_watchlist', JSON.stringify(updated));
    } catch {
      // Ignore
    }
    fetchScreener(activeCategory, updated);
  }

  // Filter stocks based on category
  const filteredStocks = stocks.filter((s) => {
    if (activeCategory === 'nse') return s.market.includes('NSE') || s.ticker.endsWith('.NS');
    if (activeCategory === 'us') return !s.market.includes('NSE') && !s.ticker.endsWith('.NS');
    if (activeCategory === 'bull') return s.score >= 15;
    if (activeCategory === 'bear') return s.score <= -15;
    return true;
  });

  // Calculate heatmap color & intensity based on 1-day return (Light and Dark adaptive)
  const getTileBg = (chg: number) => {
    if (chg >= 2.5) return 'linear-gradient(145deg, var(--bull-green-bg), var(--bg-surface))';
    if (chg > 0.0) return 'linear-gradient(145deg, var(--bull-green-bg), var(--bg-surface))';
    if (chg <= -2.5) return 'linear-gradient(145deg, var(--bear-red-bg), var(--bg-surface))';
    if (chg < 0.0) return 'linear-gradient(145deg, var(--bear-red-bg), var(--bg-surface))';
    return 'var(--bg-surface)';
  };

  const getBorderColor = (s: ScreenerStock) => {
    if (s.ticker === currentTicker) return 'var(--accent-primary)';
    if (s.score >= 40) return 'var(--bull-green-border)';
    if (s.score <= -40) return 'var(--bear-red-border)';
    return 'var(--border-subtle)';
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Header & Controls Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '16px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '14px',
        padding: '16px 20px',
        boxShadow: 'var(--shadow-card)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--bull-green)',
              boxShadow: '0 0 8px var(--bull-green)'
            }} />
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.3px', margin: 0 }}>
              Live Market Swarm Radar &amp; Heatmap
            </h2>
            <span style={{
              fontSize: '10.5px',
              padding: '2px 7px',
              borderRadius: '4px',
              background: 'var(--accent-cyan-bg)',
              border: '1px solid var(--border-accent)',
              color: 'var(--accent-primary)',
              fontWeight: 800
            }}>
              NSE &amp; US REALTIME
            </span>
          </div>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Instant algorithmic Bull/Bear momentum scanning across liquid assets with 1-click multi-agent synthesis.
          </p>
        </div>

        {/* View Switcher & Countdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            fontSize: '11.5px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'var(--bg-secondary)',
            padding: '5px 10px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)'
          }}>
            <span style={{ color: isRefreshing ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 600 }}>
              {isRefreshing ? '🔄 Scanning...' : `⏳ Auto: ${refreshCountdown}s`}
            </span>
            <button
              onClick={() => fetchScreener(activeCategory, customList)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-primary)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '11.5px',
                padding: '0 4px'
              }}
              title="Refresh now"
            >
              Sync
            </button>
          </div>

          <div style={{
            display: 'flex',
            background: 'var(--bg-secondary)',
            padding: '2px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)'
          }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                background: viewMode === 'grid' ? 'var(--bg-surface)' : 'transparent',
                color: viewMode === 'grid' ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '12px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              ▦ Heatmap
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                background: viewMode === 'table' ? 'var(--bg-surface)' : 'transparent',
                color: viewMode === 'table' ? 'var(--text-main)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: '12px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              ☰ Table
            </button>
          </div>
        </div>
      </div>

      {/* Category Pills Bar & Custom Input */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '16px'
      }}>
        {/* Category Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: '🌐 All Markets' },
            { id: 'nse', label: '🇮🇳 NSE India' },
            { id: 'us', label: '🇺🇸 US Megacaps' },
            { id: 'bull', label: '🐂 Bullish Radar' },
            { id: 'bear', label: '🐻 Bearish Traps' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as any)}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: activeCategory === cat.id ? 800 : 600,
                background: activeCategory === cat.id ? 'var(--accent-primary)' : 'var(--bg-surface)',
                border: activeCategory === cat.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                color: activeCategory === cat.id ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer',
                boxShadow: activeCategory === cat.id ? '0 2px 8px rgba(37, 99, 235, 0.25)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Add custom stock form */}
        <form onSubmit={handleAddCustomTicker} style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={customTickerInput}
            onChange={(e) => setCustomTickerInput(e.target.value)}
            placeholder="+ Add ticker (e.g. INFY.NS, MSFT)..."
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-main)',
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              width: '200px',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'var(--accent-primary)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Add
          </button>
        </form>
      </div>

      {/* Custom watchlists tags if any */}
      {customList.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 800 }}>
            Custom Watchlist:
          </span>
          {customList.map((sym) => (
            <span
              key={sym}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-main)',
                fontSize: '11.5px',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)'
              }}
            >
              {sym}
              <button
                onClick={() => handleRemoveCustomTicker(sym)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--bear-red)',
                  cursor: 'pointer',
                  fontWeight: 900,
                  fontSize: '12px',
                  padding: 0
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* VIEW MODE 1: HEATMAP GRID */}
      {viewMode === 'grid' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
          gap: '12px'
        }}>
          {filteredStocks.map((s) => {
            const isSelected = s.ticker === currentTicker;
            const isUp = s.change_1d >= 0;
            const currSymbol = s.currency === 'INR' ? '₹' : '$';

            return (
              <div
                key={s.ticker}
                style={{
                  position: 'relative',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  background: getTileBg(s.change_1d),
                  border: `1.5px solid ${getBorderColor(s)}`,
                  boxShadow: isSelected
                    ? '0 0 0 2px var(--accent-primary), 0 4px 12px rgba(37, 99, 235, 0.2)'
                    : 'var(--shadow-card)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '142px'
                }}
                onClick={() => onSelectTicker(s.ticker)}
              >
                {/* Top Row: Symbol, Market Tag, Signal Badge */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div>
                      <div style={{
                        fontSize: '15px',
                        fontWeight: 900,
                        color: 'var(--text-main)',
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {s.ticker}
                        {isSelected && (
                          <span style={{ fontSize: '9.5px', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', padding: '1px 4px', borderRadius: '4px' }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                        {s.name}
                      </div>
                    </div>

                    <span style={{
                      fontSize: '10px',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: s.badge_type === 'bull'
                        ? 'var(--bull-green-bg)'
                        : s.badge_type === 'bear'
                        ? 'var(--bear-red-bg)'
                        : 'var(--bg-secondary)',
                      color: s.badge_type === 'bull' ? 'var(--bull-green)' : s.badge_type === 'bear' ? 'var(--bear-red)' : 'var(--text-secondary)',
                      border: s.badge_type === 'bull'
                        ? '1px solid var(--bull-green-border)'
                        : s.badge_type === 'bear'
                        ? '1px solid var(--bear-red-border)'
                        : '1px solid var(--border-subtle)',
                    }}>
                      {s.signal}
                    </span>
                  </div>

                  {/* Price & 1D Change */}
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '8px' }}>
                    <div style={{ fontSize: '19px', fontWeight: 900, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                      {currSymbol}{s.price.toLocaleString()}
                    </div>
                    <div style={{
                      fontSize: '13.5px',
                      fontWeight: 800,
                      color: isUp ? 'var(--bull-green)' : 'var(--bear-red)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {isUp ? '▲ +' : '▼ '}{s.change_1d}%
                    </div>
                  </div>
                </div>

                {/* Bottom Row: RSI, Vol Ratio & 1-Click Action */}
                <div style={{
                  borderTop: '1px solid var(--border-subtle)',
                  paddingTop: '8px',
                  marginTop: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '10.5px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    <span>RSI {s.rsi_14}</span>
                    <span>•</span>
                    <span style={{ color: s.volume_ratio >= 1.3 ? 'var(--hold-amber)' : 'inherit', fontWeight: s.volume_ratio >= 1.3 ? 700 : 400 }}>
                      {s.volume_ratio}x Vol
                    </span>
                  </div>

                  {onAnalyzeTicker && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTicker(s.ticker);
                        onAnalyzeTicker(s.ticker);
                      }}
                      style={{
                        padding: '2px 7px',
                        borderRadius: '4px',
                        background: 'var(--accent-cyan-bg)',
                        border: '1px solid var(--border-accent)',
                        color: 'var(--accent-primary)',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                      title="Run Full Multi-Agent Synthesis"
                    >
                      ⚡ Swarm
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: TELEMETRY TABLE */}
      {viewMode === 'table' && (
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
          overflowX: 'auto'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                <th style={{ padding: '12px 16px' }}>Asset</th>
                <th style={{ padding: '12px 16px' }}>Market</th>
                <th style={{ padding: '12px 16px' }}>Price</th>
                <th style={{ padding: '12px 16px' }}>1D Return</th>
                <th style={{ padding: '12px 16px' }}>1W Momentum</th>
                <th style={{ padding: '12px 16px' }}>RSI 14</th>
                <th style={{ padding: '12px 16px' }}>Volume Spike</th>
                <th style={{ padding: '12px 16px' }}>Swarm Signal</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((s) => {
                const isSelected = s.ticker === currentTicker;
                const isUp = s.change_1d >= 0;
                const isUp1W = s.change_1w >= 0;
                const currSymbol = s.currency === 'INR' ? '₹' : '$';

                return (
                  <tr
                    key={s.ticker}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: isSelected ? 'var(--bg-surface-hover)' : 'transparent',
                      transition: 'background 0.15s ease',
                      cursor: 'pointer'
                    }}
                    onClick={() => onSelectTicker(s.ticker)}
                  >
                    {/* Asset & Name */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                        {s.ticker}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {s.name}
                      </div>
                    </td>

                    {/* Market */}
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {s.market}
                    </td>

                    {/* Price */}
                    <td style={{ padding: '12px 16px', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                      {currSymbol}{s.price.toLocaleString()}
                    </td>

                    {/* 1D Change */}
                    <td style={{
                      padding: '12px 16px',
                      fontWeight: 800,
                      color: isUp ? 'var(--bull-green)' : 'var(--bear-red)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {isUp ? '▲ +' : '▼ '}{s.change_1d}%
                    </td>

                    {/* 1W Change */}
                    <td style={{
                      padding: '12px 16px',
                      fontWeight: 700,
                      color: isUp1W ? 'var(--bull-green)' : 'var(--bear-red)',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      {isUp1W ? '+' : ''}{s.change_1w}%
                    </td>

                    {/* RSI */}
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)' }}>
                      <span style={{
                        padding: '2px 7px',
                        borderRadius: '4px',
                        background: s.rsi_14 > 70 ? 'var(--bear-red-bg)' : s.rsi_14 < 35 ? 'var(--bull-green-bg)' : 'var(--bg-secondary)',
                        color: s.rsi_14 > 70 ? 'var(--bear-red)' : s.rsi_14 < 35 ? 'var(--bull-green)' : 'var(--text-secondary)',
                        fontSize: '11.5px',
                        fontWeight: 700
                      }}>
                        {s.rsi_14}
                      </span>
                    </td>

                    {/* Volume Ratio */}
                    <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', color: s.volume_ratio >= 1.3 ? 'var(--hold-amber)' : 'var(--text-muted)' }}>
                      {s.volume_ratio}x
                    </td>

                    {/* Swarm Signal */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 800,
                        background: s.badge_type === 'bull'
                          ? 'var(--bull-green-bg)'
                          : s.badge_type === 'bear'
                          ? 'var(--bear-red-bg)'
                          : 'var(--bg-secondary)',
                        color: s.badge_type === 'bull' ? 'var(--bull-green)' : s.badge_type === 'bear' ? 'var(--bear-red)' : 'var(--text-secondary)',
                        border: s.badge_type === 'bull'
                          ? '1px solid var(--bull-green-border)'
                          : s.badge_type === 'bear'
                          ? '1px solid var(--bear-red-border)'
                          : '1px solid var(--border-subtle)',
                      }}>
                        {s.signal} ({s.score > 0 ? `+${s.score}` : s.score})
                      </span>
                    </td>

                    {/* Action buttons */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTicker(s.ticker);
                          }}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-secondary)',
                            fontSize: '11.5px',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          Select
                        </button>
                        {onAnalyzeTicker && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectTicker(s.ticker);
                              onAnalyzeTicker(s.ticker);
                            }}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              background: 'var(--accent-primary)',
                              border: 'none',
                              color: '#fff',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            ⚡ Swarm
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
