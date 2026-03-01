const { useState, useEffect, useRef } = React;

const API_BASE = "http://localhost:5000/api";
const COINGECKO_API = "https://api.coingecko.com/api/v3";

// CoinGecko APIからBTC価格データを取得
async function fetchBTCPriceData(days = 1) {
  try {
    const response = await fetch(
      `${COINGECKO_API}/coins/bitcoin/market_chart?vs_currency=jpy&days=${days}`,
    );
    const data = await response.json();
    return data.prices || [];
  } catch (error) {
    console.error("Chart data fetch error:", error);
    return [];
  }
}

async function fetchBTCOhlcData(days = 1) {
  try {
    const response = await fetch(
      `${COINGECKO_API}/coins/bitcoin/ohlc?vs_currency=jpy&days=${days}`,
    );
    const data = await response.json();

    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(([timestamp, open, high, low, close]) => ({
      time: Math.floor(timestamp / 1000),
      open,
      high,
      low,
      close,
    }));
  } catch (error) {
    console.error("OHLC data fetch error:", error);
    return [];
  }
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
      <div className="side-menu-header">
        <div className="logo">💰 Crypto</div>
      </div>
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
function PriceTicker() {
  const [prices, setPrices] = useState([
    { pair: "BTC/JPY", price: "15,234,567", change: "+2.34%", up: true },
    { pair: "ETH/JPY", price: "512,345", change: "+1.23%", up: true },
    { pair: "XRP/JPY", price: "78.45", change: "-0.56%", up: false },
  ]);

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
function OrderBook() {
  const sellOrders = [
    { price: 15240000, amount: 0.5234, total: 7978896 },
    { price: 15239000, amount: 0.3421, total: 5213311 },
    { price: 15238000, amount: 0.8932, total: 13610552 },
    { price: 15237000, amount: 0.2156, total: 3285107 },
    { price: 15236000, amount: 0.6745, total: 10276682 },
  ];

  const buyOrders = [
    { price: 15235000, amount: 0.4523, total: 6891773 },
    { price: 15234000, amount: 0.7234, total: 11022244 },
    { price: 15233000, amount: 0.3421, total: 5211259 },
    { price: 15232000, amount: 0.9123, total: 13899204 },
    { price: 15231000, amount: 0.2341, total: 3565607 },
  ];

  return (
    <div className="orderbook">
      <div className="orderbook-header">
        <h3>オーダーブック</h3>
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
function RecentTrades() {
  const trades = [
    { time: "15:23:45", price: 15235000, amount: 0.0234, type: "buy" },
    { time: "15:23:42", price: 15234500, amount: 0.1523, type: "sell" },
    { time: "15:23:38", price: 15235500, amount: 0.0892, type: "buy" },
    { time: "15:23:35", price: 15234000, amount: 0.2341, type: "sell" },
    { time: "15:23:31", price: 15235200, amount: 0.0456, type: "buy" },
    { time: "15:23:28", price: 15234800, amount: 0.1234, type: "buy" },
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
            <span className="price">{trade.price.toLocaleString()}</span>
            <span className="amount">{trade.amount.toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// チャートコンポーネント
function PriceChart({ interval, chartType = "line" }) {
  const chartRootRef = useRef(null);
  const chartInstance = useRef(null);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(null);

  useEffect(() => {
    let mounted = true;
    let detachResize = () => {};
    let loading = false;
    const daysMap = { "1H": 1 / 24, "1D": 1, "1W": 7, "1M": 30 };
    const refreshIntervalMs = 5000;

    const loadChartData = async () => {
      if (!mounted || loading) {
        return;
      }

      loading = true;
      try {
        const days = daysMap[interval] || 1;
        const lw = window.LightweightCharts;

        if (!chartRootRef.current || !lw || !lw.createChart) {
          console.warn("Lightweight Charts is not available");
          return;
        }

        if (chartInstance.current) {
          chartInstance.current.remove();
          chartInstance.current = null;
        }

        const chart = lw.createChart(chartRootRef.current, {
          layout: {
            background: { color: "#1a1b1e" },
            textColor: "#888",
          },
          grid: {
            vertLines: { color: "#2a2b2e" },
            horzLines: { color: "#2a2b2e" },
          },
          rightPriceScale: {
            borderColor: "#2a2b2e",
          },
          timeScale: {
            borderColor: "#2a2b2e",
            timeVisible: true,
            secondsVisible: false,
          },
          crosshair: {
            vertLine: { color: "#3a3b3e" },
            horzLine: { color: "#3a3b3e" },
          },
        });

        chartInstance.current = chart;

        const resize = () => {
          if (!chartRootRef.current || !chartInstance.current) {
            return;
          }

          chartInstance.current.applyOptions({
            width: chartRootRef.current.clientWidth,
            height: chartRootRef.current.clientHeight,
          });
        };

        resize();
        window.addEventListener("resize", resize);
        detachResize = () => window.removeEventListener("resize", resize);

        const priceData = await fetchBTCPriceData(days);

        if (!mounted || !chartInstance.current) {
          return;
        }

        if (priceData.length > 0) {
          const latestPrice = priceData[priceData.length - 1][1];
          const oldPrice = priceData[0][1];
          setCurrentPrice(latestPrice);
          setPriceChange(
            (((latestPrice - oldPrice) / oldPrice) * 100).toFixed(2),
          );
        }

        if (chartType === "candle") {
          let ohlcData = await fetchBTCOhlcData(days);

          if (ohlcData.length === 0 && priceData.length > 0) {
            ohlcData = priceData.map(([timestamp, price]) => ({
              time: Math.floor(timestamp / 1000),
              open: price,
              high: price,
              low: price,
              close: price,
            }));
          }

          if (ohlcData.length > 0) {
            const candleSeries = chart.addCandlestickSeries({
              upColor: "#26a69a",
              downColor: "#ef5350",
              borderVisible: false,
              wickUpColor: "#26a69a",
              wickDownColor: "#ef5350",
            });
            candleSeries.setData(ohlcData);
          }
        } else {
          const lineData = priceData.map(([timestamp, price]) => ({
            time: Math.floor(timestamp / 1000),
            value: price,
          }));

          if (lineData.length > 0) {
            const lineSeries = chart.addAreaSeries({
              lineColor: "#4a9eff",
              topColor: "rgba(74, 158, 255, 0.25)",
              bottomColor: "rgba(74, 158, 255, 0.05)",
              lineWidth: 2,
            });
            lineSeries.setData(lineData);
          }
        }

        chart.timeScale().fitContent();
      } finally {
        loading = false;
      }
    };

    loadChartData();

    const timerId = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadChartData();
      }
    }, refreshIntervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadChartData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      detachResize();
      clearInterval(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (chartInstance.current) {
        chartInstance.current.remove();
        chartInstance.current = null;
      }
    };
  }, [interval, chartType]);

  return (
    <div className="chart-section-full">
      <div className="chart-header">
        <div className="chart-title">
          <span className="currency-pair">BTC/JPY</span>
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
        <div ref={chartRootRef} className="tv-chart-root"></div>
      </div>
    </div>
  );
}

// 注文パネルコンポーネント
function TradingPanel({ balance, onTrade }) {
  const [orderType, setOrderType] = useState("buy");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("15234567");

  return (
    <div className="trading-panel">
      <div className="panel-header">
        <h3>注文パネル</h3>
      </div>
      <div className="order-type-toggle">
        <button
          className={`toggle-btn ${orderType === "buy" ? "active buy" : ""}`}
          onClick={() => setOrderType("buy")}
        >
          買い
        </button>
        <button
          className={`toggle-btn ${orderType === "sell" ? "active sell" : ""}`}
          onClick={() => setOrderType("sell")}
        >
          売り
        </button>
      </div>
      <div className="form-group">
        <label className="form-label">価格 (JPY)</label>
        <input
          type="text"
          className="form-input"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label className="form-label">数量 (BTC)</label>
        <input
          type="text"
          className="form-input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00000000"
        />
      </div>
      <div className="quick-amount">
        {["25%", "50%", "75%", "100%"].map((pct) => (
          <button key={pct} className="quick-btn">
            {pct}
          </button>
        ))}
      </div>
      <div className="order-summary">
        <div className="summary-row">
          <span>概算金額</span>
          <span>
            {(parseFloat(price) * parseFloat(amount || 0)).toLocaleString(
              "ja-JP",
            )}{" "}
            JPY
          </span>
        </div>
        <div className="summary-row">
          <span>手数料</span>
          <span>0.00 JPY</span>
        </div>
      </div>
      <button className={`order-btn ${orderType}`}>
        {orderType === "buy" ? "買い注文" : "売り注文"}
      </button>
    </div>
  );
}

function App() {
  const [activeMenu, setActiveMenu] = useState("chart");
  const [balance, setBalance] = useState({ BTC: 1.5, ETH: 10.0 });
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [chartInterval, setChartInterval] = useState("1D");
  const [chartType, setChartType] = useState("line");

  useEffect(() => {
    fetchBalance();
    fetchDeposits();
    fetchWithdrawals();
  }, []);

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

  const btcJpy = (balance.BTC || 0) * 15000000;
  const ethJpy = (balance.ETH || 0) * 500000;
  const totalJpy = btcJpy + ethJpy;
  const assetColors = {
    JPY: "#26a69a",
    BTC: "#f7931a",
    ETH: "#627eea",
  };

  const donutAssets = [
    { currency: "BTC", value: btcJpy, color: assetColors.BTC },
    { currency: "ETH", value: ethJpy, color: assetColors.ETH },
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
      balanceText: "0",
      convertedText: "¥ 0",
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
  ].filter((row) => row.currency === "JPY" || row.amountRaw > 0);

  const fetchedAt = new Date().toLocaleString("ja-JP");

  return (
    <div className="app-container-new">
      <div className="top-header">
        <div className="header-left">
          <div className="header-title">💰 暗号資産取引デモサイト</div>
        </div>
        <div className="header-info">
          <div className="info-item">
            <span className="info-label">証拠金維持率</span>
            <span className="info-value positive">96,312.56%</span>
          </div>
          <div className="info-item">
            <span className="info-label">純資産額</span>
            <span className="info-value">
              {totalJpy.toLocaleString("ja-JP")} {" "}
              JPY
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">約定評価損益</span>
            <span className="info-value negative">-2,621,640,701 JPY</span>
          </div>
        </div>
      </div>

      <PriceTicker />

      <div className="main-layout">
        <SideMenu activeMenu={activeMenu} setActiveMenu={setActiveMenu} />

        <div className="content-area">
          {activeMenu === "chart" && (
            <div className="chart-view">
              <div className="chart-main">
                <div className="chart-controls">
                  <div className="chart-control-group">
                    {["1H", "1D", "1W", "1M"].map((interval) => (
                      <button
                        key={interval}
                        className={`interval-btn ${chartInterval === interval ? "active" : ""}`}
                        onClick={() => setChartInterval(interval)}
                      >
                        {interval}
                      </button>
                    ))}
                  </div>
                  <div className="chart-control-group">
                    <button
                      className={`chart-type-btn ${chartType === "line" ? "active" : ""}`}
                      onClick={() => setChartType("line")}
                    >
                      チャート表示
                    </button>
                    <button
                      className={`chart-type-btn ${chartType === "candle" ? "active" : ""}`}
                      onClick={() => setChartType("candle")}
                    >
                      足表示
                    </button>
                  </div>
                </div>
                <PriceChart interval={chartInterval} chartType={chartType} />
              </div>
              <div className="chart-sidebar">
                <OrderBook />
                <RecentTrades />
              </div>
            </div>
          )}

          {activeMenu === "trade" && (
            <div className="trade-view">
              <div className="trade-main">
                <PriceChart interval={chartInterval} chartType={chartType} />
              </div>
              <TradingPanel balance={balance} />
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
            <HistoryView deposits={deposits} withdrawals={withdrawals} />
          )}
        </div>
      </div>
    </div>
  );
}

// 履歴ビューコンポーネント
function HistoryView({ deposits, withdrawals }) {
  const [activeHistoryTab, setActiveHistoryTab] = useState("execution");

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
          className={`tab ${activeHistoryTab === "execution" ? "active" : ""}`}
          onClick={() => setActiveHistoryTab("execution")}
        >
          約定履歴
        </button>
        <button
          className={`tab ${activeHistoryTab === "order" ? "active" : ""}`}
          onClick={() => setActiveHistoryTab("order")}
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
        {activeHistoryTab === "execution" && (
          <div className="table-container">
            {executionHistory.length === 0 ? (
              <div className="empty-state">約定履歴がありません</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>約定日時</th>
                    <th>通貨ペア</th>
                    <th>売買</th>
                    <th>約定価格</th>
                    <th>約定数量</th>
                    <th>手数料</th>
                    <th>約定金額</th>
                  </tr>
                </thead>
                <tbody>
                  {executionHistory.map((item) => (
                    <tr key={item.id}>
                      <td>{item.date}</td>
                      <td>{item.pair}</td>
                      <td>
                        <span className={`trade-type ${item.type}`}>
                          {item.type === "buy" ? "買い" : "売り"}
                        </span>
                      </td>
                      <td>{item.price}</td>
                      <td>{item.amount}</td>
                      <td>{item.fee} JPY</td>
                      <td>{item.total} JPY</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeHistoryTab === "order" && (
          <div className="table-container">
            {orderHistory.length === 0 ? (
              <div className="empty-state">注文履歴がありません</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>注文日時</th>
                    <th>通貨ペア</th>
                    <th>売買</th>
                    <th>注文種別</th>
                    <th>注文価格</th>
                    <th>注文数量</th>
                    <th>ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {orderHistory.map((item) => (
                    <tr key={item.id}>
                      <td>{item.date}</td>
                      <td>{item.pair}</td>
                      <td>
                        <span className={`trade-type ${item.type}`}>
                          {item.type === "buy" ? "買い" : "売り"}
                        </span>
                      </td>
                      <td>{item.orderType}</td>
                      <td>{item.price}</td>
                      <td>{item.amount}</td>
                      <td>
                        <span
                          className={`badge ${
                            item.status === "completed"
                              ? "success"
                              : item.status === "pending"
                                ? "warning"
                                : "error"
                          }`}
                        >
                          {item.status === "completed"
                            ? "約定"
                            : item.status === "pending"
                              ? "注文中"
                              : "キャンセル"}
                        </span>
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
