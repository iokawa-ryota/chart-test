from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import time
import random
from datetime import datetime
import json
import os
import hashlib
from functools import wraps
from urllib import request as urllib_request
from urllib import parse as urllib_parse
from apscheduler.schedulers.background import BackgroundScheduler

from database import init_db, get_db, Setting, Balance, Order, Transaction
init_db()

app = Flask(__name__, static_folder='static')
CORS(app)

def create_lambda_handler(flask_app):
    try:
        from asgiref.wsgi import WsgiToAsgi
        from mangum import Mangum
    except ImportError:
        if os.getenv('APP_RUNTIME') == 'lambda':
            raise
        return None

    return Mangum(WsgiToAsgi(flask_app))


handler = create_lambda_handler(app)

SYMBOL_ASSET_MAP = {
    'BTCUSDT': {'asset': 'BTC', 'pair': 'BTC/JPY', 'fallback_price': 15000000},
    'ETHUSDT': {'asset': 'ETH', 'pair': 'ETH/JPY', 'fallback_price': 500000},
    'XRPUSDT': {'asset': 'XRP', 'pair': 'XRP/JPY', 'fallback_price': 90},
    'SOLUSDT': {'asset': 'SOL', 'pair': 'SOL/JPY', 'fallback_price': 15000},
    'USDCUSDT': {'asset': 'USDC', 'pair': 'USDC/JPY', 'fallback_price': 150},
}

# 管理者パスワード（SHA256ハッシュ）
ADMIN_PASSWORD_HASH = hashlib.sha256('admin'.encode()).hexdigest()

# データ読み込み関数群（DBから）
def load_settings():
    with get_db() as db:
        records = db.query(Setting).all()
        if not records:
            return {
                'mock_btc_price': 15000000,
                'fee_rate': 0.001,
                'min_order_amount': 0.0001,
                'usdjpy_rate': 150,
                'price_limit_percent': 10,
                'maintenance_mode': False
            }
        return {s.key: json.loads(s.value) for s in records}

def load_balance():
    with get_db() as db:
        records = db.query(Balance).all()
        balance = {b.asset: b.amount for b in records}
        for asset in ['BTC', 'ETH', 'XRP', 'SOL', 'USDC', 'JPY']:
            if asset not in balance:
                balance[asset] = 0.0
        return balance


def fetch_symbol_price_jpy(symbol, settings_data):
    symbol_meta = SYMBOL_ASSET_MAP.get(symbol, SYMBOL_ASSET_MAP['BTCUSDT'])
    fallback_price = symbol_meta['fallback_price']
    usdjpy_rate = settings_data.get('usdjpy_rate', 150)

    try:
        query = urllib_parse.urlencode({
            'category': 'spot',
            'symbol': symbol,
        })
        url = f"https://api.bybit.com/v5/market/tickers?{query}"

        with urllib_request.urlopen(url, timeout=3) as response:
            data = json.loads(response.read().decode('utf-8'))

        if data.get('retCode') == 0 and data.get('result', {}).get('list'):
            last_price_usd = float(data['result']['list'][0]['lastPrice'])
            return round(last_price_usd * usdjpy_rate)
    except Exception as e:
        print(f"Failed to fetch symbol price for {symbol}: {e}")

    return fallback_price

def load_orders():
    with get_db() as db:
        records = db.query(Order).order_by(Order.timestamp.desc()).all()
        return [{
            'id': o.id, 'side': o.side, 'type': o.type, 'symbol': o.symbol,
            'pair': o.pair, 'trade_type': o.trade_type, 'leverage_ratio': o.leverage_ratio,
            'amount': o.amount, 'price': o.price, 'execution_price': o.execution_price,
            'total': o.total, 'fee': o.fee, 'margin_used': o.margin_used,
            'status': o.status, 'timestamp': o.timestamp, 'filled_at': o.filled_at
        } for o in records]

def load_deposits():
    with get_db() as db:
        records = db.query(Transaction).filter(Transaction.type == 'deposit').order_by(Transaction.timestamp.desc()).all()
        return [{
            'id': t.id, 'date': t.timestamp, 'currency': t.currency, 'amount': t.amount,
            'fee': t.fee, 'status': t.status
        } for t in records]

def load_withdrawals():
    with get_db() as db:
        records = db.query(Transaction).filter(Transaction.type == 'withdraw').order_by(Transaction.timestamp.desc()).all()
        return [{
            'id': t.id, 'date': t.timestamp, 'currency': t.currency, 'amount': t.amount,
            'address': t.address, 'fee': t.fee, 'status': t.status
        } for t in records]

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

# グローバル変数
# 初期データ読み込みはリクエスト毎にDBから行うようにするためグローバルは最小限に
settings = load_settings()
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
    with get_db() as db:
        try:
            for k, v in data.items():
                s = db.query(Setting).filter(Setting.key == k).first()
                if s:
                    s.value = json.dumps(v)
                else:
                    db.add(Setting(key=k, value=json.dumps(v)))
            db.commit()
            
            settings = load_settings()
            CURRENT_BTC_PRICE = settings.get('mock_btc_price', 15000000)
            return jsonify({'success': True, 'message': '設定を更新しました'})
        except Exception as e:
            db.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

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
    data = request.json
    with get_db() as db:
        try:
            for asset, amount in data.items():
                b = db.query(Balance).filter(Balance.asset == asset).first()
                if b:
                    b.amount = amount
                else:
                    db.add(Balance(asset=asset, amount=amount))
            db.commit()
            return jsonify({'success': True, 'message': '残高を更新しました'})
        except Exception as e:
            db.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

# API: 注文一覧取得（管理画面用）
@app.route('/api/admin/orders', methods=['GET'])
@admin_required
def get_admin_orders():
    orders = load_orders()
    return jsonify({'success': True, 'data': orders})

# API: 注文手動約定
@app.route('/api/admin/orders/<string:order_id>/fill', methods=['POST'])
@admin_required
def fill_order(order_id):
    with get_db() as db:
        order = db.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            return jsonify({'success': False, 'error': '注文が見つかりません'}), 404
        
        if order.status != 'pending':
            return jsonify({'success': False, 'error': 'この注文は約定できません'}), 400
        
        try:
            # 約定処理
            order.status = 'filled'
            order.filled_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            # 残高更新
            jpy_balance = db.query(Balance).filter(Balance.asset == 'JPY').first()
            base_balance = db.query(Balance).filter(Balance.asset == order.symbol.replace('USDT', '')).first()
            if not base_balance:
                base_balance = Balance(asset=order.symbol.replace('USDT', ''), amount=0.0)
                db.add(base_balance)
                
            if order.type == 'buy':
                jpy_balance.amount -= (order.price * order.amount)
                base_balance.amount += order.amount
            else:
                base_balance.amount -= order.amount
                jpy_balance.amount += (order.price * order.amount)
            
            db.commit()
            return jsonify({'success': True, 'message': '注文を約定しました'})
        except Exception as e:
            db.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

# API: 注文キャンセル（管理画面用）
@app.route('/api/admin/orders/<string:order_id>/cancel', methods=['POST'])
@admin_required
def admin_cancel_order(order_id):
    with get_db() as db:
        order = db.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            return jsonify({'success': False, 'error': '注文が見つかりません'}), 404
        
        if order.status != 'pending':
            return jsonify({'success': False, 'error': 'この注文はキャンセルできません'}), 400
        
        try:
            order.status = 'canceled'
            # canceled_at logic
            db.commit()
            return jsonify({'success': True, 'message': '注文をキャンセルしました'})
        except Exception as e:
            db.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

# API: 統計情報取得
@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def get_admin_stats():
    orders = load_orders()
    settings = load_settings()
    
    stats = {
        'totalOrders': len(orders),
        'completedOrders': len([o for o in orders if o['status'] == 'filled']),
        'pendingOrders': len([o for o in orders if o['status'] == 'pending']),
        'canceledOrders': len([o for o in orders if o['status'] in ['canceled', 'cancelled']]),
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
    return jsonify(load_balance())

# API: 入金履歴取得
@app.route('/api/deposits', methods=['GET'])
def get_deposits():
    time.sleep(0.3)
    return jsonify(load_deposits())

# API: 出金履歴取得
@app.route('/api/withdrawals', methods=['GET'])
def get_withdrawals():
    time.sleep(0.3)
    return jsonify(load_withdrawals())

# API: 出金申請
@app.route('/api/withdraw', methods=['POST'])
def withdraw():
    data = request.json
    time.sleep(1)  # 処理中の表現
    
    currency = data.get('currency')
    address = data.get('address')
    amount = data.get('amount')
    
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
    
    min_amount = 0.001 if currency == 'BTC' else 0.01
    if amount_float < min_amount:
        return jsonify({'error': f'最小出金額は {min_amount} {currency} です'}), 400
    
    fee = 0.0005 if currency == 'BTC' else 0.005
    
    with get_db() as db:
        balance_record = db.query(Balance).filter(Balance.asset == currency).first()
        if not balance_record or amount_float + fee > balance_record.amount:
            return jsonify({'error': '残高が不足しています'}), 400
        
        # アドレス形式チェック
        if currency == 'BTC' and not (address.startswith('1') or address.startswith('3') or address.startswith('bc1')):
            return jsonify({'error': 'BTCアドレスの形式が正しくありません'}), 400
        if currency == 'ETH' and not address.startswith('0x'):
            return jsonify({'error': 'ETHアドレスの形式が正しくありません'}), 400
        
        try:
            import uuid
            withdrawal_id = str(uuid.uuid4())[:8]
            
            new_tx = Transaction(
                id=withdrawal_id,
                type='withdraw',
                currency=currency,
                amount=amount_float,
                fee=fee,
                status='処理中',
                timestamp=datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                address=address
            )
            db.add(new_tx)
            
            balance_record.amount -= (amount_float + fee)
            db.commit()
            
            return jsonify({
                'success': True,
                'message': '出金申請を受け付けました',
                'withdrawal_id': withdrawal_id
            })
        except Exception as e:
            db.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500

# API: 現在価格取得（モック）
@app.route('/api/current-price', methods=['GET'])
def get_current_price():
    symbol = request.args.get('symbol', 'BTCUSDT')
    symbol_meta = SYMBOL_ASSET_MAP.get(symbol, SYMBOL_ASSET_MAP['BTCUSDT'])
    current_price = fetch_symbol_price_jpy(symbol, settings)

    return jsonify({
        'symbol': symbol_meta['pair'],
        'price': current_price,
        'timestamp': int(time.time() * 1000)
    })

# API: 注文作成
@app.route('/api/orders', methods=['POST'])
def create_order():
    data = request.json
    
    time.sleep(0.5)  # 処理遅延
    
    order_side = data.get('side')  # 'buy' or 'sell'
    order_type = data.get('type')  # 'market' or 'limit'
    symbol = data.get('symbol', 'BTCUSDT')
    amount = data.get('amount')
    price = data.get('price')  # 指値の場合のみ
    trade_type = data.get('trade_type', 'spot')
    leverage_ratio = float(data.get('leverage_ratio', 1))

    symbol_meta = SYMBOL_ASSET_MAP.get(symbol)
    if not symbol_meta:
        return jsonify({'error': '未対応の銘柄です'}), 400

    base_asset = symbol_meta['asset']
    pair_label = symbol_meta['pair']
    
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
    
    settings = load_settings()
    MIN_ORDER_AMOUNT = settings.get('min_order_amount', 0.0001)
    if amount_float < MIN_ORDER_AMOUNT:
        return jsonify({'error': f'最小注文数量は {MIN_ORDER_AMOUNT} {base_asset} です'}), 400

    market_price = fetch_symbol_price_jpy(symbol, settings)
    
    if order_type == 'limit':
        if not price:
            return jsonify({'error': '指値価格を入力してください'}), 400
        try:
            price_float = float(price)
        except:
            return jsonify({'error': '価格は数値で入力してください'}), 400
        if price_float <= 0:
            return jsonify({'error': '価格は0より大きい値を入力してください'}), 400
        
        price_limit = settings.get('price_limit_percent', 10) / 100
        min_price = market_price * (1 - price_limit)
        max_price = market_price * (1 + price_limit)
        if price_float < min_price or price_float > max_price:
            return jsonify({'error': f'価格は現在価格の±{settings.get("price_limit_percent", 10)}%以内（{int(min_price):,}円〜{int(max_price):,}円）で指定してください'}), 400
        
        execution_price = price_float
    else:
        execution_price = market_price
    
    with get_db() as db:
        jpy_balance = db.query(Balance).filter(Balance.asset == 'JPY').first()
        base_balance = db.query(Balance).filter(Balance.asset == base_asset).first()
        if not base_balance:
            base_balance = Balance(asset=base_asset, amount=0.0)
            db.add(base_balance)
            
        fee_rate = settings.get('fee_rate', 0.001)
        
        # 残高チェック
        if order_side == 'buy':
            required_jpy = execution_price * amount_float
            fee = required_jpy * fee_rate
            if trade_type == 'leverage':
                required_margin = required_jpy / leverage_ratio
                total_required = required_margin + fee
            else:
                total_required = required_jpy + fee
            
            if not jpy_balance or total_required > jpy_balance.amount:
                return jsonify({'error': f'JPY残高が不足しています（必要: {int(total_required):,}円、残高: {int(jpy_balance.amount if jpy_balance else 0):,}円）'}), 400
        else:
            if trade_type == 'leverage':
                required_jpy = execution_price * amount_float
                fee = required_jpy * fee_rate
                required_margin = required_jpy / leverage_ratio
                total_required = required_margin + fee
                
                if not jpy_balance or total_required > jpy_balance.amount:
                    return jsonify({'error': f'JPY残高が不足しています（必要: {int(total_required):,}円、残高: {int(jpy_balance.amount if jpy_balance else 0):,}円）'}), 400
            else:
                if not base_balance or amount_float > base_balance.amount:
                    return jsonify({'error': f'{base_asset}残高が不足しています（必要: {amount_float}{base_asset}、残高: {base_balance.amount if base_balance else 0}{base_asset}）'}), 400
        
        try:
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            order_count = db.query(Order).count()
            order_id = str(order_count + 1)
            
            new_order = Order(
                id=order_id,
                side=order_side,
                type=order_type,
                symbol=symbol,
                pair=pair_label,
                trade_type=trade_type,
                leverage_ratio=leverage_ratio,
                amount=amount_float,
                price=execution_price,
                total=execution_price * amount_float,
                fee=execution_price * amount_float * fee_rate,
                margin_used=total_required if trade_type == 'leverage' else 0,
                status='filled' if order_type == 'market' else 'pending',
                timestamp=now,
                filled_at=now if order_type == 'market' else None
            )
            db.add(new_order)
            
            # 成行注文の場合は即座に残高を更新
            if order_type == 'market':
                if trade_type == 'leverage':
                    jpy_balance.amount -= total_required
                else:
                    if order_side == 'buy':
                        jpy_balance.amount -= total_required
                        base_balance.amount += amount_float
                    else:
                        base_balance.amount -= amount_float
                        jpy_balance.amount += (new_order.total - new_order.fee)
            
            db.commit()
            
            return jsonify({
                'success': True,
                'message': '注文を受け付けました' if order_type == 'limit' else '注文が約定しました',
                'order': {
                    'id': new_order.id, 'side': new_order.side, 'type': new_order.type,
                    'symbol': new_order.symbol, 'pair': new_order.pair,
                    'trade_type': new_order.trade_type, 'leverage_ratio': new_order.leverage_ratio,
                    'amount': new_order.amount, 'price': new_order.price,
                    'status': new_order.status, 'timestamp': new_order.timestamp
                }
            })
        except Exception as e:
            db.rollback()
            return jsonify({'success': False, 'error': str(e)}), 500


# API: 注文一覧取得
@app.route('/api/orders', methods=['GET'])
def get_orders():
    status = request.args.get('status')  # 'pending', 'filled', 'all'
    
    with get_db() as db:
        query = db.query(Order).order_by(Order.timestamp.desc())
        if status == 'pending':
            query = query.filter(Order.status == 'pending')
        elif status == 'filled':
            query = query.filter(Order.status == 'filled')
        
        records = query.all()
        filtered_orders = [{
            'id': o.id, 'side': o.side, 'type': o.type, 'symbol': o.symbol,
            'pair': o.pair, 'trade_type': o.trade_type, 'leverage_ratio': o.leverage_ratio,
            'amount': o.amount, 'price': o.price, 'execution_price': o.execution_price,
            'total': o.total, 'fee': o.fee, 'margin_used': o.margin_used,
            'status': o.status, 'timestamp': o.timestamp, 'filled_at': o.filled_at
        } for o in records]
        
        return jsonify(filtered_orders)

# API: 注文キャンセル
@app.route('/api/orders/<string:order_id>', methods=['DELETE'])
def cancel_order(order_id):
    time.sleep(0.3)
    
    with get_db() as db:
        order = db.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            return jsonify({'error': '注文が見つかりません'}), 404
        
        if order.status not in ['open', 'pending']:
            return jsonify({'error': 'この注文はキャンセルできません'}), 400
        
        try:
            order.status = 'cancelled'
            db.commit()
            return jsonify({
                'success': True,
                'message': '注文をキャンセルしました',
                'order': {
                    'id': order.id, 'status': order.status
                }
            })
        except Exception as e:
            db.rollback()
            return jsonify({'error': str(e)}), 500

# ===== バックグラウンドタスク (指値注文の自動約定) =====

def check_limit_orders():
    with get_db() as db:
        pending_orders = db.query(Order).filter(Order.status == 'pending').all()
        if not pending_orders:
            return
            
        settings_data = load_settings()
        fee_rate = settings_data.get('fee_rate', 0.001)
        
        symbols = set([o.symbol for o in pending_orders])
        prices = {symbol: fetch_symbol_price_jpy(symbol, settings_data) for symbol in symbols}
        
        for order in pending_orders:
            current_price = prices.get(order.symbol)
            if not current_price:
                continue
            
            should_fill = False
            if order.side == 'buy' and current_price <= order.price:
                should_fill = True
            elif order.side == 'sell' and current_price >= order.price:
                should_fill = True
                
            if should_fill:
                jpy_balance = db.query(Balance).filter(Balance.asset == 'JPY').first()
                base_asset = order.symbol.replace('USDT', '')
                base_balance = db.query(Balance).filter(Balance.asset == base_asset).first()
                if not base_balance:
                    base_balance = Balance(asset=base_asset, amount=0.0)
                    db.add(base_balance)
                
                required_jpy = order.price * order.amount
                fee = required_jpy * fee_rate
                
                if order.side == 'buy':
                    if order.trade_type == 'leverage':
                        required_margin = required_jpy / order.leverage_ratio
                        total_required = required_margin + fee
                        jpy_balance.amount -= total_required
                    else:
                        total_required = required_jpy + fee
                        jpy_balance.amount -= total_required
                        base_balance.amount += order.amount
                else:
                    if order.trade_type == 'leverage':
                        required_margin = required_jpy / order.leverage_ratio
                        total_required = required_margin + fee
                        jpy_balance.amount -= total_required
                    else:
                        base_balance.amount -= order.amount
                        jpy_balance.amount += (order.total - order.fee)
                
                order.status = 'filled'
                order.execution_price = current_price
                order.filled_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            print(f"Failed to fill limit orders: {e}")

scheduler = BackgroundScheduler()
scheduler.add_job(func=check_limit_orders, trigger="interval", seconds=10)
scheduler.start()

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
