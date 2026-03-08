const { useState, useEffect, useRef } = React;

const API_BASE = "http://localhost:5000/api";
const BYBIT_WS = "wss://stream.bybit.com/v5/public/linear";
const BYBIT_API = "https://api.bybit.com/v5/market";
const USDJPY_RATE = 150; // 簡易的なUSD/JPY換算レート
const LOGIN_PATH = "/login";

const SYMBOL_CONFIG = {
  BTCUSDT: {
    label: "BTC/JPY",
    asset: "BTC",
    orderBookStep: 500,
    orderBookBaseAmount: 0.03,
    fallbackPriceJpy: 15000000,
  },
  ETHUSDT: {
    label: "ETH/JPY",
    asset: "ETH",
    orderBookStep: 50,
    orderBookBaseAmount: 0.5,
    fallbackPriceJpy: 500000,
  },
  XRPUSDT: {
    label: "XRP/JPY",
    asset: "XRP",
    orderBookStep: 0.2,
    orderBookBaseAmount: 120,
    fallbackPriceJpy: 90,
  },
  SOLUSDT: {
    label: "SOL/JPY",
    asset: "SOL",
    orderBookStep: 10,
    orderBookBaseAmount: 1.8,
    fallbackPriceJpy: 15000,
  },
  USDCUSDT: {
    label: "USDC/JPY",
    asset: "USDC",
    orderBookStep: 0.1,
    orderBookBaseAmount: 200,
    fallbackPriceJpy: 150,
  },
};

const SYMBOL_OPTIONS = Object.entries(SYMBOL_CONFIG).map(([value, meta]) => ({
  value,
  label: meta.label,
  asset: meta.asset,
}));

function getSymbolMeta(symbol) {
  const fallback = SYMBOL_OPTIONS[0];
  const option = SYMBOL_OPTIONS.find((candidate) => candidate.value === symbol);
  const resolved = option || fallback;
  return {
    ...resolved,
    ...SYMBOL_CONFIG[resolved.value],
  };
}

// Bybit REST APIから過去のKlineデータを取得
async function fetchBybitKlineData(symbol, interval, limit = 200) {
  try {
    const endTime = Date.now();
    const response = await fetch(
      `${BYBIT_API}/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}&end=${endTime}`,
    );
    const data = await response.json();

    if (data.retCode !== 0 || !data.result || !data.result.list) {
      console.error("Bybit API error:", data);
      return [];
    }

    // Bybitのデータは降順で返されるので昇順に変換
    return data.result.list.reverse().map((item) => ({
      time: parseInt(item[0]), // timestamp in ms
      open: parseFloat(item[1]) * USDJPY_RATE,
      high: parseFloat(item[2]) * USDJPY_RATE,
      low: parseFloat(item[3]) * USDJPY_RATE,
      close: parseFloat(item[4]) * USDJPY_RATE,
      volume: parseFloat(item[5]),
    }));
  } catch (error) {
    console.error("Bybit Kline fetch error:", error);
    return [];
  }
}

// Bybit intervalマッピング (Reactコンポーネント用 -> Bybit API用)
function getBybitInterval(interval) {
  const intervalMap = {
    1: "1",
    5: "5",
    15: "15",
    30: "30",
    60: "60",
    240: "240",
    D: "D",
  };
  return intervalMap[interval] || "60";
}

// 左サイドメニューコンポーネント
function SideMenu({ activeMenu, setActiveMenu }) {
  const menuItems = [
    { id: "chart", icon: "", label: "チャート" },
    { id: "trade", icon: "", label: "注文パネル" },
    { id: "assets", icon: "", label: "資産状況" },
    { id: "deposit", icon: "", label: "入金" },
    { id: "withdrawal", icon: "", label: "出金" },
    { id: "history", icon: "", label: "取引履歴" },
  ];

  return (
    <div className="side-menu">
      <div className="side-menu-header"></div>
      {menuItems.map((item) => (
        <div
          key={item.id}
          className={`menu-item ${activeMenu === item.id ? "active" : ""}`}
          onClick={() => setActiveMenu(item.id)}
        >
          <span className="menu-icon">{item.icon}</span>
          <span className="menu-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// 価格ティッカーコンポーネント
function PriceTicker({ assetPrices }) {
  const prices = [
    { pair: "BTC/JPY", price: (assetPrices?.BTC || 15234567).toLocaleString(), change: "+2.34%", up: true },
    { pair: "ETH/JPY", price: (assetPrices?.ETH || 512345).toLocaleString(), change: "+1.23%", up: true },
    { pair: "XRP/JPY", price: (assetPrices?.XRP || 78).toLocaleString(), change: "-0.56%", up: false },
  ];

  return (
    <div className="price-ticker">
      {prices.map((p, i) => (
        <div key={i} className="ticker-item">
          <span className="pair-name">{p.pair}</span>
          <span className="price">{p.price}</span>
          <span className={`change ${p.up ? "up" : "down"}`}>{p.change}</span>
        </div>
      ))}
    </div>
  );
}

// オーダーブック風コンポーネント
function OrderBook({ selectedSymbol, currentPrice }) {
  const symbolMeta = getSymbolMeta(selectedSymbol);
  const step = symbolMeta.orderBookStep;
  const baseAmount = symbolMeta.orderBookBaseAmount;
  const centerPrice =
    currentPrice && currentPrice > 0
      ? currentPrice
      : symbolMeta.fallbackPriceJpy;

  const roundPrice = (price) => {
    if (centerPrice >= 10000) {
      return Math.round(price);
    }
    if (centerPrice >= 100) {
      return Math.round(price * 10) / 10;
    }
    return Math.round(price * 100) / 100;
  };

  const sellOrders = Array.from({ length: 5 }, (_, index) => {
    const level = 5 - index;
    const price = roundPrice(centerPrice + step * level);
    const amount = Number((baseAmount * (1 + index * 0.25)).toFixed(4));
    return { price, amount, total: price * amount };
  });

  const buyOrders = Array.from({ length: 5 }, (_, index) => {
    const level = index + 1;
    const price = roundPrice(centerPrice - step * level);
    const amount = Number((baseAmount * (1 + (4 - index) * 0.25)).toFixed(4));
    return { price, amount, total: price * amount };
  });

  return (
    <div className="orderbook">
      <div className="orderbook-header">
        <h3>オーダーブック ({symbolMeta.label})</h3>
      </div>
      <div className="orderbook-content">
        <div className="orders sell-orders">
          {sellOrders.map((order, i) => (
            <div key={i} className="order-row">
              <span className="price sell">{order.price.toLocaleString()}</span>
              <span className="amount">{order.amount.toFixed(4)}</span>
            </div>
          ))}
        </div>
        <div className="spread">
          <span className="spread-label">スプレッド</span>
          <span className="spread-value">1,000</span>
        </div>
        <div className="orders buy-orders">
          {buyOrders.map((order, i) => (
            <div key={i} className="order-row">
              <span className="price buy">{order.price.toLocaleString()}</span>
              <span className="amount">{order.amount.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 最近の取引コンポーネント
function RecentTrades({ currentPrice }) {
  const base = currentPrice || 15000000;
  
  // currentPrice周辺で適当な取引履歴を生成（デモ用）
  const trades = [
    { time: "15:23:45", price: base + base * 0.0001, amount: 0.0234, type: "buy" },
    { time: "15:23:42", price: base - base * 0.0001, amount: 0.1523, type: "sell" },
    { time: "15:23:38", price: base + base * 0.0002, amount: 0.0892, type: "buy" },
    { time: "15:23:35", price: base - base * 0.00015, amount: 0.2341, type: "sell" },
    { time: "15:23:31", price: base + base * 0.00005, amount: 0.0456, type: "buy" },
    { time: "15:23:28", price: base - base * 0.00005, amount: 0.1234, type: "buy" },
  ];

  return (
    <div className="recent-trades">
      <div className="trades-header">
        <h3>最近の取引</h3>
      </div>
      <div className="trades-list">
        <div className="trades-header-row">
          <span>時刻</span>
          <span>価格</span>
          <span>数量</span>
        </div>
        {trades.map((trade, i) => (
          <div key={i} className={`trade-row ${trade.type}`}>
            <span className="time">{trade.time}</span>
            <span className="price">{Math.round(trade.price).toLocaleString()}</span>
            <span className="amount">{trade.amount.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// チャートコンポーネント - Bybit WebSocketとREST APIを使用
function PriceChart({
  interval,
  chartType = "candle",
  selectedSymbol,
  layoutKey,
  onSymbolChange,
}) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const wsRef = useRef(null);
  const [klineData, setKlineData] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(null);
  const [wsStatus, setWsStatus] = useState("disconnected");
  const symbolMeta = getSymbolMeta(selectedSymbol);

  // 過去データを読み込み
  useEffect(() => {
    let mounted = true;

    const loadHistoricalData = async () => {
      const bybitInterval = getBybitInterval(interval);
      const data = await fetchBybitKlineData(selectedSymbol, bybitInterval);

      if (mounted && data.length > 0) {
        setKlineData(data);

        const latestCandle = data[data.length - 1];
        const oldestCandle = data[0];
        setCurrentPrice(latestCandle.close);
        setPriceChange(
          (
            ((latestCandle.close - oldestCandle.close) / oldestCandle.close) *
            100
          ).toFixed(2),
        );
      }
    };

    loadHistoricalData();

    return () => {
      mounted = false;
    };
  }, [interval, selectedSymbol]);

  // WebSocket接続でリアルタイム更新
  useEffect(() => {
    let ws = null;
    let reconnectTimer = null;
    let mounted = true;

    const connect = () => {
      if (!mounted) return;

      try {
        ws = new WebSocket(BYBIT_WS);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mounted) return;
          console.log("Bybit WebSocket connected");
          setWsStatus("connected");

          const bybitInterval = getBybitInterval(interval);
          const subscribeMsg = {
            op: "subscribe",
            args: [`kline.${bybitInterval}.${selectedSymbol}`],
          };
          ws.send(JSON.stringify(subscribeMsg));
        };

        ws.onmessage = (event) => {
          if (!mounted) return;

          try {
            const message = JSON.parse(event.data);

            if (
              message.topic &&
              message.topic.startsWith("kline") &&
              message.data
            ) {
              const klineArray = message.data;

              klineArray.forEach((k) => {
                const newCandle = {
                  time: k.start,
                  open: parseFloat(k.open) * USDJPY_RATE,
                  high: parseFloat(k.high) * USDJPY_RATE,
                  low: parseFloat(k.low) * USDJPY_RATE,
                  close: parseFloat(k.close) * USDJPY_RATE,
                  volume: parseFloat(k.volume),
                  confirm: k.confirm,
                };

                setKlineData((prevData) => {
                  const existingIndex = prevData.findIndex(
                    (candle) => candle.time === newCandle.time,
                  );

                  if (existingIndex >= 0) {
                    // 既存のキャンドルを更新
                    const updated = [...prevData];
                    updated[existingIndex] = newCandle;
                    return updated;
                  } else {
                    // 新しいキャンドルを追加
                    return [...prevData, newCandle];
                  }
                });

                setCurrentPrice(newCandle.close);
              });
            }
          } catch (error) {
            console.error("WebSocket message parse error:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          setWsStatus("error");
        };

        ws.onclose = () => {
          console.log("Bybit WebSocket closed");
          setWsStatus("disconnected");

          if (mounted) {
            // 5秒後に再接続
            reconnectTimer = setTimeout(() => {
              if (mounted) {
                console.log("Reconnecting to Bybit WebSocket...");
                connect();
              }
            }, 5000);
          }
        };
      } catch (error) {
        console.error("WebSocket connection error:", error);
        setWsStatus("error");
      }
    };

    connect();

    return () => {
      mounted = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [interval, selectedSymbol]);

  // Chart.jsでチャートを描画
  useEffect(() => {
    if (!chartRef.current || klineData.length === 0) return;

    const ctx = chartRef.current.getContext("2d");

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    if (chartType === "candle") {
      chartInstance.current = new Chart(ctx, {
        type: "candlestick",
        data: {
          datasets: [
            {
              label: symbolMeta.label,
              data: klineData.map((k) => ({
                x: k.time,
                o: k.open,
                h: k.high,
                l: k.low,
                c: k.close,
              })),
              color: {
                up: "#26a69a",
                down: "#ef5350",
                unchanged: "#999",
              },
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: {
              bottom: 10,
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              mode: "index",
              intersect: false,
            },
          },
          scales: {
            x: {
              type: "time",
              time: {
                unit:
                  interval === "1" || interval === "5"
                    ? "minute"
                    : interval === "D"
                      ? "day"
                      : "hour",
              },
              ticks: {
                color: "#888",
                padding: 5,
                autoSkip: true,
                maxRotation: 0,
                minRotation: 0,
              },
              grid: { color: "#2a2b2e" },
            },
            y: {
              ticks: {
                color: "#888",
                padding: 5,
              },
              grid: { color: "#2a2b2e" },
            },
          },
        },
      });
    } else {
      chartInstance.current = new Chart(ctx, {
        type: "line",
        data: {
          labels: klineData.map((k) => k.time),
          datasets: [
            {
              label: symbolMeta.label,
              data: klineData.map((k) => k.close),
              borderColor: "#4a9eff",
              backgroundColor: "rgba(74, 158, 255, 0.1)",
              fill: true,
              tension: 0.1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: {
            padding: {
              bottom: 10,
            },
          },
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: {
              type: "time",
              time: {
                unit:
                  interval === "1" || interval === "5"
                    ? "minute"
                    : interval === "D"
                      ? "day"
                      : "hour",
              },
              ticks: {
                color: "#888",
                padding: 5,
                autoSkip: true,
                maxRotation: 0,
                minRotation: 0,
              },
              grid: { color: "#2a2b2e" },
            },
            y: {
              ticks: {
                color: "#888",
                padding: 5,
              },
              grid: { color: "#2a2b2e" },
            },
          },
        },
      });
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [klineData, chartType, interval]);

  // Header layout changes (e.g. trade mode toggle) can affect canvas width.
  useEffect(() => {
    if (!chartInstance.current) return;
    const timer = setTimeout(() => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [layoutKey]);

  return (
    <div className="chart-section-full">
      <div className="chart-header">
        <div className="chart-title">
          <span className="currency-pair">{symbolMeta.label}</span>
          <select
            className="chart-symbol-select"
            value={selectedSymbol}
            onChange={(e) => onSymbolChange && onSymbolChange(e.target.value)}
          >
            {SYMBOL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <span
            className={`ws-status ${wsStatus}`}
            title={`WebSocket: ${wsStatus}`}
          >
            ●
          </span>
          {currentPrice && (
            <>
              <span className="price-badge">
                {currentPrice.toLocaleString("ja-JP", {
                  maximumFractionDigits: 0,
                })}
              </span>
              {priceChange && (
                <span
                  className={`price-change ${parseFloat(priceChange) >= 0 ? "up" : "down"}`}
                >
                  {parseFloat(priceChange) >= 0 ? "+" : ""}
                  {priceChange}%
                </span>
              )}
            </>
          )}
        </div>
      </div>
      <div className="chart-container">
        <canvas ref={chartRef} className="price-chart-canvas"></canvas>
      </div>
    </div>
  );
}

// 注文パネルコンポーネント
function TradingPanel({ balance, onOrderCreated, selectedSymbol, tradeMode, leverageRatio }) {
  const [orderSide, setOrderSide] = useState("buy"); // 'buy' or 'sell'
  const [orderType, setOrderType] = useState("market"); // 'market' or 'limit'
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [currentPrice, setCurrentPrice] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [successFading, setSuccessFading] = useState(false);
  const [loading, setLoading] = useState(false);
  const successTimerRef = useRef(null);
  const successFadeTimerRef = useRef(null);
  const symbolMeta = getSymbolMeta(selectedSymbol);

  const clearSuccessTimer = () => {
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    if (successFadeTimerRef.current) {
      clearTimeout(successFadeTimerRef.current);
      successFadeTimerRef.current = null;
    }
  };

  useEffect(() => {
    clearSuccessTimer();
    setAmount("");
    setPrice("");
    setError("");
    setSuccess("");
    setSuccessFading(false);
  }, [selectedSymbol]);

  useEffect(() => {
    return () => {
      clearSuccessTimer();
    };
  }, []);

  // 現在価格を取得
  useEffect(() => {
    const fetchCurrentPrice = async () => {
      try {
        const response = await fetch(
          `${BYBIT_API}/tickers?category=linear&symbol=${selectedSymbol}`,
        );
        const data = await response.json();

        if (data.retCode === 0 && data.result.list.length > 0) {
          const symbolUsd = parseFloat(data.result.list[0].lastPrice);
          const symbolJpy = Math.round(symbolUsd * USDJPY_RATE);
          setCurrentPrice(symbolJpy);

          if (orderType === "limit" && !price) {
            setPrice(symbolJpy.toString());
          }
        }
      } catch (error) {
        console.error("Failed to fetch current price:", error);
      }
    };

    fetchCurrentPrice();
    const interval = setInterval(fetchCurrentPrice, 10000); // 10秒ごとに更新

    return () => clearInterval(interval);
  }, [selectedSymbol]);

  // Quick amount計算
  const calculateQuickAmount = (percentage) => {
    if (orderSide === "buy" && currentPrice && balance.JPY) {
      const availableJpy = balance.JPY * (percentage / 100);
      const btcAmount = (availableJpy / currentPrice) * 0.999; // 手数料考慮
      setAmount(btcAmount.toFixed(8));
    } else if (orderSide === "sell") {
      const assetBalance = balance[symbolMeta.asset] || 0;
      const sellAmount = assetBalance * (percentage / 100);
      setAmount(sellAmount.toFixed(8));
    }
  };

  // 注文実行
  const handleSubmitOrder = async () => {
    setError("");
    clearSuccessTimer();
    setSuccess("");
    setSuccessFading(false);
    setLoading(true);

    try {
      const orderData = {
        symbol: selectedSymbol,
        side: orderSide,
        type: orderType,
        amount: amount,
        price: orderType === "limit" ? price : null,
        trade_type: tradeMode,
        leverage_ratio: tradeMode === "leverage" ? leverageRatio : 1,
      };

      const response = await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "注文に失敗しました");
        return;
      }

      setSuccess(data.message);
      successFadeTimerRef.current = setTimeout(() => {
        setSuccessFading(true);
        successFadeTimerRef.current = null;
      }, 4500);
      successTimerRef.current = setTimeout(() => {
        setSuccess("");
        setSuccessFading(false);
        successTimerRef.current = null;
      }, 5000);
      setAmount("");
      if (orderType === "market") {
        setPrice("");
      }

      // 親コンポーネントに通知
      if (onOrderCreated) {
        onOrderCreated(data.order);
      }
    } catch (error) {
      console.error("Order submission error:", error);
      setError("注文処理中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // 概算金額計算
  const calculateTotal = () => {
    const amountFloat = parseFloat(amount) || 0;
    const priceFloat =
      orderType === "limit" ? parseFloat(price) || 0 : currentPrice || 0;
    return priceFloat * amountFloat;
  };

  const calculateFee = () => {
    return calculateTotal() * 0.001; // 0.1%
  };

  return (
    <div className="trading-panel">
      <div className="panel-header">
        <h3>注文パネル</h3>
      </div>

      {/* 買い・売り切替 */}
      <div className="order-type-toggle">
        <button
          className={`toggle-btn ${orderSide === "buy" ? "active buy" : ""}`}
          onClick={() => {
            setOrderSide("buy");
            setError("");
            setSuccess("");
          }}
        >
          買い
        </button>
        <button
          className={`toggle-btn ${orderSide === "sell" ? "active sell" : ""}`}
          onClick={() => {
            setOrderSide("sell");
            setError("");
            setSuccess("");
          }}
        >
          売り
        </button>
      </div>

      {/* 成行・指値切替 */}
      <div className="form-group">
        <label className="form-label">注文タイプ</label>
        <select
          className="form-input"
          value={orderType}
          onChange={(e) => {
            const nextType = e.target.value;
            setOrderType(nextType);
            if (nextType === "limit" && !price && currentPrice) {
              setPrice(currentPrice.toString());
            }
            setError("");
          }}
        >
          <option value="market">成行</option>
          <option value="limit">指値</option>
        </select>
      </div>

      {/* 現在価格表示 */}
      {currentPrice && (
        <div className="current-price-display">
          <span className="label">現在価格 ({symbolMeta.label}):</span>
          <span className="value">{currentPrice.toLocaleString()} JPY</span>
        </div>
      )}

      {/* 価格入力（指値の場合のみ） */}
      {orderType === "limit" && (
        <div className="form-group">
          <label className="form-label">価格 (JPY)</label>
          <input
            type="text"
            className="form-input"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="15000000"
          />
          <div className="input-hint">現在価格の±10%以内で指定してください</div>
        </div>
      )}

      {/* 数量入力 */}
      <div className="form-group">
        <label className="form-label">数量 ({symbolMeta.asset})</label>
        <input
          type="text"
          className="form-input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00000000"
        />
        <div className="input-hint">最小: 0.0001 {symbolMeta.asset}</div>
      </div>

      {/* Quick amountボタン */}
      <div className="quick-amount">
        {[25, 50, 75, 100].map((pct) => (
          <button
            key={pct}
            className="quick-btn"
            onClick={() => calculateQuickAmount(pct)}
            disabled={!currentPrice}
          >
            {pct}%
          </button>
        ))}
      </div>

      {/* 概算金額 */}
      <div className="order-summary">
        <div className="summary-row">
          <span>概算金額</span>
          <span>
            {calculateTotal().toLocaleString("ja-JP", {
              maximumFractionDigits: 0,
            })}{" "}
            JPY
          </span>
        </div>
        <div className="summary-row">
          <span>手数料 (0.1%)</span>
          <span>
            {calculateFee().toLocaleString("ja-JP", {
              maximumFractionDigits: 0,
            })}{" "}
            JPY
          </span>
        </div>
        <div className="summary-row total">
          <span>合計</span>
          <span>
            {(
              calculateTotal() +
              (orderSide === "buy" ? calculateFee() : -calculateFee())
            ).toLocaleString("ja-JP", { maximumFractionDigits: 0 })}{" "}
            JPY
          </span>
        </div>
      </div>

      {/* エラー・成功メッセージ */}
      {error && <div className="error-message">{error}</div>}

      {/* 注文ボタン */}
      <button
        className={`order-btn ${orderSide}`}
        onClick={handleSubmitOrder}
        disabled={loading || !amount}
      >
        {loading ? "処理中..." : orderSide === "buy" ? "買い注文" : "売り注文"}
      </button>

      {success && (
        <div className={`success-message order-success-message ${successFading ? "fade-out" : ""}`}>
          {success}
        </div>
      )}
    </div>
  );
}

function FrontLoginPage({ onLogin, loading, error }) {
  const [username, setUsername] = useState("User1");
  const [password, setPassword] = useState("User1");

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onLogin(username, password);
  };

  const handleDeveloperLogin = async () => {
    setUsername("User1");
    setPassword("User1");
    await onLogin("User1", "User1");
  };

  return (
    <div className="front-login-page">
      <div className="front-login-card">
        <h1>暗号資産取引デモサイト</h1>
        <p className="front-login-subtitle">ユーザーログイン</p>
        <p className="front-login-hint">テスト用: ID `User1` / PW `User1`</p>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">ID</label>
            <input
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="User1"
            />
          </div>
          <div className="form-group">
            <label className="form-label">パスワード</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="User1"
            />
          </div>
          <button type="submit" className="order-btn buy" disabled={loading}>
            {loading ? "ログイン中..." : "ログイン"}
          </button>
          <button
            type="button"
            className="dev-login-btn"
            disabled={loading}
            onClick={handleDeveloperLogin}
          >
            開発者用ログイン (User1)
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [currentUser, setCurrentUser] = useState("");
  const [activeMenu, setActiveMenu] = useState("chart");
  const [balance, setBalance] = useState({
    BTC: 1.5,
    ETH: 10.0,
    XRP: 0,
    SOL: 0,
    USDC: 0,
    JPY: 5000000,
  });
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [orders, setOrders] = useState([]);
  const [chartInterval, setChartInterval] = useState("60");
  const [chartType, setChartType] = useState("candle");
  const [selectedSymbol, setSelectedSymbol] = useState("BTCUSDT");
  const [tradeMode, setTradeMode] = useState("spot"); // 'spot' or 'leverage'
  const [leverageRatio, setLeverageRatio] = useState(10); // 2, 5, 10
  const [assetPrices, setAssetPrices] = useState({
    BTC: 15000000,
    ETH: 500000,
    XRP: 90,
    SOL: 15000,
    USDC: 150,
  });

  useEffect(() => {
    const checkAuth = async () => {
      const currentPath = window.location.pathname;
      try {
        const response = await fetch(`${API_BASE}/auth/me`);
        if (!response.ok) {
          setIsAuthenticated(false);
          if (currentPath !== LOGIN_PATH) {
            window.location.replace(LOGIN_PATH);
          }
          return;
        }

        const data = await response.json();
        setCurrentUser(data?.user?.username || "");
        setIsAuthenticated(true);
        if (currentPath === LOGIN_PATH) {
          window.location.replace("/");
          return;
        }
      } catch (error) {
        setIsAuthenticated(false);
        if (currentPath !== LOGIN_PATH) {
          window.location.replace(LOGIN_PATH);
        }
      } finally {
        setAuthChecking(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    fetchBalance();
    fetchDeposits();
    fetchWithdrawals();
    fetchOrders();
    fetchCurrentPrices();

    // 価格を定期的に更新（30秒ごと）
    const priceInterval = setInterval(fetchCurrentPrices, 30000);
    return () => clearInterval(priceInterval);
  }, [isAuthenticated]);

  const fetchCurrentPrices = async () => {
    const nextPrices = { ...assetPrices };
    const symbols = SYMBOL_OPTIONS.filter((option) => option.asset !== "USDC");

    try {
      for (const symbol of symbols) {
        const response = await fetch(
          `${BYBIT_API}/tickers?category=spot&symbol=${symbol.value}`,
        );
        const data = await response.json();

        if (data.retCode === 0 && data.result.list.length > 0) {
          const priceUsd = parseFloat(data.result.list[0].lastPrice);
          nextPrices[symbol.asset] = Math.round(priceUsd * USDJPY_RATE);
        }
      }

      nextPrices.USDC = USDJPY_RATE;
      setAssetPrices(nextPrices);
    } catch (error) {
      console.error("Failed to fetch current prices:", error);
    }
  };

  const fetchBalance = async () => {
    try {
      const response = await fetch(`${API_BASE}/balance`);
      const data = await response.json();
      setBalance(data);
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
  };

  const fetchDeposits = async () => {
    try {
      const response = await fetch(`${API_BASE}/deposits`);
      const data = await response.json();
      setDeposits(data);
    } catch (error) {
      console.error("Failed to fetch deposits:", error);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      const response = await fetch(`${API_BASE}/withdrawals`);
      const data = await response.json();
      setWithdrawals(data);
    } catch (error) {
      console.error("Failed to fetch withdrawals:", error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch(`${API_BASE}/orders?status=all`);
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    }
  };

  const handleLogin = async (username, password) => {
    setAuthError("");
    setAuthLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setAuthError(data.error || "ログインに失敗しました");
        return;
      }

      setCurrentUser(data?.user?.username || username);
      setIsAuthenticated(true);
      if (window.location.pathname === LOGIN_PATH) {
        window.location.replace("/");
      }
    } catch (error) {
      setAuthError("ログイン中にエラーが発生しました");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
    } catch (error) {
      // Ignore network error and still move user to login UI.
    }

    setIsAuthenticated(false);
    setCurrentUser("");
    setAuthError("");
    window.location.replace(LOGIN_PATH);
  };

  const handleOrderCreated = (order) => {
    fetchOrders();
    fetchBalance(); // 残高更新
  };

  const handleCancelOrder = async (orderId) => {
    try {
      const response = await fetch(`${API_BASE}/orders/${orderId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchOrders(); // 注文一覧を再取得
      }
    } catch (error) {
      console.error("Failed to cancel order:", error);
    }
  };

  const btcJpy = (balance.BTC || 0) * assetPrices.BTC;
  const ethJpy = (balance.ETH || 0) * assetPrices.ETH;
  const xrpJpy = (balance.XRP || 0) * assetPrices.XRP;
  const solJpy = (balance.SOL || 0) * assetPrices.SOL;
  const usdcJpy = (balance.USDC || 0) * assetPrices.USDC;
  const jpyBalance = balance.JPY || 0;
  const totalJpy = jpyBalance + btcJpy + ethJpy + xrpJpy + solJpy + usdcJpy;

  // レバレッジポジションの簡易計算（将来的に実装）
  const leveragePositions = orders.filter(
    (order) => order.trade_type === "leverage" && order.status === "filled",
  );

  // 証拠金維持率の計算（簡易版）
  const totalMarginUsed = leveragePositions.reduce((sum, order) => {
    return sum + (order.margin_used || 0);
  }, 0);

  const marginRatio =
    totalMarginUsed > 0
      ? ((totalJpy / totalMarginUsed) * 100).toFixed(2)
      : null;

  // 約定評価損益の計算（現物とレバレッジで正しい計算）
  const realizedPnL = orders
    .filter((order) => order.status === "filled")
    .reduce((sum, order) => {
      const currentAssetPrice = assetPrices[getSymbolMeta(order.symbol || "BTCUSDT").asset] || 0;
      if (order.side === "buy") {
         return sum + (order.amount * currentAssetPrice) - (order.total + order.fee);
      } else {
         return sum + (order.total - order.fee) - (order.amount * currentAssetPrice);
      }
    }, 0);

  const assetColors = {
    JPY: "#26a69a",
    BTC: "#f7931a",
    ETH: "#627eea",
    XRP: "#00bcd4",
    SOL: "#ab47bc",
    USDC: "#2775ca",
  };

  const donutAssets = [
    { currency: "BTC", value: btcJpy, color: assetColors.BTC },
    { currency: "ETH", value: ethJpy, color: assetColors.ETH },
    { currency: "XRP", value: xrpJpy, color: assetColors.XRP },
    { currency: "SOL", value: solJpy, color: assetColors.SOL },
    { currency: "USDC", value: usdcJpy, color: assetColors.USDC },
  ].filter((asset) => asset.value > 0);

  const donutGradient =
    totalJpy > 0 && donutAssets.length > 0
      ? (() => {
          let current = 0;
          return donutAssets
            .map((asset) => {
              const start = current;
              current += (asset.value / totalJpy) * 100;
              return `${asset.color} ${start}% ${current}%`;
            })
            .join(", ");
        })()
      : "#3a3b3e 0% 100%";

  const assetRows = [
    {
      currency: "JPY",
      amountRaw: 0,
      balanceText: (balance.JPY || 0).toLocaleString("ja-JP"),
      convertedText: `¥ ${(balance.JPY || 0).toLocaleString("ja-JP")}`,
      color: assetColors.JPY,
    },
    {
      currency: "BTC",
      amountRaw: balance.BTC || 0,
      balanceText: (balance.BTC || 0).toFixed(8),
      convertedText: `¥ ${btcJpy.toLocaleString("ja-JP")}`,
      color: assetColors.BTC,
    },
    {
      currency: "ETH",
      amountRaw: balance.ETH || 0,
      balanceText: (balance.ETH || 0).toFixed(8),
      convertedText: `¥ ${ethJpy.toLocaleString("ja-JP")}`,
      color: assetColors.ETH,
    },
    {
      currency: "XRP",
      amountRaw: balance.XRP || 0,
      balanceText: (balance.XRP || 0).toFixed(4),
      convertedText: `¥ ${xrpJpy.toLocaleString("ja-JP")}`,
      color: assetColors.XRP,
    },
    {
      currency: "SOL",
      amountRaw: balance.SOL || 0,
      balanceText: (balance.SOL || 0).toFixed(4),
      convertedText: `¥ ${solJpy.toLocaleString("ja-JP")}`,
      color: assetColors.SOL,
    },
    {
      currency: "USDC",
      amountRaw: balance.USDC || 0,
      balanceText: (balance.USDC || 0).toFixed(4),
      convertedText: `¥ ${usdcJpy.toLocaleString("ja-JP")}`,
      color: assetColors.USDC,
    },
  ];

  const fetchedAt = new Date().toLocaleString("ja-JP");
  const selectedSymbolMeta = getSymbolMeta(selectedSymbol);
  const selectedSymbolPrice = assetPrices[selectedSymbolMeta.asset] || 0;

  if (authChecking) {
    return <div className="loading">ログイン状態を確認中...</div>;
  }

  if (!isAuthenticated) {
    return (
      <FrontLoginPage
        onLogin={handleLogin}
        loading={authLoading}
        error={authError}
      />
    );
  }

  return (
    <div className="app-container-new">
      <div className="top-header">
        <div className="header-left">
          <div className="header-title">💰 暗号資産取引デモサイト</div>
          <div className="trade-mode-switcher">
            <button
              className={`mode-btn ${tradeMode === "spot" ? "active" : ""}`}
              onClick={() => setTradeMode("spot")}
            >
              現物
            </button>
            <button
              className={`mode-btn ${tradeMode === "leverage" ? "active" : ""}`}
              onClick={() => setTradeMode("leverage")}
            >
              レバレッジ
            </button>
          </div>
          <div
            className={`leverage-ratio-display ${tradeMode === "leverage" ? "active" : "hidden"}`}
          >
              <span className="leverage-label">倍率:</span>
              <select
                className="leverage-select"
                value={leverageRatio}
                onChange={(e) => setLeverageRatio(Number(e.target.value))}
              >
                <option value={2}>2x</option>
                <option value={5}>5x</option>
                <option value={10}>10x</option>
              </select>
          </div>
        </div>
        <div className="header-info">
          <div className="info-item">
            <span className="info-label">証拠金維持率</span>
            <span className={`info-value ${marginRatio ? "positive" : ""}`}>
              {marginRatio ? `${marginRatio}%` : "-"}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">純資産額</span>
            <span className="info-value">
              {totalJpy.toLocaleString("ja-JP")} JPY
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">約定評価損益</span>
            <span
              className={`info-value ${realizedPnL >= 0 ? "positive" : "negative"}`}
            >
              {realizedPnL >= 0 ? "+" : ""}
              {realizedPnL.toLocaleString("ja-JP")} JPY
            </span>
          </div>
        </div>
        <div className="header-admin-link">
          <span className="header-user-badge">👤 {currentUser}</span>
          <button className="logout-btn" onClick={handleLogout}>
            ログアウト
          </button>
          <a
            href="/admin"
            target="_blank"
            className="admin-link-btn"
            title="管理画面を開く"
          >
            ⚙️ 管理画面
          </a>
        </div>
      </div>

      <PriceTicker assetPrices={assetPrices} />

      <div className="main-layout">
        <SideMenu activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

        <div className="content-area">
          {activeMenu === "chart" && (
            <div className="chart-view">
              <div className="chart-main">
                <div className="chart-controls">
                  <div className="chart-control-group">
                    {[
                      { value: "1", label: "1分" },
                      { value: "5", label: "5分" },
                      { value: "15", label: "15分" },
                      { value: "30", label: "30分" },
                      { value: "60", label: "1時間" },
                      { value: "240", label: "4時間" },
                      { value: "D", label: "1日" },
                    ].map((interval) => (
                      <button
                        key={interval.value}
                        className={`interval-btn ${chartInterval === interval.value ? "active" : ""}`}
                        onClick={() => setChartInterval(interval.value)}
                      >
                        {interval.label}
                      </button>
                    ))}
                  </div>
                  <div className="chart-control-group">
                    <button
                      className={`chart-type-btn ${chartType === "line" ? "active" : ""}`}
                      onClick={() => setChartType("line")}
                    >
                      ライン
                    </button>
                    <button
                      className={`chart-type-btn ${chartType === "candle" ? "active" : ""}`}
                      onClick={() => setChartType("candle")}
                    >
                      キャンドル
                    </button>
                  </div>
                </div>
                <PriceChart
                  interval={chartInterval}
                  chartType={chartType}
                  selectedSymbol={selectedSymbol}
                  layoutKey={tradeMode}
                  onSymbolChange={setSelectedSymbol}
                />
              </div>
              <div className="chart-sidebar">
                <OrderBook
                  selectedSymbol={selectedSymbol}
                  currentPrice={selectedSymbolPrice}
                />
                <RecentTrades currentPrice={selectedSymbolPrice} />
              </div>
            </div>
          )}

          {activeMenu === "trade" && (
            <div className="trade-view">
              <div className="trade-main">
                <PriceChart
                  interval={chartInterval}
                  chartType={chartType}
                  selectedSymbol={selectedSymbol}
                  layoutKey={tradeMode}
                  onSymbolChange={setSelectedSymbol}
                />
              </div>
              <TradingPanel
                balance={balance}
                onOrderCreated={handleOrderCreated}
                selectedSymbol={selectedSymbol}
                tradeMode={tradeMode}
                leverageRatio={leverageRatio}
              />
            </div>
          )}

          {activeMenu === "assets" && (
            <div className="assets-view">
              <div className="assets-donut-panel">
                <div
                  className="assets-donut"
                  style={{ "--assets-donut-gradient": donutGradient }}
                >
                  <div className="assets-donut-center">
                    <div className="donut-title">合計残高</div>
                    <div className="donut-amount">
                      ¥{Math.round(totalJpy).toLocaleString("ja-JP")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="assets-table-wrap">
                <div className="assets-table-header-row">
                  <div>暗号資産/通貨</div>
                  <div>口座残高</div>
                  <div>円換算額</div>
                </div>

                <div className="assets-table-body">
                  {assetRows.map((row) => (
                    <div
                      key={row.currency}
                      className="assets-table-row"
                      style={{ "--asset-color": row.color }}
                    >
                      <div className="currency-col">
                        <span className="currency-dot"></span>
                        <span className="currency-label">{row.currency}</span>
                      </div>
                      <div className="balance-col">{row.balanceText}</div>
                      <div className="yen-col">{row.convertedText}</div>
                    </div>
                  ))}
                </div>

                <div className="assets-table-fetched">{fetchedAt} 取得</div>
              </div>
            </div>
          )}

          {activeMenu === "deposit" && <DepositTab deposits={deposits} />}

          {activeMenu === "withdrawal" && (
            <WithdrawTab
              balance={balance}
              withdrawals={withdrawals}
              onSuccess={() => {
                fetchBalance();
                fetchWithdrawals();
              }}
            />
          )}

          {activeMenu === "history" && (
            <HistoryView
              deposits={deposits}
              withdrawals={withdrawals}
              orders={orders}
              onCancelOrder={handleCancelOrder}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// 履歴ビューコンポーネント
function HistoryView({ deposits, withdrawals, orders, onCancelOrder }) {
  const [activeHistoryTab, setActiveHistoryTab] = useState("orders");

  const formatOrderDate = (order) => order.created_at || order.timestamp || "-";
  const formatOrderPrice = (order) => {
    const price = Number(order.price ?? order.execution_price ?? 0);
    return `${price.toLocaleString()} JPY`;
  };
  const formatOrderAmount = (order) => {
    const amount = Number(order.amount ?? 0);
    return `${amount.toFixed(8)} BTC`;
  };
  const formatOrderTotal = (order) => {
    const totalFromApi = order.total;
    if (totalFromApi !== undefined && totalFromApi !== null) {
      return `${Number(totalFromApi).toLocaleString()} JPY`;
    }
    const price = Number(order.price ?? order.execution_price ?? 0);
    const amount = Number(order.amount ?? 0);
    return `${Math.round(price * amount).toLocaleString()} JPY`;
  };
  const isPendingOrder = (status) => status === "open" || status === "pending";
  const getOrderStatusLabel = (status) => {
    if (status === "filled") return "約定";
    if (isPendingOrder(status)) return "未約定";
    return "キャンセル";
  };
  const getOrderStatusClass = (status) => {
    if (status === "filled") return "success";
    if (isPendingOrder(status)) return "warning";
    return "cancelled";
  };

  // サンプルの約定履歴データ
  const executionHistory = [
    {
      id: 1,
      date: "2026-02-27 14:35:21",
      pair: "BTC/JPY",
      type: "buy",
      price: "15,234,567",
      amount: "0.0234",
      fee: "712",
      total: "356,489",
    },
    {
      id: 2,
      date: "2026-02-27 13:22:15",
      pair: "ETH/JPY",
      type: "sell",
      price: "512,345",
      amount: "0.5000",
      fee: "256",
      total: "256,172",
    },
    {
      id: 3,
      date: "2026-02-27 11:45:33",
      pair: "BTC/JPY",
      type: "buy",
      price: "15,198,000",
      amount: "0.0500",
      fee: "1,520",
      total: "759,900",
    },
    {
      id: 4,
      date: "2026-02-26 16:23:45",
      pair: "BTC/JPY",
      type: "sell",
      price: "15,150,000",
      amount: "0.0100",
      fee: "303",
      total: "151,500",
    },
  ];

  // サンプルの注文履歴データ
  const orderHistory = [
    {
      id: 1,
      date: "2026-02-27 15:30:12",
      pair: "BTC/JPY",
      type: "buy",
      orderType: "指値",
      price: "15,200,000",
      amount: "0.0500",
      status: "pending",
    },
    {
      id: 2,
      date: "2026-02-27 14:35:21",
      pair: "BTC/JPY",
      type: "buy",
      orderType: "成行",
      price: "15,234,567",
      amount: "0.0234",
      status: "completed",
    },
    {
      id: 3,
      date: "2026-02-27 13:22:15",
      pair: "ETH/JPY",
      type: "sell",
      orderType: "成行",
      price: "512,345",
      amount: "0.5000",
      status: "completed",
    },
    {
      id: 4,
      date: "2026-02-27 12:10:00",
      pair: "BTC/JPY",
      type: "buy",
      orderType: "指値",
      price: "15,100,000",
      amount: "0.0300",
      status: "cancelled",
    },
    {
      id: 5,
      date: "2026-02-27 11:45:33",
      pair: "BTC/JPY",
      type: "buy",
      orderType: "成行",
      price: "15,198,000",
      amount: "0.0500",
      status: "completed",
    },
  ];

  // 入出金履歴データ（deposits と withdrawals を統合）
  const depositWithdrawalHistory = [
    ...deposits.map((d) => ({ ...d, type: "deposit" })),
    ...withdrawals.map((w) => ({ ...w, type: "withdrawal" })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="history-view">
      <h2>取引履歴</h2>
      <div className="history-tabs">
        <button
          className={`tab ${activeHistoryTab === "orders" ? "active" : ""}`}
          onClick={() => setActiveHistoryTab("orders")}
        >
          注文履歴
        </button>
        <button
          className={`tab ${activeHistoryTab === "deposit-withdrawal" ? "active" : ""}`}
          onClick={() => setActiveHistoryTab("deposit-withdrawal")}
        >
          入出金履歴
        </button>
      </div>

      <div className="history-content">
        {activeHistoryTab === "orders" && (
          <div className="table-container">
            {orders.length === 0 ? (
              <div className="empty-state">注文履歴がありません</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>注文日時</th>
                    <th>売買</th>
                    <th>種別</th>
                    <th>価格</th>
                    <th>数量</th>
                    <th>合計</th>
                    <th>ステータス</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>{formatOrderDate(order)}</td>
                      <td>
                        <span className={`trade-type ${order.side}`}>
                          {order.side === "buy" ? "買い" : "売り"}
                        </span>
                      </td>
                      <td>
                        <span className="order-type-badge">
                          {order.type === "market" ? "成行" : "指値"}
                        </span>
                      </td>
                      <td>{formatOrderPrice(order)}</td>
                      <td>{formatOrderAmount(order)}</td>
                      <td>{formatOrderTotal(order)}</td>
                      <td>
                        <span className={`badge ${getOrderStatusClass(order.status)}`}>
                          {getOrderStatusLabel(order.status)}
                        </span>
                      </td>
                      <td>
                        {isPendingOrder(order.status) && (
                          <button
                            className="cancel-order-btn"
                            onClick={() => onCancelOrder(order.id)}
                          >
                            キャンセル
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeHistoryTab === "deposit-withdrawal" && (
          <div className="table-container">
            {depositWithdrawalHistory.length === 0 ? (
              <div className="empty-state">入出金履歴がありません</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>日時</th>
                    <th>種別</th>
                    <th>通貨</th>
                    <th>金額</th>
                    <th>手数料</th>
                    <th>ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {depositWithdrawalHistory.map((item) => (
                    <tr key={`${item.type}-${item.id}`}>
                      <td>{item.date}</td>
                      <td>
                        <span className={`deposit-type ${item.type}`}>
                          {item.type === "deposit" ? "入金" : "出金"}
                        </span>
                      </td>
                      <td>{item.currency}</td>
                      <td>{item.amount}</td>
                      <td>{item.fee || "-"}</td>
                      <td>
                        <span
                          className={`badge ${item.status === "完了" ? "success" : "warning"}`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DepositTab({ deposits }) {
  return (
    <div className="deposit-view">
      <h2>入金</h2>
      <div className="form-container">
        <h3>入金用アドレス</h3>
        <div className="wallet-address-box">
          <strong>BTC:</strong> 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
        </div>
        <div className="wallet-address-box">
          <strong>ETH:</strong> 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
        </div>
      </div>

      <div className="table-container">
        <h3>入金履歴</h3>
        {deposits.length === 0 ? (
          <div className="empty-state">入金履歴がありません</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>日時</th>
                <th>通貨</th>
                <th>金額</th>
                <th>ステータス</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((deposit) => (
                <tr key={deposit.id}>
                  <td>{deposit.date}</td>
                  <td>{deposit.currency}</td>
                  <td>{deposit.amount}</td>
                  <td>
                    <span
                      className={`badge ${deposit.status === "完了" ? "success" : "warning"}`}
                    >
                      {deposit.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function WithdrawTab({ balance, withdrawals, onSuccess }) {
  const [currency, setCurrency] = useState("BTC");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const fee = currency === "BTC" ? 0.0005 : 0.005;
  const receiveAmount = amount ? Math.max(0, parseFloat(amount) - fee) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, address, amount }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors({ submit: data.error });
      } else {
        onSuccess();
        setCurrency("BTC");
        setAddress("");
        setAmount("");
        alert(data.message);
      }
    } catch (error) {
      setErrors({ submit: "サーバーとの通信に失敗しました" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="withdraw-view">
      <h2>出金</h2>
      <div className="form-container">
        {errors.submit && (
          <div
            className="error-text"
            style={{
              marginBottom: "16px",
              padding: "12px",
              background: "rgba(239, 83, 80, 0.1)",
              borderRadius: "4px",
              border: "1px solid rgba(239, 83, 80, 0.3)",
            }}
          >
            {errors.submit}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">通貨</label>
            <div className="radio-group">
              <button
                type="button"
                className={`radio-option ${currency === "BTC" ? "active" : ""}`}
                onClick={() => setCurrency("BTC")}
              >
                BTC
              </button>
              <button
                type="button"
                className={`radio-option ${currency === "ETH" ? "active" : ""}`}
                onClick={() => setCurrency("ETH")}
              >
                ETH
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">出金先アドレス</label>
            <input
              type="text"
              className="form-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={currency === "BTC" ? "1A1zP1eP..." : "0x742d35Cc..."}
            />
          </div>

          <div className="form-group">
            <label className="form-label">出金額</label>
            <input
              type="text"
              className="form-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00000000"
            />
          </div>

          <div className="info-rows">
            <div className="info-row">
              <span>現在の残高</span>
              <span>
                {balance[currency].toFixed(8)} {currency}
              </span>
            </div>
            <div className="info-row">
              <span>出金手数料</span>
              <span>
                {fee.toFixed(8)} {currency}
              </span>
            </div>
            <div className="info-row highlight">
              <span>受取実額</span>
              <span>
                {receiveAmount.toFixed(8)} {currency}
              </span>
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? (
              <div className="loading">
                <div className="spinner"></div>
                処理中...
              </div>
            ) : (
              "出金申請"
            )}
          </button>
        </form>
      </div>

      <div className="table-container">
        <h3>出金履歴</h3>
        {withdrawals.length === 0 ? (
          <div className="empty-state">出金履歴がありません</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>日時</th>
                <th>通貨</th>
                <th>金額</th>
                <th>手数料</th>
                <th>ステータス</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map((withdrawal) => (
                <tr key={withdrawal.id}>
                  <td>{withdrawal.date}</td>
                  <td>{withdrawal.currency}</td>
                  <td>{withdrawal.amount}</td>
                  <td>{withdrawal.fee}</td>
                  <td>
                    <span className="badge warning">{withdrawal.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));
