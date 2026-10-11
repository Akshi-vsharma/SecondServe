from fastapi.testclient import TestClient
from app.main import app
from test_api import isolated_db, submit

def test_duplicate_cart_lines_cannot_oversell(isolated_db):
    with TestClient(app) as client:
        batch = submit(client, quantity=3).json()
        client.post(f"/batches/{batch['id']}/accept")
        response = client.post('/orders', json={"items": [{"batch_id": batch['id'], "quantity": 2}, {"batch_id": batch['id'], "quantity": 2}]})
        assert response.status_code == 409
        assert client.get('/batches').json()[0]['quantity_remaining'] == 3

def test_fractional_order_quantity_is_rejected(isolated_db):
    with TestClient(app) as client:
        assert client.post('/orders', json={"items": [{"batch_id": 1, "quantity": 1.5}]}).status_code == 422
