from datetime import date, timedelta
import pytest
from app.services.pricing import price_batch

TODAY=date(2026,10,10)
def calc(days, qty=1, consumption=1, mrp=100):
    return price_batch(category="Snacks",mrp=mrp,quantity=qty,date_type="expiry",printed_date=TODAY+timedelta(days=days),storage_requirements="cool dry",consumption_per_day=consumption,today=TODAY)

@pytest.mark.parametrize("days,qty,expected_band,expected_feas,buy,sell",[(3,1,"short","high",.30,.70),(3,20,"short","low",.20,.60),(15,1,"moderate","high",.40,.75),(15,30,"moderate","low",.30,.70),(40,1,"long","high",.50,.80),(40,100,"long","low",.40,.75)])
def test_all_pricing_combinations(days,qty,expected_band,expected_feas,buy,sell):
    r=calc(days,qty); assert (r.shelf_life_band,r.feasibility_class,r.buying_percentage,r.selling_percentage)==(expected_band,expected_feas,buy,sell)

def test_expiry_boundary_and_past_expiry():
    assert calc(0).eligible
    assert not calc(-1).eligible

def test_ambiguous_best_before_and_missing_consumption_safe():
    r=price_batch(category="Unknown",mrp=10,quantity=1,date_type="best_before",printed_date=None,storage_requirements="dry",today=TODAY)
    assert r.requires_review and not r.eligible
    assert calc(4,consumption=0).eligible

@pytest.mark.parametrize("mrp,qty",[(0,2),(-1,2),(20,0),(20,-1)])
def test_invalid_price_and_quantity(mrp,qty): assert not calc(3,qty=qty,mrp=mrp).eligible

def test_price_math_and_spread():
    r=calc(3,qty=2,mrp=100); assert (r.buying_price_per_unit,r.selling_price_per_unit,r.total_buying_offer,r.total_listing_value,r.gross_spread)==(30,70,60,140,80)
