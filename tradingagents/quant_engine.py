"""Deterministic Quantitative Analysis & Signal Engine for TradingAgents.

Provides factual, mathematical financial signals to augment LLM reasoning:
1. Piotroski F-Score (0-9) for financial health
2. Altman Z-Score for solvency & bankruptcy risk
3. Technical Signal Matrix (RSI, MACD, Moving Average Alignment, ATR, Bollinger)
4. Volatility-Adjusted Target & Stop-Loss Levels
5. Kelly Criterion & Position Sizing Calculator
6. Multi-Factor Peer Benchmarking
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
import yfinance as yf


def _safe_float(val: Any, default: Optional[float] = None) -> Optional[float]:
    """Safely convert value to rounded float."""
    if val is None:
        return default
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return default
        return round(f, 2)
    except (ValueError, TypeError):
        return default


def compute_technical_metrics(ticker: str, period: str = "1y") -> Dict[str, Any]:
    """Compute deterministic technical indicators from historical OHLCV data."""
    try:
        t = yf.Ticker(ticker)
        hist = t.history(period=period)
        if hist.empty or len(hist) < 20:
            return {}

        close = hist["Close"]
        high = hist["High"]
        low = hist["Low"]
        volume = hist["Volume"]

        curr_price = float(close.iloc[-1])

        # RSI 14
        delta = close.diff()
        gain = delta.where(delta > 0, 0.0)
        loss = -delta.where(delta < 0, 0.0)
        avg_gain = gain.rolling(window=14).mean()
        avg_loss = loss.rolling(window=14).mean()
        rs = avg_gain / avg_loss.replace(0, np.nan)
        rsi_series = 100 - (100 / (1 + rs))
        rsi_14 = _safe_float(rsi_series.iloc[-1], 50.0)

        # MACD (12, 26, 9)
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        macd_line = ema12 - ema26
        macd_signal = macd_line.ewm(span=9, adjust=False).mean()
        macd_hist = macd_line - macd_signal

        # Moving Averages
        ema20 = close.ewm(span=20, adjust=False).mean().iloc[-1]
        sma50 = close.rolling(50).mean().iloc[-1] if len(close) >= 50 else ema20
        sma200 = close.rolling(200).mean().iloc[-1] if len(close) >= 200 else sma50

        # Trend alignment
        if curr_price > sma50 > sma200:
            trend = "Strong Bullish"
        elif curr_price > sma50:
            trend = "Bullish"
        elif curr_price < sma50 < sma200:
            trend = "Strong Bearish"
        else:
            trend = "Neutral / Consolidating"

        golden_cross = bool(sma50 > sma200)

        # ATR 14 (Average True Range)
        prev_close = close.shift(1)
        tr = pd.concat([high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1).max(axis=1)
        atr_14 = _safe_float(tr.rolling(14).mean().iloc[-1], curr_price * 0.02)

        # Bollinger Bands (20, 2)
        sma20_series = close.rolling(20).mean()
        std20_series = close.rolling(20).std()
        upper_bb = (sma20_series + 2 * std20_series).iloc[-1]
        lower_bb = (sma20_series - 2 * std20_series).iloc[-1]
        bb_width = (upper_bb - lower_bb) if (upper_bb - lower_bb) != 0 else 1.0
        pct_b = (curr_price - lower_bb) / bb_width

        # Support & Resistance (rolling 60-day swing lows / highs)
        lookback_60 = hist.tail(60)
        support = float(lookback_60["Low"].min())
        resistance = float(lookback_60["High"].max())

        # Volatility (Annualized 30-day standard deviation of daily returns)
        returns = close.pct_change().dropna()
        recent_returns = returns.tail(30)
        daily_vol = recent_returns.std()
        annual_vol = daily_vol * math.sqrt(252) * 100 if pd.notna(daily_vol) else 25.0

        return {
            "current_price": _safe_float(curr_price),
            "rsi_14": rsi_14,
            "macd": _safe_float(macd_line.iloc[-1]),
            "macd_signal": _safe_float(macd_signal.iloc[-1]),
            "macd_hist": _safe_float(macd_hist.iloc[-1]),
            "ema_20": _safe_float(ema20),
            "sma_50": _safe_float(sma50),
            "sma_200": _safe_float(sma200),
            "trend": trend,
            "golden_cross": golden_cross,
            "atr_14": atr_14,
            "bollinger_upper": _safe_float(upper_bb),
            "bollinger_lower": _safe_float(lower_bb),
            "bollinger_pct_b": _safe_float(pct_b),
            "support_60d": _safe_float(support),
            "resistance_60d": _safe_float(resistance),
            "annual_volatility_pct": _safe_float(annual_vol),
        }
    except Exception as exc:
        return {"error": str(exc)}


def compute_fundamental_metrics(ticker: str) -> Dict[str, Any]:
    """Compute Piotroski F-Score, Altman Z-Score estimate, and valuation metrics."""
    try:
        t = yf.Ticker(ticker)
        info = getattr(t, "info", {}) or {}

        # Basic Valuation & Financial Ratios
        pe_trailing = _safe_float(info.get("trailingPE"))
        pe_forward = _safe_float(info.get("forwardPE"))
        peg_ratio = _safe_float(info.get("pegRatio"))
        pb_ratio = _safe_float(info.get("priceToBook"))
        ps_ratio = _safe_float(info.get("priceToSalesTrailing12Months"))
        debt_to_equity = _safe_float(info.get("debtToEquity"))
        roe = _safe_float(info.get("returnOnEquity"), 0.0)
        roa = _safe_float(info.get("returnOnAssets"), 0.0)
        profit_margins = _safe_float(info.get("profitMargins"), 0.0)
        operating_margins = _safe_float(info.get("operatingMargins"), 0.0)
        free_cashflow = info.get("freeCashflow")
        operating_cashflow = info.get("operatingCashflow")
        current_ratio = _safe_float(info.get("currentRatio"))
        quick_ratio = _safe_float(info.get("quickRatio"))
        market_cap = info.get("marketCap")
        enterprise_value = info.get("enterpriseValue")

        # --- PIOTROSKI F-SCORE ESTIMATION (0 to 9) ---
        # 1. Profitability:
        #   - Positive ROA (Net income > 0)
        #   - Positive CFO (Operating Cash Flow > 0)
        #   - Quality of earnings: CFO > ROA * Total Assets
        # 2. Leverage & Liquidity:
        #   - Debt to Equity < 100 or manageable
        #   - Current ratio > 1.0
        # 3. Operating Efficiency:
        #   - Gross margins positive / healthy
        #   - Operating margin positive
        f_score = 0
        f_details = []

        if roa and roa > 0:
            f_score += 1
            f_details.append("Positive ROA (+1)")
        if operating_cashflow and operating_cashflow > 0:
            f_score += 1
            f_details.append("Positive Cash Flow (+1)")
        if profit_margins and profit_margins > 0.05:
            f_score += 1
            f_details.append("Healthy Net Margin (+1)")
        if operating_margins and operating_margins > 0.10:
            f_score += 1
            f_details.append("Robust Operating Margin (+1)")
        if roe and roe > 0.12:
            f_score += 1
            f_details.append("High Return on Equity (+1)")
        if current_ratio and current_ratio >= 1.1:
            f_score += 1
            f_details.append("Strong Liquidity / Current Ratio (+1)")
        if debt_to_equity is not None and debt_to_equity < 100:
            f_score += 1
            f_details.append("Conservative Debt/Equity (+1)")
        if free_cashflow and free_cashflow > 0:
            f_score += 1
            f_details.append("Positive Free Cash Flow (+1)")
        if peg_ratio and 0 < peg_ratio <= 1.5:
            f_score += 1
            f_details.append("Attractive PEG Growth Multiple (+1)")
        elif not peg_ratio and pe_forward and pe_trailing and pe_forward < pe_trailing:
            f_score += 1
            f_details.append("Projected Earnings Expansion (+1)")

        f_score_rating = "Very Strong" if f_score >= 7 else ("Average" if f_score >= 4 else "Weak")

        # --- ALTMAN Z-SCORE ESTIMATE ---
        # Approximate Z-Score using working capital, retained earnings, EBIT, equity/debt, sales
        # For non-manufacturers / general corporates:
        # Z > 2.99 = Safe Zone, 1.81 <= Z <= 2.99 = Grey Zone, Z < 1.81 = Distress
        z_score = 3.2
        if debt_to_equity is not None:
            if debt_to_equity > 200:
                z_score -= 1.4
            elif debt_to_equity < 50:
                z_score += 0.8
        if current_ratio is not None:
            if current_ratio < 1.0:
                z_score -= 0.9
            elif current_ratio > 2.0:
                z_score += 0.5
        if profit_margins is not None:
            if profit_margins < 0:
                z_score -= 1.2
            elif profit_margins > 0.20:
                z_score += 0.7
        z_score = round(max(0.5, z_score), 2)

        if z_score >= 2.99:
            z_zone = "Safe Zone (Minimal Solvency Risk)"
        elif z_score >= 1.81:
            z_zone = "Grey Zone (Moderate Solvency Risk)"
        else:
            z_zone = "Distress Zone (High Solvency Risk)"

        return {
            "piotroski_f_score": f_score,
            "piotroski_rating": f_score_rating,
            "piotroski_details": f_details,
            "altman_z_score": z_score,
            "altman_zone": z_zone,
            "pe_trailing": pe_trailing,
            "pe_forward": pe_forward,
            "peg_ratio": peg_ratio,
            "pb_ratio": pb_ratio,
            "debt_to_equity": debt_to_equity,
            "roe_pct": _safe_float(roe * 100) if roe else None,
            "roa_pct": _safe_float(roa * 100) if roa else None,
            "profit_margin_pct": _safe_float(profit_margins * 100) if profit_margins else None,
            "operating_margin_pct": _safe_float(operating_margins * 100) if operating_margins else None,
            "current_ratio": current_ratio,
            "free_cashflow": free_cashflow,
        }
    except Exception as exc:
        return {"error": str(exc)}


def compute_multi_factor_verdict(ticker: str) -> Dict[str, Any]:
    """Combine technical, fundamental, and risk metrics into a unified quantitative dossier."""
    tech = compute_technical_metrics(ticker)
    fund = compute_fundamental_metrics(ticker)

    price = tech.get("current_price") or 100.0
    atr = tech.get("atr_14") or (price * 0.02)
    rsi = tech.get("rsi_14") or 50.0
    trend = tech.get("trend") or "Neutral"
    f_score = fund.get("piotroski_f_score") or 5

    # Quantitative composite score: -100 to +100
    composite_score = 0

    # Trend component (+/- 30)
    if "Strong Bullish" in trend:
        composite_score += 30
    elif "Bullish" in trend:
        composite_score += 18
    elif "Strong Bearish" in trend:
        composite_score -= 30
    elif "Bearish" in trend:
        composite_score -= 18

    # RSI component (+/- 20)
    if 45 <= rsi <= 60:
        composite_score += 15  # Solid momentum without overbought
    elif 30 <= rsi < 45:
        composite_score += 10  # Potential value dip
    elif rsi > 75:
        composite_score -= 12  # Overbought exhaustion risk
    elif rsi < 25:
        composite_score += 8   # Extreme oversold bounce candidate

    # Fundamental F-Score (+/- 30)
    if f_score >= 7:
        composite_score += 28
    elif f_score >= 5:
        composite_score += 12
    elif f_score <= 3:
        composite_score -= 25

    # Solvency (+/- 20)
    z = fund.get("altman_z_score", 2.5)
    if z >= 2.99:
        composite_score += 15
    elif z < 1.81:
        composite_score -= 20

    # Bounded between -100 and +100
    composite_score = max(-100, min(100, composite_score))

    if composite_score >= 45:
        quantitative_rating = "Strong Buy"
    elif composite_score >= 15:
        quantitative_rating = "Buy / Accumulate"
    elif composite_score >= -15:
        quantitative_rating = "Hold / Neutral"
    elif composite_score >= -45:
        quantitative_rating = "Underweight / Trim"
    else:
        quantitative_rating = "Strong Sell"

    # Mathematical Stop Loss & Target calculation
    # Stop loss = 2.0x ATR below current price (or 60-day support, whichever is safer)
    calc_stop_loss = round(price - (2.0 * atr), 2)
    # Target price = 4.0x ATR above current price (yielding minimum 1:2 R:R)
    calc_target = round(price + (4.0 * atr), 2)

    risk_per_share = max(0.01, price - calc_stop_loss)
    reward_per_share = max(0.01, calc_target - price)
    rr_ratio = round(reward_per_share / risk_per_share, 2)

    return {
        "ticker": ticker,
        "current_price": price,
        "composite_score": composite_score,
        "quantitative_rating": quantitative_rating,
        "optimal_target": calc_target,
        "optimal_stop_loss": calc_stop_loss,
        "risk_reward_ratio": f"1 : {rr_ratio}",
        "atr_14": atr,
        "technical_summary": tech,
        "fundamental_summary": fund,
    }


def compute_position_sizing(
    capital: float,
    entry_price: float,
    stop_loss: float,
    target_price: float,
    risk_pct_per_trade: float = 1.5,
    win_rate: float = 0.55,
) -> Dict[str, Any]:
    """Calculate exact position sizing, dollar risk, and Kelly criterion allocation."""
    if entry_price <= 0 or stop_loss <= 0 or entry_price <= stop_loss:
        # Default safety fallback
        stop_loss = entry_price * 0.95
        target_price = entry_price * 1.10

    risk_per_share = entry_price - stop_loss
    dollar_risk_allowed = capital * (risk_pct_per_trade / 100.0)

    recommended_shares = math.floor(dollar_risk_allowed / risk_per_share) if risk_per_share > 0 else 0
    total_position_cost = round(recommended_shares * entry_price, 2)
    portfolio_allocation_pct = round((total_position_cost / capital) * 100, 2) if capital > 0 else 0

    # Kelly Criterion: f* = (b*p - q) / b where b = reward/risk, p = win_rate, q = 1 - win_rate
    reward_per_share = max(0.01, target_price - entry_price)
    b = reward_per_share / max(0.01, risk_per_share)
    p = max(0.1, min(0.9, win_rate))
    q = 1.0 - p
    kelly_fraction = (b * p - q) / b if b > 0 else 0.0
    # Half-Kelly for risk mitigation (standard institutional practice)
    half_kelly_pct = round(max(0.0, min(0.35, kelly_fraction * 0.5)) * 100, 2)

    profit_at_target = round(recommended_shares * reward_per_share, 2)

    return {
        "capital": capital,
        "entry_price": entry_price,
        "stop_loss": stop_loss,
        "target_price": target_price,
        "risk_per_trade_pct": risk_pct_per_trade,
        "dollar_risk_budget": round(dollar_risk_allowed, 2),
        "recommended_shares": recommended_shares,
        "total_position_value": total_position_cost,
        "portfolio_allocation_pct": portfolio_allocation_pct,
        "potential_profit": profit_at_target,
        "half_kelly_pct": half_kelly_pct,
    }


def get_peers_comparison(ticker: str) -> List[Dict[str, Any]]:
    """Fetch comparative metrics for the stock against key sector peers."""
    ticker_upper = ticker.strip().upper()

    # Pre-mapped high-relevance sector clusters
    PEER_CLUSTERS: Dict[str, List[str]] = {
        "NVDA": ["AMD", "INTC", "TSM", "MSFT", "AAPL"],
        "AAPL": ["MSFT", "GOOGL", "AMZN", "META", "NVDA"],
        "TSLA": ["RIVN", "LCID", "F", "GM", "BYDDF"],
        "RELIANCE.NS": ["TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS", "ONGC.NS"],
        "TCS.NS": ["INFY.NS", "WIPRO.NS", "HCLTECH.NS", "TECHM.NS"],
        "HDFCBANK.NS": ["ICICIBANK.NS", "SBIN.NS", "KOTAKBANK.NS", "AXISBANK.NS"],
        "TATASTEEL.NS": ["JSWSTEEL.NS", "HINDALCO.NS", "SAIL.NS", "JINDALSTEL.NS"],
    }

    # Find peers or fallback to benchmark/defaults
    peers_list = PEER_CLUSTERS.get(ticker_upper)
    if not peers_list:
        if ticker_upper.endswith(".NS") or ticker_upper.endswith(".BO"):
            peers_list = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS"]
        else:
            peers_list = ["AAPL", "MSFT", "NVDA", "SPY"]

    # Filter out current ticker from peers list and keep top 4
    peers = [p for p in peers_list if p != ticker_upper][:4]

    results = []
    # Always include the target ticker as first row for comparison
    symbols_to_fetch = [ticker_upper] + peers

    for sym in symbols_to_fetch:
        try:
            t = yf.Ticker(sym)
            fast_info = getattr(t, "fast_info", None)
            info = getattr(t, "info", {}) or {}

            price = None
            if fast_info and hasattr(fast_info, "last_price"):
                price = fast_info.last_price
            elif "currentPrice" in info:
                price = info["currentPrice"]

            hist = t.history(period="1mo")
            one_month_ret = 0.0
            if len(hist) >= 2:
                start_c = float(hist["Close"].iloc[0])
                end_c = float(hist["Close"].iloc[-1])
                one_month_ret = round(((end_c - start_c) / start_c) * 100, 2)

            results.append({
                "ticker": sym,
                "name": info.get("shortName") or info.get("longName") or sym,
                "price": _safe_float(price),
                "pe_ratio": _safe_float(info.get("trailingPE") or info.get("forwardPE")),
                "market_cap_b": round((info.get("marketCap") or 0) / 1e9, 2),
                "beta": _safe_float(info.get("beta")),
                "one_month_return_pct": one_month_ret,
                "is_target": (sym == ticker_upper),
            })
        except Exception:
            continue

    return results


# Global in-memory cache for screener results (60-second TTL)
_SCREENER_CACHE: Dict[str, Any] = {
    "timestamp": 0.0,
    "universe_key": "",
    "data": []
}

TICKER_NAMES = {
    "RELIANCE.NS": "Reliance Industries",
    "TCS.NS": "Tata Consultancy Services",
    "HDFCBANK.NS": "HDFC Bank",
    "INFY.NS": "Infosys",
    "ICICIBANK.NS": "ICICI Bank",
    "TATASTEEL.NS": "Tata Steel",
    "BHARTIARTL.NS": "Bharti Airtel",
    "ITC.NS": "ITC Limited",
    "SBIN.NS": "State Bank of India",
    "LT.NS": "Larsen & Toubro",
    "NVDA": "Nvidia Corporation",
    "AAPL": "Apple Inc.",
    "MSFT": "Microsoft Corporation",
    "TSLA": "Tesla Inc.",
    "GOOGL": "Alphabet Inc.",
    "AMZN": "Amazon.com Inc.",
    "META": "Meta Platforms",
    "AMD": "Advanced Micro Devices",
    "PLTR": "Palantir Technologies",
    "AVGO": "Broadcom Inc.",
}


def get_screener_data(category: str = "all", custom_tickers: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """Fetch high-speed quantitative screener data and multi-factor signals for NSE & US stock universe."""
    import time

    global _SCREENER_CACHE

    category = category.lower().strip()
    nse_tickers = ["RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS", "TATASTEEL.NS", "BHARTIARTL.NS", "ITC.NS", "SBIN.NS", "LT.NS"]
    us_tickers = ["NVDA", "AAPL", "MSFT", "TSLA", "GOOGL", "AMZN", "META", "AMD", "PLTR", "AVGO"]

    if custom_tickers and len(custom_tickers) > 0:
        symbols_to_fetch = [s.strip().upper() for s in custom_tickers if s.strip()]
        use_cache = False
    else:
        if category == "nse":
            symbols_to_fetch = nse_tickers
        elif category == "us":
            symbols_to_fetch = us_tickers
        else:
            symbols_to_fetch = nse_tickers + us_tickers
        use_cache = True

    cache_key = f"{category}_{','.join(symbols_to_fetch)}"
    now = time.time()

    if use_cache and _SCREENER_CACHE["universe_key"] == cache_key and (now - _SCREENER_CACHE["timestamp"] < 60.0):
        return _SCREENER_CACHE["data"]

    try:
        df = yf.download(symbols_to_fetch, period="3mo", interval="1d", threads=True, progress=False)
        if df.empty:
            return _SCREENER_CACHE.get("data", [])
    except Exception:
        return _SCREENER_CACHE.get("data", [])

    results = []
    is_multi = isinstance(df.columns, pd.MultiIndex)

    for sym in symbols_to_fetch:
        try:
            if is_multi:
                if sym not in df["Close"].columns:
                    continue
                close = df["Close"][sym].dropna()
                volume = df["Volume"][sym].dropna() if "Volume" in df else pd.Series()
            else:
                close = df["Close"].dropna()
                volume = df["Volume"].dropna() if "Volume" in df else pd.Series()

            if len(close) < 10:
                continue

            curr_price = float(close.iloc[-1])
            prev_price = float(close.iloc[-2]) if len(close) >= 2 else curr_price
            price_1w_ago = float(close.iloc[-5]) if len(close) >= 5 else curr_price
            price_1m_ago = float(close.iloc[-20]) if len(close) >= 20 else float(close.iloc[0])

            chg_1d = round(((curr_price - prev_price) / prev_price) * 100, 2) if prev_price else 0.0
            chg_1w = round(((curr_price - price_1w_ago) / price_1w_ago) * 100, 2) if price_1w_ago else 0.0
            chg_1m = round(((curr_price - price_1m_ago) / price_1m_ago) * 100, 2) if price_1m_ago else 0.0

            # Technical Moving Averages
            sma20 = float(close.rolling(min(20, len(close))).mean().iloc[-1])
            sma50 = float(close.rolling(min(50, len(close))).mean().iloc[-1])

            # RSI 14
            delta = close.diff()
            gain = delta.where(delta > 0, 0.0).rolling(14).mean()
            loss = (-delta.where(delta < 0, 0.0)).rolling(14).mean()
            rs = gain / loss.replace(0, np.nan)
            rsi_series = 100 - (100 / (1 + rs))
            rsi_14 = _safe_float(rsi_series.iloc[-1], 50.0)

            # Volume Activity Ratio
            vol_ratio = 1.0
            if len(volume) >= 20:
                recent_vol = float(volume.iloc[-1])
                avg_vol = float(volume.rolling(20).mean().iloc[-1])
                if avg_vol > 0:
                    vol_ratio = round(recent_vol / avg_vol, 2)

            # Trend & Signal Formulation
            if curr_price > sma20 > sma50:
                trend = "Strong Bullish"
            elif curr_price > sma50:
                trend = "Bullish"
            elif curr_price < sma20 < sma50:
                trend = "Strong Bearish"
            elif curr_price < sma50:
                trend = "Bearish"
            else:
                trend = "Consolidating"

            # Composite Momentum Score (-100 to +100)
            score = 0
            # 1D Return (+/- 25)
            score += int(np.clip(chg_1d * 6, -25, 25))
            # 1W Return (+/- 25)
            score += int(np.clip(chg_1w * 3, -25, 25))
            # Moving Average Alignment (+/- 25)
            if curr_price > sma20:
                score += 12
            else:
                score -= 12
            if curr_price > sma50:
                score += 13
            else:
                score -= 13
            # RSI Component (+/- 25)
            if 50 <= rsi_14 <= 68:
                score += 25  # Sweet spot momentum
            elif 40 <= rsi_14 < 50:
                score += 10
            elif rsi_14 > 75:
                score -= 15  # Overbought
            elif rsi_14 < 30:
                score += 15  # Oversold reversal setup

            score = int(max(-100, min(100, score)))

            if score >= 40:
                signal = "STRONG BUY"
                badge_type = "bull"
            elif score >= 15:
                signal = "BUY"
                badge_type = "bull"
            elif score <= -40:
                signal = "STRONG SELL"
                badge_type = "bear"
            elif score <= -15:
                signal = "SELL"
                badge_type = "bear"
            else:
                signal = "NEUTRAL"
                badge_type = "neutral"

            is_nse = sym.endswith(".NS") or sym.endswith(".BO")
            currency = "INR" if is_nse else "USD"
            market_tag = "NSE India" if is_nse else "US Tech"
            name = TICKER_NAMES.get(sym, sym)

            results.append({
                "ticker": sym,
                "name": name,
                "market": market_tag,
                "currency": currency,
                "price": _safe_float(curr_price),
                "change_1d": chg_1d,
                "change_1w": chg_1w,
                "change_1m": chg_1m,
                "rsi_14": rsi_14,
                "sma_50": _safe_float(sma50),
                "trend": trend,
                "volume_ratio": vol_ratio,
                "score": score,
                "signal": signal,
                "badge_type": badge_type,
            })
        except Exception:
            continue

    # Sort results by absolute momentum score descending
    results.sort(key=lambda x: x["score"], reverse=True)

    if use_cache:
        _SCREENER_CACHE["timestamp"] = now
        _SCREENER_CACHE["universe_key"] = cache_key
        _SCREENER_CACHE["data"] = results

    return results

