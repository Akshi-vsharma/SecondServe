from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app

def payload(days=4):
    return {'name':'Milk','category':'Dairy','mrp':60,'quantity':10,'date_type':'expiry','printed_date':str(date.today()+timedelta(days=days)),'storage_requirements':'Keep refrigerated','consumption_per_day':1}

def test_milk_preview_and_expiry():
    with TestClient(app) as c:
        r=c.post('/pricing/preview',json=payload()).json()
        assert r['remaining_days']==4 and r['feasibility_ratio']==2.5
        assert 'buying_price_per_unit' not in r and r['selling_price_per_unit']==36
        assert r['discount_percentage']==40
        assert not c.post('/pricing/preview',json=payload(-1)).json()['eligible']

def test_invalid_preview_and_missing_date():
    with TestClient(app) as c:
        data=payload();data['mrp']=-1
        assert c.post('/pricing/preview',json=data).status_code==422
        data=payload();data['printed_date']=None
        assert c.post('/pricing/preview',json=data).json()['requires_review']
