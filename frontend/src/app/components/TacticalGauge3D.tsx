'use client';

import React from 'react';

interface TacticalGauge3DProps {
  score: number; // -100 to +100
  ratingText?: string;
}

export default function TacticalGauge3D({ score = 45, ratingText = 'BUY' }: TacticalGauge3DProps) {
  // Map -100..+100 to 0..180 degrees
  const clampedScore = Math.max(-100, Math.min(100, score));
  const normalized = (clampedScore + 100) / 200; // 0 to 1
  const angleDeg = normalized * 180 - 90; // -90 deg to +90 deg

  const isBullish = clampedScore > 15;
  const isBearish = clampedScore < -15;
  const primaryColor = isBullish ? '#10b981' : isBearish ? '#f43f5e' : '#f59e0b';
  const glowFilter = isBullish ? 'drop-shadow(0 0 12px rgba(16, 185, 129, 0.6))' : isBearish ? 'drop-shadow(0 0 12px rgba(244, 63, 94, 0.6))' : 'drop-shadow(0 0 12px rgba(245, 158, 11, 0.6))';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', width: '220px', margin: '0 auto' }}>
      <svg width="220" height="125" viewBox="0 0 220 125" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <filter id="gaugeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Outer Background Arc Track */}
        <path
          d="M 25 110 A 85 85 0 0 1 195 110"
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth="14"
          strokeLinecap="round"
        />

        {/* 3D Glowing Colored Value Arc */}
        <path
          d="M 25 110 A 85 85 0 0 1 195 110"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="14"
          strokeLinecap="round"
          style={{ filter: glowFilter }}
        />

        {/* Dial Tick Marks */}
        {[-90, -45, 0, 45, 90].map((deg, idx) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = 110 + Math.sin(rad) * 95;
          const y1 = 110 - Math.cos(rad) * 95;
          const x2 = 110 + Math.sin(rad) * 102;
          const y2 = 110 - Math.cos(rad) * 102;
          return <line key={idx} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--border-medium)" strokeWidth="1.5" />;
        })}

        {/* 3D Needle with smooth CSS transition */}
        <g
          transform={`translate(110, 110) rotate(${angleDeg})`}
          style={{ transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        >
          {/* Needle Base Pin */}
          <polygon points="-4,0 4,0 0,-76" fill={primaryColor} style={{ filter: glowFilter }} />
          <circle cx="0" cy="0" r="10" fill="var(--bg-surface)" stroke={primaryColor} strokeWidth="3" />
          <circle cx="0" cy="0" r="4" fill="var(--text-main)" />
        </g>
      </svg>

      {/* Numerical Conviction & Stance Badge */}
      <div style={{ textAlign: 'center', marginTop: '-8px' }}>
        <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: primaryColor, letterSpacing: '-0.5px' }}>
          {clampedScore > 0 ? `+${clampedScore}` : clampedScore}
        </div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          {ratingText} ({Math.round(normalized * 100)}% Conviction)
        </div>
      </div>
    </div>
  );
}
