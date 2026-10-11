"""Transparent, configurable rules for demo pricing; not an AI/ML prediction."""
from dataclasses import dataclass, asdict
from datetime import date
from typing import Optional

CONFIG = {
    "short_days": 7, "moderate_days": 30,
    "buying": {"short": {"low": .20, "high": .30}, "moderate": {"low": .30, "high": .40}, "long": {"low": .40, "high": .50}},
    "selling": {"short": {"low": .60, "high": .70}, "moderate": {"low": .70, "high": .75}, "long": {"low": .75, "high": .80}},
    "consumption_defaults": {"Snacks": 1, "Beverages": 1, "Staples": .15, "Dairy": 1, "Bakery": 1},
}

@dataclass
class PricingResult:
    eligible: bool; requires_review: bool; business_viable: bool; reason: str
    remaining_days: Optional[int]; shelf_life_band: Optional[str]; feasibility_ratio: Optional[float]
    feasibility_class: Optional[str]; buying_percentage: Optional[float]; selling_percentage: Optional[float]
    buying_price_per_unit: Optional[float]; selling_price_per_unit: Optional[float]
    total_buying_offer: Optional[float]; total_listing_value: Optional[float]; gross_spread: Optional[float]
    def to_dict(self): return asdict(self)

def price_batch(*, category: str, mrp: float, quantity: int, date_type: str, printed_date: Optional[date],
                storage_requirements: str, consumption_per_day: Optional[float] = None,
                packaging_damaged: bool = False, today: Optional[date] = None) -> PricingResult:
    today = today or date.today()
    if mrp <= 0 or quantity <= 0:
        return PricingResult(False, False, False, "MRP and quantity must be positive.", None, None, None, None, None, None, None, None, None, None, None)
    if date_type not in {"expiry", "best_before"} or not printed_date:
        return PricingResult(False, True, False, "Missing or ambiguous printed date needs manual review.", None, None, None, None, None, None, None, None, None, None, None)
    if packaging_damaged:
        return PricingResult(False, True, False, "Damaged packaging needs manual safety review.", None, None, None, None, None, None, None, None, None, None, None)
    if not storage_requirements.strip():
        return PricingResult(False, True, False, "Storage requirements need manual review.", None, None, None, None, None, None, None, None, None, None, None)
    days = (printed_date - today).days
    if date_type == "expiry" and days < 0:
        return PricingResult(False, False, False, "Applicable expiry date has passed.", days, None, None, None, None, None, None, None, None, None, None)
    # Best-before stock is marketplace-eligible through its printed date in this demo; past dates require review.
    if date_type == "best_before" and days < 0:
        return PricingResult(False, True, False, "Best-before date has passed and needs manual review.", days, None, None, None, None, None, None, None, None, None, None)
    band = "short" if days <= CONFIG["short_days"] else "moderate" if days <= CONFIG["moderate_days"] else "long"
    consumption = consumption_per_day if consumption_per_day and consumption_per_day > 0 else CONFIG["consumption_defaults"].get(category)
    ratio = quantity / (consumption * days) if consumption and consumption > 0 and days > 0 else None
    feasibility = "high" if ratio is not None and ratio <= 1 else "low"
    buy_pct, sell_pct = CONFIG["buying"][band][feasibility], CONFIG["selling"][band][feasibility]
    buy, sell = round(mrp * buy_pct, 2), round(mrp * sell_pct, 2)
    offer, value = round(buy * quantity, 2), round(sell * quantity, 2)
    spread = round(value - offer, 2)
    return PricingResult(True, False, spread > 0, "Eligible under demo rules. Pricing is a configurable business rule, not a safety certification.", days, band, round(ratio, 3) if ratio is not None else None, feasibility, buy_pct, sell_pct, buy, sell, offer, value, spread)
