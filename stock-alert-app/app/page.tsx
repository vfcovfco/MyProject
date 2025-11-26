'use client'; 

import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, TrendingUp, AlertTriangle, RefreshCw, Info, AlertCircle } from 'lucide-react';

// 定義股票資料介面
interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  ma200: number; 
  ma20Week: number;
  lastUpdated: Date;
  isMock?: boolean;
  errorMessage?: string;
}

// 輔助函式：生成模擬數據 (萬一後端掛掉時的備案)
const generateMockData = (symbol: string, errorMsg?: string): StockData => {
  const upperSymbol = symbol.toUpperCase();
  const basePrice = Math.floor(Math.random() * 200) + 100;
  
  return {
    symbol: upperSymbol,
    name: `${upperSymbol} (讀取失敗)`,
    price: basePrice,
    change: 0,
    ma200: basePrice * 0.9,
    ma20Week: basePrice * 0.95,
    lastUpdated: new Date(),
    isMock: true,
    errorMessage: errorMsg || '未知錯誤'
  };
};

// 呼叫後端 API
const fetchRealStockData = async (symbol: string): Promise<StockData | null> => {
  try {
    // 加上時間戳記，避免瀏覽器快取舊資料
    const response = await fetch(`/api/stock?symbol=${symbol}&t=${new Date().getTime()}`);
    
    // 如果後端回傳錯誤 (404/500)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // 抓取後端傳來的具體錯誤訊息
      const realErrorMsg = errorData.error || `伺服器錯誤: ${response.status}`;
      throw new Error(realErrorMsg);
    }
    
    const data = await response.json();
    
    // 檢查資料正確性
    if (data.error) throw new Error(data.error);

    return { 
      symbol: data.symbol,
      name: data.name,
      price: data.price,
      change: data.change,
      ma200: data.ma200,
      ma20Week: data.ma20Week,
      lastUpdated: new Date(data.lastUpdated),
      isMock: false 
    };
  } catch (error: any) {
    console.warn(`API 抓取失敗 (${symbol})`, error);
    return generateMockData(symbol, error.message);
  }
};

export default function Home() {
  const [query, setQuery] = useState('');
  const [watchlist, setWatchlist] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // 標記是否已從 localStorage 讀取完畢 (避免畫面閃爍)
  const [initialized, setInitialized] = useState(false);

  // 1. 初始化：網頁打開時，先去讀取 localStorage 的存檔
  useEffect(() => {
    const loadSavedData = async () => {
      setLoading(true);
      
      // 嘗試讀取瀏覽器硬碟裡的 'myStockList'
      const saved = localStorage.getItem('myStockList');
      let symbolsToLoad = ['NVDA', 'TSLA']; // 預設值 (如果沒存檔過)

      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            symbolsToLoad = parsed;
          }
        } catch (e) {
          console.error('讀取存檔失敗', e);
        }
      }

      // 根據代號去抓最新股價
      const uniqueInitial = Array.from(new Set(symbolsToLoad));
      const results = await Promise.all(uniqueInitial.map(s => fetchRealStockData(s)));
      const validResults = results.filter((s): s is StockData => s !== null);
      
      setWatchlist(validResults);
      setLoading(false);
      setInitialized(true); // 標記初始化完成，可以開始監聽存檔了
    };

    loadSavedData();
  }, []); 

  // 2. 自動存檔：只要清單有變動，就自動存入 localStorage
  useEffect(() => {
    if (initialized) {
      const symbolsOnly = watchlist.map(s => s.symbol);
      localStorage.setItem('myStockList', JSON.stringify(symbolsOnly));
    }
  }, [watchlist, initialized]);

  const handleAddStock = async () => {
    if (!query) return;
    const targetSymbol = query.toUpperCase();
    
    // 防呆：檢查是否已存在
    if (watchlist.some(s => s.symbol === targetSymbol)) {
      setError('該股票已在清單中');
      return;
    }
    
    setLoading(true);
    setError('');
    
    const data = await fetchRealStockData(targetSymbol);
    
    if (data) {
      setWatchlist(prev => {
        // 二次檢查防止競速狀態
        if (prev.some(s => s.symbol === data.symbol)) return prev;
        return [...prev, data];
      });
      setQuery('');
    } else {
      setError('找不到該股票');
    }
    setLoading(false);
  };

  const handleRemoveStock = (symbol: string) => {
    setWatchlist(prev => prev.filter(s => s.symbol !== symbol));
  };

  const refreshAll = async () => {
    setLoading(true);
    const currentSymbols = watchlist.map(s => s.symbol);
    const refreshed = await Promise.all(currentSymbols.map(s => fetchRealStockData(s)));
    const validResults = refreshed.filter((s): s is StockData => s !== null);
    setWatchlist(validResults);
    setLoading(false);
  };

  const checkAlert = (stock: StockData) => {
    if (stock.isMock) return null;
    const belowMA200 = stock.price < stock.ma200;
    const belowMA20Week = stock.price < stock.ma20Week;
    if (belowMA200 && belowMA20Week) return { type: 'critical', message: '雙重跌破！' };
    if (belowMA200) return { type: 'warning', message: '跌破年線' };
    if (belowMA20Week) return { type: 'warning', message: '跌破週線' };
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-blue-400 flex items-center gap-2">
            <TrendingUp /> 美股技術指標監控
          </h1>
          <button onClick={refreshAll} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> 更新報價
          </button>
        </div>

        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-8 flex gap-2 backdrop-blur-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="輸入代號 (如 AAPL)..." 
              className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddStock()}
            />
          </div>
          <button onClick={handleAddStock} disabled={loading} className="bg-blue-600 hover:bg-blue-500 px-6 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50">
            <Plus /> 新增
          </button>
        </div>
        {error && <p className="text-red-400 mb-4 text-sm bg-red-900/20 p-2 rounded border border-red-900/50">{error}</p>}

        <div className="grid gap-4">
          {watchlist.length === 0 && !loading && (
             <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
               尚無股票，請新增代號開始監控
             </div>
          )}
          
          {watchlist.map((stock) => {
            const alert = checkAlert(stock);
            // 計算乖離率
            const diff200 = ((stock.price - stock.ma200) / stock.ma200) * 100;
            const diff20Week = ((stock.price - stock.ma20Week) / stock.ma20Week) * 100;

            return (
              <div key={stock.symbol} className={`bg-slate-800 rounded-xl p-5 border transition-all ${stock.isMock ? 'border-yellow-600/50' : alert ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-slate-700'}`}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold">{stock.symbol}</h2>
                      <span className="text-slate-400 text-sm">{stock.name}</span>
                      {stock.isMock && (
                        <span className="bg-yellow-900/40 text-yellow-200 text-[10px] px-2 py-0.5 rounded-full border border-yellow-700/50 flex items-center gap-1">
                          <AlertCircle size={10} />
                          {stock.errorMessage}
                        </span>
                      )}
                      {alert && <span className="text-red-400 text-xs px-2 py-1 border border-red-500/30 rounded-full font-bold animate-pulse">{alert.message}</span>}
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-mono font-semibold">${stock.price.toFixed(2)}</span>
                      <span className={`text-sm font-medium ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-600 mt-1">更新: {stock.lastUpdated.toLocaleTimeString()}</div>
                  </div>
                  
                  <div className="flex gap-4 w-full md:w-auto">
                     <div className={`flex-1 md:flex-none p-3 rounded-lg border ${stock.price < stock.ma200 ? 'bg-red-900/20 border-red-800' : 'bg-slate-900/50 border-slate-700'}`}>
                        <div className="text-xs text-slate-400">MA 200 (日)</div>
                        <div className={`font-mono text-lg ${stock.price < stock.ma200 ? 'text-red-400 font-bold' : 'text-slate-200'}`}>${stock.ma200.toFixed(2)}</div>
                        <div className={`text-[10px] mt-1 ${diff200 < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {diff200 < 0 ? `低於 ${Math.abs(diff200).toFixed(1)}%` : `高於 ${diff200.toFixed(1)}%`}
                        </div>
                     </div>
                     <div className={`flex-1 md:flex-none p-3 rounded-lg border ${stock.price < stock.ma20Week ? 'bg-orange-900/20 border-orange-800' : 'bg-slate-900/50 border-slate-700'}`}>
                        <div className="text-xs text-slate-400">MA 20 (週)</div>
                        <div className={`font-mono text-lg ${stock.price < stock.ma20Week ? 'text-orange-400 font-bold' : 'text-slate-200'}`}>${stock.ma20Week.toFixed(2)}</div>
                        <div className={`text-[10px] mt-1 ${diff20Week < 0 ? 'text-orange-400' : 'text-green-400'}`}>
                          {diff20Week < 0 ? `低於 ${Math.abs(diff20Week).toFixed(1)}%` : `高於 ${diff20Week.toFixed(1)}%`}
                        </div>
                     </div>
                     <button onClick={() => handleRemoveStock(stock.symbol)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"><Trash2 size={20} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}