import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.sql import func

# Use PostgreSQL by default since we are running via docker-compose
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://chartuser:chartpassword@localhost:5432/chartdb')

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Setting(Base):
    __tablename__ = "settings"
    key = Column(String, primary_key=True, index=True)
    value = Column(String) # store as JSON string or raw text depending on usage

class Balance(Base):
    __tablename__ = "balances"
    id = Column(Integer, primary_key=True, index=True)
    asset = Column(String, unique=True, index=True)
    amount = Column(Float, default=0.0)

class Order(Base):
    __tablename__ = "orders"
    id = Column(String, primary_key=True, index=True)
    side = Column(String) # 'buy', 'sell'
    type = Column(String) # 'market', 'limit'
    symbol = Column(String)
    pair = Column(String)
    trade_type = Column(String, default='spot')
    leverage_ratio = Column(Float, default=1.0)
    amount = Column(Float)
    price = Column(Float, nullable=True) # None for market orders before execution
    execution_price = Column(Float, nullable=True) # price at which it filled
    total = Column(Float, nullable=True)
    fee = Column(Float, nullable=True)
    margin_used = Column(Float, default=0.0)
    status = Column(String, default='pending') # 'pending', 'filled', 'cancelled'
    timestamp = Column(String) # stored as text for simplicity, matching original JSON
    filled_at = Column(String, nullable=True)

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(String, primary_key=True, index=True)
    type = Column(String) # 'deposit', 'withdraw'
    currency = Column(String)
    amount = Column(Float)
    fee = Column(Float, default=0.0)
    status = Column(String) # 'completed', 'pending', etc.
    timestamp = Column(String)
    address = Column(String, nullable=True) # for withdraws

def init_db():
    import time
    from sqlalchemy.exc import OperationalError
    
    max_retries = 30
    for i in range(max_retries):
        try:
            Base.metadata.create_all(bind=engine)
            break
        except OperationalError:
            if i < max_retries - 1:
                print(f"Waiting for database to be ready... ({i+1}/{max_retries})")
                time.sleep(1)
            else:
                raise
    
    # Initialize basic balance if empty
    db = SessionLocal()
    if db.query(Balance).count() == 0:
        default_balances = [
            {'asset': 'BTC', 'amount': 1.5},
            {'asset': 'ETH', 'amount': 10.0},
            {'asset': 'XRP', 'amount': 0.0},
            {'asset': 'SOL', 'amount': 0.0},
            {'asset': 'USDC', 'amount': 0.0},
            {'asset': 'JPY', 'amount': 5000000.0}
        ]
        for bal in default_balances:
            db.add(Balance(**bal))
        db.commit()
    
    # Initialize default settings if empty
    if db.query(Setting).count() == 0:
        import json
        default_settings = {
            'mock_btc_price': 15000000,
            'fee_rate': 0.001,
            'min_order_amount': 0.0001,
            'usdjpy_rate': 150,
            'price_limit_percent': 10,
            'maintenance_mode': False
        }
        for k, v in default_settings.items():
            db.add(Setting(key=k, value=json.dumps(v)))
        db.commit()
        
    db.close()

from contextlib import contextmanager

@contextmanager
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
