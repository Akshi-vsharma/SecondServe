from datetime import date, timedelta
import io
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.database import Base, get_db
from app.auth import User, hash_password
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

@pytest.fixture(autouse=True)
def isolated_db(tmp_path):
    """Route all API calls to a disposable database, never the developer database."""
    test_engine = create_engine(f"sqlite:///{tmp_path / 'test.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(test_engine)
    TestSession = sessionmaker(autoflush=False, bind=test_engine)
    with TestSession() as db:
        db.add(User(email='admin@test.local', name='Test admin', password_hash=hash_password('TestPassword123'),role='admin'))
        db.commit()
    def override_db():
        db = TestSession()
        try: yield db
        finally: db.close()
    app.dependency_overrides[get_db] = override_db
    yield
    app.dependency_overrides.clear()

def submit(client, days=5, quantity=3):
    client.post('/auth/login',json={'email':'admin@test.local','password':'TestPassword123'})
    return client.post('/batches', data={"name":"Test tea","category":"Snacks","mrp_per_unit":"100","pack_size":"100g","quantity":str(quantity),"date_type":"expiry","printed_date":str(date.today()+timedelta(days=days)),"storage_requirements":"cool dry","consumption_per_day":"1"})

def test_upload_validation_and_acceptance():
    with TestClient(app) as c:
        c.post('/auth/login',json={'email':'admin@test.local','password':'TestPassword123'})
        bad=c.post('/batches',data={"name":"x","category":"Snacks","mrp_per_unit":"1","pack_size":"1","quantity":"1","date_type":"expiry","printed_date":str(date.today()),"storage_requirements":"dry"},files={"image":("x.txt",io.BytesIO(b'x'),"text/plain")})
        assert bad.status_code==415
        created=submit(c); assert created.status_code==201 and created.json()["status"]=="eligible"
        accepted=c.post(f"/batches/{created.json()['id']}/accept"); assert accepted.json()["status"]=="listed"

def test_order_decrements_and_blocks_oversell_or_expired():
    with TestClient(app) as c:
        b=submit(c,quantity=3).json(); c.post(f"/batches/{b['id']}/accept")
        order=c.post('/orders',json={"customer_name":"A","items":[{"batch_id":b['id'],"quantity":2}]}); assert order.status_code==201
        assert c.post('/orders',json={"items":[{"batch_id":b['id'],"quantity":2}]}).status_code==409
        expired=submit(c,days=-1).json(); assert c.post('/orders',json={"items":[{"batch_id":expired['id'],"quantity":1}]}).status_code==409
