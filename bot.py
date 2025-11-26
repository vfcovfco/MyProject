import requests
import yfinance as yf
import os
from datetime import datetime

# 從 GitHub Secrets 讀取環境變數
LINE_ACCESS_TOKEN = os.environ.get('LINE_CHANNEL_ACCESS_TOKEN')
LINE_USER_ID = os.environ.get('LINE_USER_ID')

# 監控清單
WATCHLIST = ['NVDA', 'TSLA', 'AAPL', 'AMD']

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
    print(f"分析 {symbol} 中...")
    try:
        stock = yf.Ticker(symbol)
        df = stock.history(period="2y") 
        
        if len(df) < 200: return None

        current_price = df['Close'].iloc[-1]
        ma200 = df['Close'].rolling(window=200).mean().iloc[-1]
        ma20_week = df['Close'].rolling(window=100).mean().iloc[-1]

        alerts = []
        if current_price < ma200:
            diff = ((ma200 - current_price) / ma200) * 100
            alerts.append(f"⚠️ 跌破年線 (低於 {diff:.1f}%)")
        if current_price < ma20_week:
            diff = ((ma20_week - current_price) / ma20_week) * 100
            alerts.append(f"⚠️ 跌破週線 (低於 {diff:.1f}%)")
            
        if alerts:
            return f"\n【{symbol}】${current_price:.2f}\n" + "\n".join(alerts)
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    today = datetime.now().strftime('%Y-%m-%d')
    report_content = ""
    
    for symbol in WATCHLIST:
        alert_msg = check_stock(symbol)
        if alert_msg:
            report_content += alert_msg + "\n"
            
    if report_content:
        final_msg = f"📊 美股警報 ({today})\n----------------{report_content}\n請注意風險控制！"
        send_line_push(final_msg)
    else:
        print("今日無警報")