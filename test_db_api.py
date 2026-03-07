import requests
import json
import time

API_URL = "http://localhost:5000/api"

print("Waiting for server to start...")
time.sleep(2)

try:
    # 1. Test balance
    print("\n--- Testing /api/balance (GET) ---")
    resp = requests.get(f"{API_URL}/balance")
    print(resp.status_code)
    print(json.dumps(resp.json(), indent=2))
    
    # 2. Test settings via admin
    print("\n--- Testing /api/admin/settings (GET) ---")
    import hashlib
    admin_hash = hashlib.sha256('admin'.encode()).hexdigest()
    headers = {'Authorization': f'Bearer {admin_hash}'}
    resp = requests.get(f"{API_URL}/admin/settings", headers=headers)
    print(resp.status_code)
    print(json.dumps(resp.json(), indent=2))
    
    # 3. Test creating an order
    print("\n--- Testing /api/orders (POST) ---")
    order_payload = {
        'side': 'buy',
        'type': 'market',
        'symbol': 'BTCUSDT',
        'trade_type': 'spot',
        'leverage_ratio': 1,
        'amount': 0.05
    }
    resp = requests.post(f"{API_URL}/orders", json=order_payload)
    print(resp.status_code)
    print(json.dumps(resp.json(), indent=2))
    
    print("\n--- Testing /api/balance after order (GET) ---")
    resp = requests.get(f"{API_URL}/balance")
    print(json.dumps(resp.json(), indent=2))
    
except Exception as e:
    print(f"Error connecting to API: {e}")
