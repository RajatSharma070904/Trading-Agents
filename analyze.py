import os
import sys
import re

# Force UTF-8 encoding on Windows to prevent UnicodeEncodeError with emojis
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from datetime import datetime
from dotenv import load_dotenv

# Load .env
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.trading_graph import TradingAgentsGraph

def validate_date(date_str, default_date):
    if not date_str:
        return default_date
    try:
        # Check YYYY-MM-DD
        valid_date = datetime.strptime(date_str.strip(), '%Y-%m-%d')
        return valid_date.strftime('%Y-%m-%d')
    except ValueError:
        print(f'[!] Note: \"{date_str}\" is not in YYYY-MM-DD format. Auto-using today\'s date: {default_date}')
        return default_date

def main():
    print('=' * 60)
    print('   ALPHASWARM AI - MULTI-AGENT QUANTITATIVE SYSTEM')
    print('=' * 60)
    
    # Check if ticker passed as command line argument (e.g. python analyze.py RELIANCE.NS)
    if len(sys.argv) > 1 and sys.argv[1].strip():
        ticker = sys.argv[1].strip().upper()
        print(f'Stock Ticker selected: {ticker}')
    else:
        try:
            ticker = input('\nEnter Stock Ticker (e.g. RELIANCE.NS, TCS.NS, NVDA, AAPL) [Default: NVDA]: ').strip().upper()
        except (EOFError, KeyboardInterrupt):
            ticker = ''
        if not ticker:
            ticker = 'NVDA'
            print(f'Defaulting to: {ticker}')
            
    today_str = datetime.today().strftime('%Y-%m-%d')
    if len(sys.argv) > 2 and sys.argv[2].strip():
        raw_date = sys.argv[2].strip()
    else:
        try:
            raw_date = input(f'Enter Analysis Date (YYYY-MM-DD) [Press Enter for today: {today_str}]: ').strip()
        except (EOFError, KeyboardInterrupt):
            raw_date = ''
            
    date_input = validate_date(raw_date, today_str)
            
    print(f'\n[+] Starting multi-agent analysis for {ticker} as of {date_input}...')
    print('[+] Agents activated: Technical Analyst, Fundamental Analyst, News Analyst, Bull/Bear Researchers, Risk Manager.')
    print('[+] Please wait while agents debate and formulate decision...\n')
    
    config = DEFAULT_CONFIG.copy()
    ta = TradingAgentsGraph(debug=True, config=config)
    
    try:
        state, decision = ta.propagate(ticker, date_input)
    except Exception as e:
        print(f'\n[!] Error during analysis: {e}')
        if 'Rate limit' in str(e) or '429' in str(e):
            print('\n[TIP] OpenRouter daily free limit (50 requests) reach ho gayi hai.')
            print('[TIP] Google Gemini API key use karein (1,500 free requests daily): https://aistudio.google.com')
        return
        
    print('\n' + '=' * 60)
    print('                FINAL AGENTS RECOMMENDATION')
    print('=' * 60)
    print(decision)
    print('=' * 60)
    
    # Save report
    os.makedirs('reports', exist_ok=True)
    clean_ticker = ticker.replace('.', '_')
    report_file = os.path.join('reports', f'{clean_ticker}_{date_input}_report.txt')
    with open(report_file, 'w', encoding='utf-8') as f:
        f.write(f'Stock: {ticker}\nDate: {date_input}\n\n')
        f.write('=' * 60 + '\nFINAL DECISION\n' + '=' * 60 + '\n')
        f.write(str(decision) + '\n\n')
        if isinstance(state, dict):
            for k, v in state.items():
                if k != 'messages':
                    f.write(f'\n--- {k.upper()} ---\n{v}\n')
                    
    print(f'\n[OK] Full detailed report saved to: {report_file}')

if __name__ == '__main__':
    main()
