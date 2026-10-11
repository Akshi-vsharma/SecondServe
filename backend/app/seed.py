from datetime import date, timedelta
from .database import Base, engine, SessionLocal
from .models import Batch
from .services.pricing import price_batch

def seed():
    Base.metadata.create_all(engine); db=SessionLocal()
    inventory = [
        ("Sunrise Oats","Staples",180,"1 kg",12,45,"best_before","oats"),
        ("Mango Fruit Drink","Beverages",45,"1 L",20,6,"best_before","fruit"),
        ("Roasted Almond Mix","Snacks",120,"200 g",8,12,"best_before","nuts"),
        ("Whole Wheat Crackers","Snacks",65,"250 g",15,4,"best_before","snacks"),
        ("Breakfast Granola","Staples",240,"400 g",18,20,"best_before","oats"),
        ("Classic Rolled Oats","Staples",140,"500 g",24,35,"best_before","oats"),
        ("Trail Mix","Snacks",190,"250 g",16,18,"best_before","nuts"),
        ("Salted Cashews","Snacks",220,"200 g",14,25,"best_before","nuts"),
        ("Honey Almonds","Snacks",210,"200 g",12,15,"best_before","nuts"),
        ("Multiseed Crackers","Snacks",95,"150 g",30,8,"best_before","snacks"),
        ("Oat Breakfast Bars","Snacks",160,"6 bars",20,11,"best_before","oats"),
        ("Orange Fruit Drink","Beverages",80,"1 L",28,10,"best_before","fruit"),
        ("Apple Fruit Drink","Beverages",85,"1 L",18,16,"best_before","fruit"),
        ("Cold Brew Coffee","Beverages",130,"250 ml",22,9,"best_before","coffee"),
        ("Ground Arabica Coffee","Beverages",350,"250 g",10,42,"best_before","coffee"),
        ("Wholegrain Toast","Bakery",110,"400 g",15,3,"expiry","bread"),
        ("Seeded Rusks","Bakery",90,"200 g",25,12,"best_before","bread"),
        ("Cinnamon Breakfast Loaf","Bakery",180,"350 g",8,4,"expiry","bread"),
        ("Fruit and Nut Muesli","Staples",280,"750 g",18,28,"best_before","oats"),
        ("Crunchy Nut Snack Pack","Snacks",75,"100 g",35,7,"best_before","nuts"),
    ]
    for name,category,mrp,pack,qty,days,dtype,photo in inventory:
        existing=db.query(Batch).filter_by(name=name,is_demo=True).first()
        if existing:
            if not existing.image_path: existing.image_path=f'/images/{photo}.jpg'
            continue
        printed=date.today()+timedelta(days=days); p=price_batch(category=category,mrp=mrp,quantity=qty,date_type=dtype,printed_date=printed,storage_requirements="Store in a cool, dry place")
        db.add(Batch(name=name,category=category,mrp_per_unit=mrp,pack_size=pack,quantity_total=qty,quantity_remaining=qty,date_type=dtype,printed_date=printed,storage_requirements="Store in a cool, dry place",status="listed",buying_price=p.buying_price_per_unit,selling_price=p.selling_price_per_unit,is_demo=True,image_path=f'/images/{photo}.jpg'))
    db.commit()
    db.close()
if __name__ == "__main__": seed()
