import requests
import yfinance as yf
import os
from datetime import datetime

# 從 GitHub Secrets 讀取環境變數
LINE_ACCESS_TOKEN = os.environ.get('LINE_CHANNEL_ACCESS_TOKEN')
LINE_USER_ID = os.environ.get('LINE_USER_ID')

# 監控清單
WATCHLIST = ['NVDA', 'TSLA', 'AAPL', 'META', 'AMZN', 'MSFT', 'GOOGL', 'TSM', 'AVGO', 'QQQ', 'SPY', 'IBIT', 'ETHA', 'UNH', 'AMD']

def send_line_push(message_text):
    if not LINE_ACCESS_TOKEN or not LINE_USER_ID:
        print("錯誤：未設定 LINE_ACCESS_TOKEN 或 LINE_USER_ID")
        return

    url = "https://api.line.me/v2/bot/message/push"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {LINE_ACCESS_TOKEN}"
    }
    payload = {
        "to": LINE_USER_ID,
        "messages": [{"type": "text", "text": message_text}]
    }

    try:
        response = requests.post(url, headers=headers, json=payload)
        response.raise_for_status()
        print("LINE 訊息發送成功！")
    except Exception as e:
        print(f"發送失敗: {e}")

def check_stock(symbol):
    try:
        stock = yf.Ticker(symbol)
        df = stock.history(period="1y") # 抓 1 年數據
        
        if len(df) < 20: return f"{symbol}: 數據不足"

        current_price = df['Close'].iloc[-1]
        # 計算簡單的漲跌 (跟昨天比)
        prev_close = df['Close'].iloc[-2]
        change_pct = ((current_price - prev_close) / prev_close) * 100
        
        # 判斷符號
        icon = "🔴" if change_pct < 0 else "🟢"
        
        return f"{icon} {symbol}: ${current_price:.2f} ({change_pct:+.2f}%)"
        
    except Exception as e:
        print(f"Error: {e}")
        return f"❌ {symbol}: 讀取失敗"

if __name__ == "__main__":
    today = datetime.now().strftime('%Y-%m-%d')
    
    # 標題
    report = f"📅 美股日報 ({today})\n----------------\n"
    
    # 收集所有股票狀態
    for symbol in WATCHLIST:
        status = check_stock(symbol)
        report += status + "\n"
            
    report += "\n✅ 系統運作正常！"
    
    # 🔥 強制發送訊息 (不管有沒有跌破)
    send_line_push(report)