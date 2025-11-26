import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: '缺少股票代號' }, { status: 400 });
  }

  try {
    // 🔥 改用 Yahoo Finance 的公開 API (不需要 API Key)
    // 我們抓取過去 2 年的數據，確保有足夠的天數計算均線
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2y`;

    const res = await fetch(yahooUrl, {
      headers: {
        // 偽裝成瀏覽器，避免被 Yahoo 擋擋
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
        throw new Error(`Yahoo API Error: ${res.status}`);
    }

    const data = await res.json();
    const result = data.chart.result?.[0];

    if (!result) {
        return NextResponse.json({ error: '找不到該股票' }, { status: 404 });
    }

    // 1. 解析 Yahoo 回傳的數據
    const meta = result.meta;
    const quotes = result.indicators.quote[0];
    const closes = quotes.close;

    // 過濾掉無效數據 (Yahoo 有時會有 null)，並反轉陣列 (讓最新的在前面)
    const validCloses = closes
      .filter((c: number | null) => c !== null)
      .reverse(); 

    const currentPrice = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose;
    const changePercent = ((currentPrice - prevClose) / prevClose) * 100;

    // 2. 計算均線
    let ma200 = currentPrice;
    let ma20Week = currentPrice;

    if (validCloses.length > 0) {
        // 計算 MA200 (200日均線)
        const days200 = validCloses.slice(0, 200);
        if (days200.length > 0) {
             ma200 = days200.reduce((a:number, b:number) => a + b, 0) / days200.length;
        }

        // 計算 MA20週 (約等於 100 個交易日)
        const days100 = validCloses.slice(0, 100);
        if (days100.length > 0) {
             ma20Week = days100.reduce((a:number, b:number) => a + b, 0) / days100.length;
        }
    }

    // 3. 回傳給前端
    return NextResponse.json({
      symbol: meta.symbol,
      name: meta.shortName || meta.symbol, // Yahoo 給的是公司簡稱
      price: currentPrice,
      change: changePercent,
      ma200: ma200,
      ma20Week: ma20Week,
      lastUpdated: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Yahoo API Error:', error);
    return NextResponse.json({ error: '獲取數據失敗 (Yahoo API)' }, { status: 500 });
  }
}