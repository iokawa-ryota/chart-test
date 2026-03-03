from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import time
import random
from datetime import datetime
import json
import os
import hashlib
from functools import wraps

app = Flask(__name__, static_folder='static')
CORS(app)

# データファイルパス
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
SETTINGS_FILE = os.path.join(DATA_DIR, 'settings.json')
BALANCE_FILE = os.path.join(DATA_DIR, 'balance.json')
ORDERS_FILE = os.path.join(DATA_DIR, 'orders.json')
DEPOSITS_FILE = os.path.join(DATA_DIR, 'deposits.json')
WITHDRAWALS_FILE = os.path.join(DATA_DIR, 'withdrawals.json')

# 管理者パスワード（SHA256ハッシュ）
ADMIN_PASSWORD_HASH = hashlib.sha256('admin'.encode()).hexdigest()

# JSON読み書き関数
def read_json(filepath, default=None):
    """JSONファイルを読み込む"""
    try:
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        return default
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return default

def write_json(filepath, data):
    """JSONファイルに書き込む"""
    try:
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error writing {filepath}: {e}")
        return False

# データ読み込み
def load_settings():
    return read_json(SETTINGS_FILE, {
        'mock_btc_price': 15000000,
        'fee_rate': 0.001,
        'min_order_amount': 0.0001,
        'usdjpy_rate': 150,
        'price_limit_percent': 10,
        'maintenance_mode': False
    })

def load_balance():
    return read_json(BALANCE_FILE, {'BTC': 1.5, 'ETH': 10.0, 'JPY': 5000000})

def load_orders():
    return read_json(ORDERS_FILE, [])

def load_deposits():
    return read_json(DEPOSITS_FILE, [])

def load_withdrawals():
    return read_json(WITHDRAWALS_FILE, [])

# 管理者認証デコレーター
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'success': False, 'error': '認証が必要です'}), 401
        
        token = auth_header.split(' ')[1]
        
        # 簡易的なトークン検証（本番環境ではJWTなどを使用）
        if token != ADMIN_PASSWORD_HASH:
            return jsonify({'success': False, 'error': '認証に失敗しました'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

# 初期データ読み込み
settings = load_settings()
mock_balance = load_balance()
mock_deposit_history = load_deposits()
mock_withdrawal_history = load_withdrawals()
mock_orders = load_orders()

# グローバル変数
order_id_counter = len(mock_orders) + 1
CURRENT_BTC_PRICE = settings.get('mock_btc_price', 15000000)

# 静的ファイルの配信
@app.route('/')
def index():
    return send_from_directory('static', 'index.html')

@app.route('/admin')
def admin_index():
    return send_from_directory('static/admin', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('static', path)

# ===== 管理画面API =====

# API: 管理者ログイン
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.json
    password = data.get('password', '')
    
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    if password_hash == ADMIN_PASSWORD_HASH:
        return jsonify({
            'success': True,
            'token': ADMIN_PASSWORD_HASH
        })
    else:
        return jsonify({
            'success': False,
            'error': 'パスワードが正しくありません'
        }), 401

# API: 設定取得
@app.route('/api/admin/settings', methods=['GET'])
@admin_required
def get_admin_settings():
    settings = load_settings()
    return jsonify({'success': True, 'data': settings})

# API: 設定更新
@app.route('/api/admin/settings', methods=['PUT'])
@admin_required
def update_admin_settings():
    global settings, CURRENT_BTC_PRICE
    
    data = request.json
    
    if write_json(SETTINGS_FILE, data):
        settings = data
        CURRENT_BTC_PRICE = settings.get('mock_btc_price', 15000000)
        return jsonify({'success': True, 'message': '設定を更新しました'})
    else:
        return jsonify({'success': False, 'error': '設定の保存に失敗しました'}), 500

# API: 残高取得（管理画面用）
@app.route('/api/admin/balance', methods=['GET'])
@admin_required
def get_admin_balance():
    balance = load_balance()
    return jsonify({'success': True, 'data': balance})

# API: 残高更新
@app.route('/api/admin/balance', methods=['PUT'])
@admin_required
def update_admin_balance():
    global mock_balance
    
    data = request.json
    
    if write_json(BALANCE_FILE, data):
        mock_balance = data
        return jsonify({'success': True, 'message': '残高を更新しました'})
    else:
        return jsonify({'success': False, 'error': '残高の保存に失敗しました'}), 500

# API: 注文一覧取得（管理画面用）
@app.route('/api/admin/orders', methods=['GET'])
@admin_required
def get_admin_orders():
    orders = load_orders()
    return jsonify({'success': True, 'data': orders})

# API: 注文手動約定
@app.route('/api/admin/orders/<int:order_id>/fill', methods=['POST'])
@admin_required
def fill_order(order_id):
    global mock_orders, mock_balance
    
    orders = load_orders()
    order = next((o for o in orders if o.get('id') == order_id), None)
    
    if not order:
        return jsonify({'success': False, 'error': '注文が見つかりません'}), 404
    
    if order.get('status') != 'pending':
        return jsonify({'success': False, 'error': 'この注文は約定できません'}), 400
    
    # 約定処理
    order['status'] = 'filled'
    order['filled_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    # 残高更新
    balance = load_balance()
    if order.get('type') == 'buy':
        balance['JPY'] -= (order['price'] * order['amount'])
        balance['BTC'] = balance.get('BTC', 0) + order['amount']
    else:
        balance['BTC'] -= order['amount']
        balance['JPY'] = balance.get('JPY', 0) + (order['price'] * order['amount'])
    
    write_json(ORDERS_FILE, orders)
    write_json(BALANCE_FILE, balance)
    
    mock_orders = orders
    mock_balance = balance
    
    return jsonify({'success': True, 'message': '注文を約定しました'})

# API: 注文キャンセル（管理画面用）
@app.route('/api/admin/orders/<int:order_id>/cancel', methods=['POST'])
@admin_required
def admin_cancel_order(order_id):
    global mock_orders
    
    orders = load_orders()
    order = next((o for o in orders if o.get('id') == order_id), None)
    
    if not order:
        return jsonify({'success': False, 'error': '注文が見つかりません'}), 404
    
    if order.get('status') != 'pending':
        return jsonify({'success': False, 'error': 'この注文はキャンセルできません'}), 400
    
    order['status'] = 'canceled'
    order['canceled_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    write_json(ORDERS_FILE, orders)
    mock_orders = orders
    
    return jsonify({'success': True, 'message': '注文をキャンセルしました'})

# API: 統計情報取得
@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def get_admin_stats():
    orders = load_orders()
    settings = load_settings()
    
    stats = {
        'totalOrders': len(orders),
        'completedOrders': len([o for o in orders if o.get('status') == 'filled']),
        'pendingOrders': len([o for o in orders if o.get('status') == 'pending']),
        'canceledOrders': len([o for o in orders if o.get('status') in ['canceled', 'cancelled']]),
        'btcPrice': settings.get('mock_btc_price', 15000000),
        'feeRate': settings.get('fee_rate', 0.001),
        'minOrderAmount': settings.get('min_order_amount', 0.0001),
        'usdJpyRate': settings.get('usdjpy_rate', 150)
    }
    
    return jsonify({'success': True, 'data': stats})

# ===== フロントエンド用API =====


# API: 残高取得
@app.route('/api/balance', methods=['GET'])
def get_balance():
    time.sleep(0.3)  # レスポンス遅延を模擬
    balance = load_balance()
    return jsonify(balance)

# API: 入金履歴取得
@app.route('/api/deposits', methods=['GET'])
def get_deposits():
    time.sleep(0.3)
    return jsonify(mock_deposit_history)

# API: 出金履歴取得
@app.route('/api/withdrawals', methods=['GET'])
def get_withdrawals():
    time.sleep(0.3)
    return jsonify(mock_withdrawal_history)

# API: 出金申請
@app.route('/api/withdraw', methods=['POST'])
def withdraw():
    data = request.json
    
    # バリデーションのシミュレーション
    time.sleep(1)  # 処理中の表現
    
    currency = data.get('currency')
    address = data.get('address')
    amount = data.get('amount')
    
    # エラーケースのシミュレーション
    if not currency:
        return jsonify({'error': '通貨を選択してください'}), 400
    
    if not address:
        return jsonify({'error': '出金先アドレスを入力してください'}), 400
    
    if not amount:
        return jsonify({'error': '出金額を入力してください'}), 400
    
    try:
        amount_float = float(amount)
    except:
        return jsonify({'error': '出金額は数値で入力してください'}), 400
    
    if amount_float <= 0:
        return jsonify({'error': '出金額は0より大きい値を入力してください'}), 400
    
    # 最小額チェック
    min_amount = 0.001 if currency == 'BTC' else 0.01
    if amount_float < min_amount:
        return jsonify({'error': f'最小出金額は {min_amount} {currency} です'}), 400
    
    # 残高チェック
    fee = 0.0005 if currency == 'BTC' else 0.005
    if amount_float + fee > mock_balance.get(currency, 0):
        return jsonify({'error': '残高が不足しています'}), 400
    
    # アドレス形式チェック（簡易版）
    if currency == 'BTC' and not (address.startswith('1') or address.startswith('3') or address.startswith('bc1')):
        return jsonify({'error': 'BTCアドレスの形式が正しくありません'}), 400
    
    if currency == 'ETH' and not address.startswith('0x'):
        return jsonify({'error': 'ETHアドレスの形式が正しくありません'}), 400
    
    # 成功
    withdrawal_id = len(mock_withdrawal_history) + 1
    new_withdrawal = {
        'id': withdrawal_id,
        'date': '2026-02-27 12:00',
        'currency': currency,
        'amount': amount_float,
        'address': address,
        'fee': fee,
        'status': '処理中'
    }
    mock_withdrawal_history.append(new_withdrawal)
    
    # 残高を減らす
    mock_balance[currency] -= (amount_float + fee)
    
    return jsonify({
        'success': True,
        'message': '出金申請を受け付けました',
        'withdrawal_id': withdrawal_id
    })

# API: 現在価格取得（モック）
@app.route('/api/current-price', methods=['GET'])
def get_current_price():
    # 実際にはBybit APIから取得すべきだが、モックで返す
    return jsonify({
        'symbol': 'BTC/JPY',
        'price': CURRENT_BTC_PRICE,
        'timestamp': int(time.time() * 1000)
    })

# API: 注文作成
@app.route('/api/orders', methods=['POST'])
def create_order():
    global order_id_counter, mock_orders, mock_balance
    data = request.json
    
    time.sleep(0.5)  # 処理遅延
    
    order_side = data.get('side')  # 'buy' or 'sell'
    order_type = data.get('type')  # 'market' or 'limit'
    amount = data.get('amount')
    price = data.get('price')  # 指値の場合のみ
    
    # バリデーション
    if order_side not in ['buy', 'sell']:
        return jsonify({'error': '注文種別を選択してください'}), 400
    
    if order_type not in ['market', 'limit']:
        return jsonify({'error': '注文タイプを選択してください'}), 400
    
    if not amount:
        return jsonify({'error': '数量を入力してください'}), 400
    
    try:
        amount_float = float(amount)
    except:
        return jsonify({'error': '数量は数値で入力してください'}), 400
    
    if amount_float <= 0:
        return jsonify({'error': '数量は0より大きい値を入力してください'}), 400
    
    # 設定から最小数量を取得
    settings = load_settings()
    MIN_ORDER_AMOUNT = settings.get('min_order_amount', 0.0001)
    
    if amount_float < MIN_ORDER_AMOUNT:
        return jsonify({'error': f'最小注文数量は {MIN_ORDER_AMOUNT} BTC です'}), 400
    
    # 指値注文の場合は価格チェック
    if order_type == 'limit':
        if not price:
            return jsonify({'error': '指値価格を入力してください'}), 400
        
        try:
            price_float = float(price)
        except:
            return jsonify({'error': '価格は数値で入力してください'}), 400
        
        if price_float <= 0:
            return jsonify({'error': '価格は0より大きい値を入力してください'}), 400
        
        # 価格範囲チェック
        price_limit = settings.get('price_limit_percent', 10) / 100
        min_price = CURRENT_BTC_PRICE * (1 - price_limit)
        max_price = CURRENT_BTC_PRICE * (1 + price_limit)
        
        if price_float < min_price or price_float > max_price:
            return jsonify({'error': f'価格は現在価格の±{settings.get("price_limit_percent", 10)}%以内（{int(min_price):,}円〜{int(max_price):,}円）で指定してください'}), 400
        
        execution_price = price_float
    else:
        # 成行注文の場合は現在価格で約定
        execution_price = CURRENT_BTC_PRICE
    
    # 残高取得
    balance = load_balance()
    fee_rate = settings.get('fee_rate', 0.001)
    
    # 残高チェック
    if order_side == 'buy':
        # 買い注文：JPY残高が必要
        required_jpy = execution_price * amount_float
        fee = required_jpy * fee_rate
        total_required = required_jpy + fee
        
        if total_required > balance['JPY']:
            return jsonify({'error': f'JPY残高が不足しています（必要: {int(total_required):,}円、残高: {int(balance["JPY"]):,}円）'}), 400
    else:
        # 売り注文：BTC残高が必要
        if amount_float > balance['BTC']:
            return jsonify({'error': f'BTC残高が不足しています（必要: {amount_float}BTC、残高: {balance["BTC"]}BTC）'}), 400
    
    # 注文作成
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    order_id = order_id_counter
    order_id_counter += 1
    
    new_order = {
        'id': order_id,
        'side': order_side,
        'type': order_type,
        'pair': 'BTC/JPY',
        'amount': amount_float,
        'price': execution_price,
        'total': execution_price * amount_float,
        'fee': execution_price * amount_float * fee_rate,
        'status': 'filled' if order_type == 'market' else 'pending',  # 成行は即約定
        'timestamp': now,
        'filled_at': now if order_type == 'market' else None
    }
    
    orders = load_orders()
    orders.append(new_order)
    
    # 成行注文の場合は即座に残高を更新
    if order_type == 'market':
        if order_side == 'buy':
            balance['JPY'] -= (new_order['total'] + new_order['fee'])
            balance['BTC'] += amount_float
        else:
            balance['BTC'] -= amount_float
            balance['JPY'] += (new_order['total'] - new_order['fee'])
        
        write_json(BALANCE_FILE, balance)
    
    # 注文をファイルに保存
    write_json(ORDERS_FILE, orders)
    
    # メモリ上のデータも更新
    mock_orders = orders
    mock_balance = balance
    
    return jsonify({
        'success': True,
        'message': '注文を受け付けました' if order_type == 'limit' else '注文が約定しました',
        'order': new_order
    })

# API: 注文一覧取得
@app.route('/api/orders', methods=['GET'])
def get_orders():
    status = request.args.get('status')  # 'pending', 'filled', 'all'
    
    orders = load_orders()
    
    if status == 'pending':
        filtered_orders = [o for o in orders if o.get('status') == 'pending']
    elif status == 'filled':
        filtered_orders = [o for o in orders if o.get('status') == 'filled']
    else:
        filtered_orders = orders
    
    return jsonify(filtered_orders)

# API: 注文キャンセル
@app.route('/api/orders/<int:order_id>', methods=['DELETE'])
def cancel_order(order_id):
    global mock_orders
    
    time.sleep(0.3)
    
    orders = load_orders()
    order = next((o for o in orders if o.get('id') == order_id), None)
    
    if not order:
        return jsonify({'error': '注文が見つかりません'}), 404
    
    if order.get('status') not in ['open', 'pending']:
        return jsonify({'error': 'この注文はキャンセルできません'}), 400
    
    order['status'] = 'cancelled'
    order['cancelled_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    write_json(ORDERS_FILE, orders)
    mock_orders = orders
    
    return jsonify({
        'success': True,
        'message': '注文をキャンセルしました',
        'order': order
    })

if __name__ == '__main__':
    print('=' * 60)
    print('デモサイトが起動しました！')
    print('')
    print('フロントエンド: http://localhost:5000')
    print('管理画面:       http://localhost:5000/admin')
    print('')
    print('管理画面ログインパスワード: admin')
    print('=' * 60)
    app.run(debug=True, host='0.0.0.0', port=5000)
