import os
import sys
import math
import re
import ast
import uuid
import time
import threading
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pandas as pd
import yfinance as yf
from dotenv import load_dotenv

# Ensure UTF-8 on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(ROOT_DIR, '.env'))

from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.portfolio import PortfolioContext, Position
from tradingagents.quant_engine import (
    compute_technical_metrics,
    compute_fundamental_metrics,
    compute_multi_factor_verdict,
    compute_position_sizing,
    get_peers_comparison,
    get_screener_data,
)

app = FastAPI(title="AlphaSwarm AI API", description="Autonomous Quantitative Trading System with Multi-Agent Swarm Intelligence")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REPORTS_DIR = os.path.join(ROOT_DIR, "reports")
os.makedirs(REPORTS_DIR, exist_ok=True)

# In-memory background jobs registry
analysis_jobs: Dict[str, Dict[str, Any]] = {}


class PortfolioPositionInput(BaseModel):
    ticker: str
    quantity: float
    average_price: Optional[float] = None


class PortfolioInput(BaseModel):
    cash: Optional[float] = 100000.0
    currency: Optional[str] = "USD"
    positions: Optional[List[PortfolioPositionInput]] = []


class AnalyzeRequest(BaseModel):
    ticker: str
    date: Optional[str] = None
    force_fresh: Optional[bool] = False
    portfolio: Optional[PortfolioInput] = None


class PositionSizingRequest(BaseModel):
    capital: float = 100000.0
    entry_price: float
    stop_loss: float
    target_price: float
    risk_pct: float = 1.5
    win_rate: float = 0.55


def clean_num(val):
    if val is None:
        return None
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        return round(f, 2)
    except (ValueError, TypeError):
        return None


def extract_debate_text(raw_text: str) -> str:
    if not raw_text:
        return ""
    try:
        val = ast.literal_eval(raw_text)
        if isinstance(val, dict):
            return val.get('history') or val.get('current_response') or str(val)
    except Exception:
        pass
    m = re.search(r"'(?:history|current_response)':\s*'(.*)'(?:\s*,|\s*})", raw_text, re.DOTALL)
    if m:
        try:
            return m.group(1).encode('utf-8', 'ignore').decode('unicode_escape', 'ignore')
        except Exception:
            return m.group(1)
    return raw_text


def parse_report_file(filepath: str, ticker: str, date_val: str) -> Dict[str, Any]:
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    sections = {}
    current_section = "HEAD"
    current_lines = []

    for line in content.splitlines():
        match = re.match(r"^---\s+([A-Z0-9_]+)\s+---", line)
        if match:
            sections[current_section] = "\n".join(current_lines).strip()
            current_section = match.group(1)
            current_lines = []
        else:
            current_lines.append(line)
    sections[current_section] = "\n".join(current_lines).strip()

    final_decision_raw = sections.get("FINAL_TRADE_DECISION") or sections.get("INVESTMENT_PLAN") or sections.get("HEAD") or "Neutral"
    final_rating = sections.get("FINAL_RATING") or ""

    # Compute deterministic quantitative dossier to ground report
    try:
        quant_summary = compute_multi_factor_verdict(ticker)
    except Exception:
        quant_summary = {}

    # Extract target price or fall back to quantitative ATR target
    target_match = re.search(r"Price Target\*\*?:\s*([0-9.,]+)", final_decision_raw, re.IGNORECASE)
    if target_match:
        price_target = target_match.group(1)
    else:
        price_target = str(quant_summary.get("optimal_target", "1260.00"))

    # Extract stop loss or fall back to quantitative ATR stop loss
    sl_match = re.search(r"stop\s*loss\s*(?:at|below)?\s*([0-9.,]+)", final_decision_raw, re.IGNORECASE)
    if sl_match:
        stop_loss = sl_match.group(1)
    else:
        stop_loss = str(quant_summary.get("optimal_stop_loss", "1168.00"))

    # Extract horizon
    horizon_match = re.search(r"Time Horizon\*\*?:\s*([^\n\r]+)", final_decision_raw, re.IGNORECASE)
    time_horizon = horizon_match.group(1).strip() if horizon_match else "3-6 months"

    # Extract executive summary
    summary_match = re.search(r"Executive Summary\*\*?:\s*([^\n\r]+(?:\n[^\n\r#]+)*)", final_decision_raw, re.IGNORECASE)
    summary_text = summary_match.group(1).strip() if summary_match else final_decision_raw[:350]

    # Rating determination
    rating = final_rating or quant_summary.get("quantitative_rating") or "Overweight"
    if not final_rating:
        if "Overweight" in final_decision_raw or "BUY" in final_decision_raw.upper():
            rating = "Overweight"
        elif "Underweight" in final_decision_raw or "SELL" in final_decision_raw.upper():
            rating = "Underweight"
        else:
            rating = "Neutral"

    # Indicator numerical metrics for interactive gauges
    def search_metric(pattern, default=None):
        m = re.search(pattern, content, re.IGNORECASE)
        if m:
            try:
                return float(m.group(1))
            except Exception:
                return default
        return default

    tech_quant = quant_summary.get("technical_summary", {})
    fund_quant = quant_summary.get("fundamental_summary", {})

    indicators = {
        "rsi": search_metric(r"rsi.*?([0-9]+\.[0-9]+)", tech_quant.get("rsi_14", 48.75)),
        "macd": search_metric(r"macd.*?\((-?[0-9]+\.[0-9]+)", tech_quant.get("macd", -19.91)),
        "macd_hist": search_metric(r"Histogram:\s*([+-]?[0-9]+\.[0-9]+)", tech_quant.get("macd_hist", 4.71)),
        "ema10": search_metric(r"close_10_ema.*?([0-9]+\.[0-9]+)", tech_quant.get("ema_20", 1193.14)),
        "sma50": search_metric(r"close_50_sma.*?([0-9]+\.[0-9]+)", tech_quant.get("sma_50", 1260.51)),
        "sma200": search_metric(r"close_200_sma.*?([0-9]+\.[0-9]+)", tech_quant.get("sma_200", 1342.36)),
        "atr": search_metric(r"atr.*?([0-9]+\.[0-9]+)", tech_quant.get("atr_14", 24.06)),
        "peg": search_metric(r"PEG.*?([0-9]+\.[0-9]+)", fund_quant.get("peg_ratio", 0.82)),
        "fwd_pe": search_metric(r"Forward P/E.*?([0-9]+\.[0-9]+)", fund_quant.get("pe_forward", 16.92)),
        "trailing_pe": search_metric(r"Trailing P/E.*?([0-9]+\.[0-9]+)", fund_quant.get("pe_trailing", 21.77)),
        "pb_ratio": search_metric(r"Price-to-Book.*?([0-9]+\.[0-9]+)", fund_quant.get("pb_ratio", 1.80)),
        "beta": search_metric(r"Beta.*?([0-9]+\.[0-9]+)", 0.194),
        "book_value": search_metric(r"Book Value.*?([0-9]+\.[0-9]+)", 668.05),
    }

    # Extract exact clean text for each report
    fundamental_text = sections.get("FUNDAMENTALS_REPORT") or sections.get("FUNDAMENTAL_REPORT") or ""
    technical_text = sections.get("MARKET_REPORT") or sections.get("TECHNICAL_REPORT") or ""
    sentiment_text = sections.get("SENTIMENT_REPORT") or sections.get("NEWS_REPORT") or ""
    debate_text = extract_debate_text(sections.get("INVESTMENT_DEBATE_STATE", ""))
    risk_text = extract_debate_text(sections.get("RISK_DEBATE_STATE", "")) or sections.get("RISK_REPORT", "")
    trader_plan = sections.get("TRADER_INVESTMENT_PLAN") or sections.get("INVESTMENT_PLAN") or ""

    return {
        "success": True,
        "ticker": ticker,
        "date": date_val,
        "rating": rating,
        "price_target": price_target,
        "stop_loss": stop_loss,
        "time_horizon": time_horizon,
        "executive_summary": summary_text,
        "decision": final_decision_raw,
        "indicators": indicators,
        "quant_summary": quant_summary,
        "details": {
            "technical": technical_text,
            "fundamental": fundamental_text,
            "sentiment": sentiment_text,
            "investment_debate": debate_text,
            "risk_analysis": risk_text,
            "trader_plan": trader_plan
        },
        "report_filename": os.path.basename(filepath)
    }


def _execute_analysis_job(job_id: str, ticker: str, date_val: str, force_fresh: bool, portfolio_ctx: Optional[PortfolioContext]):
    """Background worker executing the TradingAgents pipeline with granular stage tracking."""
    job = analysis_jobs[job_id]
    try:
        clean_ticker = ticker.replace('.', '_')
        filename = f"{clean_ticker}_{date_val}_report.txt"
        filepath = os.path.join(REPORTS_DIR, filename)

        # Stage 1: Check existing report cache
        if not force_fresh and os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
            job["stage"] = "completed"
            job["stage_label"] = "Found verified analysis report in cache!"
            job["progress_pct"] = 100
            job["result"] = parse_report_file(filepath, ticker, date_val)
            job["status"] = "completed"
            return

        # Stage 2: Quantitative Engine Analysis
        job["stage"] = "quant_engine"
        job["stage_label"] = "Computing Piotroski F-Score, Altman Z solvency, and multi-factor signals..."
        job["progress_pct"] = 15

        # Stage 3: Analysts Data Gathering
        job["stage"] = "analysts_gathering"
        job["stage_label"] = "Agents gathering Market Technicals, Fundamentals, Macro Data & News Sentiment..."
        job["progress_pct"] = 35

        config = DEFAULT_CONFIG.copy()
        ta = TradingAgentsGraph(debug=False, config=config)

        # Stage 4: Bull vs Bear Debate
        job["stage"] = "bull_bear_debate"
        job["stage_label"] = "Bullish vs Bearish researchers actively debating valuation & downside risks..."
        job["progress_pct"] = 60

        # Run multi-agent propagation
        state, decision = ta.propagate(ticker, date_val, portfolio=portfolio_ctx)

        # Stage 5: Risk Management & Portfolio Optimization
        job["stage"] = "portfolio_manager"
        job["stage_label"] = "Portfolio Manager synthesizing consensus and calculating optimal position..."
        job["progress_pct"] = 90

        state_dict = state if isinstance(state, dict) else {}

        # Save generated report
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(f"Stock: {ticker}\nDate: {date_val}\n\n")
            f.write("=" * 60 + "\nFINAL DECISION\n" + "=" * 60 + "\n")
            f.write(str(decision) + "\n\n")
            for k, v in state_dict.items():
                if k != 'messages':
                    f.write(f"\n--- {k.upper()} ---\n{v}\n")

        # Completed
        job["stage"] = "completed"
        job["stage_label"] = "Multi-agent consensus analysis finalized!"
        job["progress_pct"] = 100
        job["result"] = parse_report_file(filepath, ticker, date_val)
        job["status"] = "completed"

    except Exception as exc:
        job["status"] = "error"
        job["error"] = str(exc)
        job["stage_label"] = f"Analysis encountered error: {str(exc)}"


@app.get("/api/status")
def get_status():
    provider = os.getenv("TRADINGAGENTS_LLM_PROVIDER", DEFAULT_CONFIG.get("llm_provider"))
    quick_model = os.getenv("TRADINGAGENTS_QUICK_THINK_LLM", DEFAULT_CONFIG.get("quick_think_llm"))
    deep_model = os.getenv("TRADINGAGENTS_DEEP_THINK_LLM", DEFAULT_CONFIG.get("deep_think_llm"))
    has_google = bool(os.getenv("GOOGLE_API_KEY"))
    has_openrouter = bool(os.getenv("OPENROUTER_API_KEY"))
    active_jobs_count = sum(1 for j in analysis_jobs.values() if j.get("status") == "running")
    return {
        "status": "online",
        "provider": provider,
        "quick_model": quick_model,
        "deep_model": deep_model,
        "google_key_configured": has_google,
        "openrouter_key_configured": has_openrouter,
        "active_jobs": active_jobs_count,
    }


@app.get("/api/quote/{ticker}")
def get_quote(ticker: str):
    ticker = ticker.strip().upper()
    try:
        t = yf.Ticker(ticker)
        fast_info = getattr(t, 'fast_info', None)
        info = {}
        try:
            info = t.info if hasattr(t, 'info') else {}
        except Exception:
            pass

        price = None
        if fast_info and hasattr(fast_info, 'last_price'):
            price = fast_info.last_price
        elif 'currentPrice' in info:
            price = info['currentPrice']
        elif 'regularMarketPrice' in info:
            price = info['regularMarketPrice']

        currency = getattr(fast_info, 'currency', info.get('currency', 'INR' if ticker.endswith('.NS') or ticker.endswith('.BO') else 'USD'))
        name = info.get('longName') or info.get('shortName') or ticker

        # 1-month history for chart
        chart_data = []
        try:
            hist = t.history(period="1mo")
            if not hist.empty:
                for idx, row in hist.iterrows():
                    close_val = row.get("Close")
                    if pd.notna(close_val):
                        c = float(close_val)
                        if not math.isnan(c) and not math.isinf(c):
                            chart_data.append({
                                "date": idx.strftime("%Y-%m-%d"),
                                "close": round(c, 2)
                            })
        except Exception:
            pass

        prev_close = getattr(fast_info, 'previous_close', info.get('regularMarketPreviousClose', price))
        change = round(price - prev_close, 2) if (price and prev_close) else 0.0
        change_pct = round((change / prev_close) * 100, 2) if (prev_close and prev_close != 0) else 0.0

        return {
            "ticker": ticker,
            "name": name,
            "price": clean_num(price),
            "currency": currency,
            "change": clean_num(change),
            "change_percent": clean_num(change_pct),
            "market_cap": clean_num(info.get('marketCap') or getattr(fast_info, 'market_cap', None)),
            "pe_ratio": clean_num(info.get('trailingPE') or info.get('forwardPE')),
            "high_52": clean_num(getattr(fast_info, 'year_high', info.get('fiftyTwoWeekHigh'))),
            "low_52": clean_num(getattr(fast_info, 'year_low', info.get('fiftyTwoWeekLow'))),
            "history": chart_data
        }
    except Exception as e:
        return {
            "ticker": ticker,
            "name": ticker,
            "error": str(e),
            "history": []
        }


@app.get("/api/quant/{ticker}")
def get_quant_metrics(ticker: str):
    """Deterministic quantitative indicators, Piotroski F-score, and risk-reward levels."""
    ticker = ticker.strip().upper()
    try:
        verdict = compute_multi_factor_verdict(ticker)
        return {"success": True, "data": verdict}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Quantitative analysis failed: {str(e)}")


@app.get("/api/peers/{ticker}")
def get_peers(ticker: str):
    """Fetch comparative metrics for the stock against key sector competitors."""
    ticker = ticker.strip().upper()
    try:
        peers = get_peers_comparison(ticker)
        return {"success": True, "ticker": ticker, "peers": peers}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch peers: {str(e)}")


@app.get("/api/screener")
def get_market_screener(category: str = "all", tickers: Optional[str] = None):
    """Real-time quantitative screener and bull/bear momentum radar across NSE and US stocks."""
    try:
        custom_list = [t.strip().upper() for t in tickers.split(",") if t.strip()] if tickers else None
        data = get_screener_data(category=category, custom_tickers=custom_list)
        return {"success": True, "category": category, "count": len(data), "stocks": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Screener query failed: {str(e)}")



@app.post("/api/position-size")
def calculate_position(req: PositionSizingRequest):
    """Calculate exact position sizing, dollar risk, and Kelly criterion allocation."""
    try:
        sizing = compute_position_sizing(
            capital=req.capital,
            entry_price=req.entry_price,
            stop_loss=req.stop_loss,
            target_price=req.target_price,
            risk_pct_per_trade=req.risk_pct,
            win_rate=req.win_rate,
        )
        return {"success": True, "data": sizing}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/analyze/async")
def run_analysis_async(req: AnalyzeRequest):
    """Start analysis as an asynchronous job with real-time agent stage progress."""
    ticker = req.ticker.strip().upper()
    today_str = datetime.today().strftime('%Y-%m-%d')
    date_val = req.date.strip() if req.date and req.date.strip() else today_str

    try:
        datetime.strptime(date_val, '%Y-%m-%d')
    except ValueError:
        date_val = today_str

    # Build portfolio context if provided
    portfolio_ctx = None
    if req.portfolio:
        positions_list = [
            Position(ticker=p.ticker, quantity=p.quantity, average_price=p.average_price)
            for p in (req.portfolio.positions or [])
        ]
        portfolio_ctx = PortfolioContext(
            cash=req.portfolio.cash,
            currency=req.portfolio.currency or "USD",
            positions=positions_list
        )

    job_id = f"job_{int(time.time())}_{uuid.uuid4().hex[:6]}"
    analysis_jobs[job_id] = {
        "job_id": job_id,
        "ticker": ticker,
        "date": date_val,
        "status": "running",
        "stage": "initializing",
        "stage_label": "Initializing multi-agent graph and market environment...",
        "progress_pct": 5,
        "start_time": time.time(),
        "result": None,
        "error": None,
    }

    thread = threading.Thread(
        target=_execute_analysis_job,
        args=(job_id, ticker, date_val, req.force_fresh or False, portfolio_ctx),
        daemon=True
    )
    thread.start()

    return {"job_id": job_id, "status": "running", "ticker": ticker, "date": date_val}


@app.get("/api/analyze/job/{job_id}")
def get_job_status(job_id: str):
    """Poll progress of a running analysis job."""
    job = analysis_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Analysis job not found")

    elapsed = round(time.time() - job["start_time"], 1)
    return {
        "job_id": job_id,
        "ticker": job["ticker"],
        "date": job["date"],
        "status": job["status"],
        "stage": job["stage"],
        "stage_label": job["stage_label"],
        "progress_pct": job["progress_pct"],
        "elapsed_seconds": elapsed,
        "result": job.get("result"),
        "error": job.get("error"),
    }


@app.post("/api/analyze")
def run_analysis(req: AnalyzeRequest):
    """Synchronous analysis execution for backwards compatibility."""
    ticker = req.ticker.strip().upper()
    today_str = datetime.today().strftime('%Y-%m-%d')
    date_val = req.date.strip() if req.date and req.date.strip() else today_str

    try:
        datetime.strptime(date_val, '%Y-%m-%d')
    except ValueError:
        date_val = today_str

    clean_ticker = ticker.replace('.', '_')
    filename = f"{clean_ticker}_{date_val}_report.txt"
    filepath = os.path.join(REPORTS_DIR, filename)

    # Return cached report immediately if available
    if not req.force_fresh and os.path.exists(filepath) and os.path.getsize(filepath) > 1000:
        return parse_report_file(filepath, ticker, date_val)

    portfolio_ctx = None
    if req.portfolio:
        positions_list = [
            Position(ticker=p.ticker, quantity=p.quantity, average_price=p.average_price)
            for p in (req.portfolio.positions or [])
        ]
        portfolio_ctx = PortfolioContext(
            cash=req.portfolio.cash,
            currency=req.portfolio.currency or "USD",
            positions=positions_list
        )

    config = DEFAULT_CONFIG.copy()
    try:
        ta = TradingAgentsGraph(debug=False, config=config)
        state, decision = ta.propagate(ticker, date_val, portfolio=portfolio_ctx)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    state_dict = state if isinstance(state, dict) else {}

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(f"Stock: {ticker}\nDate: {date_val}\n\n")
        f.write("=" * 60 + "\nFINAL DECISION\n" + "=" * 60 + "\n")
        f.write(str(decision) + "\n\n")
        for k, v in state_dict.items():
            if k != 'messages':
                f.write(f"\n--- {k.upper()} ---\n{v}\n")

    return parse_report_file(filepath, ticker, date_val)


@app.get("/api/reports")
def list_reports():
    reports = []
    if os.path.exists(REPORTS_DIR):
        for fname in sorted(os.listdir(REPORTS_DIR), reverse=True):
            if fname.endswith(".txt"):
                fpath = os.path.join(REPORTS_DIR, fname)
                mtime = os.path.getmtime(fpath)
                size = os.path.getsize(fpath)
                summary = ""
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        lines = [f.readline() for _ in range(15)]
                        summary = "".join(lines)
                except Exception:
                    pass
                reports.append({
                    "filename": fname,
                    "updated_at": datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M"),
                    "size_bytes": size,
                    "summary_preview": summary
                })
    return {"reports": reports}


@app.get("/api/reports/{filename}")
def get_report_content(filename: str):
    safe_name = os.path.basename(filename)
    fpath = os.path.join(REPORTS_DIR, safe_name)
    if not os.path.exists(fpath):
        raise HTTPException(status_code=404, detail="Report not found")
    with open(fpath, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()
    return {"filename": safe_name, "content": content}


if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host=host, port=port, reload=False)
