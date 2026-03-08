// 管理画面 React アプリケーション
const { useState, useEffect } = React;

// ログインコンポーネント
function LoginPage({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem("adminToken", data.token);
        onLogin();
      } else {
        setError("パスワードが正しくありません");
      }
    } catch (err) {
      setError("ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>管理画面</h1>
        <p>パスワードを入力してログインしてください</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">パスワード</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="admin"
              autoFocus
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <p
          style={{
            marginTop: "20px",
            fontSize: "12px",
            color: "#7f8c8d",
            textAlign: "center",
          }}
        >
          デフォルトパスワード: admin
        </p>
      </div>
    </div>
  );
}

// ダッシュボードコンポーネント
function Dashboard({ stats }) {
  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-label">総注文数</div>
          <div className="stat-value">{stats.totalOrders}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">完了注文</div>
          <div className="stat-value">{stats.completedOrders}</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">保留注文</div>
          <div className="stat-value">{stats.pendingOrders}</div>
        </div>
        <div className="stat-card red">
          <div className="stat-label">キャンセル</div>
          <div className="stat-value">{stats.canceledOrders}</div>
        </div>
      </div>

      <div className="settings-section">
        <h3>システム情報</h3>
        <table className="data-table">
          <tbody>
            <tr>
              <td>
                <strong>BTC価格</strong>
              </td>
              <td>¥{stats.btcPrice?.toLocaleString()}</td>
            </tr>
            <tr>
              <td>
                <strong>取引手数料</strong>
              </td>
              <td>{(stats.feeRate * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td>
                <strong>最小注文量</strong>
              </td>
              <td>{stats.minOrderAmount} BTC</td>
            </tr>
            <tr>
              <td>
                <strong>USD/JPY レート</strong>
              </td>
              <td>¥{stats.usdJpyRate}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// システム設定コンポーネント
function SettingsPage({ settings, onSave }) {
  const [formData, setFormData] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const handleChange = (key, value) => {
    setFormData({ ...formData, [key]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setMessage("設定を保存しました");
        onSave(formData);
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("保存に失敗しました");
      }
    } catch (err) {
      setMessage("エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {message && (
        <div
          className={
            message.includes("成功") || message.includes("保存")
              ? "success-message"
              : "error-message"
          }
        >
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="settings-section">
          <h3>価格設定</h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">BTC価格（JPY）</label>
              <input
                type="number"
                className="form-input"
                value={formData.mock_btc_price}
                onChange={(e) =>
                  handleChange("mock_btc_price", Number(e.target.value))
                }
              />
              <div className="input-hint">フロント側に表示されるBTC価格</div>
            </div>

            <div className="form-group">
              <label className="form-label">USD/JPY レート</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={formData.usdjpy_rate}
                onChange={(e) =>
                  handleChange("usdjpy_rate", Number(e.target.value))
                }
              />
              <div className="input-hint">為替レート</div>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>取引設定</h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">取引手数料（%）</label>
              <input
                type="number"
                step="0.001"
                className="form-input"
                value={formData.fee_rate * 100}
                onChange={(e) =>
                  handleChange("fee_rate", Number(e.target.value) / 100)
                }
              />
              <div className="input-hint">例: 0.1 = 0.1%</div>
            </div>

            <div className="form-group">
              <label className="form-label">最小注文量（BTC）</label>
              <input
                type="number"
                step="0.0001"
                className="form-input"
                value={formData.min_order_amount}
                onChange={(e) =>
                  handleChange("min_order_amount", Number(e.target.value))
                }
              />
              <div className="input-hint">最小取引可能量</div>
            </div>

            <div className="form-group">
              <label className="form-label">価格制限（%）</label>
              <input
                type="number"
                className="form-input"
                value={formData.price_limit_percent}
                onChange={(e) =>
                  handleChange("price_limit_percent", Number(e.target.value))
                }
              />
              <div className="input-hint">市場価格からの乖離上限</div>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>システム</h3>
          <div className="form-group">
            <label className="form-label">
              <input
                type="checkbox"
                checked={formData.maintenance_mode}
                onChange={(e) =>
                  handleChange("maintenance_mode", e.target.checked)
                }
              />{" "}
              メンテナンスモード
            </label>
            <div className="input-hint">有効にすると取引が一時停止されます</div>
          </div>
        </div>

        <div className="action-buttons">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "保存中..." : "設定を保存"}
          </button>
        </div>
      </form>
    </div>
  );
}

// 残高管理コンポーネント
function BalancePage({ balance, onUpdate }) {
  const [formData, setFormData] = useState(balance);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setFormData(balance);
  }, [balance]);

  const handleChange = (currency, value) => {
    setFormData({ ...formData, [currency]: Number(value) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/balance", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setMessage("残高を更新しました");
        onUpdate(formData);
        setTimeout(() => setMessage(""), 3000);
      } else {
        setMessage("更新に失敗しました");
      }
    } catch (err) {
      setMessage("エラーが発生しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {message && (
        <div
          className={
            message.includes("更新") ? "success-message" : "error-message"
          }
        >
          {message}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-label">BTC 残高</div>
          <div className="stat-value">{formData.BTC?.toFixed(4)}</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">ETH 残高</div>
          <div className="stat-value">{formData.ETH?.toFixed(4)}</div>
        </div>
        <div className="stat-card yellow">
          <div className="stat-label">JPY 残高</div>
          <div className="stat-value">¥{formData.JPY?.toLocaleString()}</div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="settings-section">
          <h3>残高編集</h3>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">BTC</label>
              <input
                type="number"
                step="0.0001"
                className="form-input"
                value={formData.BTC}
                onChange={(e) => handleChange("BTC", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">ETH</label>
              <input
                type="number"
                step="0.0001"
                className="form-input"
                value={formData.ETH}
                onChange={(e) => handleChange("ETH", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">JPY</label>
              <input
                type="number"
                className="form-input"
                value={formData.JPY}
                onChange={(e) => handleChange("JPY", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="action-buttons">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "更新中..." : "残高を更新"}
          </button>
        </div>
      </form>
    </div>
  );
}

// 取引IDフォーマット関数
const formatTradeId = (id) => {
  return `TRX-${String(id).padStart(5, "0")}`;
};

// 注文一覧コンポーネント（保留中の注文のみ）
function OrdersPage({ orders, onManualFill, onCancel }) {
  const [tradeTypeFilter, setTradeTypeFilter] = useState("all");

  // 保留中の注文のみフィルター
  let pendingOrders = orders.filter((order) => order.status === "pending");

  // 取引種別でフィルター
  if (tradeTypeFilter !== "all") {
    pendingOrders = pendingOrders.filter(
      (order) => (order.trade_type || "spot") === tradeTypeFilter,
    );
  }

  const getOrderTypeBadge = (type) => {
    return type === "market" ? (
      <span className="badge info">成行</span>
    ) : (
      <span className="badge warning">指値</span>
    );
  };

  const getTradeTypeBadge = (tradeType) => {
    const type = tradeType || "spot";
    return type === "spot" ? (
      <span className="badge" style={{ background: "#3498db", color: "white" }}>
        現物
      </span>
    ) : (
      <span className="badge" style={{ background: "#9b59b6", color: "white" }}>
        レバ
      </span>
    );
  };

  const handleManualFill = async (orderId) => {
    if (confirm("この注文を手動で約定しますか？")) {
      await onManualFill(orderId);
    }
  };

  const handleCancel = async (orderId) => {
    if (confirm("この注文をキャンセルしますか？")) {
      await onCancel(orderId);
    }
  };

  return (
    <div>
      <div className="section-header">
        <h3>保留中の注文（{pendingOrders.length}件）</h3>
        <div>
          <select
            className="form-input"
            value={tradeTypeFilter}
            onChange={(e) => setTradeTypeFilter(e.target.value)}
            style={{ width: "150px" }}
          >
            <option value="all">すべて</option>
            <option value="spot">現物のみ</option>
            <option value="leverage">レバレッジのみ</option>
          </select>
        </div>
      </div>

      {pendingOrders.length === 0 ? (
        <div className="loading">保留中の注文はありません</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>取引ID</th>
              <th>取引種別</th>
              <th>注文タイプ</th>
              <th>売買</th>
              <th>通貨ペア</th>
              <th>数量</th>
              <th>価格</th>
              <th>合計金額</th>
              <th>作成日時</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {pendingOrders.map((order) => (
              <tr key={order.id}>
                <td>
                  <strong>{formatTradeId(order.id)}</strong>
                </td>
                <td>{getTradeTypeBadge(order.trade_type)}</td>
                <td>{getOrderTypeBadge(order.type)}</td>
                <td>
                  <span
                    className={
                      order.side === "buy" ? "badge success" : "badge danger"
                    }
                  >
                    {order.side === "buy" ? "買い" : "売り"}
                  </span>
                </td>
                <td>{order.pair}</td>
                <td>{order.amount}</td>
                <td>¥{order.price?.toLocaleString()}</td>
                <td>¥{order.total?.toLocaleString()}</td>
                <td>{new Date(order.timestamp).toLocaleString("ja-JP")}</td>
                <td>
                  <button
                    className="btn btn-success"
                    style={{ marginRight: "5px" }}
                    onClick={() => handleManualFill(order.id)}
                  >
                    約定
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleCancel(order.id)}
                  >
                    キャンセル
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// 注文履歴コンポーネント（完了・キャンセル済み）
function OrderHistoryPage({ orders }) {
  // 複数フィルター用のstate
  const [statusFilter, setStatusFilter] = useState("all");
  const [sideFilter, setSideFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tradeTypeFilter, setTradeTypeFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [pairFilter, setPairFilter] = useState("all");

  // 期間フィルター用の日付計算
  const getDateThreshold = (period) => {
    const now = new Date();
    switch (period) {
      case "today":
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );
        return today;
      case "7days":
        const week = new Date(now);
        week.setDate(week.getDate() - 7);
        return week;
      case "30days":
        const month = new Date(now);
        month.setDate(month.getDate() - 30);
        return month;
      default:
        return null;
    }
  };

  // 全ての注文を対象にフィルタリング（pending含む）
  const filteredOrders = orders.filter((order) => {
    // ステータスフィルター
    if (statusFilter !== "all" && order.status !== statusFilter) return false;

    // 売買区分フィルター
    if (sideFilter !== "all" && order.side !== sideFilter) return false;

    // 注文タイプフィルター
    if (typeFilter !== "all" && order.type !== typeFilter) return false;

    // 取引種別フィルター
    if (tradeTypeFilter !== "all") {
      const orderTradeType = order.trade_type || "spot";
      if (orderTradeType !== tradeTypeFilter) return false;
    }

    // 期間フィルター
    if (periodFilter !== "all") {
      const threshold = getDateThreshold(periodFilter);
      if (threshold) {
        const orderDate = new Date(order.timestamp);
        if (orderDate < threshold) return false;
      }
    }

    // 通貨ペアフィルター
    if (pairFilter !== "all" && order.pair !== pairFilter) return false;

    return true;
  });

  const getStatusBadge = (status) => {
    const badges = {
      pending: { class: "warning", text: "注文中" },
      filled: { class: "success", text: "約定済み" },
      canceled: { class: "danger", text: "キャンセル" },
      liquidated: { class: "danger", text: "強制決済" },
      expired: { class: "info", text: "期限切れ" },
      rejected: { class: "danger", text: "拒否" },
    };
    const badge = badges[status] || { class: "info", text: status };
    return <span className={`badge ${badge.class}`}>{badge.text}</span>;
  };

  const getOrderTypeBadge = (type) => {
    return type === "market" ? (
      <span className="badge info">成行</span>
    ) : (
      <span className="badge warning">指値</span>
    );
  };

  const getTradeTypeBadge = (tradeType) => {
    const type = tradeType || "spot";
    return type === "spot" ? (
      <span className="badge" style={{ background: "#3498db", color: "white" }}>
        現物
      </span>
    ) : (
      <span className="badge" style={{ background: "#9b59b6", color: "white" }}>
        レバ
      </span>
    );
  };

  return (
    <div>
      <div className="section-header">
        <h3>注文履歴（{filteredOrders.length}件）</h3>
      </div>

      {/* フィルターエリア */}
      <div className="filter-section">
        <div className="filter-grid">
          <div className="filter-item">
            <label className="filter-label">ステータス</label>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">すべて</option>
              <option value="pending">注文中</option>
              <option value="filled">約定済み</option>
              <option value="canceled">キャンセル</option>
              <option value="liquidated">強制決済</option>
              <option value="expired">期限切れ</option>
              <option value="rejected">拒否</option>
            </select>
          </div>

          <div className="filter-item">
            <label className="filter-label">売買区分</label>
            <select
              className="form-input"
              value={sideFilter}
              onChange={(e) => setSideFilter(e.target.value)}
            >
              <option value="all">すべて</option>
              <option value="buy">買い</option>
              <option value="sell">売り</option>
            </select>
          </div>

          <div className="filter-item">
            <label className="filter-label">注文タイプ</label>
            <select
              className="form-input"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">すべて</option>
              <option value="market">成行</option>
              <option value="limit">指値</option>
            </select>
          </div>

          <div className="filter-item">
            <label className="filter-label">取引種別</label>
            <select
              className="form-input"
              value={tradeTypeFilter}
              onChange={(e) => setTradeTypeFilter(e.target.value)}
            >
              <option value="all">すべて</option>
              <option value="spot">現物</option>
              <option value="leverage">レバレッジ</option>
            </select>
          </div>

          <div className="filter-item">
            <label className="filter-label">期間</label>
            <select
              className="form-input"
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
            >
              <option value="all">すべて</option>
              <option value="today">今日</option>
              <option value="7days">過去7日</option>
              <option value="30days">過去30日</option>
            </select>
          </div>

          <div className="filter-item">
            <label className="filter-label">通貨ペア</label>
            <select
              className="form-input"
              value={pairFilter}
              onChange={(e) => setPairFilter(e.target.value)}
            >
              <option value="all">すべて</option>
              <option value="BTC/JPY">BTC/JPY</option>
              <option value="ETH/JPY">ETH/JPY</option>
            </select>
          </div>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="loading">条件に一致する注文がありません</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>取引ID</th>
              <th>取引種別</th>
              <th>注文タイプ</th>
              <th>売買</th>
              <th>通貨ペア</th>
              <th>数量</th>
              <th>価格</th>
              <th>合計金額</th>
              <th>ステータス</th>
              <th>作成日時</th>
              <th>完了日時</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id}>
                <td>
                  <strong>{formatTradeId(order.id)}</strong>
                </td>
                <td>{getTradeTypeBadge(order.trade_type)}</td>
                <td>{getOrderTypeBadge(order.type)}</td>
                <td>
                  <span
                    className={
                      order.side === "buy" ? "badge success" : "badge danger"
                    }
                  >
                    {order.side === "buy" ? "買い" : "売り"}
                  </span>
                </td>
                <td>{order.pair}</td>
                <td>{order.amount}</td>
                <td>¥{order.price?.toLocaleString()}</td>
                <td>¥{order.total?.toLocaleString()}</td>
                <td>{getStatusBadge(order.status)}</td>
                <td>{new Date(order.timestamp).toLocaleString("ja-JP")}</td>
                <td>
                  {order.filled_at
                    ? new Date(order.filled_at).toLocaleString("ja-JP")
                    : order.canceled_at
                      ? new Date(order.canceled_at).toLocaleString("ja-JP")
                      : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// メインアプリケーション
function AdminApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [loadError, setLoadError] = useState("");
  const [settings, setSettings] = useState(null);
  const [balance, setBalance] = useState(null);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
    canceledOrders: 0,
    btcPrice: 0,
    feeRate: 0,
    minOrderAmount: 0,
    usdJpyRate: 0,
  });

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (token) {
      setIsLoggedIn(true);
      loadData();
    }
  }, []);

  const loadData = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        setIsLoggedIn(false);
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const fetchWithAuth = async (url, options = {}) => {
        const response = await fetch(url, options);
        if (response.status === 401) {
          throw new Error("UNAUTHORIZED");
        }
        return response;
      };

      // 設定取得
      const settingsRes = await fetchWithAuth("/api/admin/settings", { headers });
      const settingsData = await settingsRes.json();
      if (settingsData.success) {
        setSettings(settingsData.data);
      }

      // 残高取得
      const balanceRes = await fetchWithAuth("/api/admin/balance", { headers });
      const balanceData = await balanceRes.json();
      if (balanceData.success) {
        setBalance(balanceData.data);
      }

      // 注文取得
      const ordersRes = await fetchWithAuth("/api/admin/orders", { headers });
      const ordersData = await ordersRes.json();
      if (ordersData.success) {
        setOrders(ordersData.data);
      }

      // 統計取得
      const statsRes = await fetchWithAuth("/api/admin/stats", { headers });
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.data);
      }

      setLoadError("");
    } catch (err) {
      if (err.message === "UNAUTHORIZED") {
        localStorage.removeItem("adminToken");
        setIsLoggedIn(false);
        setSettings(null);
        setBalance(null);
        setLoadError("");
        return;
      }
      setLoadError("管理画面データの読み込みに失敗しました");
      console.error("データ読み込みエラー:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setIsLoggedIn(false);
  };

  const handleManualFill = async (orderId) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/fill`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        loadData();
      }
    } catch (err) {
      console.error("約定エラー:", err);
    }
  };

  const handleCancelOrder = async (orderId) => {
    try {
      const response = await fetch(`/api/admin/orders/${orderId}/cancel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("adminToken")}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        loadData();
      }
    } catch (err) {
      console.error("キャンセルエラー:", err);
    }
  };

  if (!isLoggedIn) {
    return (
      <LoginPage
        onLogin={() => {
          setIsLoggedIn(true);
          loadData();
        }}
      />
    );
  }

  if (!settings || !balance) {
    return (
      <div className="loading">
        {loadError || "読み込み中..."}
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard stats={stats} />;
      case "settings":
        return (
          <SettingsPage
            settings={settings}
            onSave={(data) => {
              setSettings(data);
              loadData();
            }}
          />
        );
      case "balance":
        return (
          <BalancePage
            balance={balance}
            onUpdate={(data) => {
              setBalance(data);
              loadData();
            }}
          />
        );
      case "orders":
        return (
          <OrdersPage
            orders={orders}
            onManualFill={handleManualFill}
            onCancel={handleCancelOrder}
          />
        );
      case "history":
        return <OrderHistoryPage orders={orders} />;
      default:
        return <Dashboard stats={stats} />;
    }
  };

  const menuItems = [
    { id: "dashboard", label: "ダッシュボード", icon: "📊" },
    { id: "settings", label: "システム設定", icon: "⚙️" },
    { id: "balance", label: "残高管理", icon: "💰" },
    { id: "orders", label: "注文一覧", icon: "📝" },
    { id: "history", label: "注文履歴", icon: "📋" },
  ];

  return (
    <div className="admin-container">
      <div className="admin-sidebar">
        <div className="admin-logo">
          <h1>ADMIN</h1>
          <p>管理画面</p>
        </div>
        <ul className="admin-menu">
          {menuItems.map((item) => (
            <li
              key={item.id}
              className={`admin-menu-item ${currentPage === item.id ? "active" : ""}`}
              onClick={() => setCurrentPage(item.id)}
            >
              <span className="admin-menu-icon">{item.icon}</span>
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="admin-main">
        <div className="admin-header">
          <h2>{menuItems.find((item) => item.id === currentPage)?.label}</h2>
          <div className="admin-user">
            <span>管理者</span>
            <button className="logout-btn" onClick={handleLogout}>
              ログアウト
            </button>
          </div>
        </div>

        <div className="admin-content">{renderPage()}</div>
      </div>
    </div>
  );
}

// レンダリング
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<AdminApp />);
