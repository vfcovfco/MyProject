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
  isMock?: boolean; // 標記是否為模擬數據
  errorMessage?: string; // 新增：錯誤訊息
}

// 輔助函式：生成模擬數據 (當後端 API 連不上時使用)
const generateMockData = (symbol: string, errorMsg?: string): StockData => {
  const upperSymbol = symbol.toUpperCase();
  const basePrice = Math.floor(Math.random() * 200) + 100;
  const isBull = Math.random() > 0.5;
  
  return {
    symbol: upperSymbol,
    name: `${upperSymbol} (讀取失敗)`,
    price: basePrice,
    change: +(Math.random() * 5 - 2.5).toFixed(2),
    ma200: isBull ? basePrice * 0.9 : basePrice * 1.1,
    ma20Week: isBull ? basePrice * 0.95 : basePrice * 1.05,
    lastUpdated: new Date(),
    isMock: true,
    errorMessage: errorMsg || '連線異常'
  };
};

// 呼叫後端 API (包含錯誤處理與 Fallback 機制)
const fetchRealStockData = async (symbol: string): Promise<StockData | null> => {
  try {
    // 嘗試呼叫後端 API
    // 加上時間戳記避免快取
    const response = await fetch(`/api/stock?symbol=${symbol}&t=${new Date().getTime()}`);
    
    if (!response.ok) {
      // 嘗試讀取後端回傳的錯誤訊息
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'API 回應異常');
    }
    
    const data = await response.json();
    
    // 再次確認後端有沒有回傳錯誤欄位
    if (data.error) {
       throw new Error(data.error);
    }

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
    console.warn(`API 抓取失敗 (${symbol})，原因:`, error);
    // 回傳帶有錯誤訊息的模擬數據
    return generateMockData(symbol, '請檢查 route.ts 的 API Key');
  }
};

export default function Home() {
  const [query, setQuery] = useState('');
  const [watchlist, setWatchlist] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 初始載入
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      const initialStocks = ['NVDA', 'TSLA']; 
      const results = await Promise.all(initialStocks.map(s => fetchRealStockData(s)));
      const validResults = results.filter((s): s is StockData => s !== null);
      setWatchlist(validResults);
      setLoading(false);
    };
    initData();
  }, []);

  const handleAddStock = async () => {
    if (!query) return;
    setLoading(true);
    setError('');
    
    // 檢查重複
    if (watchlist.some(s => s.symbol === query.toUpperCase())) {
      setError('該股票已在清單中');
      setLoading(false);
      return;
    }

    const data = await fetchRealStockData(query);
    if (data) {
      setWatchlist(prev => [...prev, data]);
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
    const refreshed = await Promise.all(watchlist.map(s => fetchRealStockData(s.symbol)));
    const validResults = refreshed.filter((s): s is StockData => s !== null);
    setWatchlist(validResults);
    setLoading(false);
  };

  const checkAlert = (stock: StockData) => {
    // 如果是模擬數據，就不顯示技術指標警報，以免混淆
    if (stock.isMock) return null;

    const belowMA200 = stock.price < stock.ma200;
    const belowMA20Week = stock.price < stock.ma20Week;
    
    if (belowMA200 && belowMA20Week) return { type: 'critical', message: '雙重跌破！價格低於 200日線 與 20週線' };
    if (belowMA200) return { type: 'warning', message: '警報：價格已跌破 200日生命線' };
    if (belowMA20Week) return { type: 'warning', message: '警報：價格已跌破 20週中期均線' };
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent flex items-center gap-2">
              <TrendingUp className="text-blue-400" />
              美股技術指標監控
            </h1>
            <p className="text-slate-400 mt-1">即時監控 MA200 (年線) 與 MA20-Week (週線) 支撐位</p>
          </div>
          <button 
            onClick={refreshAll}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-sm border border-slate-700"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            更新報價
          </button>
        </div>

        {/* Search Bar */}
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 mb-8 backdrop-blur-sm">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="輸入美股代號 (例如: AAPL, AMD)..." 
                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-slate-500"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddStock()}
              />
            </div>
            <button 
              onClick={handleAddStock}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={20} />
              <span className="hidden sm:inline">新增監控</span>
            </button>
          </div>
          {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
        </div>

        {/* Watchlist Grid */}
        <div className="grid grid-cols-1 gap-4">
          {watchlist.length === 0 && !loading && (
            <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
              尚無監控股票，請在上方輸入代號加入。
            </div>
          )}
          
          {watchlist.map((stock) => {
            const alert = checkAlert(stock);
            const isAlerting = alert !== null;
            const diff200 = ((stock.price - stock.ma200) / stock.ma200) * 100;
            const diff20Week = ((stock.price - stock.ma20Week) / stock.ma20Week) * 100;
            
            return (
              <div 
                key={stock.symbol} 
                className={`
                  relative bg-slate-800 rounded-xl p-5 border transition-all duration-300
                  ${stock.isMock ? 'border-yellow-600/50 bg-slate-800/80' : 
                    isAlerting 
                      ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
                      : 'border-slate-700 hover:border-slate-500'}
                `}
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  
                  {/* Stock Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold">{stock.symbol}</h2>
                      <span className="text-slate-400 text-sm">{stock.name}</span>
                      
                      {/* 錯誤提示標籤 */}
                      {stock.isMock ? (
                        <span className="bg-yellow-900/40 text-yellow-200 text-[10px] px-2 py-0.5 rounded-full border border-yellow-700/50 flex items-center gap-1">
                          <AlertCircle size={10} />
                          {stock.errorMessage}
                        </span>
                      ) : null}

                      {isAlerting && (
                        <span className="animate-pulse bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded-full border border-red-500/30 flex items-center gap-1 font-bold">
                          <AlertTriangle size={12} />
                          {alert.type === 'critical' ? '強烈賣訊/警示' : '跌破支撐'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-mono font-semibold">${stock.price.toFixed(2)}</span>
                      <span className={`text-sm font-medium ${stock.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                       更新時間: {stock.lastUpdated.toLocaleTimeString()}
                    </div>
                  </div>

                  {/* Indicators */}
                  <div className="flex gap-4 w-full md:w-auto">
                    {/* MA200 Indicator */}
                    <div className={`flex-1 md:flex-none p-3 rounded-lg border ${stock.price < stock.ma200 ? 'bg-red-900/20 border-red-800' : 'bg-slate-900/50 border-slate-700'}`}>
                      <div className="text-xs text-slate-400 mb-1">MA 200 (日)</div>
                      <div className={`font-mono text-lg ${stock.price < stock.ma200 ? 'text-red-400 font-bold' : 'text-slate-200'}`}>
                        ${stock.ma200.toFixed(2)}
                      </div>
                      <div className={`text-[10px] mt-1 ${diff200 < 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {diff200 < 0 ? `低於 ${Math.abs(diff200).toFixed(1)}%` : `高於 ${diff200.toFixed(1)}%`}
                      </div>
                    </div>

                    {/* MA20 Week Indicator */}
                    <div className={`flex-1 md:flex-none p-3 rounded-lg border ${stock.price < stock.ma20Week ? 'bg-orange-900/20 border-orange-800' : 'bg-slate-900/50 border-slate-700'}`}>
                      <div className="text-xs text-slate-400 mb-1">MA 20 (週)</div>
                      <div className={`font-mono text-lg ${stock.price < stock.ma20Week ? 'text-orange-400 font-bold' : 'text-slate-200'}`}>
                        ${stock.ma20Week.toFixed(2)}
                      </div>
                      <div className={`text-[10px] mt-1 ${diff20Week < 0 ? 'text-orange-400' : 'text-green-400'}`}>
                        {diff20Week < 0 ? `低於 ${Math.abs(diff20Week).toFixed(1)}%` : `高於 ${diff20Week.toFixed(1)}%`}
                      </div>
                    </div>
                  </div>

                  {/* Delete Button */}
                  <button 
                    onClick={() => handleRemoveStock(stock.symbol)}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>

                {isAlerting && (
                  <div className="mt-4 p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center gap-2 text-red-200 text-sm">
                    <Info size={16} />
                    {alert.message} — 請注意風險管理
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}