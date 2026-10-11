import json, shutil, uuid
from datetime import date
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.orm import Session
from .database import Base, engine, get_db
from .models import Batch, Order, OrderItem
from .services.pricing import price_batch
from .auth import router as auth_router, require_admin, current_user, User

Base.metadata.create_all(bind=engine)
app = FastAPI(title="Second Serve Marketplace API")
app.include_router(auth_router)
@app.middleware('http')
async def protect_origin(request:Request, call_next):
    from starlette.responses import JSONResponse
    origin=request.headers.get('origin')
    if request.method not in {'GET','HEAD','OPTIONS'} and origin and origin != 'http://localhost:3000':
        return JSONResponse({'detail':'Request origin is not allowed.'},status_code=403)
    return await call_next(request)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
UPLOADS = Path(__file__).resolve().parents[2] / "uploads"; UPLOADS.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS)), name="uploads")

def serialize(batch: Batch):
    result = price_batch(category=batch.category, mrp=batch.mrp_per_unit, quantity=batch.quantity_remaining, date_type=batch.date_type, printed_date=batch.printed_date, storage_requirements=batch.storage_requirements, consumption_per_day=batch.consumption_per_day, packaging_damaged=batch.packaging_damaged)
    return {"id":batch.id,"name":batch.name,"category":batch.category,"mrp_per_unit":batch.mrp_per_unit,"pack_size":batch.pack_size,"quantity_total":batch.quantity_total,"quantity_remaining":batch.quantity_remaining,"date_type":batch.date_type,"printed_date":str(batch.printed_date) if batch.printed_date else None,"storage_requirements":batch.storage_requirements,"target_buyer":batch.target_buyer,"image_path":batch.image_path,"status":batch.status,"buying_price":batch.buying_price,"selling_price":result.selling_price_per_unit,"is_demo":batch.is_demo,"pricing":result.to_dict()}

@app.get("/health")
def health(): return {"ok": True}

@app.get("/batches")
def batches(request: Request, category: Optional[str]=None, sort: str="", admin: bool=False, db: Session=Depends(get_db)):
    if admin: require_admin(current_user(request, db))
    q = db.query(Batch)
    if not admin: q = q.filter(Batch.status == "listed", Batch.quantity_remaining > 0)
    if category: q = q.filter(Batch.category == category)
    rows = [serialize(b) for b in q.all()]
    rows = [b for b in rows if admin or b["pricing"]["eligible"]]
    if sort == "price": rows.sort(key=lambda b:b["selling_price"] or 0)
    if sort == "urgency": rows.sort(key=lambda b:b["pricing"]["remaining_days"] if b["pricing"]["remaining_days"] is not None else 99999)
    return rows

@app.post("/batches", status_code=201)
async def create_batch(name: str=Form(...), category: str=Form(...), mrp_per_unit: float=Form(...), pack_size: str=Form(...), quantity: int=Form(...), date_type: str=Form(...), printed_date: str=Form(...), storage_requirements: str=Form(...), consumption_per_day: Optional[float]=Form(None), target_buyer: str=Form("household"), image: Optional[UploadFile]=File(None), db: Session=Depends(get_db), user:User=Depends(require_admin)):
    try: printed = date.fromisoformat(printed_date)
    except ValueError: raise HTTPException(422, "Printed date must be YYYY-MM-DD.")
    pricing = price_batch(category=category, mrp=mrp_per_unit, quantity=quantity, date_type=date_type, printed_date=printed, storage_requirements=storage_requirements, consumption_per_day=consumption_per_day)
    if mrp_per_unit <= 0 or quantity <= 0: raise HTTPException(422, "MRP and quantity must be positive.")
    image_path = None
    if image:
        if image.content_type not in {"image/jpeg","image/png","image/webp"}: raise HTTPException(415, "Use JPG, PNG, or WebP images.")
        contents = await image.read()
        if len(contents) > 5 * 1024 * 1024: raise HTTPException(413, "Image must be smaller than 5 MB.")
        suffix = {"image/jpeg":".jpg","image/png":".png","image/webp":".webp"}[image.content_type]
        filename = f"{uuid.uuid4().hex}{suffix}"; (UPLOADS / filename).write_bytes(contents); image_path=f"/uploads/{filename}"
    status = "pending" if pricing.requires_review else "eligible" if pricing.eligible else "rejected"
    batch = Batch(name=name.strip(),category=category,mrp_per_unit=mrp_per_unit,pack_size=pack_size,quantity_total=quantity,quantity_remaining=quantity,date_type=date_type,printed_date=printed,storage_requirements=storage_requirements,consumption_per_day=consumption_per_day,target_buyer=target_buyer,image_path=image_path,status=status,buying_price=pricing.buying_price_per_unit,selling_price=pricing.selling_price_per_unit,explanation_json=json.dumps(pricing.to_dict()))
    db.add(batch); db.commit(); db.refresh(batch)
    return serialize(batch)

@app.post("/batches/{batch_id}/accept")
def accept_offer(batch_id: int, db: Session=Depends(get_db), user:User=Depends(require_admin)):
    batch = db.get(Batch,batch_id)
    if not batch: raise HTTPException(404,"Batch not found")
    fresh = serialize(batch)["pricing"]
    if not fresh["eligible"]: raise HTTPException(409,"This batch is not currently eligible for acquisition.")
    if batch.status not in {"eligible","pending"}: raise HTTPException(409,"Offer cannot be accepted in this status.")
    batch.status="listed"; db.commit(); db.refresh(batch); return serialize(batch)

@app.post("/batches/{batch_id}/review")
def review(batch_id: int, decision: str, db: Session=Depends(get_db), user:User=Depends(require_admin)):
    batch=db.get(Batch,batch_id)
    if not batch: raise HTTPException(404,"Batch not found")
    if decision not in {"approve","reject"}: raise HTTPException(422,"Decision must be approve or reject")
    batch.status = "eligible" if decision == "approve" and serialize(batch)["pricing"]["eligible"] else "rejected"; db.commit(); return serialize(batch)

@app.post("/orders", status_code=201)
def order(payload: dict, db: Session=Depends(get_db)):
    items=payload.get("items",[]); name=payload.get("customer_name","Demo customer").strip()
    if not items: raise HTTPException(422,"Cart is empty.")
    combined = {}
    for item in items:
        if not isinstance(item, dict) or type(item.get("batch_id")) is not int or type(item.get("quantity")) is not int or item["quantity"] <= 0:
            raise HTTPException(422, "Cart items need integer batch IDs and positive integer quantities.")
        combined[item["batch_id"]] = combined.get(item["batch_id"], 0) + item["quantity"]
    items = [{"batch_id": batch_id, "quantity": quantity} for batch_id, quantity in combined.items()]
    try:
        # BEGIN IMMEDIATE prevents two SQLite requests from decrementing the same stock concurrently.
        db.connection().exec_driver_sql("BEGIN IMMEDIATE")
        total=0; resolved=[]
        for item in items:
            batch=db.get(Batch,int(item.get("batch_id",0))); qty=int(item.get("quantity",0))
            if not batch or qty <= 0: raise HTTPException(422,"Invalid cart item.")
            current=serialize(batch)["pricing"]
            if batch.status != "listed" or not current["eligible"]: raise HTTPException(409,f"{batch.name} is no longer eligible.")
            if batch.quantity_remaining < qty: raise HTTPException(409,f"Only {batch.quantity_remaining} units of {batch.name} remain.")
            price=current["selling_price_per_unit"]; total += price*qty; resolved.append((batch,qty,price))
        new_order=Order(customer_name=name,total=round(total,2)); db.add(new_order); db.flush()
        for batch,qty,price in resolved:
            batch.quantity_remaining -= qty; db.add(OrderItem(order_id=new_order.id,batch_id=batch.id,quantity=qty,unit_price=price))
            if batch.quantity_remaining == 0: batch.status="sold"
        db.commit(); return {"order_id":new_order.id,"total":new_order.total,"message":"Demo order confirmed. No payment was taken."}
    except HTTPException:
        db.rollback(); raise
    except Exception:
        db.rollback(); raise

@app.get("/stats")
def stats(db: Session=Depends(get_db), user:User=Depends(require_admin)):
    listed=db.query(Batch).filter(Batch.status=="listed").count()
    sold=db.query(OrderItem).with_entities(func.coalesce(func.sum(OrderItem.quantity),0)).scalar()
    savings=0
    for b in db.query(Batch).all():
        if b.selling_price: savings += max(0,(b.mrp_per_unit-b.selling_price)*(b.quantity_total-b.quantity_remaining))
    return {"available_batches":listed,"units_sold":sold,"estimated_customer_savings":round(savings,2)}
