from fastapi.testclient import TestClient
from app.main import app
from test_api import isolated_db

def test_admin_requires_authentication(isolated_db):
    with TestClient(app) as c:
        assert c.get('/batches?admin=true').status_code==401
        assert c.get('/stats').status_code==401
        assert c.post('/batches/1/review?decision=approve').status_code==401

def test_customer_cannot_access_admin_and_logout_revokes_session(isolated_db):
    with TestClient(app) as c:
        r=c.post('/auth/register',json={'email':'buyer@test.local','name':'Buyer','password':'Password123','role':'admin'})
        assert r.status_code==201 and r.json()['role']=='customer'
        assert c.get('/auth/me').status_code==200
        assert c.get('/stats').status_code==403
        assert c.get('/batches?admin=true').status_code==403
        c.post('/auth/logout')
        assert c.get('/auth/me').status_code==401

def test_admin_login_and_wrong_password(isolated_db):
    with TestClient(app) as c:
        assert c.post('/auth/login',json={'email':'admin@test.local','password':'wrongpass'}).status_code==401
        assert c.post('/auth/login',json={'email':'admin@test.local','password':'TestPassword123'}).status_code==200
        assert c.get('/stats').status_code==200

def test_cross_origin_login_is_blocked(isolated_db):
    with TestClient(app) as c:
        assert c.post('/auth/login',headers={'Origin':'https://untrusted.example'},json={'email':'admin@test.local','password':'TestPassword123'}).status_code==403
