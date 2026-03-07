import urllib.request
import urllib.parse
import json

def test_leverage_order():
    url = "http://localhost:5000/api/orders"
    payload = {
        "side": "buy",
        "type": "market",
        "symbol": "BTCUSDT",
        "amount": "1.0",
        "trade_type": "leverage",
        "leverage_ratio": 10
    }
    
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    
    print("Testing 10x Leverage Order (1.0 BTC)...")
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            print(f"Status Code: {response.status}")
            print(f"Response: {json.dumps(result, indent=2, ensure_ascii=False)}")
    except urllib.error.HTTPError as e:
        print(f"HTTPError: {e.code}")
        print(f"Response: {e.read().decode('utf-8')}")

if __name__ == "__main__":
    test_leverage_order()
