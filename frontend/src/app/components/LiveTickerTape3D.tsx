'use client';

import React from 'react';

const TICKER_ITEMS = [
  { symbol: 'NVDA', price: '210.96', change: '+2.4%', up: true },
  { symbol: 'RELIANCE.NS', price: '1,214.50', change: '+1.1%', up: true },
  { symbol: 'TCS.NS', price: '3,840.00', change: '-0.3%', up: false },
  { symbol: 'AAPL', price: '232.10', change: '+0.7%', up: true },
  { symbol: 'TSLA', price: '248.50', change: '+3.2%', up: true },
  { symbol: 'HDFCBANK.NS', price: '1,720.00', change: '+0.5%', up: true },
  { symbol: 'TATASTEEL.NS', price: '154.20', change: '-0.8%', up: false },
  { symbol: 'SPY (S&P 500)', price: '584.20', change: '+0.4%', up: true },
  { symbol: 'NIFTY 50', price: '25,128.50', change: '+0.6%', up: true },
  { symbol: 'BTC/USD', price: '98,450', change: '+4.1%', up: true },
];

export default function LiveTickerTape3D() {
  return (
    <div
      style={{
        width: '100%',
        overflow: 'hidden',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        backdropFilter: 'blur(10px)',
        position: 'relative',
        zIndex: 50,
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '32px',
          whiteSpace: 'nowrap',
          animation: 'marquee 30s linear infinite',
          padding: '8px 0',
        }}
      >
        {/* Render twice for seamless infinite loop */}
        {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, idx) => (
          <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <span style={{ fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{item.symbol}</span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.price}</span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: item.up ? 'var(--bull-green)' : 'var(--bear-red)',
                background: item.up ? 'var(--bull-green-bg)' : 'var(--bear-red-bg)',
                border: `1px solid ${item.up ? 'var(--bull-green-border)' : 'var(--bear-red-border)'}`,
                padding: '1px 6px',
                borderRadius: '4px',
              }}
            >
              {item.change}
            </span>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
